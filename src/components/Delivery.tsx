import { parseScenario, type Scenario } from '../data/scenarios';
import { calculate, lengthFor } from '../geometry/materialCalculator';
import { sideIds, sides } from '../data/farmSurvey';
import { useFarm, commit, cleanRates } from '../store/farmStore';
import { download, shareUrl, readConfig, exportBoq } from '../utils/exports';
import { BoqTable, OriginalTable } from './Reports';
import { Plan } from './Plan';
import { CrossSection, Elevation } from './Engineering';
type Result = ReturnType<typeof calculate>;
export function VendorSchedule({ scenario: s, result: r }: { scenario: Scenario; result: Result }) {
  return (
    <section className="panel report-panel vendor-summary">
      <h2>Contractor work schedule</h2>
      {sideIds.map((id) => (
        <div className="vendor-side" key={id}>
          <h3>
            {sides[id].name} · {r.bySide[id].net.toFixed(0)} ft new work
          </h3>
          {s.sections[id].map((sec) => (
            <div key={sec.id}>
              <p>
                {(sec.start * lengthFor(s, id)).toFixed(0)}–
                {(sec.end * lengthFor(s, id)).toFixed(0)} ft:{' '}
                {sec.config.type === 'existing'
                  ? 'EXISTING NEIGHBOUR FENCE — NO NEW WORK'
                  : `${sec.config.type} · ${sec.config.height} ft height · ${sec.config.type === 'barbed' ? `${sec.config.material} · ${sec.config.wireDiameter} mm wire` : `${sec.config.eye}″ eye · ${sec.config.diameter} mm mesh wire`} · ${sec.config.strands} strands`}
              </p>
              {sec.config.type !== 'existing' && (
                <p>
                  {sec.config.poleLength}-ft {sec.config.poleType} pole · {sec.config.embed}-ft
                  burial · maximum {sec.config.spacing}-ft spacing. Supports:{' '}
                  {sec.config.supportMode} / {sec.config.supportEvery}.
                </p>
              )}
            </div>
          ))}
        </div>
      ))}
      <BoqTable result={r} />
      <h3>Confirm before ordering</h3>
      {r.warnings.map((w) => (
        <p className="warning" key={w}>
          {w}
        </p>
      ))}
    </section>
  );
}
export function ExportPanel({
  result,
  notify,
  onView,
}: {
  result: Result;
  notify: (s: string) => void;
  onView: (s: string) => void;
}) {
  const state = useFarm();
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied to clipboard.');
    } catch {
      download(text, 'ram-summary.txt', 'text/plain');
      notify('Clipboard unavailable; downloaded a text file.');
    }
  };
  return (
    <section className="panel report-panel">
      <h2>Take the plan with you</h2>
      <p>
        Your edits save on this device. JSON is a durable backup. Shared links include the design
        and inspection notes, and active rates, but omit photos and saved rate profiles.
      </p>
      <div className="export-grid">
        <button onClick={() => download(JSON.stringify(state, null, 2), 'ram-farm-plan.json')}>
          Export configuration JSON
        </button>
        <label className="file-button">
          Import configuration JSON
          <input
            type="file"
            accept=".json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const text = await f.text(),
                  data = JSON.parse(text),
                  scenario = readConfig(text);
                commit({
                  ...state,
                  scenario,
                  rates: data.rates ? cleanRates(data.rates) : state.rates,
                  saved: Array.isArray(data.saved)
                    ? data.saved.slice(0, 20).map(parseScenario)
                    : state.saved,
                });
                notify('Configuration validated and imported.');
              } catch (err) {
                notify('Import rejected: ' + (err as Error).message);
              }
              e.target.value = '';
            }}
          />
        </label>
        <button onClick={() => exportBoq(result)}>Download CSV BOQ</button>
        <button onClick={() => window.print()}>Print vendor plan / Save PDF</button>
        <button onClick={() => void copy(shareUrl(state.scenario, state.rates))}>
          Copy scenario link
        </button>
        <button
          onClick={() =>
            void copy(
              `Ram’s farm — ${state.scenario.name}\n${sideIds.map((id) => `${sides[id].name}: ${result.bySide[id].net.toFixed(0)} ft new work; ${state.scenario.sections[id].map((sec) => `${sec.config.type}, ${sec.config.height} ft, ${sec.config.strands} strands`).join('; ')}`).join('\n')}\n${state.scenario.basis} quantities; geometry remains survey-based.\nPlanning estimate INR ${Math.round(result.total).toLocaleString('en-IN')}; confirm rates and reuse.\n${shareUrl(state.scenario, state.rates)}`,
            )
          }
        >
          Copy WhatsApp summary
        </button>
        <button onClick={() => onView('3d')}>Open 3D capture</button>
        <button onClick={() => onView('engineering')}>Open elevation capture</button>
        <button onClick={() => onView('plan')}>Open top plan capture</button>
        <button onClick={() => onView('inspection')}>Import / export inspections</button>
      </div>
      <p className="help">
        No message is sent automatically. Paste the summary into your chosen conversation. Built-in
        URL fragments: #hybrid and #all. Use Share for custom settings.
      </p>
    </section>
  );
}
export function PrintPack({
  scenario: s,
  result: r,
  preview = false,
}: {
  scenario: Scenario;
  result: Result;
  preview?: boolean;
}) {
  return (
    <div className={preview ? 'print-pack screen-preview' : 'print-pack'}>
      <section>
        <h1>Ram’s farm fencing plan</h1>
        <p>
          {s.name} · {s.basis} quantities · {new Date().toLocaleDateString('en-IN')}
        </p>
        <Plan scenario={s} result={r} selected={null} onSide={() => {}} />
        <table>
          <thead>
            <tr>
              <th>Side</th>
              <th>Survey ft</th>
              <th>New-work ft</th>
              <th>Treatment</th>
            </tr>
          </thead>
          <tbody>
            {sideIds.map((id) => (
              <tr key={id}>
                <td>{sides[id].name}</td>
                <td>{sides[id].survey}</td>
                <td>{r.bySide[id].net.toFixed(1)}</td>
                <td>{s.sections[id].map((sec) => sec.config.type).join(' / ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {(['W', 'E', 'S'] as const).map((id) => (
        <section key={id}>
          <h1>
            {sides[id].name} · {lengthFor(s, id)} ft
          </h1>
          <div className="print-engineering">
            <CrossSection config={s.sections[id][0].config} />
            <div>
              <h3>Side specification</h3>
              {s.sections[id].map((sec) => (
                <p key={sec.id}>
                  {(sec.start * lengthFor(s, id)).toFixed(1)}–
                  {(sec.end * lengthFor(s, id)).toFixed(1)} ft: {sec.config.type},{' '}
                  {sec.config.height}-ft fence, {sec.config.eye}″ eye, {sec.config.diameter} mm,{' '}
                  {sec.config.strands} strands. {sec.config.poleLength}-ft poles /{' '}
                  {sec.config.embed}-ft embed / {sec.config.spacing}-ft maximum spacing. Supports:{' '}
                  {sec.config.supportMode}, {sec.config.supportEvery}.
                </p>
              ))}
              <p>
                {r.bySide[id].posts} main posts · {r.bySide[id].newPosts} new ·{' '}
                {r.bySide[id].reusedPosts} reused · {r.bySide[id].stays} stays ·{' '}
                {r.bySide[id].concrete.toFixed(2)} m³ concrete.
              </p>
              <p>
                Gates:{' '}
                {s.gates
                  .filter((g) => g.side === id)
                  .map((g) => `${g.width} ft at ${(g.at * lengthFor(s, id)).toFixed(1)} ft`)
                  .join('; ') || 'None proposed; location unconfirmed.'}
              </p>
            </div>
          </div>
          <p>
            Full side elevation (horizontal scale compressed); use the interactive elevation for
            detailed chainage.
          </p>
          <Elevation scenario={s} result={r} side={id} />
        </section>
      ))}
      <section>
        <h1>Bill of quantities</h1>
        <BoqTable result={r} />
      </section>
      <section>
        <h1>Original quotation comparison</h1>
        <OriginalTable />
        <p>
          Original ₹4,63,410 preserved. Road height uses the supplied 5-ft transcription; photo may
          read 5½ ft. East eye: 3 inches per user clarification.
        </p>
      </section>
      <section>
        <h1>Assumptions & clarifications</h1>
        {r.warnings.map((w) => (
          <p key={w}>{w}</p>
        ))}
        <p>
          Official LP coordinates define geometry. Working quantities define procurement. North
          fence is supplied by the neighbour and excluded by default. Terrain, road width, planting
          and generated post locations are illustrative. Gate positions are proposals.
        </p>
        <p>
          8-ft spacing is inferred, not explicitly stated. Stay ratio 3.42 is a configurable
          historical reference. Confirm roll / coil weights, recovered wire condition, pole
          dimensions, support design, footings, rates, tax and labour scope before ordering.
        </p>
        <p>
          Rolls and coils round up per continuous run. Shared posts count once. GST applies to the
          entered subtotal. Reused-wire shortfalls are not automatically purchased.
        </p>
      </section>
    </div>
  );
}
