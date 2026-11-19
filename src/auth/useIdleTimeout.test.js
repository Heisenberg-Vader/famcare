import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderHook } from '@testing-library/react';
import { IDLE_TIMEOUT_MS, useIdleTimeout } from './useIdleTimeout.js';
import { markActivity } from './deviceState.js';

const MINUTE = 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-19T04:00:00Z'));
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useIdleTimeout', () => {
  it('fires once after 30 minutes without activity', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(onIdle));
    act(() => vi.advanceTimersByTime(29 * MINUTE));
    expect(onIdle).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2 * MINUTE));
    expect(onIdle).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(60 * MINUTE));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('activity resets the timer', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(onIdle));
    act(() => vi.advanceTimersByTime(20 * MINUTE));
    fireEvent.pointerDown(window);
    act(() => vi.advanceTimersByTime(20 * MINUTE));
    expect(onIdle).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(11 * MINUTE));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('fires immediately when the app reopens after a long gap', () => {
    markActivity(Date.now() - IDLE_TIMEOUT_MS - MINUTE);
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(onIdle));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('counts activity in another tab (shared through storage)', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(onIdle));
    act(() => vi.advanceTimersByTime(25 * MINUTE));
    markActivity(Date.now());
    act(() => vi.advanceTimersByTime(25 * MINUTE));
    expect(onIdle).not.toHaveBeenCalled();
  });
});
