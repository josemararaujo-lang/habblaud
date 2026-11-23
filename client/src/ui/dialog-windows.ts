import './dialog-windows.css';
import { Movable } from './movable';
import { iconButton } from './dom';
import { ICONS } from './icons';
import { tr } from '../../../shared/i18n';

const windows = new WeakMap<HTMLElement, Movable>();
const handles = new WeakMap<HTMLElement, HTMLElement>();
const anchors = new WeakMap<HTMLElement, { top: string; right: string }>();
const selector = 'dialog, .ui-popover';

/** Adapt the existing movement system, without replacing native dialog/popover behavior. */
export function dialogWindow(el: HTMLElement): Movable | undefined {
  const previous = windows.get(el);
  const header = el.querySelector<HTMLElement>('.ui-dialog__head, .ui-popover__head, .ui-pipeline__header, .ui-deliv-modal__head, .ui-deliv-viewer__bar, .ui-world-dialog__head, .ui-world-popup__head');
  if (!header) return undefined;
  if (previous && handles.get(el) === header) return previous;
  el.classList.add('ui-window');
  const id = el.id || el.getAttribute('aria-labelledby') || [...el.classList].find(c => c !== 'ui-dialog' && c !== 'ui-popover' && c !== 'ui-window') || 'dialog';
  const movable = previous ?? new Movable(el, header, { key: `habblaud.move.dialog.${id}`, contained: true });
  if (previous) { previous.bindHandle(header); previous.refresh(); }
  windows.set(el, movable);
  handles.set(el, header);
  const reset = iconButton(ICONS.restore, tr('Restaurar tamanho e posição'), () => {
    movable.dock();
    const anchor = anchors.get(el);
    if (anchor) { el.style.top = anchor.top; el.style.right = anchor.right; }
  }, 'ui-window-reset');
  const controls = header.querySelector('.ui-pipeline__actions') || header;
  const last = controls.lastElementChild;
  if (last?.matches('button')) controls.insertBefore(reset, last);
  else controls.append(reset);
  if (!previous) {
    if (el.hasAttribute('popover')) el.addEventListener('beforetoggle', event => {
      if ((event as ToggleEvent).newState === 'open') anchors.set(el, { top: el.style.top, right: el.style.right });
    });
    el.addEventListener('toggle', () => movable.refresh());
  }
  return movable;
}

/** Lazy panels (such as Meu dia) join the same system when inserted. */
export class DialogWindows {
  constructor(root: HTMLElement) {
    const scan = (node: HTMLElement) => {
      const parent = node.closest?.<HTMLElement>(selector);
      if (parent) dialogWindow(parent);
      for (const el of node.querySelectorAll?.<HTMLElement>(selector) ?? []) dialogWindow(el);
    };
    scan(root);
    if (typeof MutationObserver !== 'function') return;
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes') {
          const el = record.target as HTMLElement;
          if (el.hasAttribute('open')) windows.get(el)?.refresh();
        } else for (const node of record.addedNodes) if (node instanceof HTMLElement) scan(node);
      }
    }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
  }
}
