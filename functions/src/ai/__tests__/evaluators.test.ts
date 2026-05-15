import { describe, expect, it, vi } from 'vitest';
import { AutoEvaluator, computeDigestRichness, computeScreenSemanticScore } from '../evaluators';
import type { UserDigest } from '../digest/types';

function emptyDigest(): UserDigest {
  return {
    todayISO: '2026-05-13',
    todayLocalDayOfWeek: 'miércoles',
    workspace: { id: 'w', name: 'W', type: 'personal', userRole: 'owner' },
    teams: [],
    activeBrackets: [],
    upcomingSessions: [],
    recentPastSessions: [],
    pendingActions: { convocatorias: [], scoutings: [], analyses: [], playerReports: [] },
    preferences: {},
    memories: [],
  };
}

describe('computeDigestRichness', () => {
  it('returns 0 for fully empty digest', () => {
    expect(computeDigestRichness(emptyDigest())).toBe(0);
  });

  it('adds 0.1 per populated optional section', () => {
    const d = emptyDigest();
    d.teams = [{ id: 't1', name: 'X', memberCount: 0 }];
    expect(computeDigestRichness(d)).toBe(0.1);
  });

  it('scores 1.0 when all 10 sections populated', () => {
    const d = emptyDigest();
    d.teams = [
      {
        id: 't1',
        name: 'X',
        memberCount: 1,
        rosterSnapshot: [{ id: 'p1', nombre: 'Ana' }],
        nextSession: { id: 's1', fecha: '2026-05-15' },
        lastResult: { fecha: '2026-05-10', ourScore: 60, theirScore: 50 },
      },
    ];
    d.upcomingSessions = [{ id: 's1', fecha: '2026-05-15' }];
    d.recentPastSessions = [{ id: 's0', fecha: '2026-05-10' }];
    d.pendingActions = {
      convocatorias: [
        {
          sessionId: 's1',
          fecha: '2026-05-15',
          severity: 'normal',
          hoursUntil: 48,
        },
      ],
      scoutings: [{ sessionId: 's2', fecha: '2026-05-18' }],
      analyses: [{ sessionId: 's3', fecha: '2026-05-08' }],
      playerReports: [{ teamId: 't1', missingForPlayerCount: 3, missingPlayerNames: ['Ana', 'Bea', 'Carla'] }],
    };
    expect(computeDigestRichness(d)).toBe(1.0);
  });

  it('caps at 1.0', () => {
    const d = emptyDigest();
    d.teams = [
      {
        id: 't1',
        name: 'X',
        memberCount: 1,
        rosterSnapshot: [{ id: 'p1', nombre: 'A' }],
        nextSession: { id: 's1', fecha: '2026-05-15' },
        lastResult: { fecha: '2026-05-10', ourScore: 60, theirScore: 50 },
      },
    ];
    // Más teams enriquecidos no incrementa más allá de los 4 contribuyentes
    d.teams.push({
      id: 't2',
      name: 'Y',
      memberCount: 1,
      rosterSnapshot: [{ id: 'p2', nombre: 'B' }],
    });
    expect(computeDigestRichness(d)).toBeLessThanOrEqual(1.0);
  });
});

describe('computeScreenSemanticScore', () => {
  it('returns 0 when no semantic', () => {
    expect(computeScreenSemanticScore(null)).toBe(0);
    expect(computeScreenSemanticScore(undefined)).toBe(0);
  });

  it('returns 0.5 when semantic without referableIds', () => {
    expect(computeScreenSemanticScore({})).toBe(0.5);
    expect(computeScreenSemanticScore({ referableIds: {} })).toBe(0.5);
  });

  it('returns 1.0 when semantic with referableIds non-empty', () => {
    expect(computeScreenSemanticScore({ referableIds: { 'este equipo': 't1' } })).toBe(1.0);
  });
});

describe('AutoEvaluator.score — new sub-A.7 scores', () => {
  function makeEvaluator() {
    const logScore = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obs = { logScore } as any;
    return { evaluator: new AutoEvaluator(obs), logScore };
  }

  it('logs digest-richness when userDigest is provided', () => {
    const { evaluator, logScore } = makeEvaluator();
    evaluator.score('t1', {
      toolCalls: [],
      loopDetected: false,
      contentBlocks: [],
      userDigest: emptyDigest(),
    });
    const richness = logScore.mock.calls.find((c: unknown[]) => (c[1] as { name: string }).name === 'digest-richness');
    expect(richness).toBeDefined();
    expect((richness![1] as { value: number }).value).toBe(0);
  });

  it('does NOT log digest-richness when userDigest is missing', () => {
    const { evaluator, logScore } = makeEvaluator();
    evaluator.score('t1', { toolCalls: [], loopDetected: false, contentBlocks: [] });
    const richness = logScore.mock.calls.find((c: unknown[]) => (c[1] as { name: string }).name === 'digest-richness');
    expect(richness).toBeUndefined();
  });

  it('logs screen-semantic-score when screenSemantic field is provided (incluso null)', () => {
    const { evaluator, logScore } = makeEvaluator();
    evaluator.score('t1', {
      toolCalls: [],
      loopDetected: false,
      contentBlocks: [],
      screenSemantic: { surface: 'team-detail', referableIds: { 'este equipo': 't1' } },
    });
    const score = logScore.mock.calls.find(
      (c: unknown[]) => (c[1] as { name: string }).name === 'screen-semantic-score',
    );
    expect((score![1] as { value: number }).value).toBe(1.0);

    const { evaluator: ev2, logScore: ls2 } = makeEvaluator();
    ev2.score('t2', {
      toolCalls: [],
      loopDetected: false,
      contentBlocks: [],
      screenSemantic: null,
    });
    const score2 = ls2.mock.calls.find((c: unknown[]) => (c[1] as { name: string }).name === 'screen-semantic-score');
    expect((score2![1] as { value: number }).value).toBe(0);
  });

  it('does NOT log screen-semantic-score when screenSemantic field is missing entirely', () => {
    const { evaluator, logScore } = makeEvaluator();
    evaluator.score('t1', { toolCalls: [], loopDetected: false, contentBlocks: [] });
    const score = logScore.mock.calls.find(
      (c: unknown[]) => (c[1] as { name: string }).name === 'screen-semantic-score',
    );
    expect(score).toBeUndefined();
  });

  it('logs confirm-choice-emitted=1.0 when contentBlocks include a confirm_choice (sub-B.7)', () => {
    const { evaluator, logScore } = makeEvaluator();
    evaluator.score('t1', {
      toolCalls: [],
      loopDetected: false,
      contentBlocks: [
        {
          type: 'confirm_choice',
          prompt: '¿De qué partido?',
          candidates: [{ id: 's1', label: 'Sábado', kind: 'session' }],
          intent: 'convocatoria',
        },
      ],
    });
    const score = logScore.mock.calls.find(
      (c: unknown[]) => (c[1] as { name: string }).name === 'confirm-choice-emitted',
    );
    expect(score).toBeDefined();
    expect((score![1] as { value: number }).value).toBe(1.0);
  });

  it('does NOT log confirm-choice-emitted when no confirm_choice block', () => {
    const { evaluator, logScore } = makeEvaluator();
    evaluator.score('t1', {
      toolCalls: [],
      loopDetected: false,
      contentBlocks: [{ type: 'text', markdown: 'hola' }],
    });
    const score = logScore.mock.calls.find(
      (c: unknown[]) => (c[1] as { name: string }).name === 'confirm-choice-emitted',
    );
    expect(score).toBeUndefined();
  });
});

describe('AutoEvaluator.score — sub-C.6 update-delete-offered', () => {
  function makeEvaluator() {
    const logScore = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obs = { logScore } as any;
    return { evaluator: new AutoEvaluator(obs), logScore };
  }

  it('logs update-delete-offered=1.0 when edit intent met with update proposal', () => {
    const { evaluator, logScore } = makeEvaluator();
    evaluator.score('t1', {
      toolCalls: [],
      loopDetected: false,
      contentBlocks: [
        {
          type: 'confirm_write',
          proposal: {
            proposalId: 'p1',
            kind: 'update_training',
            summary: 'Renombrar',
            payload: { teamId: 't1', trainingId: 'tr_1', updates: { titulo: 'X' } },
          },
        },
      ],
      userMessage: 'cambia el título del entrenamiento',
    });
    const score = logScore.mock.calls.find(
      (c: unknown[]) => (c[1] as { name: string }).name === 'update-delete-offered',
    );
    expect(score).toBeDefined();
    expect((score![1] as { value: number }).value).toBe(1.0);
  });

  it('logs update-delete-offered=0.0 when edit intent but no proposal', () => {
    const { evaluator, logScore } = makeEvaluator();
    evaluator.score('t1', {
      toolCalls: [],
      loopDetected: false,
      contentBlocks: [{ type: 'text', markdown: 'No tengo ese tool todavía.' }],
      userMessage: 'borra ese entrenamiento',
    });
    const score = logScore.mock.calls.find(
      (c: unknown[]) => (c[1] as { name: string }).name === 'update-delete-offered',
    );
    expect(score).toBeDefined();
    expect((score![1] as { value: number }).value).toBe(0.0);
  });

  it('does NOT log update-delete-offered when no edit intent', () => {
    const { evaluator, logScore } = makeEvaluator();
    evaluator.score('t1', {
      toolCalls: [],
      loopDetected: false,
      contentBlocks: [{ type: 'text', markdown: 'Aquí tienes el equipo.' }],
      userMessage: 'muéstrame el equipo',
    });
    const score = logScore.mock.calls.find(
      (c: unknown[]) => (c[1] as { name: string }).name === 'update-delete-offered',
    );
    expect(score).toBeUndefined();
  });

  it('does NOT log update-delete-offered when userMessage missing', () => {
    const { evaluator, logScore } = makeEvaluator();
    evaluator.score('t1', { toolCalls: [], loopDetected: false, contentBlocks: [] });
    const score = logScore.mock.calls.find(
      (c: unknown[]) => (c[1] as { name: string }).name === 'update-delete-offered',
    );
    expect(score).toBeUndefined();
  });

  it('triggers on multiple verbs (cambia, borra, modifica, etc.)', () => {
    const verbs = ['cambia', 'edita', 'modifica', 'borra', 'elimina', 'quita', 'actualiza', 'mueve'];
    for (const verb of verbs) {
      const { evaluator, logScore } = makeEvaluator();
      evaluator.score('t', {
        toolCalls: [],
        loopDetected: false,
        contentBlocks: [{ type: 'text', markdown: 'no puedo' }],
        userMessage: `${verb} esto`,
      });
      const score = logScore.mock.calls.find(
        (c: unknown[]) => (c[1] as { name: string }).name === 'update-delete-offered',
      );
      expect(score, `verb=${verb} should trigger intent`).toBeDefined();
    }
  });
});

describe('AutoEvaluator.score — sub-C.6 convocatoria-preview-emitted', () => {
  function makeEvaluator() {
    const logScore = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obs = { logScore } as any;
    return { evaluator: new AutoEvaluator(obs), logScore };
  }

  it('logs convocatoria-preview-emitted=1.0 when block present', () => {
    const { evaluator, logScore } = makeEvaluator();
    evaluator.score('t1', {
      toolCalls: [],
      loopDetected: false,
      contentBlocks: [
        {
          type: 'convocatoria_preview',
          convocatoria: {
            sessionId: 'cal_1',
            tipo: 'partido',
            teamId: 't1',
            mensaje: 'Convocatoria sábado',
            encabezado: 'vs Hispano',
          },
        },
      ],
    });
    const score = logScore.mock.calls.find(
      (c: unknown[]) => (c[1] as { name: string }).name === 'convocatoria-preview-emitted',
    );
    expect(score).toBeDefined();
    expect((score![1] as { value: number }).value).toBe(1.0);
  });

  it('does NOT log when no convocatoria_preview block', () => {
    const { evaluator, logScore } = makeEvaluator();
    evaluator.score('t1', {
      toolCalls: [],
      loopDetected: false,
      contentBlocks: [{ type: 'text', markdown: 'hola' }],
    });
    const score = logScore.mock.calls.find(
      (c: unknown[]) => (c[1] as { name: string }).name === 'convocatoria-preview-emitted',
    );
    expect(score).toBeUndefined();
  });
});
