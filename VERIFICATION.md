# Verification record

6 September 2026.

- Both official LP PDFs were extracted and visually inspected. The seven merged outer vertices match the supplied brief; all coordinate-derived edge lengths agree with printed LP lengths within 0.2 m.
- 29 automated tests pass: survey geometry, contractor/survey quantities, post spacing, shared endpoints, gate subtraction and rejection, strands, rolls/coils, wastage, reuse, exact original quotation, tax, presets, JSON/share round-trips and quoted CSV parsing.
- TypeScript and the production Vite build pass.
- Browser checks covered desktop overview, mobile overview, mobile Vendor View, live BOQ, scenario comparison, road/south 3D inspection, and the screen-readable print pack. Mobile page width matched viewport width without page-wide overflow.
- The production bundle was opened over HTTP and the 3D view loaded without console errors.
- WebMCP read/configure tools were exercised in a compatible browser. A valid strand change updated quantities; zero post spacing was rejected; defaults were restored.
- Native print/PDF output could not be captured from the Codex in-app browser. The screen-readable print preview was inspected. Use Print / Save PDF in Chrome or Edge for final paper/PDF pagination; long BOQs and custom sections can add pages.
- GitHub Pages has not been deployed or verified remotely: the target repository URL has not been supplied. The workflow and publishing instructions are included.

The tool is a planning model. Terrain and planting are illustrative; supplier weights/rates, supports, footings, gate locations and roadside asset conditions remain explicit assumptions. See README for model boundaries and source provenance.
