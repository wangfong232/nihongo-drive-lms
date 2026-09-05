using Microsoft.AspNetCore.Mvc;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;

namespace NihongoLms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly ISystemSettingsService _settingsService;
    private readonly ILogger<SettingsController> _logger;

    public SettingsController(
        ISystemSettingsService settingsService,
        ILogger<SettingsController> logger)
    {
        _settingsService = settingsService;
        _logger = logger;
    }

    /// <summary>
    /// Lấy thông tin cấu hình AI hiện tại (Masked Key, Provider, BaseUrl, Model, Nguồn cấu hình: database / environment / none).
    /// </summary>
    [HttpGet("ai")]
    public async Task<ActionResult<AiSettingsDto>> GetAiSettings(CancellationToken ct)
    {
        var settings = await _settingsService.GetAiSettingsAsync(ct);
        return Ok(settings);
    }

    /// <summary>
    /// Cập nhật cấu hình AI (cho phép đổi Model/Provider/BaseUrl độc lập mà không cần gửi lại API Key nếu không đổi).
    /// </summary>
    [HttpPut("ai")]
    [HttpPost("ai")]
    public async Task<ActionResult<AiSettingsDto>> UpdateAiSettings([FromBody] UpdateAiSettingsRequestDto request, CancellationToken ct)
    {
        if (request == null) return BadRequest("Dữ liệu cấu hình không hợp lệ.");
        var updated = await _settingsService.UpdateAiSettingsAsync(request, ct);
        return Ok(updated);
    }

    /// <summary>
    /// Xóa API Key trong Database (chuyển sang sử dụng cấu hình từ file .env / docker-compose nếu có).
    /// </summary>
    [HttpDelete("ai")]
    public async Task<ActionResult<AiSettingsDto>> DeleteAiSettings(CancellationToken ct)
    {
        var updated = await _settingsService.DeleteAiSettingsAsync(ct);
        return Ok(updated);
    }

    /// <summary>
    /// Kiểm tra kết nối tới nhà cung cấp AI (Google AI Studio / Gemini / OpenAI) với Key đang lưu hoặc Key mới nhập.
    /// </summary>
    [HttpPost("ai/test")]
    public async Task<ActionResult<TestAiConnectionResultDto>> TestAiConnection([FromBody] TestAiConnectionRequestDto? request, CancellationToken ct)
    {
        var result = await _settingsService.TestAiConnectionAsync(request, ct);
        return Ok(result);
    }

    /// <summary>
    /// Lấy thông tin cấu hình kết nối Google Drive (Masked ClientSecret, RefreshToken, RootFolderId, Source).
    /// </summary>
    [HttpGet("drive")]
    public async Task<ActionResult<DriveSettingsDto>> GetDriveSettings(CancellationToken ct)
    {
        var settings = await _settingsService.GetDriveSettingsAsync(ct);
        return Ok(settings);
    }

    /// <summary>
    /// Cập nhật thông tin cấu hình Google Drive (Credentials được mã hóa an toàn bằng Data Protection).
    /// </summary>
    [HttpPut("drive")]
    [HttpPost("drive")]
    public async Task<ActionResult<DriveSettingsDto>> UpdateDriveSettings([FromBody] UpdateDriveSettingsRequestDto request, CancellationToken ct)
    {
        if (request == null) return BadRequest("Dữ liệu cấu hình không hợp lệ.");
        var updated = await _settingsService.UpdateDriveSettingsAsync(request, ct);
        return Ok(updated);
    }

    /// <summary>
    /// Kiểm tra kết nối thực tế tới Google Drive (xác thực token và truy cập thư mục gốc).
    /// </summary>
    [HttpPost("drive/verify")]
    public async Task<ActionResult<VerifyDriveConnectionResultDto>> VerifyDriveConnection([FromBody] UpdateDriveSettingsRequestDto? request, CancellationToken ct)
    {
        var result = await _settingsService.VerifyDriveConnectionAsync(request, ct);
        return Ok(result);
    }
}