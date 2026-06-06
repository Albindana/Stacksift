using FluentAssertions;
using Moq;
using StackSift.Application.Commands.AlertRules;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Tests.Application.AlertRules;

public class AlertRuleSeverityTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IProjectRepository> _projects = new();
    private readonly Mock<IAlertRuleRepository> _alertRules = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Guid _orgId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();

    public AlertRuleSeverityTests()
    {
        _currentUser.Setup(x => x.OrganizationId).Returns(_orgId);
        _uow.Setup(x => x.Projects).Returns(_projects.Object);
        _uow.Setup(x => x.AlertRules).Returns(_alertRules.Object);
        _projects.Setup(x => x.GetByIdAsync(_projectId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Project
            {
                Id = _projectId,
                OrganizationId = _orgId,
                Name = "Demo",
                Slug = "demo",
            });
    }

    private CreateAlertRuleCommand CreateCommand(AlertSeverity? severity) => new(
        _projectId, "Error spike", AlertRuleCondition.Threshold, 5, 10,
        LogLevel.Error, null, severity);

    [Fact]
    public async Task Create_WithSeverity_PersistsIt()
    {
        var handler = new CreateAlertRuleCommandHandler(_uow.Object, _currentUser.Object);

        var result = await handler.Handle(CreateCommand(AlertSeverity.High), default);

        result.Severity.Should().Be(AlertSeverity.High);
        _alertRules.Verify(x => x.AddAsync(
            It.Is<AlertRule>(r => r.Severity == AlertSeverity.High),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Create_WithoutSeverity_DefaultsToMedium()
    {
        var handler = new CreateAlertRuleCommandHandler(_uow.Object, _currentUser.Object);

        var result = await handler.Handle(CreateCommand(null), default);

        result.Severity.Should().Be(AlertSeverity.Medium);
    }

    [Fact]
    public async Task Update_WithSeverity_ChangesIt()
    {
        var rule = ExistingRule(AlertSeverity.Medium);
        _alertRules.Setup(x => x.GetByIdAsync(rule.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(rule);
        var handler = new UpdateAlertRuleCommandHandler(_uow.Object, _currentUser.Object);

        var result = await handler.Handle(UpdateCommand(rule.Id, AlertSeverity.Critical), default);

        result.Severity.Should().Be(AlertSeverity.Critical);
        rule.Severity.Should().Be(AlertSeverity.Critical);
    }

    [Fact]
    public async Task Update_WithoutSeverity_KeepsCurrent()
    {
        var rule = ExistingRule(AlertSeverity.High);
        _alertRules.Setup(x => x.GetByIdAsync(rule.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(rule);
        var handler = new UpdateAlertRuleCommandHandler(_uow.Object, _currentUser.Object);

        var result = await handler.Handle(UpdateCommand(rule.Id, null), default);

        result.Severity.Should().Be(AlertSeverity.High);
    }

    private AlertRule ExistingRule(AlertSeverity severity) => new()
    {
        Id = Guid.NewGuid(),
        ProjectId = _projectId,
        OrganizationId = _orgId,
        Name = "Error spike",
        Condition = AlertRuleCondition.Threshold,
        Threshold = 5,
        WindowMinutes = 10,
        Severity = severity,
        IsActive = true,
    };

    private static UpdateAlertRuleCommand UpdateCommand(Guid id, AlertSeverity? severity) => new(
        id, "Error spike", AlertRuleCondition.Threshold, 5, 10,
        LogLevel.Error, null, true, severity);
}
