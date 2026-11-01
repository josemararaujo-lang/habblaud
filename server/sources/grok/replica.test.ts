// Leitura da cópia local do Grok Bot: nomes das fatias, lista de agentes, conversa, status e uso (dados sintéticos).
import { describe, expect, it } from 'vitest';
import { classifySlice, decodeSliceName, encodeSliceName, grokStatus, OUTPUT_WORKING_MS, parseEntry, parseRoster, parseTranscript, parseUsage, PROMPT_WORKING_MS } from './replica';

const AGENT = '11111111-2222-4333-8444-555555555555';
const T0 = 1_790_000_000_000;
/** Token de mentira montado em partes (nenhum scanner de segredos o confunde com um de verdade). */
const FAKE_TOKEN = ['ghp', 'abcdefghijklmnopqrstuvwxyz0123456789'].join('_');

const wrap = (value: unknown) => JSON.stringify({ schemaVersion: 1, value });

describe('nomes das fatias', () => {
  it('decodifica o base32 do app e classifica lista, conversa e uso', () => {
    const roster = 'sand.client.slice.account.auth0%7Cuser_X.roster.last-roster';
    expect(decodeSliceName(encodeSliceName(roster))).toBe(roster);
    expect(classifySlice(roster)).toEqual({ kind: 'roster', account: 'auth0%7Cuser_X' });
    expect(classifySlice(`sand.client.slice.account.A.transcript.replicas.${AGENT}`)).toEqual({ kind: 'transcript', account: 'A', agentId: AGENT });
    expect(classifySlice('sand.client.slice.account.A.weekly-usage.cache')).toEqual({ kind: 'usage', account: 'A' });
  });

  it('ignora o que não é fatia do app ou que a fonte não usa', () => {
    expect(decodeSliceName('Cookies')).toBeUndefined();
    expect(decodeSliceName(encodeSliceName('outra.coisa'))).toBeUndefined();
    expect(classifySlice('sand.client.slice.first-run.device-onboarded')).toBeUndefined();
    expect(classifySlice('sand.client.slice.account.A.mcp.connect-logos')).toBeUndefined();
  });
});

describe('lista de agentes', () => {
  it('lê nome, última atividade e a marca de espera; pula grupos e removidos', () => {
    const raw = wrap({
      rows: [
        { id: AGENT, name: 'Hubness', createdAt: T0, lastActivityAt: T0 + 5, awaitingUserResponse: { at: 1 } },
        { id: 'g', name: 'Grupo', isGroup: true },
        { id: 'r', name: 'Velho', isRemovedFromSidebar: true },
        { name: 'sem id' },
      ],
    });
    expect(parseRoster(raw)).toEqual([{ id: AGENT, name: 'Hubness', createdAt: T0, lastActivityAt: T0 + 5, awaiting: true }]);
    expect(parseRoster('{')).toBeUndefined();
    expect(parseRoster(wrap({}))).toBeUndefined();
  });
});

describe('conversa', () => {
  it('mensagens do usuário e do agente viram prompt e resposta, em ordem cronológica', () => {
    const raw = wrap({
      entries: [
        { kind: 'send-message', id: 't0s0', seq: 2, timestampMs: T0 + 20, message: { type: 'text', content: 'Pronto, publiquei o site.' } },
        { kind: 'message', id: 't0u', seq: 1, role: 'user', content: 'Publica o site', timestampMs: T0 + 10 },
        { kind: 'message', id: 'x', seq: 3, role: 'assistant', content: 'Oi', toAgent: { id: 'b', name: 'Killua' }, timestampMs: T0 + 30 },
        { kind: 'desconhecido', id: 'y', timestampMs: T0 + 40 },
      ],
    });
    const entries = parseTranscript(raw)!;
    expect(entries.map((e) => [e.from, e.kind])).toEqual([
      ['user', 'prompt'],
      ['agent', 'respond'],
      ['agent', 'communicate'],
    ]);
    expect(entries[1].text).toBe('Respondeu: “Pronto, publiquei o site.”');
    expect(entries[2].text).toBe('Mensagem para Killua');
  });

  it('pergunta, pedido de comando, anexo e eventos; segredos mascarados', () => {
    const widget = parseEntry({ kind: 'send-message', id: 'w', timestampMs: T0, message: { type: 'widget', widget: { prompt: 'Qual projeto?' } } })!;
    expect(widget).toMatchObject({ kind: 'ask', asks: 'responder uma pergunta no Grok Bot' });
    const skipped = parseEntry({ kind: 'send-message', id: 'w', timestampMs: T0, widgetSkipped: true, message: { type: 'widget', widget: { prompt: 'Qual?' } } })!;
    expect(skipped.asks).toBeUndefined();
    const cmd = parseEntry({ kind: 'send-message', id: 'c', timestampMs: T0, message: { type: 'local-tool-permission', ask: { action: 'run-command', target: `export TOKEN=${FAKE_TOKEN}`, status: 'pending' } } })!;
    expect(cmd).toMatchObject({ kind: 'run', asks: 'aprovar um comando no Grok Bot' });
    expect(cmd.detail).not.toContain(FAKE_TOKEN.slice(4, 20));
    const allowed = parseEntry({ kind: 'send-message', id: 'c', timestampMs: T0, message: { type: 'local-tool-permission', ask: { target: 'ls', status: 'always' } } })!;
    expect(allowed.asks).toBeUndefined();
    expect(parseEntry({ kind: 'send-message', id: 'a', timestampMs: T0, message: { type: 'attachment', file_name: 'index.html' } })?.text).toBe('Mandou index.html');
    expect(parseEntry({ kind: 'event', id: 'e', timestampMs: T0, event: { type: 'automation-changed', action: 'created', automationName: 'Deploy' } })?.text).toBe('Criou a automação Deploy');
    expect(parseEntry({ kind: 'event', id: 'e', timestampMs: T0, event: { type: 'outro' } })).toBeUndefined();
  });
});

describe('status', () => {
  const user = (at: number) => parseEntry({ kind: 'message', id: `u${at}`, role: 'user', content: 'faz', timestampMs: at })!;
  const reply = (at: number, extra: Record<string, unknown> = {}) => parseEntry({ kind: 'message', id: `a${at}`, role: 'assistant', content: 'feito', timestampMs: at, ...extra })!;

  it('mensagem sua sem resposta: trabalhando (até PROMPT_WORKING_MS), depois à toa', () => {
    expect(grokStatus([user(T0)], undefined, T0 + 1_000).status).toBe('working');
    expect(grokStatus([user(T0)], undefined, T0 + PROMPT_WORKING_MS + 1).status).toBe('idle');
  });

  it('resposta recente ou chegando: trabalhando; resposta antiga: à toa', () => {
    expect(grokStatus([user(T0), reply(T0 + 10)], undefined, T0 + 20).status).toBe('working');
    expect(grokStatus([user(T0), reply(T0 + 10)], undefined, T0 + 10 + OUTPUT_WORKING_MS + 1).status).toBe('idle');
    expect(grokStatus([reply(T0, { isStreaming: true })], undefined, T0 + 3_600_000).status).toBe('working');
  });

  it('pergunta pendente ou a marca da lista: esperando você', () => {
    const ask = parseEntry({ kind: 'send-message', id: 'w', timestampMs: T0, message: { type: 'widget', widget: { prompt: 'Qual?' } } })!;
    expect(grokStatus([user(T0 - 10), ask], undefined, T0 + 3_600_000)).toEqual({ status: 'waiting', waitingFor: 'responder uma pergunta no Grok Bot' });
    // Respondida (mensagem sua depois): volta a trabalhar.
    expect(grokStatus([ask, user(T0 + 5)], undefined, T0 + 10).status).toBe('working');
    expect(grokStatus([], { awaiting: true }, T0)).toEqual({ status: 'waiting', waitingFor: 'responder no Grok Bot' });
    expect(grokStatus([], undefined, T0)).toEqual({ status: 'idle' });
  });
});

describe('uso', () => {
  it('lê o percentual semanal, o reinício e o plano', () => {
    const raw = JSON.stringify({ schemaVersion: 2, value: { kind: 'present', reading: { usage: { percentUsed: 11.5, nextResetMs: T0 + 9, unifiedPlanName: 'Premium' }, readAtMs: T0 } } });
    expect(parseUsage(raw)).toEqual({ percentUsed: 11.5, resetsAt: T0 + 9, readAt: T0, plan: 'Premium' });
    expect(parseUsage(JSON.stringify({ value: { kind: 'absent' } }))).toBeUndefined();
  });
});
