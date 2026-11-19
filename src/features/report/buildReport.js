// Builds the 30-day PDF from buildReportData() output and optional chart images.
// Loaded on demand (dynamic import) so jsPDF stays out of the main bundle.
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { RANGES_DISCLAIMER } from '../../lib/ranges.js';
import { REPORT_DISCLAIMER } from '../../lib/reportData.js';
import { formatDateKey, formatIST } from '../../lib/time.js';

const PAGE = { margin: 14, footer: 16 };
const INK = [15, 23, 42];
const MUTED = [100, 116, 139];
const BRAND = [36, 116, 102];
const CRITICAL = [176, 40, 40];
const AMBER = [154, 82, 0];
const FLAG_TEXT = { high: 'High', low: 'Low', change: 'Big change' };

const ASCII = {
  '–': '-',
  '—': '-',
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '…': '...',
  '≥': '>=',
  '≤': '<=',
  '⚠': '!',
  '↑': 'up',
  '↓': 'down',
  '→': 'flat',
  ' ': ' ',
};

/**
 * The built-in PDF fonts only cover Latin-1, so other characters would print as garbage.
 * Maps common punctuation to ASCII and drops anything else (for example emoji).
 */
export function pdfText(value) {
  if (value == null) return '';
  return String(value)
    .replace(/[^\x20-\xff]/g, (ch) => ASCII[ch] ?? (/\s/.test(ch) ? ' ' : ''))
    .replace(/ {2,}/g, ' ')
    .trim();
}

const pct = (p) => (p == null ? '-' : `${p}%`);
const day = (dateKey) => formatDateKey(dateKey, 'EEE d MMM');
const when = (at) => formatIST(at, 'd MMM, h:mm a');
const ARROW_WORD = { up: 'improving', down: 'declining', flat: 'steady' };

export function reportFileName(data) {
  const name = pdfText(data.patient.fullName).replace(/[^A-Za-z0-9]+/g, '-') || 'patient';
  return `CarePal-report-${name}-${data.period.startKey}-to-${data.period.endKey}.pdf`;
}

/** Returns a jsPDF document. charts: [{ id, dataUrl, width, height }] (pixel size). */
export function buildReport(data, { charts = [], compress = true } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - PAGE.margin * 2;
  const bottom = pageH - PAGE.footer;
  let y = PAGE.margin;

  const ensure = (height) => {
    if (y + height > bottom) {
      doc.addPage();
      y = PAGE.margin;
    }
  };

  const heading = (text) => {
    ensure(16);
    y += 4;
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(12)
      .setTextColor(...BRAND);
    doc.text(pdfText(text), PAGE.margin, y);
    y += 2;
    doc
      .setDrawColor(...BRAND)
      .setLineWidth(0.3)
      .line(PAGE.margin, y, pageW - PAGE.margin, y);
    y += 3;
  };

  const note = (text) => {
    doc
      .setFont('helvetica', 'normal')
      .setFontSize(9)
      .setTextColor(...MUTED);
    const lines = doc.splitTextToSize(pdfText(text), contentW);
    ensure(lines.length * 4 + 1);
    doc.text(lines, PAGE.margin, y + 3);
    y += lines.length * 4 + 1;
  };

  const table = (opts) => {
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE.margin, right: PAGE.margin, top: PAGE.margin, bottom: PAGE.footer },
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        cellPadding: 1.6,
        textColor: INK,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        overflow: 'linebreak',
      },
      headStyles: { fillColor: [241, 245, 249], textColor: INK, fontStyle: 'bold' },
      ...opts,
      head: opts.head?.map((r) => r.map(pdfText)),
      body: opts.body.map((r) => r.map((c) => (typeof c === 'object' ? c : pdfText(c)))),
    });
    y = doc.lastAutoTable.finalY + 2;
  };

  const p = data.patient;
  const s = data.summary;

  // Header
  doc
    .setFont('helvetica', 'bold')
    .setFontSize(9)
    .setTextColor(...BRAND);
  doc.text('CarePal Daily Care', PAGE.margin, y + 3);
  doc.setFont('helvetica', 'normal').setTextColor(...MUTED);
  doc.text(
    pdfText(`Generated ${formatIST(data.generatedAt, 'd MMM yyyy, h:mm a')} IST`),
    pageW - PAGE.margin,
    y + 3,
    { align: 'right' },
  );
  y += 11;
  doc
    .setFont('helvetica', 'bold')
    .setFontSize(18)
    .setTextColor(...INK);
  doc.text(pdfText(p.fullName), PAGE.margin, y);
  y += 6;
  doc
    .setFont('helvetica', 'normal')
    .setFontSize(10)
    .setTextColor(...INK);
  const facts = [p.age != null ? `${p.age} years` : null, p.gender, p.city].filter(Boolean);
  doc.text(pdfText(facts.join(', ')), PAGE.margin, y);
  y += 5;
  const details = [
    ['Conditions', p.conditions.join(', ')],
    ['Doctor', p.primaryDoctor],
    ['Nurses', p.nurses.join(', ')],
    [
      'Report period',
      `${formatDateKey(data.period.startKey, 'd MMM yyyy')} to ${formatDateKey(data.period.endKey, 'd MMM yyyy')} (${data.period.dateKeys.length} full days, times in IST)`,
    ],
  ].filter(([, v]) => v);
  for (const [k, v] of details) {
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(9)
      .setTextColor(...MUTED);
    doc.text(pdfText(k), PAGE.margin, y);
    doc.setFont('helvetica', 'normal').setTextColor(...INK);
    const lines = doc.splitTextToSize(pdfText(v), contentW - 28);
    doc.text(lines, PAGE.margin + 28, y);
    y += lines.length * 4.2;
  }

  // Summary
  heading('Summary for the period');
  const a = s.adherence;
  table({
    head: [['Measure', 'Result', 'Detail']],
    columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' }, 1: { cellWidth: 30 } },
    body: [
      [
        'Medicine adherence',
        pct(a.percent),
        `${a.given} of ${a.expected} due doses given. ${a.notRecorded} not recorded; ${a.missed} missed, ${a.refused} refused, ${a.held} held.`,
      ],
      [
        'Meals completed',
        pct(s.meals.percent),
        `${s.meals.completed} of ${s.meals.expected} main meals mostly eaten (3/4 or more).`,
      ],
      ['Activity', `${s.activity.total} min`, `Average ${s.activity.averagePerDay} min per day.`],
      [
        'Mood',
        s.mood.average == null ? '-' : `${s.mood.average} / 5`,
        s.mood.direction
          ? `Second half of the period vs first half: ${ARROW_WORD[s.mood.direction]}.`
          : 'Not enough mood entries for a trend.',
      ],
      ['Water', `${s.water.averageMl} ml/day`, `${s.water.totalMl} ml in total.`],
    ],
  });

  // Vitals table
  heading('Vitals');
  const flagged = (n) =>
    n ? { content: String(n), styles: { textColor: CRITICAL, fontStyle: 'bold' } } : '0';
  table({
    head: [['Metric', 'Normal', 'Readings', 'Min', 'Max', 'Average', 'Out of range']],
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    body: data.charts.flatMap(({ metric, stats }) =>
      stats.length === 0
        ? [[metric.title, '', '0', '-', '-', '-', '-']]
        : stats.map((st) => [
            `${stats.length > 1 || metric.series.length > 1 ? `${metric.title}: ${st.label}` : metric.title} (${metric.unit})`,
            st.normal || (metric.id === 'weightKg' ? 'change > 2 kg / 7 days' : ''),
            String(st.count),
            String(st.min),
            String(st.max),
            String(st.average),
            flagged(st.outOfRange),
          ]),
    ),
  });
  note(`${RANGES_DISCLAIMER} Bands use this patient's configured ranges.`);

  // Charts
  if (charts.length) {
    heading('Vitals charts');
    note('Shaded areas are the normal bands. Red dots are out-of-range readings.');
    for (const c of charts) {
      const h = (contentW * c.height) / c.width;
      ensure(h + 2);
      doc.addImage(c.dataUrl, 'PNG', PAGE.margin, y, contentW, h, c.id, 'FAST');
      y += h + 3;
    }
  }

  // Adherence per medicine
  heading('Medicine adherence by medicine');
  table({
    head: [
      ['Medicine', 'Times', 'Given', 'Due', 'Adherence', 'Missed / refused / held', 'Not recorded'],
    ],
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    body: data.perMedication.map((m) => [
      `${[m.medicationName, m.strength].filter(Boolean).join(' ')}${m.endDate && m.endDate <= data.period.endKey ? ` (ended ${formatDateKey(m.endDate, 'd MMM')})` : ''}`,
      m.times.join(', '),
      String(m.given),
      String(m.expected),
      pct(m.percent),
      `${m.missed} / ${m.refused} / ${m.held}`,
      String(m.notRecorded),
    ]),
  });

  // Out-of-range readings
  heading(`Out-of-range readings (${data.outOfRange.length})`);
  if (data.outOfRange.length === 0) note('No readings outside the normal bands.');
  else
    table({
      head: [['When', 'Reading', 'Value', 'Normal', 'Flag']],
      body: data.outOfRange.map((r) => [
        when(r.at),
        r.metric,
        r.value,
        r.normal,
        {
          content: pdfText(`${FLAG_TEXT[r.flag]}${r.note ? ` (${r.note})` : ''}`),
          styles: { textColor: CRITICAL, fontStyle: 'bold' },
        },
      ]),
    });

  // Dose problems
  heading(`Missed, refused, held and unrecorded doses (${data.doseIssues.length})`);
  if (data.doseIssues.length === 0) note('Every due dose was recorded as given.');
  else
    table({
      head: [['Date', 'Scheduled', 'Medicine', 'Status', 'Reason', 'Recorded by']],
      body: data.doseIssues.map((d) => [
        day(d.dateKey),
        d.scheduledTime,
        d.medication,
        { content: pdfText(d.statusText), styles: { textColor: AMBER, fontStyle: 'bold' } },
        d.status === 'not_recorded' ? 'No entry 2 h after the scheduled time' : d.reason,
        d.recordedBy,
      ]),
    });

  // Concerns
  heading(`Nurse observations marked "concern" (${data.concerns.length})`);
  if (data.concerns.length === 0) note('No observations were marked as a concern.');
  else
    table({
      head: [['When', 'Observation', 'Nurse']],
      columnStyles: { 0: { cellWidth: 30 }, 2: { cellWidth: 32 } },
      body: data.concerns.map((c) => [when(c.at), c.text, c.nurseName]),
    });

  // Daily log
  heading('Daily log');
  note(
    'Doses: given / due. Meals: best portion for Breakfast, Lunch, Snack, Dinner. Mood: daily average out of 5.',
  );
  table({
    head: [['Date', 'Doses', 'Meals', 'Water', 'Activity', 'Mood', 'Vitals', 'Notes']],
    styles: { fontSize: 8, cellPadding: 1.2 },
    columnStyles: {
      1: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
    body: data.daily.map((d) => [
      day(d.dateKey),
      d.dosesOk ? d.doses : { content: d.doses, styles: { textColor: AMBER, fontStyle: 'bold' } },
      d.meals,
      `${d.waterMl} ml`,
      `${d.activityMin} min`,
      d.moodText,
      d.vitalsFlagged
        ? {
            content: `${d.vitals} (${d.vitalsFlagged} out of range)`,
            styles: { textColor: CRITICAL, fontStyle: 'bold' },
          }
        : String(d.vitals),
      d.concerns ? `${d.notes} (${d.concerns} concern)` : String(d.notes),
    ]),
  });

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    const fy = pageH - 9;
    doc
      .setDrawColor(226, 232, 240)
      .setLineWidth(0.2)
      .line(PAGE.margin, fy - 4, pageW - PAGE.margin, fy - 4);
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(8)
      .setTextColor(...INK);
    doc.text(REPORT_DISCLAIMER, PAGE.margin, fy);
    doc.setFont('helvetica', 'normal').setTextColor(...MUTED);
    doc.text(pdfText(`${p.fullName} - page ${i} of ${pages}`), pageW - PAGE.margin, fy, {
      align: 'right',
    });
    doc.text(pdfText(RANGES_DISCLAIMER), PAGE.margin, fy + 4);
  }

  doc.setProperties({
    title: pdfText(`Care report: ${p.fullName}`),
    subject: REPORT_DISCLAIMER,
    creator: 'CarePal Daily Care',
  });
  return doc;
}
