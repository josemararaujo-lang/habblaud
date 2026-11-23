import type { AppearanceParts } from './appearance';
import type { Provider } from './types';

/** Josemar's team identity: clothing carries the provider, leaving only the name in the label. */
export const TEAM_SHIRTS: Readonly<Record<Provider, string>> = {
  claude: '#e88935',
  codex: '#347fd3',
  'grok-bot': '#24282e',
  gemini: '#f0c945',
};

export function teamUniform(provider: Provider = 'claude', parts?: AppearanceParts): AppearanceParts {
  return { ...parts, topStyle: 'tshirt', top: TEAM_SHIRTS[provider], topAccent: TEAM_SHIRTS[provider] };
}
