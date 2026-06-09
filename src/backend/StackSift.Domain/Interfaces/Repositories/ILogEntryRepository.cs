using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.ValueObjects;

namespace StackSift.Domain.Interfaces.Repositories;

public interface ILogEntryRepository : IRepository<LogEntry, Guid>
{
    Task<(IList<LogEntry> Items, string? NextCursor, bool HasMore)> SearchAsync(
        LogQueryFilters filters, int limit, string? cursor, CancellationToken ct = default);
    Task BulkIndexAsync(IList<LogEntry> entries, CancellationToken ct = default);

    /// <summary>
    /// Idempotent bulk upsert into the given organisation's index. Waits for the
    /// entries to become searchable so callers can evaluate queries (e.g. alert
    /// windows) against them immediately afterwards.
    /// </summary>
    Task BulkIndexForOrgAsync(Guid organizationId, IList<LogEntry> entries, CancellationToken ct = default);

    /// <summary>
    /// Counts a project's log entries since the given instant, optionally
    /// restricted to a single level. Used for alert-rule window evaluation.
    /// </summary>
    Task<long> CountByProjectSinceAsync(
        Guid organizationId, Guid projectId, LogLevel? level, DateTimeOffset since, CancellationToken ct = default);
    Task<long> GetTotalTodayByOrganizationIdAsync(Guid organizationId, CancellationToken ct = default);
    Task DeleteOlderThanAsync(Guid organizationId, DateTimeOffset cutoff, CancellationToken ct = default);
}
