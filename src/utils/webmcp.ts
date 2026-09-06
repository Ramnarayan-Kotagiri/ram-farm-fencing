import { getState, updateScenario } from '../store/farmStore';
import { calculate } from '../geometry/materialCalculator';
import { configSchema } from '../data/scenarios';
import { sideIds, type SideId } from '../data/farmSurvey';
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
};
export function registerFarmTools() {
  const context = (
    document as Document & {
      modelContext?: { registerTool: (tool: Tool, options: { signal: AbortSignal }) => void };
    }
  ).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const summarize = () => {
    const state = getState(),
      r = calculate(state.scenario, state.rates);
    return {
      name: state.scenario.name,
      basis: state.scenario.basis,
      newWorkFt: r.newLength,
      totalINR: r.total,
      sides: r.bySide,
      warnings: r.warnings,
    };
  };
  const definitions: Tool[] = [
    {
      name: 'read_farm_plan',
      description: 'Read the current farm design quantities, length basis, costs and assumptions.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: summarize,
    },
    {
      name: 'configure_farm_side',
      description:
        'Update every section on one farm side with validated fence parameters. Saves the current design on this device and recalculates the visible plan.',
      inputSchema: {
        type: 'object',
        properties: {
          side: { type: 'string', enum: sideIds },
          patch: {
            type: 'object',
            properties: {
              height: { type: 'number', minimum: 1, maximum: 12 },
              eye: { type: 'number', minimum: 0.5, maximum: 8 },
              spacing: { type: 'number', minimum: 2, maximum: 30 },
              poleLength: { type: 'number', minimum: 4, maximum: 16 },
              embed: { type: 'number', minimum: 0.5, maximum: 6 },
              strands: { type: 'integer', minimum: 0, maximum: 8 },
            },
            additionalProperties: false,
          },
        },
        required: ['side', 'patch'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input) => {
        const value = input as { side: SideId; patch: Record<string, unknown> };
        if (!value || !sideIds.includes(value.side) || !value.patch)
          throw Error('Valid side and patch are required.');
        const allowed = ['height', 'eye', 'spacing', 'poleLength', 'embed', 'strands'];
        if (Object.keys(value.patch).some((k) => !allowed.includes(k)))
          throw Error('Unsupported field.');
        const patch = configSchema.partial().parse(value.patch);
        updateScenario((s) => {
          for (const sec of s.sections[value.side]) {
            const old = { ...sec.config };
            Object.assign(sec.config, patch);
            if (patch.height || patch.eye)
              sec.config.rollWeight = +(
                old.rollWeight *
                (sec.config.height / old.height) *
                (old.eye / sec.config.eye)
              ).toFixed(3);
          }
        });
        return summarize();
      },
    },
  ];
  for (const definition of definitions) {
    try {
      context.registerTool(definition, { signal: lifecycle.signal });
    } catch (e) {
      console.warn('Optional farm tool unavailable', e);
    }
  }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
