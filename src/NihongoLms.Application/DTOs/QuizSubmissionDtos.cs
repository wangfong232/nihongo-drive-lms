using NihongoLms.Domain.Enums;

namespace NihongoLms.Application.DTOs;

public class SrsReviewRequestDto
{
    public Guid VocabularyEntryId { get; set; }
    public int QualityRating { get; set; } // 0: Again, 1: Hard, 2: Good, 3: Easy
}

public class AddToSrsDto
{
    public Guid VocabularyEntryId { get; set; }
}


public class SrsReviewResultDto
{
    public Guid VocabularyEntryId { get; set; }
    public double IntervalDays { get; set; }
    public double EaseFactor { get; set; }
    public int RepetitionCount { get; set; }
    public DateTime NextReviewDateUtc { get; set; }
    public SrsState State { get; set; }
}

public class QuizSubmissionDto
{
    public Guid QuizId { get; set; }
    public List<QuestionAnswerSubmissionDto> Answers { get; set; } = new();
}

public class QuestionAnswerSubmissionDto
{
    public Guid QuestionId { get; set; }
    public string AnswerJson { get; set; } = "{}"; // Serialized user answer (e.g. index, text, array)
}

public class QuizSubmissionResultDto
{
    public Guid QuizId { get; set; }
    public double Score { get; set; }
    public double MaxScore { get; set; }
    public double Percentage { get; set; }
    public bool IsPassed { get; set; }
    public List<QuestionGradeResultDto> QuestionResults { get; set; } = new();
}

public class QuestionGradeResultDto
{
    public Guid QuestionId { get; set; }
    public bool IsCorrect { get; set; }
    public double PointsEarned { get; set; }
    public double MaxPoints { get; set; }
    public string Feedback { get; set; } = string.Empty;
    public string CorrectAnswerExplanation { get; set; } = string.Empty;
}
