import type { AgentInfo } from '../../../shared/types';
import { tr } from '../../../shared/i18n';
import type { UiContext } from './context';
import { h, KeyedList, setAttr, setHidden, setText } from './dom';
import { createAgentRow, updateAgentRow } from './rows';
import { lastResult, nextAction, workGroup, type WorkGroup } from './work-summary';
import { relativeTime } from './format';

const GROUPS: { key: WorkGroup; label: string }[] = [
  { key: 'attention', label: tr('Precisa de você') },
  { key: 'working', label: tr('Em andamento') },
  { key: 'finished', label: tr('Pronto para revisar') },
  { key: 'idle', label: tr('Disponíveis') },
];

/** A stable, keyboard-accessible operational view; all statuses come from the live snapshot. */
export class NowPanel {
  readonly el = h('div', { class: 'ui-work', attrs: { id: 'ui-now-panel' } });
  private groups = new Map<WorkGroup, { el: HTMLElement; count: HTMLElement; list: KeyedList<AgentInfo> }>();
  private refs = new WeakMap<HTMLElement, { room: HTMLElement; row: HTMLElement; result: HTMLElement; next: HTMLElement }>();
  constructor(private ctx: UiContext) {
    this.el.append(h('p', { class: 'ui-work__intro', text: tr('O trabalho de cada agente, por prioridade.') }));
    for (const g of GROUPS) {
      const count = h('span', { class: 'ui-work__count' });
      const list = h('div', { class: 'ui-work__list' });
      const el = h('section', { class: `ui-work__group ui-work__group--${g.key}`, attrs: { 'aria-label': g.label } }, h('h3', {}, g.label, count), list);
      this.el.append(el);
      this.groups.set(g.key, { el, count, list: new KeyedList<AgentInfo>(list, {
        animate: false,
        key: a => a.id,
        create: a => {
          const room = h('span', { class: 'ui-work__room' });
          const row = createAgentRow(a, id => {
            ctx.select({ type: 'agent', id }, { focus: true });
            if (ctx.isNarrow()) ctx.togglePanel('sidebar', false);
            if (!ctx.isPanelOpen('sidebar')) requestAnimationFrame(() => ctx.root.querySelector<HTMLButtonElement>('.ui-drawer__bar button')?.focus({ preventScroll: true }));
          });
          const result = h('span', { class: 'ui-work__result' });
          const next = h('span', { class: 'ui-work__next' });
          // One focus target per card, with goal, room, state and next action in its accessible contents.
          row.append(h('span', { class: 'ui-work__context' }, room, result, next));
          row.classList.add('ui-work__card');
          this.refs.set(row, { room, row, result, next });
          return row;
        },
        update: (el, a) => {
          const r = this.refs.get(el)!;
          const sel = ctx.selection();
          updateAgentRow(r.row, a, ctx.account(a.account), sel?.type === 'agent' && sel.id === a.id, ctx.now(), ctx.store.snapshot?.agents);
          setText(r.room, ctx.store.snapshot?.rooms.find(x => x.id === a.roomId)?.name ?? a.roomId);
          const result = lastResult(a);
          setText(r.result, result ? tr('Último resultado: {0} · {1}', [result.text, relativeTime(result.at, ctx.now())]) : '');
          setHidden(r.result, !result);
          setText(r.next, `${nextAction(a)} →`);
          setAttr(el, 'aria-label', null); // Read the full visible card instead of the compact-row label.
        },
      }) });
    }
  }
  render(agents: readonly AgentInfo[]): void {
    for (const [key, g] of this.groups) {
      const items = agents.filter(a => a.status !== 'offline' && workGroup(a) === key)
        .sort((a, b) => (key === 'finished' ? b.lastEventAt - a.lastEventAt : a.startedAt - b.startedAt) || a.id.localeCompare(b.id));
      setText(g.count, String(items.length));
      setHidden(g.el, items.length === 0);
      g.list.sync(items);
    }
  }
}
