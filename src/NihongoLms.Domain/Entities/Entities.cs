using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using NihongoLms.Domain.Enums;

namespace NihongoLms.Domain.Entities;

public class UserOAuthToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = "default-user";
    public string EncryptedAccessToken { get; set; } = string.Empty;
    public string EncryptedRefreshToken { get; set; } = string.Empty;
    public string TokenType { get; set; } = "Bearer";
    public DateTime ExpiresAtUtc { get; set; }
    public string Scope { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class DriveNode
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string DriveFileId { get; set; } = string.Empty;
    public string? ParentDriveFileId { get; set; }
    public Guid? ParentNodeId { get; set; }

    // [JsonIgnore] ngăn đệ quy cây thư mục vô tận
    [JsonIgnore]
    public DriveNode? ParentNode { get; set; }

    [JsonIgnore]
    public ICollection<DriveNode> ChildNodes { get; set; } = new List<DriveNode>();

    public string Name { get; set; } = string.Empty;
    public NodeType NodeType { get; set; }
    public string MimeType { get; set; } = string.Empty;
    public string? FileExtension { get; set; }
    public long? Size { get; set; }
    public string? WebViewLink { get; set; }
    public string? ThumbnailLink { get; set; }
    public string RawPath { get; set; } = string.Empty;

    public DateTimeOffset? DriveCreatedTime { get; set; }
    public DateTimeOffset? DriveModifiedTime { get; set; }
    public DateTime LastSyncedAtUtc { get; set; } = DateTime.UtcNow;
    public bool IsDeletedInDrive { get; set; } = false;

    [JsonIgnore]
    public ICollection<Resource> LinkedResources { get; set; } = new List<Resource>();
}

public class Course
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string JlptLevel { get; set; } = "N5";
    public int DisplayOrder { get; set; } = 0;
    public bool IsPublished { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<Section> Sections { get; set; } = new List<Section>();
}

public class Section
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CourseId { get; set; }

    [JsonIgnore]
    public Course? Course { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; } = 0;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<Lesson> Lessons { get; set; } = new List<Lesson>();
}

public class Lesson
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SectionId { get; set; }

    [JsonIgnore]
    public Section? Section { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; } = 0;
    public int? EstimatedDurationMinutes { get; set; }
    public bool IsPublished { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<Resource> Resources { get; set; } = new List<Resource>();
    public ICollection<VocabularyEntry> VocabularyEntries { get; set; } = new List<VocabularyEntry>();
    public ICollection<Quiz> Quizzes { get; set; } = new List<Quiz>();
    
    [JsonIgnore]
    public ICollection<LessonProgress> ProgressRecords { get; set; } = new List<LessonProgress>();
}

public class Resource
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LessonId { get; set; }

    [JsonIgnore]
    public Lesson? Lesson { get; set; }

    public string Title { get; set; } = string.Empty;
    public ResourceType ResourceType { get; set; }

    public Guid? DriveNodeId { get; set; }
    public DriveNode? DriveNode { get; set; }

    public string? CustomUrl { get; set; }
    public int DisplayOrder { get; set; } = 0;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class VocabularyEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? LessonId { get; set; }

    [JsonIgnore]
    public Lesson? Lesson { get; set; }

    public string Word { get; set; } = string.Empty;
    public string Reading { get; set; } = string.Empty;
    public string Meaning { get; set; } = string.Empty;
    public string? ExampleSentence { get; set; }
    public string? ExampleSentenceTranslation { get; set; }
    public string PartOfSpeech { get; set; } = "Noun";
    public string JlptLevel { get; set; } = "N5";

    public Guid? AudioDriveNodeId { get; set; }
    public DriveNode? AudioDriveNode { get; set; }

    public Guid? StrokeOrderDriveNodeId { get; set; }
    public DriveNode? StrokeOrderDriveNode { get; set; }

    public string? TagsJson { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    [JsonIgnore]
    public ICollection<ReviewSchedule> ReviewSchedules { get; set; } = new List<ReviewSchedule>();
}

public class ReviewSchedule
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = "default-user";

    public Guid VocabularyEntryId { get; set; }
    public VocabularyEntry? VocabularyEntry { get; set; }

    public int RepetitionCount { get; set; } = 0;
    public double IntervalDays { get; set; } = 0;
    public double EaseFactor { get; set; } = 2.5;
    public DateTime NextReviewDateUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastReviewedAtUtc { get; set; }
    public int? LastQuality { get; set; }
    public SrsState State { get; set; } = SrsState.New;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class SrsReviewLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = "default-user";

    public Guid VocabularyEntryId { get; set; }
    public int QualityRating { get; set; }
    public double IntervalBeforeDays { get; set; }
    public double IntervalAfterDays { get; set; }
    public double EaseFactorBefore { get; set; }
    public double EaseFactorAfter { get; set; }
    public int? ResponseTimeMs { get; set; }
    public DateTime ReviewedAtUtc { get; set; } = DateTime.UtcNow;
}

public class Quiz
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? LessonId { get; set; }

    [JsonIgnore]
    public Lesson? Lesson { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public QuizType QuizType { get; set; } = QuizType.LessonQuiz;
    public int PassPercentage { get; set; } = 70;
    public int? TimeLimitMinutes { get; set; }
    public bool ShuffleQuestions { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<QuizQuestion> Questions { get; set; } = new List<QuizQuestion>();

    [JsonIgnore]
    public ICollection<QuizAttempt> Attempts { get; set; } = new List<QuizAttempt>();
}

public class QuizQuestion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid QuizId { get; set; }

    [JsonIgnore]
    public Quiz? Quiz { get; set; }

    public QuestionType QuestionType { get; set; }
    public string Prompt { get; set; } = string.Empty;

    public Guid? AudioDriveNodeId { get; set; }
    public DriveNode? AudioDriveNode { get; set; }

    public Guid? ImageDriveNodeId { get; set; }
    public DriveNode? ImageDriveNode { get; set; }

    public int Points { get; set; } = 1;
    public int DisplayOrder { get; set; } = 0;
    public string PayloadJson { get; set; } = "{}";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class QuizAttempt
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = "default-user";

    public Guid QuizId { get; set; }

    [JsonIgnore]
    public Quiz? Quiz { get; set; }

    public double Score { get; set; }
    public double MaxScore { get; set; }
    public double Percentage { get; set; }
    public bool IsPassed { get; set; }
    public DateTime StartedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAtUtc { get; set; }
    public string AnswersJson { get; set; } = "{}";
}

public class LessonProgress
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = "default-user";

    public Guid LessonId { get; set; }

    [JsonIgnore]
    public Lesson? Lesson { get; set; }

    public bool IsManuallyCompleted { get; set; } = false;
    public bool IsQuizPassed { get; set; } = false;
    public bool IsCompleted { get; set; } = false;
    public double LastPlaybackPositionSeconds { get; set; } = 0;
    public double TotalDurationSeconds { get; set; } = 0;
    public DateTime? CompletedAtUtc { get; set; }
    public DateTime LastAccessedAtUtc { get; set; } = DateTime.UtcNow;
}

// ─────────────────────────────────────────────────
//  ROADMAP TEMPLATE SYSTEM
// ─────────────────────────────────────────────────

/// <summary>
/// Blueprint lộ trình học (vd: N4 180 ngày, N5 150 ngày).
/// Được Curator tạo ra bằng cách upload PDF và dùng AI bóc tách.
/// Không thay thế Course/Section/Lesson — đây là kế hoạch học tập theo ngày.
/// </summary>
public class RoadmapTemplate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string JlptLevel { get; set; } = "N5";
    public string? Description { get; set; }

    /// <summary>Tổng số ngày học trong lộ trình (ví dụ: 150, 180).</summary>
    public int TotalDays { get; set; }

    /// <summary>Tổng thời lượng ước tính toàn lộ trình (phút).</summary>
    public int? TotalEstimatedMinutes { get; set; }

    /// <summary>Tên file PDF gốc đã upload để parse.</summary>
    public string? SourcePdfName { get; set; }

    public string CreatedByUserId { get; set; } = "default-user";
    public bool IsPublished { get; set; } = false;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<RoadmapItem> Items { get; set; } = new List<RoadmapItem>();
}

/// <summary>
/// Một "ngày học" trong blueprint RoadmapTemplate.
/// DayNumber là số thứ tự ngày (1, 2, ... N).
/// </summary>
public class RoadmapItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RoadmapTemplateId { get; set; }

    [JsonIgnore]
    public RoadmapTemplate? RoadmapTemplate { get; set; }

    /// <summary>Số ngày trong lộ trình, bắt đầu từ 1.</summary>
    public int DayNumber { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int EstimatedDurationMinutes { get; set; } = 45;

    /// <summary>JSON array của kỹ năng: ["Kanji","Grammar","Vocabulary","Choukai","Quiz"]</summary>
    public string SkillsJson { get; set; } = "[]";

    /// <summary>JSON array các từ khóa để match file Drive: ["Bai 26","B26","Kanji 26"]</summary>
    public string SearchKeywordsJson { get; set; } = "[]";

    /// <summary>
    /// FK tuỳ chọn trỏ đến Lesson trong Course/Section/Lesson.
    /// Nếu có → hiển thị nút chuyển hướng sang Lesson video.
    /// Nếu null → hiển thị danh sách file Drive từ DriveFiles.
    /// </summary>
    public Guid? LinkedLessonId { get; set; }

    [JsonIgnore]
    public Lesson? LinkedLesson { get; set; }

    public ICollection<RoadmapItemDriveFile> DriveFiles { get; set; } = new List<RoadmapItemDriveFile>();
}

/// <summary>
/// File Drive được AI gợi ý (fuzzy match) và Curator xác nhận cho một RoadmapItem.
/// Lưu tối đa 3 file per item, ranked theo MatchScore.
/// </summary>
public class RoadmapItemDriveFile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RoadmapItemId { get; set; }

    [JsonIgnore]
    public RoadmapItem? RoadmapItem { get; set; }

    public Guid DriveNodeId { get; set; }
    public DriveNode? DriveNode { get; set; }

    /// <summary>Điểm tương đồng fuzzy match, 0–100.</summary>
    public int MatchScore { get; set; }

    public ResourceType ResourceType { get; set; } = ResourceType.PrimaryVideo;
    public int DisplayOrder { get; set; } = 0;
}

/// <summary>
/// Học viên đăng ký một RoadmapTemplate và tùy chỉnh nhịp học.
/// Mỗi học viên chỉ có thể enroll một template một lần (unique UserId + RoadmapTemplateId).
/// </summary>
public class UserRoadmapEnrollment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = "default-user";

    public Guid RoadmapTemplateId { get; set; }
    public RoadmapTemplate? RoadmapTemplate { get; set; }

    /// <summary>Ngày bắt đầu học thực tế của học viên.</summary>
    public DateOnly StartDate { get; set; }

    /// <summary>Nhịp độ học: Normal (1/ngày), Intensive (2/ngày), Relaxed (1/2 ngày).</summary>
    public PaceMode PaceMode { get; set; } = PaceMode.Normal;

    public bool IsActive { get; set; } = true;
    public DateTime EnrolledAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<UserRoadmapDayProgress> DayProgresses { get; set; } = new List<UserRoadmapDayProgress>();
}

/// <summary>
/// Ghi nhận tiến độ học của học viên theo từng DayNumber.
/// DayNumber tương ứng với RoadmapItem.DayNumber trong template.
/// </summary>
public class UserRoadmapDayProgress
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EnrollmentId { get; set; }

    [JsonIgnore]
    public UserRoadmapEnrollment? Enrollment { get; set; }

    /// <summary>Số ngày (1..N) tương ứng với RoadmapItem.DayNumber.</summary>
    public int DayNumber { get; set; }

    public bool IsCompleted { get; set; } = false;
    public DateTime? CompletedAtUtc { get; set; }

    /// <summary>Ghi chú tuỳ ý của học viên cho ngày này.</summary>
    public string? Notes { get; set; }
}

/// <summary>
/// Cấu hình hệ thống (API keys, System Preferences) được lưu trữ và mã hóa trong Database cục bộ.
/// </summary>
public class SystemSetting
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Key { get; set; } = string.Empty;
    public string EncryptedValue { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}