import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import type { SourceInfo } from '../../shared/types';
import type { Office } from '../model/office';
import type { AccountsService } from '../accounts/service';
import type { AgentSource } from './source';
import { readGeminiCache, readGrokCache } from './desktop-cache';
import { tr } from '../../shared/i18n';

const run = promisify(execFile);

export class DesktopSource implements AgentSource {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private stopped = false;
  private present = new Set<string>();
  private info: SourceInfo;
  private account = '';
  constructor(readonly provider: 'grok-bot' | 'gemini', private home: string, private office: Office, private accounts: AccountsService) {
    this.info = { provider, label: provider, path: '', sessions: 0, ok: false };
  }
  async start(): Promise<void> {
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), 2_000);
  }
  stop(): void { this.stopped = true; clearInterval(this.timer); }
  sources(): SourceInfo[] { return [{ ...this.info }]; }
  transcriptPathOf(): undefined { return undefined; }
  private async refresh(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    const previousInfo = JSON.stringify(this.info);
    try {
      const name = this.provider === 'gemini' ? 'Gemini' : 'Grok Bot';
      const app = `/Applications/${name}.app`;
      const { stdout } = await run('/bin/ps', ['-A', '-o', 'comm='], { maxBuffer: 1_000_000 });
      if (this.stopped) return;
      const open = stdout.split('\n').some(line => line.trim() === `${app}/Contents/MacOS/${name}`);
      const now = Date.now();
      const path = this.provider === 'gemini'
        ? join(this.home, 'Library/Caches/com.google.GeminiMacOS/Gemini/user1/ChatInfo2.store')
        : join(this.home, 'Library/Application Support/Grok Bot/sand-client-persistence');
      const records = open ? (this.provider === 'gemini' ? readGeminiCache(path) : readGrokCache(path, now)) : [];
      if (!this.account && records.length) {
        this.account = this.accounts.setProviderAccounts(this.provider, [{ dir: path, detected: { id: this.provider, provider: this.provider, configDir: path, short: name[0], name, color: this.provider === 'gemini' ? '#4aa8e8' : '#9aa4b4' } }])[0].id;
      }
      const next = new Set<string>();
      for (const r of records) {
        const id = `${this.provider}:${r.id}`;
        next.add(id);
        this.office.observeDesktop({ id, provider: this.provider, account: this.account, sessionId: id, cwd: app, role: tr('Observação local do app'), startedAt: now, status: r.state, waitingFor: r.state === 'waiting' ? tr('Responder no app') : undefined }, r.name, r.eventAt);
      }
      for (const id of this.present) if (!next.has(id)) this.office.closeMain(id);
      this.present = next;
      this.info = { provider: this.provider, label: name, path, sessions: records.length, ok: open, ...(!open ? { error: tr('App fechado') } : {}) };
    } catch {
      // A read failure invalidates the previous live status immediately.
      for (const id of this.present) {
        const a = this.office.get(id);
        if (a) this.office.observeDesktop({ id, provider: this.provider, account: a.account, sessionId: a.sessionId, cwd: this.office.roomPath(a.roomId) ?? this.home, role: a.role, startedAt: a.startedAt, status: 'unknown' }, a.name, a.lastEventAt);
      }
      this.info = { ...this.info, ok: false, error: tr('Fonte local indisponível') };
    } finally {
      if (JSON.stringify(this.info) !== previousInfo) this.office.markDirty();
      this.running = false;
    }
  }
}
