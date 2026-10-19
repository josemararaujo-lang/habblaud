import { expect, it } from 'vitest';
import type { AgentInfo } from '../../../shared/types';
import { currentWork, sessionGoal, workGroup, lastResult } from './work-summary';
const agent = (patch: Partial<AgentInfo> = {}) => ({ status: 'idle', title: '# Files mentioned by the user: ## screenshot', tasks: [], recent: [], activity: { kind: 'respond', text: 'Escrevendo a resposta' }, ...patch }) as AgentInfo;
it('never displays a stale response as current work or falsely claims completion', () => {
  expect(currentWork(agent())).toBe('Aguardando nova instrução');
  expect(workGroup(agent())).toBe('idle');
  expect(workGroup(agent({ status: 'waiting' }))).toBe('attention');
  expect(workGroup(agent({ status: 'shell' }))).toBe('working');
  expect(workGroup(agent({ status: 'done' }))).toBe('finished');
});
it('recovers goals from user prompts and gives an active explicit task precedence', () => {
  const a = agent({ recent: [{ id: 'p', kind: 'prompt', icon: '', at: 1, text: '', detail: '## My request:\nOrganizar as salas' }] });
  expect(sessionGoal(a)).toBe('Organizar as salas');
  expect(sessionGoal({ ...a, tasks: [{ id: '1', title: 'Revisar navegação', status: 'in_progress' }] })).toBe('Revisar navegação');
  expect(lastResult(a)).toBeUndefined();
});
