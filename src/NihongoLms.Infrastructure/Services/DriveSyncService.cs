using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Domain.Interfaces;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Infrastructure.Services;

public class DriveSyncService : IDriveSyncService
{
    private readonly LmsDbContext _dbContext;
    private readonly IGoogleDriveService _driveService;
    private readonly ITokenEncryptionService _encryptionService;
    private readonly ISystemSettingsService _settingsService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DriveSyncService> _logger;

    public DriveSyncService(
        LmsDbContext dbContext,
        IGoogleDriveService driveService,
        ITokenEncryptionService encryptionService,
        ISystemSettingsService settingsService,
        IConfiguration configuration,
        ILogger<DriveSyncService> logger)
    {
        _dbContext = dbContext;
        _driveService = driveService;
        _encryptionService = encryptionService;
        _settingsService = settingsService;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<SyncResult> SyncRawDriveTreeAsync(string? overrideRootFolderId = null, CancellationToken cancellationToken = default)
    {
        var result = new SyncResult();
        
        // 1. Get effective credentials and root folder ID from SystemSettings (or fallback to Env / Config)
        var (effClientId, effClientSecret, effRefreshToken, effRootFolderId) = await _settingsService.GetEffectiveDriveCredentialsAsync(cancellationToken);

        string rootFolderId = !string.IsNullOrWhiteSpace(overrideRootFolderId)
            ? overrideRootFolderId.Trim()
            : (!string.IsNullOrWhiteSpace(effRootFolderId) ? effRootFolderId : (_configuration["GoogleDrive:RootFolderId"] ?? string.Empty));

        if (string.IsNullOrWhiteSpace(rootFolderId) || rootFolderId == "YOUR_GOOGLE_DRIVE_ROOT_FOLDER_ID")
        {
            rootFolderId = "14MD4svpbhKvo6odQoGxvAgQTRSachRiz";
        }

        string accessToken;
        try
        {
            if (!string.IsNullOrEmpty(effRefreshToken) && !string.IsNullOrEmpty(effClientId) && !string.IsNullOrEmpty(effClientSecret))
            {
                accessToken = await _driveService.RefreshAccessTokenAsync(effClientId, effClientSecret, effRefreshToken, cancellationToken);
            }
            else
            {
                var tokenRecord = await _dbContext.UserOAuthTokens.FirstOrDefaultAsync(t => t.UserId == "default-user", cancellationToken);
                if (tokenRecord == null || string.IsNullOrEmpty(tokenRecord.EncryptedRefreshToken))
                {
                    result.Errors.Add("Google Drive credentials missing. Please configure Drive credentials in Settings or authenticate via Google OAuth.");
                    return result;
                }

                string refreshToken = _encryptionService.Decrypt(tokenRecord.EncryptedRefreshToken);
                string clientId = _configuration["Authentication:Google:ClientId"] ?? string.Empty;
                string clientSecret = _configuration["Authentication:Google:ClientSecret"] ?? string.Empty;

                accessToken = await _driveService.RefreshAccessTokenAsync(clientId, clientSecret, refreshToken, cancellationToken);

                // Update stored access token
                tokenRecord.EncryptedAccessToken = _encryptionService.Encrypt(accessToken);
                tokenRecord.ExpiresAtUtc = DateTime.UtcNow.AddHours(1);
                tokenRecord.UpdatedAtUtc = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refresh Google OAuth access token.");
            result.Errors.Add($"Token refresh failed: {ex.Message}");
            return result;
        }

        _logger.LogInformation("Starting Drive raw mirror sync for RootFolderId: {RootFolderId}", rootFolderId);

        var existingNodesMap = await _dbContext.DriveNodes.ToDictionaryAsync(n => n.DriveFileId, cancellationToken);
        var scannedDriveFileIds = new HashSet<string>();

        // Queue for BFS traversal: (folderDriveId, rawPathPrefix, parentNodeId)
        var folderQueue = new Queue<(string DriveId, string PathPrefix, Guid? ParentId)>();

        // Process Root folder first
        var rootDetails = await _driveService.FetchNodeDetailsAsync(accessToken, rootFolderId, "", cancellationToken);
        string rootName = rootDetails?.Name ?? "Root";

        folderQueue.Enqueue((rootFolderId, $"/{rootName}", null));

        while (folderQueue.Count > 0)
        {
            var (currentFolderId, currentPath, currentParentNodeId) = folderQueue.Dequeue();
            scannedDriveFileIds.Add(currentFolderId);

            // Fetch children
            IEnumerable<DriveNode> childNodes;
            try
            {
                childNodes = await _driveService.FetchChildNodesAsync(accessToken, currentFolderId, currentPath, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching children for folder ID: {FolderId} Path: {Path}", currentFolderId, currentPath);
                result.Errors.Add($"Failed scanning folder {currentPath}: {ex.Message}");
                continue;
            }

            foreach (var childNode in childNodes)
            {
                scannedDriveFileIds.Add(childNode.DriveFileId);

                if (existingNodesMap.TryGetValue(childNode.DriveFileId, out var existingNode))
                {
                    // Update existing
                    existingNode.Name = childNode.Name;
                    existingNode.NodeType = childNode.NodeType;
                    existingNode.MimeType = childNode.MimeType;
                    existingNode.FileExtension = childNode.FileExtension;
                    existingNode.Size = childNode.Size;
                    existingNode.WebViewLink = childNode.WebViewLink;
                    existingNode.ThumbnailLink = childNode.ThumbnailLink;
                    existingNode.RawPath = childNode.RawPath;
                    existingNode.ParentDriveFileId = childNode.ParentDriveFileId;
                    existingNode.ParentNodeId = currentParentNodeId;
                    existingNode.DriveCreatedTime = childNode.DriveCreatedTime;
                    existingNode.DriveModifiedTime = childNode.DriveModifiedTime;
                    existingNode.LastSyncedAtUtc = DateTime.UtcNow;
                    existingNode.IsDeletedInDrive = false;

                    result.NodesUpdated++;
                }
                else
                {
                    // Insert new
                    childNode.ParentNodeId = currentParentNodeId;
                    _dbContext.DriveNodes.Add(childNode);
                    existingNodesMap[childNode.DriveFileId] = childNode;
                    existingNode = childNode;

                    result.NodesAdded++;
                }

                // If folder, enqueue for deeper scanning
                if (childNode.NodeType == NodeType.Folder)
                {
                    folderQueue.Enqueue((childNode.DriveFileId, childNode.RawPath, existingNode.Id));
                }
            }
        }

        // Detect soft-deleted nodes in Drive
        foreach (var (driveFileId, node) in existingNodesMap)
        {
            if (!scannedDriveFileIds.Contains(driveFileId) && !node.IsDeletedInDrive)
            {
                node.IsDeletedInDrive = true;
                node.LastSyncedAtUtc = DateTime.UtcNow;
                result.NodesSoftDeleted++;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Drive Raw Mirror Sync completed. Added: {Added}, Updated: {Updated}, Deleted: {Deleted}",
            result.NodesAdded, result.NodesUpdated, result.NodesSoftDeleted);

        return result;
    }
}
