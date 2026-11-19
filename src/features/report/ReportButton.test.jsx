import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders, signedInAs } from '../../test/renderWithProviders.jsx';
import { atIST } from '../../lib/time.js';
import { ReportButton } from './ReportButton.jsx';

const mocks = vi.hoisted(() => ({
  getEntriesBetween: vi.fn(),
  toPng: vi.fn(),
  save: vi.fn(),
  buildReport: vi.fn(),
}));

vi.mock('../../data/entries.js', () => ({ getEntriesBetween: mocks.getEntriesBetween }));
vi.mock('html-to-image', () => ({ toPng: mocks.toPng }));
vi.mock('./buildReport.js', () => ({
  buildReport: mocks.buildReport,
  reportFileName: () => 'report.pdf',
}));

const TODAY = '2026-11-19';
const patient = { id: 'p1', fullName: 'Kamla Devi' };
const meds = [{ id: 'm', name: 'Metformin', times: ['09:00'], startDate: '2026-01-01' }];
const vitals = {
  type: 'vitals',
  systolic: 150,
  diastolic: 95,
  dateKey: '2026-11-10',
  at: atIST('2026-11-10', '08:00'),
};

function renderButton() {
  return renderWithProviders(<ReportButton patient={patient} medications={meds} today={TODAY} />, {
    auth: signedInAs('family'),
  });
}

describe('ReportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildReport.mockReturnValue({ save: mocks.save });
    mocks.toPng.mockResolvedValue('data:image/png;base64,AAAA');
  });

  it('loads the period, captures the charts and saves the PDF', async () => {
    mocks.getEntriesBetween.mockResolvedValue([vitals]);
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /download 30-day report/i }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('report.pdf'));
    expect(mocks.getEntriesBetween).toHaveBeenCalledWith('p1', '2026-10-13', '2026-11-18');
    // Only the BP chart has readings, so only it is captured.
    expect(mocks.toPng).toHaveBeenCalledTimes(1);
    const [data, { charts }] = mocks.buildReport.mock.calls[0];
    expect(data.period.endKey).toBe('2026-11-18');
    expect(charts).toEqual([expect.objectContaining({ id: 'bp' })]);
    expect(await screen.findByText('Report downloaded')).toBeTruthy();
    // The off-screen charts are removed afterwards.
    expect(document.querySelector('[data-chart-id]')).toBeNull();
    expect(screen.getByRole('button', { name: /download 30-day report/i }).disabled).toBe(false);
  });

  it('still saves a table-only report when chart capture fails', async () => {
    mocks.getEntriesBetween.mockResolvedValue([vitals]);
    mocks.toPng.mockRejectedValue(new Error('canvas tainted'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /download 30-day report/i }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.buildReport.mock.calls[0][1].charts).toEqual([]);
    expect(await screen.findByText(/without charts/i)).toBeTruthy();
  });

  it('shows an error toast when the data cannot be loaded', async () => {
    const { UserFacingError } = await import('../../data/errors.js');
    mocks.getEntriesBetween.mockRejectedValue(new UserFacingError('You appear to be offline.'));
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /download 30-day report/i }));

    expect(await screen.findByText('You appear to be offline.')).toBeTruthy();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
