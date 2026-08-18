using Microsoft.AspNetCore.Mvc;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;

namespace NihongoLms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CuratorController : ControllerBase
{
    private readonly ICuratorService _curatorService;
    private readonly IAutoSuggestPatternEngine _autoSuggestEngine;

    public CuratorController(ICuratorService curatorService, IAutoSuggestPatternEngine autoSuggestEngine)
    {
        _curatorService = curatorService;
        _autoSuggestEngine = autoSuggestEngine;
    }

    [HttpPost("assign")]
    public async Task<IActionResult> AssignDriveNode([FromBody] AssignDriveNodeRequestDto dto, CancellationToken cancellationToken)
    {
        var resource = await _curatorService.AssignDriveNodeAsync(dto, cancellationToken);
        return Ok(resource);
    }

    [HttpDelete("resources/{id:guid}")]
    public async Task<IActionResult> RemoveResource(Guid id, CancellationToken cancellationToken)
    {
        await _curatorService.RemoveResourceAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("auto-suggest/analyze")]
    public async Task<IActionResult> AnalyzeAutoSuggestPattern([FromBody] AutoSuggestRequestDto dto, CancellationToken cancellationToken)
    {
        var result = await _autoSuggestEngine.AnalyzeFolderPatternAsync(dto, cancellationToken);
        return Ok(result);
    }

    [HttpPost("auto-suggest/apply")]
    public async Task<IActionResult> ApplyAutoSuggest([FromBody] ApplyAutoSuggestRequestDto dto, CancellationToken cancellationToken)
    {
        int createdCount = await _curatorService.ApplyAutoSuggestAsync(dto, cancellationToken);
        return Ok(new { message = $"Successfully created {createdCount} lessons from auto-suggest pattern.", count = createdCount });
    }
}
