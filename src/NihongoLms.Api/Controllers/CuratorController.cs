using Microsoft.AspNetCore.Mvc;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;

namespace NihongoLms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CuratorController : ControllerBase
{
    private readonly ICuratorService _curatorService;
    private readonly IAutoSuggestPatternEngine _autoSuggestEngine;
    private readonly IFolderCourseBuilderService _folderCourseBuilder;
    private readonly ILocalFolderScannerService _localFolderScanner;

    public CuratorController(
        ICuratorService curatorService,
        IAutoSuggestPatternEngine autoSuggestEngine,
        IFolderCourseBuilderService folderCourseBuilder,
        ILocalFolderScannerService localFolderScanner)
    {
        _curatorService = curatorService;
        _autoSuggestEngine = autoSuggestEngine;
        _folderCourseBuilder = folderCourseBuilder;
        _localFolderScanner = localFolderScanner;
    }

    [HttpPost("assign")]
    public async Task<IActionResult> AssignDriveNode([FromBody] AssignDriveNodeRequestDto dto, CancellationToken cancellationToken)
    {
        var resource = await _curatorService.AssignDriveNodeAsync(dto, cancellationToken);
        return Ok(resource);
    }

    [HttpPost("assign-batch")]
    public async Task<IActionResult> BatchAssignDriveNodes([FromBody] BatchAssignDriveNodesRequestDto dto, CancellationToken cancellationToken)
    {
        var result = await _curatorService.BatchAssignDriveNodesAsync(dto, cancellationToken);
        return Ok(result);
    }

    [HttpDelete("resources/{id:guid}")]
    public async Task<IActionResult> RemoveResource(Guid id, CancellationToken cancellationToken)
    {
        await _curatorService.RemoveResourceAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("auto-suggest/analyze")]
    public async Task<IActionResult> AnalyzeAutoSuggestPattern([FromBody] AutoSuggestRequestDto dto, CancellationToken cancellationToken)
    {
        var result = await _autoSuggestEngine.AnalyzeFolderPatternAsync(dto, cancellationToken);
        return Ok(result);
    }

    [HttpPost("auto-suggest/apply")]
    public async Task<IActionResult> ApplyAutoSuggest([FromBody] ApplyAutoSuggestRequestDto dto, CancellationToken cancellationToken)
    {
        int createdCount = await _curatorService.ApplyAutoSuggestAsync(dto, cancellationToken);
        return Ok(new { message = $"Successfully created {createdCount} lessons from auto-suggest pattern.", count = createdCount });
    }

    [HttpPost("auto-build/scan")]
    public async Task<IActionResult> ScanAutoBuildCourse([FromBody] AutoBuildScanRequestDto dto, CancellationToken cancellationToken)
    {
        var preview = await _curatorService.ScanAndPreviewCourseFromDriveAsync(dto, cancellationToken);
        return Ok(preview);
    }

    [HttpPost("auto-build/scan-pdf")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> ScanAutoBuildCourseFromPdf(
        [FromForm] IFormFile file,
        [FromForm] string? courseTitle,
        [FromForm] string? jlptLevel,
        CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Vui lòng chọn file PDF lộ trình." });

        using var stream = file.OpenReadStream();
        var preview = await _curatorService.ScanAndPreviewCourseFromPdfAsync(
            stream, file.FileName, courseTitle, jlptLevel, cancellationToken);
        return Ok(preview);
    }

    [HttpPost("auto-build/apply")]
    public async Task<IActionResult> ApplyAutoBuildCourse([FromBody] AutoBuildApplyRequestDto dto, CancellationToken cancellationToken)
    {
        var course = await _curatorService.ApplyAutoBuiltCourseAsync(dto, cancellationToken);
        return Ok(course);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Flexible Folder-to-Course Builder Endpoints
    // ═════════════════════════════════════════════════════════════════════════

    [HttpPost("folder-builder/detect")]
    public async Task<IActionResult> DetectFolderStructure([FromBody] DetectFolderRequestDto dto, CancellationToken cancellationToken)
    {
        var result = await _folderCourseBuilder.DetectFolderStructureAsync(dto.FolderId, cancellationToken);
        return Ok(result);
    }

    [HttpPost("folder-builder/ai-analyze")]
    public async Task<IActionResult> AnalyzeFolderTreeWithAi([FromBody] AiAnalyzeTreeRequestDto dto, CancellationToken cancellationToken)
    {
        var result = await _folderCourseBuilder.AnalyzeFolderTreeWithAiAsync(dto.RootFolderId, dto.CustomPromptInstruction, cancellationToken);
        return Ok(result);
    }

    [HttpPost("folder-builder/preview")]
    public async Task<IActionResult> GenerateFolderCoursePreview([FromBody] FolderMappingConfigDto config, CancellationToken cancellationToken)
    {
        var preview = await _folderCourseBuilder.GeneratePreviewAsync(config, cancellationToken);
        return Ok(preview);
    }

    [HttpPost("folder-builder/apply")]
    public async Task<IActionResult> ApplyFolderCourse([FromBody] AutoBuildApplyRequestDto dto, CancellationToken cancellationToken)
    {
        var course = await _folderCourseBuilder.MaterializeCourseAsync(dto, cancellationToken);
        return Ok(course);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Local Folder & Media Streaming Endpoints (Offline-First / Local Storage)
    // ═════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Quét thư mục từ ổ cứng cục bộ (ví dụ: E:\TiengNhat\N3) và lập chỉ mục vào CSDL
    /// </summary>
    [HttpPost("local/scan")]
    public async Task<IActionResult> ScanLocalFolder([FromBody] ScanLocalFolderRequestDto dto, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.LocalPath))
        {
            return BadRequest(new { message = "Vui lòng nhập đường dẫn thư mục trên máy." });
        }

        try
        {
            var result = await _localFolderScanner.ScanAndIndexLocalFolderAsync(dto, cancellationToken);
            return Ok(result);
        }
        catch (DirectoryNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Lỗi quét thư mục cục bộ: {ex.Message}" });
        }
    }

    /// <summary>
    /// Phát stream video/audio/pdf trực tiếp từ ổ cứng với hỗ trợ Range processing (HTTP 206 Partial Content)
    /// </summary>
    [HttpGet("stream/local")]
    public async Task<IActionResult> StreamLocalMedia(
        [FromQuery] Guid? nodeId,
        [FromQuery] string? driveFileId,
        CancellationToken cancellationToken)
    {
        var fileInfo = await _localFolderScanner.ResolveLocalPhysicalFileAsync(nodeId, driveFileId, cancellationToken);
        if (fileInfo == null)
        {
            return NotFound(new { message = "Không tìm thấy tệp tin hoặc tệp không tồn tại trên ổ cứng." });
        }

        var (physicalPath, mimeType) = fileInfo.Value;

        // PhysicalFile with enableRangeProcessing: true handles HTTP 206 Partial Content, seeking, buffering effortlessly
        return PhysicalFile(physicalPath, mimeType, enableRangeProcessing: true);
    }
}

