using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Mapping;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;

namespace StackSift.Application.Queries.Incidents;

public record GetSimilarIncidentsQuery(Guid IncidentId, int TopK = 5)
    : IRequest<IReadOnlyList<SimilarIncidentDto>>;

public class GetSimilarIncidentsQueryHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<GetSimilarIncidentsQuery, IReadOnlyList<SimilarIncidentDto>>
{
    public async Task<IReadOnlyList<SimilarIncidentDto>> Handle(GetSimilarIncidentsQuery request, CancellationToken ct)
    {
        var incident = await uow.Incidents.GetByIdAsync(request.IncidentId, ct)
            ?? throw new NotFoundException(nameof(Incident), request.IncidentId);

        if (incident.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Incident), request.IncidentId);

        var seed = await uow.AiAnalyses.GetByIncidentIdAsync(request.IncidentId, ct);
        if (seed?.Embedding is null || seed.Status != AiAnalysisStatus.Completed)
            return [];

        var topK = Math.Clamp(request.TopK, 1, 20);
        var matches = await uow.AiAnalyses.SearchSimilarWithDistanceAsync(
            seed.Embedding, topK, excludeId: seed.Id, ct);

        if (matches.Count == 0) return [];

        var analysisIds = matches.Select(m => m.AnalysisId).ToHashSet();
        var analyses = await uow.AiAnalyses.GetManyByIdAsync(analysisIds, ct);
        var analysesById = analyses.ToDictionary(a => a.Id);

        var incidentIds = analyses.Select(a => a.IncidentId).ToHashSet();
        var fetchedIncidents = incidentIds.Count > 0
            ? await uow.Incidents.GetManyByIdAsync(incidentIds, ct)
            : [];
        var incidentsById = fetchedIncidents.ToDictionary(i => i.Id);

        var ordered = new List<SimilarIncidentDto>(matches.Count);
        foreach (var match in matches)
        {
            if (!analysesById.TryGetValue(match.AnalysisId, out var analysis)) continue;
            if (!incidentsById.TryGetValue(analysis.IncidentId, out var sourceIncident)) continue;
            if (sourceIncident.OrganizationId != currentUser.OrganizationId) continue;
            if (sourceIncident.Id == request.IncidentId) continue;

            var score = Math.Clamp(1.0 - match.Distance, 0.0, 1.0);
            ordered.Add(new SimilarIncidentDto(sourceIncident.ToDto(), score));
        }

        return ordered;
    }
}
