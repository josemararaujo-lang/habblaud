import type { Activity, FeedItem } from '../../../shared/types';
import { GITHUB_TOOL } from '../../../shared/github';
import { shellDoneKind } from './model';

export type FeedMode = 'important' | 'all';
export type FeedRow = FeedItem & { repeatCount?: number };

const IMPORTANT = new Set<Activity['kind']>([
  'prompt', 'edit', 'write', 'test', 'plan', 'delegate',
  'communicate', 'ask', 'wait', 'error', 'done',
]);
const REPEATABLE = new Set<Activity['kind']>(['respond', 'think', 'read', 'search', 'run', 'mcp', 'skill', 'browser', 'web']);
const REPEAT_WINDOW_MS = 60_000;

export function isImportantFeedItem(item: FeedItem): boolean {
  const activity = item.activity;
  if (activity.error || shellDoneKind(activity)) return true;
  if (activity.kind === 'git') return activity.tool === GITHUB_TOOL;
  if (IMPORTANT.has(activity.kind)) return true;
  // Unknown tool calls and decorative social events remain available in All.
  return false;
}

export function feedRows(items: readonly FeedItem[], mode: FeedMode, limit = 50): FeedRow[] {
  const rows: FeedRow[] = [];
  for (const item of items) {
    if (mode === 'important' && !isImportantFeedItem(item)) continue;
    const previous = rows[rows.length - 1];
    if (
      previous && !item.activity.error && !shellDoneKind(item.activity) && REPEATABLE.has(item.activity.kind) &&
      previous.agentId === item.agentId && previous.roomId === item.roomId &&
      previous.activity.kind === item.activity.kind && previous.activity.tool === item.activity.tool &&
      previous.activity.text === item.activity.text && previous.activity.detail === item.activity.detail &&
      item.activity.at >= previous.activity.at && item.activity.at - previous.activity.at <= REPEAT_WINDOW_MS
    ) {
      rows[rows.length - 1] = { ...item, repeatCount: (previous.repeatCount ?? 1) + 1 };
    } else {
      rows.push(item);
    }
  }
  return rows.slice(-limit);
}
