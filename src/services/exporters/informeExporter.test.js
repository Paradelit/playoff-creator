import { describe, it, expect, vi } from 'vitest';

vi.mock('./exportUtils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchLogoAsDataUrl: vi.fn(),
  };
});

vi.mock('../../utils/teamUtils', () => ({
  teamDisplayName: vi.fn((team) => team?.nombre || 'Equipo'),
}));

import { buildInformeData } from './informeExporter';
import { fetchLogoAsDataUrl } from './exportUtils';

describe('buildInformeData', () => {
  it('returns the canonical shape with all fields populated', async () => {
    fetchLogoAsDataUrl.mockResolvedValue('data:image/png;base64,XYZ');
    const team = { nombre: 'Benjamín 2º A' };
    const profile = { nombreClub: 'Mi Club', logoClub: 'http://x/logo.png' };
    const rows = [{ id: 0, ranking: '1', nombre: 'A', compromiso: 'b' }];

    const result = await buildInformeData({
      team,
      profile,
      rows,
      observaciones: 'observación',
      temporada: '2025-26',
    });

    expect(result.clubName).toBe('Mi Club');
    expect(result.teamName).toBe('Benjamín 2º A');
    expect(result.temporada).toBe('2025-26');
    expect(result.title).toBe('INFORME JUGADORES/AS 2025-26');
    expect(result.logoDataUrl).toBe('data:image/png;base64,XYZ');
    expect(result.columns).toHaveLength(8);
    expect(result.columns[0]).toEqual({ key: 'ranking', label: 'Ranking' });
    expect(result.columns[1]).toEqual({ key: 'nombre', label: 'Nombre' });
    expect(result.rows).toHaveLength(1);
    expect(result.observaciones).toBe('observación');
  });

  it('falls back to default club name when profile is empty', async () => {
    fetchLogoAsDataUrl.mockResolvedValue(null);
    const result = await buildInformeData({
      team: { nombre: 'X' },
      profile: {},
      rows: [],
      observaciones: '',
      temporada: '2025-26',
    });
    expect(result.clubName).toBe('Uros de Rivas');
    expect(result.logoDataUrl).toBe(null);
  });

  it('handles null team gracefully', async () => {
    fetchLogoAsDataUrl.mockResolvedValue(null);
    const result = await buildInformeData({
      team: null,
      profile: { nombreClub: 'Club' },
      rows: [],
      observaciones: '',
      temporada: '2025-26',
    });
    expect(result.teamName).toBe('Equipo');
  });

  it('coerces row values to empty strings', async () => {
    fetchLogoAsDataUrl.mockResolvedValue(null);
    const result = await buildInformeData({
      team: { nombre: 'X' },
      profile: {},
      rows: [{ id: 0, ranking: null, nombre: undefined, compromiso: 'ok' }],
      observaciones: '',
      temporada: '2025-26',
    });
    expect(result.rows[0].ranking).toBe('');
    expect(result.rows[0].nombre).toBe('');
    expect(result.rows[0].compromiso).toBe('ok');
  });
});
