// Fonte de agentes do Grok Bot (AgentSource 'grok', ver sources/source.ts): lê a cópia local que o app desktop guarda
// (replica.ts) e põe no escritório os agentes do Grok com atividade recente. Só leitura: os agentes rodam na nuvem,
// então nada de terminal, mensagens, aprovações nem Habblaud World (a projeção do World deixa o Grok de fora).
//
// Cada pasta do app (HABBLAUD_GROK_DIRS ou a padrão do macOS) vira uma conta "Grok Bot". A cada ciclo (2 s) relê só as
// fatias que mudaram (mtime/tamanho). Um agente do Grok é permanente (não há sessão que abre e fecha), então:
// - entra no escritório quando trabalha, espera você ou teve atividade há menos de `recentMs` (padrão 60 min,
//   HABBLAUD_GROK_RECENT_MIN); sai (closeMain) quando passa disso parado;
// - a sala é a do nome do agente (`/grok/<nome>`): os agentes do Grok costumam ter o nome do projeto;
// - o status vem de grokStatus (a réplica não diz se o agente está rodando: ver replica.ts);
// - as entradas da conversa viram atividades; as anteriores à entrada no escritório vão só para o histórico.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Activity, SourceInfo } from '../../../shared/types';
import { expandHome, parseAccountOverrides, type DetectedAccount } from '../../accounts/detect';
import type { AccountEntry, AccountsService } from '../../accounts/service';
import { errMsg, log } from '../../log';
import type { Office } from '../../model/office';
import type { AgentSource } from '../source';
import { classifySlice, decodeSliceName, grokStatus, parseRoster, parseTranscript, parseUsage, PERSISTENCE_DIR, type GrokEntry, type RosterAgent } from './replica';
import { tr } from '../../../shared/i18n';

/** Pasta padrão do app no macOS (dentro do HOME). */
export const DEFAULT_APP_DIR = join('Library', 'Application Support', 'Grok Bot');
/** Presença padrão de um agente parado: atividade nos últimos 60 min. */
export const DEFAULT_RECENT_MS = 60 * 60_000;
/** Atividades da conversa recuperadas ao entrar no escritório (o resto do arquivo fica de fora). */
const BACKLOG = 40;
const ROLE = tr('Agente do Grok Bot');
const GROK_COLOR = '#5cc97b';

function splitList(v: string | undefined): string[] {
  return (v ?? '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A pasta tem a cópia local do Grok Bot (a subpasta sand-client-persistence/). */
export function isGrokDir(p: string): boolean {
  try {
    return statSync(join(p, PERSISTENCE_DIR)).isDirectory();
  } catch {
    return false;
  }
}

/** Pastas do Grok Bot desta máquina: HABBLAUD_GROK_DIRS (separadas por vírgula) ou a padrão, se existir. */
export function discoverGrokDirs(env: NodeJS.ProcessEnv = process.env, home: string = env.HOME || homedir()): string[] {
  const override = splitList(env.HABBLAUD_GROK_DIRS);
  const dirs = override.length ? override.map((p) => expandHome(p, home)) : [join(home, DEFAULT_APP_DIR)];
  return [...new Set(dirs)].filter(isGrokDir);
}

/** HABBLAUD_GROK_RECENT_MIN (minutos, 1 a 1440) ou o padrão. */
export function recentMsFrom(env: NodeJS.ProcessEnv): number {
  const n = Number.parseInt(env.HABBLAUD_GROK_RECENT_MIN ?? '', 10);
  return Number.isFinite(n) && n >= 1 && n <= 1440 ? n * 60_000 : DEFAULT_RECENT_MS;
}

/** Metadados das contas do Grok (um por pasta), com os overrides `provider: 'grok'` de HABBLAUD_ACCOUNTS (Docker). */
export function detectGrokAccounts(dirs: readonly string[], env: NodeJS.ProcessEnv = process.env, home: string = env.HOME || homedir()): DetectedAccount[] {
  const overrides = parseAccountOverrides(env.HABBLAUD_ACCOUNTS).filter((o) => o.provider === 'grok');
  const norm = (p: unknown) => (typeof p === 'string' && p.trim() ? expandHome(p, home) : undefined);
  return dirs.map((dir, i) => {
    const ov = overrides.find((o) => norm(o.mountDir) === dir) ?? overrides.find((o) => norm(o.configDir) === dir) ?? (dirs.length === 1 ? overrides[0] : undefined);
    const short = (typeof ov?.short === 'string' && ov.short.trim()) || (dirs.length > 1 ? `G${i + 1}` : 'G');
    return {
      id: (typeof ov?.id === 'string' && ov.id.trim()) || (i ? `grok-${i + 1}` : 'grok'),
      provider: 'grok' as const,
      configDir: (typeof ov?.configDir === 'string' && ov.configDir.trim()) || dir,
      short,
      name: (typeof ov?.name === 'string' && ov.name.trim()) || (dirs.length > 1 ? `Grok Bot ${short}` : 'Grok Bot'),
      color: (typeof ov?.color === 'string' && ov.color.trim()) || GROK_COLOR,
    };
  });
}

export interface GrokSourceOptions {
  accounts: AccountsService;
  office: Office;
  /** Pastas do app lidas por este processo (no Docker, as montadas), uma por conta. */
  dirs: string[];
  env?: NodeJS.ProcessEnv;
  home?: string;
  now?: () => number;
  pollMs?: number;
  /** Agente parado continua no escritório por este tempo depois da última atividade. */
  recentMs?: number;
}

interface FileState {
  mtimeMs: number;
  size: number;
}

interface GrokAgent {
  /** Id no escritório: "<conta>:<id do agente no Grok>". */
  key: string;
  grokId: string;
  acc: GrokAccount;
  roster?: RosterAgent;
  entries: GrokEntry[];
  file?: FileState;
  inOffice: boolean;
  /** Entradas que já viraram atividade (pela chave). */
  shown: Set<string>;
}

interface GrokAccount {
  id: string;
  dir: string;
  configDir: string;
  /** Fatias de uso já lidas (arquivo → estado). */
  files: Map<string, FileState>;
  /** Listas de agentes já lidas (pode haver mais de uma conta do app na mesma pasta). */
  rosters: Map<string, { st: FileState; rows: RosterAgent[] }>;
  error?: string;
}

function sameFile(a: FileState | undefined, b: FileState): boolean {
  return !!a && a.mtimeMs === b.mtimeMs && a.size === b.size;
}

function activityOf(agentKey: string, e: GrokEntry): Activity {
  const a: Activity = { id: `${agentKey}#${e.key}`, kind: e.kind, icon: e.icon, text: e.text, at: e.at, tool: 'Grok' };
  if (e.detail) a.detail = e.detail;
  return a;
}

/** Sala do agente: o nome dele vira o nome da sala (sem barras, que virariam pastas). */
export function grokCwd(name: string): string {
  const clean = name.replace(/[\\/]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Grok';
  return `/grok/${clean}`;
}

export class GrokSource implements AgentSource {
  readonly provider = 'grok' as const;
  private accs: GrokAccount[] = [];
  private entries: readonly AccountEntry[] = [];
  private readonly agents = new Map<string, GrokAgent>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly now: () => number;
  private readonly recentMs: number;

  constructor(private readonly opts: GrokSourceOptions) {
    this.now = opts.now ?? Date.now;
    const env = opts.env ?? process.env;
    this.recentMs = opts.recentMs ?? recentMsFrom(env);
    const detected = detectGrokAccounts(opts.dirs, env, opts.home ?? env.HOME ?? homedir());
    this.entries = opts.accounts.setProviderAccounts(
      'grok',
      opts.dirs.map((dir, i) => ({ dir, detected: detected[i] })),
    );
    this.accs = this.entries.map((e) => ({ id: e.id, dir: e.dir, configDir: e.detected.configDir, files: new Map(), rosters: new Map() }));
  }

  accountEntries(): readonly AccountEntry[] {
    return this.entries;
  }

  start(): void {
    this.opts.office.beginBoot();
    try {
      this.poll(true);
    } finally {
      this.opts.office.endBoot();
    }
    this.timer = setInterval(() => {
      try {
        this.poll();
      } catch (err) {
        log.warnOnce(`grok-poll:${errMsg(err)}`, tr('Grok Bot: falha ao ler a cópia local ({0}).', [errMsg(err)]));
      }
    }, this.opts.pollMs ?? 2_000);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  sources(): SourceInfo[] {
    return this.accs.map((acc) => {
      let sessions = 0;
      for (const a of this.agents.values()) if (a.acc === acc && a.inOffice) sessions++;
      const info: SourceInfo = { label: acc.id, provider: 'grok', path: acc.configDir, sessions, ok: !acc.error };
      if (acc.error) info.error = acc.error;
      return info;
    });
  }

  /** Sem terminal: a conversa é um JSON da réplica, não um transcript que o terminal saiba acompanhar. */
  transcriptPathOf(): string | undefined {
    return undefined;
  }

  /** Um ciclo: relê o que mudou e acerta presença, status e atividades (público para os testes). */
  poll(boot = false): void {
    for (const acc of this.accs) this.pollAccount(acc);
    const now = this.now();
    for (const a of this.agents.values()) this.sync(a, now, boot);
  }

  private pollAccount(acc: GrokAccount): void {
    const dir = join(acc.dir, PERSISTENCE_DIR);
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      acc.error = code === 'ENOENT' ? tr('pasta {0}/ não encontrada', [PERSISTENCE_DIR]) : tr('{0}/ ilegível ({1})', [PERSISTENCE_DIR, code ?? tr('erro')]);
      return;
    }
    delete acc.error;
    const seenRosters = new Set<string>();
    for (const name of names) {
      if (!name.endsWith('.blob')) continue;
      const key = decodeSliceName(name);
      const ref = key ? classifySlice(key) : undefined;
      if (!ref) continue;
      const file = join(dir, name);
      let st: FileState;
      try {
        const s = statSync(file);
        st = { mtimeMs: s.mtimeMs, size: s.size };
      } catch {
        continue;
      }
      if (ref.kind === 'transcript') {
        const agent = this.agentOf(acc, ref.agentId);
        if (sameFile(agent.file, st)) continue;
        const parsed = readSafe(file, parseTranscript);
        // Arquivo sendo gravado (JSON incompleto): fica com a última versão boa e tenta de novo no próximo ciclo.
        if (!parsed) continue;
        agent.entries = parsed;
        agent.file = st;
        continue;
      }
      if (ref.kind === 'roster') {
        seenRosters.add(file);
        if (sameFile(acc.rosters.get(file)?.st, st)) continue;
        const rows = readSafe(file, parseRoster);
        if (rows) acc.rosters.set(file, { st, rows });
        continue;
      }
      if (sameFile(acc.files.get(file), st)) continue;
      const usage = readSafe(file, parseUsage);
      if (!usage) continue;
      acc.files.set(file, st);
      this.opts.accounts.setUsage(acc.id, {
        sevenDay: { utilization: usage.percentUsed, ...(usage.resetsAt !== undefined ? { resetsAt: usage.resetsAt } : {}) },
        source: 'grok',
        fetchedAt: usage.readAt ?? st.mtimeMs,
      });
    }
    for (const file of [...acc.rosters.keys()]) if (!seenRosters.has(file)) acc.rosters.delete(file);
    // Agente que saiu da lista (apagado no app) perde a linha e sai do escritório no sync.
    const listed = new Map<string, RosterAgent>();
    for (const { rows } of acc.rosters.values()) for (const r of rows) listed.set(r.id, r);
    for (const r of listed.values()) this.agentOf(acc, r.id).roster = r;
    for (const a of this.agents.values()) if (a.acc === acc && !listed.has(a.grokId)) delete a.roster;
  }

  private agentOf(acc: GrokAccount, grokId: string): GrokAgent {
    const key = `${acc.id}:${grokId}`;
    let a = this.agents.get(key);
    if (!a) {
      a = { key, grokId, acc, entries: [], inOffice: false, shown: new Set() };
      this.agents.set(key, a);
    }
    return a;
  }

  private sync(a: GrokAgent, now: number, boot: boolean): void {
    // Conversa sem o agente na lista (apagado no app ou outra conta): fica de fora.
    if (!a.roster) {
      if (a.inOffice) this.leave(a);
      return;
    }
    const lastEntry = a.entries.at(-1)?.at;
    const lastAt = Math.max(a.roster.lastActivityAt ?? 0, lastEntry ?? 0);
    const st = grokStatus(a.entries, a.roster, now);
    const present = st.status !== 'idle' || (lastAt > 0 && now - lastAt < this.recentMs);
    const office = this.opts.office;
    if (!present) {
      if (a.inOffice) this.leave(a);
      return;
    }
    if (!a.inOffice || !office.has(a.key)) {
      a.inOffice = true;
      a.shown.clear();
      office.addMain({
        id: a.key,
        provider: 'grok',
        account: a.acc.id,
        sessionId: a.grokId,
        cwd: grokCwd(a.roster.name),
        role: ROLE,
        startedAt: a.entries[Math.max(0, a.entries.length - BACKLOG)]?.at ?? (lastAt || now),
        status: st.status,
        waitingFor: st.waitingFor,
      });
      // O que aconteceu antes de o agente entrar: histórico, sem feed (no boot o Office guarda o feed na ordem).
      const backlog = a.entries.slice(-BACKLOG);
      backlog.forEach((e, i) => {
        a.shown.add(e.key);
        office.addActivity(a.key, activityOf(a.key, e), i === backlog.length - 1, { feed: boot });
      });
      for (const e of a.entries) a.shown.add(e.key);
    } else {
      for (const e of a.entries) {
        if (a.shown.has(e.key)) continue;
        a.shown.add(e.key);
        office.addActivity(a.key, activityOf(a.key, e), true);
      }
      office.setStatus(a.key, st.status, st.waitingFor);
      if (st.status === 'working') office.fillWorkingActivity(a.key);
    }
    office.applyTranscript(a.key, {
      title: a.roster.name,
      tasks: [],
      stats: { toolCalls: a.entries.filter((e) => e.from === 'agent' && e.kind !== 'respond' && e.kind !== 'ask').length, tokensIn: 0, tokensOut: 0, subagents: 0 },
      model: 'Grok',
      ...(a.entries.length ? { firstAt: a.entries[0].at } : {}),
      ...(lastAt > 0 ? { lastAt } : {}),
    });
  }

  private leave(a: GrokAgent): void {
    a.inOffice = false;
    this.opts.office.closeMain(a.key);
  }
}

function readSafe<T>(file: string, parse: (raw: string) => T | undefined): T | undefined {
  try {
    return parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}
