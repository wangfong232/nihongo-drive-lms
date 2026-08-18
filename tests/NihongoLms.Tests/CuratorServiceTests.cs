using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NihongoLms.Application.DTOs;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Data;
using NihongoLms.Infrastructure.Services;
using Xunit;

namespace NihongoLms.Tests;

public class CuratorServiceTests
{
    private readonly DbContextOptions<LmsDbContext> _dbOptions;

    public CuratorServiceTests()
    {
        _dbOptions = new DbContextOptionsBuilder<LmsDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
    }

    [Fact]
    public async Task ApplyAutoSuggestAsync_Should_Materialize_Lessons_And_Resources()
    {
        // Arrange
        using var dbContext = new LmsDbContext(_dbOptions);

        var course = new Course { Title = "N5 Elementary", JlptLevel = "N5" };
        var section = new Section { Course = course, Title = "Chặng 1" };
        dbContext.Courses.Add(course);
        dbContext.Sections.Add(section);

        var driveFileNode = new DriveNode
        {
            DriveFileId = "file_123",
            Name = "Lesson 01 Video.mp4",
            NodeType = NodeType.File,
            MimeType = "video/mp4"
        };
        dbContext.DriveNodes.Add(driveFileNode);
        await dbContext.SaveChangesAsync();

        var curatorService = new CuratorService(dbContext);

        var applyDto = new ApplyAutoSuggestRequestDto
        {
            TargetSectionId = section.Id,
            SelectedLessons = new List<SuggestedLessonDto>
            {
                new SuggestedLessonDto
                {
                    LessonTitle = "Bài 01",
                    LessonNumber = 1,
                    FolderDriveNodeId = Guid.NewGuid(),
                    Resources = new List<SuggestedResourceDto>
                    {
                        new SuggestedResourceDto
                        {
                            ResourceTitle = "Lesson 01 Video.mp4",
                            DriveNodeId = driveFileNode.Id,
                            ResourceType = ResourceType.PrimaryVideo
                        }
                    }
                }
            }
        };

        // Act
        int createdCount = await curatorService.ApplyAutoSuggestAsync(applyDto);

        // Assert
        createdCount.Should().Be(1);

        var createdLesson = await dbContext.Lessons
            .Include(l => l.Resources)
            .FirstOrDefaultAsync(l => l.SectionId == section.Id);

        createdLesson.Should().NotBeNull();
        createdLesson!.Title.Should().Be("Bài 01");
        createdLesson.Resources.Should().HaveCount(1);

        var resource = createdLesson.Resources.First();
        resource.Title.Should().Be("Lesson 01 Video.mp4");
        resource.ResourceType.Should().Be(ResourceType.PrimaryVideo);
        resource.DriveNodeId.Should().Be(driveFileNode.Id);
    }
}
