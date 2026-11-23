import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { decodeCacheKey, readGeminiCache, readGrokCache } from './desktop-cache';

const dirs: string[] = [];
const now = 1_795_409_000_000;
function fixture() { const dir = mkdtempSync(join(tmpdir(), 'habblaud-desktop-')); dirs.push(dir); return dir; }
function key(text: string): string {
  let bits = 0, value = 0, out = '';
  for (const c of Buffer.from(text)) {
    value = (value << 8) | c; bits += 8;
    while (bits >= 5) { bits -= 5; out += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[(value >>> bits) & 31]; }
  }
  if (bits) out += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[(value << (5 - bits)) & 31];
  return out.toLowerCase() + '.blob';
}
function grok(dir: string, patch = {}, transcript?: object) {
  writeFileSync(join(dir, key('account.roster.last-roster')), JSON.stringify({ value: { rows: [{ id: 'bot-1', name: 'Test Bot', lastActivityAt: now, ...patch }] } }));
  if (transcript) writeFileSync(join(dir, key('account.transcript.replicas.bot-1')), JSON.stringify({ value: transcript }));
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
describe('desktop metadata', () => {
  it('decodes persisted slice keys', () => { expect(decodeCacheKey('MZXW6.blob')).toBe('foo'); });
  it('does not turn a prompt, file freshness or a cached answer into execution', () => {
    const dir = fixture(); grok(dir);
    expect(readGrokCache(dir, now)[0].state).toBe('unknown');
    grok(dir, {}, { persistedAt: now, entries: [{ kind: 'message', role: 'user', isStreaming: false }] });
    expect(readGrokCache(dir, now)[0].state).toBe('unknown');
  });
  it('requires fresh explicit streaming, and expires it without claiming completion', () => {
    const dir = fixture();
    grok(dir, {}, { persistedAt: now, entries: [{ kind: 'message', isStreaming: true }] });
    expect(readGrokCache(dir, now)[0].state).toBe('working');
    expect(readGrokCache(dir, now + 31_000)[0].state).toBe('unknown');
  });
  it('requires a fresh explicit request before marking a human pending', () => {
    const dir = fixture(); grok(dir, { awaitingUserResponse: true });
    expect(readGrokCache(dir, now)[0].state).toBe('waiting');
    expect(readGrokCache(dir, now + 31_000)[0].state).toBe('unknown');
  });
  it('excludes groups, hidden bots and old activity', () => {
    const dir = fixture(); grok(dir, { isGroup: true }); expect(readGrokCache(dir, now)).toEqual([]);
    grok(dir, { isHiddenFromSidebar: true }); expect(readGrokCache(dir, now)).toEqual([]);
    grok(dir, { lastActivityAt: now - 8 * 86_400_000 }); expect(readGrokCache(dir, now)).toEqual([]);
  });
  it('reads only Gemini metadata with Apple epoch and leaves encrypted content untouched', () => {
    const path = join(fixture(), 'ChatInfo2.store');
    const db = new DatabaseSync(path);
    db.exec('CREATE TABLE ZCHATINFOSTOREDMODEL (ZLASTUPDATEDTIME REAL, ZENCRYPTEDPROTOBYTES BLOB)');
    db.prepare('INSERT INTO ZCHATINFOSTOREDMODEL VALUES (?, ?)').run(now / 1000 - 978307200, Buffer.from('private encrypted content'));
    db.close();
    expect(readGeminiCache(path)).toEqual([{ id: 'desktop', name: 'Gemini', eventAt: now, state: 'unknown' }]);
  });
  it('reports unsupported schema instead of inventing a session', () => {
    const path = join(fixture(), 'unknown.store'); const db = new DatabaseSync(path); db.close();
    expect(() => readGeminiCache(path)).toThrow();
  });
});
