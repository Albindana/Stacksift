import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockReplace = jest.fn();
const mockSearchParams = new URLSearchParams();
const mockAddToast = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/app/hooks/useSession', () => ({
  useSession: () => ({ isAuthenticated: false, isLoading: false }),
}));

jest.mock('@/app/hooks/useToastStore', () => ({
  useToastStore: () => ({ addToast: mockAddToast }),
}));

import LoginPage from '../login/page';

function renderWithQuery(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <LoginPage />
    </QueryClientProvider>,
  );
}

async function submitLogin(): Promise<void> {
  await act(async () => {
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'whatever');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  });
}

// The marketing-funnel redirect logic (`resolveNext`) used to be observable via the
// "Continue with Google" SSO link's href. That button has been removed (StackSift
// email/password is the only auth surface), so the same logic is now asserted through
// the POST-submit path — the sole remaining consumer of the resolved `next` URL.
describe('LoginPage — plan + from query params', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    for (const key of Array.from(mockSearchParams.keys())) mockSearchParams.delete(key);
    mockReplace.mockReset();
    mockAddToast.mockReset();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    }) as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('redirects to /billing/checkout when plan=indie&from=marketing-hero', async () => {
    mockSearchParams.set('plan', 'indie');
    mockSearchParams.set('from', 'marketing-hero');

    renderWithQuery();
    await submitLogin();

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/billing/checkout?plan=indie&from=marketing-hero'),
    );
  });

  it('redirects to /billing/checkout for team plan', async () => {
    mockSearchParams.set('plan', 'team');

    renderWithQuery();
    await submitLogin();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/billing/checkout?plan=team'));
  });

  it('ignores unknown plan values and falls back to root', async () => {
    mockSearchParams.set('plan', 'enterprise');

    renderWithQuery();
    await submitLogin();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('honours raw ?next= when no plan is provided', async () => {
    mockSearchParams.set('next', '/projects');

    renderWithQuery();
    await submitLogin();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/projects'));
  });

  it('rejects protocol-relative open-redirect attempts', async () => {
    mockSearchParams.set('next', '//evil.com/path');

    renderWithQuery();
    await submitLogin();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });
});
