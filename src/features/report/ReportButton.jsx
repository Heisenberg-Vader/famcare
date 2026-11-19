import { useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Icon } from '../../components/Icon.jsx';
import { Button } from '../../components/Button.jsx';
import { useToast } from '../../components/toastContext.js';
import { getEntriesBetween, getEntriesChangedSince } from '../../data/entries.js';
import { userMessage } from '../../data/errors.js';
import { isChunkLoadError, reloadApp } from '../../lib/appUpdate.js';
import { getRanges } from '../../lib/ranges.js';
import { REPORT_DAYS, buildReportData, reportPeriod } from '../../lib/reportData.js';

import {
  affectsReport,
  dropCachedReport,
  getCachedReport,
  putCachedReport,
  reportKey,
} from './reportCache.js';
import { saveBlob } from './saveFile.js';

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

/** PNG captures of the off-screen chart figures; [] if capture fails. */
async function captureCharts(container) {
  if (!container) return [];
  try {
    const { toPng } = await import('html-to-image');
    const figures = [...container.querySelectorAll('[data-chart-id]')];
    const images = [];
    for (const node of figures) {
      const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff' });
      images.push({
        id: node.dataset.chartId,
        dataUrl,
        width: node.offsetWidth,
        height: node.offsetHeight,
      });
    }
    return images;
  } catch (err) {
    console.warn('Chart capture failed; the report will have tables only.', err);
    return [];
  }
}

/** "Download 30-day report": loads the period, draws the charts off screen, saves a PDF. */
export function ReportButton({ patient, medications, today }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [printView, setPrintView] = useState(null);
  const chartsRef = useRef(null);

  /** The cached PDF if nothing in its period has been added or edited since; else null. */
  async function reusable(key) {
    const cached = getCachedReport(patient.id, key);
    if (!cached) return null;
    const changed = await getEntriesChangedSince(patient.id, cached.checkFrom);
    if (!affectsReport(cached, changed)) return cached;
    dropCachedReport(patient.id);
    return null;
  }

  async function build(period, key) {
    const readStartedAt = new Date();
    // The PDF and chart code is loaded on demand to keep it out of the main bundle.
    const [entries, { buildReport, reportFileName }, { ReportCharts }] = await Promise.all([
      getEntriesBetween(patient.id, period.fetchStartKey, period.endKey),
      import('./buildReport.js'),
      import('./ReportCharts.jsx'),
    ]);
    const data = buildReportData({
      patient,
      medications,
      entries,
      today,
      now: new Date(),
      ranges: getRanges(patient),
    });
    flushSync(() => setPrintView({ Charts: ReportCharts, data }));
    await nextFrame();
    const charts = await captureCharts(chartsRef.current);
    const blob = buildReport(data, { charts }).output('blob');
    const fileName = reportFileName(data);
    // A table-only fallback is not cached, so the next press tries the charts again.
    if (charts.length) {
      putCachedReport(patient.id, { key, period, readStartedAt, blob, fileName });
    }
    return { blob, fileName, withCharts: charts.length > 0 };
  }

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const period = reportPeriod(today);
      const key = reportKey({ period, patient, medications });
      const cached = await reusable(key);
      if (cached) {
        saveBlob(cached.blob, cached.fileName);
        toast.success('Report downloaded (no changes since it was made)');
        return;
      }
      const report = await build(period, key);
      saveBlob(report.blob, report.fileName);
      toast.success(
        report.withCharts
          ? 'Report downloaded'
          : 'Report downloaded without charts (capture failed)',
      );
    } catch (err) {
      if (isChunkLoadError(err)) setNeedsReload(true);
      else toast.error(userMessage(err, 'Could not create the report. Please try again.'));
    } finally {
      setPrintView(null);
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={download}
        disabled={busy}
        aria-busy={busy}
        className="w-full sm:w-auto"
      >
        {busy ? (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600"
            aria-hidden="true"
          />
        ) : (
          <Icon name="download" size={18} />
        )}
        {busy ? 'Preparing report…' : `Download ${REPORT_DAYS}-day report`}
      </Button>
      {printView &&
        createPortal(<printView.Charts ref={chartsRef} data={printView.data} />, document.body)}
      {needsReload && (
        <div
          role="alert"
          className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <span className="flex-1">
            {navigator.onLine === false
              ? 'You are offline. The report needs a connection.'
              : 'CarePal has been updated. Reload to download the report.'}
          </span>
          <Button variant="secondary" onClick={() => reloadApp()} className="min-h-9 px-3">
            <Icon name="refresh" size={16} />
            Reload
          </Button>
        </div>
      )}
    </>
  );
}
