import type { ExternalAgentInfo } from '../../../shared/types';
import { tr } from '../../../shared/i18n';
import { h, setText } from './dom';

export class ExternalAgentsPanel {
  readonly el = h('section', { class: 'ui-external', attrs: { 'aria-label': tr('Grok Bot e Gemini') } });
  private rows = new Map<string, { status: HTMLElement; evidence: HTMLElement }>();
  constructor() {
    this.el.append(h('h3', { text: tr('Grok Bot e Gemini') }), h('p', { class: 'ui-section-hint', text: tr('Resultados da rotina da manhã · atualização a cada 30 s.') }));
    for (const [id, name] of [['grok-bot', 'Grok Bot'], ['gemini', 'Gemini']]) {
      const status = h('p');
      const evidence = h('p', { class: 'ui-work__room' });
      this.rows.set(id, { status, evidence });
      this.el.append(h('article', { class: 'ui-external__card' }, h('strong', { text: name }), status, evidence));
    }
  }
  render(agents: readonly ExternalAgentInfo[]): void {
    const labels: Record<ExternalAgentInfo['state'], string> = {
      no_handoff: tr('Sem repasse válido hoje'),
      pending: tr('Aguardando resultado · execução não confirmada'),
      no_action: tr('Sem ação nesta rotina'),
      completed: tr('Resultado pronto para revisar'),
      blocked: tr('Bloqueio registrado · conferir resultado'),
      unknown: tr('Resultado sem validação'),
      unavailable: tr('Fonte local indisponível'),
    };
    for (const [id, row] of this.rows) {
      const agent = agents.find(a => a.id === id);
      setText(row.status, agent ? labels[agent.state] : tr('Fonte local indisponível'));
      setText(row.evidence, agent ? `${agent.date}${agent.handoffId ? ` · ${agent.handoffId}` : ''}` : '');
    }
  }
}
