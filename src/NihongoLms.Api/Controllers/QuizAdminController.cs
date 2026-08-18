using Microsoft.AspNetCore.Mvc;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;

namespace NihongoLms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class QuizAdminController : ControllerBase
{
    private readonly IQuizAdminService _quizAdminService;

    public QuizAdminController(IQuizAdminService quizAdminService)
    {
        _quizAdminService = quizAdminService;
    }

    [HttpGet]
    public async Task<IActionResult> GetQuizzes([FromQuery] Guid? lessonId, CancellationToken cancellationToken)
    {
        var quizzes = await _quizAdminService.GetQuizzesAsync(lessonId, cancellationToken);
        return Ok(quizzes);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetQuizById(Guid id, CancellationToken cancellationToken)
    {
        var quiz = await _quizAdminService.GetQuizByIdAsync(id, cancellationToken);
        if (quiz == null) return NotFound();
        return Ok(quiz);
    }

    [HttpPost]
    public async Task<IActionResult> CreateQuiz([FromBody] CreateQuizDto dto, CancellationToken cancellationToken)
    {
        var quiz = await _quizAdminService.CreateQuizAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetQuizById), new { id = quiz.Id }, quiz);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateQuiz(Guid id, [FromBody] CreateQuizDto dto, CancellationToken cancellationToken)
    {
        var quiz = await _quizAdminService.UpdateQuizAsync(id, dto, cancellationToken);
        return Ok(quiz);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteQuiz(Guid id, CancellationToken cancellationToken)
    {
        await _quizAdminService.DeleteQuizAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("questions")]
    public async Task<IActionResult> CreateQuestion([FromBody] CreateQuizQuestionDto dto, CancellationToken cancellationToken)
    {
        var question = await _quizAdminService.CreateQuestionAsync(dto, cancellationToken);
        return Ok(question);
    }

    [HttpPut("questions/{id:guid}")]
    public async Task<IActionResult> UpdateQuestion(Guid id, [FromBody] CreateQuizQuestionDto dto, CancellationToken cancellationToken)
    {
        var question = await _quizAdminService.UpdateQuestionAsync(id, dto, cancellationToken);
        return Ok(question);
    }

    [HttpDelete("questions/{id:guid}")]
    public async Task<IActionResult> DeleteQuestion(Guid id, CancellationToken cancellationToken)
    {
        await _quizAdminService.DeleteQuestionAsync(id, cancellationToken);
        return NoContent();
    }
}
