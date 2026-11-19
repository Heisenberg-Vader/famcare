import { afterEach, describe, expect, it, vi } from 'vitest';
import { Suspense, lazy } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LoadErrorBoundary } from './LoadErrorBoundary.jsx';

const reloadApp = vi.hoisted(() => vi.fn());
vi.mock('../lib/appUpdate.js', async (importOriginal) => ({
  ...(await importOriginal()),
  reloadApp,
}));

function renderLazy(error) {
  const Broken = lazy(() => Promise.reject(error));
  return render(
    <LoadErrorBoundary>
      <Suspense fallback={<p>Loading</p>}>
        <Broken />
      </Suspense>
    </LoadErrorBoundary>,
  );
}

describe('LoadErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('offers a reload instead of a blank screen when a chunk from an old deploy is gone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderLazy(
      new TypeError('Failed to fetch dynamically imported module: /assets/VitalsCharts-old.js'),
    );
    expect(await screen.findByText('CarePal has been updated')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reloadApp).toHaveBeenCalledTimes(1);
  });

  it('shows a generic message with Reload for other render errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Throws() {
      throw new Error('boom');
    }
    render(
      <LoadErrorBoundary>
        <Throws />
      </LoadErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/Something went wrong/);
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  });
});
