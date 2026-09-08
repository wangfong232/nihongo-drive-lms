using NihongoLms.Domain.Enums;

namespace NihongoLms.Application.DTOs;

public class CourseDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string JlptLevel { get; set; } = "N5";
    public int DisplayOrder { get; set; }
    public bool IsPublished { get; set; }
    public List<SectionDto> Sections { get; set; } = new();
}

public class SectionDto
{
    public Guid Id { get; set; }
    public Guid CourseId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public List<LessonDto> Lessons { get; set; } = new();
}

public class LessonDto
{
    public Guid Id { get; set; }
    public Guid SectionId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public bool IsPublished { get; set; }
    public List<ResourceDto> Resources { get; set; } = new();
    public List<QuizSummaryDto> Quizzes { get; set; } = new();
}

public class QuizSummaryDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public int QuizType { get; set; }
    public int PassPercentage { get; set; } = 60;
    public int QuestionCount { get; set; }
}

public class ReorderLessonsDto
{
    public Guid SectionId { get; set; }
    public List<Guid> LessonIds { get; set; } = new();
}

public class ReorderSectionsDto
{
    public Guid CourseId { get; set; }
    public List<Guid> SectionIds { get; set; } = new();
}

public class ReorderResourcesDto
{
    public Guid LessonId { get; set; }
    public List<Guid> ResourceIds { get; set; } = new();
}

public class MoveResourceDto
{
    public Guid ResourceId { get; set; }
    public Guid TargetLessonId { get; set; }
    public int? TargetIndex { get; set; }
}

public class MoveLessonDto
{
    public Guid LessonId { get; set; }
    public Guid TargetSectionId { get; set; }
    public int? TargetIndex { get; set; }
}

public class AssignQuizRequestDto
{
    public Guid QuizId { get; set; }
    public Guid? LessonId { get; set; }
}

public class ResourceDto
{
    public Guid Id { get; set; }
    public Guid LessonId { get; set; }
    public string Title { get; set; } = string.Empty;
    public ResourceType ResourceType { get; set; }
    public Guid? DriveNodeId { get; set; }
    public string? DriveFileId { get; set; }
    public string? WebViewLink { get; set; }
    public string? CustomUrl { get; set; }
    public int DisplayOrder { get; set; }
}

public class CreateCourseDto
{
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string JlptLevel { get; set; } = "N5";
    public int DisplayOrder { get; set; } = 0;
}

public class CreateSectionDto
{
    public Guid CourseId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; } = 0;
}

public class CreateLessonDto
{
    public Guid SectionId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; } = 0;
}

public class AssignDriveNodeRequestDto
{
    public Guid LessonId { get; set; }
    public Guid DriveNodeId { get; set; }
    public string Title { get; set; } = string.Empty;
    public ResourceType ResourceType { get; set; }
}

public class BatchAssignDriveNodeItemDto
{
    public Guid DriveNodeId { get; set; }
    public string Title { get; set; } = string.Empty;
    public ResourceType ResourceType { get; set; }
}

public class BatchAssignDriveNodesRequestDto
{
    public Guid LessonId { get; set; }
    public List<BatchAssignDriveNodeItemDto> Items { get; set; } = new();
}

public class BatchAssignDriveNodesResultDto
{
    public int Count { get; set; }
    public List<ResourceDto> Resources { get; set; } = new();
}

// ═══════════════════════════════════════════════════════════
//  AI Auto-Course Builder DTOs (Drive Folder to Standard Course)
// ═══════════════════════════════════════════════════════════

public class AutoBuildScanRequestDto
{
    public string CourseTitle { get; set; } = string.Empty;
    public string JlptLevel { get; set; } = "N4";
    public Guid? RootFolderNodeId { get; set; }
}

public class AutoBuildScanResultDto
{
    public string CourseTitle { get; set; } = string.Empty;
    public string JlptLevel { get; set; } = "N4";
    public int TotalSections { get; set; }
    public int TotalLessons { get; set; }
    public int TotalFilesMatched { get; set; }
    public List<AutoBuildSectionPreviewDto> Sections { get; set; } = new();
}

public class AutoBuildSectionPreviewDto
{
    public string Title { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public int LessonNumber { get; set; }
    public List<AutoBuildLessonPreviewDto> Lessons { get; set; } = new();
}

public class AutoBuildLessonPreviewDto
{
    public string Title { get; set; } = string.Empty;
    public int FlowOrder { get; set; } // 1: Từ vựng, 2: Chữ Hán, 3: Ngữ pháp, 4: Hội thoại/Nghe, 5: Test
    public string Skill { get; set; } = string.Empty;
    public int EstimatedDurationMinutes { get; set; } = 45;
    public List<AutoBuildResourcePreviewDto> Resources { get; set; } = new();
}

public class AutoBuildResourcePreviewDto
{
    public Guid DriveNodeId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? RawPath { get; set; }
    public string? WebViewLink { get; set; }
    public ResourceType ResourceType { get; set; }
    public int MatchScore { get; set; }
    public string SourceTier { get; set; } = "LessonFolder"; // LessonFolder, CrossFolder, SharedGeneral
}

public class AutoBuildApplyRequestDto
{
    public string CourseTitle { get; set; } = string.Empty;
    public string JlptLevel { get; set; } = "N4";
    public string? Description { get; set; }
    public List<AutoBuildSectionPreviewDto> Sections { get; set; } = new();
}

