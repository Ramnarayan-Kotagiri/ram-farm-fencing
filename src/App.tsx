import { useEffect, useMemo, useState } from 'react';
import { Configurator } from './components/Configurator';
import { CostPanel, ComparePanel } from './components/Reports';
import { Sources } from './components/Sources';
import { Inspection } from './components/Inspection';
import { GeoMap } from './components/GeoMap';
import { ExportPanel, PrintPack, VendorSchedule } from './components/Delivery';
import { shareUrl, svgPng } from './utils/exports';
import {
  Trees,
  Map,
  Box,
  Ruler,
  Calculator,
  GitCompare,
  FileCheck,
  Share2,
  Printer,
  ArrowUpRight,
} from 'lucide-react';
import { useFarm, updateScenario, startupWarning } from './store/farmStore';
import { sideIds, sides, type SideId } from './data/farmSurvey';
import { preset } from './data/scenarios';
import { calculate, lengthFor } from './geometry/materialCalculator';
import { Plan } from './components/Plan';
import { Farm3D } from './components/Farm3D';
import { CrossSection, Elevation, SupportAssembly } from './components/Engineering';
export const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
export default function App() {
  const { scenario, rates } = useFarm(),
    [side, setSide] = useState<SideId | null>(null),
    [view, setView] = useState('plan'),
    [vendor, setVendor] = useState(false),
    [post, setPost] = useState(''),
    [notice, setNotice] = useState(startupWarning),
    [zoom, setZoom] = useState(1),
    [sectionIndex, setSectionIndex] = useState(0);
  const result = useMemo(() => calculate(scenario, rates), [scenario, rates]),
    active = side || 'W',
    config =
      scenario.sections[active][Math.min(sectionIndex, scenario.sections[active].length - 1)]
        .config;
  useEffect(() => {
    const onNotice = (e: Event) => setNotice((e as CustomEvent).detail);
    window.addEventListener('farm-notice', onNotice);
    return () => window.removeEventListener('farm-notice', onNotice);
  }, []);
  const visual = ['plan', '3d', 'engineering', 'map'].includes(view);
  function selectPost(id: string) {
    setPost(id);
    setView('inspection');
  }
  return (
    <div className={vendor ? 'app vendor' : 'app'}>
      <header className="header">
        <div className="brand">
          <span className="brand-icon">
            <Trees size={26} />
          </span>
          <div>
            <strong>Ram’s Farm</strong>
            <span>VADLAPALLI · FENCING PLANNER</span>
          </div>
        </div>
        <div className="header-actions">
          <button className={!vendor ? 'active' : ''} onClick={() => setVendor(false)}>
            Farmer View
          </button>
          <button
            className={vendor ? 'active' : ''}
            onClick={() => {
              setVendor(true);
              setView('plan');
            }}
          >
            Vendor View
          </button>
          <button
            onClick={() =>
              navigator.clipboard
                .writeText(shareUrl(scenario, rates))
                .then(() =>
                  setNotice('Scenario link copied; inspection photos stay on your device.'),
                )
                .catch(() => setNotice('Clipboard unavailable. Use configuration JSON export.'))
            }
          >
            <Share2 size={16} /> Share
          </button>
          <button onClick={() => setView('print')}>
            <Printer size={16} /> Print
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-label">THE FARM</div>
          <button
            className={`side-button ${side === null ? 'selected' : ''}`}
            onClick={() => {
              setSide(null);
              setView('plan');
            }}
          >
            <Map size={18} />
            <span>
              Farm overview<small>One continuous 22.04-acre farm</small>
            </span>
          </button>
          {sideIds.map((id) => (
            <button
              key={id}
              className={`side-button ${side === id ? 'selected' : ''}`}
              onClick={() => {
                setSide(id);
                if (!visual) setView('plan');
              }}
            >
              <span className={`side-letter ${id}`}>{id}</span>
              <span>
                {sides[id].name}
                <small>
                  {id === 'N' && scenario.sections.N[0].config.type === 'existing'
                    ? 'Existing · no new work'
                    : `${lengthFor(scenario, id).toLocaleString('en-IN')} ft · ${scenario.sections[id][0].config.type}`}
                </small>
              </span>
            </button>
          ))}
          <div className="sidebar-label">PLAN & ESTIMATE</div>
          <button className="side-button" onClick={() => setView('boq')}>
            <Calculator size={18} />
            <span>Materials & costs</span>
          </button>
          <button className="side-button" onClick={() => setView('compare')}>
            <GitCompare size={18} />
            <span>Compare scenarios</span>
          </button>
          <button className="side-button" onClick={() => setView('sources')}>
            <FileCheck size={18} />
            <span>Accuracy & sources</span>
          </button>
          <div className="sidebar-note">
            <b>Survey shape. Working quantities.</b>
            <p>
              The map always uses official LP coordinates. The estimate uses your selected length
              basis.
            </p>
          </div>
          <div className="sidebar-foot">
            16.9624° N · 81.2150° E<br />
            Eluru district, Andhra Pradesh
          </div>
        </aside>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR FARM, SIDE BY SIDE</span>
              <h1>
                {visual
                  ? side
                    ? sides[side].name
                    : 'Plan the boundary.'
                  : (
                      {
                        boq: 'Materials & costs',
                        compare: 'Compare scenarios',
                        sources: 'Accuracy & sources',
                        inspection: 'Post inspections',
                        exports: 'Share & export',
                        print: 'Contractor print preview',
                      } as Record<string, string>
                    )[view]}
              </h1>
              <p>
                {side
                  ? 'Inspect the design, dimensions and materials for this side.'
                  : 'A clear view of the fence, the materials, and the work ahead.'}
              </p>
            </div>
            <label className="scenario-picker">
              ACTIVE SCENARIO
              <select
                value="active"
                onChange={(e) => updateScenario((s) => Object.assign(s, preset(e.target.value)))}
              >
                <option value="active">{scenario.name}</option>
                <option value="hybrid">Load Preferred Hybrid</option>
                <option value="all">Load All Chain Link</option>
                <option value="custom">New Custom</option>
              </select>
            </label>
          </div>
          <div className="basis-bar">
            <div>
              <Ruler size={19} />
              <span>BOQ LENGTH BASIS</span>
            </div>
            <div className="segmented">
              <button
                className={scenario.basis === 'survey' ? 'active' : ''}
                onClick={() => {
                  try {
                    updateScenario((s) => {
                      s.basis = 'survey';
                    });
                  } catch (e) {
                    setNotice((e as Error).message);
                  }
                }}
              >
                Official LP Survey
              </button>
              <button
                className={scenario.basis === 'contractor' ? 'active' : ''}
                onClick={() => {
                  try {
                    updateScenario((s) => {
                      s.basis = 'contractor';
                    });
                  } catch (e) {
                    setNotice((e as Error).message);
                  }
                }}
              >
                Contractor Working Quantity
              </button>
            </div>
            <span className="basis-note">Geometry stays survey-based</span>
          </div>
          <div className="stats">
            <div>
              <span>Farm area · LP records</span>
              <strong>
                22.04 <small>acres</small>
              </strong>
              <p>One merged outer boundary</p>
            </div>
            <div>
              <span>New-work length</span>
              <strong>
                {result.newLength.toLocaleString('en-IN', { maximumFractionDigits: 0 })}{' '}
                <small>ft</small>
              </strong>
              <p>
                {scenario.basis === 'contractor'
                  ? 'Contractor working quantities'
                  : 'Official LP lengths'}
              </p>
            </div>
            <div>
              <span>North neighbour boundary</span>
              <strong>{money(result.bySide.N.cost)}</strong>
              <p>
                {scenario.sections.N[0].config.type === 'existing'
                  ? 'Existing fence · excluded'
                  : 'Future-work override active'}
              </p>
            </div>
            <div className="total-stat">
              <span>Planning estimate</span>
              <strong>{money(result.total)}</strong>
              <p>Editable historical rates · inspect reuse</p>
            </div>
          </div>
          <div className="feature-toolbar no-print">
            {[
              ['plan', 'Farm view'],
              ['boq', 'Materials & costs'],
              ['exports', 'Share & export'],
            ].map(([id, label]) => (
              <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
                {label}
              </button>
            ))}
            <details className="more-tools">
              <summary>More tools</summary>
              <div>
                <button onClick={() => setView('compare')}>Compare scenarios</button>
                <button onClick={() => setView('inspection')}>Post inspections</button>
                <button onClick={() => setView('sources')}>Accuracy & sources</button>
              </div>
            </details>
          </div>
          {visual && (
            <>
              <div className="main-grid">
                <section className="visual-card">
                  <div className="view-tabs">
                    {[
                      ['plan', Map, 'Survey plan'],
                      ['3d', Box, '3D & walk'],
                      ['engineering', Ruler, 'Engineering'],
                      ['map', Map, 'Geo map'],
                    ].map(([id, Icon, label]) => {
                      const I = Icon as typeof Map;
                      return (
                        <button
                          key={String(id)}
                          className={view === id ? 'active' : ''}
                          onClick={() => setView(String(id))}
                        >
                          <I size={16} />
                          {String(label)}
                        </button>
                      );
                    })}
                  </div>
                  {view === '3d' ? (
                    <Farm3D
                      scenario={scenario}
                      result={result}
                      selected={side}
                      onSide={setSide}
                      onPost={selectPost}
                    />
                  ) : view === 'map' ? (
                    <GeoMap
                      scenario={scenario}
                      result={result}
                      onSide={setSide}
                      onPost={selectPost}
                    />
                  ) : view === 'engineering' ? (
                    <>
                      <div className="engineering-toolbar">
                        <label>
                          Cross-section section
                          <select
                            value={sectionIndex}
                            onChange={(e) => setSectionIndex(+e.target.value)}
                          >
                            {scenario.sections[active].map((sec, i) => (
                              <option key={sec.id} value={i}>
                                {(sec.start * lengthFor(scenario, active)).toFixed(0)}–
                                {(sec.end * lengthFor(scenario, active)).toFixed(0)} ft
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Elevation zoom
                          <input
                            type="range"
                            min=".5"
                            max="5"
                            step=".5"
                            value={zoom}
                            onChange={(e) => setZoom(+e.target.value)}
                          />
                        </label>
                        <button
                          onClick={() =>
                            void svgPng(
                              'elevation-' + active,
                              'ram-' + active + '-elevation.png',
                            ).catch((e) => setNotice(String(e)))
                          }
                        >
                          Elevation PNG
                        </button>
                      </div>
                      <CrossSection config={config} />
                      {config.supportMode !== 'none' && <SupportAssembly config={config} />}
                      <Elevation scenario={scenario} result={result} side={active} zoom={zoom} />
                    </>
                  ) : (
                    <Plan
                      scenario={scenario}
                      result={result}
                      selected={side}
                      onSide={setSide}
                      onPost={selectPost}
                      showPosts={!!side}
                    />
                  )}
                  <div className="legend">
                    <span>
                      <i className="mesh" />
                      Chain link
                    </span>
                    <span>
                      <i className="barbed" />
                      Barbed wire
                    </span>
                    <span>
                      <i className="existing" />
                      Existing neighbour fence
                    </span>
                    <span>
                      <i className="unknown" />
                      Inspect / unknown
                    </span>
                  </div>
                </section>
                <aside className="detail-card">
                  <span className="eyebrow">
                    {side ? 'SIDE DESIGN' : scenario.name.toUpperCase()}
                  </span>
                  <h2>{side ? sides[side].name : 'Three sides. One plan.'}</h2>
                  {(side ? [side] : sideIds).map((id) => (
                    <button
                      key={id}
                      className="treatment"
                      onClick={() => {
                        setSide(id);
                        if (!visual) setView('plan');
                      }}
                    >
                      <span className={`side-letter ${id}`}>{id}</span>
                      <span>
                        <b>{sides[id].name}</b>
                        <small>
                          {scenario.sections[id][0].config.type === 'existing'
                            ? 'Existing fence · no new work'
                            : scenario.sections[id][0].config.type === 'barbed'
                              ? `${scenario.sections[id][0].config.strands} strands · barbed wire`
                              : `${scenario.sections[id][0].config.height} ft chain link · ${scenario.sections[id][0].config.eye}″ eye`}
                        </small>
                        <small>
                          {sides[id].survey} ft survey /{' '}
                          {id === 'N' && result.bySide.N.net === 0
                            ? '0 ft new work'
                            : `${lengthFor(scenario, id)} ft BOQ`}
                        </small>
                      </span>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                  <div className="notice">
                    <b>Roadside reuse needs inspection</b>
                    <p>
                      The quote currently allows for new poles until usable existing poles are
                      confirmed.
                    </p>
                  </div>
                  {result.warnings
                    .filter(
                      (w) =>
                        !side ||
                        w.startsWith(sides[side].name) ||
                        (side === 'W' && w.startsWith('Road')),
                    )
                    .slice(0, 2)
                    .map((w) => (
                      <p className="warning" key={w}>
                        {w}
                      </p>
                    ))}
                  <button
                    className="primary wide"
                    onClick={() => {
                      setSide(active);
                      setView('engineering');
                    }}
                  >
                    Inspect {sides[active].name}
                  </button>
                </aside>
              </div>
              {view === 'plan' && (
                <button
                  className="export-plan no-print"
                  onClick={() =>
                    void svgPng('top-plan', 'ram-top-plan.png').catch((e) => setNotice(String(e)))
                  }
                >
                  Save top plan PNG
                </button>
              )}
              <details className="customize-drawer" key={active + String(vendor)}>
                <summary>
                  <strong>
                    {vendor ? 'Adjust specifications for your quote' : 'Customize this side'}
                  </strong>
                  <span>{sides[active].name} · fence, poles, supports, gates & more</span>
                </summary>
                <Configurator
                  onSelectSection={setSectionIndex}
                  side={active}
                  result={result}
                  notify={setNotice}
                />
              </details>
              {vendor && <VendorSchedule scenario={scenario} result={result} />}
            </>
          )}
          {view === 'boq' && <CostPanel result={result} notify={setNotice} />}
          {view === 'compare' && <ComparePanel notify={setNotice} />}
          {view === 'sources' && <Sources />}
          {view === 'inspection' && (
            <Inspection result={result} selected={post} onSelect={setPost} notify={setNotice} />
          )}
          {view === 'exports' && (
            <ExportPanel result={result} notify={setNotice} onView={setView} />
          )}
          {view === 'print' && (
            <>
              <div className="panel no-print">
                <h2>Contractor print preview</h2>
                <p>
                  Review the pages below, then use your browser’s Print / Save as PDF. If the in-app
                  browser does not open a print dialog, open this URL in Chrome or Edge.
                </p>
                <button className="primary" onClick={() => window.print()}>
                  Print / Save PDF
                </button>
              </div>
              <PrintPack scenario={scenario} result={result} preview />
            </>
          )}

          <footer>
            Boundary: WGS84 / UTM 44N · Terrain, planting and existing post locations are
            illustrative until measured.
          </footer>
        </main>
      </div>
      <PrintPack scenario={scenario} result={result} />
      {notice && (
        <div className="toast no-print" role="status">
          {notice}
          <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
