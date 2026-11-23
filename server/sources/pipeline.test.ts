import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dailyResult, localDate, readPipeline, schedule } from './pipeline';

const now = Date.parse('2026-11-22T23:00:00Z');
const paths: string[] = [];
function fixture() {
  const home = mkdtempSync(join(tmpdir(), 'habblaud-pipeline-')); paths.push(home);
  const root = join(home, 'handoffs'), data = join(home, '.habblaud'); mkdirSync(data);
  const write = (path: string, body: string) => { const file = join(home, path); mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, body); return file; };
  return { home, root, data, write, view: (at = now) => readPipeline(home, root, data, at) };
}
afterEach(() => { for (const path of paths.splice(0)) rmSync(path, { recursive: true, force: true }); });
describe('pipeline schedule and evidence', () => {
  it('predicts daily and weekly schedules in Bahia, including the UTC date boundary', () => {
    expect(localDate(Date.parse('2026-11-23T02:59:00Z'))).toBe('2026-11-22');
    expect(schedule('RRULE:FREQ=DAILY;BYHOUR=7;BYMINUTE=30;BYSECOND=0', now)?.nextAt).toBe(Date.parse('2026-11-23T10:30:00Z'));
    expect(schedule('FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0', now)?.nextAt).toBe(Date.parse('2026-11-23T12:00:00Z'));
  });
  it.each(['FREQ=HOURLY;BYHOUR=7;BYMINUTE=0', 'FREQ=DAILY;BYHOUR=25;BYMINUTE=0', 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;INTERVAL=2', 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYDAY=MO', 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;UNTIL=20261123'])('does not invent a prediction for unsupported rule %s', rule => { expect(schedule(rule, now)).toBeUndefined(); });
  it('reads automation metadata without exposing or obeying the prompt, and never writes the config', () => {
    const f = fixture();
    const body = 'id = "test"\nprompt = """\nname = "Fake name"\nstatus = "ACTIVE"\nprivate content\n"""\nname = "Real routine"\nstatus = "PAUSED"\nrrule = "FREQ=DAILY;BYHOUR=7;BYMINUTE=30"\n';
    const path = f.write('.codex/automations/test/automation.toml', body);
    const r = f.view().routines[0];
    expect(r).toMatchObject({ title: 'Real routine', state: 'paused' });
    expect(r.nextAt).toBeUndefined(); expect(JSON.stringify(r)).not.toContain('private content'); expect(readFileSync(path, 'utf8')).toBe(body);
  });
  it('requires the exact current handoff ID, rather than file existence or a substring', () => {
    const f = fixture();
    f.write('handoffs/repasses/automaticos/gemini/2026-11-22.md', 'ID: manha-2026-11-22-gemini');
    f.write('handoffs/resultados/gemini/2026-11-22.md', 'ID: manha-2026-11-22-gemini-extra\nEstado: CONCLUÍDO');
    expect(dailyResult(f.root, 'gemini', '2026-11-22').state).toBe('mismatch');
    f.write('handoffs/resultados/gemini/2026-11-22.md', 'ID: manha-2026-11-22-gemini\n- **Estado:** SEM_ACAO');
    expect(dailyResult(f.root, 'gemini', '2026-11-22')).toMatchObject({ state: 'valid', outcome: 'no_action' });
  });
  it('does not turn yesterday into success today or a local definition into a schedule', () => {
    const f = fixture();
    f.write('handoffs/repasses/automaticos/gemini/2026-11-21.md', 'ID: manha-2026-11-21-gemini');
    f.write('handoffs/resultados/gemini/2026-11-21.md', 'ID: manha-2026-11-21-gemini\nEstado: CONCLUÍDO');
    f.write('.claude/scheduled-tasks/test/SKILL.md', 'Run every day at 07:00');
    expect(dailyResult(f.root, 'gemini', '2026-11-22').state).toBe('missing');
    expect(f.view().routines[0]).toMatchObject({ state: 'definition', verification: 'file' });
    expect(f.view().routines[0].nextAt).toBeUndefined();
  });
  it('expires native app observations and keeps missing coverage explicit', () => {
    const f = fixture();
    f.write('.habblaud/pipeline-observations.json', JSON.stringify({ providers: { claude: { observedAt: new Date(now - 7 * 3600_000).toISOString(), complete: true, routines: [{ id: 'test', title: 'Test', status: 'ACTIVE', frequency: 'daily', hour: 7, minute: 32 }] }, gemini: { observedAt: new Date(now - 7 * 3600_000).toISOString(), complete: true, routines: [] } } }));
    const view = f.view();
    expect(view.routines[0].state).toBe('unconfirmed'); expect(view.routines[0].nextAt).toBeUndefined();
    expect(view.coverage.find(c => c.agent === 'gemini')?.empty).toBeUndefined();
    expect(view.coverage.find(c => c.agent === 'grok-bot')?.kind).toBe('partial');
  });
});
