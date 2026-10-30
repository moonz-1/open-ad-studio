# Final hardening handoff

Current integration/publication authority and capability assessment: [STATUS.md](STATUS.md). Older pending-integration / approval statements below describe their original checkpoints.

This follow-up supersedes the old Git-only installation restriction, unresolved Field Study copyright warning and unsafe credential-utility finding in the earlier staging audit.

## Scope and exact source

Work is confined to `release/submission-staging-20261029` in `open-ad-studio-release-staging`, plus its ignored audit checkouts. No live RC, Cursor checkout, original collaborative repository, credentials or paid resources were modified. Public main remains a separate publication target; no push was made.

The production downstream audit began from committed Cloud RC **`aaab8d2b114c1e556b0b828e4ed398408e1d7f47`**. A separate audit branch added only the three fixes below; its verified production/browser checkpoint is **`a782c4e2473876afec8e9479e3fdd1c059e782c8`**. It is private audit ancestry, not a branch to push publicly. Do not merge that private lineage into the flattened public repository.

Cursor later committed **`4255680e3fb8a4f14f37e4d57ae25656e9676fb7`**, with further uncommitted work still present at inspection. That later revision was inventoried for packaging, not integrated or accepted by the downstream browser run. Await the explicit final clean handoff.

## Downstream acceptance

All browser evidence below uses an original authored bottle drawing, explicit **Basic draft** provenance and real Product-safe CPU rendering. It is not Qwen or FLUX inference, a customer photograph or a marketing-quality ad assessment.

| Stage | Result and evidence boundary |
| --- | --- |
| Direction | PASS in production Chrome: choose a different concept, confirm direction, retain the correct source/product and Basic label. |
| Editions | PASS: approved source/direction, one edition and explicit engine selection persist. Unconfigured AI/Cloud engines show unavailable. |
| Composition & Dynamics | PASS CPU/API contracts for `creative-brief-v2`, source binding, copy isolation, boxes and product regions. Live model interpretation remains unverified. |
| Generate | PASS Product-safe: real composed output. Injected local renderer 503 produces a failed card; no automatic retry. After reload, an explicit retry succeeds. |
| Cloud request preparation | PASS CPU contracts on the committed RC, including default-off gates, native graph construction and reference binding. No Cloud upload or paid job was submitted. |
| Identity/framing/lettering | PASS CPU contracts and export blocking. An authored high-frequency open-field pattern is rejected while its clear control passes. This is an edge heuristic, not OCR or real AI-image acceptance. |
| Reveal / Compare | PASS: original and composed advertisement are available for comparison; failed and successful cards are retained. |
| Graphic Art Director / Edit | PASS in browser: direction and placement controls, approved copy, supporting-copy and CTA visibility variants persist. Exported files were visually inspected. |
| PNG export | PASS: actual 1080x1350 PNG downloads; downloaded hashes match saved export hashes. No scene prompts, test labels or QC messages appear in rendered text. |
| Reload | PASS with real browser IndexedDB Blobs: source, chosen direction, failed/ready cards and three saved exports survive page reload. |

Evidence lives under ignored `outputs/hardening/`: `downstream-browser.json`, `exported-ad.png` (short supporting-copy variant), `cta-ad.png`, `preview.svg`, screenshots and logs. The final download matches saved SHA-256; the source hash remains bound to the reviewed product. Fixture artifacts remain private and are not bundled in the release.

## Blocking defects fixed

1. **CPU recovery lock:** Product-safe renderer failures were recorded as interrupted model jobs and prevented any subsequent Generate. Project migration now makes only explicit Product-safe interruptions with no delivered take retryable failures. AI/Cloud/unknown engines and delivered work keep the conservative guard. No automatic retry is introduced.
2. **Preview/export layout mismatch:** the editor previewed the saved `editorial-original` design, but the reviewed-plan export path substituted a `composite` recipe. Export now uses the saved design, retaining the legacy plan fallback. This is one export-region line in `ad-application.ts`; Cursor's active edits were inspected and occupied different regions. Its worktree was not changed.
3. **Unreadable editorial text:** source-photo luminance incorrectly selected dark ink for a dark painted editorial plate. The editorial renderer now bases lettering on its actual approved plate and maintains contrast. Composite/generative photograph placement is unchanged.

Each fix has targeted regression tests and was exercised in the production browser. The earlier fresh-clone consolidated-test output-directory fix is retained.

## Beginner installation acceptance

The existing `start.cmd` / `start.command` now use one dependency-free Node bootstrap. It checks Node 22.18+, invokes npm using that Node, installs locked packages on first launch, reuses them, builds production assets, chooses a free loopback port without stopping processes, remembers the installation's port, and hands the Journey URL to the default browser. Its window remains the server lifetime. Missing Node/npm, dirty Git sources, installation failures and old running versions have human-readable messages.

A real Git archive ZIP was extracted **without `.git`, dependencies or private environment files**. Windows `start.cmd` installed all 33 packages, built the archive, found 8343 occupied and safely selected 8344. The exported source revision was preserved in `release-source.json`. A second launch reused the same server. A separate fresh Git clone launched through the same script on audit port 8350. Node 22.14 rejection and missing-key recovery messages were checked. Shell syntax and macOS/Linux browser command construction pass; native macOS/Linux execution is unverified.

Automatic native browser opening was invoked, but desktop UI approval timed out during observation. It is not certified as visually observed. The exact printed URL and Chrome HTTP/browser acceptance work; manual opening is the documented fallback. No fake screenshots were made.

## Credentials, production and licensing

The credential checker is replaced in this branch with a portable, **GET-only, read-only** utility. It reads only this application's environment, never writes/copies `.env`, never prints keys, and never submits a workflow. It distinguishes successful authentication from unverified weights, credit balance and entitlement. The unsafe incoming utility remains excluded from Cloud patches.

Production builds/typechecks pass. A fake server credential sentinel was absent from every compiled frontend asset. The isolated production runtime reports safe unavailable capabilities with no key. Production source scans found no hardcoded developer paths. Fonts, static assets and private-path 404 checks are part of final launch evidence. No model or runtime dependency was added.

Field Study follow-up recovered its original attribution: Content Pixie, [Unsplash photo cq1zGLQIFyA](https://unsplash.com/photos/cq1zGLQIFyA), combined with a prior source-preserving Klein environment. The [Unsplash License](https://unsplash.com/license) permits modified distribution; the inspected composite has a blank product label and no depicted person. **No copyright blocker requiring history rewriting was established.** Attribution is retained in third-party notices. The historical file remains under its own license, is absent from current assets and is not restored as a demo result. No history rewrite is needed or performed on this evidence.

MIT application/contributor attribution, OFL fonts, Comfy workflow-template MIT notices, Resvg MPL and separate model terms remain intact. The README screenshot is the actual empty interface, not a customer image or fabricated result.

## Test record

- Declared full application CPU suite: **61 passed, zero failed/skipped**.
- Final staging focused suite, including all new launcher/recovery/parity/contrast tests: **63 passed, zero failed/skipped**.
- Isolated committed Cloud contracts / graphic / identity / framing suite: **62 passed, zero failed/skipped** before the small isolated hardening fixes; targeted tests and production browser/build verify the fixes afterwards.
- Fresh clone: locked dependency install, typecheck, build, launcher and storage/recovery tests passed. Server-only sentinel leak check passed.

Do not add these overlapping counts and call them unique scenarios. Logs are retained under `outputs/hardening/`.

## Final integration procedure

1. Receive Cursor's final clean SHA and verified handoff. Do not merge its current uncommitted Discover/Qwen work.
2. On this public-base staging branch, run `node scripts/prepare-cloud-release.mjs <Cursor-checkout> <full-SHA>` and inspect the output manifest/diff. At `4255680`, it selects 54 committed application/test/workflow files and excludes 26 notes/development/historical-brief artifacts. The exact negative Qwen JSON fixture is reviewed and hash-pinned because a retained regression needs it.
3. The helper preserves incoming consolidated-test assertions plus the independently tested recursive evidence-directory creation. It checks stderr for conflict diagnostics as well as the exit code, and refuses unknown file scopes/changed fixture content. The prepared current patch has no unresolved check conflicts. It has **not** been applied.
4. Apply only after the final verified handoff, review staged paths and preserve the three independent fixes above, launcher files and safe credential checker. Keep the incoming unsafe utility out. Replace stale Cloud setup text with [Connect AI](../CONNECT_AI.md); do not publish private output-report links as setup instructions.
5. Run the declared CPU suite, release/consolidated/Cloud tests, all new hardening tests, typecheck/build, then production desktop/mobile PNG/export/reload acceptance on the exact clean commit. Native live Qwen/FLUX acceptance belongs to the agreed owner-authorized configuration, not this nonbillable audit.
6. Reconcile public main without force pushing; preserve the local rollback tag. Review the exact public-base-to-candidate diff for secrets, photos, weights and private refs. Only after owner authorization, push the approved public commit to main; never push all refs/tags or private audit branches. Fresh-clone the published revision and verify it again.

## Remaining limits and submission recommendation

- Final Cursor integration and its complete genuine Qwen/Cloud Journey acceptance remain outstanding here.
- Cloud requires an eligible paid subscription, API key, compatible weights and explicit user-approved credit spending. There is no hard per-ad credit ceiling. No paid inference was performed.
- GAD may omit body/CTA when they would collide with the protected product. Both visible short-copy variants were tested; simultaneous long copy may not fit, and the UI does not yet explain every omission at the checkbox. Review the actual PNG.
- Local models/ComfyUI, Node installation and optional FFmpeg remain separate prerequisites. Native desktop auto-opening and macOS/Linux execution have the verification limits stated above.
- Genuine LTX remains unverified; photograph-motion MP4 is CPU animation. Do not claim LTX-core bonus eligibility from it.

**Recommendation:** the independent fixes and installation package are ready for final integration. Public release / the intended Cloud demonstration stays conditional on Cursor's final accepted commit and owner authorization. Best Overall / Most Innovative are the strongest current presentation; FLUX/Open Weights claims must match the actual final run. The 110-second [demo/social handoff](../SUBMISSION.md) is ready. No submission or public push has been performed.
