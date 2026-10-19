import { describe, expect, it } from 'vitest';
import { automaticFrame, overviewFrame } from './camera';

const building = { x: 0, y: 0, w: 6 * 16 * 16, h: 29 * 16 };
const insets = { top: 108, right: 0, bottom: 48, left: 0 };

describe('enquadramento automático', () => {
  it('amplia as salas em um celular vertical sem cortar a altura do prédio', () => {
    const full = overviewFrame(building, 469, 827, insets);
    const compact = automaticFrame(building, 469, 827, insets);
    expect(compact.zoom).toBeGreaterThan(full.zoom * 1.5);
    expect(compact.zoom).toBeLessThanOrEqual(full.zoom * 2.2);
    expect((building.h + 3.5 * 16) * compact.zoom).toBeLessThan(827 - insets.top - insets.bottom);
    expect([compact.cx, compact.cy, compact.dy]).toEqual([full.cx, full.cy, full.dy]);
  });

  it('mantém a visão completa em tela larga ou horizontal', () => {
    expect(automaticFrame(building, 1440, 900, insets)).toEqual(overviewFrame(building, 1440, 900, insets));
    expect(automaticFrame(building, 580, 420, insets)).toEqual(overviewFrame(building, 580, 420, insets));
  });
});

import { occupiedBounds } from './camera';
it('fits occupied rooms and preserves the fallback for an empty office', () => {
  expect(occupiedBounds([], building)).toEqual(building);
  expect(occupiedBounds([{ x: 200, y: 100, w: 100, h: 100 }, { x: 400, y: 100, w: 100, h: 200 }], building)).toEqual({ x: 200, y: 100, w: 300, h: 200 });
});
