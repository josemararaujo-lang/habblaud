import { expect, it } from 'vitest';
import { canonicalRoomId } from '../../shared/room-id';
import { pathKey } from './room-aliases';
it('unifies composed/decomposed Mac folder names while preserving distinct paths and case', () => {
  const path = '/Users/jobs/Desktop/Estruturação';
  expect(canonicalRoomId(` ${path.normalize('NFD')}// `)).toBe(path);
  expect(pathKey(path.normalize('NFD'))).toBe(pathKey(path));
  expect(canonicalRoomId('/')).toBe('/');
  expect(canonicalRoomId('/a/Project')).not.toBe(canonicalRoomId('/a/project'));
  expect(canonicalRoomId('/a/Projeto')).not.toBe(canonicalRoomId('/b/Projeto'));
});
