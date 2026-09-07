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

    public async Task<LessonMicroProgressSummaryDto> GetLessonMicroProgressAsync(Guid lessonId, string userId = "default-user", CancellationToken cancellationToken = default)
    {
        var resources = await _dbContext.Resources
            .AsNoTracking()
            .Where(r => r.LessonId == lessonId)
            .OrderBy(r => r.DisplayOrder)
            .ToListAsync(cancellationToken);

        var resourceProgresses = await _dbContext.UserResourceProgresses
            .AsNoTracking()
            .Where(urp => urp.UserId == userId && urp.LessonId == lessonId)
            .ToListAsync(cancellationToken);

        var lessonProgress = await _dbContext.LessonProgresses
            .AsNoTracking()
            .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.LessonId == lessonId, cancellationToken);

        var videoResources = resources.Where(r => r.ResourceType == Domain.Enums.ResourceType.PrimaryVideo).ToList();
        var completedResourceIds = resourceProgresses.Where(rp => rp.IsCompleted).Select(rp => rp.ResourceId).ToHashSet();

        int completedVideos = videoResources.Count(vr => completedResourceIds.Contains(vr.Id));
        int completedTotal = resources.Count(r => completedResourceIds.Contains(r.Id));

        return new LessonMicroProgressSummaryDto
        {
            LessonId = lessonId,
            IsLessonCompleted = lessonProgress?.IsCompleted ?? false,
            CompletedCount = completedTotal,
            TotalResourceCount = resources.Count,
            CompletedVideoCount = completedVideos,
            TotalVideoCount = videoResources.Count,
            ResourceProgresses = resourceProgresses.Select(MapResourceProgressToDto).ToList()
        };
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

    public async Task<ToggleResourceProgressResultDto> ToggleResourceCompleteAsync(Guid resourceId, string userId = "default-user", CancellationToken cancellationToken = default)
    {
        var resource = await _dbContext.Resources
            .FirstOrDefaultAsync(r => r.Id == resourceId, cancellationToken);

        if (resource == null)
            throw new KeyNotFoundException($"Resource {resourceId} not found.");

        var urp = await _dbContext.UserResourceProgresses
            .FirstOrDefaultAsync(p => p.UserId == userId && p.ResourceId == resourceId, cancellationToken);

        if (urp == null)
        {
            urp = new UserResourceProgress
            {
                UserId = userId,
                ResourceId = resource.Id,
                LessonId = resource.LessonId,
                IsCompleted = true,
                CompletedAtUtc = DateTime.UtcNow,
                LastAccessedAtUtc = DateTime.UtcNow
            };
            _dbContext.UserResourceProgresses.Add(urp);
        }
        else
        {
            urp.IsCompleted = !urp.IsCompleted;
            urp.CompletedAtUtc = urp.IsCompleted ? DateTime.UtcNow : null;
            urp.LastAccessedAtUtc = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Evaluate composite auto-complete for Lesson
        return await EvaluateAndSyncLessonProgressAsync(resource.LessonId, urp, userId, cancellationToken);
    }

    public async Task<ToggleResourceProgressResultDto> MarkResourceCompleteAsync(Guid resourceId, bool isCompleted = true, string userId = "default-user", CancellationToken cancellationToken = default)
    {
        var resource = await _dbContext.Resources
            .FirstOrDefaultAsync(r => r.Id == resourceId, cancellationToken);

        if (resource == null)
            throw new KeyNotFoundException($"Resource {resourceId} not found.");

        var urp = await _dbContext.UserResourceProgresses
            .FirstOrDefaultAsync(p => p.UserId == userId && p.ResourceId == resourceId, cancellationToken);

        if (urp == null)
        {
            urp = new UserResourceProgress
            {
                UserId = userId,
                ResourceId = resource.Id,
                LessonId = resource.LessonId,
                IsCompleted = isCompleted,
                CompletedAtUtc = isCompleted ? DateTime.UtcNow : null,
                LastAccessedAtUtc = DateTime.UtcNow
            };
            _dbContext.UserResourceProgresses.Add(urp);
        }
        else
        {
            urp.IsCompleted = isCompleted;
            urp.CompletedAtUtc = isCompleted ? DateTime.UtcNow : null;
            urp.LastAccessedAtUtc = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return await EvaluateAndSyncLessonProgressAsync(resource.LessonId, urp, userId, cancellationToken);
    }

    private async Task<ToggleResourceProgressResultDto> EvaluateAndSyncLessonProgressAsync(Guid lessonId, UserResourceProgress currentUrp, string userId, CancellationToken ct)
    {
        var allResources = await _dbContext.Resources
            .Where(r => r.LessonId == lessonId)
            .ToListAsync(ct);

        var allResourceProgresses = await _dbContext.UserResourceProgresses
            .Where(p => p.UserId == userId && p.LessonId == lessonId)
            .ToListAsync(ct);

        var completedIds = allResourceProgresses.Where(p => p.IsCompleted).Select(p => p.ResourceId).ToHashSet();
        var videoResources = allResources.Where(r => r.ResourceType == Domain.Enums.ResourceType.PrimaryVideo).ToList();

        int completedVideos = videoResources.Count(vr => completedIds.Contains(vr.Id));
        int totalVideos = videoResources.Count;
        int completedTotal = allResources.Count(r => completedIds.Contains(r.Id));
        int totalResources = allResources.Count;

        // Auto-complete rule:
        // If lesson has videos -> requires 100% of videos completed.
        // If lesson has no videos (e.g. docs only) -> requires 100% of all resources completed.
        bool shouldAutoComplete = totalVideos > 0
            ? (completedVideos == totalVideos)
            : (totalResources > 0 && completedTotal == totalResources);

        var lessonProgress = await _dbContext.LessonProgresses
            .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.LessonId == lessonId, ct);

        if (shouldAutoComplete)
        {
            if (lessonProgress == null)
            {
                lessonProgress = new LessonProgress
                {
                    UserId = userId,
                    LessonId = lessonId,
                    IsCompleted = true,
                    IsManuallyCompleted = false,
                    CompletedAtUtc = DateTime.UtcNow,
                    LastAccessedAtUtc = DateTime.UtcNow
                };
                _dbContext.LessonProgresses.Add(lessonProgress);
            }
            else
            {
                lessonProgress.IsCompleted = true;
                if (!lessonProgress.CompletedAtUtc.HasValue) lessonProgress.CompletedAtUtc = DateTime.UtcNow;
                lessonProgress.LastAccessedAtUtc = DateTime.UtcNow;
            }
            await _dbContext.SaveChangesAsync(ct);
        }
        else
        {
            // If it wasn't explicitly manually completed by user and videos are not all done, uncheck lesson
            if (lessonProgress != null && !lessonProgress.IsManuallyCompleted && lessonProgress.IsCompleted)
            {
                lessonProgress.IsCompleted = false;
                lessonProgress.CompletedAtUtc = null;
                lessonProgress.LastAccessedAtUtc = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync(ct);
            }
        }

        return new ToggleResourceProgressResultDto
        {
            ResourceProgress = MapResourceProgressToDto(currentUrp),
            IsLessonCompleted = lessonProgress?.IsCompleted ?? false,
            CompletedCount = completedTotal,
            TotalResourceCount = totalResources,
            CompletedVideoCount = completedVideos,
            TotalVideoCount = totalVideos
        };
    }

    public async Task<LessonProgressDto> ToggleLessonCompleteAsync(Guid lessonId, bool isManuallyCompleted = true, string userId = "default-user", CancellationToken cancellationToken = default)
    {
        var progress = await _dbContext.LessonProgresses
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId, cancellationToken);

        bool targetState;
        if (progress == null)
        {
            targetState = true;
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
            targetState = !progress.IsCompleted;
            progress.IsCompleted = targetState;
            progress.IsManuallyCompleted = isManuallyCompleted;
            progress.CompletedAtUtc = targetState ? DateTime.UtcNow : null;
            progress.LastAccessedAtUtc = DateTime.UtcNow;
        }

        // Sync all underlying resources to match the macro toggle
        var lessonResources = await _dbContext.Resources
            .Where(r => r.LessonId == lessonId)
            .ToListAsync(cancellationToken);

        var existingResourceProgresses = await _dbContext.UserResourceProgresses
            .Where(urp => urp.UserId == userId && urp.LessonId == lessonId)
            .ToListAsync(cancellationToken);

        var existingMap = existingResourceProgresses.ToDictionary(urp => urp.ResourceId);

        foreach (var res in lessonResources)
        {
            if (existingMap.TryGetValue(res.Id, out var existingUrp))
            {
                existingUrp.IsCompleted = targetState;
                existingUrp.CompletedAtUtc = targetState ? DateTime.UtcNow : null;
                existingUrp.LastAccessedAtUtc = DateTime.UtcNow;
            }
            else
            {
                _dbContext.UserResourceProgresses.Add(new UserResourceProgress
                {
                    UserId = userId,
                    ResourceId = res.Id,
                    LessonId = lessonId,
                    IsCompleted = targetState,
                    CompletedAtUtc = targetState ? DateTime.UtcNow : null,
                    LastAccessedAtUtc = DateTime.UtcNow
                });
            }
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

    private static UserResourceProgressDto MapResourceProgressToDto(UserResourceProgress urp)
    {
        return new UserResourceProgressDto
        {
            Id = urp.Id,
            UserId = urp.UserId,
            ResourceId = urp.ResourceId,
            LessonId = urp.LessonId,
            IsCompleted = urp.IsCompleted,
            LastPlaybackPositionSeconds = urp.LastPlaybackPositionSeconds,
            TotalDurationSeconds = urp.TotalDurationSeconds,
            CompletedAtUtc = urp.CompletedAtUtc,
            LastAccessedAtUtc = urp.LastAccessedAtUtc
        };
    }
}
