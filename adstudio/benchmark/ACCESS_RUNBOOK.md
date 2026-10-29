# Private access and no-spend rehearsal — 2026-10-22

**Current first-session scope:** user reports $10 account funding; deployment remains unapproved. See [READINESS_CHECK.md](READINESS_CHECK.md). One original-cookie seed1 attempt only, followed immediately by verified Pod termination once the MP4/provenance are local (also terminate on failure). Build contact sheets/review after termination. Printed-label and repeat-seed cases are deferred to separately approved work; the older multi-case procedure below is not the first-session instruction. Initial usage <=$6, >=$4 untouched; retain the stricter2.5h lease/2h25m termination start/2h15m alarm.

**NO-GO remains; $0 spent.** No remote resources changed. First session: <=2.5h elapsed from immediately before create, <=$6 **all-in**, $10 total research/$4 minimum reserve. Browser UI acceptance is **not required for this isolated SDK model-feasibility run**: its technical dependencies are pinned runtime/schema, SSH tunnel, private guide integrity and SDK/proxy transport. Browser/project/Camera acceptance still precedes production acceptance and merging draft PR #3.

## Dedicated SSH identity

Read-only checks found `%USERPROFILE%\.ssh\runpod_ltx25.pub`, ED25519, fingerprint **`SHA256:GHdU5pUCpX0XZdML5ZieGdKvMDlWEzLWgpr9coIHv4k`**. `get-ssh-keys` returned the matching public key; registration is complete. The private-key path is access-restricted to this agent; do not infer absence from denied access. No private key was read, copied or printed. The public identity fingerprint is **not the server host fingerprint**. User can locally run `ssh-keygen -y -f "$env:USERPROFILE/.ssh/runpod_ltx25" | ssh-keygen -lf -` in their own terminal to confirm the pair (only derived public data passes through the pipe; any passphrase stays at the local prompt).

### After separately approved creation, before secrets or photos

1. Match the immutable lease ID/name against authenticated Runpod `get-pod` and console. Copy **direct TCP SSH** endpoint: v2 `ssh.direct.host`, `.port`, `.username` (normally root); v1 equivalent is `publicIp`, `portMappings["22"]`. Use direct SSH for SCP/tunnels. The basic `ssh.runpod.io` gateway does not support SCP/SFTP; do not substitute its username/host.
2. Obtain the Pod's **ED25519 host fingerprint through an independent authenticated provider channel**, not the same unverified SSH connection. If the console provides a provider-authenticated terminal to this exact Pod, run:

   ```bash
   ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256
   ```

   This reads only the **server public key**. Do not print `/etc/ssh/ssh_host_ed25519_key` (private). A Connect screenshot showing just IP/port is not fingerprint evidence. If the provider offers no trusted terminal/fingerprint channel under our22-only configuration, obtain the host fingerprint from Runpod support/provider-authenticated records; **do not publish another port or use unverified SSH to obtain the supposedly independent fingerprint**. No host fingerprint exists for this session before a Pod exists. Treat lack of a trusted fingerprint as an immediate bootstrap blocker and terminate promptly, without weight downloads.
3. In a local PowerShell terminal, fill only endpoint values from that authenticated read. `$sshHost`, `$sshPort` are task variables; never overwrite `$Host`:

   ```powershell
   $sshHost = '<direct-host-from-Runpod>'
   $sshPort = <direct-port-from-Runpod>
   $sshUser = 'root' # Use the returned username if different.
   $keyPath = "$env:USERPROFILE/.ssh/runpod_ltx25"
   $known = "$PWD/outputs/ltx25-benchmark/known_hosts"
   New-Item -ItemType Directory -Force outputs/ltx25-benchmark | Out-Null
   ssh-keyscan -T 10 -p $sshPort -t ed25519 $sshHost | Set-Content -Encoding ascii "$known.candidate"
   if ($LASTEXITCODE -ne 0) { throw 'Host-key scan failed' }
   ssh-keygen -lf "$known.candidate" -E sha256
   ```

   `ssh-keyscan` discovers a candidate, **does not authenticate it**. Compare the displayed SHA256 fingerprint exactly against step2 through the independent channel. Stop on multiple unexpected keys, mismatch or absent output. Only after a match:

   ```powershell
   Move-Item -LiteralPath "$known.candidate" -Destination $known
   $sshOptions = @('-i', $keyPath, '-p', "$sshPort", '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', "UserKnownHostsFile=$known", '-o', 'ForwardAgent=no', '-o', 'ConnectTimeout=10')
   ssh @sshOptions "$sshUser@$sshHost" 'printf "SSH authentication verified\n"'
   # Keep a separate retained terminal for this tunnel:
   ssh @sshOptions -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -L 127.0.0.1:28188:127.0.0.1:28188 -L 127.0.0.1:28189:127.0.0.1:28189 "$sshUser@$sshHost"
   ```

   Encrypted-key passphrase prompts are local; never paste the passphrase in chat. Never use `StrictHostKeyChecking=no`, `accept-new`, `UserKnownHostsFile=NUL` or agent forwarding. A changed host key requires re-verification, not deleting the warning. SCP uses the same `-i`, `IdentitiesOnly`, strict checking/known-host file, but uppercase `-P` for port. Public package and private lease only until both watchdogs and remote health pass; approved guides are uploaded later by SDK, not by a broad directory copy. No private SSH key goes to the Pod.

[Official SSH connection modes](https://docs.runpod.io/pods/configuration/use-ssh). Direct endpoint and fingerprint verification remain post-create checks; this document does not claim an existing connection.

## Temporary Runpod API credential

MCP OAuth credentials are not exported, extracted or reused. In your own authenticated console create an **ephemeral named API key** for this experiment, using the minimum permission the console actually supports. Creation/permission changes are **user-only**; none performed here. The public v2 schema declares `pods:read` for GET, `pods:write` for DELETE, `billing:read` for billing. Use restricted scopes if actually available; documentation's endpoint-specific restrictions do not prove a Pod-ID-specific restriction exists. A broad Pod write key can change other Pods: local ID/name checks are an application guard, not provider-enforced token scoping. Use a separate read-only billing credential for independent audit where supported. Revoke both after absence/settled billing verification; do not rely on an unverified automatic expiry.

`credential-check.py` is **GET-only**, defaults to no network and prompts using Python `getpass` if the environment variable is absent:

```powershell
python adstudio/benchmark/credential-check.py --check-read-only --public-key "$env:USERPROFILE/.ssh/runpod_ltx25.pub"
```

Enter the temporary key only in its hidden local prompt. It checks authenticated v2 SSH keys for the dedicated public-key match and complete empty Pod inventory. Check the separate read-only billing key in a fresh process with `python adstudio/benchmark/credential-check.py --check-read-only --billing-only`; that mode requires only billing read access and confirms zero current-month spend. Do not broaden the termination key just to satisfy a combined check. This correlates the credential with the known setup; it is **not personal-profile identity, balance or DELETE-scope proof**. Confirm intended account and displayed permission selection yourself in console. Do not test DELETE against a fabricated/non-owned Pod ID:404 proves neither scope nor successful deletion. Real DELETE permission/absence can only be verified on the exact later approved Pod; no live destructive test is done now.

No credential belongs in chat, shell arguments/history, Git, `.env`, screenshots or evidence logs. For a retained shell that must run setup/download/start, supply `RUNPOD_API_KEY` privately in that process using an interactive hidden prompt, for example run this from an interactive PowerShell session (do not include the key literal):

```powershell
$temporarySecret = Read-Host 'Temporary Runpod key' -AsSecureString
$temporaryPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($temporarySecret)
try { $env:RUNPOD_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($temporaryPointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($temporaryPointer); $temporarySecret.Dispose() }
# Run only the explicitly approved command, then:
Remove-Item Env:RUNPOD_API_KEY
```

Environment variables are process-private convention, not protection from same-user/admin inspection. Remote shell: `read -r -s -p 'Temporary Runpod key: ' RUNPOD_API_KEY; printf '\n'; export RUNPOD_API_KEY`; finish with `unset RUNPOD_API_KEY`. Disable shell tracing first (`set +x`), never print environments. Credentials must be entered separately in each retained session. Existing startup strips Runpod/HF secrets from Comfy/proxy children.

[Runpod credential guidance](https://docs.runpod.io/get-started/credentials), [live public v2 schema](https://api.runpod.io/v2/openapi.json).

## v1/v2 reconciliation and rehearsal

For sanitized credential evidence, add `--out outputs/benchmark-readiness/termination-credential.json` to the Pod/SSH-key check or `--out outputs/benchmark-readiness/billing-credential.json` to the billing-only check above. This saves timestamp, mode, status and bounded check results, never credentials/account response bodies. It invalidates stale success before prompting and refuses an echoing prompt fallback. If `RUNPOD_API_KEY` is already set in your terminal, remove it before these checks so each process prompts for its intended separate key. Never pipe or paste a key into shell arguments.

Only benchmark lifecycle control-plane calls migrated. Production generation SDK/proxy and all software/model pins remain unchanged. No new dependency. Current `lifecycle.py` pins `https://api.runpod.io/v2`, refuses redirects, supports only GET and exact-Pod DELETE; no provisioning function. Required differences:

| Previous v1 | Current v2 behavior |
|---|---|
| `costPerHr`, sometimes a numeric string | Require numeric finite positive `cost`; reject legacy/mixed fields, boolean, missing, NaN, infinity, zero, string or higher rate. |
| Name-only identity check | Require exact **ID and name** before every DELETE and readiness refresh. Unknown identity never permits deletion. |
| `/networkvolumes` | `/network-volumes`. |
| Billing bare rows / `amount` | Require `records`/`metadata`, filtered matching Pod ID, record count, finite `totalAmount` and matching GPU+CPU+disk components/totals. Never default missing amounts to zero. |
|3h lease examples | Hard maximum9000s; declared `feesUSD` required in Python/JS, projected usage+fees <=sessionCap<=6. Budget planning2.5h. Model/software pins unchanged. |

The legacy create example remains reference only; MCP uses `pod-request.mcp.example.json`. Do not mix v1 responses into the current watchdog. v2 Pod records omit personal-owner identity; bind the exact Pod ID from the later approved create to the matching name and privately confirmed account. The script cannot manufacture account-profile evidence.

`python adstudio/benchmark/lifecycle_test.py` passes **15 tests**, including real HTTP on a localhost fake provider: asynchronous202 DELETE requires retry until GET404; rate increases stop before arming; missing/malformed/mixed costs fail; foreign IDs/names are never deleted; authentication failure stops heartbeat without extending deadline; billing envelope/component mismatches fail; provisioning/foreign-resource DELETE and credential redirects are rejected. No Runpod DELETE was sent. Readiness is refreshed only after successful authenticated ID/name/rate check, maximum45s age. At2h25m DELETE starts,5min before2h30m deadline; fees count against monetary cutoff. Provider outage remains outside any guaranteed monetary cap.

## Zero-additional-cost independent monitoring

**Recommended:** an existing plugged-in Windows computer, external to the Pod, running a separate retained terminal (can be the existing render laptop, though a second existing computer provides better isolation). `watch-awake.py` uses standard-library Windows awake inhibition, no installation or persistent power-policy change. The Windows awake API request/restoration was tested successfully locally; explicit sleep/lid/network behavior is not proven. Default does nothing; after separately approved creation:

```powershell
python adstudio/benchmark/watch-awake.py --lease outputs/ltx25-benchmark/lease.json --ready-file outputs/ltx25-benchmark/watchdog-ready.json --approved
```

It prompts privately for the temporary key, holds the awake request on the watchdog thread and restores it on exit. No PowerShell script execution-policy change is needed. Keep AC power, lid open, network alive and terminal open; explicit sleep/reboot/network failure can defeat inhibition. A separate manual phone alarm at **2h15m** requires checking console/termination, not just acknowledging the alarm. A second independently retained **in-Pod** watchdog uses the same immutable lease, starts before setup and refreshes its own heartbeat. The external ready file must remain local to the SDK process; if using another computer, relay **only the heartbeat JSON** to the local ready path every<=15s over an already authenticated channel, preserving its `checked` timestamp, and verify freshness before work. No relay exists yet; using the same existing local machine avoids that new dependency. Do not copy a one-time ready file and call it live.

Existing Linux machine: direct `lifecycle.py watch` in a retained process/service with sleep disabled. Existing free Docker/WSL on this same PC is **not another host failure domain**. Do not rent a VPS or turn on a metered/free-trial cloud account. Existing public-repo GitHub standard runners can be free, but private quotas/overages vary; scheduled events can be delayed/dropped and may run only from default branch. Therefore Actions cron is rejected as primary cutoff; no workflow, remote secret, runner or schedule created. A manually started, already-running free runner could be a third monitor only after cost/secret/availability verification, not a prerequisite or an installed safeguard. [Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage), [schedule delays](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows).

## Offer verification without deployment

Read-only MCP GPU catalog verifies exact SXM80 ID, Secure price, region stock and host CUDA capacity. Public v2 schema and tool inventory provide **no pre-create machine-offer quote/dry run** with actual assigned RAM/vCPU, cache or download speed. Request minima are filters, not evidence of allocation. `get-capacity` adds CUDA/stock prices, not these missing details. Never create as a quote probe.

**Your console screenshot(s), without clicking Deploy**, must show: intended account, credit balance/auto-reload state (redact personal/payment details), one **on-demand Secure A100 SXM80**, region (US-MD-1 candidate), allocated RAM>=110GB/vCPU>=8,30GB container+200GB Pod volume at `/workspace`, no network/global volume, pinned image,22/tcp only, GPU+storage total and quote time. Capture any displayed throughput/cache information; do not infer guarantees from an omitted field. Credits/funding taxes/fees must keep first-session all-in<=6 and leave>=4 of10. If cache/throughput are not offered as guarantees, mark unknown; the45min bootstrap abort bounds the experiment instead. Pre-create quote is a snapshot, not a reservation. Later authenticated Pod readback, actual memory/cgroup/disk/GPU health and SSH/fingerprint checks remain mandatory immediately after approved creation. No screenshot can prove performance/VRAM fit or settled billing in advance.

## First two cases and output collection

`node adstudio/benchmark/prepared-check.mjs`: both original/copy/guide SHA256 match, two1088x1920 guides, no upload, zero attempts; private report `outputs/benchmark-readiness/prepared.json`. Cases **cookie seed1**, then **printed-label seed1**, selected by user already. Printed label is a generic Thank You surrogate, not a brand-logo acceptance claim. Model revision/five file sizes and hashes, requirements/workflow hashes and exact image/software pins verified; **no weight bodies exist here to hash**, so actual downloaded-file SHA/GPU fit remain later runtime checks. Compared `pins.json` to6e144bf: only budget planning changed, not model/software environment.

`node adstudio/benchmark/collect.test.mjs`: real local synthetic1088x1920,73frames/24FPS H.264 passes collector; seven-frame contact sheet/gallery generated, human review survives repeat collection, altered output hash is rejected. No private photo used in that rehearsal. SDK runner records attempt before submission, exact graph/prompt/seed/pins/stats/job/timing/output hash; four attempts maximum/no automatic retry. Collect full videos locally before deadline when possible, then terminate even if evidence is partial. Model execution/commercial fidelity remain unproven.

### Only user-controlled actions left

1. Provide the unsubmitted console offer/account-credit screenshots; confirm fees/funding basis within$6.
2. Privately prepare temporary termination and read-only billing credentials/permission evidence, confirm the dedicated private key works locally, and commit to the existing awake monitoring computer plus2h15m alarm.
3. Once those free gates pass, explicitly approve the exact <=2.5h/$6 session, pinned weights and the two selected guide transfers. No approval is requested or implied by this preparation.
