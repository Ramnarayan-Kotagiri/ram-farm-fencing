import { describe, it, expect } from 'vitest';
import { baseConfig, preset } from '../src/data/scenarios';
import { supportDimensions } from '../src/geometry/supportGeometry';
import { calculate } from '../src/geometry/materialCalculator';
import { defaultRates } from '../src/data/pricing';

describe('paired diagonal supports', () => {
  it('preserves support length and fits below the main pole top', () => {
    for (const poleLength of [4, 8, 12]) {
      const c = { ...baseConfig, poleLength, embed: 2.5 };
      const d = supportDimensions(c);
      expect(Math.hypot(d.height, d.run)).toBeCloseTo(c.stayLength, 8);
      expect(d.height).toBeLessThanOrEqual(poleLength - c.embed);
    }
  });
  it('counts two support poles at every supported post without duplicating main posts', () => {
    const paired = preset(),
      single = structuredClone(paired);
    for (const sections of Object.values(single.sections)) {
      for (const section of sections) section.config.stayCount = 1;
    }
    const a = calculate(paired, defaultRates),
      b = calculate(single, defaultRates);
    expect(a.posts.length).toBe(b.posts.length);
    expect(a.posts.reduce((n, p) => n + p.stays, 0)).toBe(
      2 * b.posts.reduce((n, p) => n + p.stays, 0),
    );
    expect(a.posts.filter((p) => p.stays > 0).every((p) => p.stays === 2)).toBe(true);
    expect(a.total).toBeGreaterThan(b.total);
  });
});
