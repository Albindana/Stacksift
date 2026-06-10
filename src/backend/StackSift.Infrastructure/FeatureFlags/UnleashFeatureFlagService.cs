using StackSift.Application.Interfaces;
using Unleash;

namespace StackSift.Infrastructure.FeatureFlags;

/// <summary>
/// Unleash-backed <see cref="IFeatureFlagService"/>. Wraps the singleton
/// <see cref="IUnleash"/> client. When Unleash isn't configured (e.g. local runs
/// without the flag server, or unit tests) <paramref name="unleash"/> is null and
/// every check fails open to the supplied default.
/// </summary>
public sealed class UnleashFeatureFlagService(IUnleash? unleash) : IFeatureFlagService, IDisposable
{
    public bool IsEnabled(string feature, bool defaultValue = true)
        => unleash?.IsEnabled(feature, defaultValue) ?? defaultValue;

    public void Dispose() => (unleash as IDisposable)?.Dispose();
}
