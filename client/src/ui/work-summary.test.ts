import { expect, it } from 'vitest';
import type { AgentInfo } from '../../../shared/types';
import { currentWork, sessionGoal, workGroup, lastResult, roomWorkSummary } from './work-summary';
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

it('prioritizes a real request for attention, excludes offline agents and keeps idle distinct from done', () => {
  const summary = roomWorkSummary([
    agent({ id: 'main', kind: 'main', status: 'working', startedAt: 1 }),
    agent({ id: 'sub', kind: 'sub', status: 'waiting', startedAt: 2 }),
    agent({ id: 'idle', status: 'idle', startedAt: 3 }),
    agent({ id: 'done', status: 'done', startedAt: 4 }),
    agent({ id: 'closed', status: 'offline', startedAt: 0 }),
  ]);
  expect(summary.total).toBe(4);
  expect(summary.counts).toEqual({ attention: 1, working: 1, finished: 1, idle: 1 });
  expect(summary.featured?.id).toBe('sub');
});
it('keeps the featured main session stable when activity timestamps change', () => {
  const older = agent({ id: 'a', kind: 'main', status: 'working', startedAt: 1, lastEventAt: 10 });
  const newer = agent({ id: 'b', kind: 'main', status: 'working', startedAt: 2, lastEventAt: 100 });
  expect(roomWorkSummary([newer, older]).featured?.id).toBe('a');
  expect(roomWorkSummary([{ ...newer, lastEventAt: 200 }, older]).featured?.id).toBe('a');
  expect(roomWorkSummary([]).featured).toBeUndefined();
});
