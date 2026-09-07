using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;

namespace NihongoLms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiController : ControllerBase
{
    private readonly IAiSenseiService _senseiService;

    public AiController(IAiSenseiService senseiService)
    {
        _senseiService = senseiService;
    }

    /// <summary>
    /// Interactive Sensei Assistant Chat endpoint.
    /// Supports contextual Q&A regarding current lesson, kanji, and grammar.
    /// </summary>
    [HttpPost("sensei-chat")]
    public async Task<IActionResult> SenseiChat([FromBody] SenseiChatRequestDto request, CancellationToken ct)
    {
        if (request == null)
            return BadRequest(new { error = "Yêu cầu không hợp lệ." });

        var response = await _senseiService.AskSenseiAsync(request, ct);
        return Ok(response);
    }
}
