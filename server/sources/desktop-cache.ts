// Read-only local metadata. No app API calls, credentials, encrypted payloads or UI automation.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AgentStatus } from '../../shared/types';

export interface DesktopObservation {
  id: string;
  name: string;
  eventAt: number;
  state: AgentStatus;
}

export function decodeCacheKey(name: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, out = '';
  for (const c of name.replace(/\.blob$/, '').toUpperCase()) {
    const n = alphabet.indexOf(c);
    if (n < 0) return '';
    value = (value << 5) | n; bits += 5;
    if (bits >= 8) { bits -= 8; out += String.fromCharCode((value >>> bits) & 255); }
  }
  return out;
}

function cacheValue(path: string): any {
  if (statSync(path).size > 2_000_000) throw new Error('Cache too large');
  return JSON.parse(readFileSync(path, 'utf8')).value;
}

export function readGrokCache(root: string, now: number): DesktopObservation[] {
  const files = readdirSync(root).filter(n => n.endsWith('.blob')).slice(0, 512).map(name => ({ name, key: decodeCacheKey(name) }));
  const rosterFile = files.find(f => f.key.endsWith('.roster.last-roster'));
  if (!rosterFile) throw new Error('Roster unavailable');
  const roster = cacheValue(join(root, rosterFile.name));
  if (!Array.isArray(roster?.rows)) throw new Error('Unsupported roster');
  const rows: DesktopObservation[] = [];
  for (const row of roster.rows) {
    if (row.isGroup || row.isHiddenFromSidebar || row.isRemovedFromSidebar || typeof row.id !== 'string' || typeof row.name !== 'string') continue;
    const eventAt = Number(row.lastActivityAt);
    if (!Number.isFinite(eventAt) || eventAt < now - 7 * 86_400_000 || eventAt > now + 60_000) continue;
    let state: AgentStatus = 'unknown';
    const transcript = files.find(f => f.key.endsWith(`.transcript.replicas.${row.id}`));
    if (transcript) {
      try {
        const data = cacheValue(join(root, transcript.name));
        const last = Array.isArray(data?.entries) ? [...data.entries].reverse().find((e: any) => e.kind === 'message') : undefined;
        // A recent, explicit streaming flag is evidence. A prompt or a changed mtime is not.
        if (last?.isStreaming === true && Number(data.persistedAt) > now - 30_000 && Number(data.persistedAt) <= now + 60_000) state = 'working';
      } catch { /* Incomplete write: don't infer a status. */ }
    }
    if (row.awaitingUserResponse === true && eventAt > now - 30_000) state = 'waiting';
    rows.push({ id: row.id, name: row.name.slice(0, 80), eventAt, state });
  }
  return rows;
}

export function readGeminiCache(path: string): DesktopObservation[] {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    // Select only clear metadata. ZENCRYPTEDPROTOBYTES is never read or decrypted.
    const row = db.prepare('SELECT MAX(ZLASTUPDATEDTIME) AS at FROM ZCHATINFOSTOREDMODEL').get();
    const at = Number(row?.at);
    if (!Number.isFinite(at) || at <= 0) return [];
    return [{ id: 'desktop', name: 'Gemini', eventAt: (at + 978307200) * 1000, state: 'unknown' }];
  } finally { db.close(); }
}
