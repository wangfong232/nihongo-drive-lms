using Microsoft.AspNetCore.Mvc;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;

namespace NihongoLms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SrsController : ControllerBase
{
    private readonly ISrsService _srsService;

    public SrsController(ISrsService srsService)
    {
        _srsService = srsService;
    }

    /// <summary>
    /// GET /api/srs/due — Returns cards due for review today (max 120: 20 new + 100 review)
    /// </summary>
    [HttpGet("due")]
    public async Task<IActionResult> GetDueVocabulary([FromQuery] string? jlptLevel, CancellationToken cancellationToken)
    {
        var result = await _srsService.GetDueVocabularyAsync(jlptLevel, "default-user", cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// GET /api/srs/stats — Returns today's review statistics and streak
    /// </summary>
    [HttpGet("stats")]
    public async Task<IActionResult> GetSrsStats(CancellationToken cancellationToken)
    {
        var stats = await _srsService.GetStatsAsync("default-user", cancellationToken);
        return Ok(stats);
    }

    /// <summary>
    /// POST /api/srs/review — Process an SM-2 review rating for a vocabulary entry
    /// </summary>
    [HttpPost("review")]
    public async Task<IActionResult> ReviewVocabulary([FromBody] SrsReviewRequestDto dto, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _srsService.ReviewVocabularyAsync(dto.VocabularyEntryId, dto.QualityRating, "default-user", cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>
    /// POST /api/srs/add — Manually add a vocabulary entry to the SRS deck (creates ReviewSchedule if not exists)
    /// </summary>
    [HttpPost("add")]
    public async Task<IActionResult> AddToSrsDeck([FromBody] AddToSrsDto dto, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _srsService.AddToSrsDeckAsync(dto.VocabularyEntryId, "default-user", cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }
}
