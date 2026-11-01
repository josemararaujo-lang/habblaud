// Integração da fonte do Grok Bot: uma pasta do app temporária (fatias sintéticas), o AccountsService e o Office.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentInfo } from '../../../shared/types';
import { AccountsService } from '../../accounts/service';
import { setQuiet } from '../../log';
import { NameStore } from '../../model/names';
import { Office } from '../../model/office';
import { encodeSliceName, PERSISTENCE_DIR } from './replica';
import { discoverGrokDirs, GrokSource, grokCwd } from './source';

setQuiet(true);

const ACC = 'auth0%7Cuser_TESTE';
const A1 = '11111111-2222-4333-8444-555555555555';
const A2 = '66666666-7777-4888-8999-000000000000';
const MIN = 60_000;

let cleanups: Array<() => void> = [];
afterEach(() => {
  for (const c of cleanups) c();
  cleanups = [];
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'habblaud-grok-'));
  const store = join(dir, PERSISTENCE_DIR);
  mkdirSync(store);
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  let clock = 1_790_000_000_000;
  const now = () => clock;
  const late: { office?: Office } = {};
  const accounts = new AccountsService({ dirs: [], home: dir, env: {}, now, onChange: () => late.office?.markDirty() });
  const office = new Office({
    names: new NameStore(null),
    version: 'teste',
    startedAt: clock,
    accounts: (s) => accounts.list(s),
    sources: () => [],
    accountName: (id) => accounts.find(id)?.detected.name,
    now,
  });
  late.office = office;
  const source = new GrokSource({ accounts, office, dirs: [dir], env: {}, home: dir, now });
  cleanups.unshift(() => source.stop());
  const slice = (key: string, value: unknown) => writeFileSync(join(store, encodeSliceName(`sand.client.slice.account.${ACC}.${key}`)), JSON.stringify({ schemaVersion: 1, value }));
  return {
    dir,
    accounts,
    office,
    source,
    now,
    advance(ms: number) {
      clock += ms;
    },
    roster(rows: Array<Record<string, unknown>>) {
      slice('roster.last-roster', { rows });
    },
    transcript(agent: string, entries: Array<Record<string, unknown>>) {
      slice(`transcript.replicas.${agent}`, { entries });
    },
    usage(percentUsed: number) {
      slice('weekly-usage.cache', { kind: 'present', reading: { usage: { percentUsed, nextResetMs: clock + 86_400_000 }, readAtMs: clock } });
    },
    poll(boot = false) {
      source.poll(boot);
      office.tick();
      office.commit();
    },
    agents(): AgentInfo[] {
      return office.commit().snapshot.agents;
    },
  };
}

describe('fonte do Grok Bot', () => {
  it('acha a pasta só com sand-client-persistence/', () => {
    const t = setup();
    expect(discoverGrokDirs({ HABBLAUD_GROK_DIRS: t.dir }, t.dir)).toEqual([t.dir]);
    expect(discoverGrokDirs({}, join(t.dir, 'outro-home'))).toEqual([]);
  });

  it('registra a conta "Grok Bot" e o uso semanal', () => {
    const t = setup();
    t.usage(12.5);
    t.poll(true);
    const acc = t.accounts.entriesOf('grok')[0];
    expect(acc.detected).toMatchObject({ id: 'grok', provider: 'grok', short: 'G', name: 'Grok Bot' });
    expect(t.accounts.usageView('grok').usage?.sevenDay?.utilization).toBe(12.5);
  });

  it('agente com atividade recente entra na sala com o nome dele; parado há muito, não entra', () => {
    const t = setup();
    const at = t.now();
    t.roster([
      { id: A1, name: 'Hubness', lastActivityAt: at - 5 * MIN },
      { id: A2, name: 'Velho', lastActivityAt: at - 5 * 60 * MIN },
    ]);
    t.transcript(A1, [
      { kind: 'message', id: 'u', seq: 1, role: 'user', content: 'Revisa o PR', timestampMs: at - 6 * MIN },
      { kind: 'send-message', id: 's', seq: 2, timestampMs: at - 5 * MIN, message: { type: 'text', content: 'Revisei, está ok.' } },
    ]);
    t.poll(true);
    const agents = t.agents();
    expect(agents).toHaveLength(1);
    const a = agents[0];
    expect(a).toMatchObject({ id: `grok:${A1}`, provider: 'grok', account: 'grok', status: 'idle', title: 'Hubness', kind: 'main' });
    expect(t.office.commit().snapshot.rooms.find((r) => r.id === a.roomId)?.path).toBe(grokCwd('Hubness'));
    expect(a.activity?.text).toBe('Respondeu: “Revisei, está ok.”');
  });

  it('mensagem nova sua: trabalhando; resposta: atividade nova; parado por mais de 1 h: sai', () => {
    const t = setup();
    const at = t.now();
    t.roster([{ id: A1, name: 'Clivo+', lastActivityAt: at - 10 * MIN }]);
    t.transcript(A1, [{ kind: 'send-message', id: 's0', seq: 1, timestampMs: at - 10 * MIN, message: { type: 'text', content: 'Oi' } }]);
    t.poll(true);
    expect(t.agents()[0].status).toBe('idle');

    t.advance(1_000);
    t.transcript(A1, [
      { kind: 'send-message', id: 's0', seq: 1, timestampMs: at - 10 * MIN, message: { type: 'text', content: 'Oi' } },
      { kind: 'message', id: 'u1', seq: 2, role: 'user', content: 'Roda os testes', timestampMs: t.now() },
    ]);
    t.poll();
    expect(t.agents()[0].status).toBe('working');
    expect(t.agents()[0].activity?.kind).toBe('prompt');

    t.advance(2_000);
    t.transcript(A1, [
      { kind: 'send-message', id: 's0', seq: 1, timestampMs: at - 10 * MIN, message: { type: 'text', content: 'Oi' } },
      { kind: 'message', id: 'u1', seq: 2, role: 'user', content: 'Roda os testes', timestampMs: t.now() - 2_000 },
      { kind: 'send-message', id: 's1', seq: 3, timestampMs: t.now(), message: { type: 'text', content: 'Todos passaram.' } },
    ]);
    t.poll();
    expect(t.agents()[0].activity?.text).toBe('Respondeu: “Todos passaram.”');

    t.advance(61 * MIN);
    t.poll();
    expect(t.agents()[0].status).toBe('offline');
  });

  it('pergunta pendente: esperando você, com o motivo', () => {
    const t = setup();
    const at = t.now();
    t.roster([{ id: A1, name: 'Mentors', lastActivityAt: at - 2 * 60 * MIN }]);
    t.transcript(A1, [{ kind: 'send-message', id: 'w', seq: 1, timestampMs: at - 2 * 60 * MIN, message: { type: 'widget', widget: { prompt: 'Posso publicar?' } } }]);
    t.poll(true);
    expect(t.agents()[0]).toMatchObject({ status: 'waiting', waitingFor: 'responder uma pergunta no Grok Bot' });
  });

  it('agente apagado da lista sai do escritório', () => {
    const t = setup();
    t.roster([{ id: A1, name: 'Genesis', lastActivityAt: t.now() }]);
    t.poll(true);
    expect(t.agents()[0].status).not.toBe('offline');
    t.roster([]);
    t.advance(1_000);
    t.poll();
    expect(t.agents()[0].status).toBe('offline');
  });

  it('sem terminal: a conversa do Grok não é um transcript', () => {
    const t = setup();
    t.roster([{ id: A1, name: 'X', lastActivityAt: t.now() }]);
    t.poll(true);
    expect(t.source.transcriptPathOf()).toBeUndefined();
    expect(t.source.sources()).toEqual([{ label: 'grok', provider: 'grok', path: t.dir, sessions: 1, ok: true }]);
  });
});
