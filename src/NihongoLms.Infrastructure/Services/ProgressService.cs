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

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, int> UserWeeklyGoals = new();

    public async Task<WeeklyPacingDto> GetWeeklyPacingAsync(string userId = "default-user", CancellationToken cancellationToken = default)
    {
        int targetGoal = UserWeeklyGoals.TryGetValue(userId, out int g) ? g : 2;

        var now = DateTime.UtcNow;
        int diff = (7 + (now.DayOfWeek - DayOfWeek.Monday)) % 7;
        var weekStart = now.Date.AddDays(-diff);
        var weekEnd = weekStart.AddDays(7).AddTicks(-1);

        int completedCount = await _dbContext.LessonProgresses
            .AsNoTracking()
            .CountAsync(p => p.UserId == userId
                          && p.IsCompleted
                          && p.CompletedAtUtc >= weekStart
                          && p.CompletedAtUtc <= weekEnd,
                          cancellationToken);

        int percentage = targetGoal > 0 ? Math.Min(100, (int)((double)completedCount / targetGoal * 100)) : 100;
        string msg = completedCount >= targetGoal
            ? "🎉 Tuyệt vời! Bạn đã hoàn thành mục tiêu tuần này!"
            : $"Đã hoàn thành {completedCount}/{targetGoal} bài tuần này. Cố lên nhé!";

        return new WeeklyPacingDto
        {
            TargetLessonsPerWeek = targetGoal,
            CompletedLessonsThisWeek = completedCount,
            Percentage = percentage,
            WeekStartDateUtc = weekStart,
            WeekEndDateUtc = weekEnd,
            StatusMessage = msg
        };
    }

    public Task<WeeklyPacingDto> SetWeeklyGoalAsync(int targetLessonsPerWeek, string userId = "default-user", CancellationToken cancellationToken = default)
    {
        int goal = Math.Max(1, Math.Min(14, targetLessonsPerWeek));
        UserWeeklyGoals[userId] = goal;
        return GetWeeklyPacingAsync(userId, cancellationToken);
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
