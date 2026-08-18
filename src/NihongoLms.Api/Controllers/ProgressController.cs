using Microsoft.AspNetCore.Mvc;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;

namespace NihongoLms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProgressController : ControllerBase
{
    private readonly IProgressService _progressService;

    public ProgressController(IProgressService progressService)
    {
        _progressService = progressService;
    }

    [HttpGet("{lessonId}")]
    public async Task<IActionResult> GetLessonProgress(string lessonId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(lessonId, out var parsedId))
        {
            // Return empty progress for dummy/mock lesson IDs without throwing 404
            return Ok(new LessonProgressDto
            {
                UserId = "default-user",
                IsCompleted = false,
                IsQuizPassed = false,
                IsManuallyCompleted = false,
                LastPlaybackPositionSeconds = 0,
                TotalDurationSeconds = 0,
                LastAccessedAtUtc = DateTime.UtcNow
            });
        }

        var progress = await _progressService.GetLessonProgressAsync(parsedId, "default-user", cancellationToken);
        return Ok(progress);
    }

    [HttpPost("playback")]
    public async Task<IActionResult> SavePlaybackPosition([FromBody] PlaybackProgressDto dto, CancellationToken cancellationToken)
    {
        if (dto == null || dto.LessonId == Guid.Empty)
        {
            return Ok(new { success = true, skipped = true });
        }

        var progress = await _progressService.SavePlaybackPositionAsync(dto.LessonId, dto.PositionSeconds, dto.DurationSeconds, "default-user", cancellationToken);
        return Ok(progress);
    }

    [HttpPost("{lessonId}/complete")]
    public async Task<IActionResult> MarkLessonComplete(string lessonId, [FromBody] MarkCompleteDto? dto, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(lessonId, out var parsedId))
        {
            return Ok(new { success = true, isCompleted = true, lessonId });
        }

        bool isManual = dto?.IsManuallyCompleted ?? true;
        var progress = await _progressService.ToggleLessonCompleteAsync(parsedId, isManual, "default-user", cancellationToken);
        return Ok(progress);
    }
}
