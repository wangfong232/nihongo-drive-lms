using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NihongoLms.Domain.Interfaces;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SyncController : ControllerBase
{
    private readonly IDriveSyncService _syncService;
    private readonly LmsDbContext _dbContext;

    public SyncController(IDriveSyncService syncService, LmsDbContext dbContext)
    {
        _syncService = syncService;
        _dbContext = dbContext;
    }

    [HttpPost("drive")]
    public async Task<IActionResult> TriggerDriveSync([FromBody] DriveSyncRequestDto? request, [FromQuery] string? rootFolderId, CancellationToken cancellationToken)
    {
        string? targetRootId = !string.IsNullOrWhiteSpace(request?.RootFolderId) 
            ? request.RootFolderId 
            : (!string.IsNullOrWhiteSpace(rootFolderId) ? rootFolderId : "14MD4svpbhKvo6odQoGxvAgQTRSachRiz");

        var result = await _syncService.SyncRawDriveTreeAsync(targetRootId, cancellationToken);
        if (result.Errors.Count > 0 && result.NodesAdded == 0 && result.NodesUpdated == 0)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    public class DriveSyncRequestDto
    {
        public string? RootFolderId { get; set; }
    }

    [HttpGet("nodes")]
    public async Task<IActionResult> GetNodes([FromQuery] string? parentDriveFileId, [FromQuery] string? search)
{
    var query = _dbContext.DriveNodes
        .AsNoTracking()
        .Where(n => !n.IsDeletedInDrive);

    if (!string.IsNullOrEmpty(parentDriveFileId))
    {
        query = query.Where(n => n.ParentDriveFileId == parentDriveFileId);
    }

    if (!string.IsNullOrEmpty(search))
    {
        query = query.Where(n => EF.Functions.ILike(n.Name, $"%{search}%"));
    }

    var nodes = await query
        .OrderBy(n => n.NodeType)
        .ThenBy(n => n.Name)
        .ToListAsync();

    return Ok(nodes);
}
}
