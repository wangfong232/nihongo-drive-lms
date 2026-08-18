using FluentAssertions;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Services;
using Xunit;

namespace NihongoLms.Tests;

public class SrsSchedulingEngineTests
{
    private readonly SrsSchedulingEngine _srsEngine = new();

    [Theory]
    [InlineData(0, 0, 0.0, 2.5, 0, 1.0, 1.7, SrsState.Relearning)] // Quality 0 (Again): resets repetition to 0, interval 1d, EF 2.5 - 0.8 = 1.70
    [InlineData(1, 0, 0.0, 2.5, 1, 1.0, 2.36, SrsState.Review)]    // Quality 1 (Hard): 1st repetition -> interval 1d
    [InlineData(2, 0, 0.0, 2.5, 1, 1.0, 2.5, SrsState.Review)]     // Quality 2 (Good): 1st repetition -> interval 1d
    [InlineData(3, 0, 0.0, 2.5, 1, 1.0, 2.6, SrsState.Review)]     // Quality 3 (Easy): 1st repetition -> interval 1d
    [InlineData(2, 1, 1.0, 2.5, 2, 6.0, 2.5, SrsState.Review)]     // Quality 2 (Good): 2nd repetition -> interval 6d
    [InlineData(2, 2, 6.0, 2.5, 3, 15.0, 2.5, SrsState.Review)]    // Quality 2 (Good): 3rd repetition -> 6 * 2.5 = 15d
    public void ProcessReview_DataDriven_Should_Calculate_Expected_SM2_Intervals(
        int qualityRating, int initialRep, double initialInterval, double initialEf,
        int expectedRep, double expectedInterval, double expectedEf, SrsState expectedState)
    {
        // Arrange
        var now = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);
        var schedule = new ReviewSchedule
        {
            RepetitionCount = initialRep,
            IntervalDays = initialInterval,
            EaseFactor = initialEf,
            State = SrsState.New
        };

        // Act
        var result = _srsEngine.ProcessReview(schedule, qualityRating, now);

        // Assert
        result.RepetitionCount.Should().Be(expectedRep);
        result.IntervalDays.Should().Be(expectedInterval);
        result.EaseFactor.Should().BeApproximately(expectedEf, 0.01);
        result.State.Should().Be(expectedState);
        result.NextReviewDateUtc.Should().Be(now.AddDays(expectedInterval));
    }

    [Fact]
    public void ProcessReview_EaseFactor_Should_Never_Drop_Below_1_Point_3()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var schedule = new ReviewSchedule
        {
            RepetitionCount = 5,
            IntervalDays = 10,
            EaseFactor = 1.35
        };

        // Act - Submit 'Again' multiple times
        _srsEngine.ProcessReview(schedule, 0, now);
        _srsEngine.ProcessReview(schedule, 0, now);

        // Assert
        schedule.EaseFactor.Should().Be(1.3);
    }
}
