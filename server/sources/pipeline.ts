import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { PipelineResult, PipelineRoutine, PipelineView } from '../../shared/pipeline';
import type { Provider } from '../../shared/types';

const TZ = 'America/Bahia';
const UI_TTL = 6 * 3600_000;
const IDS: Record<string, { agent: Provider; artifact?: string }> = {
  'resumo-da-manh-prioridades-do-josemar': { agent: 'codex', artifact: 'resumos' },
  'entregar-repasse-ao-gemini': { agent: 'gemini' },
  'conferir-repasses-da-manh': { agent: 'codex', artifact: 'acompanhamento' },
};
function read(path: string): string | undefined {
  try { if (statSync(path).size > 256_000) return undefined; return readFileSync(path, 'utf8'); } catch { return undefined; }
}
function dirs(path: string): string[] { try { return readdirSync(path, { withFileTypes: true }).filter(f => f.isDirectory()).map(f => f.name); } catch { return []; } }
function field(text: string | undefined, name: string): string | undefined { return text?.replace(/\*\*/g, '').match(new RegExp(`^\\s*(?:[-*]\\s+)?${name}:\\s*(.*?)\\s*$`, 'mi'))?.[1]; }
function toml(text: string, key: string): string | undefined {
  // Metadata only: prompt bodies may themselves contain lines that look like TOML.
  const closes = (line: string, quote: string, start = 0) => {
    for (let i = line.indexOf(quote, start); i >= 0; i = line.indexOf(quote, i + 3)) {
      if (quote === "'''") return true;
      let backslashes = 0;
      for (let j = i - 1; j >= 0 && line[j] === '\\'; j--) backslashes++;
      if (backslashes % 2 === 0) return true;
    }
    return false;
  };
  let multiline: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    if (multiline) {
      if (closes(line, multiline)) multiline = undefined;
      continue;
    }
    if (/^\s*\[/.test(line)) return undefined;
    const pair = line.match(/^([\w]+)\s*=\s*(.*)$/);
    if (!pair) continue;
    const raw = pair[2];
    if (raw.startsWith('"""') || raw.startsWith("'''")) {
      const quote = raw.slice(0, 3);
      if (!closes(raw, quote, 3)) multiline = quote;
      continue;
    }
    if (pair[1] !== key) continue;
    const value = raw.match(/^("(?:\\.|[^"\\])*"|'[^']*')\s*(?:#.*)?$/)?.[1];
    if (!value) return undefined;
    try { return value.startsWith('"') ? JSON.parse(value) : value.slice(1, -1); } catch { return undefined; }
  }
  return undefined;
}
export function localDate(now: number): string { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }

/** Only the recurrence subset we actually understand gets a prediction. Never expose raw RRULE. */
export function schedule(rule: string, now: number): { time: string; nextAt: number; weekly: boolean; days?: string[] } | undefined {
  const fields: Record<string, string> = Object.fromEntries(rule.replace(/^RRULE:/, '').split(';').map(p => p.split('=')));
  if (!['DAILY', 'WEEKLY'].includes(fields.FREQ) || (fields.INTERVAL && fields.INTERVAL !== '1')) return undefined;
  if (Object.keys(fields).some(k => !['FREQ', 'INTERVAL', 'BYHOUR', 'BYMINUTE', 'BYSECOND', 'BYDAY'].includes(k))) return undefined;
  const h = Number(fields.BYHOUR), m = Number(fields.BYMINUTE), sec = Number(fields.BYSECOND ?? '0');
  if (!/^\d{1,2}$/.test(fields.BYHOUR ?? '') || !/^\d{1,2}$/.test(fields.BYMINUTE ?? '') || h > 23 || m > 59 || sec !== 0) return undefined;
  const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const byDay = fields.BYDAY?.split(',');
  if (fields.FREQ === 'DAILY' && byDay) return undefined;
  if (byDay?.some(d => !days.includes(d)) || (fields.FREQ === 'WEEKLY' && !byDay?.length)) return undefined;
  const date = localDate(now);
  for (let offset = 0; offset <= 7; offset++) {
    const day = new Date(`${date}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + offset);
    if (byDay && !byDay.includes(days[day.getUTCDay()])) continue;
    const utc = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m);
    const zone = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' }).formatToParts(utc).find(p => p.type === 'timeZoneName')?.value;
    const z = zone?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
    if (!z) return undefined;
    const delta = (Number(z[2]) * 60 + Number(z[3])) * 60_000 * (z[1] === '+' ? 1 : -1);
    const candidate = utc - delta;
    if (candidate > now) return { time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, nextAt: candidate, weekly: fields.FREQ === 'WEEKLY', ...(byDay ? { days: byDay } : {}) };
  }
  return undefined;
}

export function dailyResult(root: string, agent: string, date: string): PipelineResult {
  const expected = `manha-${date}-${agent}`;
  const input = read(join(root, 'repasses/automaticos', agent, `${date}.md`));
  const outputPath = join(root, 'resultados', agent, `${date}.md`);
  const output = read(outputPath);
  if (!output) return { date, state: existsSync(outputPath) ? 'unavailable' : 'missing' };
  if (field(input, 'ID') !== expected || field(output, 'ID') !== expected) return { date, state: 'mismatch' };
  const state = field(output, 'Estado')?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const outcome = state === 'SEM_ACAO' || state === 'OK (SEM_ACAO)' ? 'no_action' : state === 'CONCLUIDO' || state === 'OK' ? 'complete' : state === 'PARCIAL' ? 'partial' : state === 'BLOQUEADO' || state === 'ERRO' ? 'blocked' : 'unknown';
  return { date, state: 'valid', id: expected, outcome };
}
function evidence(root: string, agent: string, date: string): Pick<PipelineRoutine, 'result' | 'lastResult'> {
  const result = dailyResult(root, agent, date);
  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(`${date}T12:00:00Z`); day.setUTCDate(day.getUTCDate() - offset);
    const last = offset === 0 ? result : dailyResult(root, agent, day.toISOString().slice(0, 10));
    if (last.state === 'valid') return { result, lastResult: last };
  }
  return { result };
}

export function readPipeline(home: string, root: string, dataDir: string, now = Date.now()): PipelineView {
  const date = localDate(now);
  const routines: PipelineRoutine[] = [];
  let observations: any = {};
  try { observations = JSON.parse(read(join(dataDir, 'pipeline-observations.json')) ?? '{}').providers ?? {}; } catch { /* Unavailable is explicit below. */ }
  const coverage: PipelineView['coverage'] = [{ agent: 'codex', kind: existsSync(join(home, '.codex/automations')) ? 'config' : 'partial', checkedAt: now }];
  for (const id of dirs(join(home, '.codex/automations'))) {
    const text = read(join(home, '.codex/automations', id, 'automation.toml'));
    if (!text || toml(text, 'id') !== id) { coverage[0].kind = 'partial'; continue; }
    const plan = schedule(toml(text, 'rrule') ?? '', now);
    const status = toml(text, 'status');
    const spec = IDS[id];
    routines.push({ id: `codex:${id}`, title: (toml(text, 'name') ?? id).slice(0, 180), agent: spec?.agent ?? 'codex', runner: 'codex', group: spec ? 'morning' : 'other', state: status === 'PAUSED' ? 'paused' : status === 'ACTIVE' && plan ? 'active' : 'unconfirmed', verification: 'config', checkedAt: now, source: `.codex/automations/${id}/automation.toml`, time: plan?.time, weekly: plan?.weekly, days: plan?.days, ...(status === 'ACTIVE' && plan ? { nextAt: plan.nextAt } : {}), ...(spec?.agent === 'gemini' ? evidence(root, 'gemini', date) : {}) });
  }
  for (const agent of ['claude', 'gemini', 'grok-bot'] as const) {
    const obs = observations[agent];
    const at = Date.parse(obs?.observedAt ?? '');
    const fresh = Number.isFinite(at) && at <= now + 60_000 && now - at < UI_TTL;
    const app = obs?.complete === true && Array.isArray(obs.routines);
    coverage.push({ agent, kind: app && fresh ? 'app' : 'partial', checkedAt: Number.isFinite(at) ? at : 0, ...(app && fresh && obs.routines.length === 0 ? { empty: true } : {}) });
    if (!app) continue;
    for (const entry of obs.routines.slice(0, 100)) {
      if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !/^[\w-]{1,120}$/.test(entry.id) || typeof entry.title !== 'string') continue;
      const rule = `FREQ=DAILY;BYHOUR=${entry.hour};BYMINUTE=${entry.minute}`;
      const plan = entry.frequency === 'daily' ? schedule(rule, now) : undefined;
      const morning = agent === 'claude' && entry.id === 'esteira-manha-claude';
      routines.push({ id: `${agent}:${entry.id}`, title: entry.title.slice(0, 180), agent, runner: agent, group: morning ? 'morning' : 'other', state: fresh && entry.status === 'ACTIVE' && plan ? 'active' : entry.status === 'PAUSED' && fresh ? 'paused' : 'unconfirmed', verification: 'app', checkedAt: at, source: String(obs.source ?? agent).slice(0, 180), time: plan?.time, approximate: entry.approximate === true, ...(fresh && entry.status === 'ACTIVE' && plan ? { nextAt: plan.nextAt } : {}), ...(morning ? { ...(plan?.time === '07:32' && read(join(root, 'conexoes/claude.md'))?.includes('07:45') ? { note: 'claude-time' } : {}), ...evidence(root, 'claude', date) } : {}), ...( /^\d{4}-\d{2}-\d{2}$/.test(entry.lastRunDate ?? '') && /^\d{2}:\d{2}$/.test(entry.lastRunTime ?? '') ? { lastRun: { date: entry.lastRunDate, time: entry.lastRunTime, completed: entry.lastRunStatus === 'completed' } } : {}) });
    }
  }
  // Existing connection records are documentation, not proof of a currently enabled scheduler.
  if (!routines.some(r => r.id === 'claude:esteira-manha-claude') && read(join(root, 'conexoes/claude.md'))) routines.push({ id: 'claude:esteira-manha-claude', title: 'Esteira da manhã — Claude', agent: 'claude', runner: 'claude', group: 'morning', state: 'documented', verification: 'document', checkedAt: 0, source: 'conexoes/claude.md', time: '07:45', ...evidence(root, 'claude', date) });
  if (read(join(root, 'conexoes/grok-bot.md'))) {
    routines.push({ id: 'grok-bot:esteira-manha', title: 'Conferência do espelho Notion', agent: 'grok-bot', runner: 'grok-bot', group: 'morning', state: 'documented', verification: 'document', checkedAt: 0, source: 'conexoes/grok-bot.md', time: '07:45', ...evidence(root, 'grok-bot', date) });
    routines.push({ id: 'grok-bot:sync-notion', title: 'Sync Habitvs → Notion', agent: 'grok-bot', runner: 'grok-bot', group: 'other', state: 'documented', verification: 'document', checkedAt: 0, source: 'conexoes/grok-bot.md', time: '09:00', weekly: true, note: 'monday' });
  }
  for (const id of dirs(join(home, '.claude/scheduled-tasks'))) {
    if (!/^[\w-]{1,120}$/.test(id) || routines.some(r => r.id === `claude:${id}`)) continue;
    if (existsSync(join(home, '.claude/scheduled-tasks', id, 'SKILL.md'))) routines.push({ id: `claude:${id}`, title: id.replace(/-/g, ' '), agent: 'claude', runner: 'claude', group: 'other', state: 'definition', verification: 'file', checkedAt: now, source: `.claude/scheduled-tasks/${id}/SKILL.md` });
  }
  routines.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.title.localeCompare(b.title));
  return { date, timeZone: TZ, collectedAt: now, routines, coverage };
}
