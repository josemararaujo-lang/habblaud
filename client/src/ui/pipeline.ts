import './pipeline.css';
import type { PipelineRoutine, PipelineView, PipelineResult } from '../../../shared/pipeline';
import { TEAM_SHIRTS } from '../../../shared/team-uniform';
import { tr, getLocale } from '../../../shared/i18n';
import { PROVIDER_NAME } from './provider';
import { h, iconButton, setAttr, setHidden, setText } from './dom';
import type { UiComponent, UiContext } from './context';
import { dialogWindow } from './dialog-windows';
import type { Movable } from './movable';
import { ICONS } from './icons';

const dateTime = (at: number) => new Intl.DateTimeFormat(getLocale(), { timeZone: 'America/Bahia', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(at);
const date = (value: string) => value.split('-').reverse().join('/');
export class PipelinePanel implements UiComponent {
  readonly button = h('button', { class: 'ui-pipeline-button', type: 'button', text: tr('Esteira'), title: tr('Minha esteira: agentes, rotinas e horários'), attrs: { 'aria-haspopup': 'dialog' } });
  readonly el: HTMLDialogElement;
  private content = h('div', { class: 'ui-pipeline__content' });
  private note = h('p', { class: 'ui-pipeline__note' });
  private filters = h('div', { class: 'ui-pipeline__filters', role: 'group', attrs: { 'aria-label': tr('Filtrar rotinas') } });
  private filter: 'morning' | 'all' = 'morning';
  private data?: PipelineView;
  private busy = false;
  private timer?: ReturnType<typeof setInterval>;
  private compact = false;
  private switching = 0;
  private movable?: Movable;
  private compactButton = h('button', { class: 'ui-btn ui-pipeline__compact', type: 'button', text: tr('Compactar'), title: tr('Janela compacta: acompanhar sem bloquear o escritório'), attrs: { 'aria-pressed': 'false' }, on: { click: () => this.setCompact(!this.compact) } });
  constructor(private ctx: UiContext) {
    const close = iconButton(ICONS.close, tr('Fechar'), () => this.el.close());
    const refresh = iconButton('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M5.3 7a7.5 7.5 0 0 1 12.4-2L20 8M4 16l2.3 3A7.5 7.5 0 0 0 18.7 17"/></svg>', tr('Atualizar'), () => void this.load());
    this.el = h('dialog', { class: 'ui-dialog ui-pipeline', attrs: { 'aria-labelledby': 'pipeline-title' } },
      h('header', { class: 'ui-pipeline__header' }, h('div', {}, h('h2', { text: tr('Minha esteira'), attrs: { id: 'pipeline-title' } }), this.note), h('div', { class: 'ui-pipeline__actions' }, refresh, this.compactButton, close)),
      this.filters, this.content);
    this.movable = dialogWindow(this.el);
    try { this.compact = localStorage.getItem('habblaud.pipeline.compact') === 'true'; } catch { /* Storage is optional. */ }
    this.syncMode();
    for (const [key, label] of [['morning', tr('Manhã')], ['all', tr('Todas as rotinas')]] as const) {
      const b = h('button', { type: 'button', text: label, attrs: { 'aria-pressed': key === this.filter ? 'true' : 'false' }, on: { click: () => {
        this.filter = key;
        for (const option of this.filters.children) setAttr(option, 'aria-pressed', String(option === b));
        this.draw();
      } } }); this.filters.append(b);
    }
    this.button.addEventListener('click', () => this.open());
    this.el.addEventListener('close', () => {
      if (this.switching) { this.switching--; return; }
      clearInterval(this.timer); setAttr(this.button, 'aria-expanded', 'false'); this.button.focus();
    });
    this.el.addEventListener('keydown', e => {
      if (this.compact && e.key === 'Escape') { e.stopPropagation(); this.el.close(); }
    });
  }
  open(): void {
    if (this.ctx.store.mock) return;
    if (this.el.open) { this.el.querySelector<HTMLButtonElement>('.ui-pipeline__compact')?.focus(); return; }
    this.compact ? this.el.show() : this.el.showModal();
    this.movable?.refresh();
    setAttr(this.button, 'aria-expanded', 'true');
    void this.load(); this.timer = setInterval(() => void this.load(), 30_000);
  }
  private syncMode(): void {
    this.el.classList.toggle('is-compact', this.compact);
    this.el.toggleAttribute('data-nonmodal', this.compact);
    setAttr(this.compactButton, 'aria-pressed', String(this.compact));
    setText(this.compactButton, this.compact ? tr('Expandir') : tr('Compactar'));
  }
  private setCompact(compact: boolean): void {
    if (this.compact === compact) return;
    const open = this.el.open;
    const rect = this.el.getBoundingClientRect();
    if (open) { this.switching++; this.el.close(); }
    this.compact = compact;
    this.syncMode();
    try { localStorage.setItem('habblaud.pipeline.compact', String(compact)); } catch { /* Storage is optional. */ }
    if (open) {
      this.compact ? this.el.show() : this.el.showModal();
      this.movable?.place({ x: rect.left, y: rect.top, w: compact ? 360 : 920, h: compact ? 500 : Math.min(820, innerHeight - 40) });
      this.compactButton.focus();
    }
  }
  render(): void { setHidden(this.button, this.ctx.store.mock); }
  private async load(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    setAttr(this.content, 'aria-busy', 'true');
    if (!this.data) setText(this.note, tr('Consultando a programação local…'));
    try {
      const response = await fetch('/api/pipeline');
      if (!response.ok) throw new Error('unavailable');
      this.data = await response.json(); this.draw();
    } catch { setText(this.note, tr('Não foi possível consultar a esteira. Use Atualizar para tentar novamente.')); }
    finally { this.busy = false; setAttr(this.content, 'aria-busy', 'false'); }
  }
  private resultText(result: PipelineResult): string {
    if (result.state === 'mismatch') return tr('ID não corresponde ao repasse do dia');
    if (result.state === 'unavailable') return tr('Arquivo de resultado indisponível');
    if (result.state === 'missing') return tr('Sem resultado validado para esta data');
    const labels = { no_action: tr('Sem ação solicitada'), complete: tr('Concluído'), partial: tr('Parcial'), blocked: tr('Bloqueado'), unknown: tr('Estado não reconhecido') };
    return `${labels[result.outcome ?? 'unknown']} · ${tr('ID validado')}`;
  }
  private row(r: PipelineRoutine, expanded: Set<string>): HTMLElement {
    const states = { active: tr('Ativa'), paused: tr('Pausada'), documented: tr('Só documentada'), definition: tr('Sem agenda confirmada'), unconfirmed: tr('Não revalidada') };
    const time = h('div', { class: 'ui-pipeline__time', text: r.time ? `${r.approximate ? '~' : ''}${r.time}` : '—' });
    const owner = h('span', { class: 'ui-pipeline__owner', text: r.runner === r.agent ? PROVIDER_NAME[r.agent] : `${PROVIDER_NAME[r.agent]} · ${tr('via')} ${PROVIDER_NAME[r.runner]}` });
    owner.style.setProperty('--team', TEAM_SHIRTS[r.agent]);
    const meta = h('div', { class: 'ui-pipeline__meta' }, owner);
    const info = h('div', { class: 'ui-pipeline__info' }, h('div', { class: 'ui-pipeline__row-head' }, h('h3', { text: r.title }), h('span', { class: `ui-pipeline__state is-${r.state}`, text: states[r.state] })), meta);
    const weekdays: Record<string, string> = { MO: tr('Segunda'), TU: tr('Terça'), WE: tr('Quarta'), TH: tr('Quinta'), FR: tr('Sexta'), SA: tr('Sábado'), SU: tr('Domingo') };
    if (r.time) meta.append(h('p', { text: r.note === 'monday' ? tr('Segundas-feiras · horário documentado') : r.weekly ? r.days?.map(day => weekdays[day]).join(', ') || tr('Recorrência semanal') : tr('Diariamente') }));
    if (r.nextAt) meta.append(h('p', { class: 'ui-pipeline__next', text: `${tr('Próximo previsto')}: ${dateTime(r.nextAt)}` }));
    if (r.note === 'claude-time') info.append(h('p', { class: 'ui-pipeline__notice', text: tr('O app exibe ~07:32; o contrato da esteira prevê 07:45. O histórico do app aparece abaixo. Nenhum horário foi alterado.') }));
    if (r.lastRun) info.append(h('p', { text: `${tr('Histórico do app')}: ${date(r.lastRun.date)} ${r.lastRun.time} · ${r.lastRun.completed ? tr('Execução concluída') : tr('Estado não confirmado')}` }));
    if (r.result) info.append(h('p', { class: `ui-pipeline__result is-${r.result.state}`, text: `${tr('Resultado de hoje')}: ${this.resultText(r.result)}` }));
    const details = h('details', { class: 'ui-pipeline__details' }, h('summary', { text: tr('Fonte e comprovantes') }), h('p', { text: r.source }));
    details.dataset.routineId = r.id;
    details.open = expanded.has(r.id);
    if (r.checkedAt) details.append(h('p', { text: `${r.verification === 'app' ? tr('App consultado em') : tr('Arquivo consultado em')}: ${dateTime(r.checkedAt)}` }));
    if (r.lastResult?.id) details.append(h('p', { text: `${tr('Último resultado validado')}: ${date(r.lastResult.date)} · ${r.lastResult.id}` }));
    if (!r.result && !r.lastRun) details.append(h('p', { text: tr('A programação, por si só, não comprova execução.') }));
    info.append(details);
    return h('li', { class: 'ui-pipeline__row' }, time, info);
  }
  private draw(): void {
    const data = this.data;
    if (!data) return;
    const scroll = this.content.scrollTop;
    const expanded = new Set(Array.from(this.content.querySelectorAll<HTMLDetailsElement>('details[open]')).map(el => el.dataset.routineId!));
    setText(this.note, `${data.timeZone} · ${tr('Consulta')}: ${dateTime(data.collectedAt)}`);
    this.note.title = this.note.textContent ?? '';
    this.content.replaceChildren();
    const rows = data.routines.filter(r => this.filter === 'all' || r.group === 'morning');
    this.content.append(h('p', { class: 'ui-pipeline__intro', text: tr('Veja quem executa cada etapa, o horário programado e os comprovantes disponíveis. Esta tela apenas consulta a esteira.') }));
    const list = h('ol', { class: 'ui-pipeline__list', attrs: { 'aria-label': tr('Rotinas em ordem de horário') } }, ...rows.map(r => this.row(r, expanded)));
    if (rows.length) this.content.append(list);
    else this.content.append(h('p', { text: tr('Nenhuma rotina encontrada nas fontes consultadas.') }));
    const coverage = h('section', { class: 'ui-pipeline__coverage' }, h('h3', { text: tr('O que foi conferido') }));
    for (const source of data.coverage) {
      const status = source.kind === 'config' ? tr('Configuração local atual') : source.kind === 'app' ? source.empty ? tr('Nenhuma rotina nativa na última leitura do app') : tr('Agenda consultada no app') : source.agent === 'codex' ? tr('Parte da configuração local não pôde ser lida') : tr('Agenda nativa não revalidada');
      coverage.append(h('p', {}, h('strong', { text: `${PROVIDER_NAME[source.agent]}: ` }), status, source.checkedAt && source.kind !== 'config' ? ` · ${dateTime(source.checkedAt)}` : ''));
    }
    coverage.append(h('p', { class: 'ui-pipeline__footnote', text: tr('Configurações e arquivos são relidos a cada 30 s enquanto esta janela está aberta. A leitura das agendas nativas tem a data indicada; próximo previsto não garante disparo.') }));
    this.content.append(coverage);
    this.content.scrollTop = scroll;
  }
}
