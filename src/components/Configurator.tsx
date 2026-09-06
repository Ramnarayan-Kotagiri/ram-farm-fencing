import { useState, useEffect } from 'react';
import { useFarm, updateScenario } from '../store/farmStore';
import { type FenceConfig, baseConfig } from '../data/scenarios';
import { type SideId, sides } from '../data/farmSurvey';
import { lengthFor, hasMesh, calculate } from '../geometry/materialCalculator';
export function Numeric({
  label,
  value,
  onChange,
  min = 0,
  max = 100000,
  step = 1,
  help,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="field">
      <span>
        {label}
        {help && <abbr title={help}> ?</abbr>}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => setText(String(value))}
      />
    </label>
  );
}
export function Choice({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: string;
  options: (string | [string, string])[];
  onChange: (n: string) => void;
  help?: string;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {help && <abbr title={help}> ?</abbr>}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o, i) => {
          const [v, t] = typeof o === 'string' ? [o, o] : o;
          return (
            <option key={v + String(i)} value={v}>
              {t}
            </option>
          );
        })}
      </select>
    </label>
  );
}
export function Configurator({
  side,
  result,
  notify,
  onSelectSection,
}: {
  side: SideId;
  result: ReturnType<typeof calculate>;
  notify: (s: string) => void;
  onSelectSection?: (i: number) => void;
}) {
  const { scenario } = useFarm(),
    [index, setIndex] = useState(0),
    [split, setSplit] = useState(100),
    [gateAt, setGateAt] = useState(40),
    [gateWidth, setGateWidth] = useState(14),
    [gateCost, setGateCost] = useState(25000);
  useEffect(() => {
    setIndex(0);
    onSelectSection?.(0);
  }, [side]);
  const sections = scenario.sections[side],
    idx = Math.min(index, sections.length - 1),
    section = sections[idx],
    c = section.config,
    l = lengthFor(scenario, side),
    b = result.bySide[side];
  const change = (key: keyof FenceConfig, value: unknown) => {
    try {
      updateScenario((s) => {
        const target = s.sections[side][idx].config;
        if (['height', 'eye', 'diameter'].includes(key)) {
          const next = { ...target, [key]: value } as FenceConfig;
          next.rollWeight = +(
            target.rollWeight *
            (next.height / target.height) *
            Math.pow(next.diameter / target.diameter, 2) *
            (target.eye / next.eye)
          ).toFixed(3);
          Object.assign(target, next);
        } else (target as any)[key] = value;
      });
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const n = (
    key: keyof FenceConfig,
    label: string,
    min: number,
    max: number,
    step = 1,
    help?: string,
  ) => (
    <Numeric
      key={key}
      label={label}
      value={c[key] as number}
      min={min}
      max={max}
      step={step}
      onChange={(v) => change(key, v)}
      help={help}
    />
  );
  const choice = (
    key: keyof FenceConfig,
    label: string,
    options: (string | [string, string])[],
    help?: string,
  ) => (
    <Choice
      key={String(key) + label}
      label={label}
      value={String(c[key])}
      options={options}
      onChange={(v) => change(key, typeof c[key] === 'number' ? Number(v) : v)}
      help={help}
    />
  );
  const check = (key: keyof FenceConfig, label: string) => (
    <label className="check-field">
      <input type="checkbox" checked={!!c[key]} onChange={(e) => change(key, e.target.checked)} />
      {label}
    </label>
  );
  return (
    <section className="panel configurator">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">PLANNER / ENGINEERING</span>
          <h2>{sides[side].name} configurator</h2>
        </div>
        <span className="badge">Changes save on this device</span>
      </div>
      <div className="length-pair">
        <span>
          Official LP <b>{sides[side].survey} ft</b>
        </span>
        <span>
          Selected BOQ basis <b>{l} ft</b>
        </span>
        <span>
          After gates <b>{b.net.toFixed(1)} ft new work</b>
        </span>
        <span>
          Side materials & labour <b>₹{Math.round(b.cost).toLocaleString('en-IN')}</b>
          <small>Job overheads and GST are separate</small>
        </span>
      </div>
      <div className="field-grid">
        <Choice
          label="Section"
          value={String(idx)}
          options={sections.map((sec, i) => [
            String(i),
            `${(sec.start * l).toFixed(1)}–${(sec.end * l).toFixed(1)} ft · ${sec.config.type}`,
          ])}
          onChange={(v) => {
            setIndex(+v);
            onSelectSection?.(+v);
          }}
        />
        {choice('type', 'Fence type', [
          ['none', 'None'],
          ['existing', 'Existing fence'],
          ['mesh', 'Chain link'],
          ['barbed', 'Barbed wire'],
          ['hybrid', 'Chain link + top barbed'],
          ['custom', 'Custom / future type'],
        ])}
      </div>
      {side === 'N' && (
        <p className="notice">
          North is currently excluded from quotation. Changing to a new fence type is a future-work
          override.
        </p>
      )}
      <details>
        <summary>Split or merge fence sections</summary>
        <p className="help">
          Distances use the selected BOQ basis. Sections stay at the same relative location when you
          switch length basis.
        </p>
        <div className="field-grid">
          <Numeric
            label="Split at chainage (ft)"
            value={split}
            min={0}
            max={l}
            onChange={setSplit}
          />
          <button
            onClick={() => {
              const f = split / l;
              if (f <= section.start || f >= section.end) {
                notify('Split point must lie inside the selected section.');
                return;
              }
              updateScenario((s) => {
                const sec = s.sections[side][idx],
                  end = sec.end;
                sec.end = f;
                s.sections[side].splice(idx + 1, 0, {
                  id: side + '-' + Date.now(),
                  start: f,
                  end,
                  config: { ...sec.config, recoveredWire: 0 },
                });
              });
            }}
          >
            Split selected section
          </button>
          <button
            disabled={idx >= sections.length - 1}
            onClick={() => {
              updateScenario((s) => {
                s.sections[side][idx].end = s.sections[side][idx + 1].end;
                s.sections[side].splice(idx + 1, 1);
              });
              notify('Merged with next section using the selected section’s settings.');
            }}
          >
            Merge next · keep these settings
          </button>
        </div>
      </details>
      {c.type !== 'none' && c.type !== 'existing' && (
        <>
          <details open>
            <summary>Mesh & barbed-wire design</summary>
            <div className="field-grid">
              {n(
                'height',
                'Fence / mesh height (ft)',
                1,
                12,
                0.5,
                'Height of the mesh or top strand on barbed-only runs.',
              )}
              {hasMesh(c) && (
                <>
                  {n(
                    'eye',
                    'Mesh eye opening (in)',
                    0.5,
                    8,
                    0.5,
                    'The diamond opening. Smaller openings use more wire. The 3D mesh changes with this value.',
                  )}
                  {choice('diameter', 'Gauge preset', [
                    ['3', '10 gauge · ~3.0 mm'],
                    ['4', '8 gauge · ~4.0 mm'],
                    ['2.5', '12 gauge · ~2.5 mm'],
                    [String(c.diameter), 'Current diameter'],
                  ])}
                  {n('diameter', 'Wire diameter (mm)', 1, 8, 0.1)}
                </>
              )}
              {n(
                'strands',
                c.type === 'barbed' ? 'Barbed-wire strands' : 'Top barbed strands',
                0,
                c.type === 'barbed' ? 8 : 4,
                1,
              )}
              {n('strandGap', 'Top strand spacing (ft)', 0.1, 2, 0.1)}
              {n('topOffset', 'First strand above mesh (ft)', 0, 3, 0.1)}
              {choice('topAngle', 'Top arrangement', ['straight', 'inward', 'outward'])}
              <label className="field">
                <span>Custom strand heights (ft)</span>
                <input
                  placeholder="e.g. 1, 2, 3, 4, 5"
                  value={c.strandHeights}
                  onChange={(e) => change('strandHeights', e.target.value)}
                />
                <small>Comma-separated; one height per strand. Blank = automatic.</small>
              </label>
              <label className="field">
                <span>Material / brand</span>
                <input
                  list="materials"
                  value={c.material}
                  onChange={(e) => change('material', e.target.value)}
                />
                <datalist id="materials">
                  <option>Tata Aayush GI</option>
                  <option>Tata Wiron</option>
                  <option>Generic GI</option>
                  <option>Tata Aayush 12×12</option>
                </datalist>
              </label>
            </div>
          </details>
          <details open>
            <summary>Main poles & embedment</summary>
            <div className="field-grid">
              {choice('poleType', 'Pole type', [
                'RCC rectangular',
                'RCC square',
                'GI steel',
                'stone',
                'wood',
                'custom',
              ])}
              {n(
                'spacing',
                'Maximum post spacing (ft)',
                2,
                30,
                0.5,
                'Posts are placed at bends, gates and strainers first. Each remaining interval is subdivided with ceil(length / spacing).',
              )}
              {n('poleLength', 'Total pole length (ft)', 4, 16, 0.5)}
              {n(
                'embed',
                'Embed depth (ft)',
                0.5,
                6,
                0.5,
                'Below-ground length. Exposed height equals total pole length minus embed depth.',
              )}
              <Numeric
                label="Above-ground height (ft)"
                value={c.poleLength - c.embed}
                min={0.1}
                max={16 - c.embed}
                step={0.5}
                onChange={(v) => change('poleLength', v + c.embed)}
              />
            </div>
            <p className="help">
              {b.posts} unique main posts allocated to this side · {b.newPosts} new ·{' '}
              {b.reusedPosts} reused · {b.strainers} corner / gate / strainer assemblies. Shared
              corners are counted once across the farm.
            </p>
            <p className="help">
              8-ft spacing is an inferred starting assumption: 2,900 ÷ 363 ≈ 7.99 ft. The quotation
              does not specify spacing.
            </p>
          </details>
          <details>
            <summary>Supports, stays & strainers</summary>
            <div className="field-grid">
              {choice('supportMode', 'Support placement', [
                ['none', 'None'],
                ['posts', 'Every N main posts'],
                ['distance', 'Every X feet'],
                ['corners', 'Corners only'],
                ['strainers', 'Every strainer'],
                ['manual', 'Manual post inspection'],
              ])}
              {n('supportEvery', 'N posts / X feet', 1, 500, 0.01)}
              {n('stayLength', 'Stay pole length (ft)', 3, 12, 0.5)}
              {n('stayAngle', 'Brace angle (degrees)', 15, 75, 1)}
              {choice('stayDirection', 'Brace direction', ['inside', 'outside'])}
              {n('stayCount', 'Stays per assembly', 1, 2, 1)}
              {n('strainerInterval', 'Maximum tension interval (ft)', 25, 500, 25)}
            </div>
            <p className="help">
              Original support ratio: 363 ÷ 106 = 3.42 main posts per support. This is quotation
              arithmetic, not an engineering recommendation. {b.stays} support poles are currently
              planned.
            </p>
          </details>
          <details>
            <summary>Concrete footings</summary>
            <div className="field-grid">
              {choice('footingMode', 'Concrete placement', [
                ['none', 'No concrete'],
                ['corners', 'Corners only'],
                ['strainers', 'Corners + strainers'],
                ['all', 'Every new post'],
                ['manual', 'Manual post selection'],
              ])}
              {choice('footingShape', 'Footing shape', ['square', 'circular'])}
              {n('footingWidth', 'Width / diameter (ft)', 0.2, 4, 0.1)}
              {n('footingDepth', 'Footing depth (ft)', 0.2, 6, 0.1)}
            </div>
            <p className="help">
              {b.concrete.toFixed(3)} m³ gross footing volume. Existing reused-post footings are
              excluded. Mix conversion factors are editable in Materials & costs.
            </p>
          </details>
          {side === 'W' && (
            <details open>
              <summary>Roadside existing materials</summary>
              <div className="field-grid">
                {choice('reuse', 'Existing pole strategy', [
                  ['unknown', 'Inspect / unknown'],
                  ['good', 'Reuse inspected good poles'],
                  ['replace', 'Replace all'],
                  ['custom', 'Custom reuse percentage'],
                ])}
                {c.reuse === 'custom' && n('reusePercent', 'Assumed reusable poles (%)', 0, 100, 1)}
                {n('recoveredWire', 'Confirmed recovered wire (ft)', 0, 50000, 50)}
              </div>
              {check('reuseWire', 'Use recovered wire for this section’s barbed strands')}
              <p className="help">
                Required reused wire: {b.reusedWire.toFixed(0)} ft including wastage. Confirmed
                recovery: {result.recovered.toFixed(0)} ft.{' '}
                {result.shortfall > 0
                  ? `Unconfirmed shortfall: ${result.shortfall.toFixed(0)} ft.`
                  : `Surplus: ${(result.recovered - b.reusedWire).toFixed(0)} ft.`}{' '}
                Unconfirmed recovery has no purchase cost; obtain a replacement quote if needed.
              </p>
            </details>
          )}
          <details>
            <summary>Rolls, coils & material pricing</summary>
            <p className="help">
              Roll weight starts from the old road quote, scaled to 5.5 ft. Height / eye / diameter
              changes scale that estimate. Enter the supplier’s actual roll weight before ordering.
            </p>
            <div className="field-grid">
              {hasMesh(c) && (
                <>
                  {n('rollLength', 'Mesh roll length (ft)', 5, 500, 5)}
                  {n('rollWeight', 'Mesh roll weight (kg)', 1, 1000, 0.1)}
                  {choice('meshUnit', 'Mesh price unit', ['kg', 'roll', 'sq ft'])}
                  {n('meshRate', 'Mesh price (₹ / selected unit)', 0, 100000, 1)}
                  {n(
                    'tensionLines',
                    'Tension-wire lines',
                    0,
                    10,
                    1,
                    'Top, middle and bottom = 3 horizontal wires.',
                  )}
                </>
              )}
              {n('coilLength', 'Barbed coil length (ft)', 10, 10000, 10)}
              {n('coilWeight', 'Barbed coil weight (kg)', 0.1, 1000, 0.1)}
              {choice('wireUnit', 'Barbed-wire price unit', ['kg', 'coil'])}
              {n('wireRate', 'Barbed price (₹ / selected unit)', 0, 100000, 1)}
              {n('wireDiameter', 'Barbed wire diameter (mm)', 1, 8, 0.1)}
              {n('waste', 'Material wastage (%)', 0, 15, 1)}
              {n('bindingKgPerPost', 'Binding wire per post (kg)', 0, 5, 0.05)}
            </div>
          </details>
        </>
      )}
      <details>
        <summary>Gates</summary>
        <p className="help">
          Gate location is unconfirmed. Add only a proposed opening you want to explore. Openings
          remove mesh and wire and add two gate-edge posts.
        </p>
        <div className="field-grid">
          <Numeric
            label="Gate start chainage (ft)"
            value={gateAt}
            min={0}
            max={l}
            onChange={setGateAt}
          />
          <Numeric
            label="Gate width (ft)"
            value={gateWidth}
            min={2}
            max={30}
            onChange={setGateWidth}
          />
          <Numeric
            label="Gate allowance (₹)"
            value={gateCost}
            max={1000000}
            onChange={setGateCost}
          />
          <button
            onClick={() => {
              try {
                updateScenario((s) =>
                  s.gates.push({
                    id: 'gate-' + Date.now(),
                    side,
                    at: gateAt / l,
                    width: gateWidth,
                    cost: gateCost,
                    open: false,
                  }),
                );
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            Add gate
          </button>
        </div>
        {scenario.gates
          .filter((g) => g.side === side)
          .map((g) => (
            <div className="gate-row" key={g.id}>
              <span>
                {(g.at * l).toFixed(1)} ft · {g.width}-ft gate
              </span>
              <button
                onClick={() =>
                  updateScenario((s) => {
                    const gate = s.gates.find((a) => a.id === g.id)!;
                    gate.open = !gate.open;
                  })
                }
              >
                {g.open ? 'Close gate' : 'Open gate'}
              </button>
              <button
                onClick={() =>
                  updateScenario((s) => {
                    s.gates = s.gates.filter((a) => a.id !== g.id);
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
      </details>
      <button
        className="quiet"
        onClick={() => {
          change(
            'rollWeight',
            baseConfig.rollWeight * (c.height / 5.5) * Math.pow(c.diameter / 3, 2) * (3 / c.eye),
          );
          notify('Restored estimated roll-weight calibration. Confirm actual supplier weight.');
        }}
      >
        Recalibrate estimated mesh weight
      </button>
    </section>
  );
}
