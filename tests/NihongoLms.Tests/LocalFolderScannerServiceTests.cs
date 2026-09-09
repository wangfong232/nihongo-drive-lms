using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using NihongoLms.Application.DTOs;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Data;
using NihongoLms.Infrastructure.Services;
using Xunit;

namespace NihongoLms.Tests;

public class LocalFolderScannerServiceTests : IDisposable
{
    private readonly DbContextOptions<LmsDbContext> _dbOptions;
    private readonly string _tempTestDir;

    public LocalFolderScannerServiceTests()
    {
        _dbOptions = new DbContextOptionsBuilder<LmsDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _tempTestDir = Path.Combine(Path.GetTempPath(), "NihongoLms_Test_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_tempTestDir);
    }

    public void Dispose()
    {
        try
        {
            if (Directory.Exists(_tempTestDir))
            {
                Directory.Delete(_tempTestDir, true);
            }
        }
        catch
        {
            // Ignore cleanup failure
        }
    }

    [Fact]
    public async Task ScanAndIndexLocalFolder_Should_Index_Hierarchy_And_Detect_Structure()
    {
        // Arrange
        var rootDir = Path.Combine(_tempTestDir, "N3_Shinkanzen");
        var sec1Dir = Path.Combine(rootDir, "1. Chặng 1 - Chữ Hán");
        var les1Dir = Path.Combine(sec1Dir, "Bài 01");
        Directory.CreateDirectory(les1Dir);

        var videoFile = Path.Combine(les1Dir, "Bai01_Video.mp4");
        await File.WriteAllBytesAsync(videoFile, new byte[] { 1, 2, 3, 4, 5 });

        var docFile = Path.Combine(les1Dir, "Bai01_GiaoTrinh.pdf");
        await File.WriteAllBytesAsync(docFile, new byte[] { 1, 2, 3 });

        using var db = new LmsDbContext(_dbOptions);
        var folderBuilder = new FolderCourseBuilderService(db, null!, new ConfigurationBuilder().Build(), null!, NullLogger<FolderCourseBuilderService>.Instance);
        var scanner = new LocalFolderScannerService(db, folderBuilder, NullLogger<LocalFolderScannerService>.Instance);

        // Act
        var result = await scanner.ScanAndIndexLocalFolderAsync(new ScanLocalFolderRequestDto
        {
            LocalPath = rootDir,
            CourseTitle = "Khóa N3 Shinkanzen",
            JlptLevel = "N3"
        });

        // Assert
        result.Should().NotBeNull();
        result.RootFolderName.Should().Be("N3_Shinkanzen");
        result.DetectionResult.Should().NotBeNull();
        result.DetectionResult.SuggestedConfig.CourseTitle.Should().Be("Khóa N3 Shinkanzen");
        result.DetectionResult.SuggestedConfig.JlptLevel.Should().Be("N3");
        result.DetectionResult.TotalFiles.Should().Be(2);
        result.DetectionResult.TotalSubFolders.Should().Be(2);

        // Check DB nodes
        var nodes = await db.DriveNodes.ToListAsync();
        nodes.Should().HaveCount(5); // Root + Sec1 + Les1 + Video + PDF

        var videoNode = nodes.FirstOrDefault(n => n.Name == "Bai01_Video.mp4");
        videoNode.Should().NotBeNull();
        videoNode!.NodeType.Should().Be(NodeType.File);
        videoNode.MimeType.Should().Be("video/mp4");
        videoNode.DriveFileId.Should().StartWith("local://");
        videoNode.WebViewLink.Should().Contain("/api/curator/stream/local?nodeId=");

        // Test file resolution
        var resolved = await scanner.ResolveLocalPhysicalFileAsync(videoNode.Id, null);
        resolved.Should().NotBeNull();
        resolved!.Value.PhysicalPath.Should().Be(videoFile);
        resolved.Value.MimeType.Should().Be("video/mp4");
    }

    [Fact]
    public async Task ScanAndIndexLocalFolder_Should_Throw_When_Directory_Not_Found()
    {
        // Arrange
        using var db = new LmsDbContext(_dbOptions);
        var folderBuilder = new FolderCourseBuilderService(db, null!, new ConfigurationBuilder().Build(), null!, NullLogger<FolderCourseBuilderService>.Instance);
        var scanner = new LocalFolderScannerService(db, folderBuilder, NullLogger<LocalFolderScannerService>.Instance);

        // Act & Assert
        var nonExistentPath = Path.Combine(_tempTestDir, "Non_Existent_Folder_" + Guid.NewGuid().ToString("N"));
        await Assert.ThrowsAsync<DirectoryNotFoundException>(() =>
            scanner.ScanAndIndexLocalFolderAsync(new ScanLocalFolderRequestDto { LocalPath = nonExistentPath }));
    }
}
