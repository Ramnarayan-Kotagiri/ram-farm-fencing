import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { vertices, sideIds, sides, type SideId } from '../data/farmSurvey';
import { latLng, path, atPath } from '../geometry/coordinateTransform';
import type { Scenario } from '../data/scenarios';
import { calculate, lengthFor } from '../geometry/materialCalculator';
export function GeoMap({
  scenario,
  result,
  onSide,
  onPost,
}: {
  scenario: Scenario;
  result: ReturnType<typeof calculate>;
  onSide: (s: SideId) => void;
  onPost: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    [tiles, setTiles] = useState(false),
    [posts, setPosts] = useState(false);
  useEffect(() => {
    if (!root.current) return;
    const m = L.map(root.current, { zoomControl: true }).setView([16.9625, 81.2174], 17);
    map.current = m;
    m.fitBounds(
      vertices.map((v) => [v.lat, v.lng] as L.LatLngTuple),
      { padding: [25, 25] },
    );
    L.control.scale({ imperial: true, metric: true }).addTo(m);
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const group = L.layerGroup().addTo(m);
    L.polygon(
      vertices.map((v) => [v.lat, v.lng]),
      { fillColor: '#a5b88a', fillOpacity: 0.5, color: '#71835c', weight: 1 },
    ).addTo(group);
    for (const side of sideIds) {
      L.polyline(path(side).map(latLng), {
        color:
          scenario.sections[side][0].config.type === 'existing'
            ? '#718f56'
            : scenario.sections[side][0].config.type === 'barbed'
              ? '#b57a43'
              : '#318cae',
        weight: 6,
      })
        .bindTooltip(`${sides[side].name} · ${sides[side].survey} ft survey`)
        .on('click', () => onSide(side))
        .addTo(group);
    }
    if (posts)
      for (const p of result.posts)
        L.circleMarker(latLng(p), {
          radius: p.strainer ? 4 : 2,
          color: p.reuse ? '#467c4f' : p.condition === 'unknown' ? '#c39531' : '#5e6856',
          weight: 1,
        })
          .bindTooltip(`${p.id} · ${p.chainage.toFixed(1)} ft`)
          .on('click', () => onPost(p.id))
          .addTo(group);
    for (const g of scenario.gates)
      L.polyline(
        [
          latLng(atPath(g.side, g.at)),
          latLng(atPath(g.side, g.at + g.width / lengthFor(scenario, g.side))),
        ],
        { color: '#926eaa', weight: 8 },
      ).addTo(group);
    return () => {
      group.remove();
    };
  }, [scenario, result, posts, onSide, onPost]);
  useEffect(() => {
    if (!tiles || !map.current) return;
    const layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    return () => {
      layer.remove();
    };
  }, [tiles]);
  return (
    <>
      <div className="button-row map-options">
        <label>
          <input type="checkbox" checked={tiles} onChange={(e) => setTiles(e.target.checked)} />{' '}
          OpenStreetMap base tiles
        </label>
        <label>
          <input type="checkbox" checked={posts} onChange={(e) => setPosts(e.target.checked)} />{' '}
          Planned posts
        </label>
        <button
          onClick={() =>
            map.current?.fitBounds(
              vertices.map((v) => [v.lat, v.lng] as L.LatLngTuple),
              { padding: [25, 25] },
            )
          }
        >
          Fit farm
        </button>
      </div>
      <div ref={root} className="geo-map" />
      <p className="help map-options">
        N ↑ · No satellite key required. Coordinates remain visible if tiles are unavailable.
        OpenStreetMap tiles load from the provider when enabled.
      </p>
    </>
  );
}
