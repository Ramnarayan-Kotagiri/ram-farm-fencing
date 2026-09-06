import { FT, sideIds, sides, type SideId } from '../data/farmSurvey';
import { contractorLengths } from '../data/contractorPlanning';
import type { FenceConfig, Scenario, Section } from '../data/scenarios';
import type { Rates } from '../data/pricing';
import { atPath, vertexFractions, type Point } from './coordinateTransform';
export const lengthFor = (s: Scenario, id: SideId) =>
  s.basis === 'survey' ? sides[id].survey : contractorLengths[id];
export const isNew = (c: FenceConfig) => c.type !== 'none' && c.type !== 'existing';
export const hasMesh = (c: FenceConfig) => c.type === 'mesh' || c.type === 'hybrid';
export const strandCount = (c: FenceConfig) =>
  c.type === 'barbed' || c.type === 'hybrid' ? c.strands : 0;
export function wireHeights(c: FenceConfig) {
  const count = strandCount(c);
  const custom = c.strandHeights.split(',').map(Number);
  if (
    c.strandHeights.trim() &&
    custom.length === count &&
    custom.every((v) => Number.isFinite(v) && v >= 0)
  )
    return custom;
  return Array.from({ length: count }, (_, i) =>
    hasMesh(c)
      ? c.height + c.topOffset + i * c.strandGap
      : ((i + 1) * c.height) / Math.max(1, count),
  );
}
export type Post = Point & {
  id: string;
  side: SideId;
  fraction: number;
  chainage: number;
  config: FenceConfig;
  corner: boolean;
  strainer: boolean;
  gate: boolean;
  reuse: boolean;
  condition: string;
  stays: number;
  concrete: boolean;
  existing: boolean;
  actual: boolean;
};
export type Run = { side: SideId; section: Section; start: number; end: number; length: number };
export type BoqRow = {
  item: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  side: string;
};
export type SideResult = {
  length: number;
  net: number;
  meshLength: number;
  area: number;
  rolls: number;
  meshKg: number;
  rawWire: number;
  purchaseWire: number;
  reusedWire: number;
  coils: number;
  wireKg: number;
  posts: number;
  newPosts: number;
  reusedPosts: number;
  stays: number;
  strainers: number;
  concrete: number;
  cost: number;
};
const empty = (): SideResult => ({
  length: 0,
  net: 0,
  meshLength: 0,
  area: 0,
  rolls: 0,
  meshKg: 0,
  rawWire: 0,
  purchaseWire: 0,
  reusedWire: 0,
  coils: 0,
  wireKg: 0,
  posts: 0,
  newPosts: 0,
  reusedPosts: 0,
  stays: 0,
  strainers: 0,
  concrete: 0,
  cost: 0,
});
export function validateGates(s: Scenario) {
  for (const side of sideIds) {
    const l = lengthFor(s, side);
    const gs = s.gates.filter((g) => g.side === side).sort((a, b) => a.at - b.at);
    let end = 0;
    for (const g of gs) {
      const a = g.at * l,
        b = a + g.width;
      if (b > l + 1e-6) throw Error('Gate extends beyond ' + sides[side].name);
      if (a < end - 1e-6) throw Error('Gate openings overlap on ' + sides[side].name);
      if (
        s.sections[side].some((sec) => !isNew(sec.config) && a < sec.end * l && b > sec.start * l)
      )
        throw Error('Set a new fence type before adding a gate on an excluded section.');
      end = b;
    }
  }
}
export function fenceRuns(s: Scenario): Run[] {
  validateGates(s);
  const runs: Run[] = [];
  for (const side of sideIds) {
    const l = lengthFor(s, side);
    for (const section of s.sections[side]) {
      let spans = [[section.start, section.end]];
      for (const gate of s.gates.filter((g) => g.side === side)) {
        const a = gate.at,
          b = a + gate.width / l;
        spans = spans.flatMap(([x, y]) =>
          b <= x || a >= y
            ? [[x, y]]
            : [
                [x, Math.max(x, a)],
                [Math.min(b, y), y],
              ].filter(([u, v]) => v - u > 1e-8),
        );
      }
      for (const [start, end] of spans)
        runs.push({ side, section, start, end, length: (end - start) * l });
    }
  }
  return runs;
}
export function placePosts(s: Scenario, runs = fenceRuns(s)): Post[] {
  const unique = new Map<string, Post>();
  for (const run of runs) {
    const { side, section, start, end } = run,
      c = section.config;
    if (c.type === 'none') continue;
    const l = lengthFor(s, side),
      corners = vertexFractions(side),
      gateEdges = s.gates.filter((g) => g.side === side).flatMap((g) => [g.at, g.at + g.width / l]);
    const stops = [start, end, ...corners.filter((f) => f > start && f < end)];
    for (let f = start + c.strainerInterval / l; f < end - 1e-8; f += c.strainerInterval / l)
      stops.push(f);
    const actual =
      side === 'W'
        ? s.actualPosts.filter((p) => p.chainage / l >= start && p.chainage / l <= end)
        : [];
    stops.push(...actual.map((p) => p.chainage / l));
    stops.sort((a, b) => a - b);
    const anchors = [...new Set(stops.map((f) => +f.toFixed(10)))];
    const fractions: number[] = [anchors[0]];
    for (let i = 1; i < anchors.length; i++) {
      const a = anchors[i - 1],
        b = anchors[i],
        n = Math.ceil(((b - a) * l) / c.spacing - 1e-7);
      for (let j = 1; j <= n; j++) fractions.push(a + ((b - a) * j) / n);
    }
    fractions.forEach((fraction, index) => {
      const pos = atPath(side, fraction),
        key = pos.x.toFixed(3) + ',' + pos.z.toFixed(3),
        chainage = fraction * l,
        measured = actual.find((p) => Math.abs(p.chainage - chainage) < 0.02);
      const id =
          measured?.id ||
          `${side}-${Math.round(fraction * 1e6)
            .toString()
            .padStart(6, '0')}`,
        inspection = s.inspections[id],
        corner = corners.some((f) => Math.abs(f - fraction) < 1e-7),
        gate = gateEdges.some((f) => Math.abs(f - fraction) < 1e-7),
        strainer =
          corner ||
          gate ||
          anchors.some((f) => Math.abs(f - fraction) < 1e-7) ||
          inspection?.role === 'strainer' ||
          inspection?.role === 'corner';
      const condition =
        inspection?.condition || (side === 'W' && c.reuse === 'unknown' ? 'unknown' : 'new');
      const reuse =
        side === 'W' &&
        (condition === 'good' ||
          (!inspection &&
            c.reuse === 'custom' &&
            (c.reusePercent === 100 || fraction < c.reusePercent / 100))) &&
        c.reuse !== 'replace';
      const support =
        c.supportMode === 'corners'
          ? corner
          : c.supportMode === 'strainers'
            ? strainer
            : c.supportMode === 'posts'
              ? Math.floor(index / c.supportEvery) > Math.floor((index - 1) / c.supportEvery)
              : c.supportMode === 'distance'
                ? Math.floor((chainage - start * l) / c.supportEvery) >
                  Math.floor((chainage - start * l - c.spacing) / c.supportEvery)
                : c.supportMode === 'manual'
                  ? inspection?.role === 'support'
                  : false;
      const concrete =
        c.footingMode === 'all' ||
        (c.footingMode === 'corners' && corner) ||
        (c.footingMode === 'strainers' && strainer) ||
        (c.footingMode === 'manual' && !!inspection?.footing);
      const post: Post = {
        ...pos,
        id,
        side,
        fraction,
        chainage,
        config: c,
        corner: corner || inspection?.role === 'corner',
        strainer,
        gate,
        reuse,
        condition,
        stays: support ? c.stayCount : 0,
        concrete,
        existing: !isNew(c),
        actual: !!measured,
      };
      const prior = unique.get(key);
      if (!prior || (prior.existing && !post.existing)) unique.set(key, post);
      else if (!post.existing) {
        prior.corner ||= corner;
        prior.gate ||= gate;
        prior.strainer ||= strainer;
        prior.stays = Math.max(prior.stays, post.stays);
        prior.concrete ||= concrete;
      }
    });
  }
  return [...unique.values()];
}
export function calculate(s: Scenario, r: Rates) {
  const runs = fenceRuns(s),
    posts = placePosts(s, runs),
    bySide = Object.fromEntries(
      sideIds.map((id) => [id, { ...empty(), length: lengthFor(s, id) }]),
    ) as Record<SideId, SideResult>,
    rows: BoqRow[] = [],
    warnings: string[] = [];
  const add = (side: string, item: string, quantity: number, unit: string, rate: number) => {
    if (quantity > 0) {
      rows.push({ side, item, quantity, unit, rate, amount: quantity * rate });
      if (side in bySide) bySide[side as SideId].cost += quantity * rate;
    }
  };
  for (const run of runs) {
    const c = run.section.config,
      bs = bySide[run.side];
    if (!isNew(c)) continue;
    bs.net += run.length;
    if (c.type === 'custom')
      warnings.push(
        `${sides[run.side].name}: custom fence needs a separately priced specification; only posts and ancillary items are calculated.`,
      );
    if (c.poleLength - c.embed < Math.max(hasMesh(c) ? c.height : 0, ...wireHeights(c)))
      warnings.push(
        `${sides[run.side].name}: ${c.poleLength - c.embed} ft exposed pole is shorter than the configured fence/top wire.`,
      );
    if (run.side === 'W' && c.reuse === 'unknown')
      warnings.push(
        'Road poles need inspection. Estimate conservatively prices all unconfirmed posts as new.',
      );
    if (hasMesh(c)) {
      const length = run.length * (1 + c.waste / 100),
        rolls = Math.ceil(length / c.rollLength),
        kg = rolls * c.rollWeight,
        area = run.length * c.height;
      bs.meshLength += run.length;
      bs.area += area;
      bs.rolls += rolls;
      bs.meshKg += kg;
      add(
        run.side,
        'Chain-link mesh',
        c.meshUnit === 'kg' ? kg : c.meshUnit === 'roll' ? rolls : length * c.height,
        c.meshUnit,
        c.meshRate,
      );
      add(run.side, 'Tension wire', length * c.tensionLines, 'ft', r.tension);
    }
    const raw = run.length * strandCount(c),
      purchased = raw * (1 + c.waste / 100);
    bs.rawWire += raw;
    if (c.reuseWire) {
      bs.reusedWire += purchased;
    } else {
      const coils = Math.ceil(purchased / c.coilLength),
        kg = coils * c.coilWeight;
      bs.purchaseWire += purchased;
      bs.coils += coils;
      bs.wireKg += kg;
      add(run.side, 'Barbed wire', c.wireUnit === 'kg' ? kg : coils, c.wireUnit, c.wireRate);
    }
  }
  for (const p of posts) {
    if (p.existing) continue;
    const b = bySide[p.side],
      c = p.config;
    b.posts++;
    b.strainers += p.strainer ? 1 : 0;
    b.stays += p.stays;
    if (p.reuse) {
      b.reusedPosts++;
      const measured = s.inspections[p.id]?.exposed;
      if (measured && measured < Math.max(hasMesh(c) ? c.height : 0, ...wireHeights(c)))
        warnings.push(
          `${p.id}: inspected exposed height ${measured} ft is insufficient for the proposed fence.`,
        );
    } else {
      b.newPosts++;
      add(p.side, `${c.poleLength}-ft ${c.poleType} main pole`, 1, 'pole', r.pole);
      if (p.strainer) add(p.side, 'Strainer / gate-post upgrade', 1, 'assembly', r.strainerPremium);
    }
    add(p.side, `${c.stayLength}-ft support pole`, p.stays, 'pole', r.stay);
    if (p.concrete && !p.reuse) {
      const volume =
        (c.footingShape === 'circular' ? Math.PI / 4 : 1) *
        Math.pow(c.footingWidth * FT, 2) *
        c.footingDepth *
        FT;
      b.concrete += volume;
      add(p.side, 'Concrete (gross footing volume)', volume, 'm³', r.concrete);
    }
    add(p.side, 'Binding wire', c.bindingKgPerPost, 'kg', r.binding);
    if (r.labourMode === 'pole')
      add(p.side, 'Pole / support erection labour', (p.reuse ? 0 : 1) + p.stays, 'pole', r.labour);
  }
  for (const g of s.gates) add(g.side, `${g.width}-ft gate`, 1, 'gate', g.cost);
  const newLength = sideIds.reduce((v, id) => v + bySide[id].net, 0);
  if (newLength) {
    if (r.labourMode === 'ft') add('Job', 'Erection labour', newLength, 'ft', r.labourPerFt);
    if (r.labourMode === 'lump') add('Job', 'Erection labour', 1, 'job', r.labourLump);
    add('Job', 'Pole transport', r.trips, 'trip', r.trip);
    add('Job', 'Mesh / wire transport', 1, 'job', r.transport);
    add('Job', 'Mesh fixing / old wire removal', 1, 'job', r.fixing);
    add('Job', 'Workers transport', r.days, 'day', r.auto);
    add('Job', 'Mestri', 1, 'job', r.mestri);
    add('Job', 'Loading / unloading', 1, 'job', r.loading);
  }
  const compact = new Map<string, BoqRow>();
  for (const row of rows) {
    const key = [row.side, row.item, row.unit, row.rate].join('|'),
      old = compact.get(key);
    if (old) {
      old.quantity += row.quantity;
      old.amount += row.amount;
    } else compact.set(key, { ...row });
  }
  const subtotal = rows.reduce((v, row) => v + row.amount, 0),
    tax = r.taxIncluded ? subtotal - subtotal / (1 + r.tax / 100) : (subtotal * r.tax) / 100,
    total = r.taxIncluded ? subtotal : subtotal + tax;
  const recovered = s.sections.W.reduce((v, sec) => v + sec.config.recoveredWire, 0),
    shortfall = Math.max(0, bySide.W.reusedWire - recovered);
  if (shortfall > 0)
    warnings.push(
      `Road: ${Math.ceil(shortfall).toLocaleString('en-IN')} ft of reusable wire is still unconfirmed; replacement wire is not included in this estimate.`,
    );
  if (s.actualPosts.length)
    warnings.push(
      'Imported road posts anchor placement; added infill posts satisfy maximum spacing. Verify actual post capacity and geometry on site.',
    );
  return {
    runs,
    posts,
    bySide,
    rows: [...compact.values()],
    subtotal,
    tax,
    total,
    warnings: [...new Set(warnings)],
    newLength,
    recovered,
    shortfall,
  };
}
