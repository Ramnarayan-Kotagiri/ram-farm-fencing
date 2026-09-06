# Farm fencing SaaS — zero-cash pilot plan

Prepared 6 September 2026. This is a proposed product and rollout plan, not a claim that the local planner already has hosted accounts or secure admin access.

## Decision

Start as a fencing planning and quotation service for one region, with 50 farmer accounts and up to 10 invited vendors. Help a farmer turn a measured boundary into an understandable design and comparable quotes. Help a vendor produce an accurate, versioned quantity schedule quickly. Keep the farmer pilot free; test whether vendors will eventually pay for repeat quoting, branded reports and team workflows. Proposed prices below are experiments, not market-validated prices.

Keep the existing React/TypeScript calculation and 3D engine. Use Cloudflare Pages for the commercial frontend and Supabase Free for PostgreSQL, authentication and private object storage. GitHub holds the source. GitHub Pages may host the personal demonstration, but its usage rules exclude sites primarily providing commercial SaaS. Do not launch the customer service there. [GitHub rules](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

₹0 in recurring infrastructure cash is a feasible pilot target under the caps below, not an unconditional promise. Your development/support time, internet and existing devices still have a cost. Free services can change, pause, throttle or have outages. Do not promise paid-service uptime while spending zero.

## What each person sees

| Journey | Default screen | Open only when needed |
| --- | --- | --- |
| Farmer | My farms → boundary → recommended fence → estimate → compare invited quotes | Select a side for height/type; expand Customize for mesh, embedment, support spacing, gates, wastage and rates |
| Vendor | Invited jobs → scope and measured quantities → my quote → installation checklist | Material specifications, regional rate cards, exclusions, photos and revisions |
| Admin | Pilot usage, pending access requests and operational alerts | Customer/vendor access, feature rollout, caps, audit trail, maintenance, export/deletion and recovery |

Farmer and Vendor view switches in the current local app are presentation modes. They are not login or authorization. In the SaaS, a person may hold both roles in different organizations. The backend checks organization membership and per-farm access on every operation.

Vendor quotes have separate draft/submitted/accepted/superseded states. A vendor can read only invited job scope and its own quote. A farmer can compare submitted quotes for their farm, but cannot read a vendor's private costing or other customers' jobs. Accepting a quote freezes a scope revision and the quoted quantities; later edits require a change order. Model partial payments and installation milestones later, without processing money in the pilot.

## Make the geometry work for other farms

The current renderer/calculator is still tied to Ram's seven vertices, W/N/E/S side keys, UTM 44N origin, display bounds and source labels. Renaming the farm alone does not make it generic.

Refactor in this order:

1. Introduce a versioned `Farm` record with ID, owner organization, name, currency, units, GeoJSON boundary, source CRS, local metric projection, survey date, confidence and evidence references. Keep Ram's data as a sample fixture.
2. Represent boundary sections using stable edge IDs and start/end chainages. Compass directions and road names become optional labels. Support any simple polygon with doglegs; reject self-intersections, duplicates, zero-length edges, invalid coordinate ranges and unreasonable extents. Handle multiple parcels as separate polygons. Do not silently fence holes or internal parcel joins.
3. Import GeoJSON or ordered coordinate CSV; offer a manual boundary drawing flow. Show computed area/perimeter and ask the farmer to review them. Treat map clicks and phone GPS as approximate. Importing arbitrary survey PDFs automatically is a later assisted workflow requiring verification, not an OCR promise.
4. Select a suitable metric projection per location rather than hardcoding zone 44N. Compute camera bounds, planting bounds and map fit from the loaded polygon. Preserve separately the survey lengths and contractor quantities. A new farm starts with unconfirmed rates and reuse, not Ram's vendor quotation.
5. Pass `farm` explicitly through geometry, calculation, renderer, export and print components. Bind each scenario, post inspection and rate snapshot to `farm_id` and a geometry revision. Never reuse old post IDs after a boundary change without a reviewed remapping.
6. Add a farm selector and isolated drafts. Save to IndexedDB for offline use, then synchronize validated revisions with conflict detection. Never overwrite a newer vendor quote with an older device draft.

Acceptance fixtures: triangle, rectangle, irregular 12-edge farm, concave polygon, southern-hemisphere farm, survey/contractor mismatch, invalid crossing polygon, and two farms open on separate devices. Verify perimeter/area, gates, shared corners, supports and export identity for each. A boundary near a projection discontinuity must be rejected or handled explicitly.

## Free infrastructure and realistic limits

| Service | Pilot choice | Published allowance / practical constraint |
| --- | --- | --- |
| Hosting and HTTPS | Cloudflare Pages, provider subdomain | Static requests are free and unlimited; Free includes 500 builds/month. Functions have separate quotas. Keep the app static and calculations in the browser. |
| Authentication | Supabase Auth, Google sign-in | Free includes 50,000 monthly active users. Configure OAuth redirects and production consent settings. Invite-only pilot membership is enforced after sign-in. |
| Database | Supabase Postgres Free | 500 MB database. Index tenant/farm IDs; avoid storing generated meshes, base64 photos or every mouse movement. |
| Photo/document storage | Supabase private buckets | 1 GB storage; 5 GB egress and 5 GB cached egress. Treat private downloads conservatively against uncached egress. |
| Exports and communications | Browser-generated CSV/JSON/PNG/PDF; manually shared links | No server PDF rendering, paid AI inference, SMS OTP, automated WhatsApp messaging or payment gateway in the pilot. |
| Backup | Encrypted database and private-file exports to an existing local device | Free does not include automatic database backups. Run and verify a daily pilot backup; conduct a restore drill before onboarding. This uses your time and existing storage. |

Supabase can pause a Free project after a week of inactivity; there is no production uptime guarantee here. Built-in email delivery is restricted and unsuitable for general customer onboarding without custom SMTP. Use Google OAuth first and record email-only onboarding as a dependency rather than claiming email login is ready. Do not keep a project artificially active to bypass free-tier rules.

Sources checked for this plan: [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [static request routing](https://developers.cloudflare.com/pages/functions/routing/), [Supabase pricing](https://supabase.com/pricing), [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase email delivery](https://supabase.com/docs/guides/auth/auth-smtp).

### Pilot capacity budget — estimates, not measurements

Define one customer as a farmer account; vendors also consume usage. Start with 50 farmers, at most 10 vendors, 2 farms per farmer and 5 scenario revisions per farm. Cap each farm at 20 images of 250 KB plus 2 source documents of 1 MB. That is at most 7 MB per farm × 100 farms = 700 MB stored, leaving headroom inside 1 GB. Reject oversized documents with a clear message; offer local-only source references instead of silently discarding evidence. Strip photo location metadata unless explicitly needed.

At 500 scenarios × an estimated 50 KB JSON, scenario payloads use about 25 MB before indexes, memberships, quotes, audit records and database overhead. Measure actual database size weekly. If 60 people each download 50 compressed images monthly, image downloads are approximately 750 MB. Repeated document downloads can dominate this budget: 60 × 20 × 2 MB is another 2.4 GB. These assumptions must be replaced by measured use during the first ten customers.

Set internal thresholds below provider limits: warn at 60% of storage/egress, stop new invites at 75%, stop nonessential uploads at 85%. Continue reads and lightweight exports where quotas allow. Cap photo count and bytes transactionally on the server, with reservations for simultaneous uploads. Rate-limit login callbacks, quote submissions, imports and uploads. A frontend progress bar is not a quota enforcement mechanism. Provider failures can still interrupt service; no setting can guarantee permanent free availability.

## Security and admin controls

Use tenant-scoped tables: organizations, memberships, farms, farm_access, boundary_revisions, scenarios, quote_requests, quotes, inspections, attachments, feature_flags, quota_usage and audit_events. Quotes reference an immutable scenario revision. Store attachments in private buckets under tenant/farm IDs with storage policies that enforce membership; generate short-lived download links. Public demo assets and private customer records must be separate. Never put customer surveys in the public Git repository.

Enable deny-by-default row-level security on every exposed table. Tenant and farm membership checks must be performed by database policies or server functions, including reads, inserts, updates and deletes. Do not trust a tenant ID, role or feature flag supplied by the browser. Do not base admin permission on editable user metadata. Keep service-role credentials out of the frontend and GitHub source. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

Bootstrap your admin account using your verified authentication user ID through a privileged server/database step. Require MFA for admin operations. Grant admin through a protected membership table, with no self-promotion route. Provide a revocable support grant for reading customer data, with reason, expiry and audit record; avoid default unrestricted browsing of farm records.

Admin controls to build:

- Invite-only registration, a transactional 50-farmer cap, vendor approval, membership suspension and session revocation.
- Global and tenant-specific flags for 3D, boundary import, comparisons, photo uploads, vendor invitations and experimental calculators. Disabled server-side actions return a clear error even if someone calls the API directly.
- Storage/download/import quotas, read-only maintenance mode, upload kill switch and export availability.
- Versioned material catalogs and regional rate cards with source/date; changing a rate never rewrites an already-submitted quote.
- Audit log for access changes, flags, quote acceptance and deletes, with actor, timestamp, reason and before/after values. Logs are append-only for ordinary users.
- Data export, consent records, retention controls and reviewed deletion with recovery window. Delete expired signed links by revoking the underlying access, not just hiding them in the UI.
- Usage dashboard, failure alerts, backup status and restore procedure. Free provider logging is limited; retain essential application audit events within the database budget.

Flag precedence: emergency deny → organization suspension/quota → tenant override → global default. Flags control product availability; authorization independently controls who can access which record. Re-check permissions for administrative mutations and high-impact state transitions.

Release tests must prove that Farmer A cannot read Farmer B's farm using a guessed ID, Vendor A cannot see Vendor B's draft, an ordinary account cannot promote itself, expired grants stop working, hidden/disabled actions fail through direct API calls, uploads cannot bypass byte caps, and a backup can be restored. Do not invite real customers until these pass against the deployed backend.

## Rollout and business validation

**Stage 1 — local product refinement:** paired slanted supports, concise Farmer/Vendor views, expandable controls and clear evidence/assumption labels. Keep advanced quantity logic available. The current app delivers this stage; it still stores plans on the device.

**Stage 2 — reusable farm engine:** remove all Ram-specific dependencies, add reviewed boundary import, farm records, geometry fixtures and migration of the sample. This is the first requirement before promising support for other farms.

**Stage 3 — secure hosted pilot:** create the Cloudflare and Supabase projects in your accounts, configure Google OAuth, deploy migrations/RLS/storage policies, add account/farm workflows, vendor quotes and protected admin controls. Set invite caps, backups and alerts; complete the security and recovery checks.

**Stage 4 — 5 farmers / 2 vendors:** personally onboard farms in one area. Compare calculated quantities with site measurements and purchased materials. Track support time, boundary corrections, quote turnaround, vendor revisions and reasons deals fail.

**Stage 5 — 10, then 25, then 50 farmers:** expand only when data isolation, quota headroom and recovery hold. Target a first usable plan within 15 minutes after a valid boundary is available, a vendor draft within 10 minutes of reviewing scope, and traceable quantity differences. These are product targets to measure, not current performance claims.

Interview repeat vendors before adding a marketplace. Test a later ₹499–₹999/month vendor plan or per-accepted-job fee with a small group; keep pricing hypothetical until people agree to pay. A useful revenue trigger is vendors repeatedly returning to quote without your help. Avoid taking custody of project payments during the zero-cost pilot. Reinvest initial revenue into reliable backups, a domain and a paid database plan before promising commercial availability.

## What triggers spending or a pause

If the free-tier headroom disappears, close new invitations, pause optional photo uploads and offer local exports. Do not automatically upgrade a billing plan. Supabase Pro currently starts at US$25/month; a custom domain, production email/SMS, larger storage, paid maps, AI features and payment processing introduce other costs. Recheck pricing before purchase. The 51st farmer is a business decision, not a reason to create extra accounts to evade service limits.

Before deployment of the SaaS, account setup is needed for Cloudflare, Supabase and Google OAuth. The GitHub sign-in only authorizes repository work; it does not provision these services. No secure SaaS admin account has been created yet.
