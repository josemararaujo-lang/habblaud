import { readFileSync, realpathSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import type { ExternalAgentInfo } from '../../shared/types';

// Only the current day's handoff and result, never credentials or app databases.
function read(root: string, path: string): string | undefined {
  try {
    const resolved = realpathSync(path);
    if (!resolved.startsWith(realpathSync(root) + sep) || statSync(resolved).size > 65_536) throw new Error('Invalid handoff file');
    return readFileSync(resolved, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export function readExternalAgents(root: string, now = new Date()): ExternalAgentInfo[] {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return (['grok-bot', 'gemini'] as const).map(id => {
    const handoffId = `manha-${date}-${id}`;
    try {
      const input = read(root, join(root, 'repasses', 'automaticos', id, `${date}.md`));
      const result = read(root, join(root, 'resultados', id, `${date}.md`));
      const field = (body: string | undefined, key: string) => body?.replace(/\*\*/g, '').match(new RegExp(`^${key}:\\s*(.*?)\\s*$`, 'mi'))?.[1];
      if (field(input, 'ID') !== handoffId) return { id, date, state: 'no_handoff' };
      const base = { id, date, handoffId };
      if (!result) return { ...base, state: 'pending' };
      if (field(result, 'ID') !== handoffId) return { ...base, state: 'unknown' };
      const state = field(result, 'Estado')?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
      if (state === 'SEM_ACAO' || state === 'OK (SEM_ACAO)') return { ...base, state: 'no_action' };
      if (state === 'CONCLUIDO' || state === 'OK') return { ...base, state: 'completed' };
      if (state === 'BLOQUEADO' || state === 'ERRO') return { ...base, state: 'blocked' };
      return { ...base, state: 'unknown' };
    } catch { return { id, date, state: 'unavailable' }; }
  });
}
