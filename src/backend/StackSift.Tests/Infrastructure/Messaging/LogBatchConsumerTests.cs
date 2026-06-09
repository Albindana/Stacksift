using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Messaging.Consumers;
using StackSift.Infrastructure.Persistence;
using StackSift.Tests.Helpers;
using StackSift.Tests.Integration;
using LogLevel = StackSift.Domain.Enums.LogLevel;

namespace StackSift.Tests.Infrastructure.Messaging;

[Collection("Postgres")]
public class LogBatchConsumerTests(PostgresContainerFixture postgres) : IAsyncLifetime
{
    private AppDbContext _db = null!;
    private Mock<ILogEntryRepository> _logEntries = null!;
    private Mock<ICacheService> _cache = null!;
    private Mock<IPublishEndpoint> _publish = null!;
    private Mock<IAlertHubService> _hub = null!;
    private Mock<IStackSiftMetrics> _metrics = null!;

    public async Task InitializeAsync()
    {
        await postgres.ResetAsync();
        _db = postgres.CreateDbContext();
        _logEntries = new Mock<ILogEntryRepository>();
        _cache = new Mock<ICacheService>();
        _publish = new Mock<IPublishEndpoint>();
        _hub = new Mock<IAlertHubService>();
        _metrics = new Mock<IStackSiftMetrics>();
    }

    public async Task DisposeAsync() => await _db.DisposeAsync();

    private LogBatchConsumer BuildConsumer() => new(
        _db, _logEntries.Object, _cache.Object, _publish.Object, _hub.Object,
        _metrics.Object, NullLogger<LogBatchConsumer>.Instance, new FakeCurrentOrgProvider());

    private static Mock<ConsumeContext<LogBatchMessage>> BuildContext(LogBatchMessage msg)
    {
        var mock = new Mock<ConsumeContext<LogBatchMessage>>();
        mock.Setup(c => c.Message).Returns(msg);
        mock.Setup(c => c.CancellationToken).Returns(CancellationToken.None);
        return mock;
    }

    private static IngestLogEntryDto Entry(LogLevel level, string message = "boom") =>
        new(level, message, DateTimeOffset.UtcNow, null, null, "svc", "host", null);

    private async Task<AlertRule> SeedThresholdRule(
        Guid orgId, Guid projectId, decimal threshold, int windowMinutes,
        LogLevel? level = LogLevel.Error, AlertSeverity severity = AlertSeverity.High)
    {
        var rule = new AlertRule
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            ProjectId = projectId,
            Name = "Error spike",
            Condition = AlertRuleCondition.Threshold,
            Threshold = threshold,
            WindowMinutes = windowMinutes,
            LogLevel = level,
            IsActive = true,
            Severity = severity,
        };
        _db.AlertRules.Add(rule);
        await _db.SaveChangesAsync();
        return rule;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Threshold rules now evaluate across the rule's time window, not the batch
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Threshold_WindowCountMeetsThreshold_FiresFromSingleEntryBatch()
    {
        var orgId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var rule = await SeedThresholdRule(orgId, projectId, threshold: 10, windowMinutes: 15);

        _logEntries
            .Setup(r => r.CountByProjectSinceAsync(
                orgId, projectId, LogLevel.Error, It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(10);

        var msg = new LogBatchMessage(orgId, projectId, Guid.NewGuid(), [Entry(LogLevel.Error)]);
        await BuildConsumer().Consume(BuildContext(msg).Object);

        var alert = await _db.Alerts.SingleAsync(a => a.AlertRuleId == rule.Id);
        var incident = await _db.Incidents.SingleAsync(i => i.ProjectId == projectId);
        Assert.Equal(incident.Id, alert.IncidentId);
        Assert.Equal(AlertSeverity.High, alert.Severity);
        _publish.Verify(p => p.Publish(
            It.Is<AlertFiredMessage>(m => m.AlertId == alert.Id), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Threshold_WindowCountBelowThreshold_DoesNotFire()
    {
        var orgId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        await SeedThresholdRule(orgId, projectId, threshold: 10, windowMinutes: 15);

        _logEntries
            .Setup(r => r.CountByProjectSinceAsync(
                orgId, projectId, LogLevel.Error, It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(9);

        var msg = new LogBatchMessage(orgId, projectId, Guid.NewGuid(), [Entry(LogLevel.Error)]);
        await BuildConsumer().Consume(BuildContext(msg).Object);

        Assert.Empty(await _db.Alerts.ToListAsync());
        Assert.Empty(await _db.Incidents.ToListAsync());
        _publish.Verify(p => p.Publish(It.IsAny<AlertFiredMessage>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Threshold_WindowStartRespectsRuleWindowMinutes()
    {
        var orgId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        await SeedThresholdRule(orgId, projectId, threshold: 5, windowMinutes: 30);

        DateTimeOffset? observedSince = null;
        _logEntries
            .Setup(r => r.CountByProjectSinceAsync(
                orgId, projectId, LogLevel.Error, It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .Callback<Guid, Guid, LogLevel?, DateTimeOffset, CancellationToken>((_, _, _, since, _) => observedSince = since)
            .ReturnsAsync(0);

        var msg = new LogBatchMessage(orgId, projectId, Guid.NewGuid(), [Entry(LogLevel.Error)]);
        await BuildConsumer().Consume(BuildContext(msg).Object);

        Assert.NotNull(observedSince);
        var expected = DateTimeOffset.UtcNow.AddMinutes(-30);
        Assert.InRange(observedSince.Value, expected.AddSeconds(-10), expected.AddSeconds(10));
    }

    [Fact]
    public async Task Threshold_NoMatchingEntryInBatch_SkipsWindowQuery()
    {
        var orgId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        await SeedThresholdRule(orgId, projectId, threshold: 10, windowMinutes: 15, level: LogLevel.Error);

        var msg = new LogBatchMessage(orgId, projectId, Guid.NewGuid(), [Entry(LogLevel.Info)]);
        await BuildConsumer().Consume(BuildContext(msg).Object);

        _logEntries.Verify(r => r.CountByProjectSinceAsync(
            It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<LogLevel?>(),
            It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()), Times.Never);
        Assert.Empty(await _db.Alerts.ToListAsync());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Re-fire cooldown: one alert per rule per window
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Rule_InCooldown_IsNotEvaluated()
    {
        var orgId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var rule = await SeedThresholdRule(orgId, projectId, threshold: 1, windowMinutes: 15);

        _cache
            .Setup(c => c.GetAsync<string>($"alert-rule-cooldown:{rule.Id}", It.IsAny<CancellationToken>()))
            .ReturnsAsync("1");

        var msg = new LogBatchMessage(orgId, projectId, Guid.NewGuid(), [Entry(LogLevel.Error)]);
        await BuildConsumer().Consume(BuildContext(msg).Object);

        _logEntries.Verify(r => r.CountByProjectSinceAsync(
            It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<LogLevel?>(),
            It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()), Times.Never);
        Assert.Empty(await _db.Alerts.ToListAsync());
    }

    [Fact]
    public async Task Rule_Firing_ArmsCooldownForWindowDuration()
    {
        var orgId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var rule = await SeedThresholdRule(orgId, projectId, threshold: 1, windowMinutes: 10);

        _logEntries
            .Setup(r => r.CountByProjectSinceAsync(
                orgId, projectId, LogLevel.Error, It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var msg = new LogBatchMessage(orgId, projectId, Guid.NewGuid(), [Entry(LogLevel.Error)]);
        await BuildConsumer().Consume(BuildContext(msg).Object);

        _cache.Verify(c => c.SetAsync(
            $"alert-rule-cooldown:{rule.Id}", "1", TimeSpan.FromMinutes(10), It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Existing behaviours that must not regress
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Pattern_SubstringMatch_FiresAlert()
    {
        var orgId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var rule = new AlertRule
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            ProjectId = projectId,
            Name = "Payment failures",
            Condition = AlertRuleCondition.Pattern,
            Pattern = "payment gateway",
            WindowMinutes = 5,
            IsActive = true,
            Severity = AlertSeverity.Critical,
        };
        _db.AlertRules.Add(rule);
        await _db.SaveChangesAsync();

        var msg = new LogBatchMessage(orgId, projectId, Guid.NewGuid(),
            [Entry(LogLevel.Error, "Timeout calling Payment Gateway endpoint")]);
        await BuildConsumer().Consume(BuildContext(msg).Object);

        var alert = await _db.Alerts.SingleAsync(a => a.AlertRuleId == rule.Id);
        Assert.Equal("Timeout calling Payment Gateway endpoint", alert.Description);
    }

    [Fact]
    public async Task ExistingOpenIncident_AtSameOrHigherSeverity_IsReused()
    {
        var orgId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var rule = await SeedThresholdRule(orgId, projectId, threshold: 1, windowMinutes: 15);

        var existing = new Incident
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            ProjectId = projectId,
            Status = IncidentStatus.Open,
            Title = "Existing incident",
            Severity = AlertSeverity.High,
            StartedAt = DateTimeOffset.UtcNow.AddMinutes(-5),
        };
        _db.Incidents.Add(existing);
        await _db.SaveChangesAsync();

        _logEntries
            .Setup(r => r.CountByProjectSinceAsync(
                orgId, projectId, LogLevel.Error, It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var msg = new LogBatchMessage(orgId, projectId, Guid.NewGuid(), [Entry(LogLevel.Error)]);
        await BuildConsumer().Consume(BuildContext(msg).Object);

        var alert = await _db.Alerts.SingleAsync(a => a.AlertRuleId == rule.Id);
        Assert.Equal(existing.Id, alert.IncidentId);
        Assert.Equal(1, await _db.Incidents.CountAsync());
    }

    [Fact]
    public async Task SyntheticBatch_IsIndexedButNeverEvaluated()
    {
        var orgId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        await SeedThresholdRule(orgId, projectId, threshold: 1, windowMinutes: 15);

        var msg = new LogBatchMessage(orgId, projectId, Guid.NewGuid(),
            [Entry(LogLevel.Error)], IsSynthetic: true);
        await BuildConsumer().Consume(BuildContext(msg).Object);

        _logEntries.Verify(r => r.BulkIndexForOrgAsync(
            orgId, It.Is<IList<LogEntry>>(l => l.Count == 1), It.IsAny<CancellationToken>()), Times.Once);
        _logEntries.Verify(r => r.CountByProjectSinceAsync(
            It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<LogLevel?>(),
            It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()), Times.Never);
        Assert.Empty(await _db.Alerts.ToListAsync());
    }

    [Fact]
    public async Task SoftDeletedRule_IsNotEvaluated()
    {
        var orgId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var rule = await SeedThresholdRule(orgId, projectId, threshold: 1, windowMinutes: 15);

        _db.AlertRules.Remove(rule); // soft delete via SaveChangesAsync interception
        await _db.SaveChangesAsync();

        _logEntries
            .Setup(r => r.CountByProjectSinceAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<LogLevel?>(),
                It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(100);

        var msg = new LogBatchMessage(orgId, projectId, Guid.NewGuid(), [Entry(LogLevel.Error)]);
        await BuildConsumer().Consume(BuildContext(msg).Object);

        Assert.Empty(await _db.Alerts.IgnoreQueryFilters().ToListAsync());
    }
}
