using Microsoft.EntityFrameworkCore;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Infrastructure.Services;

public class SrsService : ISrsService
{
    private readonly LmsDbContext _dbContext;
    private readonly ISrsSchedulingEngine _srsEngine;

    public SrsService(LmsDbContext dbContext, ISrsSchedulingEngine srsEngine)
    {
        _dbContext = dbContext;
        _srsEngine = srsEngine;
    }

    public async Task<List<SrsDueItemDto>> GetDueVocabularyAsync(string? jlptLevel, string userId = "default-user", CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var query = _dbContext.ReviewSchedules
            .AsNoTracking()
            .Include(r => r.VocabularyEntry)
                .ThenInclude(v => v!.AudioDriveNode)
            .Include(r => r.VocabularyEntry)
                .ThenInclude(v => v!.StrokeOrderDriveNode)
            .Where(r => r.UserId == userId && r.NextReviewDateUtc <= now);

        if (!string.IsNullOrWhiteSpace(jlptLevel))
        {
            query = query.Where(r => r.VocabularyEntry!.JlptLevel == jlptLevel);
        }

        // Split: new cards (State=New, max 20) + reviews (max 100)
        var newCards = await query
            .Where(r => r.State == SrsState.New)
            .OrderBy(r => r.CreatedAtUtc)
            .Take(20)
            .ToListAsync(cancellationToken);

        var reviewCards = await query
            .Where(r => r.State != SrsState.New)
            .OrderBy(r => r.NextReviewDateUtc)
            .Take(100)
            .ToListAsync(cancellationToken);

        var allDue = newCards.Concat(reviewCards).ToList();

        return allDue.Select(r => new SrsDueItemDto
        {
            ScheduleId = r.Id,
            Vocabulary = new VocabularyEntryDto
            {
                Id = r.VocabularyEntry!.Id,
                Word = r.VocabularyEntry.Word,
                Reading = r.VocabularyEntry.Reading,
                Meaning = r.VocabularyEntry.Meaning,
                ExampleSentence = r.VocabularyEntry.ExampleSentence,
                ExampleSentenceTranslation = r.VocabularyEntry.ExampleSentenceTranslation,
                PartOfSpeech = r.VocabularyEntry.PartOfSpeech,
                JlptLevel = r.VocabularyEntry.JlptLevel,
                AudioDriveFileId = r.VocabularyEntry.AudioDriveNode?.DriveFileId,
                StrokeOrderDriveFileId = r.VocabularyEntry.StrokeOrderDriveNode?.DriveFileId
            },
            EaseFactor = r.EaseFactor,
            IntervalDays = r.IntervalDays,
            RepetitionCount = r.RepetitionCount,
            State = r.State
        }).ToList();
    }

    public async Task<SrsStatsDto> GetStatsAsync(string userId = "default-user", CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var todayStart = now.Date;

        var dueToday = await _dbContext.ReviewSchedules
            .AsNoTracking()
            .CountAsync(r => r.UserId == userId && r.NextReviewDateUtc <= now, cancellationToken);

        var newToday = await _dbContext.ReviewSchedules
            .AsNoTracking()
            .CountAsync(r => r.UserId == userId && r.State == SrsState.New && r.NextReviewDateUtc <= now, cancellationToken);

        var reviewedToday = await _dbContext.SrsReviewLogs
            .AsNoTracking()
            .CountAsync(r => r.UserId == userId && r.ReviewedAtUtc >= todayStart, cancellationToken);

        var streak = await CalculateStreakAsync(userId, cancellationToken);

        return new SrsStatsDto
        {
            DueToday = dueToday,
            NewToday = newToday,
            ReviewedToday = reviewedToday,
            Streak = streak
        };
    }

    public async Task<SrsReviewResultDto> ReviewVocabularyAsync(Guid vocabularyEntryId, int qualityRating, string userId = "default-user", CancellationToken cancellationToken = default)
    {
        var schedule = await _dbContext.ReviewSchedules
            .FirstOrDefaultAsync(r => r.VocabularyEntryId == vocabularyEntryId && r.UserId == userId, cancellationToken);

        if (schedule == null)
        {
            throw new KeyNotFoundException($"ReviewSchedule for VocabularyEntry {vocabularyEntryId} not found.");
        }

        var oldEf = schedule.EaseFactor;
        var oldInterval = schedule.IntervalDays;
        var now = DateTime.UtcNow;

        var result = _srsEngine.ProcessReview(schedule, qualityRating, now);

        // Write to SrsReviewLog
        var log = new SrsReviewLog
        {
            UserId = userId,
            VocabularyEntryId = vocabularyEntryId,
            QualityRating = qualityRating,
            IntervalBeforeDays = oldInterval,
            IntervalAfterDays = result.IntervalDays,
            EaseFactorBefore = oldEf,
            EaseFactorAfter = result.EaseFactor,
            ReviewedAtUtc = now
        };

        _dbContext.SrsReviewLogs.Add(log);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return result;
    }

    public async Task<AddToSrsResultDto> AddToSrsDeckAsync(Guid vocabularyEntryId, string userId = "default-user", CancellationToken cancellationToken = default)
    {
        var vocabExists = await _dbContext.VocabularyEntries
            .AsNoTracking()
            .AnyAsync(v => v.Id == vocabularyEntryId, cancellationToken);

        if (!vocabExists)
            throw new KeyNotFoundException($"VocabularyEntry {vocabularyEntryId} not found.");

        var existing = await _dbContext.ReviewSchedules
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.VocabularyEntryId == vocabularyEntryId && r.UserId == userId, cancellationToken);

        if (existing != null)
            return new AddToSrsResultDto { AlreadyExists = true, ScheduleId = existing.Id, Message = "Already in SRS deck." };

        var schedule = new ReviewSchedule
        {
            UserId = userId,
            VocabularyEntryId = vocabularyEntryId,
            RepetitionCount = 0,
            IntervalDays = 0,
            EaseFactor = 2.5,
            NextReviewDateUtc = DateTime.UtcNow,
            State = SrsState.New,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.ReviewSchedules.Add(schedule);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new AddToSrsResultDto { AlreadyExists = false, ScheduleId = schedule.Id, Message = "Added to SRS deck." };
    }

    private async Task<int> CalculateStreakAsync(string userId, CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;
        int streak = 0;
        var checkDate = today;

        while (true)
        {
            var hasReview = await _dbContext.SrsReviewLogs
                .AsNoTracking()
                .AnyAsync(r => r.UserId == userId && r.ReviewedAtUtc.Date == checkDate, cancellationToken);

            if (!hasReview) break;
            streak++;
            checkDate = checkDate.AddDays(-1);

            if (streak > 365) break; // Safety cap
        }

        return streak;
    }
}
