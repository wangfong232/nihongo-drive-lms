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
