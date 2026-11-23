import { describe, expect, it } from 'vitest';
import { containBox } from './movable';

describe('floating dialog bounds', () => {
  it('recovers a saved window when a monitor or viewport becomes smaller', () => {
    const result = containBox({ x: 1800, y: 950, w: 920, h: 820 }, { width: 390, height: 700 });
    expect(result).toEqual({ x: 8, y: 8, w: 374, h: 684 });
  });
  it('keeps close and resize controls reachable at every edge', () => {
    for (const x of [-1000, 0, 1000]) for (const y of [-1000, 0, 1000]) {
      const result = containBox({ x, y, w: 360, h: 500 }, { width: 1280, height: 900 });
      expect(result.x).toBeGreaterThanOrEqual(8);
      expect(result.y).toBeGreaterThanOrEqual(8);
      expect(result.x + result.w).toBeLessThanOrEqual(1272);
      expect(result.y + result.h).toBeLessThanOrEqual(892);
    }
  });
  it('allows reading size but fits screens smaller than the minimum', () => {
    expect(containBox({ x: 8, y: 8, w: 10, h: 10 }, { width: 1280, height: 900 })).toEqual({ x: 8, y: 8, w: 300, h: 220 });
    expect(containBox({ x: 8, y: 8, w: 360, h: 500 }, { width: 260, height: 180 })).toEqual({ x: 8, y: 8, w: 244, h: 164 });
  });
});
