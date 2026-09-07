using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using NihongoLms.Application.Interfaces;

namespace NihongoLms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class KanjiController : ControllerBase
{
    private readonly IKanjiService _kanjiService;

    public KanjiController(IKanjiService kanjiService)
    {
        _kanjiService = kanjiService;
    }

    /// <summary>
    /// Master Kanji list for main library page (search, level filter, radical filter, no random fallback).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAllKanjis(
        [FromQuery] string? jlptLevel,
        [FromQuery] string? search,
        [FromQuery] string? radical,
        CancellationToken cancellationToken)
    {
        var result = await _kanjiService.GetAllKanjisAsync(jlptLevel, search, radical, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Lesson View Kanji endpoint with JLPT N-Level Random Fallback.
    /// </summary>
    [HttpGet("lesson/{lessonId:guid}")]
    [HttpGet("/api/learner/lessons/{lessonId:guid}/kanjis")]
    public async Task<IActionResult> GetKanjisByLesson(Guid lessonId, CancellationToken cancellationToken)
    {
        var result = await _kanjiService.GetKanjisByLessonAsync(lessonId, cancellationToken);
        return Ok(result);
    }
}
