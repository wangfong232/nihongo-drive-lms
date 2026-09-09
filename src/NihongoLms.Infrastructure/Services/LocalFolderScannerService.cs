using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Infrastructure.Services;

public class LocalFolderScannerService : ILocalFolderScannerService
{
    private readonly LmsDbContext _dbContext;
    private readonly IFolderCourseBuilderService _folderBuilder;
    private readonly ILogger<LocalFolderScannerService> _logger;

    public LocalFolderScannerService(
        LmsDbContext dbContext,
        IFolderCourseBuilderService folderBuilder,
        ILogger<LocalFolderScannerService> logger)
    {
        _dbContext = dbContext;
        _folderBuilder = folderBuilder;
        _logger = logger;
    }

    public async Task<ScanLocalFolderResponseDto> ScanAndIndexLocalFolderAsync(
        ScanLocalFolderRequestDto request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.LocalPath))
        {
            throw new ArgumentException("Đường dẫn thư mục không được để trống.", nameof(request.LocalPath));
        }

        var rawInput = request.LocalPath.Trim().Trim('"', '\'');
        if (!Directory.Exists(rawInput))
        {
            throw new DirectoryNotFoundException($"Không tìm thấy thư mục tại đường dẫn: '{rawInput}'");
        }

        var rootDirInfo = new DirectoryInfo(rawInput);
        var normalizedRootPath = rootDirInfo.FullName;
        var rootFolderName = rootDirInfo.Name;

        _logger.LogInformation("Scanning local directory: {Path} ({Name})", normalizedRootPath, rootFolderName);

        // Map all directories and files recursively
        var createdOrUpdatedNodes = new List<DriveNode>();
        var dirNodeMap = new Dictionary<string, DriveNode>(StringComparer.OrdinalIgnoreCase);

        // 1. Root Node
        var rootDriveId = GenerateLocalDriveFileId(normalizedRootPath);
        var rootNode = await _dbContext.DriveNodes.FirstOrDefaultAsync(n => n.DriveFileId == rootDriveId, cancellationToken);
        if (rootNode == null)
        {
            rootNode = new DriveNode
            {
                Id = Guid.NewGuid(),
                DriveFileId = rootDriveId,
                Name = rootFolderName,
                NodeType = NodeType.Folder,
                MimeType = "application/vnd.google-apps.folder",
                RawPath = NormalizePathForLms(normalizedRootPath),
                LastSyncedAtUtc = DateTime.UtcNow,
                IsDeletedInDrive = false,
                DriveCreatedTime = rootDirInfo.CreationTimeUtc,
                DriveModifiedTime = rootDirInfo.LastWriteTimeUtc
            };
            _dbContext.DriveNodes.Add(rootNode);
        }
        else
        {
            rootNode.Name = rootFolderName;
            rootNode.RawPath = NormalizePathForLms(normalizedRootPath);
            rootNode.LastSyncedAtUtc = DateTime.UtcNow;
            rootNode.IsDeletedInDrive = false;
        }
        dirNodeMap[normalizedRootPath] = rootNode;
        createdOrUpdatedNodes.Add(rootNode);

        // 2. Scan subdirectories (Breadth-first / Ordered)
        var allSubDirs = rootDirInfo.GetDirectories("*", SearchOption.AllDirectories)
            .OrderBy(d => d.FullName.Length)
            .ToList();

        foreach (var dir in allSubDirs)
        {
            var dirDriveId = GenerateLocalDriveFileId(dir.FullName);
            var parentDir = dir.Parent?.FullName;
            DriveNode? parentNode = null;
            if (parentDir != null && dirNodeMap.TryGetValue(parentDir, out var pNode))
            {
                parentNode = pNode;
            }

            var dirNode = await _dbContext.DriveNodes.FirstOrDefaultAsync(n => n.DriveFileId == dirDriveId, cancellationToken);
            if (dirNode == null)
            {
                dirNode = new DriveNode
                {
                    Id = Guid.NewGuid(),
                    DriveFileId = dirDriveId,
                    ParentDriveFileId = parentNode?.DriveFileId,
                    ParentNodeId = parentNode?.Id,
                    Name = dir.Name,
                    NodeType = NodeType.Folder,
                    MimeType = "application/vnd.google-apps.folder",
                    RawPath = NormalizePathForLms(dir.FullName),
                    LastSyncedAtUtc = DateTime.UtcNow,
                    IsDeletedInDrive = false,
                    DriveCreatedTime = dir.CreationTimeUtc,
                    DriveModifiedTime = dir.LastWriteTimeUtc
                };
                _dbContext.DriveNodes.Add(dirNode);
            }
            else
            {
                dirNode.ParentDriveFileId = parentNode?.DriveFileId;
                dirNode.ParentNodeId = parentNode?.Id;
                dirNode.Name = dir.Name;
                dirNode.RawPath = NormalizePathForLms(dir.FullName);
                dirNode.LastSyncedAtUtc = DateTime.UtcNow;
                dirNode.IsDeletedInDrive = false;
            }
            dirNodeMap[dir.FullName] = dirNode;
            createdOrUpdatedNodes.Add(dirNode);
        }

        // 3. Scan files
        var allFiles = rootDirInfo.GetFiles("*", SearchOption.AllDirectories);
        foreach (var file in allFiles)
        {
            var fileDriveId = GenerateLocalDriveFileId(file.FullName);
            var parentDir = file.Directory?.FullName;
            DriveNode? parentNode = null;
            if (parentDir != null && dirNodeMap.TryGetValue(parentDir, out var pNode))
            {
                parentNode = pNode;
            }

            var ext = file.Extension.ToLowerInvariant();
            var mimeType = ResolveMimeType(ext);

            var fileNode = await _dbContext.DriveNodes.FirstOrDefaultAsync(n => n.DriveFileId == fileDriveId, cancellationToken);
            if (fileNode == null)
            {
                fileNode = new DriveNode
                {
                    Id = Guid.NewGuid(),
                    DriveFileId = fileDriveId,
                    ParentDriveFileId = parentNode?.DriveFileId,
                    ParentNodeId = parentNode?.Id,
                    Name = file.Name,
                    NodeType = NodeType.File,
                    MimeType = mimeType,
                    FileExtension = ext,
                    Size = file.Length,
                    RawPath = NormalizePathForLms(file.FullName),
                    WebViewLink = $"/api/curator/stream/local?nodeId={Guid.Empty}", // updated below with actual ID
                    LastSyncedAtUtc = DateTime.UtcNow,
                    IsDeletedInDrive = false,
                    DriveCreatedTime = file.CreationTimeUtc,
                    DriveModifiedTime = file.LastWriteTimeUtc
                };
                fileNode.WebViewLink = $"/api/curator/stream/local?nodeId={fileNode.Id}";
                _dbContext.DriveNodes.Add(fileNode);
            }
            else
            {
                fileNode.ParentDriveFileId = parentNode?.DriveFileId;
                fileNode.ParentNodeId = parentNode?.Id;
                fileNode.Name = file.Name;
                fileNode.MimeType = mimeType;
                fileNode.FileExtension = ext;
                fileNode.Size = file.Length;
                fileNode.RawPath = NormalizePathForLms(file.FullName);
                fileNode.WebViewLink = $"/api/curator/stream/local?nodeId={fileNode.Id}";
                fileNode.LastSyncedAtUtc = DateTime.UtcNow;
                fileNode.IsDeletedInDrive = false;
            }
            createdOrUpdatedNodes.Add(fileNode);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Indexed {Count} nodes from local path '{Path}' into database.", createdOrUpdatedNodes.Count, normalizedRootPath);

        // 4. Run heuristic auto-detection via existing FolderCourseBuilderService
        var detectionResult = await _folderBuilder.DetectFolderStructureAsync(rootNode.Id, cancellationToken);
        if (!string.IsNullOrWhiteSpace(request.CourseTitle))
        {
            detectionResult.SuggestedConfig.CourseTitle = request.CourseTitle.Trim();
        }
        if (!string.IsNullOrWhiteSpace(request.JlptLevel))
        {
            detectionResult.SuggestedConfig.JlptLevel = request.JlptLevel.Trim();
        }

        return new ScanLocalFolderResponseDto
        {
            RootFolderNodeId = rootNode.Id,
            LocalPath = normalizedRootPath,
            RootFolderName = rootNode.Name,
            DetectionResult = detectionResult
        };
    }

    public async Task<(string PhysicalPath, string MimeType)?> ResolveLocalPhysicalFileAsync(
        Guid? nodeId,
        string? driveFileId,
        CancellationToken cancellationToken = default)
    {
        DriveNode? node = null;
        if (nodeId.HasValue && nodeId.Value != Guid.Empty)
        {
            node = await _dbContext.DriveNodes.AsNoTracking().FirstOrDefaultAsync(n => n.Id == nodeId.Value, cancellationToken);
        }
        else if (!string.IsNullOrWhiteSpace(driveFileId))
        {
            node = await _dbContext.DriveNodes.AsNoTracking().FirstOrDefaultAsync(n => n.DriveFileId == driveFileId, cancellationToken);
        }

        if (node == null || string.IsNullOrWhiteSpace(node.RawPath))
        {
            return null;
        }

        // Restore back to OS physical path
        var physicalPath = Path.GetFullPath(node.RawPath.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(physicalPath))
        {
            _logger.LogWarning("Physical file not found on disk: {Path}", physicalPath);
            return null;
        }

        var mimeType = string.IsNullOrWhiteSpace(node.MimeType) || node.MimeType == "application/octet-stream"
            ? ResolveMimeType(Path.GetExtension(physicalPath))
            : node.MimeType;

        return (physicalPath, mimeType);
    }

    private static string GenerateLocalDriveFileId(string fullPath)
    {
        var normalized = fullPath.Trim().ToLowerInvariant().Replace('\\', '/');
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
        var hex = Convert.ToHexString(hashBytes).ToLowerInvariant();
        return $"local://{hex}";
    }

    private static string NormalizePathForLms(string fullPath)
    {
        return fullPath.Replace('\\', '/');
    }

    private static string ResolveMimeType(string extension)
    {
        var ext = (extension ?? "").Trim().ToLowerInvariant();
        return ext switch
        {
            ".mp4" => "video/mp4",
            ".mkv" => "video/x-matroska",
            ".webm" => "video/webm",
            ".mov" => "video/quicktime",
            ".avi" => "video/x-msvideo",
            ".mp3" => "audio/mpeg",
            ".m4a" => "audio/mp4",
            ".wav" => "audio/wav",
            ".aac" => "audio/aac",
            ".ogg" => "audio/ogg",
            ".pdf" => "application/pdf",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".doc" => "application/msword",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".xls" => "application/vnd.ms-excel",
            ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".ppt" => "application/vnd.ms-powerpoint",
            ".vtt" => "text/vtt",
            ".srt" => "text/plain",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            ".svg" => "image/svg+xml",
            _ => "application/octet-stream"
        };
    }
}
