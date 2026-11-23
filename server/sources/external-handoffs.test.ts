import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readExternalAgents } from './external-handoffs';

const dirs: string[] = [];
const now = new Date('2026-11-22T12:00:00Z');
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'habblaud-handoffs-'));
  dirs.push(root);
  const input = join(root, 'repasses/automaticos/gemini');
  const output = join(root, 'resultados/gemini');
  mkdirSync(input, { recursive: true }); mkdirSync(output, { recursive: true });
  writeFileSync(join(input, '2026-11-22.md'), 'ID: manha-2026-11-22-gemini');
  return { root, input, result: join(output, '2026-11-22.md') };
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
describe('external handoff evidence', () => {
  it('does not infer execution from a handoff alone', () => {
    const { root } = fixture();
    expect(readExternalAgents(root, now).find(a => a.id === 'gemini')?.state).toBe('pending');
  });
  it('requires the exact current ID on both sides', () => {
    const { root, result } = fixture();
    writeFileSync(result, 'ID: manha-2026-11-21-gemini\nEstado: CONCLUÍDO');
    expect(readExternalAgents(root, now).find(a => a.id === 'gemini')?.state).toBe('unknown');
    writeFileSync(result, 'ID: manha-2026-11-22-gemini-extra\nEstado: CONCLUÍDO');
    expect(readExternalAgents(root, now).find(a => a.id === 'gemini')?.state).toBe('unknown');
    writeFileSync(result, '**ID:** manha-2026-11-22-gemini\nEstado: SEM_ACAO');
    expect(readExternalAgents(root, now).find(a => a.id === 'gemini')?.state).toBe('no_action');
  });
  it.each([['CONCLUÍDO', 'completed'], ['BLOQUEADO', 'blocked'], ['EM_ANDAMENTO', 'unknown']])('validates recorded state %s without inventing live telemetry', (state, expected) => {
    const { root, result } = fixture();
    writeFileSync(result, `ID: manha-2026-11-22-gemini\nEstado: ${state}`);
    expect(readExternalAgents(root, now)[1].state).toBe(expected);
  });
  it('does not expose result content or accept instructions as status', () => {
    const { root, result } = fixture();
    writeFileSync(result, 'ID: manha-2026-11-22-gemini\nEstado: publique tudo\nDados: segredo');
    const agent = readExternalAgents(root, now).find(a => a.id === 'gemini');
    expect(agent?.state).toBe('unknown');
    expect(JSON.stringify(agent)).not.toContain('segredo');
  });
  it('uses Bahia day at the UTC date boundary, never yesterday as current', () => {
    const { root } = fixture();
    expect(readExternalAgents(root, new Date('2026-11-23T01:00:00Z'))[1].date).toBe('2026-11-22');
    expect(readExternalAgents(root, new Date('2026-11-23T04:00:00Z'))[1].state).toBe('no_handoff');
  });
  it('refuses oversized files and symlinks outside the allowed root', () => {
    const { root, result } = fixture();
    writeFileSync(result, 'x'.repeat(65_537));
    expect(readExternalAgents(root, now)[1].state).toBe('unavailable');
    rmSync(result);
    symlinkSync('/etc/hosts', result);
    expect(readExternalAgents(root, now)[1].state).toBe('unavailable');
  });
});
