namespace StackSift.Domain.Exceptions;

/// <summary>Thrown when a feature gated by a feature flag is invoked while the flag is off.</summary>
public sealed class FeatureDisabledException(string message) : Exception(message);
