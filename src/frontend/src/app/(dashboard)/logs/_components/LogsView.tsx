'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { LogFilterBar, type LogFilterState } from './LogFilterBar';
import { LogTable } from './LogTable';
import { useLogEntries, useLogAppend } from '@/app/hooks/queries/use-logs';
import { TIME_PRESETS, DEFAULT_PRESET } from '@/app/lib/time-presets';
import { useSignalRConnectionFromContext } from '@/app/hooks/useSignalRConnectionContext';
import { useSignalRStore } from '@/app/hooks/useSignalRStore';
import { useLiveProjectId } from '@/app/hooks/useLiveProjectId';
import { useProjects } from '@/app/hooks/queries/use-projects';
import { useUIStore } from '@/app/hooks/useUIStore';
import { HubConnectionState } from '@microsoft/signalr';
import { cn } from '@/app/lib/utils';
import type { IHubConnection } from '@/app/lib/signalr-mock';
import { HUB_METHOD_LOG_ENTRY } from '@/app/lib/signalr-config';
import type { LogEntry, LogLevel, LogQueryFilters } from '@/app/types';

type HubHandler = Parameters<IHubConnection['on']>[1];

function matchesFilters(entry: LogEntry, filters: LogQueryFilters): boolean {
  if (filters.levels?.length && !filters.levels.includes(entry.level)) return false;
  if (filters.level && entry.level !== filters.level) return false;
  if (filters.projectId && entry.projectId !== filters.projectId) return false;
  if (filters.logSourceId && entry.logSourceId !== filters.logSourceId) return false;
  if (filters.startDate && entry.timestamp < filters.startDate) return false;
  // endDate is intentionally not checked: presets default endDate to "now" at
  // render time, which would reject every live entry whose timestamp is later.
  // Live append shows new arrivals — the time window's upper bound is implicit.
  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildApiFilters(state: LogFilterState): LogQueryFilters {
  return {
    levels: state.levels.length > 0 ? state.levels : undefined,
    projectId: state.projectId || undefined,
    search: state.search || undefined,
    startDate: state.startDate || undefined,
    endDate: state.endDate || undefined,
  };
}

function readInitialState(searchParams: URLSearchParams): LogFilterState {
  const presetValue = searchParams.get('preset') ?? DEFAULT_PRESET.value;
  const preset = TIME_PRESETS.find((p) => p.value === presetValue) ?? DEFAULT_PRESET;
  const range = preset.getRange();

  const rawLevels = searchParams.get('levels');
  const levels: LogLevel[] = rawLevels
    ? (rawLevels.split(',').filter(Boolean) as LogLevel[])
    : [];

  return {
    presetValue,
    startDate: searchParams.get('from') ?? range.startDate ?? '',
    endDate: searchParams.get('to') ?? range.endDate ?? '',
    levels,
    projectId: searchParams.get('project') ?? '',
    search: searchParams.get('q') ?? '',
  };
}

// ---------------------------------------------------------------------------
// LogsView — client shell; owns filter state and URL sync
// ---------------------------------------------------------------------------

export function LogsView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [filterState, setFilterState] = useState<LogFilterState>(() =>
    readInitialState(searchParams),
  );

  const apiFilters = useMemo(() => buildApiFilters(filterState), [filterState]);

  // Write filter changes back to the URL so the view is bookmarkable.
  // Uses router.replace so Back button isn't polluted with every keystroke.
  const updateFilter = (updates: Partial<LogFilterState>) => {
    setFilterState((prev) => {
      const next = { ...prev, ...updates };

      const params = new URLSearchParams();
      if (next.presetValue) params.set('preset', next.presetValue);
      if (next.projectId) params.set('project', next.projectId);
      if (next.levels.length) params.set('levels', next.levels.join(','));
      if (next.search) params.set('q', next.search);

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return next;
    });
  };

  const resetFilters = () => {
    const range = DEFAULT_PRESET.getRange();
    updateFilter({
      presetValue: DEFAULT_PRESET.value,
      startDate: range.startDate ?? '',
      endDate: range.endDate ?? '',
      levels: [],
      projectId: '',
      search: '',
    });
  };

  const query = useLogEntries(apiFilters);
  const appendLog = useLogAppend(apiFilters);

  // Point the live SignalR feed at the project this page is filtered to
  // (server broadcasts per project group); cleared again on unmount so the
  // OrgSwitcher selection takes back over elsewhere in the app.
  const setLiveProjectOverride = useUIStore((s) => s.setLiveProjectOverride);
  useEffect(() => {
    setLiveProjectOverride(filterState.projectId || null);
    return () => setLiveProjectOverride(null);
  }, [filterState.projectId, setLiveProjectOverride]);

  const connection = useSignalRConnectionFromContext();
  useEffect(() => {
    if (!connection) return;
    const onLogEntry = (entry: LogEntry) => {
      if (!matchesFilters(entry, apiFilters)) return;
      appendLog(entry);
    };
    const adapter = onLogEntry as HubHandler;
    connection.on(HUB_METHOD_LOG_ENTRY, adapter);
    return () => {
      connection.off(HUB_METHOD_LOG_ENTRY, adapter);
    };
  }, [connection, appendLog, apiFilters]);

  return (
    <div className="flex flex-col gap-4">
      <LogFilterBar filterState={filterState} onUpdate={updateFilter} />
      <LiveFeedIndicator />
      <LogTable query={query} appendLog={appendLog} onResetFilters={resetFilters} />
    </div>
  );
}

// Tells the user whether new entries stream in live, and for which project —
// the answer to "why are logs not arriving in real time" should never require
// devtools.
function LiveFeedIndicator() {
  const connectionState = useSignalRStore((s) => s.connectionState);
  const liveProjectId = useLiveProjectId();
  const { data: projects } = useProjects();

  const connected = connectionState === HubConnectionState.Connected;
  const projectName = projects?.find((p) => p.id === liveProjectId)?.name ?? null;

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted" data-testid="live-feed-indicator">
      <span
        aria-hidden="true"
        className={cn(
          'inline-block h-1.5 w-1.5 rounded-full',
          connected ? 'bg-green-500' : 'bg-red-500',
        )}
      />
      {connected && projectName
        ? `Live feed: ${projectName}`
        : connected
          ? 'Live feed: no project selected'
          : 'Live feed disconnected — new entries appear on refresh'}
    </p>
  );
}
