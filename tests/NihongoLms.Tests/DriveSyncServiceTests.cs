using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Domain.Interfaces;
using NihongoLms.Infrastructure.Data;
using NihongoLms.Infrastructure.Services;
using Xunit;

namespace NihongoLms.Tests;

public class DriveSyncServiceTests
{
    private readonly DbContextOptions<LmsDbContext> _dbOptions;

    public DriveSyncServiceTests()
    {
        _dbOptions = new DbContextOptionsBuilder<LmsDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
    }

    [Fact]
    public async Task SyncRawDriveTreeAsync_Should_Mirror_Tree_And_Detect_Deletions()
    {
        // Arrange
        using var dbContext = new LmsDbContext(_dbOptions);

        // Pre-populate user OAuth token
        var token = new UserOAuthToken
        {
            UserId = "default-user",
            EncryptedAccessToken = "mock_access_token",
            EncryptedRefreshToken = "mock_refresh_token"
        };
        dbContext.UserOAuthTokens.Add(token);

        // Existing node in DB that was deleted in Drive
        var deletedNode = new DriveNode
        {
            DriveFileId = "old_deleted_file",
            Name = "Old Video.mp4",
            NodeType = NodeType.File,
            MimeType = "video/mp4",
            RawPath = "/N5/Old Video.mp4",
            IsDeletedInDrive = false
        };
        dbContext.DriveNodes.Add(deletedNode);
        await dbContext.SaveChangesAsync();

        var mockDriveService = new Mock<IGoogleDriveService>();
        var mockEncryptionService = new Mock<ITokenEncryptionService>();

        mockEncryptionService.Setup(e => e.Decrypt("mock_refresh_token")).Returns("decrypted_refresh_token");
        mockEncryptionService.Setup(e => e.Encrypt(It.IsAny<string>())).Returns("encrypted_access_token");

        mockDriveService.Setup(d => d.RefreshAccessTokenAsync(It.IsAny<string>(), It.IsAny<string>(), "decrypted_refresh_token", It.IsAny<CancellationToken>()))
            .ReturnsAsync("new_access_token");

        mockDriveService.Setup(d => d.FetchNodeDetailsAsync("new_access_token", "root_folder_id", "", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DriveNode { DriveFileId = "root_folder_id", Name = "NihongoCourse", NodeType = NodeType.Folder, MimeType = "application/vnd.google-apps.folder" });

        var n5FolderNode = new DriveNode
        {
            DriveFileId = "n5_folder_id",
            ParentDriveFileId = "root_folder_id",
            Name = "N5",
            NodeType = NodeType.Folder,
            MimeType = "application/vnd.google-apps.folder",
            RawPath = "/NihongoCourse/N5"
        };

        var bai01VideoNode = new DriveNode
        {
            DriveFileId = "bai01_video_id",
            ParentDriveFileId = "n5_folder_id",
            Name = "Lesson 01 Video.mp4",
            NodeType = NodeType.File,
            MimeType = "video/mp4",
            RawPath = "/NihongoCourse/N5/Lesson 01 Video.mp4"
        };

        mockDriveService.Setup(d => d.FetchChildNodesAsync("new_access_token", "root_folder_id", "/NihongoCourse", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { n5FolderNode });

        mockDriveService.Setup(d => d.FetchChildNodesAsync("new_access_token", "n5_folder_id", "/NihongoCourse/N5", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { bai01VideoNode });

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "GoogleDrive:RootFolderId", "root_folder_id" },
                { "Authentication:Google:ClientId", "mock_client_id" },
                { "Authentication:Google:ClientSecret", "mock_client_secret" }
            })
            .Build();

        var syncService = new DriveSyncService(
            dbContext,
            mockDriveService.Object,
            mockEncryptionService.Object,
            config,
            NullLogger<DriveSyncService>.Instance);

        // Act
        var result = await syncService.SyncRawDriveTreeAsync();

        // Assert
        result.NodesAdded.Should().Be(2); // N5 folder + Lesson 01 Video
        result.NodesSoftDeleted.Should().Be(1); // old_deleted_file

        var updatedDeletedNode = await dbContext.DriveNodes.FirstAsync(n => n.DriveFileId == "old_deleted_file");
        updatedDeletedNode.IsDeletedInDrive.Should().BeTrue();

        var syncedVideo = await dbContext.DriveNodes.FirstAsync(n => n.DriveFileId == "bai01_video_id");
        syncedVideo.Name.Should().Be("Lesson 01 Video.mp4");
        syncedVideo.RawPath.Should().Be("/NihongoCourse/N5/Lesson 01 Video.mp4");
    }
}
