import './pipeline.css';
import type { PipelineRoutine, PipelineView, PipelineResult } from '../../../shared/pipeline';
import { TEAM_SHIRTS } from '../../../shared/team-uniform';
import { tr, getLocale } from '../../../shared/i18n';
import { PROVIDER_NAME } from './provider';
import { h, setAttr, setHidden, setText } from './dom';
import type { UiComponent, UiContext } from './context';

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
  constructor(private ctx: UiContext) {
    const close = h('button', { class: 'ui-btn', type: 'button', text: tr('Fechar'), on: { click: () => this.el.close() } });
    const refresh = h('button', { class: 'ui-btn', type: 'button', text: tr('Atualizar'), on: { click: () => void this.load() } });
    this.el = h('dialog', { class: 'ui-dialog ui-pipeline', attrs: { 'aria-labelledby': 'pipeline-title' } },
      h('header', { class: 'ui-pipeline__header' }, h('div', {}, h('h2', { text: tr('Minha esteira'), attrs: { id: 'pipeline-title' } }), this.note), h('div', { class: 'ui-pipeline__actions' }, refresh, close)),
      this.filters, this.content);
    for (const [key, label] of [['morning', tr('Manhã')], ['all', tr('Todas as rotinas')]] as const) {
      const b = h('button', { type: 'button', text: label, attrs: { 'aria-pressed': key === this.filter ? 'true' : 'false' }, on: { click: () => {
        this.filter = key;
        for (const option of this.filters.children) setAttr(option, 'aria-pressed', String(option === b));
        this.draw();
      } } }); this.filters.append(b);
    }
    this.button.addEventListener('click', () => this.open());
    this.el.addEventListener('close', () => { clearInterval(this.timer); setAttr(this.button, 'aria-expanded', 'false'); this.button.focus(); });
  }
  open(): void {
    if (this.el.open || this.ctx.store.mock) return;
    this.el.showModal(); setAttr(this.button, 'aria-expanded', 'true');
    void this.load(); this.timer = setInterval(() => void this.load(), 30_000);
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
    const info = h('div', { class: 'ui-pipeline__info' }, h('div', { class: 'ui-pipeline__row-head' }, h('h3', { text: r.title }), h('span', { class: `ui-pipeline__state is-${r.state}`, text: states[r.state] })), owner);
    const weekdays: Record<string, string> = { MO: tr('Segunda'), TU: tr('Terça'), WE: tr('Quarta'), TH: tr('Quinta'), FR: tr('Sexta'), SA: tr('Sábado'), SU: tr('Domingo') };
    if (r.time) info.append(h('p', { text: r.note === 'monday' ? tr('Segundas-feiras · horário documentado') : r.weekly ? r.days?.map(day => weekdays[day]).join(', ') || tr('Recorrência semanal') : tr('Diariamente') }));
    if (r.nextAt) info.append(h('p', { class: 'ui-pipeline__next', text: `${tr('Próximo previsto')}: ${dateTime(r.nextAt)}` }));
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
