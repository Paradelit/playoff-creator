import { describe, expect, it } from 'vitest';
import { createWriteTools } from '../writeTools';
import type { ToolContext, ToolDefinition } from '../registry';
import type { Firestore } from 'firebase-admin/firestore';

// Write tool handlers don't touch Firestore — they validate args and return
// a proposal payload. The actual write happens client-side in proposalExecutor.ts
// after user confirmation. So tests here are pure input/output assertions.

const APP_ID = 'test-app';
const WS_ID = 'ws-1';
const USER_ID = 'user-1';

function buildCtx(defaults: ToolContext['defaults'] = {}): ToolContext {
  return {
    db: undefined as unknown as Firestore,
    appId: APP_ID,
    wsId: WS_ID,
    userId: USER_ID,
    defaults,
  };
}

function findTool(name: string): ToolDefinition {
  const tool = createWriteTools().find((t) => t.name === name);
  if (!tool) throw new Error(`Tool not found in registry: ${name}`);
  return tool;
}

describe('writeTools — propose_mark_convocatoria_sent (sub-C.1)', () => {
  it('returns mark_convocatoria_sent kind with sessionId + summary', async () => {
    const result = await findTool('propose_mark_convocatoria_sent').handler(
      { sessionId: 'cal_123', summary: 'Marcada convocatoria de sábado' },
      buildCtx(),
    );
    expect(result).toEqual({
      kind: 'mark_convocatoria_sent',
      sessionId: 'cal_123',
      summary: 'Marcada convocatoria de sábado',
    });
  });

  it('accepts virtual playoff sessionId', async () => {
    const result = await findTool('propose_mark_convocatoria_sent').handler(
      { sessionId: 'playoff-br1-R1-M0-0', summary: 'Marcada convocatoria playoff' },
      buildCtx(),
    );
    expect(result).toMatchObject({
      kind: 'mark_convocatoria_sent',
      sessionId: 'playoff-br1-R1-M0-0',
    });
  });

  it('returns error if sessionId is missing', async () => {
    const result = await findTool('propose_mark_convocatoria_sent').handler(
      { summary: 'x' },
      buildCtx(),
    );
    expect(result).toEqual({ error: expect.stringContaining('sessionId') });
  });

  it('returns error if sessionId is empty string', async () => {
    const result = await findTool('propose_mark_convocatoria_sent').handler(
      { sessionId: '', summary: 'x' },
      buildCtx(),
    );
    expect(result).toEqual({ error: expect.stringContaining('sessionId') });
  });
});

describe('writeTools — propose_update_training (sub-C.2)', () => {
  it('returns update_training kind with teamId, trainingId, updates', async () => {
    const result = await findTool('propose_update_training').handler(
      { teamId: 't1', trainingId: 'tr_1', updates: { titulo: 'Nuevo título' }, summary: 'Renombrar' },
      buildCtx(),
    );
    expect(result).toEqual({
      kind: 'update_training',
      teamId: 't1',
      trainingId: 'tr_1',
      updates: { titulo: 'Nuevo título' },
      summary: 'Renombrar',
    });
  });

  it('uses screen context teamId when args.teamId missing', async () => {
    const result = await findTool('propose_update_training').handler(
      { trainingId: 'tr_1', updates: { titulo: 'X' }, summary: 's' },
      buildCtx({ teamId: 't-ctx' }),
    );
    expect((result as { teamId: string }).teamId).toBe('t-ctx');
  });

  it('returns error if trainingId missing', async () => {
    const result = await findTool('propose_update_training').handler(
      { teamId: 't1', updates: { titulo: 'X' }, summary: 's' },
      buildCtx(),
    );
    expect(result).toEqual({ error: expect.stringContaining('trainingId') });
  });

  it('returns error if updates is empty', async () => {
    const result = await findTool('propose_update_training').handler(
      { teamId: 't1', trainingId: 'tr_1', updates: {}, summary: 's' },
      buildCtx(),
    );
    expect(result).toEqual({ error: expect.stringContaining('updates') });
  });
});

describe('writeTools — propose_delete_training (sub-C.2)', () => {
  it('returns delete_training kind', async () => {
    const result = await findTool('propose_delete_training').handler(
      { teamId: 't1', trainingId: 'tr_1', summary: 'Borrar entreno del martes' },
      buildCtx(),
    );
    expect(result).toEqual({
      kind: 'delete_training',
      teamId: 't1',
      trainingId: 'tr_1',
      summary: 'Borrar entreno del martes',
    });
  });

  it('returns error if summary missing (destructive)', async () => {
    const result = await findTool('propose_delete_training').handler(
      { teamId: 't1', trainingId: 'tr_1' },
      buildCtx(),
    );
    expect(result).toEqual({ error: expect.stringContaining('summary') });
  });
});

describe('writeTools — propose_update_calendar_session (sub-C.3)', () => {
  it('returns update_calendar_session kind', async () => {
    const result = await findTool('propose_update_calendar_session').handler(
      { sessionId: 'cal_1', updates: { horaInicio: '19:30' }, summary: 'Mover a 19:30' },
      buildCtx(),
    );
    expect(result).toEqual({
      kind: 'update_calendar_session',
      sessionId: 'cal_1',
      updates: { horaInicio: '19:30' },
      summary: 'Mover a 19:30',
    });
  });

  it('rejects virtual playoff sessionIds', async () => {
    const result = await findTool('propose_update_calendar_session').handler(
      { sessionId: 'playoff-br1-R1-M0-0', updates: { horaInicio: '20:00' }, summary: 's' },
      buildCtx(),
    );
    expect(result).toEqual({ error: expect.stringContaining('playoff') });
  });

  it('returns error if updates empty', async () => {
    const result = await findTool('propose_update_calendar_session').handler(
      { sessionId: 'cal_1', updates: {}, summary: 's' },
      buildCtx(),
    );
    expect(result).toEqual({ error: expect.stringContaining('updates') });
  });
});

describe('writeTools — propose_delete_calendar_session (sub-C.3)', () => {
  it('returns delete_calendar_session kind', async () => {
    const result = await findTool('propose_delete_calendar_session').handler(
      { sessionId: 'cal_1', summary: 'Borrar entreno duplicado del martes' },
      buildCtx(),
    );
    expect(result).toEqual({
      kind: 'delete_calendar_session',
      sessionId: 'cal_1',
      summary: 'Borrar entreno duplicado del martes',
    });
  });

  it('rejects playoff virtual sessionIds', async () => {
    const result = await findTool('propose_delete_calendar_session').handler(
      { sessionId: 'playoff-br1-R1-M0-0', summary: 's' },
      buildCtx(),
    );
    expect(result).toEqual({ error: expect.stringContaining('playoff') });
  });

  it('returns error if summary missing', async () => {
    const result = await findTool('propose_delete_calendar_session').handler(
      { sessionId: 'cal_1' },
      buildCtx(),
    );
    expect(result).toEqual({ error: expect.stringContaining('summary') });
  });
});

describe('writeTools — propose_update_exercise (sub-C.4)', () => {
  it('returns update_exercise kind', async () => {
    const result = await findTool('propose_update_exercise').handler(
      { exerciseId: 'ex_1', updates: { nivel: 'avanzado' }, summary: 'Subir nivel' },
      buildCtx(),
    );
    expect(result).toEqual({
      kind: 'update_exercise',
      exerciseId: 'ex_1',
      updates: { nivel: 'avanzado' },
      summary: 'Subir nivel',
    });
  });

  it('returns error if exerciseId missing', async () => {
    const result = await findTool('propose_update_exercise').handler(
      { updates: { nivel: 'x' }, summary: 's' },
      buildCtx(),
    );
    expect(result).toEqual({ error: expect.stringContaining('exerciseId') });
  });

  it('returns error if updates empty', async () => {
    const result = await findTool('propose_update_exercise').handler(
      { exerciseId: 'ex_1', updates: {}, summary: 's' },
      buildCtx(),
    );
    expect(result).toEqual({ error: expect.stringContaining('updates') });
  });
});

describe('writeTools — propose_delete_exercise (sub-C.4)', () => {
  it('returns delete_exercise kind', async () => {
    const result = await findTool('propose_delete_exercise').handler(
      { exerciseId: 'ex_1', summary: 'Borrar duplicado' },
      buildCtx(),
    );
    expect(result).toMatchObject({ kind: 'delete_exercise', exerciseId: 'ex_1' });
  });

  it('returns error if summary missing', async () => {
    const result = await findTool('propose_delete_exercise').handler(
      { exerciseId: 'ex_1' },
      buildCtx(),
    );
    expect(result).toEqual({ error: expect.stringContaining('summary') });
  });
});

describe('writeTools — propose_delete_exercises (sub-C.4 bulk)', () => {
  it('returns delete_exercises kind with array of IDs', async () => {
    const result = await findTool('propose_delete_exercises').handler(
      { exerciseIds: ['ex_1', 'ex_2'], summary: 'Borrar batería duplicada' },
      buildCtx(),
    );
    expect(result).toMatchObject({ kind: 'delete_exercises', exerciseIds: ['ex_1', 'ex_2'] });
  });

  it('rejects empty array', async () => {
    const result = await findTool('propose_delete_exercises').handler(
      { exerciseIds: [], summary: 's' },
      buildCtx(),
    );
    expect(result).toEqual({ error: expect.stringContaining('vacío') });
  });

  it('filters non-string IDs', async () => {
    const result = await findTool('propose_delete_exercises').handler(
      { exerciseIds: ['ex_1', 42, '', 'ex_2'], summary: 's' },
      buildCtx(),
    );
    expect((result as { exerciseIds: string[] }).exerciseIds).toEqual(['ex_1', 'ex_2']);
  });
});

describe('writeTools — propose_delete_bracket (sub-C.5)', () => {
  it('returns delete_bracket kind', async () => {
    const result = await findTool('propose_delete_bracket').handler(
      { bracketId: 'br_1', summary: 'Borrar bracket cerrado' },
      buildCtx(),
    );
    expect(result).toMatchObject({ kind: 'delete_bracket', bracketId: 'br_1' });
  });

  it('uses screen context bracketId when args.bracketId missing', async () => {
    const result = await findTool('propose_delete_bracket').handler(
      { summary: 'Borrar este bracket' },
      buildCtx({ bracketId: 'br-ctx' }),
    );
    expect((result as { bracketId: string }).bracketId).toBe('br-ctx');
  });

  it('returns error if no bracketId resolvable', async () => {
    const result = await findTool('propose_delete_bracket').handler(
      { summary: 's' },
      buildCtx(),
    );
    expect(result).toEqual({ error: expect.stringContaining('bracketId') });
  });

  it('returns error if summary missing', async () => {
    const result = await findTool('propose_delete_bracket').handler(
      { bracketId: 'br_1' },
      buildCtx(),
    );
    expect(result).toEqual({ error: expect.stringContaining('summary') });
  });
});
