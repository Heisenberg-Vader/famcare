import { describe, expect, it } from 'vitest';
import { buildReportData } from '../../lib/reportData.js';
import { atIST } from '../../lib/time.js';
import { buildReport, pdfText, reportFileName } from './buildReport.js';

const TODAY = '2026-11-19';
const meds = [
  { id: 'm', name: 'Metformin', strength: '500 mg', times: ['09:00'], startDate: '2026-01-01' },
];
const entries = [
  {
    type: 'vitals',
    systolic: 160,
    diastolic: 95,
    dateKey: '2026-11-10',
    at: atIST('2026-11-10', '08:00'),
  },
  {
    type: 'medication',
    medicationId: 'm',
    medicationName: 'Metformin',
    scheduledTime: '09:00',
    status: 'refused',
    reason: 'Spat out the tablet',
    dateKey: '2026-11-10',
    at: atIST('2026-11-10', '09:10'),
  },
  {
    type: 'observation',
    severity: 'concern',
    text: 'Seemed confused — called family 🙏',
    dateKey: '2026-11-11',
    at: atIST('2026-11-11', '10:00'),
  },
];

const data = buildReportData({
  patient: { fullName: 'Kamla Devi', dob: '1948-03-02', conditions: ['Hypertension'] },
  medications: meds,
  entries,
  today: TODAY,
  now: atIST(TODAY, '15:00'),
});

// Uncompressed PDF text operators are "(text) Tj" with ( ) and \ escaped.
const textOf = (doc) => doc.output().replace(/\\([()\\])/g, '$1');

describe('pdfText', () => {
  it('keeps Latin-1 and maps other characters the PDF fonts cannot draw', () => {
    expect(pdfText('90–140 · ¾ · 98.6°F')).toBe('90-140 · ¾ · 98.6°F');
    expect(pdfText('⚠ High → ok')).toBe('! High flat ok');
    expect(pdfText('Seemed confused — called family 🙏')).toBe('Seemed confused - called family');
    expect(pdfText(null)).toBe('');
  });
});

describe('buildReport', () => {
  it('names the file after the patient and period', () => {
    expect(reportFileName(data)).toBe('CarePal-report-Kamla-Devi-2026-10-20-to-2026-11-18.pdf');
  });

  it('writes every section and the disclaimer on each page', () => {
    const doc = buildReport(data, { compress: false });
    const text = textOf(doc);
    for (const section of [
      'Kamla Devi',
      'Summary for the period',
      'Vitals',
      'Medicine adherence by medicine',
      'Out-of-range readings (2)',
      'Missed, refused, held and unrecorded doses (30)',
      'Nurse observations marked "concern" (1)',
      'Daily log',
      'Spat out the tablet',
      'Seemed confused - called family',
      '20 Oct 2026 to 18 Nov 2026',
    ]) {
      expect(text).toContain(section);
    }
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThan(1);
    // Drawn text only (the document's Subject metadata repeats it once).
    const disclaimers = text.match(
      /\(Compiled from caregiver logs\. Not a diagnostic document\.\) Tj/g,
    );
    expect(disclaimers).toHaveLength(pages);
    expect(text).toContain(`page ${pages} of ${pages}`);
  });

  it('places chart images when given', () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const doc = buildReport(data, {
      compress: false,
      charts: [{ id: 'bp', dataUrl: png, width: 720, height: 220 }],
    });
    expect(textOf(doc)).toContain('Vitals charts');
    expect(textOf(doc)).toMatch(/\/Subtype \/Image/);
  });
});
