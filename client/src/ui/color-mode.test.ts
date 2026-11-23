import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColorMode, resolveColorMode } from './color-mode';
import { DEFAULT_PREFS, loadPrefs, savePrefs, sanitizePrefs, worldOptionsFrom } from './prefs';

afterEach(() => vi.unstubAllGlobals());
describe('interface appearance', () => {
  it('follows the system only in automatic mode', () => {
    expect(resolveColorMode('auto', true)).toBe('dark');
    expect(resolveColorMode('auto', false)).toBe('light');
    expect(resolveColorMode('light', true)).toBe('light');
    expect(resolveColorMode('dark', false)).toBe('dark');
  });
  it('updates automatic mode when the OS changes, preserving an explicit choice', () => {
    const system = { matches: false, addEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', () => system);
    const attributes = new Map<string, string>();
    const root = { setAttribute: (k: string, v: string) => attributes.set(k, v), style: { setProperty: vi.fn() } } as unknown as HTMLElement;
    let mode: 'auto' | 'light' | 'dark' = 'auto';
    const control = new ColorMode(root, () => mode);
    expect(attributes.get('data-color-mode')).toBe('light');
    system.matches = true;
    system.addEventListener.mock.calls[0][1]();
    expect(attributes.get('data-color-mode')).toBe('dark');
    mode = 'light'; control.apply();
    system.addEventListener.mock.calls[0][1]();
    expect(attributes.get('data-color-mode')).toBe('light');
  });
  it('remembers the choice without changing scene or motion preferences', () => {
    let data = '';
    const storage = { getItem: () => data, setItem: (_: string, value: string) => { data = value; } };
    savePrefs(storage, { ...DEFAULT_PREFS, colorMode: 'light', theme: 'halloween' });
    expect(loadPrefs(storage)).toMatchObject({ colorMode: 'light', theme: 'halloween' });
    expect(sanitizePrefs({ colorMode: 'sepia' }).colorMode).toBe('auto');
    expect(worldOptionsFrom({ ...DEFAULT_PREFS, colorMode: 'light' })).toEqual(worldOptionsFrom({ ...DEFAULT_PREFS, colorMode: 'dark' }));
  });
});
