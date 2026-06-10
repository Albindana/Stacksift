using FluentAssertions;
using Moq;
using StackSift.Application.Commands.AiAnalyses;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Tests.Application.AiAnalyses;

public class TriggerAiAnalysisCommandTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IIncidentRepository> _incidents = new();
    private readonly Mock<IOrganizationRepository> _orgs = new();
    private readonly Mock<IAiAnalysisRepository> _analyses = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Mock<IAiAnalysisJobRunner> _jobRunner = new();
    private readonly Mock<IFeatureFlagService> _featureFlags = new();
    private readonly Guid _orgId = Guid.NewGuid();

    public TriggerAiAnalysisCommandTests()
    {
        _currentUser.Setup(x => x.OrganizationId).Returns(_orgId);
        _uow.Setup(x => x.Incidents).Returns(_incidents.Object);
        _uow.Setup(x => x.Organizations).Returns(_orgs.Object);
        _uow.Setup(x => x.AiAnalyses).Returns(_analyses.Object);
        _orgs.Setup(x => x.GetByIdAsync(_orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Organization { Id = _orgId, Plan = Plan.Team });
        // Flag on by default; the kill-switch test overrides it.
        _featureFlags.Setup(x => x.IsEnabled(It.IsAny<string>(), It.IsAny<bool>())).Returns(true);
    }

    private TriggerAiAnalysisCommandHandler CreateHandler() =>
        new(_uow.Object, _currentUser.Object, _jobRunner.Object, _featureFlags.Object);

    private Incident CreateIncident(Guid? aiAnalysisId = null) => new()
    {
        Id = Guid.NewGuid(),
        OrganizationId = _orgId,
        ProjectId = Guid.NewGuid(),
        Title = "Test incident",
        Status = IncidentStatus.Open,
        Severity = AlertSeverity.High,
        StartedAt = DateTimeOffset.UtcNow,
        AiAnalysisId = aiAnalysisId,
    };

    [Fact]
    public async Task Trigger_WhenFeatureDisabled_ThrowsAndEnqueuesNothing()
    {
        _featureFlags.Setup(x => x.IsEnabled("ai-analysis", It.IsAny<bool>())).Returns(false);
        var incident = CreateIncident();
        _incidents.Setup(x => x.GetByIdAsync(incident.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(incident);

        var act = () => CreateHandler().Handle(new TriggerAiAnalysisCommand(incident.Id), default);

        await act.Should().ThrowAsync<FeatureDisabledException>();
        _analyses.Verify(x => x.AddAsync(It.IsAny<AiAnalysis>(), It.IsAny<CancellationToken>()), Times.Never);
        _jobRunner.Verify(x => x.Enqueue(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task Trigger_LinksIncidentToNewAnalysis()
    {
        var incident = CreateIncident();
        _incidents.Setup(x => x.GetByIdAsync(incident.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(incident);

        var result = await CreateHandler()
            .Handle(new TriggerAiAnalysisCommand(incident.Id), default);

        incident.AiAnalysisId.Should().Be(result.Id);
        _analyses.Verify(x => x.AddAsync(
            It.Is<AiAnalysis>(a => a.Id == result.Id && a.IncidentId == incident.Id),
            It.IsAny<CancellationToken>()), Times.Once);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _jobRunner.Verify(x => x.Enqueue(result.Id), Times.Once);
    }

    [Theory]
    [InlineData(AiAnalysisStatus.Pending)]
    [InlineData(AiAnalysisStatus.Processing)]
    public async Task Trigger_WhileAnalysisInFlight_ReturnsExistingWithoutCreating(AiAnalysisStatus status)
    {
        var existing = new AiAnalysis
        {
            Id = Guid.NewGuid(),
            OrganizationId = _orgId,
            Status = status,
            SuggestedFixes = [],
            RelevantLogIds = [],
        };
        var incident = CreateIncident(existing.Id);
        existing.IncidentId = incident.Id;

        _incidents.Setup(x => x.GetByIdAsync(incident.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(incident);
        _analyses.Setup(x => x.GetByIdAsync(existing.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        var result = await CreateHandler()
            .Handle(new TriggerAiAnalysisCommand(incident.Id), default);

        result.Id.Should().Be(existing.Id);
        _analyses.Verify(x => x.AddAsync(It.IsAny<AiAnalysis>(), It.IsAny<CancellationToken>()), Times.Never);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        _jobRunner.Verify(x => x.Enqueue(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task Trigger_AfterCompletedAnalysis_CreatesNewAndRelinks()
    {
        var completed = new AiAnalysis
        {
            Id = Guid.NewGuid(),
            OrganizationId = _orgId,
            Status = AiAnalysisStatus.Completed,
            SuggestedFixes = [],
            RelevantLogIds = [],
        };
        var incident = CreateIncident(completed.Id);
        completed.IncidentId = incident.Id;

        _incidents.Setup(x => x.GetByIdAsync(incident.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(incident);
        _analyses.Setup(x => x.GetByIdAsync(completed.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(completed);

        var result = await CreateHandler()
            .Handle(new TriggerAiAnalysisCommand(incident.Id), default);

        result.Id.Should().NotBe(completed.Id);
        incident.AiAnalysisId.Should().Be(result.Id);
        _analyses.Verify(x => x.AddAsync(It.IsAny<AiAnalysis>(), It.IsAny<CancellationToken>()), Times.Once);
        _jobRunner.Verify(x => x.Enqueue(result.Id), Times.Once);
    }
}
