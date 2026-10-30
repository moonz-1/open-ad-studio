# Submission staging and final integration

Current follow-up: [release hardening, launcher acceptance and resolved image attribution](HARDENING.md) supersedes the historical rights/credential-utility and Git-only installation findings below.

This is an independent release-engineering branch. It does not replace the stable application or certify unfinished Cloud work.

## Checkpoints

| Item | Exact checkpoint |
| --- | --- |
| Public repo | https://github.com/moonz-1/open-ad-studio |
| Fresh-clone base | `3c92251815960ec8bdfc1fc2354cf8bff4ad36eb` |
| Local preserved tag | `rollback/published-20261029`, points to the public base |
| Staging branch | `release/submission-staging-20261029` |
| Staging checkout folder | `open-ad-studio-release-staging` |
| Stable RC, preserved | `release/final-rc-20261029` at `78b42e3fade76f1123f578e63883c6eea0e048c4` |
| Stable application | http://127.0.0.1:8341/adstudio/journey.html |
| Independent audit preview | http://127.0.0.1:8343/adstudio/journey.html; published baseline plus staging fix/docs, not final Cloud acceptance |
| Cursor implementation inspected | `748b1cace8a7355bfb35db0462543d2689cacb6e` |
| Later Cloud tip inspected | `0894f0e896533728ba00cc2352f3628010470af2`; adds private notes only |

Cursor's checkout still had an untracked one-off customer script at inspection. Nothing was copied from its working tree. Its committed Cloud implementation is inventoried, not merged. Do not substitute the current branch tip for an explicit final verified handoff.

## Independent fresh-clone evidence

An unauthenticated public Git clone and GitHub REST metadata confirmed `public`, default branch `main`, MIT. No model weights or Git LFS assets were downloaded. Locked `npm ci` and production build passed using Node 22.20. An initial PATH/npm mismatch used the machine's older Node; the install was repeated explicitly through Node 22.20 successfully. Setup must use a supported Node for npm as well as `node --version`.

Production startup on isolated loopback port 8343 matched `/api/release` to the cloned revision. Chrome at 1440x1000 and 390x844 showed the real landing page, no page errors, no failed requests, no horizontal overflow and a visible mobile Your work button. `.env`, `.git/config` and private output JSON requests returned 404. GPU endpoints were disabled/offline; no planning/generation success is inferred from this smoke test. FFmpeg is optional and correctly showed unavailable in the clean launch without an override.

`npm test` passed all eight declared suites. Release, FLUX, RunPod lifecycle and film suites passed. The fresh `test:consolidated` initially failed because its evidence directory was absent. Staging adds one `mkdir(...,{recursive:true})` before writing evidence. Rerun with explicit installed FFmpeg: **49 passed, zero failed/skipped**. Logs, screenshots, build identity, actual compiled Basic photographic brief and security inventory are under ignored `outputs/submission-audit/` and `outputs/consolidated-checks/`. Fixtures are authored CPU artifacts; they are not AI-generated product photographs.

Security audit: all 3 published commits, 1,392 text-file revisions; no credential candidate remains after triaging 18 matches as pinned ComfyUI Python package names. This is a bounded pattern audit, not proof that no possible secret can exist. Current tracked photo/video/model/private-key file inventory is empty. Eighteen API-format workflow graphs yielded 63 node types; no partner inference node was found. Installed npm license inventory includes MIT, Apache-2.0, MPL-2.0, BSD-2-Clause, BSD-3-Clause and ISC. `npm audit` reported zero advisories at the audit time.

**Rights blocker:** the removed 1,183,983-byte `adstudio/assets/field-study.png` remains in public commit `755bab8`. Obtain explicit redistribution rights or owner-authorized public-history/hosting remediation. Do not publish a new rollback tag containing a disputed image or claim current-HEAD deletion purged it. Local rollback remains preserved; no force push or history rewrite was performed.

## Reviewable Cloud patch, without a merge

From this staging checkout, after receiving Cursor's **exact final committed SHA**:

```sh
node scripts/prepare-cloud-release.mjs <path-to-Cursor-Cloud-checkout> <full-40-character-SHA>
```

The helper only reads committed Git objects and writes ignored local patch/inventory files. It never reads `.env`, modifies another checkout, applies a patch, invokes inference or pushes. It verifies the known stable RC is an ancestor. It fails on unknown file scopes. Its manifest records selected/excluded paths, patch digest and a three-way apply check. Against the clean committed staging branch, the current 38-file patch passes that check; tracked files and index remain unchanged. This does not apply the patch or certify its runtime.

For the currently inspected changes, the implementation commit affects 48 files. Only runtime/library/Journey code, eight CPU test files, two existing font replacements, `.env.example`, `package.json` and the Cloud documentation are candidates. Private notes and one-off/root development tools are excluded by default. Review **every path and diff**, particularly spend gates, reference routing, provenance, prompt scrub, copy/geometry and font notices.

The current Cloud documentation references excluded development tools. Before shipping it, replace those instructions with portable, reviewed setup steps. In particular, `scripts/verify-comfy-cloud-key.mjs` currently defaults to a machine-specific original-repo `.env` and writes to a hardcoded Cloud `.env`; **do not ship or run that utility as a generic read-only credential check**. Its replacement must be explicitly scoped, never copy credentials across worktrees and never expose keys. Other customer-specific upload/demo tools must stay private. This does not establish a hardcoded brand in the production Journey; it is a packaging risk in the auxiliary tools.

## Final integration and publication gate

1. Receive Cursor's clean committed handoff: exact SHA, real Journey Qwen provenance, Cloud job/model/graph/reference evidence, identity/framing review, completed PNG, reload proof and credit behavior. No automatic paid retries or spend authorization is implied by release preparation. Preserve the distinction between the full FLUX prompt-upsampler workflow and any disclosed compatibility bypass.
2. Generate the allowlisted patch. Review `outputs/submission-audit/cloud-review.json` and the patch. Reconcile changed files against the final handoff; do not blindly admit newly excluded scripts. Do not merge private branch ancestry into the flattened public repository.
3. In this staging branch only, with a clean index, check and then apply the reviewed patch with `git apply --check --3way <patch>` and `git apply --3way <patch>`. If a conflict occurs, stop automatic application and resolve deliberately. Preserve staging's evidence-directory fix in `consolidated-rc.test.mjs`, and retain Cloud's updated caption assertions. Do not discard either side's runtime changes.
4. Inspect `git diff --cached --name-status` and `git diff --cached`. Keep `.env`, outputs, private notes, customer media, keys and tools with hardcoded local/customer paths out. Preserve local Qwen/Klein, Product-safe, RunPod and `creative-brief-v2`; keep Cloud a distinct opt-in engine. Update the judge/Cloud docs to the actual accepted behavior and retain font notices.
5. Run locked install if dependencies changed, `npm test`, `npm run test:consolidated`, `npm run test:release`, `npm run test:flux3`, `npm run test:runpod`, `npm run test:film` and the new Cloud tests. Set FFmpeg explicitly if testing assembly. Commit the reviewed integration locally using Conventional Commits; run `npm run typecheck` and `npm run build` on that clean exact commit.
6. Start the final candidate on a separately verified free loopback port using `OSH_RC_PORT`. Match `/api/release` to HEAD and the compiled manifest. Obtain desktop/mobile Journey, real PNG/export/reload and the agreed genuine-inference acceptance. Do not re-use another process's URL or stop unverified servers. Only after verification should the owner choose a definitive recording server.
7. Fetch public `origin/main` and compare it with the preserved public base. If it advanced, reconcile in staging, rebuild and reverify; never force push. Recheck the final public tree/history for secrets/media and resolve the photograph-rights issue. Review only the intended public-base-to-candidate diff.
8. Present exact final commit and diff for **owner authorization before any public push**. After authorization, fast-forward only `main` to the approved candidate. Never use `--all`, `--mirror`, bulk tag pushes or private remote refs. Verify the public commit, clone it again, install/build/launch, and check public demo/social links signed out. Owner completes the form and attestations.

No Cloud changes are applied by these instructions alone. No resources, subscriptions or inference were purchased. The existing stable RC and original collaborative repository remain untouched.
