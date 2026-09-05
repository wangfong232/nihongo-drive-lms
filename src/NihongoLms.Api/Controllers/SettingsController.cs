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
    /// Lưu API Key và cấu hình AI vào Database cục bộ (PostgreSQL) - Key được mã hóa AES trước khi lưu.
    /// </summary>
    [HttpPost("ai")]
    public async Task<ActionResult<AiSettingsDto>> SaveAiSettings([FromBody] SaveAiSettingsRequestDto request, CancellationToken ct)
    {
        if (request == null) return BadRequest("Dữ liệu cấu hình không hợp lệ.");
        var updated = await _settingsService.SaveAiSettingsAsync(request, ct);
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
}