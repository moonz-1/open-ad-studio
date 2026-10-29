# Funded benchmark readiness - 2026-10-22

**Deployment awaits separate explicit approval; final gate decision is below.** User confirms $10 available credit, auto-reload off, and plugged-in/awake/networked monitoring with retained terminal and2h15m phone alarm. Both temporary-key read-only reports PASS. No Pod created, model downloaded, photo uploaded or charge initiated in this readiness task. First-session usage <=$6; keep >=$4 unspent. PR #3 verified OPEN/DRAFT. Production/Director source, defaults and model pins are unchanged.

**Final gate update - 2026-10-22: GO for explicit approval; execution remains unapproved.** Local private/public SSH fingerprint independently derived and matched, with no private-key output. User confirms both temporary keys have **All / unrestricted** permissions: termination permission confirmed by user, billing operations GET-only but billing credential **not read-only** (narrowing it to Read Only is recommended). No live DELETE attempted. User's console offer: Secure on-demand SXM80,117GB RAM/16vCPU,$1.79/h,30GB container~$0.004/h,pinned image accepted,Any region with US-MD-1 preferred. Console omits200GB Pod volume price; freshly checked MCP4.5.0 schema explicitly supports host-local `mounts.persistent={size:200,path:'/workspace'}` excluding network/global mounts. Published running-disk tariff$0.10/GB/month supplies the storage estimate (~$0.03151/h for230GB at730h/month), total~$4.5538/2.5h; this is **not a complete assigned-machine quote**. Accept the prepared MCP request for approval review, then require exact actual ID/name/allocation/cost/mount readback and armed watchdogs immediately after approved creation; terminate on mismatch before weights/photos. New fresh catalog:US-MD-1 MEDIUM. Lifecycle15+awake2+first-cookie5 tests and actual Windows awake/restoration PASS again. These results supersede the pending permission/private-key/full-console-volume fields below; SSH server identity and real deletion remain post-create checks. Nothing deployed/spent.

## Verified now

| Check | Actual evidence |
|---|---|
| OAuth control plane | Connected Runpod MCP4.5.0,90 tools. Read operations only; OAuth is not the temporary watchdog key. |
| Existing resources | Pods, endpoints, network volumes, global volumes and clusters empty; all final pagination pages. |
| Current-month usage | October2026 aggregate billing records empty; Pod compute/disk, Serverless compute/disk/fees, endpoints, storage and clusters all $0; total $0. No costliest resource. This does not prove credit balance. |
| GPU catalog | Secure A100 SXM80GB, $1.79/h, aggregate MEDIUM; US-MD-1 LOW, host CUDA13.2 capacity satisfies12.8 floor. Catalog snapshot, not a complete assigned-machine quote/reservation. |
| Private input readiness | Existing cookie and printed-label original/copy/guide SHA checks PASS; two1088x1920 guides, no attempts or uploads. Only cookie seed1 is in first-session scope. |
| Local termination rehearsal |15 lifecycle tests PASS, including real loopback HTTP asynchronous DELETE/retries/GET404, foreign-ID protection, rate/authentication/heartbeat/billing validation. All DELETEs used a fake local provider. |
| Completion cleanup |5 tests PASS: one cookie attempt, terminate before CPU gallery; render failure, timeout, Ctrl+C, stale heartbeat or hash mismatch terminate without retry. |
| Private credential helper |8 tests PASS: GET-only scopes, no credential persistence, stale PASS invalidation, echoing-prompt refusal, safe HTTP status evidence and key removal on exit. Live temporary-key results are separate local reports. |
| Live temporary termination credential |PASS hidden-prompt report at2026-10-23T00:48:42Z: dedicated public-key fingerprint matches and full Pod inventory empty. GET-only; Pod write/delete selection not yet confirmed. |
| Live independent billing credential |PASS hidden-prompt report at2026-10-23T00:50:17Z: authenticated billing read/current-month usage $0. Read-only permission selection still needs user confirmation; no balance/profile returned. |
| Windows monitoring |2 wrapper tests PASS; real SetThreadExecutionState awake request/restoration PASS. Explicit sleep/lid closure/reboot/network loss remain untested and can defeat this protection. No persistent power configuration changed. |
| Other checks |4 download safety tests; benchmark hash/graph/upload gates; actual synthetic73-frame FFmpeg collection/contact-sheet/gallery; typecheck/build PASS. No GPU model render. Prior pinned Linux CPU and authenticated HF HEAD evidence remains in PREFLIGHT.md. |

Evidence: `outputs/runpod-integration/readonly-results.json`, test logs in `outputs/benchmark-readiness/funded-preflight/`, private input report in `outputs/benchmark-readiness/prepared.json`. No secrets or raw account responses belong in Git. No inference quality or actual cloud deletion is proven by these checks.

## Private temporary credentials - human terminal only

Use the same account that owns the registered SSH public key. At the [official Credentials page](https://docs.runpod.io/get-started/credentials), create temporary named keys:

1. `ltx25-termination`: minimum permissions the console offers for Pod GET/DELETE and SSH-public-key GET. Avoid unrelated writes. Endpoint-specific restrictions do not establish per-Pod isolation. If only broad Pod write is available, record that fact; the harness's exact-ID/name checks are not provider-enforced scope.
2. `ltx25-billing`: separate read-only billing credential; global Read Only if finer controls are unavailable. Later independent audit additionally needs Pod/volume reads. Do not grant it write access.

Do not store either key in chat, shell arguments, Git, .env or evidence. No OAuth-token extraction. In your own interactive VS Code PowerShell terminal, from this repository:

```powershell
# Remove a previously configured key from this terminal, if present.
Remove-Item Env:RUNPOD_API_KEY -ErrorAction SilentlyContinue
python adstudio/benchmark/credential-check.py --check-read-only --public-key "$env:USERPROFILE/.ssh/runpod_ltx25.pub" --out outputs/benchmark-readiness/termination-credential.json
python adstudio/benchmark/credential-check.py --check-read-only --billing-only --out outputs/benchmark-readiness/billing-credential.json
```

Each command takes its intended key at a hidden console prompt and saves only a sanitized report. Share no credential; let the agent inspect these two reports. Failed checks overwrite stale PASS. GET success does not prove DELETE permission or account balance. Confirm permission selection/account in console. Actual exact-Pod deletion can only be verified after separately approved creation, never by DELETE against fabricated IDs. Re-enter keys privately in later retained watchdog/cleanup processes; do not persist them for convenience. Revoke after verified deletion and settled billing.

## Automatic cleanup ready in code; not armed

Use the existing external retained Windows watchdog **and** separate in-Pod watchdog with the same immutable lease. Bind ID/name to the approved create response. Start monitoring before setup/download; fresh authenticated heartbeat <=45s required before work. Do not reset the pre-create timestamp.45min bootstrap abort remains in the downloader.

- Hard local lease maximum9000s (2h30m), stricter than the user's three-hour maximum.
- Start deadline DELETE at2h25m, retry until authenticated GET404. Manual phone alarm2h15m. Windows plugged in, lid open, awake, network and retained console required.
- At the catalog rate, 2.5h compute is $4.475;230GB storage is approximately $0.0788 using the documented730h planning divisor: **~$4.5538 usage**, before quote-specific fees/rounding. Not a complete live quote. Spend <=$6, preserve >=$4; abort rather than consume reserve.
- No provider-enforced TTL or absolute monetary guarantee during provider/API outages. Unknown/higher rate terminates early. Manual fallback is console **Terminate**, not Stop (stopped Pod storage bills).

After separate approval, SSH/host-fingerprint verification, remote pinned health/weight checks and both fresh watchdogs, local execution uses:

```powershell
# Set only nonsecret paths/loopback URLs as in README.md.
# Requires BENCHMARK_LEASE, BENCHMARK_WATCHDOG_READY, BENCHMARK_HEALTH_REPORT.
python adstudio/benchmark/cookie-session.py --node outputs/runpod-integration/node-runtime/node-v22.20.0-win-x64/node.exe --approved
```

This prompts for the temporary termination credential, runs **only cookie seed1** via existing SDK -> proxy -> ComfyUI, checks local MP4/provenance hash, then terminates before making contact sheets. All render exit paths attempt verified termination. SDK/FFmpeg children do not inherit Runpod/HF secrets. No automatic retry, second seed, printed-label case or second session. Independent watchdogs remain essential if this process/computer dies. Further quality analysis and gallery collection are local after deletion. This runner defaults to no action; its flag is not deployment authorization.

## Remaining gates

1. **DONE:** both sanitized temporary-key reports PASS; user confirms monitoring/phone alarm, $10 credit/auto-reload off and both keys All/unrestricted. Local private SSH identity now verified by fingerprint derivation. Separate billing key has broad privileges; its checker/audit operations remain GET-only. No provider-enforced per-Pod credential scope or real DELETE proof.
2. **Approval review ready:** user console hardware/compute offer plus live MCP Pod-local volume schema and official storage tariff checked as described above. Complete assigned-machine price, actual allocation/cache/throughput and host SSH fingerprint cannot be proven pre-create. Read back and abort/terminate on mismatch immediately after separately approved creation, before heavy downloads/private upload. No create as a quote probe.
3. Separate explicit approval for that exact <=$6/2.5h session, pinned71GB weights and **cookie guide only**. Funding/readiness approval does not authorize those actions.
4. After approved creation only: arm both live monitors, confirm exact ID/name/cost/allocation, verify server host fingerprint through an independent authenticated provider channel, strict SSH/tunnel, software/GPU/weight health. If bootstrap/access fails, terminate promptly. No private upload before health/heartbeat gates.
5. After first attempt: verified absence, independent read-only billing/volume audit and settled credit delta; keep >=$4. Billing may lag. No further spend automatically.

Official references: [credential permissions](https://docs.runpod.io/get-started/credentials), [Pod lifecycle](https://docs.runpod.io/pods/manage-pods), [storage pricing](https://docs.runpod.io/pods/pricing). Browser acceptance remains a separate production/merge gate.
