using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace SmartX.Gateway.Api;

public sealed class CommandProcessor(
    GatewayStore store,
    ILogger<CommandProcessor> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                if (store.TryStartNextCommand(out var command) && command is not null)
                {
                    // Simulated field-device latency keeps the command endpoint responsive.
                    await Task.Delay(TimeSpan.FromMilliseconds(800), stoppingToken);
                    store.CompleteCommand(command);
                }
                else
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(150), stoppingToken);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            logger.LogInformation("Command processor stopped.");
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Command processor stopped after an unexpected error.");
            throw;
        }
    }
}
