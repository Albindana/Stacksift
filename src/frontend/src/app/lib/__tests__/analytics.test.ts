import { trackEvent, isAnalyticsEnabled, AnalyticsEvent } from '../analytics';
import { sendGAEvent } from '@next/third-parties/google';

// gtag must never be touched when GA is disabled — that is what keeps the
// dev/test build clean without any GA wiring.
jest.mock('@next/third-parties/google', () => ({
  sendGAEvent: jest.fn(),
}));

const mockSend = sendGAEvent as jest.MockedFunction<typeof sendGAEvent>;

describe('analytics', () => {
  const original = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    } else {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = original;
    }
    mockSend.mockClear();
  });

  it('no-ops (never calls gtag) when no measurement ID is baked in', () => {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

    expect(isAnalyticsEnabled()).toBe(false);
    trackEvent(AnalyticsEvent.SignUp, { attached_via_invitation: false });
    trackEvent(AnalyticsEvent.IncidentResolved, { incident_id: 'inc-1' });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends a GA event with the gtag signature when a measurement ID is present', () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST123';

    expect(isAnalyticsEnabled()).toBe(true);
    trackEvent(AnalyticsEvent.AiAnalysisTriggered, { incident_id: 'abc' });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith('event', 'ai_analysis_triggered', {
      incident_id: 'abc',
    });
  });
});
