import { describe, expect, it } from 'vitest';
import type { AgentStatus, Provider } from '../../../../shared/types';
import { activeRoomTeams, roomPulse } from './room-label';

const agent = (status: AgentStatus, provider?: Provider, roomId = 'project', leaving = false) => ({ roomId, leaving, info: { status, provider } });

describe('atividade nas etiquetas dos projetos', () => {
  it('não confunde presença, espera humana ou estado desconhecido com trabalho', () => {
    expect(activeRoomTeams(['idle', 'waiting', 'unknown', 'done', 'offline'].map(s => agent(s as AgentStatus)), 'project')).toEqual([]);
    expect(activeRoomTeams([agent('working', 'codex', 'other'), agent('working', 'gemini', 'project', true)], 'project')).toEqual([]);
  });
  it('representa trabalho e shells reais, deduplica e preserva todas as equipes ativas', () => {
    expect(activeRoomTeams([agent('working', 'gemini'), agent('shell', 'codex'), agent('working'), agent('working', 'grok-bot'), agent('working', 'codex')], 'project')).toEqual(['claude', 'codex', 'grok-bot', 'gemini']);
  });
  it('mantém destaque estático com movimento reduzido e pulso lento sem sumir', () => {
    expect(roomPulse(0, true)).toBe(roomPulse(1400, true));
    expect(roomPulse(0, false)).toBeCloseTo(roomPulse(2800, false));
    expect(roomPulse(1400, false)).toBeCloseTo(0.55);
    expect(roomPulse(0, false)).toBeCloseTo(0.95);
  });
});
