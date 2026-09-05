using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using NihongoLms.Application.DTOs;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Data;
using NihongoLms.Infrastructure.Services;
using Xunit;

namespace NihongoLms.Tests;

public class FolderCourseBuilderServiceTests
{
    private readonly DbContextOptions<LmsDbContext> _dbOptions;

    public FolderCourseBuilderServiceTests()
    {
        _dbOptions = new DbContextOptionsBuilder<LmsDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
    }

    [Fact]
    public async Task DetectFolderStructure_Should_Detect_Minna_Lesson_Centric_Preset()
    {
        // Arrange
        using var db = new LmsDbContext(_dbOptions);
        var root = new DriveNode { Name = "N4 Dũng Mori", NodeType = NodeType.Folder, RawPath = "/0. DŨNG MORI N1-N5" };
        var bai26 = new DriveNode { Name = "Bài 26", NodeType = NodeType.Folder, RawPath = "/0. DŨNG MORI N1-N5/N4 Dũng Mori", ParentNodeId = root.Id };
        var chuHan = new DriveNode { Name = "1. Chữ hán", NodeType = NodeType.Folder, RawPath = "/0. DŨNG MORI N1-N5/N4 Dũng Mori/Bài 26", ParentNodeId = bai26.Id };
        var video = new DriveNode { Name = "videoplayback.mp4", NodeType = NodeType.File, RawPath = "/0. DŨNG MORI N1-N5/N4 Dũng Mori/Bài 26/1. Chữ hán", ParentNodeId = chuHan.Id, FileExtension = ".mp4" };

        db.DriveNodes.AddRange(root, bai26, chuHan, video);
        await db.SaveChangesAsync();

        var service = new FolderCourseBuilderService(db, null!, new ConfigurationBuilder().Build(), NullLogger<FolderCourseBuilderService>.Instance);

        // Act
        var result = await service.DetectFolderStructureAsync(root.Id);

        // Assert
        result.Should().NotBeNull();
        result.DetectedPreset.Should().Be("minna-lesson");
        result.TotalSubFolders.Should().Be(2);
        result.TotalFiles.Should().Be(1);
    }

    [Fact]
    public async Task GeneratePreview_Should_Apply_RawPath_Skill_Matching_And_Natural_Sort()
    {
        // Arrange
        using var db = new LmsDbContext(_dbOptions);
        var root = new DriveNode { Name = "N3 Dũng Mori", NodeType = NodeType.Folder, RawPath = "/0. DŨNG MORI N1-N5" };

        // Sections: Chương 2, Chương 10, Chương 1 (to test natural sorting)
        var ch10 = new DriveNode { Name = "Chương 10", NodeType = NodeType.Folder, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori", ParentNodeId = root.Id };
        var ch2 = new DriveNode { Name = "Chương 2", NodeType = NodeType.Folder, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori", ParentNodeId = root.Id };
        var ch1 = new DriveNode { Name = "Chương 1", NodeType = NodeType.Folder, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori", ParentNodeId = root.Id };

        // Subfolder with Kanji skill in RawPath
        var subCh1 = new DriveNode { Name = "Chữ hán bài giảng", NodeType = NodeType.Folder, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori/Chương 1", ParentNodeId = ch1.Id };
        var file1 = new DriveNode { Name = "videoplayback.mp4", NodeType = NodeType.File, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori/Chương 1/Chữ hán bài giảng", ParentNodeId = subCh1.Id, FileExtension = ".mp4" };

        // Cross-folder document outside regular folder
        var sharedFolder = new DriveNode { Name = "Tổng hợp tài liệu", NodeType = NodeType.Folder, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori", ParentNodeId = root.Id };
        var crossDoc = new DriveNode { Name = "Tai lieu chuong 1 tong hop.pdf", NodeType = NodeType.File, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori/Tổng hợp tài liệu", ParentNodeId = sharedFolder.Id, FileExtension = ".pdf" };

        db.DriveNodes.AddRange(root, ch10, ch2, ch1, subCh1, file1, sharedFolder, crossDoc);
        await db.SaveChangesAsync();

        var service = new FolderCourseBuilderService(db, null!, new ConfigurationBuilder().Build(), NullLogger<FolderCourseBuilderService>.Instance);

        var config = new FolderMappingConfigDto
        {
            RootFolderNodeId = root.Id,
            CourseTitle = "Khóa N3 Dũng Mori",
            JlptLevel = "N3",
            SectionFolderDepth = 1,
            LessonFolderDepth = 2,
            IncludeLeafFilesAsLessons = true,
            EnableCrossFolderMatching = true,
            ExcludeFolderPatterns = new List<string> { "*tổng hợp tài liệu*" } // Exclude from becoming a section, but allows cross-match
        };

        // Act
        var preview = await service.GeneratePreviewAsync(config);

        // Assert
        preview.Should().NotBeNull();
        // Natural Sort Check: Chương 1 must come before Chương 2, which comes before Chương 10
        preview.Sections.Select(s => s.Title).Should().ContainInOrder("Chương 1", "Chương 2", "Chương 10");

        // RawPath Skill Matching Check
        var sec1 = preview.Sections.First(s => s.Title == "Chương 1");
        sec1.Lessons.Should().NotBeEmpty();
        var les1 = sec1.Lessons.First();
        les1.Skill.Should().Be("Kanji");

        // Cross-folder doc check
        les1.Resources.Should().Contain(r => r.Title == "Tai lieu chuong 1 tong hop.pdf" && r.SourceTier == "CrossFolder");
    }
}
