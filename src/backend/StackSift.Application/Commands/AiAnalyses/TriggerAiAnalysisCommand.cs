using FluentValidation;
using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Features;
using StackSift.Application.Interfaces;
using StackSift.Application.Mapping;
using StackSift.Domain;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Commands.AiAnalyses;

public record TriggerAiAnalysisCommand(Guid IncidentId) : IRequest<AiAnalysisDto>;

public class TriggerAiAnalysisCommandValidator : AbstractValidator<TriggerAiAnalysisCommand>
{
    public TriggerAiAnalysisCommandValidator()
    {
        RuleFor(x => x.IncidentId).NotEqual(Guid.Empty);
    }
}

public class TriggerAiAnalysisCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    IAiAnalysisJobRunner jobRunner,
    IFeatureFlagService featureFlags)
    : IRequestHandler<TriggerAiAnalysisCommand, AiAnalysisDto>
{
    public async Task<AiAnalysisDto> Handle(TriggerAiAnalysisCommand request, CancellationToken ct)
    {
        // Authoritative kill-switch (FS-6). Fail-open so an Unleash outage can't
        // disable AI; the flag must be explicitly OFF to block.
        if (!featureFlags.IsEnabled(FeatureFlagNames.AiAnalysis, defaultValue: true))
            throw new FeatureDisabledException("AI analysis is currently disabled.");

        var incident = await uow.Incidents.GetByIdAsync(request.IncidentId, ct)
            ?? throw new NotFoundException(nameof(Incident), request.IncidentId);

        if (incident.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Incident), request.IncidentId);

        if (incident.AiAnalysisId is { } existingId)
        {
            var existing = await uow.AiAnalyses.GetByIdAsync(existingId, ct);
            if (existing is { Status: AiAnalysisStatus.Pending or AiAnalysisStatus.Processing })
                return existing.ToDto(incident.ProjectId);
        }

        var org = await uow.Organizations.GetByIdAsync(currentUser.OrganizationId, ct);
        if (org is not null)
        {
            var limit = PlanLimits.Map[org.Plan];
            if (limit.MaxAiAnalysesPerMonth != int.MaxValue)
            {
                var periodStart = ComputePeriodStart(org);
                var used = await uow.AiAnalyses.GetCountByOrgSinceAsync(currentUser.OrganizationId, periodStart, ct);
                if (used >= limit.MaxAiAnalysesPerMonth)
                    throw new PlanLimitExceededException("AI analyses this period", limit.MaxAiAnalysesPerMonth, org.Plan);
            }
        }

        var analysis = new AiAnalysis
        {
            Id = Guid.NewGuid(),
            IncidentId = request.IncidentId,
            OrganizationId = currentUser.OrganizationId,
            Status = AiAnalysisStatus.Pending,
            SuggestedFixes = [],
            RelevantLogIds = []
        };

        await uow.AiAnalyses.AddAsync(analysis, ct);
        incident.AiAnalysisId = analysis.Id;
        await uow.SaveChangesAsync(ct);

        jobRunner.Enqueue(analysis.Id);

        return analysis.ToDto(incident.ProjectId);
    }

    private static DateTimeOffset ComputePeriodStart(Organization org)
    {
        if (org.CurrentPeriodEnd is { } periodEnd)
            return periodEnd.AddMonths(-1);

        var now = DateTimeOffset.UtcNow;
        return new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
    }
}
