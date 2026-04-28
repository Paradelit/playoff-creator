import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  slugify,
  formatFilename,
  EXPORT_MONTHS,
  monthKeyForExport,
  sessionLabelForDate,
  fetchLogoAsDataUrl,
} from './exportUtils';

describe('slugify', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(slugify('Benjamín 2º A')).toBe('benjamin-2o-a');
  });

  it('removes accents and special characters', () => {
    expect(slugify('Niñas Cadete A')).toBe('ninas-cadete-a');
  });

  it('collapses multiple spaces and trims', () => {
    expect(slugify('  Equipo  Test  ')).toBe('equipo-test');
  });

  it('falls back to "equipo" if input is empty', () => {
    expect(slugify('')).toBe('equipo');
    expect(slugify('   ')).toBe('equipo');
  });
});

describe('formatFilename', () => {
  it('builds informe filename', () => {
    expect(formatFilename('informe', 'Benjamín 2º A', '2025-26', 'pdf')).toBe(
      'Informe-jugadores-benjamin-2o-a-2025-26.pdf',
    );
  });

  it('builds asistencia filename', () => {
    expect(formatFilename('asistencia', 'Cadete', '2025-26', 'xlsx')).toBe('Asistencia-cadete-2025-26.xlsx');
  });

  it('uses .docx extension', () => {
    expect(formatFilename('informe', 'X', '2025-26', 'docx')).toBe('Informe-jugadores-x-2025-26.docx');
  });
});

describe('EXPORT_MONTHS', () => {
  it('has 11 months from agosto to junio', () => {
    expect(EXPORT_MONTHS).toHaveLength(11);
    expect(EXPORT_MONTHS[0].key).toBe('agosto');
    expect(EXPORT_MONTHS[0].full).toBe('Agosto');
    expect(EXPORT_MONTHS[10].key).toBe('junio');
  });
});

describe('monthKeyForExport', () => {
  it('maps a date in agosto', () => {
    expect(monthKeyForExport('2025-08-15')).toBe('agosto');
  });

  it('maps a date in enero', () => {
    expect(monthKeyForExport('2026-01-15')).toBe('enero');
  });

  it('returns null for julio (out of season)', () => {
    expect(monthKeyForExport('2025-07-15')).toBe(null);
  });
});

describe('sessionLabelForDate', () => {
  it('formats a Wednesday as X-DD', () => {
    expect(sessionLabelForDate('2025-08-20')).toBe('X-20'); // 2025-08-20 is a Wednesday
  });

  it('formats a Sunday as D-DD', () => {
    expect(sessionLabelForDate('2025-08-24')).toBe('D-24'); // Sunday
  });

  it('returns null for falsy or invalid input', () => {
    expect(sessionLabelForDate(null)).toBe(null);
    expect(sessionLabelForDate('')).toBe(null);
    expect(sessionLabelForDate('not-a-date')).toBe(null);
  });
});

describe('fetchLogoAsDataUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns null for falsy input', async () => {
    expect(await fetchLogoAsDataUrl(null)).toBe(null);
    expect(await fetchLogoAsDataUrl('')).toBe(null);
    expect(await fetchLogoAsDataUrl(undefined)).toBe(null);
  });

  it('returns null when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('CORS'))),
    );
    expect(await fetchLogoAsDataUrl('https://example.com/logo.png')).toBe(null);
  });

  it('returns dataURL string when fetch succeeds', async () => {
    const fakeBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve(fakeBlob) })),
    );
    const result = await fetchLogoAsDataUrl('https://example.com/logo.png');
    expect(typeof result).toBe('string');
    expect(result.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('returns null when fetch responds non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 404 })),
    );
    expect(await fetchLogoAsDataUrl('https://example.com/missing.png')).toBe(null);
  });
});
