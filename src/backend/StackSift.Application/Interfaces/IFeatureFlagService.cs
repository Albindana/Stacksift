namespace StackSift.Application.Interfaces;

/// <summary>
/// Feature-flag evaluation seam. Implemented in Infrastructure by an Unleash
/// adapter and abstracted here so the Application layer stays free of the SDK
/// (Clean Architecture) — handlers and tests depend only on this interface.
/// </summary>
public interface IFeatureFlagService
{
    /// <summary>
    /// Whether <paramref name="feature"/> is enabled. <paramref name="defaultValue"/>
    /// is returned when the flag is unknown or the flag server is unreachable —
    /// fail-open by default, so an Unleash outage never hard-disables a feature.
    /// </summary>
    bool IsEnabled(string feature, bool defaultValue = true);
}
