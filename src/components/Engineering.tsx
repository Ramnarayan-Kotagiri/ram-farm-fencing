import { useId } from 'react';
import type { FenceConfig, Scenario } from '../data/scenarios';
import { hasMesh, wireHeights, calculate, lengthFor } from '../geometry/materialCalculator';
import { sides, type SideId } from '../data/farmSurvey';
export function CrossSection({ config: c }: { config: FenceConfig }) {
  const patternId = useId().replaceAll(':', ''),
    scale = 27,
    ground = 290,
    x = 120,
    exposed = c.poleLength - c.embed;
  return (
    <svg
      className="cross-section"
      viewBox="0 0 420 405"
      role="img"
      aria-label="Fence section showing exposed and buried pole dimensions"
    >
      <defs>
        <pattern
          id={patternId}
          width={(c.eye * scale) / 12}
          height={(c.eye * scale) / 12}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M0 0L${(c.eye * scale) / 12} ${(c.eye * scale) / 12}M0 ${(c.eye * scale) / 12}L${(c.eye * scale) / 12} 0`}
            fill="none"
            stroke="#3c98b8"
            strokeWidth={c.diameter / 6}
          />
        </pattern>
      </defs>
      <rect x="15" y={ground} width="390" height="105" fill="#dcc8ac" />
      <text x="285" y={ground + 18} fontSize="12">
        GROUND LEVEL
      </text>
      {c.footingMode !== 'none' && (
        <rect
          x={x - (c.footingWidth * scale) / 2}
          y={ground}
          width={c.footingWidth * scale}
          height={c.footingDepth * scale}
          fill="#9c9d91"
          opacity=".7"
        />
      )}
      <rect
        x={x - 5}
        y={ground - exposed * scale}
        width="10"
        height={c.poleLength * scale}
        fill="#a5aba2"
        stroke="#666f62"
      />
      {hasMesh(c) && (
        <rect
          x={x + 5}
          y={ground - c.height * scale}
          width="145"
          height={c.height * scale}
          fill={`url(#${patternId})`}
          stroke="#4194b4"
        />
      )}
      {wireHeights(c).map((h, i) => (
        <g key={i}>
          <line
            x1={x + 5}
            y1={ground - h * scale}
            x2="270"
            y2={ground - h * scale}
            stroke="#9a6033"
            strokeWidth="1.5"
          />
          {[150, 195, 240].map((b) => (
            <path
              key={b}
              d={`M${b - 3} ${ground - h * scale - 3}l6 6m-6 0l6 -6`}
              stroke="#9a6033"
              fill="none"
            />
          ))}
        </g>
      ))}
      <path
        d={`M70 ${ground - exposed * scale}H80M75 ${ground - exposed * scale}V${ground}M70 ${ground}H80M75 ${ground}V${ground + c.embed * scale}M70 ${ground + c.embed * scale}H80`}
        fill="none"
        stroke="#435b46"
      />
      <text
        transform={`translate(60,${ground - (exposed * scale) / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize="13"
      >
        {exposed.toFixed(1)} ft exposed
      </text>
      <text x="85" y={ground + (c.embed * scale) / 2} fontSize="12">
        {c.embed} ft
      </text>
      <text x="175" y="370" fontSize="12">
        Embed depth · {c.embed} ft
      </text>
      <text x="280" y={ground - (c.height * scale) / 2} fontSize="12">
        {c.height} ft fence
      </text>
      <text x="15" y="23" fontSize="14" fontWeight="700">
        {c.poleLength}-ft {c.poleType} pole
      </text>
    </svg>
  );
}
export function Elevation({
  scenario,
  result,
  side,
  zoom = 1,
}: {
  scenario: Scenario;
  result: ReturnType<typeof calculate>;
  side: SideId;
  zoom?: number;
}) {
  const length = lengthFor(scenario, side),
    scale = 4 * zoom,
    width = Math.max(700, length * scale + 100),
    y = 260;
  return (
    <div className="elevation-scroll">
      <svg
        id={`elevation-${side}`}
        width={width}
        height="365"
        viewBox={`0 0 ${width} 365`}
        role="img"
        aria-label={`${sides[side].name} elevation with chainage`}
      >
        <defs>
          {scenario.sections[side].map((sec) => (
            <pattern
              key={sec.id}
              id={`elev-${side}-${sec.id}`}
              width={sec.config.eye * 0.6}
              height={sec.config.eye * 0.6}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M0 0L${sec.config.eye * 0.6} ${sec.config.eye * 0.6}M0 ${sec.config.eye * 0.6}L${sec.config.eye * 0.6} 0`}
                stroke="#6aabbe"
                strokeWidth=".35"
              />
            </pattern>
          ))}
        </defs>
        <rect width={width} height="365" fill="#fafbf6" />
        <rect y={y} width={width} height="80" fill="#e5d3b8" />
        {result.runs
          .filter((run) => run.side === side)
          .map((run, i) => {
            const c = run.section.config,
              x = 50 + run.start * length * scale,
              w = run.length * scale;
            return (
              <g key={i}>
                {hasMesh(c) && (
                  <rect
                    x={x}
                    y={y - c.height * 25}
                    width={w}
                    height={c.height * 25}
                    fill={`url(#elev-${side}-${run.section.id})`}
                    stroke="#3884a1"
                  />
                )}
                {wireHeights(c).map((h, k) => (
                  <line
                    key={k}
                    x1={x}
                    x2={x + w}
                    y1={y - h * 25}
                    y2={y - h * 25}
                    stroke="#b77d4a"
                  />
                ))}
              </g>
            );
          })}
        {result.posts
          .filter((p) => p.side === side)
          .map((p) => (
            <g key={p.id}>
              <rect
                x={50 + p.chainage * scale - 2}
                y={y - (p.config.poleLength - p.config.embed) * 25}
                width="4"
                height={p.config.poleLength * 25}
                fill={p.reuse ? '#719076' : p.condition === 'unknown' ? '#c2a565' : '#899387'}
              />
              {p.stays > 0 && (
                <line
                  x1={50 + p.chainage * scale}
                  y1={y - 95}
                  x2={50 + p.chainage * scale + 35}
                  y2={y}
                  stroke="#929a8d"
                  strokeWidth="4"
                />
              )}
            </g>
          ))}
        {scenario.gates
          .filter((g) => g.side === side)
          .map((g) => (
            <rect
              key={g.id}
              x={50 + g.at * length * scale}
              y={y - 125}
              width={g.width * scale}
              height="125"
              fill="#e2d9eb"
              stroke="#9270a2"
            />
          ))}
        {Array.from({ length: Math.floor(length / 25) + 1 }, (_, i) => (
          <g key={i}>
            <path d={`M${50 + i * 25 * scale} ${y + 80}v7`} stroke="#5a6453" />
            <text x={50 + i * 25 * scale} y={y + 104} textAnchor="middle" fontSize="12">
              {i * 25} ft
            </text>
          </g>
        ))}
        <text x="25" y="30" fontSize="16" fontWeight="700">
          {sides[side].name} · {length.toLocaleString('en-IN')} ft · {scenario.basis} chainage
        </text>
      </svg>
    </div>
  );
}
