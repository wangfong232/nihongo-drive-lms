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
    Task ReorderSectionsAsync(ReorderSectionsDto dto, CancellationToken cancellationToken = default);
    Task ReorderResourcesAsync(ReorderResourcesDto dto, CancellationToken cancellationToken = default);
    Task AssignQuizToLessonAsync(AssignQuizRequestDto dto, CancellationToken cancellationToken = default);

    // AI Auto-Course Builder (Drive Folder -> Standard Course with 5 Pedagogical Lessons)
    Task<AutoBuildScanResultDto> ScanAndPreviewCourseFromDriveAsync(AutoBuildScanRequestDto dto, CancellationToken cancellationToken = default);
    Task<AutoBuildScanResultDto> ScanAndPreviewCourseFromPdfAsync(Stream pdfStream, string fileName, string? courseTitle, string? jlptLevel, CancellationToken cancellationToken = default);
    Task<CourseDto> ApplyAutoBuiltCourseAsync(AutoBuildApplyRequestDto dto, CancellationToken cancellationToken = default);
}

/// <summary>
/// Dịch vụ dựng Khóa học linh hoạt từ Cây thư mục Google Drive (Flexible Folder-to-Course Builder)
/// Hỗ trợ Heuristic Auto-Detection, AI Prompt Tree Analysis, RawPath Skill Matching, Cross-Folder Resource Ingestion & Natural Number Sorting.
/// </summary>
public interface IFolderCourseBuilderService
{
    Task<AutoDetectFolderResultDto> DetectFolderStructureAsync(Guid rootFolderId, CancellationToken ct = default);
    Task<FolderMappingConfigDto> AnalyzeFolderTreeWithAiAsync(Guid rootFolderId, string? customPrompt = null, CancellationToken ct = default);
    Task<AutoBuildScanResultDto> GeneratePreviewAsync(FolderMappingConfigDto config, CancellationToken ct = default);
    Task<CourseDto> MaterializeCourseAsync(AutoBuildApplyRequestDto request, CancellationToken ct = default);
}

/// <summary>
/// Pipeline bóc tách lộ trình từ PDF và lưu vào bảng RoadmapTemplates.
/// Bước 1-3: Parse PDF + gọi LLM + Fuzzy match DriveNodes → preview JSON.
/// Bước 4: Curator confirm → SaveRoadmapTemplateAsync lưu vào DB.
/// </summary>
public interface ISyllabusParserService
{
    /// <summary>
    /// Đọc stream PDF, gọi LLM bóc tách cấu trúc, chạy fuzzy match Drive files.
    /// Trả về ParsedSyllabusDto để frontend hiển thị preview — chưa lưu DB.
    /// </summary>
    Task<ParsedSyllabusDto> ParseFromPdfAsync(Stream pdfStream, string pdfFileName, CancellationToken ct = default);

    /// <summary>
    /// Curator đã xác nhận → lưu RoadmapTemplate + RoadmapItems + RoadmapItemDriveFiles vào DB.
    /// </summary>
    Task<RoadmapTemplateDto> SaveRoadmapTemplateAsync(SaveRoadmapTemplateRequestDto dto, CancellationToken ct = default);
}

/// <summary>
/// Quản lý RoadmapTemplate (Curator) và UserRoadmapEnrollment (Learner).
/// Tính lịch học cá nhân động dựa trên StartDate + PaceMode.
/// </summary>
public interface IRoadmapService
{
    // Curator CRUD
    Task<List<RoadmapTemplateDto>> GetTemplatesAsync(string? jlptLevel, CancellationToken ct = default);
    Task<RoadmapTemplateDto?> GetTemplateByIdAsync(Guid id, CancellationToken ct = default);
    Task<RoadmapTemplateDto> PublishTemplateAsync(Guid id, bool isPublished, CancellationToken ct = default);
    Task DeleteTemplateAsync(Guid id, CancellationToken ct = default);

    // Learner enrollment
    Task<UserRoadmapEnrollmentDto> EnrollAsync(EnrollRoadmapRequestDto dto, string userId, CancellationToken ct = default);
    Task<List<UserRoadmapEnrollmentDto>> GetMyEnrollmentsAsync(string userId, CancellationToken ct = default);

    // Lịch học cá nhân (computed)
    Task<List<UserScheduleDayDto>> GetMyScheduleAsync(Guid enrollmentId, string userId, CancellationToken ct = default);
    Task MarkDayCompleteAsync(Guid enrollmentId, int dayNumber, bool isCompleted, string userId, CancellationToken ct = default);
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
    Task<WeeklyPacingDto> GetWeeklyPacingAsync(string userId = "default-user", CancellationToken cancellationToken = default);
    Task<WeeklyPacingDto> SetWeeklyGoalAsync(int targetLessonsPerWeek, string userId = "default-user", CancellationToken cancellationToken = default);
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

public class AiSettingsDto
{
    public bool IsConfigured { get; set; }
    public string Source { get; set; } = "none"; // "database", "environment", "none"
    public string Provider { get; set; } = "gemini"; // "gemini", "openai", "custom"
    public string MaskedApiKey { get; set; } = string.Empty;
    public bool HasApiKey { get; set; }
    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta/openai/";
    public string SelectedModel { get; set; } = "gemini-3.1-flash-lite";
    public List<string> AvailableModels { get; set; } = new();
    public DateTime? LastUpdatedUtc { get; set; }
}

public class UpdateAiSettingsRequestDto
{
    public string? Provider { get; set; }
    public string? ApiKey { get; set; } // Optional: nếu trống/null thì giữ nguyên key đã lưu
    public string? BaseUrl { get; set; }
    public string? SelectedModel { get; set; }
}

public class TestAiConnectionRequestDto
{
    public string? Provider { get; set; }
    public string? ApiKey { get; set; }
    public string? BaseUrl { get; set; }
    public string? Model { get; set; }
}

public class TestAiConnectionResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? ModelUsed { get; set; }
    public long LatencyMs { get; set; }
    public string? Error { get; set; }
}

public class DriveSettingsDto
{
    public bool IsConfigured { get; set; }
    public string Source { get; set; } = "none"; // "database", "environment", "oauth_token", "none"
    public string? ClientId { get; set; }
    public string? MaskedClientSecret { get; set; }
    public bool HasClientSecret { get; set; }
    public string? MaskedRefreshToken { get; set; }
    public bool HasRefreshToken { get; set; }
    public string? RootFolderId { get; set; }
    public DateTime? LastUpdatedUtc { get; set; }
}

public class UpdateDriveSettingsRequestDto
{
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; } // Optional
    public string? RefreshToken { get; set; }  // Optional
    public string? RootFolderId { get; set; }
}

public class VerifyDriveConnectionResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? RootFolderName { get; set; }
    public int? TopLevelItemsCount { get; set; }
    public long LatencyMs { get; set; }
    public string? Error { get; set; }
}

public interface ISystemSettingsService
{
    Task<string?> GetSettingAsync(string key, CancellationToken ct = default);
    Task SaveSettingAsync(string key, string plainValue, string? description = null, CancellationToken ct = default);
    Task DeleteSettingAsync(string key, CancellationToken ct = default);

    // AI Provider Management
    Task<AiSettingsDto> GetAiSettingsAsync(CancellationToken ct = default);
    Task<AiSettingsDto> UpdateAiSettingsAsync(UpdateAiSettingsRequestDto request, CancellationToken ct = default);
    Task<AiSettingsDto> DeleteAiSettingsAsync(CancellationToken ct = default);
    Task<TestAiConnectionResultDto> TestAiConnectionAsync(TestAiConnectionRequestDto? request = null, CancellationToken ct = default);
    Task<(string ApiKey, string BaseUrl, string Model)> GetEffectiveAiConfigAsync(CancellationToken ct = default);

    // Google Drive Sync Credentials Management
    Task<DriveSettingsDto> GetDriveSettingsAsync(CancellationToken ct = default);
    Task<DriveSettingsDto> UpdateDriveSettingsAsync(UpdateDriveSettingsRequestDto request, CancellationToken ct = default);
    Task<VerifyDriveConnectionResultDto> VerifyDriveConnectionAsync(UpdateDriveSettingsRequestDto? request = null, CancellationToken ct = default);
    Task<(string ClientId, string ClientSecret, string RefreshToken, string RootFolderId)> GetEffectiveDriveCredentialsAsync(CancellationToken ct = default);
}
