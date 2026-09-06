import { z } from 'zod';
import { sideIds, type SideId } from './farmSurvey';
const num = (min: number, max: number) => z.number().finite().min(min).max(max);
export const configSchema = z.object({
  type: z.enum(['none', 'existing', 'mesh', 'barbed', 'hybrid', 'custom']),
  height: num(1, 12),
  eye: num(0.5, 8),
  diameter: num(1, 8),
  material: z.string().max(80),
  spacing: num(2, 30),
  poleLength: num(4, 16),
  embed: num(0.5, 6),
  poleType: z.enum(['RCC rectangular', 'RCC square', 'GI steel', 'stone', 'wood', 'custom']),
  strands: num(0, 8).int(),
  strandGap: num(0.1, 2),
  strandHeights: z.string().max(100),
  topOffset: num(0, 3),
  topAngle: z.enum(['straight', 'inward', 'outward']),
  rollLength: num(5, 500),
  rollWeight: num(1, 1000),
  meshUnit: z.enum(['kg', 'roll', 'sq ft']),
  meshRate: num(0, 100000),
  coilLength: num(10, 10000),
  coilWeight: num(0.1, 1000),
  wireUnit: z.enum(['kg', 'coil']),
  wireRate: num(0, 100000),
  wireDiameter: num(1, 8),
  waste: num(0, 15),
  tensionLines: num(0, 10).int(),
  bindingKgPerPost: num(0, 5),
  supportMode: z.enum(['none', 'posts', 'distance', 'corners', 'strainers', 'manual']),
  supportEvery: num(1, 500),
  stayLength: num(3, 12),
  stayAngle: num(15, 75),
  stayDirection: z.enum(['inside', 'outside']),
  stayCount: num(1, 2).int(),
  strainerInterval: num(25, 500),
  footingMode: z.enum(['none', 'corners', 'strainers', 'all', 'manual']),
  footingShape: z.enum(['square', 'circular']),
  footingWidth: num(0.2, 4),
  footingDepth: num(0.2, 6),
  reuse: z.enum(['unknown', 'good', 'replace', 'custom']),
  reusePercent: num(0, 100),
  reuseWire: z.boolean(),
  recoveredWire: num(0, 50000),
});
export type FenceConfig = z.infer<typeof configSchema>;
export const baseConfig: FenceConfig = {
  type: 'mesh',
  height: 5.5,
  eye: 3,
  diameter: 3,
  material: 'Tata Aayush GI',
  spacing: 8,
  poleLength: 8,
  embed: 2.5,
  poleType: 'RCC rectangular',
  strands: 0,
  strandGap: 0.5,
  strandHeights: '',
  topOffset: 0.25,
  topAngle: 'straight',
  rollLength: 100,
  rollWeight: 94.286,
  meshUnit: 'kg',
  meshRate: 130,
  coilLength: 330,
  coilWeight: 25,
  wireUnit: 'kg',
  wireRate: 130,
  wireDiameter: 2.5,
  waste: 5,
  tensionLines: 3,
  bindingKgPerPost: 0.15,
  supportMode: 'posts',
  supportEvery: 3.42,
  stayLength: 6,
  stayAngle: 45,
  stayDirection: 'inside',
  stayCount: 2,
  strainerInterval: 100,
  footingMode: 'strainers',
  footingShape: 'square',
  footingWidth: 1,
  footingDepth: 2.5,
  reuse: 'replace',
  reusePercent: 0,
  reuseWire: false,
  recoveredWire: 0,
};
const sectionSchema = z.object({
  id: z.string().max(100),
  start: num(0, 1),
  end: num(0, 1),
  config: configSchema,
});
export type Section = z.infer<typeof sectionSchema>;
const gateSchema = z.object({
  id: z.string(),
  side: z.enum(['W', 'N', 'E', 'S']),
  at: num(0, 1),
  width: num(2, 30),
  cost: num(0, 1000000),
  open: z.boolean(),
});
export type Gate = z.infer<typeof gateSchema>;
const inspectionSchema = z.object({
  condition: z.enum(['unknown', 'good', 'cracked', 'leaning', 'new']),
  role: z.enum(['auto', 'corner', 'strainer', 'support', 'new']),
  exposed: num(0, 16),
  notes: z.string().max(2000),
  footing: z.boolean(),
  loose: z.boolean(),
  crossSection: z.string().max(100),
  photo: z.string().max(350000),
});
export type Inspection = z.infer<typeof inspectionSchema>;
export const scenarioSchema = z.object({
  name: z.string().min(1).max(80),
  basis: z.enum(['contractor', 'survey']),
  sections: z.object({
    W: z.array(sectionSchema).min(1).max(20),
    N: z.array(sectionSchema).min(1).max(20),
    E: z.array(sectionSchema).min(1).max(20),
    S: z.array(sectionSchema).min(1).max(20),
  }),
  gates: z.array(gateSchema).max(40),
  inspections: z.record(inspectionSchema),
  actualPosts: z
    .array(
      z.object({
        id: z.string(),
        chainage: num(0, 2000),
        lat: z.number().optional(),
        lng: z.number().optional(),
      }),
    )
    .max(1000),
});
export type Scenario = z.infer<typeof scenarioSchema>;
export function preset(kind = 'hybrid'): Scenario {
  const sections = Object.fromEntries(
    sideIds.map((side) => [
      side,
      [
        {
          id: side + '-1',
          start: 0,
          end: 1,
          config: {
            ...baseConfig,
            ...(side === 'N'
              ? { type: 'existing' as const }
              : side === 'S'
                ? {
                    type: kind === 'all' ? ('mesh' as const) : ('barbed' as const),
                    strands: kind === 'all' ? 0 : 5,
                    material: kind === 'all' ? 'Tata Aayush GI' : 'Tata Aayush 12×12',
                  }
                : side === 'W'
                  ? {
                      type: 'hybrid' as const,
                      strands: 2,
                      reuse: 'unknown' as const,
                      reuseWire: true,
                    }
                  : {}),
          },
        },
      ],
    ]),
  ) as Scenario['sections'];
  return {
    name:
      kind === 'all' ? 'All Chain Link' : kind === 'custom' ? 'Custom' : 'Preferred Hybrid Plan',
    basis: 'contractor',
    sections,
    gates: [],
    inspections: {},
    actualPosts: [],
  };
}
export const emptyInspection: Inspection = {
  condition: 'unknown',
  role: 'auto',
  exposed: 0,
  notes: '',
  footing: false,
  loose: false,
  crossSection: '',
  photo: '',
};
export function parseScenario(input: unknown): Scenario {
  const s = scenarioSchema.parse(input);
  for (const side of sideIds) {
    let end = 0;
    for (const sec of s.sections[side]) {
      if (Math.abs(sec.start - end) > 1e-8 || sec.end <= sec.start)
        throw Error('Sections must form a continuous, ordered side.');
      end = sec.end;
    }
    if (Math.abs(end - 1) > 1e-8) throw Error('Each side must end at 100%.');
  }
  return s;
}
