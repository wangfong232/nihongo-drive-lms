namespace NihongoLms.Application.DTOs;

public class LessonProgressDto
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "default-user";
    public Guid LessonId { get; set; }
    public bool IsCompleted { get; set; }
    public bool IsQuizPassed { get; set; }
    public bool IsManuallyCompleted { get; set; }
    public double LastPlaybackPositionSeconds { get; set; }
    public double TotalDurationSeconds { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public DateTime LastAccessedAtUtc { get; set; }
}

public class PlaybackProgressDto
{
    public Guid LessonId { get; set; }
    public double PositionSeconds { get; set; }
    public double DurationSeconds { get; set; }
}

public class MarkCompleteDto
{
    public bool IsManuallyCompleted { get; set; } = true;
}

public class WeeklyPacingDto
{
    public int TargetLessonsPerWeek { get; set; } = 2;
    public int CompletedLessonsThisWeek { get; set; }
    public int Percentage { get; set; }
    public DateTime WeekStartDateUtc { get; set; }
    public DateTime WeekEndDateUtc { get; set; }
    public string StatusMessage { get; set; } = string.Empty;
}

public class SetWeeklyGoalDto
{
    public int TargetLessonsPerWeek { get; set; } = 2;
}

public class UserResourceProgressDto
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "default-user";
    public Guid ResourceId { get; set; }
    public Guid LessonId { get; set; }
    public bool IsCompleted { get; set; }
    public double LastPlaybackPositionSeconds { get; set; }
    public double TotalDurationSeconds { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public DateTime LastAccessedAtUtc { get; set; }
}

public class ToggleResourceProgressResultDto
{
    public UserResourceProgressDto ResourceProgress { get; set; } = new();
    public bool IsLessonCompleted { get; set; }
    public int CompletedCount { get; set; }
    public int TotalResourceCount { get; set; }
    public int CompletedVideoCount { get; set; }
    public int TotalVideoCount { get; set; }
}

public class LessonMicroProgressSummaryDto
{
    public Guid LessonId { get; set; }
    public bool IsLessonCompleted { get; set; }
    public int CompletedCount { get; set; }
    public int TotalResourceCount { get; set; }
    public int CompletedVideoCount { get; set; }
    public int TotalVideoCount { get; set; }
    public List<UserResourceProgressDto> ResourceProgresses { get; set; } = new();
}
