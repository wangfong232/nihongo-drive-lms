using System;
using System.Threading;
using System.Threading.Tasks;
using NihongoLms.Application.DTOs;

namespace NihongoLms.Application.Interfaces;

/// <summary>
/// Dịch vụ quét và đồng bộ hóa thư mục cục bộ (Local Folder / Hard Drive) thành cây DriveNode
/// </summary>
public interface ILocalFolderScannerService
{
    /// <summary>
    /// Quét đệ quy thư mục cục bộ từ đường dẫn trên ổ cứng và sinh ra cây DriveNode trong DB
    /// </summary>
    Task<ScanLocalFolderResponseDto> ScanAndIndexLocalFolderAsync(ScanLocalFolderRequestDto request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lấy đường dẫn file vật lý an toàn dựa theo NodeId hoặc DriveFileId
    /// </summary>
    Task<(string PhysicalPath, string MimeType)?> ResolveLocalPhysicalFileAsync(Guid? nodeId, string? driveFileId, CancellationToken cancellationToken = default);
}
