using NihongoLms.Domain.Enums;

namespace NihongoLms.Application.DTOs;

public class SrsDueItemDto
{
    public Guid ScheduleId { get; set; }
    public VocabularyEntryDto Vocabulary { get; set; } = new();
    public double EaseFactor { get; set; }
    public double IntervalDays { get; set; }
    public int RepetitionCount { get; set; }
    public SrsState State { get; set; }
}

public class SrsStatsDto
{
    public int DueToday { get; set; }
    public int NewToday { get; set; }
    public int ReviewedToday { get; set; }
    public int Streak { get; set; }
}

public class AddToSrsResultDto
{
    public bool AlreadyExists { get; set; }
    public Guid ScheduleId { get; set; }
    public string Message { get; set; } = string.Empty;
}
