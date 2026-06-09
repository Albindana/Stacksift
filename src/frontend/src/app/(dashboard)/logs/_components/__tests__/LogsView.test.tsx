import { render, act } from '@testing-library/react';
import { HubConnectionState } from '@microsoft/signalr';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { LogEntry } from '@/app/types';
import type { IHubConnection } from '@/app/lib/signalr-mock';
import { SignalRConnectionContext } from '@/app/hooks/useSignalRConnectionContext';
import { HUB_METHOD_LOG_ENTRY } from '@/app/lib/signalr-config';
import { LogsView } from '../LogsView';

type HubHandler = Parameters<IHubConnection['on']>[1];

const appendLogMock = jest.fn();
const useLogEntriesMock = jest.fn();

jest.mock('@/app/hooks/queries/use-logs', () => ({
  useLogEntries: (filters: import('@/app/types').LogQueryFilters) =>
    useLogEntriesMock(filters),
  useLogAppend: () => appendLogMock,
}));

let currentSearchParams = '';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(currentSearchParams),
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/logs',
}));

interface MockConnection {
  connection: IHubConnection;
  handlers: Map<string, HubHandler>;
}

function makeMockConnection(): MockConnection {
  const handlers = new Map<string, HubHandler>();
  const connection: IHubConnection = {
    state: HubConnectionState.Connected,
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    invoke: jest.fn().mockResolvedValue(undefined),
    on: jest.fn((method: string, handler: HubHandler) => {
      handlers.set(method, handler);
    }),
    off: jest.fn((method: string) => {
      handlers.delete(method);
    }),
    onclose: jest.fn(),
    onreconnecting: jest.fn(),
    onreconnected: jest.fn(),
  };
  return { connection, handlers };
}

// Live payloads are Zod-validated at the boundary — ids must be real UUIDs.
const PROJECT_A = '00000000-0000-4000-8000-00000000000a';
const PROJECT_B = '00000000-0000-4000-8000-00000000000b';

let uuidCounter = 0;
function nextUuid(): string {
  uuidCounter += 1;
  return `00000000-0000-4000-8000-${uuidCounter.toString(16).padStart(12, '0')}`;
}

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: overrides.id ?? nextUuid(),
    projectId: overrides.projectId ?? PROJECT_A,
    logSourceId: overrides.logSourceId ?? nextUuid(),
    level: overrides.level ?? 'info',
    message: overrides.message ?? 'hello',
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    traceId: null,
    spanId: null,
    serviceName: null,
    hostName: null,
    metadata: {},
  };
}

function renderWithProviders(connection: IHubConnection | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SignalRConnectionContext.Provider value={connection}>
        {children}
      </SignalRConnectionContext.Provider>
    </QueryClientProvider>
  );
  return render(<LogsView />, { wrapper });
}

beforeEach(() => {
  appendLogMock.mockReset();
  useLogEntriesMock.mockReset();
  useLogEntriesMock.mockReturnValue({
    data: { pages: [{ data: [], nextCursor: null, hasMore: false }], pageParams: [null] },
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: jest.fn(),
  });
  currentSearchParams = '';
});

describe('LogsView — SignalR live append', () => {
  it('subscribes to ReceiveLogEntry when a connection is provided', () => {
    const mock = makeMockConnection();
    renderWithProviders(mock.connection);
    expect(mock.handlers.has(HUB_METHOD_LOG_ENTRY)).toBe(true);
  });

  it('calls appendLog for an entry matching default filters', () => {
    const mock = makeMockConnection();
    renderWithProviders(mock.connection);

    const handler = mock.handlers.get(HUB_METHOD_LOG_ENTRY);
    if (!handler) throw new Error('handler missing');

    const entry = makeEntry({ level: 'error' });
    act(() => {
      handler(entry);
    });

    expect(appendLogMock).toHaveBeenCalledWith(entry);
  });

  it('drops entries whose level is filtered out by an active filter', () => {
    currentSearchParams = 'levels=error';
    const mock = makeMockConnection();
    renderWithProviders(mock.connection);

    const handler = mock.handlers.get(HUB_METHOD_LOG_ENTRY);
    if (!handler) throw new Error('handler missing');

    const infoEntry = makeEntry({ level: 'info' });
    act(() => {
      handler(infoEntry);
    });
    expect(appendLogMock).not.toHaveBeenCalled();

    const errorEntry = makeEntry({ level: 'error' });
    act(() => {
      handler(errorEntry);
    });
    expect(appendLogMock).toHaveBeenCalledWith(errorEntry);
    expect(appendLogMock).toHaveBeenCalledTimes(1);
  });

  it('drops malformed payloads instead of poisoning the query cache', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const mock = makeMockConnection();
    renderWithProviders(mock.connection);

    const handler = mock.handlers.get(HUB_METHOD_LOG_ENTRY);
    if (!handler) throw new Error('handler missing');

    act(() => {
      // numeric level — what a backend enum-serialization drift produces
      handler({ ...makeEntry(), level: 3 });
    });

    expect(appendLogMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('drops entries whose projectId does not match the active filter', () => {
    currentSearchParams = `project=${PROJECT_A}`;
    const mock = makeMockConnection();
    renderWithProviders(mock.connection);

    const handler = mock.handlers.get(HUB_METHOD_LOG_ENTRY);
    if (!handler) throw new Error('handler missing');

    act(() => {
      handler(makeEntry({ projectId: PROJECT_B }));
    });
    expect(appendLogMock).not.toHaveBeenCalled();

    const match = makeEntry({ projectId: PROJECT_A });
    act(() => {
      handler(match);
    });
    expect(appendLogMock).toHaveBeenCalledWith(match);
  });

  it('renders without crashing when no SignalR connection is in context', () => {
    expect(() => renderWithProviders(null)).not.toThrow();
    expect(appendLogMock).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const mock = makeMockConnection();
    const { unmount } = renderWithProviders(mock.connection);
    expect(mock.handlers.has(HUB_METHOD_LOG_ENTRY)).toBe(true);
    unmount();
    expect(mock.handlers.has(HUB_METHOD_LOG_ENTRY)).toBe(false);
  });
});
