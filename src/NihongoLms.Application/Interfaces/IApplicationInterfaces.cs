using NihongoLms.Application.DTOs;

namespace NihongoLms.Application.Interfaces;

public interface IAutoSuggestPatternEngine
{
    Task<AutoSuggestResultDto> AnalyzeFolderPatternAsync(AutoSuggestRequestDto request, CancellationToken cancellationToken = default);
}

public interface ICuratorService
{
    Task<List<CourseDto>> GetAllCoursesAsync(CancellationToken cancellationToken = default);
    Task<CourseDto?> GetCourseByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<CourseDto> CreateCourseAsync(CreateCourseDto dto, CancellationToken cancellationToken = default);
    Task<CourseDto> UpdateCourseAsync(Guid id, CreateCourseDto dto, CancellationToken cancellationToken = default);
    Task DeleteCourseAsync(Guid id, CancellationToken cancellationToken = default);

    Task<SectionDto> CreateSectionAsync(CreateSectionDto dto, CancellationToken cancellationToken = default);
    Task<SectionDto> UpdateSectionAsync(Guid id, CreateSectionDto dto, CancellationToken cancellationToken = default);
    Task DeleteSectionAsync(Guid id, CancellationToken cancellationToken = default);

    Task<LessonDto> CreateLessonAsync(CreateLessonDto dto, CancellationToken cancellationToken = default);
    Task<LessonDto> UpdateLessonAsync(Guid id, CreateLessonDto dto, CancellationToken cancellationToken = default);
    Task DeleteLessonAsync(Guid id, CancellationToken cancellationToken = default);

    Task<ResourceDto> AssignDriveNodeAsync(AssignDriveNodeRequestDto dto, CancellationToken cancellationToken = default);
    Task RemoveResourceAsync(Guid resourceId, CancellationToken cancellationToken = default);

    Task<int> ApplyAutoSuggestAsync(ApplyAutoSuggestRequestDto dto, CancellationToken cancellationToken = default);
    Task ReorderLessonsAsync(ReorderLessonsDto dto, CancellationToken cancellationToken = default);
    Task AssignQuizToLessonAsync(AssignQuizRequestDto dto, CancellationToken cancellationToken = default);
}

public interface IVocabularyService
{
    Task<List<VocabularyEntryDto>> GetVocabularyAsync(Guid? lessonId, string? jlptLevel, string? search, CancellationToken cancellationToken = default);
    Task<VocabularyEntryDto?> GetVocabularyByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<VocabularyEntryDto> CreateVocabularyAsync(CreateVocabularyEntryDto dto, CancellationToken cancellationToken = default);
    Task<VocabularyEntryDto> UpdateVocabularyAsync(Guid id, CreateVocabularyEntryDto dto, CancellationToken cancellationToken = default);
    Task DeleteVocabularyAsync(Guid id, CancellationToken cancellationToken = default);
}

public interface IQuizAdminService
{
    Task<List<QuizDto>> GetQuizzesAsync(Guid? lessonId, CancellationToken cancellationToken = default);
    Task<QuizDto?> GetQuizByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<QuizDto> CreateQuizAsync(CreateQuizDto dto, CancellationToken cancellationToken = default);
    Task<QuizDto> UpdateQuizAsync(Guid id, CreateQuizDto dto, CancellationToken cancellationToken = default);
    Task DeleteQuizAsync(Guid id, CancellationToken cancellationToken = default);

    Task<QuizQuestionDto> CreateQuestionAsync(CreateQuizQuestionDto dto, CancellationToken cancellationToken = default);
    Task<QuizQuestionDto> UpdateQuestionAsync(Guid id, CreateQuizQuestionDto dto, CancellationToken cancellationToken = default);
    Task DeleteQuestionAsync(Guid id, CancellationToken cancellationToken = default);
}

public interface ISrsSchedulingEngine
{
    SrsReviewResultDto ProcessReview(Domain.Entities.ReviewSchedule schedule, int qualityRating, DateTime nowUtc);
}

public interface IQuizGradingEngine
{
    QuizSubmissionResultDto GradeSubmission(Domain.Entities.Quiz quiz, QuizSubmissionDto submission);
}

public interface IProgressService
{
    Task<LessonProgressDto> GetLessonProgressAsync(Guid lessonId, string userId = "default-user", CancellationToken cancellationToken = default);
    Task<LessonProgressDto> SavePlaybackPositionAsync(Guid lessonId, double positionSeconds, double durationSeconds, string userId = "default-user", CancellationToken cancellationToken = default);
    Task<LessonProgressDto> ToggleLessonCompleteAsync(Guid lessonId, bool isManuallyCompleted = true, string userId = "default-user", CancellationToken cancellationToken = default);
}

public interface ISrsService
{
    Task<List<SrsDueItemDto>> GetDueVocabularyAsync(string? jlptLevel, string userId = "default-user", CancellationToken cancellationToken = default);
    Task<SrsStatsDto> GetStatsAsync(string userId = "default-user", CancellationToken cancellationToken = default);
    Task<SrsReviewResultDto> ReviewVocabularyAsync(Guid vocabularyEntryId, int qualityRating, string userId = "default-user", CancellationToken cancellationToken = default);
    Task<AddToSrsResultDto> AddToSrsDeckAsync(Guid vocabularyEntryId, string userId = "default-user", CancellationToken cancellationToken = default);
}

public interface IQuizLearnerService
{
    Task<LearnerQuizDto?> GetLearnerQuizAsync(Guid id, CancellationToken cancellationToken = default);
    Task<QuizSubmissionResultDto> SubmitQuizAsync(Guid id, QuizSubmissionDto submission, string userId = "default-user", CancellationToken cancellationToken = default);
}

public class LearnerQuizDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int PassPercentage { get; set; }
    public int? TimeLimitMinutes { get; set; }
    public List<LearnerQuestionDto> Questions { get; set; } = new();
}

public class LearnerQuestionDto
{
    public Guid Id { get; set; }
    public Domain.Enums.QuestionType QuestionType { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public double Points { get; set; }
    public int DisplayOrder { get; set; }
    public string? AudioDriveFileId { get; set; }
    public string? ImageDriveFileId { get; set; }
    public string PayloadJson { get; set; } = "{}";
}
