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
