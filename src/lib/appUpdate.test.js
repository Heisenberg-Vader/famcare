import { afterEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError, reloadApp } from './appUpdate.js';

describe('isChunkLoadError', () => {
  it('recognises failed lazy-chunk loads in each browser', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://x/assets/MetricPlot-abc.js',
      'error loading dynamically imported module: https://x/assets/a.js',
      'Importing a module script failed.',
      'Unable to preload CSS for /assets/FamilyHome-x.css',
    ]) {
      expect(isChunkLoadError(new TypeError(message))).toBe(true);
    }
    expect(isChunkLoadError(new Error('permission-denied'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('reloadApp', () => {
  const original = navigator.serviceWorker;
  afterEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', { value: original, configurable: true });
    vi.useRealTimers();
  });

  function fakeServiceWorker(reg) {
    const listeners = new Set();
    const sw = {
      getRegistration: vi.fn().mockResolvedValue(reg),
      addEventListener: (_type, fn) => listeners.add(fn),
      removeEventListener: (_type, fn) => listeners.delete(fn),
      fire: () => [...listeners].forEach((fn) => fn()),
    };
    Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
    return sw;
  }

  it('waits for a newly installed service worker to take over, then reloads', async () => {
    const reg = { installing: null, waiting: null };
    reg.update = vi.fn(async () => {
      reg.installing = {};
    });
    const sw = fakeServiceWorker(reg);
    const location = { reload: vi.fn() };

    const done = reloadApp({ location });
    await vi.waitFor(() => expect(reg.update).toHaveBeenCalled());
    await Promise.resolve();
    expect(location.reload).not.toHaveBeenCalled();
    sw.fire();
    await done;
    expect(location.reload).toHaveBeenCalledTimes(1);
  });

  it('reloads after the timeout if the new worker never takes over', async () => {
    vi.useFakeTimers();
    const reg = { installing: {}, waiting: null, update: vi.fn().mockResolvedValue() };
    fakeServiceWorker(reg);
    const location = { reload: vi.fn() };
    const done = reloadApp({ location, timeoutMs: 4000 });
    await vi.advanceTimersByTimeAsync(4000);
    await done;
    expect(location.reload).toHaveBeenCalledTimes(1);
  });

  it('still reloads when the update check fails (offline)', async () => {
    fakeServiceWorker({ update: vi.fn().mockRejectedValue(new Error('offline')) });
    const location = { reload: vi.fn() };
    await reloadApp({ location });
    expect(location.reload).toHaveBeenCalledTimes(1);
  });
});
