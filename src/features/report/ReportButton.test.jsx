import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders, signedInAs } from '../../test/renderWithProviders.jsx';
import { atIST } from '../../lib/time.js';
import { clearReportCache } from './reportCache.js';
import { ReportButton } from './ReportButton.jsx';

const mocks = vi.hoisted(() => ({
  getEntriesBetween: vi.fn(),
  getEntriesChangedSince: vi.fn(),
  toPng: vi.fn(),
  buildReport: vi.fn(),
  saveBlob: vi.fn(),
  reloadApp: vi.fn(),
}));

vi.mock('../../data/entries.js', () => ({
  getEntriesBetween: mocks.getEntriesBetween,
  getEntriesChangedSince: mocks.getEntriesChangedSince,
}));
vi.mock('html-to-image', () => ({ toPng: mocks.toPng }));
vi.mock('./buildReport.js', () => ({
  buildReport: mocks.buildReport,
  reportFileName: () => 'report.pdf',
}));
vi.mock('./saveFile.js', () => ({ saveBlob: mocks.saveBlob }));
vi.mock('../../lib/appUpdate.js', async (importOriginal) => ({
  ...(await importOriginal()),
  reloadApp: mocks.reloadApp,
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

function renderButton(props = {}) {
  return renderWithProviders(
    <ReportButton patient={patient} medications={meds} today={TODAY} {...props} />,
    { auth: signedInAs('family') },
  );
}

const button = () => screen.getByRole('button', { name: /download 30-day report/i });

async function downloadOnce(times) {
  fireEvent.click(button());
  await waitFor(() => expect(mocks.saveBlob).toHaveBeenCalledTimes(times));
  await waitFor(() => expect(button().disabled).toBe(false));
}

describe('ReportButton', () => {
  // The button lazy-loads the chart module (recharts); transform it up front so the
  // assertions don't depend on how fast a busy test run compiles it.
  beforeAll(async () => {
    await import('./ReportCharts.jsx');
  }, 30000);

  let builds = 0;
  beforeEach(() => {
    vi.clearAllMocks();
    clearReportCache();
    builds = 0;
    mocks.buildReport.mockImplementation(() => {
      builds += 1;
      const blob = new Blob([`%PDF build ${builds}`]);
      return { output: () => blob };
    });
    mocks.toPng.mockResolvedValue('data:image/png;base64,AAAA');
    mocks.getEntriesBetween.mockResolvedValue([vitals]);
    mocks.getEntriesChangedSince.mockResolvedValue([]);
  });

  it('loads the period, captures the charts and saves the PDF', async () => {
    renderButton();
    await downloadOnce(1);

    expect(mocks.getEntriesBetween).toHaveBeenCalledWith('p1', '2026-10-13', '2026-11-18');
    // Only the BP chart has readings, so only it is captured.
    expect(mocks.toPng).toHaveBeenCalledTimes(1);
    const [data, { charts }] = mocks.buildReport.mock.calls[0];
    expect(data.period.endKey).toBe('2026-11-18');
    expect(charts).toEqual([expect.objectContaining({ id: 'bp' })]);
    expect(mocks.saveBlob.mock.calls[0][1]).toBe('report.pdf');
    expect(await screen.findByText('Report downloaded')).toBeTruthy();
    // The off-screen charts are removed afterwards.
    expect(document.querySelector('[data-chart-id]')).toBeNull();
    // Nothing to check against on the first build.
    expect(mocks.getEntriesChangedSince).not.toHaveBeenCalled();
  });

  it('gives back the same PDF without rebuilding when nothing in the period changed', async () => {
    renderButton();
    await downloadOnce(1);
    // A new entry today does not touch the report period.
    mocks.getEntriesChangedSince.mockResolvedValue([{ dateKey: TODAY }]);
    await downloadOnce(2);

    expect(mocks.getEntriesBetween).toHaveBeenCalledTimes(1);
    expect(mocks.buildReport).toHaveBeenCalledTimes(1);
    expect(mocks.saveBlob.mock.calls[1][0]).toBe(mocks.saveBlob.mock.calls[0][0]);
    expect(mocks.getEntriesChangedSince).toHaveBeenCalledWith('p1', expect.any(Date));
    expect(await screen.findByText(/no changes since it was made/i)).toBeTruthy();
  });

  it('rebuilds when an entry in the period was added or edited since', async () => {
    renderButton();
    await downloadOnce(1);
    mocks.getEntriesChangedSince.mockResolvedValue([{ dateKey: '2026-11-18' }]);
    await downloadOnce(2);

    expect(mocks.getEntriesBetween).toHaveBeenCalledTimes(2);
    expect(mocks.buildReport).toHaveBeenCalledTimes(2);
    expect(mocks.saveBlob.mock.calls[1][0]).not.toBe(mocks.saveBlob.mock.calls[0][0]);
  });

  it('rebuilds when the prescription or ranges change', async () => {
    function Harness() {
      const [current, setCurrent] = useState(patient);
      return (
        <>
          <button
            type="button"
            onClick={() =>
              setCurrent({ ...patient, rangeOverrides: { spo2: { min: 92, max: 100 } } })
            }
          >
            Change ranges
          </button>
          <ReportButton patient={current} medications={meds} today={TODAY} />
        </>
      );
    }
    renderWithProviders(<Harness />, { auth: signedInAs('family') });
    await downloadOnce(1);
    fireEvent.click(screen.getByRole('button', { name: 'Change ranges' }));
    await downloadOnce(2);
    expect(mocks.buildReport).toHaveBeenCalledTimes(2);
    expect(mocks.getEntriesChangedSince).not.toHaveBeenCalled();
  });

  it('saves a table-only report when chart capture fails, and does not cache it', async () => {
    mocks.toPng.mockRejectedValue(new Error('canvas tainted'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderButton();
    await downloadOnce(1);
    expect(mocks.buildReport.mock.calls[0][1].charts).toEqual([]);
    expect(await screen.findByText(/without charts/i)).toBeTruthy();

    await downloadOnce(2);
    expect(mocks.buildReport).toHaveBeenCalledTimes(2);
  });

  it('shows an error toast when the data cannot be loaded', async () => {
    const { UserFacingError } = await import('../../data/errors.js');
    mocks.getEntriesBetween.mockRejectedValue(new UserFacingError('You appear to be offline.'));
    renderButton();
    fireEvent.click(button());

    expect(await screen.findByText('You appear to be offline.')).toBeTruthy();
    expect(mocks.saveBlob).not.toHaveBeenCalled();
  });

  it('offers a reload when the report code is gone after a deploy', async () => {
    mocks.getEntriesBetween.mockRejectedValue(
      new TypeError('Failed to fetch dynamically imported module: /assets/buildReport-old.js'),
    );
    renderButton();
    fireEvent.click(button());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/CarePal has been updated/);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(mocks.reloadApp).toHaveBeenCalledTimes(1);
  });
});
