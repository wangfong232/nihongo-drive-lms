using NihongoLms.Domain.Enums;

namespace NihongoLms.Application.DTOs;

// ─────────────────────────────────────────────────────────────
//  BƯỚC 1-3: AI PARSE OUTPUT — Preview trước khi Curator confirm
// ─────────────────────────────────────────────────────────────

/// <summary>
/// Kết quả bóc tách từ PDF + fuzzy Drive match.
/// Trả về cho frontend để Curator xem trước và chỉnh sửa.
/// </summary>
public class ParsedSyllabusDto
{
    public string CourseTitle { get; set; } = string.Empty;
    public string JlptLevel { get; set; } = "N5";
    public string Description { get; set; } = string.Empty;
    public List<ParsedSectionDto> Sections { get; set; } = new();
}

public class ParsedSectionDto
{
    public int DisplayOrder { get; set; }
    public string Title { get; set; } = string.Empty;
    public List<ParsedLessonDto> Lessons { get; set; } = new();
}

public class ParsedLessonDto
{
    public int DisplayOrder { get; set; }

    /// <summary>Số ngày trong lộ trình (thường = DisplayOrder toàn cục).</summary>
    public int DayNumber { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int EstimatedDurationMinutes { get; set; }

    /// <summary>Danh sách kỹ năng: Grammar, Kanji, Vocabulary, Choukai, Quiz, Kaiwa, Dokkai</summary>
    public List<string> Skills { get; set; } = new();

    /// <summary>Keywords AI sinh ra để fuzzy match file Drive.</summary>
    public List<string> SearchKeywords { get; set; } = new();

    /// <summary>Top 3 file Drive được gợi ý bởi fuzzy matching, rank theo MatchScore giảm dần.</summary>
    public List<SuggestedDriveFileDto> SuggestedDriveFiles { get; set; } = new();
}

/// <summary>
/// Một file Drive được AI gợi ý cho một bài học, kèm điểm tương đồng.
/// </summary>
public class SuggestedDriveFileDto
{
    public Guid DriveNodeId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string? RawPath { get; set; }
    public string? WebViewLink { get; set; }

    /// <summary>Điểm tương đồng fuzzy match, 0–100.</summary>
    public int MatchScore { get; set; }

    /// <summary>Keyword nào đã match tốt nhất.</summary>
    public string MatchedKeyword { get; set; } = string.Empty;

    public ResourceType ResourceType { get; set; } = ResourceType.PrimaryVideo;
}

// ─────────────────────────────────────────────────────────────
//  BƯỚC 4: CURATOR CONFIRM — Payload gửi lên để lưu DB
// ─────────────────────────────────────────────────────────────

/// <summary>
/// Payload từ frontend sau khi Curator đã xem trước, chỉnh sửa và chọn file Drive.
/// POST /api/roadmap/save-template
/// </summary>
public class SaveRoadmapTemplateRequestDto
{
    public string Title { get; set; } = string.Empty;
    public string JlptLevel { get; set; } = "N5";
    public string? Description { get; set; }
    public string? SourcePdfName { get; set; }
    public List<ConfirmedSectionDto> Sections { get; set; } = new();
}

public class ConfirmedSectionDto
{
    public int DisplayOrder { get; set; }
    public string Title { get; set; } = string.Empty;
    public List<ConfirmedLessonDto> Lessons { get; set; } = new();
}

public class ConfirmedLessonDto
{
    public int DayNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int EstimatedDurationMinutes { get; set; }
    public List<string> Skills { get; set; } = new();
    public List<string> SearchKeywords { get; set; } = new();

    /// <summary>
    /// Nullable — nếu Curator liên kết bài học này với một Lesson video hiện có.
    /// </summary>
    public Guid? LinkedLessonId { get; set; }

    /// <summary>
    /// Danh sách DriveNodeId Curator đã chọn giữ (tối đa 3).
    /// Chỉ các file trong danh sách này mới được lưu vào RoadmapItemDriveFiles.
    /// </summary>
    public List<ConfirmedDriveFileDto> ConfirmedDriveFiles { get; set; } = new();
}

public class ConfirmedDriveFileDto
{
    public Guid DriveNodeId { get; set; }
    public int MatchScore { get; set; }
    public ResourceType ResourceType { get; set; } = ResourceType.PrimaryVideo;
    public int DisplayOrder { get; set; }
}

// ─────────────────────────────────────────────────────────────
//  ROADMAP TEMPLATE DTOs — Read models trả về client
// ─────────────────────────────────────────────────────────────

public class RoadmapTemplateDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string JlptLevel { get; set; } = "N5";
    public string? Description { get; set; }
    public int TotalDays { get; set; }
    public int? TotalEstimatedMinutes { get; set; }
    public string? SourcePdfName { get; set; }
    public bool IsPublished { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public List<RoadmapItemDto> Items { get; set; } = new();
}

public class RoadmapItemDto
{
    public Guid Id { get; set; }
    public int DayNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int EstimatedDurationMinutes { get; set; }
    public List<string> Skills { get; set; } = new();
    public List<string> SearchKeywords { get; set; } = new();
    public Guid? LinkedLessonId { get; set; }

    /// <summary>Tiêu đề Lesson được link (nếu có), để hiển thị nút điều hướng.</summary>
    public string? LinkedLessonTitle { get; set; }

    public List<RoadmapItemDriveFileDto> DriveFiles { get; set; } = new();
}

public class RoadmapItemDriveFileDto
{
    public Guid Id { get; set; }
    public Guid DriveNodeId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string? WebViewLink { get; set; }
    public int MatchScore { get; set; }
    public ResourceType ResourceType { get; set; }
    public int DisplayOrder { get; set; }
}

// ─────────────────────────────────────────────────────────────
//  ENROLLMENT DTOs — Học viên đăng ký lộ trình
// ─────────────────────────────────────────────────────────────

/// <summary>POST /api/roadmap/enroll</summary>
public class EnrollRoadmapRequestDto
{
    public Guid RoadmapTemplateId { get; set; }

    /// <summary>Ngày bắt đầu học, định dạng "yyyy-MM-dd".</summary>
    public DateOnly StartDate { get; set; }

    public PaceMode PaceMode { get; set; } = PaceMode.Normal;
}

public class UserRoadmapEnrollmentDto
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public Guid RoadmapTemplateId { get; set; }
    public string TemplateTitle { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public PaceMode PaceMode { get; set; }

    /// <summary>Ngày kết thúc dự kiến (tính theo PaceMode).</summary>
    public DateOnly EstimatedEndDate { get; set; }

    public bool IsActive { get; set; }
    public int CompletedDays { get; set; }
    public int TotalDays { get; set; }
    public DateTime EnrolledAtUtc { get; set; }
}

// ─────────────────────────────────────────────────────────────
//  SCHEDULE DTOs — Lịch học cá nhân (tính động, không lưu DB)
// ─────────────────────────────────────────────────────────────

/// <summary>
/// Một ngày học trong lịch cá nhân của học viên.
/// Date được tính động từ StartDate + PaceMode, không lưu cứng vào DB.
/// </summary>
public class UserScheduleDayDto
{
    /// <summary>Ngày calendar thực tế (theo PaceMode của học viên).</summary>
    public DateOnly Date { get; set; }

    /// <summary>Số thứ tự ngày trong lộ trình (1..N), map vào RoadmapItem.DayNumber.</summary>
    public int DayNumber { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int EstimatedDurationMinutes { get; set; }
    public List<string> Skills { get; set; } = new();

    public bool IsCompleted { get; set; }
    public DateTime? CompletedAtUtc { get; set; }

    /// <summary>Nếu có LinkedLessonId → hiển thị nút "Xem bài học" thay vì danh sách Drive files.</summary>
    public Guid? LinkedLessonId { get; set; }
    public string? LinkedLessonTitle { get; set; }

    public List<RoadmapItemDriveFileDto> DriveFiles { get; set; } = new();

    /// <summary>true nếu ngày này là hôm nay.</summary>
    public bool IsToday { get; set; }

    /// <summary>true nếu ngày này đã qua mà chưa học xong.</summary>
    public bool IsOverdue { get; set; }
}
