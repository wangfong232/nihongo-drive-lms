using System.Text.Json;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;

namespace NihongoLms.Infrastructure.Services;

public class QuizGradingEngine : IQuizGradingEngine
{
    public QuizSubmissionResultDto GradeSubmission(Quiz quiz, QuizSubmissionDto submission)
    {
        double totalEarned = 0;
        double maxScore = quiz.Questions.Sum(q => q.Points);
        var questionResults = new List<QuestionGradeResultDto>();

        var userAnswersMap = submission.Answers.ToDictionary(a => a.QuestionId, a => a.AnswerJson);

        foreach (var q in quiz.Questions.OrderBy(q => q.DisplayOrder))
        {
            double earned = 0;
            bool isCorrect = false;
            string feedback = "";
            string explanation = "";

            if (userAnswersMap.TryGetValue(q.Id, out var rawAnswerJson) && !string.IsNullOrWhiteSpace(rawAnswerJson))
            {
                (isCorrect, earned, feedback, explanation) = GradeQuestion(q, rawAnswerJson);
            }
            else
            {
                feedback = "No answer provided.";
            }

            totalEarned += earned;
            questionResults.Add(new QuestionGradeResultDto
            {
                QuestionId = q.Id,
                IsCorrect = isCorrect,
                PointsEarned = earned,
                MaxPoints = q.Points,
                Feedback = feedback,
                CorrectAnswerExplanation = explanation
            });
        }

        double percentage = maxScore > 0 ? Math.Round((totalEarned / maxScore) * 100, 2) : 0;
        bool isPassed = percentage >= quiz.PassPercentage;

        return new QuizSubmissionResultDto
        {
            QuizId = quiz.Id,
            Score = totalEarned,
            MaxScore = maxScore,
            Percentage = percentage,
            IsPassed = isPassed,
            QuestionResults = questionResults
        };
    }

    private static (bool IsCorrect, double EarnedPoints, string Feedback, string Explanation) GradeQuestion(QuizQuestion q, string userAnsJson)
    {
        try
        {
            using var payloadDoc = JsonDocument.Parse(q.PayloadJson);
            var payload = payloadDoc.RootElement;

            switch (q.QuestionType)
            {
                case QuestionType.MultipleChoice:
                case QuestionType.ListeningComprehension:
                {
                    int correctIdx = payload.TryGetProperty("correctIndex", out var ci) ? ci.GetInt32() : -1;
                    string explanation = payload.TryGetProperty("explanation", out var exp) ? exp.GetString() ?? "" : "";

                    if (int.TryParse(userAnsJson.Trim('"'), out int userIdx) && userIdx == correctIdx)
                    {
                        return (true, q.Points, "Correct answer!", explanation);
                    }
                    return (false, 0, "Incorrect choice.", explanation);
                }

                case QuestionType.FillInTheBlank:
                {
                    var acceptable = new List<string>();
                    if (payload.TryGetProperty("acceptableAnswers", out var accArr))
                    {
                        foreach (var el in accArr.EnumerateArray())
                        {
                            if (el.GetString() is string s) acceptable.Add(s.Trim().ToLowerInvariant());
                        }
                    }

                    string userText = userAnsJson.Trim('"').Trim().ToLowerInvariant();
                    if (acceptable.Contains(userText))
                    {
                        return (true, q.Points, "Correct answer!", $"Acceptable answers: {string.Join(", ", acceptable)}");
                    }
                    return (false, 0, "Incorrect answer.", $"Acceptable answers: {string.Join(", ", acceptable)}");
                }

                case QuestionType.TrueFalse:
                {
                    bool correctVal = payload.TryGetProperty("correctValue", out var cv) && cv.GetBoolean();
                    if (bool.TryParse(userAnsJson.Trim('"'), out bool userVal) && userVal == correctVal)
                    {
                        return (true, q.Points, "Correct!", "");
                    }
                    return (false, 0, "Incorrect.", "");
                }

                case QuestionType.DragAndDrop:
                {
                    // Expects ordered array of tokens or indices
                    var userTokens = JsonSerializer.Deserialize<List<string>>(userAnsJson) ?? new List<string>();
                    var correctTokens = new List<string>();
                    if (payload.TryGetProperty("correctSequence", out var cs))
                    {
                        foreach (var el in cs.EnumerateArray())
                        {
                            if (el.GetString() is string s) correctTokens.Add(s);
                        }
                    }

                    bool matches = userTokens.SequenceEqual(correctTokens);
                    return (matches, matches ? q.Points : 0, matches ? "Correct sequence!" : "Incorrect sequence.", $"Expected: {string.Join(" -> ", correctTokens)}");
                }

                case QuestionType.Matching:
                {
                    var userPairs = JsonSerializer.Deserialize<Dictionary<string, string>>(userAnsJson) ?? new Dictionary<string, string>();
                    int correctPairCount = 0;
                    int totalPairs = 0;

                    if (payload.TryGetProperty("pairs", out var pairsArr))
                    {
                        foreach (var el in pairsArr.EnumerateArray())
                        {
                            totalPairs++;
                            string left = el.GetProperty("left").GetString() ?? "";
                            string right = el.GetProperty("right").GetString() ?? "";

                            if (userPairs.TryGetValue(left, out var userRight) && string.Equals(userRight, right, StringComparison.OrdinalIgnoreCase))
                            {
                                correctPairCount++;
                            }
                        }
                    }

                    bool fullCorrect = totalPairs > 0 && correctPairCount == totalPairs;
                    double partialScore = totalPairs > 0 ? (double)correctPairCount / totalPairs * q.Points : 0;
                    return (fullCorrect, partialScore, $"Matched {correctPairCount}/{totalPairs} correctly.", "");
                }

                case QuestionType.FreeResponse:
                {
                    return (true, q.Points, "Response submitted for review.", "Sample response key provided.");
                }

                default:
                    return (false, 0, "Unsupported question type.", "");
            }
        }
        catch
        {
            return (false, 0, "Error grading answer payload.", "");
        }
    }
}
