import { useState } from 'react';
import { useFarm, updateScenario } from '../store/farmStore';
import { emptyInspection, type Inspection as InspectionRecord } from '../data/scenarios';
import { calculate, lengthFor } from '../geometry/materialCalculator';
import { Numeric, Choice } from './Configurator';
import { csvRows, download } from '../utils/exports';
import { atPath, latLng } from '../geometry/coordinateTransform';
export function Inspection({
  result,
  selected,
  onSelect,
  notify,
}: {
  result: ReturnType<typeof calculate>;
  selected: string;
  onSelect: (id: string) => void;
  notify: (s: string) => void;
}) {
  const { scenario } = useFarm(),
    [filter, setFilter] = useState('W');
  const posts = result.posts.filter((p) => filter === 'all' || p.side === filter),
    post = result.posts.find((p) => p.id === selected),
    record = post ? scenario.inspections[post.id] || emptyInspection : null;
  const set = (key: keyof InspectionRecord, value: unknown) => {
    if (!post) return;
    updateScenario((s) => {
      s.inspections[post.id] = { ...(s.inspections[post.id] || emptyInspection), [key]: value };
    });
  };
  async function importCsv(file: File) {
    try {
      const rows = csvRows(await file.text()),
        headers = rows.shift()!.map((x) =>
          x
            .replace(/^\ufeff/, '')
            .trim()
            .toLowerCase(),
        );
      const actual: { id: string; chainage: number; lat?: number; lng?: number }[] = [],
        inspections: {
          id: string;
          condition: InspectionRecord['condition'];
          exposed: number;
          notes: string;
        }[] = [];
      let chainage = 0;
      for (const row of rows) {
        const data = Object.fromEntries(headers.map((h, i) => [h, row[i]?.trim() || '']));
        let f = 0;
        if (data.chainage_ft !== 'undefined' && data.chainage_ft) {
          chainage = Number(data.chainage_ft);
        } else if (data.latitude && data.longitude) {
          const lat = Number(data.latitude),
            lng = Number(data.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng))
            throw Error('Invalid geographic coordinate.');
          let best = Infinity;
          for (let i = 0; i <= 10000; i++) {
            const ll = latLng(atPath('W', i / 10000)),
              d = Math.hypot((ll[0] - lat) * 111000, (ll[1] - lng) * 106000);
            if (d < best) {
              best = d;
              f = i / 10000;
            }
          }
          if (best > 20)
            throw Error(
              'A measured post is more than 20 m from the road boundary. Review the coordinates.',
            );
          chainage = f * lengthFor(scenario, 'W');
        } else if (data.spacing_ft) chainage += Number(data.spacing_ft);
        else throw Error('CSV needs chainage_ft, spacing_ft, or latitude and longitude.');
        if (!Number.isFinite(chainage) || chainage < 0 || chainage > lengthFor(scenario, 'W'))
          throw Error('Post chainage lies outside the road side.');
        const id = data.post_id || `W-M${actual.length + 1}`;
        if (actual.some((p) => p.id === id || Math.abs(p.chainage - chainage) < 0.01))
          throw Error('Duplicate post ID or position.');
        actual.push({
          id,
          chainage,
          ...(data.latitude ? { lat: Number(data.latitude), lng: Number(data.longitude) } : {}),
        });
        const condition = ['good', 'cracked', 'leaning', 'new', 'unknown'].includes(data.condition)
          ? (data.condition as InspectionRecord['condition'])
          : data.reuse === 'true'
            ? 'good'
            : 'unknown';
        inspections.push({
          id,
          condition,
          exposed: Number(data.exposed_height_ft) || 0,
          notes: data.notes || '',
        });
      }
      if (actual.length > 1000) throw Error('Maximum 1,000 measured posts.');
      updateScenario((s) => {
        s.actualPosts = actual;
        for (const rec of inspections)
          s.inspections[rec.id] = {
            ...emptyInspection,
            condition: rec.condition,
            exposed: rec.exposed,
            notes: rec.notes,
          };
      });
      notify(
        `Imported ${actual.length} measured road posts. Infill posts will be added where gaps exceed spacing.`,
      );
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <section className="panel report-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">EXISTING ASSETS</span>
          <h2>Post inspection register</h2>
        </div>
        <button
          onClick={() =>
            download(
              JSON.stringify(
                { inspections: scenario.inspections, actualPosts: scenario.actualPosts },
                null,
                2,
              ),
              'ram-inspections.json',
            )
          }
        >
          Export inspections JSON
        </button>
      </div>
      <p className="help">
        Generated posts are proposed positions, not a survey of existing poles. IDs use side and a
        stable millionth-of-side position. Import measured chainage to anchor actual roadside posts;
        CSV latitude/longitude is projected onto the roadside alignment for chainage.
      </p>
      <div className="field-grid">
        <Choice
          label="Post side"
          value={filter}
          onChange={setFilter}
          options={['W', 'N', 'E', 'S', 'all']}
        />
        <label className="field">
          Import measured road posts CSV
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importCsv(f);
              e.target.value = '';
            }}
          />
        </label>
        <button
          onClick={() =>
            download(
              'post_id,chainage_ft,exposed_height_ft,condition,reuse,notes\nW-M001,0,5.5,unknown,false,Measure on site\n',
              'road-post-template.csv',
              'text/csv',
            )
          }
        >
          CSV template
        </button>
        <label className="field">
          Import inspection JSON
          <input
            type="file"
            accept=".json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const data = JSON.parse(await f.text());
                updateScenario((s) => {
                  s.inspections = data.inspections;
                  s.actualPosts = data.actualPosts || [];
                });
                notify('Inspection records imported.');
              } catch (err) {
                notify('Invalid inspection file: ' + (err as Error).message);
              }
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <div className="inspection-layout">
        <div className="table-scroll post-list">
          <table>
            <thead>
              <tr>
                <th>Post ID</th>
                <th>Chainage</th>
                <th>Condition</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className={p.id === selected ? 'selected-row' : ''}>
                  <td>
                    <button onClick={() => onSelect(p.id)}>{p.id}</button>
                  </td>
                  <td>{p.chainage.toFixed(1)} ft</td>
                  <td>
                    {scenario.inspections[p.id]?.condition || p.condition}
                    {p.actual ? ' · measured' : ''}
                  </td>
                  <td>
                    {p.gate ? 'Gate' : p.corner ? 'Corner' : p.strainer ? 'Strainer' : 'Line'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {post && record ? (
          <div className="inspection-form">
            <h3>{post.id}</h3>
            <p className="help">
              {post.chainage.toFixed(1)} ft · {post.config.poleLength}-ft pole · {post.config.embed}
              -ft embed · {post.reuse ? 'reused' : 'new / unconfirmed'}
            </p>
            <Choice
              label="Inspection condition"
              value={record.condition}
              onChange={(v) => set('condition', v)}
              options={['unknown', 'good', 'cracked', 'leaning', 'new']}
            />
            <Choice
              label="Manual role"
              value={record.role}
              onChange={(v) => set('role', v)}
              options={['auto', 'corner', 'strainer', 'support', 'new']}
            />
            <Numeric
              label="Measured exposed height (ft; 0 = unknown)"
              value={record.exposed}
              max={16}
              step={0.1}
              onChange={(v) => set('exposed', v)}
            />
            <label className="field">
              Cross section
              <input
                value={record.crossSection}
                onChange={(e) => set('crossSection', e.target.value)}
              />
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={record.loose}
                onChange={(e) => set('loose', e.target.checked)}
              />{' '}
              Loose footing
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={record.footing}
                onChange={(e) => set('footing', e.target.checked)}
              />{' '}
              Concrete when manual footing mode is used
            </label>
            <label className="field">
              Inspection notes
              <textarea
                value={record.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={4}
              />
            </label>
            <label className="field">
              Post photo (device only; max 250 KB)
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 250000) {
                    notify('Use a photo under 250 KB to fit browser storage.');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => set('photo', reader.result);
                  reader.readAsDataURL(f);
                }}
              />
            </label>
            {record.photo && (
              <img
                className="inspection-photo"
                src={record.photo}
                alt={`Inspection of ${post.id}`}
              />
            )}
            <p className="help">
              Marking good enables reuse when the side strategy permits it. Condition and measured
              exposed height remain separate from the proposed specification.
            </p>
          </div>
        ) : (
          <p className="help">Select a post from the map, 3D scene or register to inspect it.</p>
        )}
      </div>
    </section>
  );
}
