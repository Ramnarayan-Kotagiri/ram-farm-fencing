# Ram’s farm fencing planner

A static React + TypeScript + Vite planning tool for the merged 22.04-acre Vadlapalli oil-palm farm. It combines a survey plan, geographic map, synthetic Three.js boundary walk, fence configurator, post register, editable BOQ, scenario comparison, and printable contractor pack.

## Run locally

Use Node 22 or newer. The checked-in lockfile uses pnpm 11.19.0.

```sh
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm preview
```

The requested npm equivalents also work: `npm install`, `npm run dev`, `npm test`, `npm run build`. Prefer pnpm for reproducing the checked-in dependency versions; do not mix lockfiles in a deployment change. `dist/` is the production static site. It needs an HTTP server, rather than opening its index file using `file://`.

## Publish on GitHub Pages

1. Create a dedicated repository, for example `ram-farm-fencing`, under the intended GitHub account. Choose visibility deliberately: the supplied source documents contain the exact farm location and the quotation image contains contact details.
2. Add this project’s source files, `public/`, lockfile and `.github/workflows/deploy.yml`. Exclude `node_modules/`, `.pnpm-store/`, `tmp/` and `dist/` (already in `.gitignore`). Do not replace an existing unrelated website repository.
3. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
4. Push to `main` or `master`, or run **Test and publish farm planner** from the Actions page.
5. The workflow tests calculations, builds the static bundle, uploads `dist/`, and deploys it. Its deployment output gives the final Pages URL. Pull requests run tests/build only.

Vite’s relative base `./` supports both account-root and repository-subpath Pages URLs. There are no server routes. Built-in fragments are `#hybrid` and `#all`; custom shared plans use `#plan=...`.

The workflow follows [GitHub’s custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), checked on 6 September 2026. An actual remote deployment still requires the target repository and Pages configuration; a successful local build is not a verified live deployment.

## Source authority

The supplied LP 470 and LP 547 PDFs are authoritative for coordinates and printed distances. The merged outer path is **A–B–C–D–E–F–G–A**. The internal A–D boundary is never a rendered fence or BOQ run. The printed areas sum to 22.04 acres. Coordinates are WGS84 / UTM zone 44N; local Three.js X is easting minus 522893, and Z is 1875409.3 minus northing. North is negative Z.

Printed lengths and rounded coordinate-derived lengths are retained independently. Startup validation exposes any edge discrepancy over 0.2 m. The geographic map uses the exact supplied latitude/longitude for polygon vertices; intermediate post display coordinates use a local affine interpolation from supplied control points. No geometry is warped to match purchasing quantities.

| Side        | Printed LP length | Contractor quantity | Default work                                |
| ----------- | ----------------: | ------------------: | ------------------------------------------- |
| Road / West |         801.48 ft |              800 ft | 5.5-ft chain link + 2 recovered top strands |
| North       |       1,621.39 ft |            Excluded | Existing neighbour fence, zero new work     |
| Back / East |         420.34 ft |              450 ft | 5.5-ft chain link, no top barbed wire       |
| South       |       1,599.31 ft |            1,750 ft | 5 barbed-wire strands                       |

The old HTML and prior conversation are historical references. Later explicit corrections and the supplied master brief determine the current default design. The vendor quotation is preserved as immutable line items totaling **₹463,410**. Its 6-ft supports are physical pole lengths, not a spacing statement. The ~8-ft main-post spacing is inferred from 2,900 / 363. The road mesh height handwriting may read 5½ ft; the immutable dataset follows the supplied brief’s 5-ft historical transcription. East eye size is 3 inches per explicit clarification.

## Where to change data

| File                                  | Responsibility                                                      |
| ------------------------------------- | ------------------------------------------------------------------- |
| `src/data/farmSurvey.ts`              | Official vertices, logical side paths, printed lengths              |
| `src/data/contractorPlanning.ts`      | Purchasing lengths independent of geometry                          |
| `src/data/vendorQuote.ts`             | Immutable historical quotation                                      |
| `src/data/scenarios.ts`               | Validated configuration schema and presets                          |
| `src/data/pricing.ts`                 | Editable starting rate assumptions                                  |
| `src/geometry/coordinateTransform.ts` | Local coordinate model, path interpolation and validation           |
| `src/geometry/materialCalculator.ts`  | Gate subtraction, unique post placement, quantities and costing     |
| `src/store/farmStore.ts`              | One application state, local persistence and share import           |
| `src/components/Farm3D.tsx`           | Instanced posts/palms, procedural mesh, walk and inspection cameras |

Source PDFs and photographs are under `public/source-documents` and `public/images`. The satellite screenshot is a source reference only; it is not georeferenced. Reference photographs have no confirmed chainage. The source panel labels official, confirmed, assumed, unknown and inferred facts separately.

## Quantity model

- Each logical side is split into normalized chainage sections. Changing survey/contractor basis retains the section’s geometric fraction. Gates use a normalized start with a fixed width in feet and are validated against overlap and side limits.
- Gates remove mesh and barbed-wire material. Their edges are mandatory posts, and their gate price is an additional line item.
- Bends, section/run ends, gate edges, measured-post anchors and maximum strainer intervals establish mandatory stations. Between anchors: `intervals = ceil(working_length / max_spacing)`. Interpolated post positions follow the actual UTM polyline. Physical spacing can therefore differ from contractor spacing; it never distorts the boundary.
- Coincident positions (rounded to 1 mm) share one main post. A new-work side owns a shared boundary post rather than the excluded neighbour side. The first eligible side owns the cost; supports are merged using the larger assembly count, not added twice.
- Supports are additional diagonal poles. Placement modes include none, every N posts, every X feet, corners, strainers and manual. The default ratio 3.42 is only a historical starting assumption.
- Mesh: net run length × (1 + wastage); rolls round up per continuous run; weight = roll count × entered roll weight. Price can be per kg, roll or purchased square foot. Separate runs/sections can increase rounding; offcut reuse across different runs is not optimized.
- Mesh weight starts from the old road quote, scaled to 5.5 ft. Height, diameter and eye changes scale the estimate proportionally (`height × diameter² / eye`). This is an estimate, not a certified product weight. Enter actual supplier roll weights.
- Barbed wire: net length × strands, then wastage and coil rounding. The assumed 330-ft / 25-kg coil is editable and unverified. Recovered wire is tracked separately and is not automatically priced as new wire if there is a shortfall.
- Concrete is gross footing volume, excluding reused-post footings. Width/diameter and depth are converted from feet to metres. Mix conversion factors are editable approximations; their ingredient quantities are not charged again over the concrete rate.
- Included GST is extracted from the entered subtotal. Excluded GST is added. The default tax is zero because the old quotation’s tax treatment is unspecified. The implementation uses one job-wide tax treatment; mixed tax categories require separate vendor verification.

## Updating vendor rates

Open **Materials & costs → Vendor rates, labour & tax**. Choose Historical, Current Custom, or Vendor Quote A/B/C, edit inputs and save the profile. Main/support pole, strainer upgrade, labour basis, transport, loading, concrete and tax are editable. The main-pole rate applies to all configured lengths/materials, so update it or obtain separate vendor allowances when a design changes pole specification.

Mesh/barbed unit prices and roll/coil specifications live in **each side’s configurator → Rolls, coils & material pricing**. Comparator mesh/wire rates reprice immutable original quantities; use **Apply these wire rates to active design** to align the active design’s wire pricing. The price-only delta reprices original quantities. The remaining delta includes design/quantity changes, additional scope and any unmatched section rates; it is labeled accordingly.

Historical rates are not represented as current market prices. No live market-price service is used.

## Existing road posts and wire

Default pole strategy is **Inspect / unknown**, conservatively charging unconfirmed poles as new. Reuse inspected-good posts, replace all, or explore a custom reuse percentage. A cracked/leaning inspection does not become reusable through a percentage assumption. Confirm recovered wire length separately from required top-wire length.

Generated IDs use side plus millionths of normalized chainage (for example `W-125000` at 12.5% of the side). Changing spacing can replace generated posts; their old records are retained but do not silently move to another post. Measured IDs are preserved.

In **Post inspections**, import CSV with either:

```csv
post_id,chainage_ft,exposed_height_ft,condition,reuse,notes
W-M001,0,5.5,unknown,false,Inspect before reuse
W-M002,8.2,5.4,good,true,Measured on site
```

or `latitude,longitude,exposed_height_ft,condition,reuse,notes`, optionally with `post_id`. A `spacing_ft` column can accumulate chainage when absolute chainage is absent. Geographic positions are projected onto the road alignment to find chainage; rows over 20 m from the alignment are rejected. Chainage currently uses the selected BOQ basis, so select the desired basis before import and keep it consistent while using the measurements. Exact off-boundary surveyed XYZ placement is not implemented; imported geographic values are retained as source metadata. The algorithm retains measured anchors and adds infill posts where gaps exceed maximum spacing. It does not discard required corner/strainer/gate posts.

Conditions: `unknown`, `good`, `cracked`, `leaning`, `new`. Inspect exposed height, cross-section, looseness, notes and manual structural role. Photos up to 250 KB remain in device storage and JSON exports; share links omit photos. Measured exposed heights are inspection evidence, separate from proposed pole dimensions. Import/export inspection JSON separately from full scenarios.

## Interaction and rendering

- Survey plan: side selection, optional post markers, rotation, zoom and two-point measurement. The displayed area is derived from the UTM polygon. North arrow remains screen north; use North up to reset rotation.
- Geo map: exact polygon vertices over an optional OpenStreetMap basemap, attribution and scale control. All core features work with tiles disabled. To add a satellite provider, add an explicitly licensed layer in `GeoMap.tsx` and retain attribution and key restrictions; do not use the supplied screenshot as a map tile or georeferenced image.
- 3D: Three.js, instanced posts and staggered oil palms. Diamond mesh uses a procedural shader with metric eye size and thickness. Wire line segments include close-range barbs; low detail omits barbs and reduces tree detail/shadows. Pole embedment is below ground and visible in the engineering cross-section. Stays are diagonal geometry. Planting, road width and flat terrain are illustrative.
- Walk: W/S or up/down moves along the selected boundary; A/D or left/right turns; drag looks around. Touch uses drag plus forward/back controls. Inspect faces the fence from a configurable inside offset. Post buttons move between planned posts. Tour moves around all four sides, with pause, speed, skip and restart controls. It is a synthetic boundary tour, not real Street View or a photogrammetric reconstruction.
- Engineering: dynamic cross-section and scrollable/zoomable full-side elevation; export PNG. The print pack compresses full-side horizontal scale and accompanies it with a large cross-section and specifications.
- Scenarios: Preferred Hybrid, All Chain Link, Custom; duplicate, rename, save, delete saved copies and reset. Original Vendor Quote remains a read-only comparison source, not a fabricated exact historical spatial reconstruction. Comparison has instantaneous A/B map and 3D switching.
- Vendor View hides configurator controls and adds a readable work schedule and BOQ. English is provided; Telugu translation is not implemented.

## Persistence and export

State is saved under `ram-farm-v1` in localStorage. Rate profiles are also device-local. Export the full JSON to back up data; imports validate numeric bounds and section topology before replacing the current plan. Shared URLs include the active scenario and active global rates, but omit photos and saved profiles. Large inspection datasets should use JSON rather than oversized URLs. No backend, account, or automatic message sending is involved.

CSV BOQ, configuration JSON, inspection JSON, top-plan PNG, 3D PNG and side elevation PNG are available. The print button opens the browser’s print / Save as PDF workflow with plan, three side detail sections, BOQ, original comparison and assumptions. Long BOQs or many split sections can flow to additional pages.

Optional WebMCP tools expose read-only plan totals and validated side configuration in compatible browsers. These operate on the same state as the UI. They do not publish or send information.

## Tests and remaining assumptions

`tests/calculations.test.ts` covers distances, merged geometry, length basis, post spacing/counts, deduplication, gates, rolls/coils, strands, wastage, reuse, exact original totals, GST, presets and import validation. Manual browser checks cover desktop/phone, road/south 3D, scenario controls, vendor view and BOQ.

The default road design deliberately exposes a clearance conflict: 8 ft minus 2.5 ft embed leaves 5.5 ft exposed, insufficient for 5.5-ft mesh plus top strands. The tool warns instead of silently choosing a longer pole. Support engineering, actual pole condition/locations, gate locations, terrain elevation, footing specifications, current unit prices and product weights require confirmation.

Known bounds: the current synthetic palm model is illustrative; terrain is flat; animation is a boundary navigator rather than a narrated cinematic tour; the optional scale figure is a human, not a full animal-silhouette library. No automatic terrain acquisition, photogrammetry, georeferencing or vendor messaging is performed.
