import { h } from './dom';

/** One moving surface beneath the existing buttons; semantics and focus stay on the buttons. */
export function glassSelection(group: HTMLElement, selector: string): void {
  const indicator = h('span', { class: 'ui-glass-selection', attrs: { 'aria-hidden': 'true' } });
  group.classList.add('ui-glass-nav');
  group.prepend(indicator);
  let frame = 0;
  const measure = () => {
    frame = 0;
    const active = group.querySelector<HTMLElement>(selector);
    if (!active || !active.offsetWidth || !group.offsetWidth) { indicator.hidden = true; return; }
    const ready = group.classList.contains('is-measured');
    indicator.hidden = false;
    indicator.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.height = `${active.offsetHeight}px`;
    // Do not sweep from the origin when a previously hidden panel first opens.
    if (!ready) requestAnimationFrame(() => group.classList.add('is-measured'));
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
  new ResizeObserver(schedule).observe(group);
  new MutationObserver(schedule).observe(group, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-checked'] });
  schedule();
}
