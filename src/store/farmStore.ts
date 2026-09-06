import { useSyncExternalStore } from 'react';
import { preset, parseScenario, type Scenario } from '../data/scenarios';
import { defaultRates, type Rates } from '../data/pricing';
import { validateGates } from '../geometry/materialCalculator';
export type State = {
  scenario: Scenario;
  rates: Rates;
  saved: Scenario[];
  supportRevision?: number;
};
export let startupWarning = '';
const listeners = new Set<() => void>();
let state: State = {
  scenario: preset(),
  rates: { ...defaultRates },
  saved: [],
  supportRevision: 2,
};
try {
  const raw = localStorage.getItem('ram-farm-v1');
  if (raw) {
    const data = JSON.parse(raw);
    const scenario = parseScenario(data.scenario);
    validateGates(scenario);
    state = {
      scenario,
      supportRevision: 2,
      rates: cleanRates(data.rates),
      saved: (data.saved || []).slice(0, 20).map(parseScenario),
    };
    if (data.supportRevision !== 2) {
      localStorage.setItem('ram-farm-before-paired-supports', raw);
      for (const sections of Object.values(state.scenario.sections)) {
        for (const section of sections) section.config.stayCount = 2;
      }
      localStorage.setItem('ram-farm-v1', JSON.stringify(state));
      startupWarning =
        'Plan updated to two diagonal support poles per assembly. Quantities and costs recalculated; your previous plan is backed up on this device.';
    }
  }
  if (location.hash.startsWith('#plan=')) {
    const shared = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(6)))));
    const scenario = parseScenario(shared.scenario || shared);
    validateGates(scenario);
    state.scenario = scenario;
    if (shared.rates) state.rates = cleanRates(shared.rates);
  } else if (location.hash === '#all') state.scenario = preset('all');
  else if (location.hash === '#hybrid') state.scenario = preset();
} catch (e) {
  startupWarning =
    'Saved or shared configuration was rejected. The previous valid/default plan is shown. Import a valid JSON backup to recover it.';
  console.warn('Saved/shared plan rejected:', e);
}
export function cleanRates(input: unknown): Rates {
  const out = { ...defaultRates };
  if (!input || typeof input !== 'object') return out;
  for (const key of Object.keys(out) as (keyof Rates)[]) {
    const value = (input as Record<string, unknown>)[key];
    if (
      typeof out[key] === 'number' &&
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 1e7
    )
      (out as any)[key] = value;
    else if (key === 'labourMode' && ['pole', 'ft', 'lump'].includes(String(value)))
      out.labourMode = String(value);
    else if (key === 'taxIncluded' && typeof value === 'boolean') out.taxIncluded = value;
  }
  return out;
}
export function commit(next: State) {
  parseScenario(next.scenario);
  validateGates(next.scenario);
  state = { ...next, supportRevision: 2 };
  try {
    localStorage.setItem('ram-farm-v1', JSON.stringify(state));
  } catch {
    window.dispatchEvent(
      new CustomEvent('farm-notice', {
        detail: 'Browser storage is full. Export your configuration JSON to save these changes.',
      }),
    );
  }
  listeners.forEach((fn) => fn());
}
export function updateScenario(fn: (s: Scenario) => void) {
  const copy = structuredClone(state);
  fn(copy.scenario);
  commit(copy);
}
export function useFarm() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => state,
  );
}
export const getState = () => state;
