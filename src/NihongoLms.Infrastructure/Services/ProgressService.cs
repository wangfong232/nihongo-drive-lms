using Microsoft.EntityFrameworkCore;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Infrastructure.Services;

public class ProgressService : IProgressService
{
    private readonly LmsDbContext _dbContext;

    public ProgressService(LmsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<LessonProgressDto> GetLessonProgressAsync(Guid lessonId, string userId = "default-user", CancellationToken cancellationToken = default)
    {
        var progress = await _dbContext.LessonProgresses
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId, cancellationToken);

        if (progress == null)
        {
            return new LessonProgressDto
            {
                LessonId = lessonId,
                UserId = userId,
                IsCompleted = false,
                IsQuizPassed = false,
                IsManuallyCompleted = false,
                LastPlaybackPositionSeconds = 0.0,
                TotalDurationSeconds = 0.0,
                LastAccessedAtUtc = DateTime.UtcNow
            };
        }

        return MapToDto(progress);
    }

    public async Task<LessonProgressDto> SavePlaybackPositionAsync(Guid lessonId, double positionSeconds, double durationSeconds, string userId = "default-user", CancellationToken cancellationToken = default)
    {
        var progress = await _dbContext.LessonProgresses
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId, cancellationToken);

        if (progress == null)
        {
            progress = new LessonProgress
            {
                UserId = userId,
                LessonId = lessonId,
                LastPlaybackPositionSeconds = Math.Max(0, positionSeconds),
                TotalDurationSeconds = Math.Max(0, durationSeconds),
                LastAccessedAtUtc = DateTime.UtcNow
            };
            _dbContext.LessonProgresses.Add(progress);
        }
        else
        {
            progress.LastPlaybackPositionSeconds = Math.Max(0, positionSeconds);
            if (durationSeconds > 0)
            {
                progress.TotalDurationSeconds = durationSeconds;
            }
            progress.LastAccessedAtUtc = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return MapToDto(progress);
    }

    public async Task<LessonProgressDto> ToggleLessonCompleteAsync(Guid lessonId, bool isManuallyCompleted = true, string userId = "default-user", CancellationToken cancellationToken = default)
    {
        var progress = await _dbContext.LessonProgresses
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId, cancellationToken);

        if (progress == null)
        {
            progress = new LessonProgress
            {
                UserId = userId,
                LessonId = lessonId,
                IsCompleted = true,
                IsManuallyCompleted = isManuallyCompleted,
                CompletedAtUtc = DateTime.UtcNow,
                LastAccessedAtUtc = DateTime.UtcNow
            };
            _dbContext.LessonProgresses.Add(progress);
        }
        else
        {
            progress.IsCompleted = !progress.IsCompleted;
            progress.IsManuallyCompleted = isManuallyCompleted;
            progress.CompletedAtUtc = progress.IsCompleted ? DateTime.UtcNow : null;
            progress.LastAccessedAtUtc = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return MapToDto(progress);
    }

    private static LessonProgressDto MapToDto(LessonProgress progress)
    {
        return new LessonProgressDto
        {
            Id = progress.Id,
            UserId = progress.UserId,
            LessonId = progress.LessonId,
            IsCompleted = progress.IsCompleted,
            IsQuizPassed = progress.IsQuizPassed,
            IsManuallyCompleted = progress.IsManuallyCompleted,
            LastPlaybackPositionSeconds = progress.LastPlaybackPositionSeconds,
            TotalDurationSeconds = progress.TotalDurationSeconds,
            CompletedAtUtc = progress.CompletedAtUtc,
            LastAccessedAtUtc = progress.LastAccessedAtUtc
        };
    }
}
