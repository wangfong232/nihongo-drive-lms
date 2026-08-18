using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;

namespace NihongoLms.Infrastructure.Services;

public class SrsSchedulingEngine : ISrsSchedulingEngine
{
    public SrsReviewResultDto ProcessReview(ReviewSchedule schedule, int qualityRating, DateTime nowUtc)
    {
        // qualityRating:
        // 0: Again (< 1 phút)
        // 1: Hard  (< 10 phút)
        // 2: Good  (1 ngày / 3 ngày)
        // 3: Easy  (3 ngày / 7 ngày)

        int sm2Scale = qualityRating switch
        {
            0 => 0,
            1 => 3,
            2 => 4,
            3 => 5,
            _ => throw new ArgumentOutOfRangeException(nameof(qualityRating), "Quality rating must be 0 (Again), 1 (Hard), 2 (Good), or 3 (Easy).")
        };

        double oldEf = schedule.EaseFactor > 0 ? schedule.EaseFactor : 2.5;
        int oldRepetition = schedule.RepetitionCount;
        double oldInterval = schedule.IntervalDays;

        // Recalculate Ease Factor
        // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        double newEf = oldEf + (0.1 - (5 - sm2Scale) * (0.08 + (5 - sm2Scale) * 0.02));
        if (newEf < 1.3) newEf = 1.3;

        double newIntervalDays;
        int newRepetition;
        SrsState newState;
        DateTime nextReviewDate;

        if (qualityRating == 0)
        {
            // Again: < 1 phút
            newRepetition = 0;
            newIntervalDays = 1.0 / (24 * 60); // 1 minute
            nextReviewDate = nowUtc.AddMinutes(1);
            newState = SrsState.Relearning;
        }
        else if (qualityRating == 1)
        {
            // Hard: < 10 phút
            newRepetition = 0;
            newIntervalDays = 10.0 / (24 * 60); // 10 minutes
            nextReviewDate = nowUtc.AddMinutes(10);
            newState = SrsState.Learning;
        }
        else if (qualityRating == 2)
        {
            // Good: 1 ngày (lần đầu) -> 3 ngày -> interval * EF
            newRepetition = oldRepetition + 1;
            if (oldRepetition == 0)
            {
                newIntervalDays = 1.0;
            }
            else if (oldRepetition == 1)
            {
                newIntervalDays = 3.0;
            }
            else
            {
                newIntervalDays = Math.Max(1.0, Math.Round(oldInterval * newEf));
            }
            nextReviewDate = nowUtc.AddDays(newIntervalDays);
            newState = SrsState.Review;
        }
        else
        {
            // Easy: 3 ngày (lần đầu) -> 7 ngày -> interval * EF * 1.3
            newRepetition = oldRepetition + 1;
            if (oldRepetition == 0)
            {
                newIntervalDays = 3.0;
            }
            else if (oldRepetition == 1)
            {
                newIntervalDays = 7.0;
            }
            else
            {
                newIntervalDays = Math.Max(3.0, Math.Round(oldInterval * newEf * 1.3));
            }
            nextReviewDate = nowUtc.AddDays(newIntervalDays);
            newState = SrsState.Review;
        }

        // Update schedule state
        schedule.EaseFactor = newEf;
        schedule.IntervalDays = newIntervalDays;
        schedule.RepetitionCount = newRepetition;
        schedule.NextReviewDateUtc = nextReviewDate;
        schedule.LastReviewedAtUtc = nowUtc;
        schedule.LastQuality = sm2Scale;
        schedule.State = newState;

        return new SrsReviewResultDto
        {
            VocabularyEntryId = schedule.VocabularyEntryId,
            IntervalDays = newIntervalDays,
            EaseFactor = newEf,
            RepetitionCount = newRepetition,
            NextReviewDateUtc = nextReviewDate,
            State = newState
        };
    }
}
