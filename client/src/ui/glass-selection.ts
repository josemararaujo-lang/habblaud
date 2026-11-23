import { h, setHidden } from './dom';

const installed = new WeakMap<HTMLElement, () => void>();

/** One moving surface beneath the existing buttons; semantics and focus stay on the buttons. */
export function glassSelection(group: HTMLElement, selector: string): () => void {
  const previous = installed.get(group);
  if (previous) return previous;
  const indicator = h('span', { class: 'ui-glass-selection', attrs: { 'aria-hidden': 'true' } });
  group.classList.add('ui-glass-nav');
  group.prepend(indicator);
  let frame = 0;
  let readyFrame = 0;
  const measure = () => {
    frame = 0;
    const active = group.querySelector<HTMLElement>(selector);
    if (!active || !active.offsetWidth || !group.offsetWidth) { setHidden(indicator, true); return; }
    const ready = group.classList.contains('is-measured');
    setHidden(indicator, false);
    indicator.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.height = `${active.offsetHeight}px`;
    // Do not sweep from the origin when a previously hidden panel first opens.
    if (!ready && !readyFrame) readyFrame = requestAnimationFrame(() => { readyFrame = 0; group.classList.add('is-measured'); });
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
  const resize = new ResizeObserver(schedule);
  resize.observe(group);
  // Observe the buttons too: counts, translations and font loading can change their size.
  for (const button of group.querySelectorAll('button')) resize.observe(button);
  const changes = new MutationObserver(schedule);
  changes.observe(group, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-checked', 'hidden'], childList: true, characterData: true });
  schedule();
  const dispose = () => {
    cancelAnimationFrame(frame); cancelAnimationFrame(readyFrame);
    resize.disconnect(); changes.disconnect(); indicator.remove();
    group.classList.remove('ui-glass-nav', 'is-measured');
    installed.delete(group);
  };
  installed.set(group, dispose);
  return dispose;
}

/** Includes lazy dialogs; releases observers when a dynamic control leaves the UI. */
export class GlassControls {
  constructor(root: HTMLElement) {
    const selector = '.ui-seg, .ui-feed__modes, .ui-work__filters';
    const groups = new Map<HTMLElement, () => void>();
    const scan = (node: HTMLElement) => {
      const candidates = [...node.querySelectorAll<HTMLElement>(selector)];
      if (node.matches(selector)) candidates.unshift(node);
      for (const group of candidates) {
        if (groups.has(group)) continue;
        const active = group.matches('.ui-feed__modes')
          ? 'button:not(.ui-feed__scope)[aria-pressed="true"]'
          : 'button[aria-checked="true"], button[aria-pressed="true"]';
        groups.set(group, glassSelection(group, active));
      }
    };
    scan(root);
    new MutationObserver(records => {
      let removed = false;
      for (const record of records) {
        for (const node of record.addedNodes) if (node instanceof HTMLElement) scan(node);
        removed ||= record.removedNodes.length > 0;
      }
      if (removed) for (const [group, dispose] of groups) {
        if (!root.contains(group)) { dispose(); groups.delete(group); }
      }
    }).observe(root, { childList: true, subtree: true });
  }
}
