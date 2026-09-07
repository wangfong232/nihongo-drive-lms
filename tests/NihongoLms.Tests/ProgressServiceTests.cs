using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Data;
using NihongoLms.Infrastructure.Services;
using Xunit;

namespace NihongoLms.Tests;

public class ProgressServiceTests
{
    private readonly DbContextOptions<LmsDbContext> _dbOptions;

    public ProgressServiceTests()
    {
        _dbOptions = new DbContextOptionsBuilder<LmsDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
    }

    [Fact]
    public async Task ToggleResourceComplete_Should_Update_Micro_Progress_And_Auto_Complete_Lesson_When_All_Videos_Done()
    {
        // Arrange
        using var db = new LmsDbContext(_dbOptions);
        var lesson = new Lesson { Id = Guid.NewGuid(), Title = "Chương 1 - Kanji" };

        var video1 = new Resource { Id = Guid.NewGuid(), LessonId = lesson.Id, Title = "Video 1.mp4", ResourceType = ResourceType.PrimaryVideo, DisplayOrder = 1 };
        var video2 = new Resource { Id = Guid.NewGuid(), LessonId = lesson.Id, Title = "Video 2.mp4", ResourceType = ResourceType.PrimaryVideo, DisplayOrder = 2 };
        var pdfDoc = new Resource { Id = Guid.NewGuid(), LessonId = lesson.Id, Title = "Chương 1.pdf", ResourceType = ResourceType.ExercisePdf, DisplayOrder = 3 };

        db.Lessons.Add(lesson);
        db.Resources.AddRange(video1, video2, pdfDoc);
        await db.SaveChangesAsync();

        var service = new ProgressService(db);

        // Act 1: Complete video 1
        var result1 = await service.ToggleResourceCompleteAsync(video1.Id);

        // Assert 1: Video 1 completed, but lesson NOT completed yet
        result1.ResourceProgress.IsCompleted.Should().BeTrue();
        result1.CompletedCount.Should().Be(1);
        result1.CompletedVideoCount.Should().Be(1);
        result1.TotalVideoCount.Should().Be(2);
        result1.IsLessonCompleted.Should().BeFalse();

        // Act 2: Complete video 2 (all videos done, PDF is not done)
        var result2 = await service.ToggleResourceCompleteAsync(video2.Id);

        // Assert 2: All videos done -> Lesson automatically becomes completed!
        result2.ResourceProgress.IsCompleted.Should().BeTrue();
        result2.CompletedVideoCount.Should().Be(2);
        result2.IsLessonCompleted.Should().BeTrue();

        var lessonProg = await service.GetLessonProgressAsync(lesson.Id);
        lessonProg.IsCompleted.Should().BeTrue();

        // Act 3: Toggle PDF doc (optional, does not break completed lesson)
        var result3 = await service.ToggleResourceCompleteAsync(pdfDoc.Id);
        result3.CompletedCount.Should().Be(3);
        result3.IsLessonCompleted.Should().BeTrue();
    }

    [Fact]
    public async Task ToggleLessonComplete_Should_Sync_All_Child_Resources()
    {
        // Arrange
        using var db = new LmsDbContext(_dbOptions);
        var lesson = new Lesson { Id = Guid.NewGuid(), Title = "Chương 2 - Ngữ Pháp" };

        var video1 = new Resource { Id = Guid.NewGuid(), LessonId = lesson.Id, Title = "Video 1.mp4", ResourceType = ResourceType.PrimaryVideo, DisplayOrder = 1 };
        var video2 = new Resource { Id = Guid.NewGuid(), LessonId = lesson.Id, Title = "Video 2.mp4", ResourceType = ResourceType.PrimaryVideo, DisplayOrder = 2 };

        db.Lessons.Add(lesson);
        db.Resources.AddRange(video1, video2);
        await db.SaveChangesAsync();

        var service = new ProgressService(db);

        // Act: Manually complete whole lesson
        var lessonResult = await service.ToggleLessonCompleteAsync(lesson.Id, isManuallyCompleted: true);

        // Assert: Lesson is completed and all child resources are marked completed
        lessonResult.IsCompleted.Should().BeTrue();

        var summary = await service.GetLessonMicroProgressAsync(lesson.Id);
        summary.CompletedCount.Should().Be(2);
        summary.CompletedVideoCount.Should().Be(2);
        summary.IsLessonCompleted.Should().BeTrue();
        summary.ResourceProgresses.Should().AllSatisfy(rp => rp.IsCompleted.Should().BeTrue());

        // Act: Toggle lesson back to incomplete
        var uncompleteResult = await service.ToggleLessonCompleteAsync(lesson.Id, isManuallyCompleted: true);
        uncompleteResult.IsCompleted.Should().BeFalse();

        var summaryAfter = await service.GetLessonMicroProgressAsync(lesson.Id);
        summaryAfter.CompletedCount.Should().Be(0);
        summaryAfter.ResourceProgresses.Should().AllSatisfy(rp => rp.IsCompleted.Should().BeFalse());
    }
}
