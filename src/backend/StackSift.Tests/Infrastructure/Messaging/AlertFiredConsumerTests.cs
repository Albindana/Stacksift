using Hangfire;
using Hangfire.Common;
using Hangfire.States;
using MassTransit;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Jobs;
using StackSift.Infrastructure.Messaging.Consumers;
using StackSift.Infrastructure.Persistence;
using StackSift.Tests.Integration;

namespace StackSift.Tests.Infrastructure.Messaging;

[Collection("Postgres")]
public class AlertFiredConsumerTests(PostgresContainerFixture postgres) : IAsyncLifetime
{
    private AppDbContext _db = null!;

    public async Task InitializeAsync()
    {
        await postgres.ResetAsync();
        _db = postgres.CreateDbContext();
    }

    public async Task DisposeAsync() => await _db.DisposeAsync();

    private static Mock<ConsumeContext<AlertFiredMessage>> BuildContext(Alert alert) =>
        BuildContext(alert.Id, alert.IncidentId ?? Guid.Empty, alert.Severity);

    private static Mock<ConsumeContext<AlertFiredMessage>> BuildContext(Guid alertId, Guid incidentId, AlertSeverity severity)
    {
        var mock = new Mock<ConsumeContext<AlertFiredMessage>>();
        mock.Setup(c => c.Message).Returns(new AlertFiredMessage(
            Guid.NewGuid(), Guid.NewGuid(), alertId, incidentId, severity));
        mock.Setup(c => c.CancellationToken).Returns(CancellationToken.None);
        return mock;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 1: Critical alert — ImmediateAlertEmailJob is enqueued
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Consume_CriticalSeverity_EnqueuesImmediateAlertJob()
    {
        var orgId = Guid.NewGuid();
        var alert = new Alert
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            Severity = AlertSeverity.Critical,
            Title = "CPU Overload",
            FiredAt = DateTimeOffset.UtcNow,
        };
        _db.Alerts.Add(alert);
        await _db.SaveChangesAsync();

        var mockHub = new Mock<IAlertHubService>();
        mockHub
            .Setup(h => h.BroadcastAlertAsync(It.IsAny<AlertDto>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var mockJobs = new Mock<IBackgroundJobClient>();
        mockJobs
            .Setup(j => j.Create(It.IsAny<Job>(), It.IsAny<IState>()))
            .Returns("job-1");

        var consumer = new AlertFiredConsumer(
            _db, mockHub.Object, mockJobs.Object, new Mock<ICacheService>().Object,
            NullLogger<AlertFiredConsumer>.Instance,
            new FakeCurrentOrgProvider());

        await consumer.Consume(BuildContext(alert).Object);

        mockJobs.Verify(j => j.Create(It.IsAny<Job>(), It.IsAny<IState>()), Times.Once);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 2: Low-severity alert — no job enqueued
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Consume_LowSeverity_DoesNotEnqueueImmediateAlertJob()
    {
        var alert = new Alert
        {
            Id = Guid.NewGuid(),
            OrganizationId = Guid.NewGuid(),
            Severity = AlertSeverity.Low,
            Title = "Disk Usage",
            FiredAt = DateTimeOffset.UtcNow,
        };
        _db.Alerts.Add(alert);
        await _db.SaveChangesAsync();

        var mockHub = new Mock<IAlertHubService>();
        mockHub
            .Setup(h => h.BroadcastAlertAsync(It.IsAny<AlertDto>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var mockJobs = new Mock<IBackgroundJobClient>();

        var consumer = new AlertFiredConsumer(
            _db, mockHub.Object, mockJobs.Object, new Mock<ICacheService>().Object,
            NullLogger<AlertFiredConsumer>.Instance,
            new FakeCurrentOrgProvider());

        await consumer.Consume(BuildContext(alert).Object);

        mockJobs.Verify(j => j.Create(It.IsAny<Job>(), It.IsAny<IState>()), Times.Never);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 3: cooldown — second High alert for the same rule sends no email
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Consume_RuleInCooldown_DoesNotEnqueueImmediateAlertJob()
    {
        var ruleId = Guid.NewGuid();
        var alert = new Alert
        {
            Id = Guid.NewGuid(),
            OrganizationId = Guid.NewGuid(),
            AlertRuleId = ruleId,
            Severity = AlertSeverity.High,
            Title = "Error spike",
            FiredAt = DateTimeOffset.UtcNow,
        };
        _db.Alerts.Add(alert);
        await _db.SaveChangesAsync();

        var mockHub = new Mock<IAlertHubService>();
        mockHub
            .Setup(h => h.BroadcastAlertAsync(It.IsAny<AlertDto>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var mockJobs = new Mock<IBackgroundJobClient>();
        var mockCache = new Mock<ICacheService>();
        mockCache
            .Setup(c => c.GetAsync<string>($"alert-email-cooldown:{ruleId}", It.IsAny<CancellationToken>()))
            .ReturnsAsync("1");

        var consumer = new AlertFiredConsumer(
            _db, mockHub.Object, mockJobs.Object, mockCache.Object,
            NullLogger<AlertFiredConsumer>.Instance,
            new FakeCurrentOrgProvider());

        await consumer.Consume(BuildContext(alert).Object);

        mockJobs.Verify(j => j.Create(It.IsAny<Job>(), It.IsAny<IState>()), Times.Never);
        mockHub.Verify(h => h.BroadcastAlertAsync(It.IsAny<AlertDto>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 4: first High alert arms the cooldown and still emails
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Consume_FirstHighAlert_ArmsCooldownAndEnqueues()
    {
        var ruleId = Guid.NewGuid();
        var alert = new Alert
        {
            Id = Guid.NewGuid(),
            OrganizationId = Guid.NewGuid(),
            AlertRuleId = ruleId,
            Severity = AlertSeverity.High,
            Title = "Error spike",
            FiredAt = DateTimeOffset.UtcNow,
        };
        _db.Alerts.Add(alert);
        await _db.SaveChangesAsync();

        var mockHub = new Mock<IAlertHubService>();
        mockHub
            .Setup(h => h.BroadcastAlertAsync(It.IsAny<AlertDto>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var mockJobs = new Mock<IBackgroundJobClient>();
        mockJobs
            .Setup(j => j.Create(It.IsAny<Job>(), It.IsAny<IState>()))
            .Returns("job-1");
        var mockCache = new Mock<ICacheService>();

        var consumer = new AlertFiredConsumer(
            _db, mockHub.Object, mockJobs.Object, mockCache.Object,
            NullLogger<AlertFiredConsumer>.Instance,
            new FakeCurrentOrgProvider());

        await consumer.Consume(BuildContext(alert).Object);

        mockCache.Verify(c => c.SetAsync(
            $"alert-email-cooldown:{ruleId}", "1", TimeSpan.FromMinutes(15), It.IsAny<CancellationToken>()), Times.Once);
        mockJobs.Verify(j => j.Create(It.IsAny<Job>(), It.IsAny<IState>()), Times.Once);
    }
}
