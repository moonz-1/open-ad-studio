# SXM deployment gate — 2026-10-22

**Current funded-readiness update:** [READINESS_CHECK.md](READINESS_CHECK.md) supersedes the historical credit/access state below. User reports a funded $10 balance; no deployment approval. A new one-cookie runner terminates immediately after local video/provenance download, even on failure, before CPU contact-sheet collection. No first-session label/repeat experiment. Fresh OAuth inventory/billing/catalog reads and local cleanup rehearsals completed; temporary-key reports and full console quote are separate gates. $6 maximum session usage, >=$4 reserved, maximum2.5h. No claim of a provider-enforced hard billing cap.

**NO-GO for paid execution.** Read-only preparation only. $10 research allocation, first experiment all-in <=$6, >=$4 reserved. No creation, funding, weights, private transfer or paid job performed. PR #3 verified draft through `gh pr view 3`; keep draft.

Current practical follow-up: [ACCESS_RUNBOOK.md](ACCESS_RUNBOOK.md). It supersedes access/API/browser-gate statements in the original snapshot below: dedicated key is registered, lifecycle now uses strict v2 responses, maximum2.5h enforced, local termination/collection rehearsals pass. Browser acceptance is required for production/merge, not isolated SDK feasibility. Remaining user-only actions are at the end of that runbook. Paid execution remains NO-GO.

## Live Runpod evidence

`get-gpu-type(id=NVIDIA A100-SXM4-80GB, include=[AVAILABILITY], product=[POD], cloud=SECURE, count=1, minCudaVersion=12.8)` returned 80GB VRAM, Secure price **$1.79/hour**, aggregate HIGH stock, host CUDA13.2. Regional stock: US-MD-1 MEDIUM; US-KS-2, US-WA-1, EUR-IS-1 LOW. Proposed region US-MD-1; recheck at approval. This is a live catalog quote, **not a complete machine-specific deployment offer**. The catalog supplies no host RAM/vCPU/disk/throughput or cached-image guarantee. No quote/dry-run deployment endpoint is exposed in the live tool inventory; never call create to obtain a quote.

`list-pods(includeClusterPods=true)`, `list-endpoints`, `list-network-volumes`, `list-global-volumes`, `list-clusters`: all empty, all final pagination pages. `list-billing(lastN=1,bucketSize=month)` resolved 2026-10-01 through 2026-11-01 UTC, no records. Pods compute/disk $0; Serverless compute/disk/fees $0; Public Endpoints $0; network storage $0; clusters compute/disk/network $0; **total $0**. No current paid resources and no costliest resource.

These reads belong to the authenticated MCP caller. Prior private integration evidence records the user's console-account confirmation. There is still no personal profile/balance read in the tool inventory. `get-organization` returned400 “Organizations are not enabled for this user”; this does not identify the personal account. Current matching console identity, credits, payment tax/fees and auto-reload state are **not independently verified**. Computer Use inventory exposed no browser/app for an unsubmitted console quote. Do not infer identity or balance from empty resources.

## Budget

Storage from [Pod pricing](https://docs.runpod.io/pods/pricing): running container and Pod volume each $0.10/GB/month, billed per second; ingress/egress $0. No network/global volume requested. Using the existing **730h planning divisor**, 230GB costs $23/month = $0.03150685/hour; compute+storage **$1.82150685/hour**. Exact provider divisor/rounding remains a quote requirement.

| Maximum elapsed time, including initialization | Compute | 30GB container + 200GB volume | Usage estimate | Headroom below $6 | Allocation left before funding costs |
|---|---:|---:|---:|---:|---:|
| 3h (comparison only; no longer allowed) | $5.3700 | $0.0945 | **$5.4645** | $0.5355 | $4.5355 |
| **2h30m recommended** | $4.4750 | $0.0788 | **$4.5538** | **$1.4462** | **$5.4462** |

Neither number is an account-specific all-in quote. [Sales tax](https://docs.runpod.io/accounts-billing/sales-tax) is charged on credit purchases, above the credit amount, based on billing address/payment method; not deducted a second time from usage credits. No universal extra Pod service fee was found; account/payment/FX fees are unknown, not assumed zero. Cash-outlay accounting must count the **whole deposit plus its taxes/fees**, not merely the credits consumed. [Billing](https://docs.runpod.io/accounts-billing/billing) says credits are non-refundable and an evaluation can start at $10: if a new $10 deposit is required, that cannot meet the initial $6 cash limit. Verify existing funded credits and funding basis privately; do not top up. The 3h plan tolerates only $0.5355 additional allocated costs; 2h30m tolerates $1.4462. Reserve is not permission to exceed $6.

## Configuration and safeguards

- Legacy `pod-request.example.json` now selects SXM and permits host13.2. It remains a **v1 REST example**, not an MCP body. New `pod-request.mcp.example.json` mirrors the live v2 create schema: one Secure SXM, minRamPerGpu110, minVcpuCountPerGpu8, disk30, persistent size200 at `/workspace`, only22/tcp, SSH enabled, no Jupyter/global networking. Host CUDA floor12.8 accepts13.2; this does not change container CUDA12.8. v2 exposes no minimum-download-speed field or interruptible field; explicitly verify on-demand offering and >=1Gbps/cache in the unsubmitted console offer. US-MD-1 is a candidate, not a reservation.
- Software/model pins, image digest, hash lock, graph and production defaults are unchanged. Existing health/upload guards accept A100 SXM by A100 name and >=79GiB VRAM; CPU preflight remains prior PASS, GPU inference remains untested. Request minima do not prove host allocation. Verify >=110GB RAM, >=8vCPU and exact disks in offer/readback; remote health additionally requires100GiB RAM, setup requires >150GB free `/workspace`. 110GB decimal exceeds100GiB, but cgroup limits must also match the offer.
- `get-ssh-keys` returned **keys:[]**. Windows OpenSSH client/keygen are installed; no local `~/.ssh/*.pub` found. No key generated/registered. Prepare a dedicated user-controlled key, register/provide its public half only, verify matching local private-key authentication, provider host fingerprint and mapped22 port after creation. Never disable host verification. SSH is not testable end-to-end without a Pod. Tunnel only local28188/28189; never expose Comfy/proxy HTTP.
- Shell has no `RUNPOD_API_KEY` or separate billing-key environment variable. OAuth authorizes current MCP reads, **does not authenticate `lifecycle.py`**. Prepare ephemeral same-account GET Pod/DELETE Pod credential and separate billing read credential where supported; verify private credential identity/read scopes. A read cannot prove DELETE permission and no destructive probe is authorized. MCP delete tool presence is not proof of granted DELETE scope. No extracting OAuth tokens or creating delegations as a shortcut.
- Existing lifecycle code uses v1 REST (`costPerHr`); current MCP is v2 (`cost`). Do not feed v2 records to v1 code. Verify legacy authenticated response shape and billing compatibility before relying on it; migrate/test adapter separately if unavailable. Mock tests establish behavior, not live permission/deletion proof.
- Two watchdogs must run on **independent failure domains**: always-awake external host and separate persistent in-Pod process, neither the render worker. External host, retained process, credentials and no-sleep arrangement are not verified/armed. Both use the same immutable lease/pre-create timestamp and refresh authenticated matching heartbeat <=45s. For recommended2h30m set deadline=created+9000; existing code starts DELETE at2h25m. Set independent manual console alarm at2h15m. For3h, DELETE starts2h55m/alarm2h45m. Do not reset lease on restart. No provider-enforced TTL verified; no absolute cap during control-plane outage.

## Manual shutdown and first result

After separately approved creation only: verify exact lease Pod ID/name, then:

```powershell
python adstudio/benchmark/lifecycle.py terminate --lease outputs/ltx25-benchmark/lease.json --approved
```

If credential/process fails: console Pods -> exact benchmark Pod -> **Terminate**, not Stop (stopped200GB volume continues billing at $0.20/GB/month). Alternatively authenticated MCP `get-pod` then `delete-pod` for the approved ID, followed by fresh `get-pod`404 and empty resource list. Do not delay deletion for artifact copying. Independently recheck billing/credit delta after settlement, verify no retained volumes and revoke ephemeral credentials. No actual delete has been tested because no Pod exists and no mutation is authorized.

Outstanding before paid action: same-account unsubmitted console offer/credits/fees, privately configured temporary credentials with appropriate permissions, dedicated-key private-half confirmation and awake monitoring/alarm commitment, then separate explicit <=2.5h/$6 deployment/weights/two-guide approval. Browser acceptance is not a prerequisite for the isolated SDK feasibility experiment. See ACCESS_RUNBOOK.md for current exact procedures and rehearsal evidence. After creation, fresh watchdog heartbeats, SSH/host-fingerprint verification and remote pinned health remain mandatory before setup/download/private transfer as applicable.
