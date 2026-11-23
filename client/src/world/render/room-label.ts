import type { AgentStatus, Provider } from '../../../../shared/types';

const TEAM_ORDER: Provider[] = ['claude', 'codex', 'grok-bot', 'gemini'];

/** Sala atribuída, não a posição física do avatar que pode estar caminhando. */
export function activeRoomTeams(chars: Iterable<{ roomId: string; leaving: boolean; info: { status: AgentStatus; provider?: Provider } }>, roomId: string): Provider[] {
  const active = new Set<Provider>();
  for (const ch of chars) {
    if (ch.roomId === roomId && !ch.leaving && (ch.info.status === 'working' || ch.info.status === 'shell')) {
      active.add(ch.info.provider ?? 'claude');
    }
  }
  return TEAM_ORDER.filter((team) => active.has(team));
}

/** Respiração de 2,8 s: o texto nunca pisca, desaparece ou muda de contraste. */
export function roomPulse(now: number, still: boolean): number {
  return still ? 0.85 : 0.55 + 0.4 * (0.5 + 0.5 * Math.cos(now * Math.PI * 2 / 2800));
}
