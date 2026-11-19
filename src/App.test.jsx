import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App.jsx';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App routing', () => {
  it('redirects / to the login page', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'CarePal Daily Care' })).toBeTruthy();
  });

  it('shows not found for unknown paths', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });
});
