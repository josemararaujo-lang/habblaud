// Cópia local do Grok Bot (app desktop da xAI, feito pela Anysphere): o que a fonte do Grok lê, sem tocar em nada.
//
// Os agentes do Grok Bot rodam na nuvem; o app guarda no Mac uma réplica do que mostra, em
// `~/Library/Application Support/Grok Bot/sand-client-persistence/`, um arquivo `<nome>.blob` (JSON) por fatia. O
// nome é a chave da fatia em base32 minúsculo sem `=` (ex.: `sand.client.slice.account.<conta>.roster.last-roster`).
// Fatias usadas (todas `{schemaVersion, value}`):
// - `account.<conta>.roster.last-roster`: `value.rows`, um por agente (id, nome, lastActivityAt, awaitingUserResponse);
// - `account.<conta>.transcript.replicas.<agente>`: `value.entries`, a conversa (mensagens do usuário e do agente,
//   perguntas, anexos, pedidos de comando no Mac, eventos);
// - `account.<conta>.weekly-usage.cache`: o uso semanal do plano (`value.reading.usage.percentUsed`).
// Nunca lê `sand-secrets.json`, cookies nem o resto da pasta do app. Formatos desconhecidos = ignorados.
//
// Puro (sem estado): os parsers recebem o texto do arquivo e devolvem dados validados (testado em replica.test.ts).
import type { ActivityKind, AgentStatus } from '../../../shared/types';
import { describePrompt, maskSecrets, truncate, type ActivityDescription } from '../../../shared/activity';
import { tr } from '../../../shared/i18n';

/** Pasta das fatias dentro da pasta do app. */
export const PERSISTENCE_DIR = 'sand-client-persistence';
const SLICE_PREFIX = 'sand.client.slice.';

/** Última mensagem do usuário sem resposta há menos que isto: o agente está trabalhando nela. */
export const PROMPT_WORKING_MS = 10 * 60_000;
/** O agente mandou algo há menos que isto: ainda no meio do turno (o Grok manda várias mensagens por turno). */
export const OUTPUT_WORKING_MS = 60_000;

const MAX_TEXT = 46;
const MAX_DETAIL = 300;

type Rec = Record<string, unknown>;

function rec(v: unknown): Rec | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

// ------------------------------------------------------------------ nomes das fatias

const B32 = 'abcdefghijklmnopqrstuvwxyz234567';

/** Nome do arquivo (sem `.blob`) -> chave da fatia; undefined se não for base32 de uma fatia do app. */
export function decodeSliceName(file: string): string | undefined {
  const name = file.endsWith('.blob') ? file.slice(0, -5) : file;
  if (!name || name.length > 1_000) return undefined;
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of name) {
    const i = B32.indexOf(ch);
    if (i < 0) return undefined;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const key = Buffer.from(bytes).toString('utf8');
  return key.startsWith(SLICE_PREFIX) ? key : undefined;
}

/** Chave da fatia -> nome do arquivo (o inverso de decodeSliceName; testes). */
export function encodeSliceName(key: string): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of Buffer.from(key, 'utf8')) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return `${out}.blob`;
}

/** O que uma fatia é para a fonte do Grok. */
export type SliceRef =
  | { kind: 'roster'; account: string }
  | { kind: 'transcript'; account: string; agentId: string }
  | { kind: 'usage'; account: string };

/** Classifica a chave de uma fatia (as que a fonte não usa = undefined). */
export function classifySlice(key: string): SliceRef | undefined {
  const m = /^sand\.client\.slice\.account\.([^.]+)\.(.+)$/.exec(key);
  if (!m) return undefined;
  const [, account, rest] = m;
  if (rest === 'roster.last-roster') return { kind: 'roster', account };
  if (rest === 'weekly-usage.cache') return { kind: 'usage', account };
  const t = /^transcript\.replicas\.([0-9a-f-]{8,64})$/i.exec(rest);
  return t ? { kind: 'transcript', account, agentId: t[1] } : undefined;
}

function valueOf(raw: string): Rec | undefined {
  try {
    return rec(rec(JSON.parse(raw))?.value);
  } catch {
    return undefined;
  }
}

// ------------------------------------------------------------------ lista de agentes

export interface RosterAgent {
  id: string;
  name: string;
  createdAt?: number;
  /** Última atividade conhecida do agente (epoch ms). */
  lastActivityAt?: number;
  /** O app marcou o agente como esperando uma resposta sua. */
  awaiting: boolean;
}

export function parseRoster(raw: string): RosterAgent[] | undefined {
  const rows = valueOf(raw)?.rows;
  if (!Array.isArray(rows)) return undefined;
  const out: RosterAgent[] = [];
  for (const r of rows) {
    const row = rec(r);
    const id = str(row?.id);
    if (!row || !id || row.isRemovedFromSidebar === true || row.isGroup === true) continue;
    const a: RosterAgent = { id, name: str(row.name) ?? 'Grok', awaiting: !!row.awaitingUserResponse };
    const created = num(row.createdAt);
    if (created !== undefined) a.createdAt = created;
    const last = num(row.lastActivityAt) ?? num(row.updatedAt);
    if (last !== undefined) a.lastActivityAt = last;
    out.push(a);
  }
  return out;
}

// ------------------------------------------------------------------ conversa

/** Uma entrada da conversa, já validada e reduzida ao que o escritório usa. */
export interface GrokEntry {
  /** Único na conversa (id da entrada + seq). */
  key: string;
  at: number;
  /** Quem fez: o usuário (ou outro agente falando com este), o agente, ou um evento do app. */
  from: 'user' | 'agent' | 'event';
  kind: ActivityKind;
  icon: string;
  text: string;
  detail?: string;
  /** A entrada pede algo a você e ainda não foi respondida/pulada (pergunta, comando esperando aprovação). */
  asks?: string;
  /** Mensagem ainda chegando (o agente está escrevendo). */
  streaming?: boolean;
}

function desc(kind: ActivityKind, icon: string, text: string, detail?: string): ActivityDescription {
  const d: ActivityDescription = { kind, icon, text: truncate(maskSecrets(text), MAX_TEXT) };
  const det = detail ? truncate(maskSecrets(detail), MAX_DETAIL) : '';
  if (det) d.detail = det;
  return d;
}

/** Trecho de um texto para caber entre aspas no balão (o resto vai no detalhe). */
function snippet(text: string): string {
  return truncate(maskSecrets(text), 32);
}

/** Status de um pedido de comando no Mac que ainda espera a sua decisão. */
const PENDING_ASK = new Set(['pending', 'asking', 'requested', 'waiting']);

/** Uma entrada crua da conversa -> GrokEntry (undefined = formato desconhecido ou nada a mostrar). */
export function parseEntry(raw: unknown): GrokEntry | undefined {
  const e = rec(raw);
  const at = num(e?.timestampMs);
  const kind = str(e?.kind);
  if (!e || at === undefined || !kind) return undefined;
  const key = `${str(e.id) ?? kind}:${num(e.seq) ?? at}`;
  const make = (from: GrokEntry['from'], d: ActivityDescription, extra: Partial<GrokEntry> = {}): GrokEntry => ({ key, at, from, ...d, ...extra });

  if (kind === 'message') {
    const content = typeof e.content === 'string' ? e.content : '';
    const streaming = e.isStreaming === true;
    if (e.role === 'user') {
      const other = str(rec(e.fromAgent)?.name);
      if (other) return make('user', desc('communicate', '📨', tr('Mensagem de {0}', [other]), content));
      return make('user', describePrompt(content));
    }
    if (e.role === 'assistant') {
      const other = str(rec(e.toAgent)?.name);
      if (other) return make('agent', desc('communicate', '📤', tr('Mensagem para {0}', [other]), content), { streaming });
      return make('agent', desc('respond', '💬', tr('Respondeu: “{0}”', [snippet(content)]), content), { streaming });
    }
    return undefined;
  }

  if (kind === 'send-message') {
    const m = rec(e.message);
    switch (str(m?.type)) {
      case 'text': {
        const content = typeof m?.content === 'string' ? m.content : '';
        return make('agent', desc('respond', '💬', tr('Respondeu: “{0}”', [snippet(content)]), content));
      }
      case 'widget': {
        const prompt = str(rec(m?.widget)?.prompt) ?? '';
        const d = desc('ask', '❓', prompt ? tr('Perguntou: “{0}”', [snippet(prompt)]) : tr('Fez uma pergunta'), prompt);
        return make('agent', d, e.widgetSkipped === true ? {} : { asks: tr('responder uma pergunta no Grok Bot') });
      }
      case 'attachment': {
        const file = str(m?.file_name) ?? str(m?.alt) ?? tr('arquivo');
        return make('agent', desc('write', '📎', tr('Mandou {0}', [file]), str(m?.source_path)));
      }
      case 'connector': {
        const name = str(m?.connector) ?? tr('um app');
        return make('agent', desc('mcp', '🔌', tr('Pediu para conectar {0}', [name])));
      }
      case 'local-tool-permission': {
        const ask = rec(m?.ask);
        const target = str(ask?.target);
        const status = str(ask?.status)?.toLowerCase();
        const d = desc('run', '⌨️', tr('Comando no seu Mac'), target);
        return make('agent', d, status && PENDING_ASK.has(status) ? { asks: tr('aprovar um comando no Grok Bot') } : {});
      }
      default:
        return undefined;
    }
  }

  if (kind === 'user-attachment') {
    const file = str(e.file_name) ?? tr('arquivo');
    return make('user', desc('read', '🖼️', tr('Recebeu {0}', [file])));
  }

  if (kind === 'event') {
    const ev = rec(e.event);
    const type = str(ev?.type);
    if (type === 'automation-changed') {
      const name = str(ev?.automationName) ?? str(ev?.automationId) ?? '';
      const action = str(ev?.action);
      const text = action === 'deleted' ? tr('Apagou a automação {0}', [name]) : action === 'created' ? tr('Criou a automação {0}', [name]) : tr('Mudou a automação {0}', [name]);
      return make('event', desc('plan', '⏰', text, name));
    }
    if (type === 'name-changed') {
      const to = str(ev?.to);
      return to ? make('event', desc('other', '🏷️', tr('Passou a se chamar {0}', [to]))) : undefined;
    }
    return undefined;
  }
  return undefined;
}

/** Texto da réplica de uma conversa -> entradas em ordem cronológica (undefined = arquivo inválido). */
export function parseTranscript(raw: string): GrokEntry[] | undefined {
  const entries = valueOf(raw)?.entries;
  if (!Array.isArray(entries)) return undefined;
  const out: GrokEntry[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const p = parseEntry(e);
    if (!p || seen.has(p.key)) continue;
    seen.add(p.key);
    out.push(p);
  }
  // Estável: entradas com o mesmo horário ficam na ordem do arquivo.
  return out.map((p, i) => ({ p, i })).sort((a, b) => a.p.at - b.p.at || a.i - b.i).map((x) => x.p);
}

// ------------------------------------------------------------------ status

export interface GrokStatus {
  status: Exclude<AgentStatus, 'offline' | 'done' | 'shell'>;
  waitingFor?: string;
}

/**
 * Status de um agente pela conversa (e pela marca da lista): a réplica não diz se o agente está rodando, então:
 * - esperando você: a lista marca `awaitingUserResponse`, ou a última coisa que ele fez foi uma pergunta (não pulada)
 *   ou um pedido de comando no Mac ainda sem decisão, sem nada seu depois;
 * - trabalhando: mensagem ainda chegando; sua última mensagem sem resposta há menos de PROMPT_WORKING_MS; ou ele
 *   mandou algo há menos de OUTPUT_WORKING_MS (o turno manda várias mensagens);
 * - senão, à toa.
 */
export function grokStatus(entries: readonly GrokEntry[], agent: Pick<RosterAgent, 'awaiting'> | undefined, now: number): GrokStatus {
  const last = [...entries].reverse().find((e) => e.from !== 'event');
  if (last?.from === 'agent' && last.asks) return { status: 'waiting', waitingFor: last.asks };
  if (agent?.awaiting) return { status: 'waiting', waitingFor: tr('responder no Grok Bot') };
  if (!last) return { status: 'idle' };
  if (last.streaming) return { status: 'working' };
  if (last.from === 'user') return now - last.at < PROMPT_WORKING_MS ? { status: 'working' } : { status: 'idle' };
  return now - last.at < OUTPUT_WORKING_MS ? { status: 'working' } : { status: 'idle' };
}

// ------------------------------------------------------------------ uso

export interface GrokUsage {
  /** Percentual usado na semana, 0–100. */
  percentUsed: number;
  resetsAt?: number;
  readAt?: number;
  plan?: string;
}

export function parseUsage(raw: string): GrokUsage | undefined {
  const reading = rec(valueOf(raw)?.reading);
  const usage = rec(reading?.usage);
  const pct = num(usage?.percentUsed);
  if (!usage || pct === undefined) return undefined;
  const out: GrokUsage = { percentUsed: Math.max(0, Math.min(100, pct)) };
  const reset = num(usage.nextResetMs);
  if (reset !== undefined) out.resetsAt = reset;
  const readAt = num(reading?.readAtMs);
  if (readAt !== undefined) out.readAt = readAt;
  const plan = str(usage.unifiedPlanName) ?? str(usage.grokPlanLabel);
  if (plan) out.plan = plan;
  return out;
}
