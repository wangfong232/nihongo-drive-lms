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
