namespace StackSift.Application.Features;

/// <summary>The set of known feature flags and whether each is currently enabled.</summary>
public record FeatureFlagsDto(IReadOnlyDictionary<string, bool> Flags);
