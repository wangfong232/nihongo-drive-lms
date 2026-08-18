using NihongoLms.Domain.Entities;

namespace NihongoLms.Domain.Interfaces;

public interface ITokenEncryptionService
{
    string Encrypt(string plainText);
    string Decrypt(string cipherText);
}

public interface IGoogleDriveService
{
    Task<IEnumerable<DriveNode>> FetchChildNodesAsync(string accessToken, string parentFolderId, string rawPathPrefix, CancellationToken cancellationToken = default);
    Task<DriveNode?> FetchNodeDetailsAsync(string accessToken, string driveFileId, string rawPath, CancellationToken cancellationToken = default);
    Task<string> RefreshAccessTokenAsync(string clientId, string clientSecret, string refreshToken, CancellationToken cancellationToken = default);
}

public interface IDriveSyncService
{
    Task<SyncResult> SyncRawDriveTreeAsync(string? overrideRootFolderId = null, CancellationToken cancellationToken = default);
}

public class SyncResult
{
    public int NodesAdded { get; set; }
    public int NodesUpdated { get; set; }
    public int NodesSoftDeleted { get; set; }
    public List<string> Errors { get; set; } = new();
    public DateTime SyncedAtUtc { get; set; } = DateTime.UtcNow;
}
