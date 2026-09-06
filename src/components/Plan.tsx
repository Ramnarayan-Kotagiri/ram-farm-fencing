import { useState } from 'react';
import { polygon, path, point, areaM2, atPath } from '../geometry/coordinateTransform';
import { sideIds, sides, type SideId, vertices } from '../data/farmSurvey';
import type { Scenario } from '../data/scenarios';
import { calculate, lengthFor } from '../geometry/materialCalculator';
export function Plan({
  scenario,
  result,
  selected,
  onSide,
  onPost,
  showPosts = false,
}: {
  scenario: Scenario;
  result: ReturnType<typeof calculate>;
  selected: SideId | null;
  onSide: (s: SideId) => void;
  onPost?: (id: string) => void;
  showPosts?: boolean;
}) {
  const [rotation, setRotation] = useState(0),
    [zoom, setZoom] = useState(1),
    [measure, setMeasure] = useState(false),
    [marks, setMarks] = useState<{ x: number; z: number }[]>([]);
  const p = (a: { x: number; z: number }) => `${a.x},${a.z}`;
  return (
    <div className="plan-wrap">
      <div className="plan-tools no-print">
        <button
          onClick={() => {
            setZoom(1);
            setRotation(0);
          }}
        >
          Fit farm / North up
        </button>
        <button onClick={() => setZoom(Math.min(3, zoom + 0.25))}>＋</button>
        <button onClick={() => setZoom(Math.max(0.7, zoom - 0.25))}>−</button>
        <button onClick={() => setRotation(rotation + 15)}>Rotate 15°</button>
        <button
          className={measure ? 'active' : ''}
          onClick={() => {
            setMeasure(!measure);
            setMarks([]);
          }}
        >
          Measure
        </button>
      </div>
      <svg
        id="top-plan"
        viewBox="-65 -210 635 425"
        role="img"
        aria-label="Merged seven-vertex survey boundary, north at top"
        onClick={(e) => {
          if (!measure) return;
          const svg = e.currentTarget,
            pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const matrix = (svg.querySelector('g[data-farm]') as SVGGElement).getScreenCTM();
          if (matrix) {
            const a = pt.matrixTransform(matrix.inverse());
            setMarks((m) => (m.length === 2 ? [{ x: a.x, z: a.y }] : [...m, { x: a.x, z: a.y }]));
          }
        }}
      >
        <defs>
          <pattern id="field-grid" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle r="1.1" fill="#52744a" opacity=".28" />
          </pattern>
          <pattern id="mesh-hatch" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M0 0L4 4M4 0L0 4" stroke="#5cb4d5" strokeWidth=".5" />
          </pattern>
        </defs>
        <rect x="-1000" y="-1000" width="2000" height="2000" fill="#e9eee2" />
        <g
          data-farm
          transform={`translate(248,-10) rotate(${rotation}) scale(${zoom}) translate(-248,10)`}
        >
          <path d="M-16 165L-17 -180" stroke="#c2a786" strokeWidth="18" />
          <path d="M-16 165L-17 -180" stroke="#b39676" strokeDasharray="4 5" strokeWidth="1" />
          <polygon
            points={polygon.map(p).join(' ')}
            fill="#c4d2aa"
            stroke="#768d62"
            strokeWidth="1"
          />
          <polygon points={polygon.map(p).join(' ')} fill="url(#field-grid)" />
          {result.runs.map((run, i) => {
            const c = run.section.config;
            if (c.type === 'none') return null;
            const pts = [
              atPath(run.side, run.start),
              ...sides[run.side].path.map(point).filter((a) => {
                const f =
                  Math.abs(a.x - atPath(run.side, run.start).x) +
                  Math.abs(a.z - atPath(run.side, run.start).z);
                return f > 0;
              }),
            ];
            void pts;
            const samples = Array.from({ length: 80 }, (_, j) =>
              atPath(run.side, run.start + ((run.end - run.start) * j) / 79),
            );
            return (
              <polyline
                key={i}
                points={samples.map(p).join(' ')}
                fill="none"
                stroke={
                  c.type === 'existing' ? '#739762' : c.type === 'barbed' ? '#bf7b3e' : '#328ead'
                }
                strokeWidth={selected === run.side ? 5 : 3}
                strokeDasharray={
                  c.type === 'existing' ? '7 4' : c.type === 'barbed' ? '3 2' : undefined
                }
                onClick={(e) => {
                  if (!measure) {
                    e.stopPropagation();
                    onSide(run.side);
                  }
                }}
                className="clickable"
              >
                <title>
                  {sides[run.side].name}: {c.type}
                </title>
              </polyline>
            );
          })}
          {sideIds.map((side) => (
            <polyline
              key={side}
              points={path(side).map(p).join(' ')}
              stroke="transparent"
              strokeWidth="12"
              fill="none"
              onClick={() => !measure && onSide(side)}
              className="clickable"
            />
          ))}
          {showPosts &&
            result.posts.map((post) => (
              <circle
                key={post.id}
                cx={post.x}
                cy={post.z}
                r={post.strainer ? 1.8 : 1.1}
                fill={
                  post.reuse
                    ? '#4b985c'
                    : post.condition === 'unknown'
                      ? '#dfae48'
                      : post.condition === 'cracked' || post.condition === 'leaning'
                        ? '#bc5040'
                        : '#eff2ec'
                }
                stroke="#4a5146"
                strokeWidth=".4"
                onClick={(e) => {
                  e.stopPropagation();
                  onPost?.(post.id);
                }}
                className="clickable"
              >
                <title>
                  {post.id} · {post.chainage.toFixed(1)} ft
                </title>
              </circle>
            ))}
          {scenario.gates.map((g) => {
            const a = atPath(g.side, g.at),
              b = atPath(g.side, g.at + g.width / lengthFor(scenario, g.side));
            return (
              <line key={g.id} x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke="#b18bcc" strokeWidth="5">
                <title>{g.width}-ft gate</title>
              </line>
            );
          })}
          <text x="245" y="-28" textAnchor="middle" className="map-title">
            ONE CONTINUOUS FARM
          </text>
          <text x="245" y="-7" textAnchor="middle" className="map-area">
            22.04 acres
          </text>
          <text x="245" y="9" textAnchor="middle" className="map-caption">
            Official LP boundary · illustrative planting
          </text>
          {vertices.map((v) => {
            const a = point(v.id);
            return (
              <g key={v.id}>
                <circle cx={a.x} cy={a.z} r="3" fill="#fff" stroke="#354f3a" />
                <text x={a.x + 5} y={a.z - 5} fontSize="8" fontWeight="700">
                  {v.id}
                </text>
              </g>
            );
          })}
          <g className="map-side" onClick={() => onSide('N')}>
            <text x="245" y="-126" textAnchor="middle">
              NORTH ·{' '}
              {result.bySide.N.net === 0 ? 'EXISTING NEIGHBOUR FENCE' : 'PROPOSED NEW FENCE'}
            </text>
            <text x="245" y="-111" textAnchor="middle">
              1,621.39 ft survey ·{' '}
              {result.bySide.N.net === 0 ? 'NO NEW WORK' : 'FUTURE WORK OVERRIDE'}
            </text>
          </g>
          <g
            className="map-side"
            onClick={() => onSide('W')}
            transform="translate(-32,5) rotate(-90)"
          >
            <text textAnchor="middle">ROAD / WEST · 801.48 ft survey</text>
          </g>
          <g
            className="map-side"
            onClick={() => onSide('E')}
            transform="translate(519,-18) rotate(90)"
          >
            <text textAnchor="middle">BACK / EAST · 420.34 ft survey</text>
          </g>
          <g className="map-side" onClick={() => onSide('S')}>
            <text x="248" y="128" textAnchor="middle">
              SOUTH · 1,599.31 ft survey
            </text>
            <text x="248" y="143" textAnchor="middle">
              {lengthFor(scenario, 'S').toLocaleString('en-IN')} ft BOQ basis
            </text>
          </g>
          {marks.map((a, i) => (
            <circle key={i} cx={a.x} cy={a.z} r="3" fill="#bd4250" />
          ))}
          {marks.length === 2 && (
            <line
              x1={marks[0].x}
              y1={marks[0].z}
              x2={marks[1].x}
              y2={marks[1].z}
              stroke="#bd4250"
              strokeWidth="2"
            />
          )}
        </g>
        <g transform="translate(540,-181)">
          <path d="M0 20L6 0L12 20L6 15Z" fill="#304935" />
          <text x="6" y="-5" textAnchor="middle" fontSize="10">
            N
          </text>
        </g>
        <g transform="translate(420,182)">
          <path d="M0 -4V0H100V-4M50 0V-4" fill="none" stroke="#304935" />
          <text x="50" y="12" textAnchor="middle" fontSize="8">
            100 m at default zoom
          </text>
        </g>
      </svg>
      {measure && (
        <p className="map-measure">
          Select two points.{' '}
          {marks.length === 2
            ? `Distance: ${Math.hypot(marks[0].x - marks[1].x, marks[0].z - marks[1].z).toFixed(2)} m · `
            : ''}
          UTM polygon area: {areaM2.toLocaleString('en-IN', { maximumFractionDigits: 1 })} m² (
          {(areaM2 / 4046.8564224).toFixed(2)} acres).
        </p>
      )}
    </div>
  );
}
