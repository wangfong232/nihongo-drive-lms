using NihongoLms.Domain.Enums;

namespace NihongoLms.Application.DTOs;

public class QuizDto
{
    public Guid Id { get; set; }
    public Guid? LessonId { get; set; }
    public string? LessonTitle { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public QuizType QuizType { get; set; }
    public int PassPercentage { get; set; }
    public int? TimeLimitMinutes { get; set; }
    public bool ShuffleQuestions { get; set; }
    public List<QuizQuestionDto> Questions { get; set; } = new();
}

public class QuizQuestionDto
{
    public Guid Id { get; set; }
    public Guid QuizId { get; set; }
    public QuestionType QuestionType { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public Guid? AudioDriveNodeId { get; set; }
    public string? AudioDriveFileId { get; set; }
    public Guid? ImageDriveNodeId { get; set; }
    public string? ImageDriveFileId { get; set; }
    public int Points { get; set; }
    public int DisplayOrder { get; set; }
    public string PayloadJson { get; set; } = "{}";
}

public class CreateQuizDto
{
    public Guid? LessonId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public QuizType QuizType { get; set; } = QuizType.LessonQuiz;
    public int PassPercentage { get; set; } = 70;
    public int? TimeLimitMinutes { get; set; }
    public bool ShuffleQuestions { get; set; } = true;
}

public class CreateQuizQuestionDto
{
    public Guid QuizId { get; set; }
    public QuestionType QuestionType { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public Guid? AudioDriveNodeId { get; set; }
    public Guid? ImageDriveNodeId { get; set; }
    public int Points { get; set; } = 1;
    public int DisplayOrder { get; set; } = 0;
    public string PayloadJson { get; set; } = "{}";
}
