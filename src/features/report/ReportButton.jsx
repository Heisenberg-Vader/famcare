import { useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Button } from '../../components/Button.jsx';
import { useToast } from '../../components/toastContext.js';
import { getEntriesBetween } from '../../data/entries.js';
import { userMessage } from '../../data/errors.js';
import { getRanges } from '../../lib/ranges.js';
import { REPORT_DAYS, buildReportData, reportPeriod } from '../../lib/reportData.js';

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
  const [printView, setPrintView] = useState(null);
  const chartsRef = useRef(null);

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const period = reportPeriod(today);
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
      const doc = buildReport(data, { charts });
      doc.save(reportFileName(data));
      toast.success(
        charts.length ? 'Report downloaded' : 'Report downloaded without charts (capture failed)',
      );
    } catch (err) {
      toast.error(userMessage(err, 'Could not create the report. Please try again.'));
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
          <span aria-hidden="true">⬇</span>
        )}
        {busy ? 'Preparing report…' : `Download ${REPORT_DAYS}-day report`}
      </Button>
      {printView &&
        createPortal(<printView.Charts ref={chartsRef} data={printView.data} />, document.body)}
    </>
  );
}
