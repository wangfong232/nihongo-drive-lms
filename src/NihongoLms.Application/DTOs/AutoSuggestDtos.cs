using NihongoLms.Domain.Enums;

namespace NihongoLms.Application.DTOs;

public class AutoSuggestRequestDto
{
    public Guid ParentFolderDriveNodeId { get; set; }
    public string PatternRegex { get; set; } = @"(?i)Bài\s*(\d+)";
    public Guid TargetSectionId { get; set; }
}

public class AutoSuggestResultDto
{
    public Guid TargetSectionId { get; set; }
    public int MatchesFound { get; set; }
    public List<SuggestedLessonDto> SuggestedLessons { get; set; } = new();
}

public class SuggestedLessonDto
{
    public string LessonTitle { get; set; } = string.Empty;
    public int LessonNumber { get; set; }
    public Guid FolderDriveNodeId { get; set; }
    public string FolderName { get; set; } = string.Empty;
    public List<SuggestedResourceDto> Resources { get; set; } = new();
}

public class SuggestedResourceDto
{
    public string ResourceTitle { get; set; } = string.Empty;
    public Guid DriveNodeId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public ResourceType ResourceType { get; set; }
}

public class ApplyAutoSuggestRequestDto
{
    public Guid TargetSectionId { get; set; }
    public List<SuggestedLessonDto> SelectedLessons { get; set; } = new();
}
