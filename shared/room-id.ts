/** Canonical identity for a project folder; keep the original path for filesystem access. */
export function canonicalRoomId(path: string): string {
  const p = path.trim().normalize('NFC').replace(/\/{2,}/g, '/');
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}
