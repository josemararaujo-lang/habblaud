import type { AgentInfo } from '../../../shared/types';
import { tr } from '../../../shared/i18n';
import { h, setHidden, setText, setTitle } from './dom';
import { roomWorkSummary, sessionGoal, type WorkGroup } from './work-summary';

/** Span-only content can be shared by room buttons and the details panel. */
export class RoomOverview {
  readonly el = h('span', { class: 'ui-room-overview' });
  private status = h('span', { class: 'ui-room-overview__statuses' });
  private goal = h('span', { class: 'ui-room-overview__goal' });
  private badges = new Map<WorkGroup, HTMLElement>();
  constructor() {
    for (const group of ['attention', 'working', 'finished', 'idle'] as const) {
      const badge = h('span', { class: `ui-room-overview__badge is-${group}`, hidden: true });
      this.badges.set(group, badge);
      this.status.append(badge);
    }
    this.el.append(this.status, this.goal);
  }
  update(agents: readonly AgentInfo[]): ReturnType<typeof roomWorkSummary> {
    const summary = roomWorkSummary(agents);
    const labels: Record<WorkGroup, string> = {
      attention: tr('Atenção: {0}', [summary.counts.attention]),
      working: tr('Em andamento: {0}', [summary.counts.working]),
      finished: tr('Para revisar: {0}', [summary.counts.finished]),
      idle: tr('Disponíveis: {0}', [summary.counts.idle]),
    };
    for (const [key, badge] of this.badges) {
      setText(badge, labels[key]);
      setHidden(badge, summary.counts[key] === 0);
    }
    setHidden(this.status, summary.total === 0);
    const a = summary.featured;
    const goal = a ? tr('Em destaque: {0} — {1}', [a.name, sessionGoal(a)]) : tr('Nenhuma sessão ativa nesta sala.');
    setText(this.goal, goal);
    setTitle(this.goal, goal);
    return summary;
  }
}
