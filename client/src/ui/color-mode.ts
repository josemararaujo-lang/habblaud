import type { UiPrefs } from './prefs';

export function resolveColorMode(mode: UiPrefs['colorMode'], systemDark: boolean): 'light' | 'dark' {
  return mode === 'auto' ? systemDark ? 'dark' : 'light' : mode;
}

/** Interface-only preference; the office's seasonal theme and daylight stay independent. */
export class ColorMode {
  private system = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  constructor(private root: HTMLElement, private get: () => UiPrefs['colorMode']) {
    this.system?.addEventListener?.('change', () => this.apply());
    this.apply();
  }
  apply(): void {
    const mode = resolveColorMode(this.get(), this.system?.matches ?? false);
    this.root.setAttribute('data-color-mode', mode);
    this.root.style.setProperty('color-scheme', mode);
  }
}
