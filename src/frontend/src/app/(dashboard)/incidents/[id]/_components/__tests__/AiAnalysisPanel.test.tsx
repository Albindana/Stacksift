import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiAnalysisPanel } from '../AiAnalysisPanel';
import { useFeatureFlag } from '@/app/hooks/queries/use-features';
import type { AiAnalysis } from '@/app/types';

// The panel reads the ai-analysis flag via useFeatureFlag (a useQuery hook);
// mock it so these tests need no QueryClientProvider. Defaults ON.
jest.mock('@/app/hooks/queries/use-features', () => ({
  useFeatureFlag: jest.fn(() => true),
}));
const mockUseFeatureFlag = useFeatureFlag as jest.MockedFunction<typeof useFeatureFlag>;

beforeEach(() => mockUseFeatureFlag.mockReturnValue(true));

const ANALYSIS_ID = '11111111-1111-1111-1111-111111111111';

function buildAnalysis(overrides: Partial<AiAnalysis> = {}): AiAnalysis {
  return {
    id: ANALYSIS_ID,
    incidentId: '22222222-2222-2222-2222-222222222222',
    projectId: '33333333-3333-3333-3333-333333333333',
    status: 'completed',
    summary: 'Redis ran out of memory.',
    rootCause: 'Eviction policy set to noeviction.',
    suggestedFixes: ['Set maxmemory-policy to allkeys-lru'],
    relevantLogIds: [],
    confidenceScore: 0.91,
    createdAt: '2026-05-19T00:00:00+00:00',
    completedAt: '2026-05-19T00:00:08+00:00',
    contextLogCount: 5,
    ...overrides,
  };
}

describe('AiAnalysisPanel', () => {
  it('shows the trigger button when no analysis exists', () => {
    render(
      <AiAnalysisPanel
        analysisId={null}
        aiAnalysis={undefined}
        isTriggeringAnalysis={false}
        onTrigger={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /analyze with ai/i })).toBeInTheDocument();
  });

  it('hides the trigger button and shows a disabled note when the flag is off', () => {
    mockUseFeatureFlag.mockReturnValue(false);
    render(
      <AiAnalysisPanel
        analysisId={null}
        aiAnalysis={undefined}
        isTriggeringAnalysis={false}
        onTrigger={jest.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /analyze with ai/i })).not.toBeInTheDocument();
    expect(screen.getByText(/ai analysis is currently disabled/i)).toBeInTheDocument();
  });

  it('invokes onTrigger when the button is clicked', async () => {
    const onTrigger = jest.fn();
    render(
      <AiAnalysisPanel
        analysisId={null}
        aiAnalysis={undefined}
        isTriggeringAnalysis={false}
        onTrigger={onTrigger}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /analyze with ai/i }));
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('shows the busy state while the mutation is pending', () => {
    render(
      <AiAnalysisPanel
        analysisId={null}
        aiAnalysis={undefined}
        isTriggeringAnalysis={true}
        onTrigger={jest.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /analyze with ai/i })).not.toBeInTheDocument();
    expect(screen.getByText(/results will appear automatically/i)).toBeInTheDocument();
  });

  it('stays busy when an analysisId exists but the analysis has not loaded yet', () => {
    render(
      <AiAnalysisPanel
        analysisId={ANALYSIS_ID}
        aiAnalysis={undefined}
        isTriggeringAnalysis={false}
        onTrigger={jest.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /analyze with ai/i })).not.toBeInTheDocument();
    expect(screen.getByText(/results will appear automatically/i)).toBeInTheDocument();
  });

  it('shows the busy state while the analysis is pending or processing', () => {
    const { rerender } = render(
      <AiAnalysisPanel
        analysisId={ANALYSIS_ID}
        aiAnalysis={buildAnalysis({ status: 'pending', summary: null, completedAt: null })}
        isTriggeringAnalysis={false}
        onTrigger={jest.fn()}
      />,
    );
    expect(screen.getByText(/results will appear automatically/i)).toBeInTheDocument();

    rerender(
      <AiAnalysisPanel
        analysisId={ANALYSIS_ID}
        aiAnalysis={buildAnalysis({ status: 'processing', summary: null, completedAt: null })}
        isTriggeringAnalysis={false}
        onTrigger={jest.fn()}
      />,
    );
    expect(screen.getByText(/results will appear automatically/i)).toBeInTheDocument();
  });

  it('renders summary, root cause, fixes and confidence when completed', () => {
    render(
      <AiAnalysisPanel
        analysisId={ANALYSIS_ID}
        aiAnalysis={buildAnalysis()}
        isTriggeringAnalysis={false}
        onTrigger={jest.fn()}
      />,
    );

    expect(screen.getByText('Redis ran out of memory.')).toBeInTheDocument();
    expect(screen.getByText('Eviction policy set to noeviction.')).toBeInTheDocument();
    expect(screen.getByText('Set maxmemory-policy to allkeys-lru')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
  });

  it('warns when a completed analysis ran without log context', () => {
    render(
      <AiAnalysisPanel
        analysisId={ANALYSIS_ID}
        aiAnalysis={buildAnalysis({ contextLogCount: 0 })}
        isTriggeringAnalysis={false}
        onTrigger={jest.fn()}
      />,
    );

    expect(screen.getByText(/analyzed without log context/i)).toBeInTheDocument();
  });

  it('does not warn when the analysis had log context', () => {
    render(
      <AiAnalysisPanel
        analysisId={ANALYSIS_ID}
        aiAnalysis={buildAnalysis({ contextLogCount: 12 })}
        isTriggeringAnalysis={false}
        onTrigger={jest.fn()}
      />,
    );

    expect(screen.queryByText(/analyzed without log context/i)).not.toBeInTheDocument();
  });

  it('shows the retry action when the analysis failed', async () => {
    const onTrigger = jest.fn();
    render(
      <AiAnalysisPanel
        analysisId={ANALYSIS_ID}
        aiAnalysis={buildAnalysis({ status: 'failed', summary: null, completedAt: null })}
        isTriggeringAnalysis={false}
        onTrigger={onTrigger}
      />,
    );

    expect(screen.getByText(/analysis failed/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry analysis/i }));
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });
});
