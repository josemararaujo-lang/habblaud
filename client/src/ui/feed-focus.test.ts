import { describe, expect, it } from 'vitest';
import type { ActivityKind, FeedItem } from '../../../shared/types';
import { GITHUB_TOOL } from '../../../shared/github';
import { feedRows, isImportantFeedItem } from './feed-focus';

function event(id: string, kind: ActivityKind, text = id, at = 0, agentId = 'a'): FeedItem {
  return { id, agentId, roomId: 'r', roomName: 'Sala', agentName: agentId,
    activity: { id, kind, text, icon: '•', at } };
}

describe('feed com foco', () => {
  it('guarda pedidos, erros e fim de shell, mas tira leitura, pensamento e chamadas comuns do modo importante', () => {
    const items = [event('pedido', 'prompt'), event('pensando', 'think'), event('leitura', 'read'),
      event('ferramenta', 'mcp'), event('erro', 'mcp'), event('shell', 'run'), event('git-consulta', 'git'),
      event('push', 'git'), event('fim', 'done')];
    items[4].activity.error = true;
    items[5].activity.tool = 'ShellDone';
    items[7].activity.tool = GITHUB_TOOL;
    expect(items.filter(isImportantFeedItem).map((item) => item.id)).toEqual(['pedido', 'erro', 'shell', 'push', 'fim']);
    expect(feedRows(items, 'important').map((item) => item.id)).toEqual(['pedido', 'erro', 'shell', 'push', 'fim']);
  });

  it('agrupa passos operacionais consecutivos sem juntar agentes ou pedidos independentes', () => {
    const items = [event('a1', 'think', 'Pensando…', 1000), event('a2', 'think', 'Pensando…', 2000),
      event('b1', 'think', 'Pensando…', 3000, 'b'), event('p1', 'prompt', 'Novo pedido', 4000),
      event('p2', 'prompt', 'Novo pedido', 5000)];
    expect(feedRows(items, 'all').map((item) => [item.id, item.repeatCount ?? 1])).toEqual([
      ['a2', 2], ['b1', 1], ['p1', 1], ['p2', 1],
    ]);
  });

  it('mantém detalhes e conclusões de comandos separados, mesmo quando o texto é igual', () => {
    const first = event('a1', 'search', 'Buscando…', 1000);
    const second = event('a2', 'search', 'Buscando…', 2000);
    first.activity.detail = 'arquivo A';
    second.activity.detail = 'arquivo B';
    const done1 = event('done1', 'run', 'Shell terminou', 3000);
    const done2 = event('done2', 'run', 'Shell terminou', 4000);
    done1.activity.tool = done2.activity.tool = 'ShellDone';
    expect(feedRows([first, second, done1, done2], 'all').map((item) => item.id)).toEqual(['a1', 'a2', 'done1', 'done2']);
  });
});

it('excludes response typing, generic tools and social simulation from important events', () => {
  expect(feedRows([event('r', 'respond'), event('tool', 'other', 'Usando webrun'), event('social:1', 'other'), event('d', 'done')], 'important').map(x => x.id)).toEqual(['d']);
});
