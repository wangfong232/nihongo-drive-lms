using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NihongoLms.Application.DTOs;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Data;
using NihongoLms.Infrastructure.Services;
using Xunit;

namespace NihongoLms.Tests;

public class AutoSuggestPatternEngineTests
{
    private readonly DbContextOptions<LmsDbContext> _dbOptions;

    public AutoSuggestPatternEngineTests()
    {
        _dbOptions = new DbContextOptionsBuilder<LmsDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
    }

    [Theory]
    [InlineData(@"(?i)Bài\s*(\d+)", "Bài 01", true, 1)]
    [InlineData(@"(?i)Bài\s*(\d+)", "Bài 02 - Giới thiệu", true, 2)]
    [InlineData(@"(?i)Bài\s*(\d+)", "Thực hành 01", false, 0)]
    [InlineData(@"(?i)Lesson\s*(\d+)", "Lesson 05", true, 5)]
    public async Task AnalyzeFolderPatternAsync_Should_Match_Folder_Names_And_Classify_Files(
        string regexPattern, string folderName, bool shouldMatch, int expectedNumber)
    {
        // Arrange
        using var dbContext = new LmsDbContext(_dbOptions);

        var rootFolder = new DriveNode
        {
            DriveFileId = "parent_root_id",
            Name = "N5 Course Root",
            NodeType = NodeType.Folder,
            MimeType = "application/vnd.google-apps.folder"
        };
        dbContext.DriveNodes.Add(rootFolder);

        var testFolder = new DriveNode
        {
            DriveFileId = "test_folder_id",
            ParentNodeId = rootFolder.Id,
            Name = folderName,
            NodeType = NodeType.Folder,
            MimeType = "application/vnd.google-apps.folder"
        };
        dbContext.DriveNodes.Add(testFolder);

        // Add files inside testFolder
        var videoFile = new DriveNode
        {
            DriveFileId = "video_id",
            ParentNodeId = testFolder.Id,
            Name = "lecture.mp4",
            NodeType = NodeType.File,
            MimeType = "video/mp4",
            FileExtension = ".mp4"
        };

        var audioFile = new DriveNode
        {
            DriveFileId = "audio_id",
            ParentNodeId = testFolder.Id,
            Name = "listening.mp3",
            NodeType = NodeType.File,
            MimeType = "audio/mpeg",
            FileExtension = ".mp3"
        };

        var pdfFile = new DriveNode
        {
            DriveFileId = "pdf_id",
            ParentNodeId = testFolder.Id,
            Name = "exercise.pdf",
            NodeType = NodeType.File,
            MimeType = "application/pdf",
            FileExtension = ".pdf"
        };

        dbContext.DriveNodes.AddRange(videoFile, audioFile, pdfFile);
        await dbContext.SaveChangesAsync();

        var engine = new AutoSuggestPatternEngine(dbContext);
        var request = new AutoSuggestRequestDto
        {
            ParentFolderDriveNodeId = rootFolder.Id,
            PatternRegex = regexPattern,
            TargetSectionId = Guid.NewGuid()
        };

        // Act
        var result = await engine.AnalyzeFolderPatternAsync(request);

        // Assert
        if (shouldMatch)
        {
            result.MatchesFound.Should().Be(1);
            var lesson = result.SuggestedLessons.Single();
            lesson.LessonTitle.Should().Be(folderName);
            lesson.LessonNumber.Should().Be(expectedNumber);
            lesson.Resources.Should().HaveCount(3);
            lesson.Resources.Should().Contain(r => r.ResourceType == ResourceType.PrimaryVideo && r.FileName == "lecture.mp4");
            lesson.Resources.Should().Contain(r => r.ResourceType == ResourceType.Audio && r.FileName == "listening.mp3");
            lesson.Resources.Should().Contain(r => r.ResourceType == ResourceType.ExercisePdf && r.FileName == "exercise.pdf");
        }
        else
        {
            result.MatchesFound.Should().Be(0);
        }
    }
}
