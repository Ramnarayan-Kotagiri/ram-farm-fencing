import { describe, it, expect } from 'vitest';
import { preset, parseScenario } from '../src/data/scenarios';
import { defaultRates } from '../src/data/pricing';
import { originalQuote, originalTotal } from '../src/data/vendorQuote';
import { vertices, sideIds } from '../src/data/farmSurvey';
import { validation, atPath, distance, areaM2, polygon } from '../src/geometry/coordinateTransform';
import {
  calculate,
  placePosts,
  lengthFor,
  validateGates,
  wireHeights,
} from '../src/geometry/materialCalculator';
const calc = (s = preset(), r = { ...defaultRates }) => calculate(s, r);
describe('source geometry', () => {
  it('matches all printed LP distances within rounding tolerance', () => {
    for (const edge of validation)
      expect(Math.abs(edge.calculated - edge.official)).toBeLessThan(0.2);
  });
  it('is a seven-vertex merged polygon with expected area', () => {
    expect(vertices).toHaveLength(7);
    expect(areaM2 / 4046.8564224).toBeCloseTo(22.04, 1);
  });
  it('does not create the internal A-D fence', () => {
    expect(calc().runs.every((r) => ['W', 'N', 'E', 'S'].includes(r.side))).toBe(true);
    expect(calc().runs).toHaveLength(4);
    const a = polygon[0],
      d = polygon[3],
      mid = { x: (a.x + d.x) / 2, z: (a.z + d.z) / 2 };
    expect(calc().posts.every((p) => distance(p, mid) > 30)).toBe(true);
  });
  it('preserves the east and south doglegs', () => {
    expect(atPath('E', 0)).toEqual(polygon[2]);
    expect(atPath('E', 1).x).toBeCloseTo(polygon[4].x);
    expect(atPath('S', 1).z).toBeCloseTo(polygon[6].z);
  });
});
describe('quantity basis and posts', () => {
  it('defaults to 3000ft contractor work and zero north material/cost', () => {
    const r = calc();
    expect(r.newLength).toBe(3000);
    expect(r.bySide.N.net).toBe(0);
    expect(r.bySide.N.cost).toBe(0);
    expect(r.rows.some((row) => row.side === 'N')).toBe(false);
  });
  it('switches quantities without changing survey vertices', () => {
    const s = preset(),
      before = JSON.stringify(vertices);
    s.basis = 'survey';
    expect(calc(s).newLength).toBeCloseTo(2821.13);
    expect(JSON.stringify(vertices)).toBe(before);
  });
  it('reduces spacing from 8ft to 6ft and increases posts', () => {
    const s = preset(),
      before = calc(s).posts.length;
    for (const sec of Object.values(s.sections).flat()) sec.config.spacing = 6;
    expect(calc(s).posts.length).toBeGreaterThan(before);
  });
  it('shares corners and section endpoints only once', () => {
    const s = preset();
    const p = placePosts(s);
    expect(new Set(p.map((p) => p.x.toFixed(3) + ',' + p.z.toFixed(3))).size).toBe(p.length);
    const sec = s.sections.W[0];
    sec.end = 0.5;
    s.sections.W.push({ ...structuredClone(sec), id: 'W-2', start: 0.5, end: 1 });
    const posts = placePosts(s);
    expect(posts.filter((p) => p.side === 'W' && Math.abs(p.fraction - 0.5) < 1e-6)).toHaveLength(
      1,
    );
  });
  it('never exceeds the configured working spacing on new runs', () => {
    const s = preset(),
      posts = placePosts(s);
    for (const side of sideIds) {
      const own = posts.filter((p) => p.side === side).sort((a, b) => a.fraction - b.fraction);
      for (let i = 1; i < own.length; i++)
        expect((own[i].fraction - own[i - 1].fraction) * lengthFor(s, side)).toBeLessThanOrEqual(
          8.00001,
        );
    }
  });
  it('subtracts reused road poles and reduces material cost', () => {
    const s = preset(),
      before = calc(s);
    s.sections.W[0].config.reuse = 'custom';
    s.sections.W[0].config.reusePercent = 100;
    const after = calc(s);
    expect(after.bySide.W.reusedPosts).toBe(after.bySide.W.posts);
    expect(after.bySide.W.newPosts).toBe(0);
    expect(after.total).toBeLessThan(before.total);
  });
  it('good inspections enable reuse and cracked ones do not', () => {
    const s = preset(),
      p = placePosts(s).find((p) => p.side === 'W')!;
    s.sections.W[0].config.reuse = 'good';
    s.inspections[p.id] = {
      condition: 'good',
      role: 'auto',
      exposed: 5.5,
      notes: '',
      footing: false,
      loose: false,
      crossSection: '',
      photo: '',
    };
    expect(calc(s).bySide.W.reusedPosts).toBe(1);
    s.inspections[p.id].condition = 'cracked';
    expect(calc(s).bySide.W.reusedPosts).toBe(0);
  });
});
describe('gates and materials', () => {
  it('subtracts a gate opening and adds both edge posts', () => {
    const s = preset();
    s.gates.push({ id: 'g', side: 'W', at: 0.1, width: 14, cost: 25000, open: false });
    const r = calc(s);
    expect(r.bySide.W.net).toBeCloseTo(786);
    expect(r.bySide.W.meshLength).toBeCloseTo(786);
    expect(r.bySide.W.rawWire).toBeCloseTo(1572);
    expect(r.posts.filter((p) => p.side === 'W' && p.gate)).toHaveLength(2);
    expect(r.posts.some((p) => p.side === 'W' && p.chainage > 80.001 && p.chainage < 93.999)).toBe(
      false,
    );
  });
  it('rejects overlapping and out-of-bounds gates', () => {
    const s = preset();
    s.gates = [{ id: 'g', side: 'W', at: 0.99, width: 14, cost: 1, open: false }];
    expect(() => validateGates(s)).toThrow();
    s.gates = [
      { id: 'g', side: 'W', at: 0.1, width: 14, cost: 1, open: false },
      { id: 'h', side: 'W', at: 0.11, width: 14, cost: 1, open: false },
    ];
    expect(() => validateGates(s)).toThrow();
  });
  it('computes 5% waste and rounds rolls up', () => {
    const r = calc();
    expect(r.bySide.W.rolls).toBe(9);
    expect(r.bySide.E.rolls).toBe(5);
    expect(r.bySide.W.reusedWire).toBe(1680);
    expect(r.bySide.S.purchaseWire).toBe(9187.5);
    expect(r.bySide.S.coils).toBe(28);
  });
  it('five to four strands reduces raw wire exactly', () => {
    const s = preset(),
      a = calc(s).bySide.S.rawWire;
    s.sections.S[0].config.strands = 4;
    expect(calc(s).bySide.S.rawWire).toBe((a * 4) / 5);
  });
  it('two to one road strands halves reuse requirement', () => {
    const s = preset(),
      a = calc(s).bySide.W.reusedWire;
    s.sections.W[0].config.strands = 1;
    expect(calc(s).bySide.W.reusedWire).toBe(a / 2);
  });
  it('eye-size edits do not change physical length', () => {
    const s = preset(),
      a = calc(s).bySide.E.net;
    s.sections.E[0].config.eye = 2;
    expect(calc(s).bySide.E.net).toBe(a);
    expect(s.sections.E[0].config.eye).toBe(2);
  });
  it('uses top clearance and embedment validation', () => {
    expect(calc().warnings.some((w) => w.includes('shorter'))).toBe(true);
    const s = preset();
    s.sections.W[0].config.poleLength = 9;
    expect(calc(s).warnings.some((w) => w.includes('shorter'))).toBe(false);
    expect(wireHeights(s.sections.W[0].config)).toEqual([5.75, 6.25]);
  });
  it('all-chain-link preset excludes north and adds south mesh', () => {
    const s = preset('all'),
      r = calc(s);
    expect(r.bySide.S.meshLength).toBe(1750);
    expect(r.bySide.S.purchaseWire).toBe(0);
    expect(r.bySide.N.cost).toBe(0);
  });
});
describe('costs and validation', () => {
  it('preserves every historical amount and the exact total', () => {
    expect(originalQuote.reduce((s, r) => s + r.amount, 0)).toBe(originalTotal);
    expect(originalTotal).toBe(463410);
    for (const row of originalQuote) expect(row.quantity * row.rate).toBe(row.amount);
  });
  it('adds excluded tax and extracts included tax correctly', () => {
    const base = calc(),
      r = calc(preset(), { ...defaultRates, tax: 18 });
    expect(r.total).toBeCloseTo(base.subtotal * 1.18);
    const inc = calc(preset(), { ...defaultRates, tax: 18, taxIncluded: true });
    expect(inc.total).toBeCloseTo(base.subtotal);
    expect(inc.tax).toBeCloseTo(base.subtotal - base.subtotal / 1.18);
  });
  it('sums item amounts to the subtotal', () => {
    const r = calc();
    expect(r.rows.reduce((s, row) => s + row.quantity * row.rate, 0)).toBeCloseTo(r.subtotal);
  });
  it('returns zero when no work is configured', () => {
    const s = preset();
    for (const sec of Object.values(s.sections).flat()) sec.config.type = 'existing';
    expect(calc(s).total).toBe(0);
  });
  it('validates scenario round-trip and rejects invalid numeric inputs', () => {
    const s = preset();
    expect(parseScenario(JSON.parse(JSON.stringify(s)))).toEqual(s);
    s.sections.W[0].config.spacing = 0;
    expect(() => parseScenario(s)).toThrow();
  });
  it('rejects gaps in section definitions', () => {
    const s = preset();
    s.sections.W[0].end = 0.5;
    expect(() => parseScenario(s)).toThrow();
  });
});
