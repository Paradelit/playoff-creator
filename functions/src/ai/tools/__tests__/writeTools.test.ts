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
