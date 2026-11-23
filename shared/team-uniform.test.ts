import { expect, it } from 'vitest';
import { teamUniform, TEAM_SHIRTS } from './team-uniform';

it('uses the four team colours approved by Josemar', () => {
  expect(TEAM_SHIRTS).toEqual({ claude: '#e88935', codex: '#347fd3', 'grok-bot': '#24282e', gemini: '#f0c945' });
  expect(teamUniform().top).toBe(TEAM_SHIRTS.claude);
});

it('changes clothing without replacing the person or mutating stored customisation', () => {
  const parts = { top: '#ff00ff', hair: '#663300', skin: '#cc9966', accessory: 'glasses' as const };
  expect(teamUniform('codex', parts)).toMatchObject({ top: TEAM_SHIRTS.codex, topAccent: TEAM_SHIRTS.codex, topStyle: 'tshirt', hair: parts.hair, skin: parts.skin, accessory: 'glasses' });
  expect(parts.top).toBe('#ff00ff');
});
