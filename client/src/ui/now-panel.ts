import type { AgentInfo } from '../../../shared/types';
import { tr } from '../../../shared/i18n';
import type { UiContext } from './context';
import { h, KeyedList, setAttr, setHidden, setText } from './dom';
import { createAgentRow, updateAgentRow } from './rows';
import { lastResult, nextAction, workGroup, type WorkGroup } from './work-summary';
import { createProgress, updateProgress } from './widgets';
import { taskProgress } from './model';
import { relativeTime } from './format';

const GROUPS: { key: WorkGroup; label: string; short: string }[] = [
  { key: 'attention', short: tr('Atenção'), label: tr('Precisa de você') },
  { key: 'working', short: tr('Ativos'), label: tr('Em andamento') },
  { key: 'finished', short: tr('Revisar'), label: tr('Pronto para revisar') },
  { key: 'idle', short: tr('Disponíveis'), label: tr('Disponíveis') },
];

/** A stable, keyboard-accessible operational view; all statuses come from the live snapshot. */
export class NowPanel {
  readonly el = h('div', { class: 'ui-work', attrs: { id: 'ui-now-panel' } });
  private groups = new Map<WorkGroup, { el: HTMLElement; count: HTMLElement; list: KeyedList<AgentInfo> }>();
  private selected: WorkGroup | null = null;
  private filters = new Map<WorkGroup | null, { button: HTMLButtonElement; count: HTMLElement }>();
  private empty = h('p', { class: 'ui-work__empty', text: tr('Nenhum agente neste estado.'), hidden: true });
  private refs = new WeakMap<HTMLElement, { room: HTMLElement; row: HTMLElement; result: HTMLElement; next: HTMLElement; progressBox: HTMLElement; progress: HTMLElement; progressText: HTMLElement }>();
  constructor(private ctx: UiContext) {
    const filters = h('div', { class: 'ui-work__filters', role: 'group', attrs: { 'aria-label': tr('Filtrar por estado do trabalho') } });
    for (const g of [{ key: null, short: tr('Todos'), label: tr('Todos') }, ...GROUPS]) {
      const count = h('span', { class: 'ui-work__filter-count' });
      const button = h('button', { class: 'ui-work__filter', type: 'button', title: g.label, attrs: { 'aria-pressed': 'false' }, on: { click: () => { this.selected = g.key; ctx.invalidate(); } } }, h('span', { text: g.short }), count);
      filters.append(button);
      this.filters.set(g.key, { button, count });
    }
    this.el.append(filters, this.empty);
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
          const progress = createProgress(tr('Progresso das tarefas'));
          const progressText = h('span', { class: 'ui-work__progress-text' });
          const progressBox = h('span', { class: 'ui-work__progress' }, progressText, progress);
          // One focus target per card, with goal, room, state and next action in its accessible contents.
          row.append(h('span', { class: 'ui-work__context' }, room, progressBox, result, next));
          row.classList.add('ui-work__card');
          this.refs.set(row, { room, row, result, next, progressBox, progress, progressText });
          return row;
        },
        update: (el, a) => {
          const r = this.refs.get(el)!;
          const sel = ctx.selection();
          updateAgentRow(r.row, a, ctx.account(a.account), sel?.type === 'agent' && sel.id === a.id, ctx.now(), ctx.store.snapshot?.agents);
          setText(r.room, tr('Sala: {0}', [ctx.store.snapshot?.rooms.find(x => x.id === a.roomId)?.name ?? a.roomId]));
          const progress = taskProgress(a.tasks);
          setHidden(r.progressBox, progress.total === 0);
          if (progress.total) { updateProgress(r.progress, progress.completed, progress.total, progress.inProgress); setText(r.progressText, tr('{0}/{1} tarefas', [progress.completed, progress.total])); }
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
    const present = agents.filter(a => a.status !== 'offline');
    for (const [key, f] of this.filters) {
      setText(f.count, String(key === null ? present.length : present.filter(a => workGroup(a) === key).length));
      setAttr(f.button, 'aria-pressed', String(this.selected === key));
    }
    setHidden(this.empty, this.selected === null || present.some(a => workGroup(a) === this.selected));
    for (const [key, g] of this.groups) {
      const items = present.filter(a => workGroup(a) === key)
        .sort((a, b) => (key === 'finished' ? b.lastEventAt - a.lastEventAt : a.startedAt - b.startedAt) || a.id.localeCompare(b.id));
      setText(g.count, String(items.length));
      setHidden(g.el, items.length === 0 || (this.selected !== null && this.selected !== key));
      g.list.sync(items);
    }
  }
}
