namespace NihongoLms.Application.DTOs;

public class VocabularyEntryDto
{
    public Guid Id { get; set; }
    public Guid? LessonId { get; set; }
    public string? LessonTitle { get; set; }
    public string Word { get; set; } = string.Empty;
    public string Reading { get; set; } = string.Empty;
    public string Meaning { get; set; } = string.Empty;
    public string? ExampleSentence { get; set; }
    public string? ExampleSentenceTranslation { get; set; }
    public string PartOfSpeech { get; set; } = "Noun";
    public string JlptLevel { get; set; } = "N5";
    public Guid? AudioDriveNodeId { get; set; }
    public string? AudioDriveFileId { get; set; }
    public Guid? StrokeOrderDriveNodeId { get; set; }
    public string? StrokeOrderDriveFileId { get; set; }
    public string? TagsJson { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class CreateVocabularyEntryDto
{
    public Guid? LessonId { get; set; }
    public string Word { get; set; } = string.Empty;
    public string Reading { get; set; } = string.Empty;
    public string Meaning { get; set; } = string.Empty;
    public string? ExampleSentence { get; set; }
    public string? ExampleSentenceTranslation { get; set; }
    public string PartOfSpeech { get; set; } = "Noun";
    public string JlptLevel { get; set; } = "N5";
    public Guid? AudioDriveNodeId { get; set; }
    public Guid? StrokeOrderDriveNodeId { get; set; }
    public string? TagsJson { get; set; }
}
