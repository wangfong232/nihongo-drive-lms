using Microsoft.Extensions.Logging;
using NihongoLms.Domain.Interfaces;
using Quartz;

namespace NihongoLms.Infrastructure.Jobs;

[DisallowConcurrentExecution]
public class DriveRawMirrorSyncJob : IJob
{
    private readonly IDriveSyncService _syncService;
    private readonly ILogger<DriveRawMirrorSyncJob> _logger;

    public DriveRawMirrorSyncJob(IDriveSyncService syncService, ILogger<DriveRawMirrorSyncJob> logger)
    {
        _syncService = syncService;
        _logger = logger;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        _logger.LogInformation("DriveRawMirrorSyncJob triggered at {Time}", DateTimeOffset.UtcNow);

        try
        {
            var result = await _syncService.SyncRawDriveTreeAsync(cancellationToken: context.CancellationToken);
            _logger.LogInformation("DriveRawMirrorSyncJob finished successfully. Added: {Added}, Updated: {Updated}, Deleted: {Deleted}",
                result.NodesAdded, result.NodesUpdated, result.NodesSoftDeleted);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DriveRawMirrorSyncJob encountered an unhandled exception.");
            throw new JobExecutionException(ex, refireImmediately: false);
        }
    }
}
