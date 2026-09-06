import { useState } from 'react';
import { useFarm, commit, updateScenario, cleanRates } from '../store/farmStore';
import { calculate } from '../geometry/materialCalculator';
import { originalQuote, originalTotal } from '../data/vendorQuote';
import { defaultRates, type Rates } from '../data/pricing';
import { preset, type Scenario } from '../data/scenarios';
import { Numeric, Choice } from './Configurator';
import { Plan } from './Plan';
import { Farm3D } from './Farm3D';
import type { SideId } from '../data/farmSurvey';
import { exportBoq, download } from '../utils/exports';
const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
export function BoqTable({ result }: { result: ReturnType<typeof calculate> }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Side</th>
            <th>Material / work</th>
            <th className="num">Quantity</th>
            <th>Unit</th>
            <th className="num">Rate</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r, i) => (
            <tr key={i}>
              <td>{r.side}</td>
              <td>{r.item}</td>
              <td className="num">
                {r.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
              </td>
              <td>{r.unit}</td>
              <td className="num">{money(r.rate)}</td>
              <td className="num">{money(r.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={5}>Subtotal at entered rates</th>
            <td className="num">{money(result.subtotal)}</td>
          </tr>
          <tr>
            <th colSpan={5}>GST component (included or added as selected)</th>
            <td className="num">{money(result.tax)}</td>
          </tr>
          <tr>
            <th colSpan={5}>Planning total</th>
            <td className="num">{money(result.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
export function OriginalTable() {
  const { rates } = useFarm();
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Original vendor item</th>
            <th>Qty</th>
            <th>Original rate</th>
            <th>Original amount</th>
            <th>Configured rate</th>
            <th>Same-quantity amount</th>
            <th>Difference</th>
          </tr>
        </thead>
        <tbody>
          {originalQuote.map((row) => {
            const rate = Number(rates[row.rateKey as keyof Rates]),
              amount = row.quantity * rate;
            return (
              <tr key={row.item}>
                <td>{row.item}</td>
                <td>
                  {row.quantity} {row.unit}
                </td>
                <td>{money(row.rate)}</td>
                <td>{money(row.amount)}</td>
                <td>{money(rate)}</td>
                <td>{money(amount)}</td>
                <td>
                  {money(amount - row.amount)} ({((amount / row.amount - 1) * 100).toFixed(1)}%)
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={3}>Original quotation — preserved exactly</th>
            <th>{money(originalTotal)}</th>
            <th colSpan={3}>Tax treatment not stated in source</th>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
export function CostPanel({
  result,
  notify,
}: {
  result: ReturnType<typeof calculate>;
  notify: (s: string) => void;
}) {
  const state = useFarm(),
    { rates } = state,
    [profile, setProfile] = useState('Historical Vendor Rates');
  const set = (key: keyof Rates, value: number | string | boolean) =>
    commit({ ...state, rates: { ...rates, [key]: value } });
  const num = (key: keyof Rates, label: string, max = 1000000, step = 1) => (
    <Numeric
      key={key}
      label={label}
      value={Number(rates[key])}
      max={max}
      step={step}
      onChange={(v) => set(key, v)}
    />
  );
  function saveProfile() {
    localStorage.setItem('ram-rates-' + profile, JSON.stringify(rates));
    notify('Saved ' + profile + ' on this device.');
  }
  function loadProfile(value: string) {
    setProfile(value);
    const raw = localStorage.getItem('ram-rates-' + value);
    if (raw) commit({ ...state, rates: cleanRates(JSON.parse(raw)) });
    else if (value === 'Historical Vendor Rates') commit({ ...state, rates: { ...defaultRates } });
  }
  return (
    <section className="panel report-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">TRANSPARENT QUANTITIES</span>
          <h2>Materials & costs</h2>
        </div>
        <div className="button-row">
          <button onClick={() => exportBoq(result)}>Download CSV BOQ</button>
          <button onClick={() => window.print()}>Print BOQ</button>
        </div>
      </div>
      <p className="help">
        Planning estimate using editable inputs. Mesh and coil weights, pole rates for longer
        lengths, footings and labour need a supplier quote. Recoverable wire is tracked separately
        and does not count as purchased wire.
      </p>
      <BoqTable result={result} />
      <details open>
        <summary>How this was calculated</summary>
        <div className="formula-grid">
          <div>
            <h3>Mesh</h3>
            <p>
              Net section length × (1 + wastage). Rolls = round up (purchased length ÷ roll length).
              Weight = rolls × entered roll weight. Roll rounding is per continuous section/run;
              gate openings can increase roll rounding.
            </p>
          </div>
          <div>
            <h3>Barbed wire</h3>
            <p>
              Raw running length = net fence length × strands. Required wire = raw × (1 + wastage).
              Coils = round up (required wire ÷ coil length). Reused strands are excluded from
              purchase costs.
            </p>
          </div>
          <div>
            <h3>Posts & stays</h3>
            <p>
              Bends, section ends, gates and tension intervals create anchors. Each anchor interval
              uses ceil(length / maximum spacing) + 1 posts. Coincident posts are deduplicated; the
              first new-work side owns the shared cost. Stays are additional poles.
            </p>
          </div>
          <div>
            <h3>Footings & tax</h3>
            <p>
              Square: width² × depth. Circular: π × diameter² × depth ÷ 4. Feet convert to metres
              before volume. Concrete uses gross volume, excluding reuse. GST applies to the full
              subtotal; included tax is extracted, excluded tax is added.
            </p>
          </div>
        </div>
      </details>
      <details>
        <summary>Vendor rates, labour & tax</summary>
        <div className="field-grid">
          <Choice
            label="Rate profile"
            value={profile}
            onChange={loadProfile}
            options={[
              'Historical Vendor Rates',
              'Current Custom Rates',
              'Vendor Quote A',
              'Vendor Quote B',
              'Vendor Quote C',
            ]}
          />
          <button onClick={saveProfile}>Save rate profile</button>
          {num('pole', 'Main pole (₹ / pole)')}
          {num('stay', 'Support pole (₹ / pole)')}
          {num('strainerPremium', 'Strainer upgrade (₹ / assembly)')}
          {num('binding', 'Binding wire (₹ / kg)')}
          {num('tension', 'Tension wire (₹ / ft)', 1000, 0.5)}
          {num('concrete', 'Concrete (₹ / m³)')}
          <Choice
            label="Erection labour basis"
            value={rates.labourMode}
            onChange={(v) => set('labourMode', v)}
            options={['pole', 'ft', 'lump']}
          />
          {num('labour', 'Erection labour (₹ / pole)')}
          {num('labourPerFt', 'Erection labour (₹ / ft)')}
          {num('labourLump', 'Erection labour lump sum (₹)')}
          {num('trip', 'Pole transport (₹ / trip)')}
          {num('trips', 'Pole transport trips', 100)}
          {num('transport', 'Mesh / wire transport (₹)')}
          {num('fixing', 'Mesh fixing / wire removal (₹)')}
          {num('auto', 'Worker transport (₹ / day)')}
          {num('days', 'Worker transport days', 365)}
          {num('mestri', 'Mestri (₹)')}
          {num('loading', 'Loading / unloading (₹)')}
          {num('tax', 'GST (%)', 100, 0.5)}
          <label className="check-field">
            <input
              type="checkbox"
              checked={rates.taxIncluded}
              onChange={(e) => set('taxIncluded', e.target.checked)}
            />{' '}
            Entered rates already include GST
          </label>
        </div>
        <p className="help">
          Mesh and barbed-wire pricing units and rates are editable per fence section. These
          comparison rates reprice the unchanged historical quantities:
        </p>
        <div className="field-grid">
          {num('mesh', 'Historical mesh comparator (₹ / kg)')}
          {num('wire', 'Historical barbed comparator (₹ / kg)')}
        </div>
        <button
          onClick={() => {
            updateScenario((s) => {
              for (const list of Object.values(s.sections))
                for (const sec of list) {
                  sec.config.meshUnit = 'kg';
                  sec.config.meshRate = rates.mesh;
                  sec.config.wireUnit = 'kg';
                  sec.config.wireRate = rates.wire;
                }
            });
            notify('Applied comparison wire rates to every section.');
          }}
        >
          Apply these wire rates to active design
        </button>
      </details>
      <details>
        <summary>Concrete mix conversion (editable assumptions)</summary>
        <div className="field-grid">
          {num('cementFactor', '50-kg cement bags per m³', 30, 0.1)}
          {num('sandFactor', 'Sand m³ per concrete m³', 3, 0.01)}
          {num('aggregateFactor', 'Aggregate m³ per concrete m³', 3, 0.01)}
        </div>
        {(() => {
          const vol = Object.values(result.bySide).reduce((sum, s) => sum + s.concrete, 0);
          return (
            <p>
              {vol.toFixed(2)} m³ gross concrete → {(vol * rates.cementFactor).toFixed(1)} cement
              bags, {(vol * rates.sandFactor).toFixed(2)} m³ sand,{' '}
              {(vol * rates.aggregateFactor).toFixed(2)} m³ aggregate. Confirm the required mix;
              these quantities are not added again to the concrete cost.
            </p>
          );
        })()}
      </details>
      <h3>Items to resolve before ordering</h3>
      {result.warnings.map((w) => (
        <p className="warning" key={w}>
          {w}
        </p>
      ))}
    </section>
  );
}
export function ComparePanel({ notify }: { notify: (s: string) => void }) {
  const state = useFarm(),
    [a, setA] = useState('hybrid'),
    [b, setB] = useState('all'),
    [visible, setVisible] = useState('a'),
    [compare3d, setCompare3d] = useState(false),
    [compareSide, setCompareSide] = useState<SideId | null>(null),
    [name, setName] = useState(state.scenario.name);
  const options: [string, string][] = [
      ['hybrid', 'Preferred Hybrid'],
      ['all', 'All Chain Link'],
      ['active', 'Current edited plan'],
      ...state.saved.map((s, i) => ['saved-' + i, s.name] as [string, string]),
    ],
    get = (id: string): Scenario =>
      id === 'active'
        ? state.scenario
        : id.startsWith('saved-')
          ? state.saved[+id.slice(6)] || preset()
          : preset(id);
  const sa = get(a),
    sb = get(b),
    ra = calculate(sa, state.rates),
    rb = calculate(sb, state.rates);
  const sum = (r: typeof ra, k: keyof typeof r.bySide.W) =>
    Object.values(r.bySide).reduce((sum, v) => sum + v[k], 0);
  const metrics: [string, number, number][] = [
    ['New-work length (ft)', ra.newLength, rb.newLength],
    ...(
      [
        'meshLength',
        'area',
        'rolls',
        'meshKg',
        'rawWire',
        'purchaseWire',
        'reusedWire',
        'coils',
        'wireKg',
        'posts',
        'newPosts',
        'reusedPosts',
        'stays',
        'strainers',
        'concrete',
      ] as const
    ).map(
      (k) =>
        [
          {
            meshLength: 'Mesh length (ft)',
            area: 'Mesh area (sq ft)',
            rolls: 'Mesh rolls',
            meshKg: 'Mesh weight (kg)',
            rawWire: 'Raw barbed running length (ft)',
            purchaseWire: 'New wire required (ft)',
            reusedWire: 'Recovered wire required (ft)',
            coils: 'Barbed coils',
            wireKg: 'New wire weight (kg)',
            posts: 'Main posts',
            newPosts: 'New posts',
            reusedPosts: 'Reused posts',
            stays: 'Support poles',
            strainers: 'Strainer assemblies',
            concrete: 'Concrete (m³)',
          }[k],
          sum(ra, k),
          sum(rb, k),
        ] as [string, number, number],
    ),
  ];
  const repriced = originalQuote.reduce(
      (s, row) => s + row.quantity * Number(state.rates[row.rateKey as keyof Rates]),
      0,
    ),
    priceEffect = repriced - originalTotal;
  return (
    <section className="panel report-panel">
      <h2>Compare scenarios</h2>
      <div className="field-grid">
        <Choice label="Scenario A" value={a} options={options} onChange={setA} />
        <Choice label="Scenario B" value={b} options={options} onChange={setB} />
      </div>
      <div className="compare-totals">
        <div>
          <span>{sa.name}</span>
          <strong>{money(ra.total)}</strong>
          <small>{sa.basis} length basis</small>
        </div>
        <div>
          <span>{sb.name}</span>
          <strong>{money(rb.total)}</strong>
          <small>{money(rb.total - ra.total)} difference</small>
        </div>
      </div>
      <div className="button-row">
        <button className={visible === 'a' ? 'active' : ''} onClick={() => setVisible('a')}>
          Show A
        </button>
        <button className={visible === 'b' ? 'active' : ''} onClick={() => setVisible('b')}>
          Show B
        </button>
        <button
          onClick={() =>
            updateScenario((s) => Object.assign(s, structuredClone(visible === 'a' ? sa : sb)))
          }
        >
          Use visible scenario
        </button>
      </div>
      <button onClick={() => setCompare3d(!compare3d)}>
        {compare3d ? 'Show map comparison' : 'Show 3D comparison'}
      </button>
      {compare3d ? (
        <Farm3D
          scenario={visible === 'a' ? sa : sb}
          result={visible === 'a' ? ra : rb}
          selected={compareSide}
          onSide={setCompareSide}
          onPost={() => {}}
        />
      ) : (
        <Plan
          scenario={visible === 'a' ? sa : sb}
          result={visible === 'a' ? ra : rb}
          selected={null}
          onSide={() => {}}
        />
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Quantity</th>
              <th>A</th>
              <th>B</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(([label, x, y]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{x.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                <td>{y.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                <td>{(y - x).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details open>
        <summary>Save, duplicate or rename scenarios</summary>
        <div className="field-grid">
          <label className="field">
            Scenario name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <button
            onClick={() => {
              if (!name.trim()) return;
              updateScenario((s) => {
                s.name = name;
              });
            }}
          >
            Rename current plan
          </button>
          <button
            onClick={() => {
              if (state.saved.length >= 20) {
                notify('Maximum 20 saved scenarios. Export or delete an older one.');
                return;
              }
              commit({
                ...state,
                saved: [
                  ...state.saved,
                  { ...structuredClone(state.scenario), name: name.trim() || 'Saved plan' },
                ],
              });
              notify('Saved an independent copy.');
            }}
          >
            Duplicate / save current
          </button>
          <button onClick={() => updateScenario((s) => Object.assign(s, preset('custom')))}>
            New custom scenario
          </button>
          <button onClick={() => updateScenario((s) => Object.assign(s, preset()))}>
            Reset current to preferred
          </button>
        </div>
        {state.saved.map((s, i) => (
          <div className="gate-row" key={i}>
            <span>{s.name}</span>
            <button onClick={() => download(JSON.stringify(s, null, 2), 'ram-scenario.json')}>
              Export
            </button>
            <button
              onClick={() => commit({ ...state, saved: state.saved.filter((_, j) => j !== i) })}
            >
              Delete saved copy
            </button>
          </div>
        ))}
      </details>
      <h2>Original vendor quotation</h2>
      <p>
        Historical source total: <b>{money(originalTotal)}</b>. Original quantities are immutable.
        East eye size is preserved as 3 inches per your clarification.
      </p>
      <OriginalTable />
      <div className="formula-grid">
        <div>
          <h3>Price-only change</h3>
          <strong>{money(priceEffect)}</strong>
          <p>
            Original quantities repriced at current comparator inputs, before applying a tax
            interpretation.
          </p>
        </div>
        <div>
          <h3>Design / quantity / other change</h3>
          <strong>{money(calculate(state.scenario, state.rates).subtotal - repriced)}</strong>
          <p>
            Current design subtotal minus repriced original quote. Includes changed quantities,
            added scope and section-specific unit-rate differences. Align section rates with
            comparison rates for a cleaner quantity-only comparison.
          </p>
        </div>
      </div>
      <p className="notice">
        Road mesh height in the handwriting can be read as 5½ ft. The immutable historical dataset
        follows your supplied master transcription of 5 ft; the original photo remains available for
        verification.
      </p>
    </section>
  );
}
