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

        var service = new FolderCourseBuilderService(db, null!, new ConfigurationBuilder().Build(), null!, NullLogger<FolderCourseBuilderService>.Instance);

        // Act
        var result = await service.DetectFolderStructureAsync(root.Id);

        // Assert
        result.Should().NotBeNull();
        result.DetectedPreset.Should().Be("minna-lesson");
        result.TotalSubFolders.Should().Be(2);
        result.TotalFiles.Should().Be(1);
    }

    [Fact]
    public async Task GeneratePreview_Should_Combine_Stage_And_Skill_As_Section_And_Clean_Leading_Order()
    {
        // Arrange
        using var db = new LmsDbContext(_dbOptions);
        var root = new DriveNode { Name = "N3 Dũng Mori", NodeType = NodeType.Folder, RawPath = "" };

        // Level 1: Chặng 1, Chặng 2
        var chang1 = new DriveNode { Name = "Chặng 1", NodeType = NodeType.Folder, RawPath = "N3 Dũng Mori", ParentNodeId = root.Id };
        var chang2 = new DriveNode { Name = "Chặng 2", NodeType = NodeType.Folder, RawPath = "N3 Dũng Mori", ParentNodeId = root.Id };

        // Level 2 under Chặng 1: 1. Chữ hán, 2. Ngữ pháp
        var chuHan = new DriveNode { Name = "1. Chữ hán", NodeType = NodeType.Folder, RawPath = "N3 Dũng Mori/Chặng 1", ParentNodeId = chang1.Id };
        var nguPhap = new DriveNode { Name = "2. Ngữ pháp", NodeType = NodeType.Folder, RawPath = "N3 Dũng Mori/Chặng 1", ParentNodeId = chang1.Id };

        // Level 3 under 1. Chữ hán: Chương 1, Chương 2
        var c1Kanji = new DriveNode { Name = "Chương 1", NodeType = NodeType.Folder, RawPath = "N3 Dũng Mori/Chặng 1/1. Chữ hán", ParentNodeId = chuHan.Id };
        var c2Kanji = new DriveNode { Name = "Chương 2", NodeType = NodeType.Folder, RawPath = "N3 Dũng Mori/Chặng 1/1. Chữ hán", ParentNodeId = chuHan.Id };

        // Level 4 Files under Chương 1: Video 4..9 + Test chương 1.docx
        var vKanji1 = new DriveNode { Name = "Video 4.mp4", NodeType = NodeType.File, RawPath = "N3 Dũng Mori/Chặng 1/1. Chữ hán/Chương 1", ParentNodeId = c1Kanji.Id, FileExtension = ".mp4" };
        var docKanji1 = new DriveNode { Name = "Test chương 1.docx", NodeType = NodeType.File, RawPath = "N3 Dũng Mori/Chặng 1/1. Chữ hán/Chương 1", ParentNodeId = c1Kanji.Id, FileExtension = ".docx" };

        // Level 3 under 2. Ngữ pháp: Chương 1
        var c1Grammar = new DriveNode { Name = "Chương 1", NodeType = NodeType.Folder, RawPath = "N3 Dũng Mori/Chặng 1/2. Ngữ pháp", ParentNodeId = nguPhap.Id };
        var vGrammar1 = new DriveNode { Name = "1.1 そう.mp4", NodeType = NodeType.File, RawPath = "N3 Dũng Mori/Chặng 1/2. Ngữ pháp/Chương 1", ParentNodeId = c1Grammar.Id, FileExtension = ".mp4" };

        // Level 2 under Chặng 2: Đọc Hiểu (Level 3: Đoản văn Tanbun)
        var docHieu = new DriveNode { Name = "Đọc Hiểu", NodeType = NodeType.Folder, RawPath = "N3 Dũng Mori/Chặng 2", ParentNodeId = chang2.Id };
        var tanbun = new DriveNode { Name = "Đoản văn (Tanbun)", NodeType = NodeType.Folder, RawPath = "N3 Dũng Mori/Chặng 2/Đọc Hiểu", ParentNodeId = docHieu.Id };
        var vTanbun = new DriveNode { Name = "Tanbun 1.mp4", NodeType = NodeType.File, RawPath = "N3 Dũng Mori/Chặng 2/Đọc Hiểu/Đoản văn (Tanbun)", ParentNodeId = tanbun.Id, FileExtension = ".mp4" };

        db.DriveNodes.AddRange(root, chang1, chang2, chuHan, nguPhap, c1Kanji, c2Kanji, vKanji1, docKanji1, c1Grammar, vGrammar1, docHieu, tanbun, vTanbun);
        await db.SaveChangesAsync();

        var service = new FolderCourseBuilderService(db, null!, new ConfigurationBuilder().Build(), null!, NullLogger<FolderCourseBuilderService>.Instance);

        var config = new FolderMappingConfigDto
        {
            RootFolderNodeId = root.Id,
            CourseTitle = "Khóa N3 Dũng Mori",
            JlptLevel = "N3",
            PresetName = "stage-skill-chapter",
            CombineParentStages = true,
            SectionGroupingMode = "combine-stage-skill",
            SectionFolderDepth = 2,
            LessonFolderDepth = 3,
            IncludeLeafFilesAsLessons = true,
        };

        // Act
        var preview = await service.GeneratePreviewAsync(config);

        // Assert
        preview.Should().NotBeNull();
        // Section titles must combine Stage + Clean Skill without leading order numbers!
        preview.Sections.Select(s => s.Title).Should().Contain(new[]
        {
            "Chặng 1 - Chữ Hán",
            "Chặng 1 - Ngữ Pháp",
            "Chặng 2 - Đọc Hiểu"
        });

        // Lessons under Chặng 1 - Chữ Hán: Chương 1, Chương 2
        var secKanji = preview.Sections.First(s => s.Title == "Chặng 1 - Chữ Hán");
        secKanji.Lessons.Select(l => l.Title).Should().ContainInOrder("Chương 1", "Chương 2");

        // Resources in Chương 1: Video 4.mp4 and Test chương 1.docx
        var lesC1Kanji = secKanji.Lessons.First(l => l.Title == "Chương 1");
        lesC1Kanji.Resources.Should().HaveCount(2);
        lesC1Kanji.Resources.Select(r => r.Title).Should().Contain(new[] { "Video 4.mp4", "Test chương 1.docx" });

        // Lessons under Chặng 2 - Đọc Hiểu: Đoản văn (Tanbun)
        var secDocHieu = preview.Sections.First(s => s.Title == "Chặng 2 - Đọc Hiểu");
        secDocHieu.Lessons.Select(l => l.Title).Should().Contain("Đoản văn (Tanbun)");
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

        var service = new FolderCourseBuilderService(db, null!, new ConfigurationBuilder().Build(), null!, NullLogger<FolderCourseBuilderService>.Instance);

        var config = new FolderMappingConfigDto
        {
            RootFolderNodeId = root.Id,
            CourseTitle = "Khóa N3 Dũng Mori",
            JlptLevel = "N3",
            SectionFolderDepth = 1,
            LessonFolderDepth = 2,
            IncludeLeafFilesAsLessons = true,
            EnableCrossFolderMatching = true,
            CombineParentStages = false,
            SectionGroupingMode = "single-folder",
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

    [Fact]
    public async Task GeneratePreview_Should_Match_DocFolder_Pdfs_Into_Corresponding_Chapters()
    {
        // Arrange
        using var db = new LmsDbContext(_dbOptions);
        var root = new DriveNode { Name = "N3 Dũng Mori", NodeType = NodeType.Folder, RawPath = "/0. DŨNG MORI N1-N5" };

        var chang1 = new DriveNode { Name = "Chặng 1", NodeType = NodeType.Folder, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori", ParentNodeId = root.Id };
        var chuHan = new DriveNode { Name = "1. Chữ hán", NodeType = NodeType.Folder, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori/Chặng 1", ParentNodeId = chang1.Id };

        // 0. Tài liệu folder alongside Chương 1, Chương 2
        var docFolder = new DriveNode { Name = "0. Tài liệu", NodeType = NodeType.Folder, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori/Chặng 1/1. Chữ hán", ParentNodeId = chuHan.Id };
        var docC1 = new DriveNode { Name = "Chương 1.pdf", NodeType = NodeType.File, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori/Chặng 1/1. Chữ hán/0. Tài liệu", ParentNodeId = docFolder.Id, FileExtension = ".pdf" };
        var docC2 = new DriveNode { Name = "Chương 2.pdf", NodeType = NodeType.File, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori/Chặng 1/1. Chữ hán/0. Tài liệu", ParentNodeId = docFolder.Id, FileExtension = ".pdf" };

        var c1Folder = new DriveNode { Name = "Chương 1", NodeType = NodeType.Folder, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori/Chặng 1/1. Chữ hán", ParentNodeId = chuHan.Id };
        var vC1 = new DriveNode { Name = "Video 1.mp4", NodeType = NodeType.File, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori/Chặng 1/1. Chữ hán/Chương 1", ParentNodeId = c1Folder.Id, FileExtension = ".mp4" };

        var c2Folder = new DriveNode { Name = "Chương 2", NodeType = NodeType.Folder, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori/Chặng 1/1. Chữ hán", ParentNodeId = chuHan.Id };
        var vC2 = new DriveNode { Name = "Video 2.mp4", NodeType = NodeType.File, RawPath = "/0. DŨNG MORI N1-N5/N3 Dũng Mori/Chặng 1/1. Chữ hán/Chương 2", ParentNodeId = c2Folder.Id, FileExtension = ".mp4" };

        db.DriveNodes.AddRange(root, chang1, chuHan, docFolder, docC1, docC2, c1Folder, vC1, c2Folder, vC2);
        await db.SaveChangesAsync();

        var service = new FolderCourseBuilderService(db, null!, new ConfigurationBuilder().Build(), null!, NullLogger<FolderCourseBuilderService>.Instance);

        var config = new FolderMappingConfigDto
        {
            RootFolderNodeId = root.Id,
            CourseTitle = "Khóa N3 Dũng Mori",
            CombineParentStages = true,
            SectionGroupingMode = "combine-stage-skill",
            SectionFolderDepth = 2,
            LessonFolderDepth = 3
        };

        // Act
        var preview = await service.GeneratePreviewAsync(config);

        // Assert
        preview.Should().NotBeNull();
        var secKanji = preview.Sections.Should().ContainSingle(s => s.Title == "Chặng 1 - Chữ Hán").Subject;
        // 0. Tài liệu should NOT be a lesson. Only Chương 1 and Chương 2 should be lessons!
        secKanji.Lessons.Select(l => l.Title).Should().BeEquivalentTo(new[] { "Chương 1", "Chương 2" });

        var l1 = secKanji.Lessons.First(l => l.Title == "Chương 1");
        l1.Resources.Select(r => r.Title).Should().Contain(new[] { "Video 1.mp4", "Chương 1.pdf" });

        var l2 = secKanji.Lessons.First(l => l.Title == "Chương 2");
        l2.Resources.Select(r => r.Title).Should().Contain(new[] { "Video 2.mp4", "Chương 2.pdf" });
    }
}
