import { describe, it, expect, vi } from 'vitest';
import { OrchestratorAgent, renderScreenInfo } from '../agents/orchestratorAgent';
import { ToolRegistry, ToolDefinition } from '../tools/registry';
import { createNavigationTools } from '../tools/navigationTools';
import type { GenerateWithToolsRequest, GenerateWithToolsResult, GeminiPart } from '../llmProvider';
import type { UserDigest } from '../userDigest';
import type { CompiledPrompt } from '../promptManager';

// ── Mocks ────────────────────────────────────────────────────────────────────

class FakeObservability {
  // Spy so tests can assert which scores were emitted (sub-A.0 baseline).
  logScore = vi.fn();
  createSpan() {
    return { id: 'span' };
  }
  endSpan() {
    /* no-op */
  }
  logGeneration() {
    /* no-op */
  }
  async flush() {
    /* no-op */
  }
}

class FakePromptManager {
  async compile(_name: string, variables: Record<string, string>): Promise<CompiledPrompt> {
    // Return a simple concatenation of all variable values as the prompt text
    return {
      text: Object.values(variables).join('\n'),
      promptName: _name,
      promptVersion: 0,
    };
  }
}

/**
 * Fake LLMProvider whose generateWithTools returns a pre-scripted
 * sequence of parts per call — lets us drive the tool loop deterministically.
 */
class FakeLLMProvider {
  private callIndex = 0;
  constructor(private script: GeminiPart[][]) {}
  async generateWithTools(_req: GenerateWithToolsRequest): Promise<GenerateWithToolsResult> {
    const parts = this.script[this.callIndex] || [{ text: 'fin' }];
    this.callIndex += 1;
    return {
      parts,
      finishReason: 'STOP',
      model: 'fake',
      latencyMs: 1,
    };
  }
}

const EMPTY_DIGEST: UserDigest = {
  todayISO: '2026-04-16',
  todayLocalDayOfWeek: 'jueves',
  workspace: { id: 'ws1', name: 'Test workspace', type: 'personal', userRole: 'owner' },
  teams: [],
  activeBrackets: [],
  upcomingSessions: [],
  recentPastSessions: [],
  pendingActions: { convocatorias: [], scoutings: [], analyses: [], playerReports: [] },
  preferences: {},
  memories: [],
};

function makeOrchestrator(
  tool: ToolDefinition,
  script: GeminiPart[][]
): { orchestrator: OrchestratorAgent; observability: FakeObservability } {
  const registry = new ToolRegistry();
  registry.register(tool);
  const observability = new FakeObservability();
  const orchestrator = new OrchestratorAgent({
    llmProvider: new FakeLLMProvider(script) as unknown as ConstructorParameters<
      typeof OrchestratorAgent
    >[0]['llmProvider'],
    observability: observability as unknown as ConstructorParameters<
      typeof OrchestratorAgent
    >[0]['observability'],
    toolRegistry: registry,
    promptManager: new FakePromptManager() as unknown as ConstructorParameters<
      typeof OrchestratorAgent
    >[0]['promptManager'],
  });
  return { orchestrator, observability };
}

const EMPTY_TOOL_CTX = {
  db: {} as unknown as FirebaseFirestore.Firestore,
  userId: 'u1',
  wsId: 'ws1',
  appId: 'app1',
};

const TRACE_CTX = { trace: { id: 'trace-test' } };
const AGENT_OPTS = { userId: 'u1' };

// ── Scenarios ────────────────────────────────────────────────────────────────

describe('OrchestratorAgent smoke tests', () => {
  it('read-only tool emits team_list block + text', async () => {
    const tool: ToolDefinition = {
      name: 'list_teams',
      description: 'List teams',
      parameters: { type: 'object', properties: {} },
      renderAs: 'team_list',
      handler: async () => ({
        teams: [
          { id: 't1', name: 'Cadete A', categoria: 'cadete', memberCount: 12 },
          { id: 't2', name: 'Infantil', categoria: 'infantil', memberCount: 10 },
        ],
      }),
    };

    const { orchestrator } = makeOrchestrator(tool, [
      [{ functionCall: { name: 'list_teams', args: {} } }],
      [{ text: 'Tienes 2 equipos.' }],
    ]);

    const res = await orchestrator.run(
      { userMessage: 'lista mis equipos', userDigest: EMPTY_DIGEST },
      EMPTY_TOOL_CTX,
      TRACE_CTX,
      AGENT_OPTS
    );

    const types = res.blocks.map((b) => b.type);
    expect(types).toContain('team_list');
    expect(types).toContain('text');
    const teamList = res.blocks.find((b) => b.type === 'team_list');
    expect(teamList && teamList.type === 'team_list' && teamList.teams).toHaveLength(2);
    expect(res.traceId).toBe('trace-test');
  });

  it('write-proposal tool emits confirm_write block (no execution)', async () => {
    const tool: ToolDefinition = {
      name: 'propose_create_training',
      description: 'propose training',
      isWrite: true,
      parameters: { type: 'object', properties: {} },
      handler: async () => ({
        kind: 'create_training',
        teamId: 't1',
        training: { title: 'Sesión prueba' },
        summary: 'Crear entrenamiento de 60 min para Cadete A',
      }),
    };

    const { orchestrator } = makeOrchestrator(tool, [
      [{ functionCall: { name: 'propose_create_training', args: {} } }],
      [{ text: 'Propuesta preparada.' }],
    ]);

    const res = await orchestrator.run(
      { userMessage: 'crea un entrenamiento', userDigest: EMPTY_DIGEST },
      EMPTY_TOOL_CTX,
      TRACE_CTX,
      AGENT_OPTS
    );

    const confirm = res.blocks.find((b) => b.type === 'confirm_write');
    expect(confirm).toBeDefined();
    if (confirm && confirm.type === 'confirm_write') {
      expect(confirm.proposal.kind).toBe('create_training');
      expect(confirm.proposal.summary).toContain('entrenamiento');
      expect(confirm.proposal.proposalId).toMatch(/^p_/);
    }
  });

  it('agent wrapper with renderAs=training_preview emits rich block', async () => {
    const tool: ToolDefinition = {
      name: 'run_training_generator',
      description: 'generate training',
      parameters: { type: 'object', properties: {} },
      renderAs: 'training_preview',
      handler: async () => ({
        title: 'Sesión defensiva',
        totalDuration: 75,
        warmup: { title: 'Movilidad', duration: 10 },
        mainBlocks: [{ title: 'Bloqueo directo', duration: 25 }],
        cooldown: { title: 'Estiramientos', duration: 5 },
      }),
    };

    const { orchestrator } = makeOrchestrator(tool, [
      [{ functionCall: { name: 'run_training_generator', args: {} } }],
      [{ text: 'Listo.' }],
    ]);

    const res = await orchestrator.run(
      { userMessage: 'genera un entrenamiento defensivo', userDigest: EMPTY_DIGEST },
      EMPTY_TOOL_CTX,
      TRACE_CTX,
      AGENT_OPTS
    );

    const preview = res.blocks.find((b) => b.type === 'training_preview');
    expect(preview).toBeDefined();
    if (preview && preview.type === 'training_preview') {
      expect(preview.training.title).toBe('Sesión defensiva');
      expect(preview.training.totalDuration).toBe(75);
    }
  });

  it('suggest_navigation adds client actions', async () => {
    const navTool = createNavigationTools()[0];
    const { orchestrator } = makeOrchestrator(navTool, [
      [{ functionCall: { name: 'suggest_navigation', args: { target: 'calendar' } } }],
      [{ text: 'Aquí tienes el acceso al calendario.' }],
    ]);

    const res = await orchestrator.run(
      { userMessage: 'llévame al calendario', userDigest: EMPTY_DIGEST },
      EMPTY_TOOL_CTX,
      TRACE_CTX,
      AGENT_OPTS
    );

    expect(res.actions).toBeDefined();
    expect(res.actions?.[0]).toMatchObject({
      type: 'navigate',
      path: '/area-privada/calendar',
    });
  });

  it('returns a fallback text block when nothing else is emitted', async () => {
    const tool: ToolDefinition = {
      name: 'noop',
      description: 'noop',
      parameters: { type: 'object', properties: {} },
      handler: async () => ({}),
    };

    const { orchestrator } = makeOrchestrator(tool, [[]]);

    const res = await orchestrator.run(
      { userMessage: 'hola', userDigest: EMPTY_DIGEST },
      EMPTY_TOOL_CTX,
      TRACE_CTX,
      AGENT_OPTS
    );

    expect(res.blocks.length).toBeGreaterThan(0);
    expect(res.blocks.some((b) => b.type === 'text')).toBe(true);
  });

  it('logs fallback_message_emitted=1 when only a safety-block text is emitted (sub-A.0)', async () => {
    const tool: ToolDefinition = {
      name: 'noop',
      description: 'noop',
      parameters: { type: 'object', properties: {} },
      handler: async () => ({}),
    };

    // LLM returns zero parts → orchestrator's safety block emits "He terminado."
    const { orchestrator, observability } = makeOrchestrator(tool, [[]]);

    await orchestrator.run(
      { userMessage: 'hola', userDigest: EMPTY_DIGEST },
      EMPTY_TOOL_CTX,
      TRACE_CTX,
      AGENT_OPTS
    );

    const calls = observability.logScore.mock.calls;
    const names = calls.map((c: unknown[]) => (c[1] as { name: string }).name);
    expect(names).toContain('fallback_message_emitted');
    const fallbackCall = calls.find(
      (c: unknown[]) => (c[1] as { name: string }).name === 'fallback_message_emitted'
    );
    expect((fallbackCall?.[1] as { value: number }).value).toBe(1);
  });

  it('does NOT log fallback_message_emitted when meaningful blocks are emitted', async () => {
    const tool: ToolDefinition = {
      name: 'list_teams',
      description: 'List teams',
      parameters: { type: 'object', properties: {} },
      renderAs: 'team_list',
      handler: async () => ({
        teams: [{ id: 't1', name: 'Cadete A', categoria: 'cadete', memberCount: 12 }],
      }),
    };

    const { orchestrator, observability } = makeOrchestrator(tool, [
      [{ functionCall: { name: 'list_teams', args: {} } }],
      [{ text: 'Tienes 1 equipo.' }],
    ]);

    await orchestrator.run(
      { userMessage: 'lista mis equipos', userDigest: EMPTY_DIGEST },
      EMPTY_TOOL_CTX,
      TRACE_CTX,
      AGENT_OPTS
    );

    const calls = observability.logScore.mock.calls;
    const names = calls.map((c: unknown[]) => (c[1] as { name: string }).name);
    expect(names).not.toContain('fallback_message_emitted');
  });

  it('renderScreenInfo prefers semantic.label when present (sub-A.5 infra)', () => {
    const screen = {
      screen: 'TeamDetailScreen',
      route: '/teams/t1',
      params: { teamId: 't1' },
      entityType: 'team',
      entityId: 't1',
      semantic: {
        surface: 'team-detail',
        label: 'Visualizando equipo Juniors B, 12 jugadores. Próximo: sábado vs Hispano.',
        referableIds: {
          'este equipo': 't1',
          'este partido': 's-next',
        },
      },
    };
    const rendered = renderScreenInfo(screen);
    expect(rendered).toContain('team-detail');
    expect(rendered).toContain('Juniors B');
    expect(rendered).toContain('"este equipo" → t1');
    expect(rendered).toContain('"este partido" → s-next');
    // Cuando hay semantic, NO debería incluir el render bruto.
    expect(rendered).not.toContain('ruta: /teams/t1');
  });

  it('renderScreenInfo falls back to raw screen+route+entityId when semantic is absent', () => {
    const screen = {
      screen: 'TeamDetailScreen',
      route: '/teams/t1',
      params: { teamId: 't1' },
      entityType: 'team',
      entityId: 't1',
    };
    const rendered = renderScreenInfo(screen);
    expect(rendered).toContain('TeamDetailScreen');
    expect(rendered).toContain('/teams/t1');
    expect(rendered).toContain('id=t1');
  });

  it('renderScreenInfo handles semantic without referableIds', () => {
    const screen = {
      screen: 'CalendarScreen',
      route: '/calendar',
      params: {},
      semantic: {
        surface: 'calendar',
        label: 'Vista semanal del calendario',
      },
    };
    const rendered = renderScreenInfo(screen);
    expect(rendered).toContain('Vista semanal del calendario');
    expect(rendered).not.toContain('Referencias resolubles');
  });

  it('captures tool errors without crashing the loop', async () => {
    const tool: ToolDefinition = {
      name: 'failing_tool',
      description: 'fails always',
      parameters: { type: 'object', properties: {} },
      handler: async () => {
        throw new Error('boom');
      },
    };

    const { orchestrator } = makeOrchestrator(tool, [
      [{ functionCall: { name: 'failing_tool', args: {} } }],
      [{ text: 'No pude completar la acción.' }],
    ]);

    const res = await orchestrator.run(
      { userMessage: 'ejecuta', userDigest: EMPTY_DIGEST },
      EMPTY_TOOL_CTX,
      TRACE_CTX,
      AGENT_OPTS
    );

    expect(res.blocks.some((b) => b.type === 'text')).toBe(true);
  });
});
