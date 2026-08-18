using Microsoft.EntityFrameworkCore;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Infrastructure.Services;

public class QuizAdminService : IQuizAdminService
{
    private readonly LmsDbContext _dbContext;

    public QuizAdminService(LmsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<QuizDto>> GetQuizzesAsync(Guid? lessonId, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Quizzes
            .AsNoTracking()
            .Include(q => q.Lesson)
            .Include(q => q.Questions.OrderBy(qq => qq.DisplayOrder))
                .ThenInclude(qq => qq.AudioDriveNode)
            .Include(q => q.Questions.OrderBy(qq => qq.DisplayOrder))
                .ThenInclude(qq => qq.ImageDriveNode)
            .AsQueryable();

        if (lessonId.HasValue)
        {
            query = query.Where(q => q.LessonId == lessonId.Value);
        }

        var quizzes = await query.OrderByDescending(q => q.CreatedAtUtc).ToListAsync(cancellationToken);
        return quizzes.Select(MapToQuizDto).ToList();
    }

    public async Task<QuizDto?> GetQuizByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var quiz = await _dbContext.Quizzes
            .AsNoTracking()
            .Include(q => q.Lesson)
            .Include(q => q.Questions.OrderBy(qq => qq.DisplayOrder))
                .ThenInclude(qq => qq.AudioDriveNode)
            .Include(q => q.Questions.OrderBy(qq => qq.DisplayOrder))
                .ThenInclude(qq => qq.ImageDriveNode)
            .FirstOrDefaultAsync(q => q.Id == id, cancellationToken);

        return quiz != null ? MapToQuizDto(quiz) : null;
    }

    public async Task<QuizDto> CreateQuizAsync(CreateQuizDto dto, CancellationToken cancellationToken = default)
    {
        var quiz = new Quiz
        {
            LessonId = dto.LessonId,
            Title = dto.Title,
            Description = dto.Description,
            QuizType = dto.QuizType,
            PassPercentage = dto.PassPercentage,
            TimeLimitMinutes = dto.TimeLimitMinutes,
            ShuffleQuestions = dto.ShuffleQuestions,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Quizzes.Add(quiz);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToQuizDto(quiz);
    }

    public async Task<QuizDto> UpdateQuizAsync(Guid id, CreateQuizDto dto, CancellationToken cancellationToken = default)
    {
        var quiz = await _dbContext.Quizzes.FirstOrDefaultAsync(q => q.Id == id, cancellationToken);
        if (quiz == null) throw new KeyNotFoundException($"Quiz {id} not found.");

        quiz.LessonId = dto.LessonId;
        quiz.Title = dto.Title;
        quiz.Description = dto.Description;
        quiz.QuizType = dto.QuizType;
        quiz.PassPercentage = dto.PassPercentage;
        quiz.TimeLimitMinutes = dto.TimeLimitMinutes;
        quiz.ShuffleQuestions = dto.ShuffleQuestions;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return MapToQuizDto(quiz);
    }

    public async Task DeleteQuizAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var quiz = await _dbContext.Quizzes.FirstOrDefaultAsync(q => q.Id == id, cancellationToken);
        if (quiz != null)
        {
            _dbContext.Quizzes.Remove(quiz);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<QuizQuestionDto> CreateQuestionAsync(CreateQuizQuestionDto dto, CancellationToken cancellationToken = default)
    {
        var question = new QuizQuestion
        {
            QuizId = dto.QuizId,
            QuestionType = dto.QuestionType,
            Prompt = dto.Prompt,
            AudioDriveNodeId = dto.AudioDriveNodeId,
            ImageDriveNodeId = dto.ImageDriveNodeId,
            Points = dto.Points,
            DisplayOrder = dto.DisplayOrder,
            PayloadJson = string.IsNullOrWhiteSpace(dto.PayloadJson) ? "{}" : dto.PayloadJson,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.QuizQuestions.Add(question);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToQuestionDto(question);
    }

    public async Task<QuizQuestionDto> UpdateQuestionAsync(Guid id, CreateQuizQuestionDto dto, CancellationToken cancellationToken = default)
    {
        var question = await _dbContext.QuizQuestions.FirstOrDefaultAsync(qq => qq.Id == id, cancellationToken);
        if (question == null) throw new KeyNotFoundException($"QuizQuestion {id} not found.");

        question.QuestionType = dto.QuestionType;
        question.Prompt = dto.Prompt;
        question.AudioDriveNodeId = dto.AudioDriveNodeId;
        question.ImageDriveNodeId = dto.ImageDriveNodeId;
        question.Points = dto.Points;
        question.DisplayOrder = dto.DisplayOrder;
        question.PayloadJson = dto.PayloadJson;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return MapToQuestionDto(question);
    }

    public async Task DeleteQuestionAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var question = await _dbContext.QuizQuestions.FirstOrDefaultAsync(qq => qq.Id == id, cancellationToken);
        if (question != null)
        {
            _dbContext.QuizQuestions.Remove(question);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private static QuizDto MapToQuizDto(Quiz q)
    {
        return new QuizDto
        {
            Id = q.Id,
            LessonId = q.LessonId,
            LessonTitle = q.Lesson?.Title,
            Title = q.Title,
            Description = q.Description,
            QuizType = q.QuizType,
            PassPercentage = q.PassPercentage,
            TimeLimitMinutes = q.TimeLimitMinutes,
            ShuffleQuestions = q.ShuffleQuestions,
            Questions = q.Questions.Select(MapToQuestionDto).ToList()
        };
    }

    private static QuizQuestionDto MapToQuestionDto(QuizQuestion qq)
    {
        return new QuizQuestionDto
        {
            Id = qq.Id,
            QuizId = qq.QuizId,
            QuestionType = qq.QuestionType,
            Prompt = qq.Prompt,
            AudioDriveNodeId = qq.AudioDriveNodeId,
            AudioDriveFileId = qq.AudioDriveNode?.DriveFileId,
            ImageDriveNodeId = qq.ImageDriveNodeId,
            ImageDriveFileId = qq.ImageDriveNode?.DriveFileId,
            Points = qq.Points,
            DisplayOrder = qq.DisplayOrder,
            PayloadJson = qq.PayloadJson
        };
    }
}
