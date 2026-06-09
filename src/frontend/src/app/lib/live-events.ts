// ---------------------------------------------------------------------------
// Live SignalR payload validation
//
// Hub payloads are an API surface like any other: they must pass the same Zod
// schemas as REST responses before entering app state. Without this boundary a
// backend serialization drift (e.g. enums as ints) renders garbage silently —
// see zhelpers/PRE-DEMO/to-fix/signalr-bugs-and-more.md (F1/F2).
// ---------------------------------------------------------------------------

import { LogEntrySchema } from '@/app/lib/api-schemas';
import type { LogEntry } from '@/app/types';

/**
 * Validates a raw ReceiveLogEntry payload. Returns null (and warns) on
 * malformed payloads so a bad event drops instead of corrupting the UI.
 */
export function parseLiveLogEntry(raw: unknown): LogEntry | null {
  const result = LogEntrySchema.safeParse(raw);
  if (!result.success) {
    console.warn(
      '[signalr] Dropping malformed ReceiveLogEntry payload:',
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
    return null;
  }
  return result.data;
}
