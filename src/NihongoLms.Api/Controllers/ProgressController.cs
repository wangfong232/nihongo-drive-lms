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

    [HttpGet("lesson/{lessonId}/resources")]
    public async Task<IActionResult> GetLessonMicroProgress(string lessonId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(lessonId, out var parsedId))
        {
            return Ok(new LessonMicroProgressSummaryDto
            {
                LessonId = Guid.Empty,
                IsLessonCompleted = false,
                CompletedCount = 0,
                TotalResourceCount = 0,
                CompletedVideoCount = 0,
                TotalVideoCount = 0,
                ResourceProgresses = new List<UserResourceProgressDto>()
            });
        }

        var summary = await _progressService.GetLessonMicroProgressAsync(parsedId, "default-user", cancellationToken);
        return Ok(summary);
    }

    [HttpPost("resource/{resourceId}/toggle")]
    public async Task<IActionResult> ToggleResourceComplete(string resourceId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(resourceId, out var parsedId))
        {
            return Ok(new { success = true, skipped = true });
        }

        var result = await _progressService.ToggleResourceCompleteAsync(parsedId, "default-user", cancellationToken);
        return Ok(result);
    }

    [HttpPost("resource/{resourceId}/complete")]
    public async Task<IActionResult> MarkResourceComplete(string resourceId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(resourceId, out var parsedId))
        {
            return Ok(new { success = true, skipped = true });
        }

        var result = await _progressService.MarkResourceCompleteAsync(parsedId, true, "default-user", cancellationToken);
        return Ok(result);
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

    [HttpGet("weekly-pacing")]
    public async Task<IActionResult> GetWeeklyPacing(CancellationToken cancellationToken)
    {
        var pacing = await _progressService.GetWeeklyPacingAsync("default-user", cancellationToken);
        return Ok(pacing);
    }

    [HttpPost("weekly-goal")]
    public async Task<IActionResult> SetWeeklyGoal([FromBody] SetWeeklyGoalDto dto, CancellationToken cancellationToken)
    {
        int target = dto?.TargetLessonsPerWeek ?? 2;
        var pacing = await _progressService.SetWeeklyGoalAsync(target, "default-user", cancellationToken);
        return Ok(pacing);
    }
}
