import { validation, areaM2, geometryWarnings } from '../geometry/coordinateTransform';
import { vertices } from '../data/farmSurvey';
export function Sources() {
  return (
    <section className="panel report-panel">
      <span className="eyebrow">ACCURACY & SOURCES</span>
      <h2>What we know. What still needs measuring.</h2>
      <div className="source-grid">
        <article>
          <span className="badge">OFFICIAL</span>
          <h3>LP survey geometry</h3>
          <p>
            Coordinates and boundary distances were checked against both supplied LP maps, in WGS84
            / UTM zone 44N. Only the merged outer boundary is rendered.
          </p>
          <a href="source-documents/LP-470.pdf" target="_blank" rel="noreferrer">
            Open LP 470 · 11.03 acres ↗
          </a>
          <br />
          <a href="source-documents/LP-547.pdf" target="_blank" rel="noreferrer">
            Open LP 547 · 11.01 acres ↗
          </a>
        </article>
        <article>
          <span className="badge">USER / CONTRACTOR</span>
          <h3>Working quantities</h3>
          <p>
            Road 800 ft, Back 450 ft, South 1,750 ft. These are purchasing quantities, not
            coordinates. North has existing neighbour fencing and no new work by default.
          </p>
        </article>
        <article>
          <span className="badge">CONFIRMED DESIGN</span>
          <h3>Preferred hybrid</h3>
          <p>
            Road: 5.5-ft chain link, 3-inch eye, 10G with 2 reused top strands. East: same mesh, no
            top barbed wire. South: 5-strand barbed wire. Both legal plots appear as one farm.
          </p>
        </article>
        <article>
          <span className="badge amber">INSPECT / UNKNOWN</span>
          <h3>Existing assets & site conditions</h3>
          <p>
            Road pole condition, positions, spacing, exposed height and reusable wire length. Gate
            locations, footing arrangements, terrain elevation, road width and tree positions are
            not surveyed.
          </p>
        </article>
      </div>
      <p className="notice">
        Likely inferred original main-pole spacing: approximately 8 ft (2,900 ÷ 363 = 7.99). The “6
        feet” note describes support pole length. Confirm the inferred spacing with the vendor.
      </p>
      <details open>
        <summary>Geometry validation</summary>
        <p className="help">
          The printed LP distances and rounded UTM coordinates are retained independently.
          Differences under 0.2 m are treated as rounding differences. Polygon area calculated from
          rounded coordinates: {areaM2.toFixed(1)} m² / {(areaM2 / 4046.8564224).toFixed(3)} acres.
          LP record area: 22.04 acres.
        </p>
        {geometryWarnings.length > 0 && (
          <p className="warning">
            Some calculated edge distances differ from the printed LP by more than 0.2 m. Review the
            table.
          </p>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Outer edge</th>
                <th>LP length (m)</th>
                <th>From coordinates (m)</th>
                <th>Difference (m)</th>
              </tr>
            </thead>
            <tbody>
              {validation.map((v) => (
                <tr key={v.edge}>
                  <td>{v.edge}</td>
                  <td>{v.official.toFixed(2)}</td>
                  <td>{v.calculated.toFixed(3)}</td>
                  <td>{(v.calculated - v.official).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table>
            <thead>
              <tr>
                <th>Point</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>UTM Easting</th>
                <th>UTM Northing</th>
              </tr>
            </thead>
            <tbody>
              {vertices.map((v) => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>{v.lat}</td>
                  <td>{v.lng}</td>
                  <td>{v.e}</td>
                  <td>{v.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <h2>Source references</h2>
      <p className="help">
        These images are evidence, not measurement layers. The satellite screenshot has no supplied
        control points and is not georeferenced. Road photographs have no confirmed chainage.
      </p>
      <div className="photo-grid">
        <figure>
          <a href="images/vendor-quotation.jpg" target="_blank" rel="noreferrer">
            <img
              src="images/vendor-quotation.jpg"
              loading="lazy"
              alt="Original handwritten vendor quotation"
            />
          </a>
          <figcaption>
            Original vendor quotation · ₹4,63,410. Road height handwriting is ambiguous; historical
            data uses the supplied 5-ft transcription.
          </figcaption>
        </figure>
        <figure>
          <a href="images/satellite-reference.png" target="_blank" rel="noreferrer">
            <img
              src="images/satellite-reference.png"
              loading="lazy"
              alt="Supplied satellite screenshot with measuring line"
            />
          </a>
          <figcaption>Satellite reference · approximate visual context only.</figcaption>
        </figure>
        {[1, 2, 3].map((i) => (
          <figure key={i}>
            <a href={`images/road-${i}.png`} target="_blank" rel="noreferrer">
              <img
                src={`images/road-${i}.png`}
                loading="lazy"
                alt={`Existing roadside RCC and barbed-wire fence, reference ${i}`}
              />
            </a>
            <figcaption>Roadside fence · reference {i} · chainage unconfirmed.</figcaption>
          </figure>
        ))}
      </div>
      <details>
        <summary>Practical help</summary>
        <p>
          <b>Eye size:</b> the mesh diamond opening. Smaller openings use more wire.
        </p>
        <p>
          <b>Stay pole:</b> diagonal support resisting the pull on the upright.
        </p>
        <p>
          <b>Strainer:</b> strengthened end, corner or intermediate assembly that tensions a wire
          run.
        </p>
        <p>
          <b>Embed depth:</b> buried pole length. More burial leaves less pole above ground.
        </p>
        <p>
          <b>Spacing:</b> maximum permitted gap between planned posts. Bends and gates require
          additional anchors.
        </p>
      </details>
    </section>
  );
}
