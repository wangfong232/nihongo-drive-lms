using Microsoft.AspNetCore.Mvc;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;

namespace NihongoLms.Api.Controllers;

/// <summary>
/// Quản lý Roadmap Template System.
/// Curator: parse PDF → xem trước → lưu template.
/// Learner: enroll → xem lịch học cá nhân → đánh dấu hoàn thành.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class RoadmapController : ControllerBase
{
    private readonly ISyllabusParserService _parser;
    private readonly IRoadmapService _roadmap;

    public RoadmapController(ISyllabusParserService parser, IRoadmapService roadmap)
    {
        _parser  = parser;
        _roadmap = roadmap;
    }

    // ═══════════════════════════════════════════════════════════
    //  CURATOR — Parse & Save
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// Bước 1: Upload file PDF → AI phân tích → trả về JSON preview với Drive suggestions.
    /// Chưa lưu vào DB. Curator xem, chỉnh sửa rồi gọi /save-template.
    /// </summary>
    [HttpPost("parse-syllabus")]
    [RequestSizeLimit(50 * 1024 * 1024)] // 50 MB
    public async Task<IActionResult> ParseSyllabus(
        IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "Vui lòng upload file PDF hợp lệ." });

        if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Chỉ chấp nhận file .pdf." });

        using var stream = file.OpenReadStream();
        var result = await _parser.ParseFromPdfAsync(stream, file.FileName, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Bước 2: Curator đã xác nhận nội dung → lưu RoadmapTemplate vào DB.
    /// Trả về template đã lưu với Id mới.
    /// </summary>
    [HttpPost("save-template")]
    public async Task<IActionResult> SaveTemplate(
        [FromBody] SaveRoadmapTemplateRequestDto dto, CancellationToken cancellationToken)
    {
        var result = await _parser.SaveRoadmapTemplateAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetTemplate), new { id = result.Id }, result);
    }

    // ═══════════════════════════════════════════════════════════
    //  CURATOR — CRUD Templates
    // ═══════════════════════════════════════════════════════════

    /// <summary>Danh sách tất cả template, lọc theo jlptLevel nếu cần.</summary>
    [HttpGet("templates")]
    public async Task<IActionResult> GetTemplates(
        [FromQuery] string? jlptLevel, CancellationToken cancellationToken)
    {
        var result = await _roadmap.GetTemplatesAsync(jlptLevel, cancellationToken);
        return Ok(result);
    }

    /// <summary>Chi tiết template kèm đầy đủ Items và DriveFiles.</summary>
    [HttpGet("templates/{id:guid}")]
    public async Task<IActionResult> GetTemplate(Guid id, CancellationToken cancellationToken)
    {
        var result = await _roadmap.GetTemplateByIdAsync(id, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Publish/Unpublish template để học viên có thể enroll.</summary>
    [HttpPatch("templates/{id:guid}/publish")]
    public async Task<IActionResult> PublishTemplate(
        Guid id, [FromQuery] bool isPublished, CancellationToken cancellationToken)
    {
        var result = await _roadmap.PublishTemplateAsync(id, isPublished, cancellationToken);
        return Ok(result);
    }

    /// <summary>Xóa template (cascade xóa Items, DriveFiles, Enrollments).</summary>
    [HttpDelete("templates/{id:guid}")]
    public async Task<IActionResult> DeleteTemplate(Guid id, CancellationToken cancellationToken)
    {
        await _roadmap.DeleteTemplateAsync(id, cancellationToken);
        return NoContent();
    }

    // ═══════════════════════════════════════════════════════════
    //  LEARNER — Enrollment & Schedule
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// Học viên đăng ký lộ trình.
    /// Nếu đã enroll rồi thì cập nhật StartDate và PaceMode.
    /// </summary>
    [HttpPost("enroll")]
    public async Task<IActionResult> Enroll(
        [FromBody] EnrollRoadmapRequestDto dto, CancellationToken cancellationToken)
    {
        const string userId = "default-user";
        var result = await _roadmap.EnrollAsync(dto, userId, cancellationToken);
        return Ok(result);
    }

    /// <summary>Danh sách các lộ trình học viên đã đăng ký.</summary>
    [HttpGet("my-enrollments")]
    public async Task<IActionResult> GetMyEnrollments(CancellationToken cancellationToken)
    {
        const string userId = "default-user";
        var result = await _roadmap.GetMyEnrollmentsAsync(userId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Lịch học cá nhân (tính động theo PaceMode).
    /// Trả về danh sách ngày học với date calendar, trạng thái hoàn thành, Drive files.
    /// </summary>
    [HttpGet("my-schedule/{enrollmentId:guid}")]
    public async Task<IActionResult> GetMySchedule(
        Guid enrollmentId, CancellationToken cancellationToken)
    {
        const string userId = "default-user";
        var result = await _roadmap.GetMyScheduleAsync(enrollmentId, userId, cancellationToken);
        return Ok(result);
    }

    /// <summary>Đánh dấu một ngày học là hoàn thành hoặc bỏ hoàn thành.</summary>
    [HttpPost("my-schedule/{enrollmentId:guid}/day/{dayNumber:int}/complete")]
    public async Task<IActionResult> MarkDayComplete(
        Guid enrollmentId, int dayNumber,
        [FromQuery] bool isCompleted = true,
        CancellationToken cancellationToken = default)
    {
        const string userId = "default-user";
        await _roadmap.MarkDayCompleteAsync(enrollmentId, dayNumber, isCompleted, userId, cancellationToken);
        return Ok(new { message = $"Ngày {dayNumber} đã được cập nhật trạng thái: {(isCompleted ? "hoàn thành" : "chưa hoàn thành")}." });
    }
}
