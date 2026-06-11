using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Application.Mapping;
using StackSift.Infrastructure.Persistence;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Infrastructure.Messaging.Consumers;

public sealed class LogBatchConsumer(
    AppDbContext db,
    ILogEntryRepository logEntries,
    ICacheService cache,
    IPublishEndpoint publishEndpoint,
    IAlertHubService alertHub,
    IStackSiftMetrics metrics,
    ILogger<LogBatchConsumer> logger,
    ICurrentOrgProvider orgProvider)
    : IConsumer<LogBatchMessage>
{
    public async Task Consume(ConsumeContext<LogBatchMessage> context)
    {
        using var systemScope = orgProvider.EnterSystemScope(nameof(LogBatchConsumer));
        var msg = context.Message;
        var ct = context.CancellationToken;

        logger.LogInformation(
            "Processing LogBatchMessage: {Count} entries for project {ProjectId}",
            msg.Entries.Count, msg.ProjectId);

        // 1. Map DTOs → LogEntry domain entities. IDs are derived from the message
        // identity so a redelivered batch upserts the same ES documents and the
        // frontend can dedupe re-broadcasts, instead of minting fresh duplicates.
        var batchId = context.MessageId ?? Guid.NewGuid();
        var entries = msg.Entries.Select((dto, i) => new LogEntry
        {
            Id = DeterministicEntryId(batchId, i),
            OrganizationId = msg.OrganizationId,
            ProjectId = msg.ProjectId,
            LogSourceId = msg.LogSourceId,
            Level = dto.Level,
            Message = dto.Message,
            Timestamp = dto.Timestamp,
            TraceId = dto.TraceId,
            SpanId = dto.SpanId,
            ServiceName = dto.ServiceName,
            HostName = dto.HostName,
            Metadata = dto.Metadata ?? [],
        }).ToList();

        // 2. Broadcast to the project's SignalR group BEFORE indexing — the live
        // feed should not pay the ES write + refresh latency. If indexing fails
        // below, the redelivered batch re-broadcasts the same entry IDs and the
        // frontend dedupes them.
        foreach (var entry in entries)
            await alertHub.BroadcastLogEntryAsync(entry.ToDto(), ct);

        // 2b. Bulk-index to Elasticsearch (idempotent upsert; waits for the batch
        // to become searchable so the alert-window counts below can see it)
        await logEntries.BulkIndexForOrgAsync(msg.OrganizationId, entries, ct);

        metrics.RecordLogsIngested(msg.OrganizationId, entries.Count);

        if (msg.IsSynthetic) return;

        // 3. Load active alert rules for this project (bypasses org-scoped repo — org comes from message)
        var rules = await db.AlertRules
            .Where(r => r.ProjectId == msg.ProjectId && r.IsActive)
            .ToListAsync(ct);

        if (rules.Count == 0) return;

        // 4. Evaluate each rule; create Alert + Incident for matches
        bool anyAlertCreated = false;

        foreach (var rule in rules)
        {
            // A rule that fired re-arms only after its window elapses; without this
            // a sustained breach would fire once per batch (seconds apart).
            var cooldownKey = $"alert-rule-cooldown:{rule.Id}";
            if (await cache.GetAsync<string>(cooldownKey, ct) is not null)
                continue;

            var (fired, firstMatchMessage) = await EvaluateRuleAsync(rule, msg, entries, ct);
            if (!fired)
                continue;

            // 5. Create Alert
            var alert = new Alert
            {
                Id = Guid.NewGuid(),
                OrganizationId = msg.OrganizationId,
                ProjectId = msg.ProjectId,
                AlertRuleId = rule.Id,
                Severity = rule.Severity,
                Title = rule.Name,
                Description = firstMatchMessage ?? string.Empty,
                FiredAt = DateTimeOffset.UtcNow,
            };

            // 6. Find existing open/acknowledged incident at same or higher severity; else create one
            var existingIncident = await db.Incidents
                .Where(i => i.ProjectId == msg.ProjectId
                    && (i.Status == IncidentStatus.Open || i.Status == IncidentStatus.Acknowledged)
                    && i.Severity >= rule.Severity)
                .OrderByDescending(i => i.StartedAt)
                .FirstOrDefaultAsync(ct);

            Guid incidentId;
            if (existingIncident is null)
            {
                var incident = new Incident
                {
                    Id = Guid.NewGuid(),
                    OrganizationId = msg.OrganizationId,
                    ProjectId = msg.ProjectId,
                    Status = IncidentStatus.Open,
                    Title = $"Incident: {rule.Name}",
                    Description = firstMatchMessage,
                    Severity = rule.Severity,
                    StartedAt = DateTimeOffset.UtcNow,
                };
                db.Incidents.Add(incident);
                incidentId = incident.Id;
            }
            else
            {
                incidentId = existingIncident.Id;
            }

            alert.IncidentId = incidentId;
            db.Alerts.Add(alert);
            await db.SaveChangesAsync(ct);
            anyAlertCreated = true;

            // Arm only after the alert is durably stored, so a failed save retries cleanly
            await cache.SetAsync(cooldownKey, "1", TimeSpan.FromMinutes(EffectiveWindowMinutes(rule)), ct);

            // 7. Publish AlertFiredMessage for downstream (SignalR broadcast, etc.)
            await publishEndpoint.Publish(
                new AlertFiredMessage(msg.OrganizationId, msg.ProjectId, alert.Id, incidentId, rule.Severity),
                ct);
            metrics.RecordAlertFired(rule.Severity);

            var openIncidentCount = await db.Incidents.CountAsync(
                i => i.Status == IncidentStatus.Open || i.Status == IncidentStatus.Acknowledged,
                ct);
            metrics.SetOpenIncidents(openIncidentCount);

            logger.LogInformation(
                "Alert {AlertId} created for rule '{Rule}', linked to incident {IncidentId}",
                alert.Id, rule.Name, incidentId);
        }

        // 8. Invalidate dashboard cache so fresh stats are served
        if (anyAlertCreated)
            await cache.RemoveAsync($"dashboard:stats:{msg.OrganizationId}", ct);
    }

    // ── Rule evaluation ──────────────────────────────────────────────────────

    private async Task<(bool Fired, string? FirstMatchMessage)> EvaluateRuleAsync(
        AlertRule rule, LogBatchMessage msg, List<LogEntry> entries, CancellationToken ct)
    {
        return rule.Condition switch
        {
            AlertRuleCondition.Threshold => await EvaluateThresholdAsync(rule, msg, entries, ct),
            AlertRuleCondition.Pattern => EvaluatePattern(rule, entries),
            AlertRuleCondition.Anomaly or AlertRuleCondition.Absence => (false, null), // deferred to future sprint
            _ => (false, null)
        };
    }

    private async Task<(bool Fired, string? FirstMatchMessage)> EvaluateThresholdAsync(
        AlertRule rule, LogBatchMessage msg, List<LogEntry> entries, CancellationToken ct)
    {
        if (!rule.Threshold.HasValue) return (false, null);

        // Only batches that contribute a matching entry can trigger the rule;
        // unrelated traffic must not re-fire it off old window contents.
        var firstMatch = entries.FirstOrDefault(e => rule.LogLevel is null || e.Level == rule.LogLevel);
        if (firstMatch is null) return (false, null);

        var windowStart = DateTimeOffset.UtcNow.AddMinutes(-EffectiveWindowMinutes(rule));
        var count = await logEntries.CountByProjectSinceAsync(
            msg.OrganizationId, msg.ProjectId, rule.LogLevel, windowStart, ct);

        return count >= (long)rule.Threshold.Value
            ? (true, firstMatch.Message)
            : (false, null);
    }

    private static (bool Fired, string? FirstMatchMessage) EvaluatePattern(AlertRule rule, List<LogEntry> entries)
    {
        if (string.IsNullOrEmpty(rule.Pattern)) return (false, null);

        var hit = entries.FirstOrDefault(e =>
            e.Message.Contains(rule.Pattern, StringComparison.OrdinalIgnoreCase));

        return hit is not null ? (true, hit.Message) : (false, null);
    }

    // WindowMinutes is validated to [1, 1440] on write; clamp defensively for legacy rows
    private static int EffectiveWindowMinutes(AlertRule rule) => Math.Max(1, rule.WindowMinutes);

    /// <summary>
    /// UUIDv5-style name-based GUID from the transport message id + entry index,
    /// so every consume attempt of the same message yields the same entry IDs.
    /// </summary>
    private static Guid DeterministicEntryId(Guid batchId, int index)
    {
        var name = $"{batchId:N}:{index}";
        var hash = System.Security.Cryptography.SHA1.HashData(System.Text.Encoding.UTF8.GetBytes(name));
        var bytes = hash[..16];
        bytes[6] = (byte)((bytes[6] & 0x0F) | 0x50); // version 5
        bytes[8] = (byte)((bytes[8] & 0x3F) | 0x80); // RFC 4122 variant
        return new Guid(bytes);
    }
}
