using FluentAssertions;
using NihongoLms.Application.DTOs;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Services;
using Xunit;

namespace NihongoLms.Tests;

public class QuizGradingEngineTests
{
    private readonly QuizGradingEngine _gradingEngine = new();

    [Theory]
    [InlineData("0", true, 1.0)]      // Choice 0 correct
    [InlineData("1", false, 0.0)]     // Choice 1 incorrect
    [InlineData("\"0\"", true, 1.0)]   // Quoted index string correct
    public void GradeSubmission_MultipleChoice_DDT(string submittedAnswer, bool expectedIsCorrect, double expectedPoints)
    {
        // Arrange
        var quiz = new Quiz
        {
            PassPercentage = 70,
            Questions = new List<QuizQuestion>
            {
                new QuizQuestion
                {
                    Id = Guid.NewGuid(),
                    QuestionType = QuestionType.MultipleChoice,
                    Points = 1,
                    DisplayOrder = 1,
                    PayloadJson = "{\"options\":[\"I/me\",\"You\"],\"correctIndex\":0}"
                }
            }
        };

        var submission = new QuizSubmissionDto
        {
            QuizId = quiz.Id,
            Answers = new List<QuestionAnswerSubmissionDto>
            {
                new QuestionAnswerSubmissionDto { QuestionId = quiz.Questions.First().Id, AnswerJson = submittedAnswer }
            }
        };

        // Act
        var result = _gradingEngine.GradeSubmission(quiz, submission);

        // Assert
        result.Score.Should().Be(expectedPoints);
        result.QuestionResults.First().IsCorrect.Should().Be(expectedIsCorrect);
    }

    [Theory]
    [InlineData("は", true)]
    [InlineData("WA", true)]         // Case insensitive matching
    [InlineData(" が ", false)]       // Incorrect particle
    public void GradeSubmission_FillInTheBlank_DDT(string submittedAnswer, bool expectedIsCorrect)
    {
        // Arrange
        var quiz = new Quiz
        {
            PassPercentage = 70,
            Questions = new List<QuizQuestion>
            {
                new QuizQuestion
                {
                    Id = Guid.NewGuid(),
                    QuestionType = QuestionType.FillInTheBlank,
                    Points = 1,
                    DisplayOrder = 1,
                    PayloadJson = "{\"acceptableAnswers\":[\"は\",\"wa\"]}"
                }
            }
        };

        var submission = new QuizSubmissionDto
        {
            QuizId = quiz.Id,
            Answers = new List<QuestionAnswerSubmissionDto>
            {
                new QuestionAnswerSubmissionDto { QuestionId = quiz.Questions.First().Id, AnswerJson = $"\"{submittedAnswer}\"" }
            }
        };

        // Act
        var result = _gradingEngine.GradeSubmission(quiz, submission);

        // Assert
        result.QuestionResults.First().IsCorrect.Should().Be(expectedIsCorrect);
    }
}
