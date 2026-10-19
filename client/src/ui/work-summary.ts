import type { AgentInfo, Activity } from '../../../shared/types';
import { cleanUserText } from '../../../shared/user-text';
import { tr } from '../../../shared/i18n';

export type WorkGroup = 'attention' | 'working' | 'finished' | 'idle';
export function workGroup(a: AgentInfo): WorkGroup {
  if (a.status === 'waiting') return 'attention';
  if (a.status === 'working' || a.status === 'shell') return 'working';
  if (a.status === 'done' || (a.status === 'idle' && a.activity?.kind === 'done')) return 'finished';
  return 'idle';
}
export function sessionGoal(a: AgentInfo): string {
  const task = a.tasks.find(t => t.status === 'in_progress');
  if (task) return task.title;
  const title = cleanUserText(a.title ?? '');
  if (title) return title;
  const prompt = [...a.recent].reverse().find(x => x.kind === 'prompt' && cleanUserText(x.detail ?? ''));
  return prompt ? cleanUserText(prompt.detail!).slice(0, 180) : tr('Sessão sem objetivo informado');
}
export function currentWork(a: AgentInfo): string {
  if (a.status === 'waiting') return a.waitingFor || tr('Precisa da sua resposta');
  if (a.status === 'offline') return tr('Sessão encerrada');
  if (a.status === 'done') return tr('Atividade concluída');
  if (a.status === 'idle') return tr('Aguardando nova instrução');
  return a.activity?.text || tr('Trabalhando');
}
export function lastResult(a: AgentInfo): Activity | undefined {
  return [...a.recent].reverse().find(x => x.kind === 'done' || x.kind === 'error' || x.error || x.tool === 'ShellDone');
}
export function nextAction(a: AgentInfo): string {
  if (a.status === 'waiting') return tr('Abrir e responder');
  if (a.status === 'working' || a.status === 'shell') return tr('Acompanhar execução');
  if (workGroup(a) === 'finished') return tr('Revisar resultado');
  return tr('Abrir conversa');
}

/** Room overview uses recorded states; never infer completion from inactivity. */
export function roomWorkSummary(agents: readonly AgentInfo[]) {
  const present = agents.filter(a => a.status !== 'offline');
  const counts: Record<WorkGroup, number> = { attention: 0, working: 0, finished: 0, idle: 0 };
  for (const a of present) counts[workGroup(a)]++;
  const priority: Record<WorkGroup, number> = { attention: 0, working: 1, finished: 2, idle: 3 };
  const featured = [...present].sort((a, b) => priority[workGroup(a)] - priority[workGroup(b)]
    || Number(b.kind === 'main') - Number(a.kind === 'main')
    || a.startedAt - b.startedAt || a.id.localeCompare(b.id))[0];
  return { counts, featured, total: present.length };
}
