using Microsoft.AspNetCore.Mvc;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;

namespace NihongoLms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VocabularyController : ControllerBase
{
    private readonly IVocabularyService _vocabService;

    public VocabularyController(IVocabularyService vocabService)
    {
        _vocabService = vocabService;
    }

    [HttpGet]
    public async Task<IActionResult> GetVocabulary(
        [FromQuery] string? lessonId,
        [FromQuery] string? jlptLevel,
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        Guid? parsedLessonId = null;
        if (!string.IsNullOrWhiteSpace(lessonId) && Guid.TryParse(lessonId, out var id))
        {
            parsedLessonId = id;
        }

        var result = await _vocabService.GetVocabularyAsync(parsedLessonId, jlptLevel, search, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetVocabularyById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _vocabService.GetVocabularyByIdAsync(id, cancellationToken);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> CreateVocabulary([FromBody] CreateVocabularyEntryDto dto, CancellationToken cancellationToken)
    {
        var result = await _vocabService.CreateVocabularyAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetVocabularyById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateVocabulary(Guid id, [FromBody] CreateVocabularyEntryDto dto, CancellationToken cancellationToken)
    {
        var result = await _vocabService.UpdateVocabularyAsync(id, dto, cancellationToken);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteVocabulary(Guid id, CancellationToken cancellationToken)
    {
        await _vocabService.DeleteVocabularyAsync(id, cancellationToken);
        return NoContent();
    }
}
