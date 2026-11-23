import { expect, it } from 'vitest';
import { cleanUserText } from '../../../shared/user-text';
import { promptText } from './rollout';
it('extracts the real browser request, including multiline content', () => {
  const raw = '<in-app-browser-context source="ambient-ui-state">Current URL: http://localhost</in-app-browser-context>\n\n## My request:\nMelhore os botões.\nPreserve as cores.';
  expect(cleanUserText(raw)).toBe('Melhore os botões.\nPreserve as cores.');
  expect(promptText(raw)).toBe(cleanUserText(raw));
});
it('does not leak truncated technical titles or remove ordinary requests', () => {
  expect(cleanUserText('# Files mentioned by the user: ## codex-clipboard')).toBe('');
  expect(cleanUserText('<in-app-browser-context source="amb…')).toBe('');
  expect(cleanUserText('<send_user_message_question_reply> [{"questionItemId":"tool…')).toBe('');
  expect(cleanUserText('Revise o componente <button> e o título ## My request:')).toBe('Revise o componente <button> e o título ## My request:');
  expect(promptText('<environment_context>cwd</environment_context>')).toBe('');
});
