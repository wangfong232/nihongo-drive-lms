using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Infrastructure.Services;

public class QuizLearnerService : IQuizLearnerService
{
    private readonly LmsDbContext _dbContext;
    private readonly IQuizGradingEngine _gradingEngine;

    public QuizLearnerService(LmsDbContext dbContext, IQuizGradingEngine gradingEngine)
    {
        _dbContext = dbContext;
        _gradingEngine = gradingEngine;
    }

    public async Task<LearnerQuizDto?> GetLearnerQuizAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var quiz = await _dbContext.Quizzes
            .AsNoTracking()
            .Include(q => q.Questions.OrderBy(qq => qq.DisplayOrder))
                .ThenInclude(qq => qq.AudioDriveNode)
            .Include(q => q.Questions.OrderBy(qq => qq.DisplayOrder))
                .ThenInclude(qq => qq.ImageDriveNode)
            .FirstOrDefaultAsync(q => q.Id == id, cancellationToken);

        if (quiz == null) return null;

        return new LearnerQuizDto
        {
            Id = quiz.Id,
            Title = quiz.Title,
            Description = quiz.Description,
            PassPercentage = quiz.PassPercentage,
            TimeLimitMinutes = quiz.TimeLimitMinutes,
            Questions = quiz.Questions.Select(q => new LearnerQuestionDto
            {
                Id = q.Id,
                QuestionType = q.QuestionType,
                Prompt = q.Prompt,
                Points = q.Points,
                DisplayOrder = q.DisplayOrder,
                AudioDriveFileId = q.AudioDriveNode?.DriveFileId,
                ImageDriveFileId = q.ImageDriveNode?.DriveFileId,
                PayloadJson = CleanPayloadForLearner(q.QuestionType, q.PayloadJson)
            }).ToList()
        };
    }

    public async Task<QuizSubmissionResultDto> SubmitQuizAsync(Guid id, QuizSubmissionDto submission, string userId = "default-user", CancellationToken cancellationToken = default)
    {
        var quiz = await _dbContext.Quizzes
            .Include(q => q.Questions)
            .FirstOrDefaultAsync(q => q.Id == id, cancellationToken);

        if (quiz == null) throw new KeyNotFoundException($"Quiz {id} not found.");

        submission.QuizId = id;
        var gradeResult = _gradingEngine.GradeSubmission(quiz, submission);

        // Record attempt in database
        var attempt = new QuizAttempt
        {
            UserId = userId,
            QuizId = id,
            Score = gradeResult.Score,
            MaxScore = gradeResult.MaxScore,
            Percentage = gradeResult.Percentage,
            IsPassed = gradeResult.IsPassed,
            StartedAtUtc = DateTime.UtcNow.AddMinutes(-5),
            CompletedAtUtc = DateTime.UtcNow,
            AnswersJson = JsonSerializer.Serialize(submission.Answers)
        };

        _dbContext.QuizAttempts.Add(attempt);

        // If quiz is attached to a lesson and passed, auto-complete LessonProgress
        if (quiz.LessonId.HasValue && gradeResult.IsPassed)
        {
            var progress = await _dbContext.LessonProgresses
                .FirstOrDefaultAsync(lp => lp.LessonId == quiz.LessonId.Value && lp.UserId == userId, cancellationToken);

            if (progress == null)
            {
                progress = new LessonProgress
                {
                    UserId = userId,
                    LessonId = quiz.LessonId.Value,
                    IsQuizPassed = true,
                    IsCompleted = true,
                    CompletedAtUtc = DateTime.UtcNow,
                    LastAccessedAtUtc = DateTime.UtcNow
                };
                _dbContext.LessonProgresses.Add(progress);
            }
            else
            {
                progress.IsQuizPassed = true;
                progress.IsCompleted = true;
                progress.CompletedAtUtc = DateTime.UtcNow;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return gradeResult;
    }

    private static string CleanPayloadForLearner(Domain.Enums.QuestionType type, string payloadJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;

            var dict = new Dictionary<string, object>();

            if (root.TryGetProperty("options", out var opts)) dict["options"] = JsonSerializer.Deserialize<List<string>>(opts.GetRawText()) ?? new();
            if (root.TryGetProperty("tokens", out var tokens)) dict["tokens"] = JsonSerializer.Deserialize<List<string>>(tokens.GetRawText()) ?? new();
            if (root.TryGetProperty("pairs", out var pairs))
            {
                var leftItems = new List<string>();
                var rightItems = new List<string>();
                foreach (var el in pairs.EnumerateArray())
                {
                    leftItems.Add(el.GetProperty("left").GetString() ?? "");
                    rightItems.Add(el.GetProperty("right").GetString() ?? "");
                }
                dict["leftItems"] = leftItems;
                dict["rightItems"] = rightItems;
            }

            return JsonSerializer.Serialize(dict);
        }
        catch
        {
            return "{}";
        }
    }
}
