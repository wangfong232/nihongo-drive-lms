using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NihongoLms.Application.DTOs;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Data;
using NihongoLms.Infrastructure.Services;
using Xunit;

namespace NihongoLms.Tests;

public class VocabularyServiceTests
{
    private readonly DbContextOptions<LmsDbContext> _dbOptions;

    public VocabularyServiceTests()
    {
        _dbOptions = new DbContextOptionsBuilder<LmsDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
    }

    [Fact]
    public async Task CreateVocabularyAsync_Should_Create_Entry_And_Auto_Generate_Initial_ReviewSchedule()
    {
        // Arrange
        using var dbContext = new LmsDbContext(_dbOptions);
        var vocabService = new VocabularyService(dbContext);

        var dto = new CreateVocabularyEntryDto
        {
            Word = "私",
            Reading = "わたし",
            Meaning = "I / me",
            ExampleSentence = "わたしは学生です。",
            ExampleSentenceTranslation = "I am a student.",
            PartOfSpeech = "Noun",
            JlptLevel = "N5"
        };

        // Act
        var result = await vocabService.CreateVocabularyAsync(dto);

        // Assert
        result.Id.Should().NotBeEmpty();
        result.Word.Should().Be("私");

        var createdVocab = await dbContext.VocabularyEntries.FirstOrDefaultAsync(v => v.Id == result.Id);
        createdVocab.Should().NotBeNull();

        // Verify SM-2 ReviewSchedule was auto-initialized
        var schedule = await dbContext.ReviewSchedules.FirstOrDefaultAsync(r => r.VocabularyEntryId == result.Id);
        schedule.Should().NotBeNull();
        schedule!.UserId.Should().Be("default-user");
        schedule.EaseFactor.Should().Be(2.5);
        schedule.RepetitionCount.Should().Be(0);
        schedule.State.Should().Be(SrsState.New);
    }
}
