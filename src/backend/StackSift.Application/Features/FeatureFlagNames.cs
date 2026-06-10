namespace StackSift.Application.Features;

/// <summary>
/// Canonical feature-flag names. Keep in sync with the flags defined in the
/// Unleash project and documented in docs/feature-flags.md. `All` is the set
/// surfaced to the SPA via GET /api/v1/features.
/// </summary>
public static class FeatureFlagNames
{
    /// <summary>Kill-switch for the "Analyze with AI" capability (FS-6 / M5.6).</summary>
    public const string AiAnalysis = "ai-analysis";

    public static readonly IReadOnlyList<string> All = [AiAnalysis];
}
