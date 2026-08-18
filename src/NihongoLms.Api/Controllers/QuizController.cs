using Microsoft.AspNetCore.Mvc;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;

namespace NihongoLms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class QuizController : ControllerBase
{
    private readonly IQuizLearnerService _quizLearnerService;

    public QuizController(IQuizLearnerService quizLearnerService)
    {
        _quizLearnerService = quizLearnerService;
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetLearnerQuiz(Guid id, CancellationToken cancellationToken)
    {
        var quiz = await _quizLearnerService.GetLearnerQuizAsync(id, cancellationToken);
        if (quiz == null) return NotFound();
        return Ok(quiz);
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> SubmitQuiz(Guid id, [FromBody] QuizSubmissionDto submission, CancellationToken cancellationToken)
    {
        try
        {
            var gradeResult = await _quizLearnerService.SubmitQuizAsync(id, submission, "default-user", cancellationToken);
            return Ok(gradeResult);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }
}
