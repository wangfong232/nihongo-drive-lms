using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NihongoLms.Application.DTOs;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Data;
using NihongoLms.Infrastructure.Services;
using Xunit;

namespace NihongoLms.Tests;

public class QuizAdminServiceTests
{
    private readonly DbContextOptions<LmsDbContext> _dbOptions;

    public QuizAdminServiceTests()
    {
        _dbOptions = new DbContextOptionsBuilder<LmsDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
    }

    [Fact]
    public async Task CreateQuiz_And_Questions_Should_Store_PayloadJson_Correctly()
    {
        // Arrange
        using var dbContext = new LmsDbContext(_dbOptions);
        var quizService = new QuizAdminService(dbContext);

        var quizDto = new CreateQuizDto
        {
            Title = "N5 Lesson 01 Quiz",
            PassPercentage = 70,
            QuizType = QuizType.LessonQuiz
        };

        // Act
        var createdQuiz = await quizService.CreateQuizAsync(quizDto);

        var questionDto = new CreateQuizQuestionDto
        {
            QuizId = createdQuiz.Id,
            QuestionType = QuestionType.MultipleChoice,
            Prompt = "What is the meaning of 私?",
            Points = 1,
            PayloadJson = "{\"options\":[\"I/me\",\"You\",\"He\",\"She\"],\"correctIndex\":0}"
        };

        var createdQuestion = await quizService.CreateQuestionAsync(questionDto);

        // Assert
        createdQuiz.Id.Should().NotBeEmpty();
        createdQuestion.QuizId.Should().Be(createdQuiz.Id);
        createdQuestion.PayloadJson.Should().Contain("correctIndex\":0");

        var quizFromDb = await quizService.GetQuizByIdAsync(createdQuiz.Id);
        quizFromDb.Should().NotBeNull();
        quizFromDb!.Questions.Should().HaveCount(1);
        quizFromDb.Questions.First().Prompt.Should().Be("What is the meaning of 私?");
    }
}
