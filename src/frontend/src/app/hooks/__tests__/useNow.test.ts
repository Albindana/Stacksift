/**
 * Tests for the useNow hook — drives ticking relative timestamps.
 */

import { renderHook, act } from '@testing-library/react';
import { useNow } from '../useNow';

describe('useNow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the current time on first render', () => {
    const before = Date.now();
    const { result } = renderHook(() => useNow());
    expect(result.current).toBeGreaterThanOrEqual(before);
  });

  it('updates on each interval tick', () => {
    const { result } = renderHook(() => useNow(1_000));
    const first = result.current;

    act(() => {
      jest.advanceTimersByTime(3_000);
    });

    expect(result.current).toBeGreaterThanOrEqual(first + 3_000);
  });

  it('clears the interval on unmount', () => {
    const clearSpy = jest.spyOn(global, 'clearInterval');
    const { unmount } = renderHook(() => useNow(1_000));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
