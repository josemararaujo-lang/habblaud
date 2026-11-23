import type { Provider } from './types';

export interface PipelineResult {
  state: 'valid' | 'missing' | 'mismatch' | 'unavailable';
  date: string;
  id?: string;
  outcome?: 'no_action' | 'complete' | 'partial' | 'blocked' | 'unknown';
}
export interface PipelineRoutine {
  id: string;
  title: string;
  agent: Provider;
  runner: Provider;
  group: 'morning' | 'other';
  state: 'active' | 'paused' | 'documented' | 'definition' | 'unconfirmed';
  verification: 'config' | 'app' | 'document' | 'file';
  time?: string;
  weekly?: boolean;
  days?: string[];
  nextAt?: number;
  approximate?: boolean;
  checkedAt: number;
  source: string;
  note?: string;
  result?: PipelineResult;
  lastResult?: PipelineResult;
  lastRun?: { date: string; time: string; completed: boolean };
}
export interface PipelineView {
  date: string;
  timeZone: string;
  collectedAt: number;
  routines: PipelineRoutine[];
  coverage: { agent: Provider; kind: 'config' | 'app' | 'partial'; checkedAt: number; empty?: boolean }[];
}
