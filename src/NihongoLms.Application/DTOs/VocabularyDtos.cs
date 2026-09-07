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
    public bool IsFallback { get; set; } = false;
    public DateTime CreatedAtUtc { get; set; }
}

public class LessonVocabulariesResponseDto
{
    public Guid LessonId { get; set; }
    public string CourseLevel { get; set; } = "N5";
    public bool IsFallback { get; set; }
    public List<VocabularyEntryDto> Items { get; set; } = new();
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

public class KanjiExampleDto
{
    public string Word { get; set; } = string.Empty;
    public string Reading { get; set; } = string.Empty;
    public string Meaning { get; set; } = string.Empty;
}

public class KanjiItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Character { get; set; } = string.Empty;
    public string HanViet { get; set; } = string.Empty;
    public string Meaning { get; set; } = string.Empty;
    public List<string> Onyomi { get; set; } = new();
    public List<string> Kunyomi { get; set; } = new();
    public int StrokeCount { get; set; }
    public string Jlpt { get; set; } = "N5";
    public string Radical { get; set; } = string.Empty;
    public string RadicalName { get; set; } = string.Empty;
    public List<KanjiExampleDto> Examples { get; set; } = new();
    public bool IsFallback { get; set; } = false;
}

public class LessonKanjisResponseDto
{
    public Guid LessonId { get; set; }
    public string CourseLevel { get; set; } = "N5";
    public bool IsFallback { get; set; }
    public List<KanjiItemDto> Items { get; set; } = new();
}
