using MediatR;
using StackSift.Application.Interfaces;

namespace StackSift.Application.Features;

/// <summary>Evaluates every known feature flag for the current request.</summary>
public record GetFeatureFlagsQuery : IRequest<FeatureFlagsDto>;

public class GetFeatureFlagsQueryHandler(IFeatureFlagService featureFlags)
    : IRequestHandler<GetFeatureFlagsQuery, FeatureFlagsDto>
{
    public Task<FeatureFlagsDto> Handle(GetFeatureFlagsQuery request, CancellationToken ct)
    {
        // Fail-open defaults (true) keep the UI working if Unleash is unreachable;
        // the backend gate is the authoritative enforcement.
        var evaluated = FeatureFlagNames.All.ToDictionary(
            name => name,
            name => featureFlags.IsEnabled(name, defaultValue: true));

        return Task.FromResult(new FeatureFlagsDto(evaluated));
    }
}
