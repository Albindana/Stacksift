using Hangfire;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;
using StackSift.Infrastructure.Jobs;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Messaging.Consumers;

public sealed class AlertFiredConsumer(
    AppDbContext db,
    IAlertHubService alertHub,
    IBackgroundJobClient backgroundJobs,
    ICacheService cache,
    ILogger<AlertFiredConsumer> logger,
    ICurrentOrgProvider orgProvider)
    : IConsumer<AlertFiredMessage>
{
    // A firing rule can produce several alerts within minutes (alert storms).
    // One immediate email per rule per cooldown window is enough.
    private static readonly TimeSpan EmailCooldown = TimeSpan.FromMinutes(15);

    public async Task Consume(ConsumeContext<AlertFiredMessage> context)
    {
        using var systemScope = orgProvider.EnterSystemScope(nameof(AlertFiredConsumer));
        var msg = context.Message;
        var ct = context.CancellationToken;

        var alert = await db.Alerts
            .FirstOrDefaultAsync(a => a.Id == msg.AlertId, ct);

        if (alert is null)
        {
            logger.LogWarning("AlertFiredConsumer: Alert {AlertId} not found — skipping broadcast", msg.AlertId);
            return;
        }

        var alertDto = new Application.DTOs.AlertDto(
            alert.Id,
            alert.ProjectId,
            alert.OrganizationId,
            alert.AlertRuleId,
            alert.Severity,
            alert.Title,
            alert.Description,
            alert.FiredAt,
            alert.AcknowledgedAt,
            alert.ResolvedAt,
            alert.IncidentId);

        await alertHub.BroadcastAlertAsync(alertDto, ct);

        if (alert.Severity is AlertSeverity.Critical or AlertSeverity.High)
        {
            var cooldownKey = $"alert-email-cooldown:{alert.AlertRuleId}";
            if (await cache.GetAsync<string>(cooldownKey, ct) is not null)
            {
                logger.LogInformation(
                    "Alert {AlertId} skipped immediate email — rule {RuleId} is in its {Cooldown} cooldown window",
                    alert.Id, alert.AlertRuleId, EmailCooldown);
            }
            else
            {
                await cache.SetAsync(cooldownKey, "1", EmailCooldown, ct);
                backgroundJobs.Enqueue<ImmediateAlertEmailJob>(
                    j => j.ExecuteAsync(alert.Id, CancellationToken.None));
            }
        }

        logger.LogInformation(
            "Alert {AlertId} broadcast dispatched for incident {IncidentId}",
            msg.AlertId, msg.IncidentId);
    }
}
