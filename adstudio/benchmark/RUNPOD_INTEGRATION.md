# Official Runpod integration — 2026-10-22

Installed for Codex following [Runpod's official guide](https://docs.runpod.io/agent-setup.md) and [source repository](https://github.com/runpod/runpod-plugins-official). No Pod, funds, model weights, private-photo transfer or paid service was created.

## Verified setup

| Item | Result |
|---|---|
| Global Node |22.14.0, unchanged; below installer minimum22.20 |
| Installer runtime | User-approved isolated Node22.20.0 Windows x64 ZIP; official SHA256 `bb819d6eb8f5bfda294bbc83a7e4ec6539da67c4233d54b0d655b9248b15e29d` verified before extraction |
| Skills | Pinned `skills@1.7.4`;16 official Runpod skills installed with `--agent codex --yes --global`; installer list verifies Codex as target |
| Native plugin | `runpod@runpod`1.8.0 enabled; official marketplace commit926087d9f605645ef52b82dba1fc9714dd2da4d1 |
| Codex binary | Existing VS Code bundled CLI0.162.0-alpha.17.2; no CLI upgrade |
| Hosted MCP | `runpod`, Streamable HTTP, `https://mcp.getrunpod.io/`; OAuth login completed; live status `oAuth` / `connected` |
| MCP server | Runpod API Server4.5.0 `[specgen]`,90 tools discovered |
| Other MCP entries | All pre-existing tables exactly match private pre-install backup; `game.enabled=false` (Roblox), node_repl preserved. Codex initially omitted empty `args=[]`; restored only that default after comparison |
| Optional tooling | runpodctl executable and Flash SDK/CLI not installed; similarly named **skills** are documentation, not those tools |

Node.js (MIT with bundled notices): https://nodejs.org/dist/v22.20.0/ ; skills installer (MIT): https://github.com/vercel-labs/skills ; Runpod plugin/skills (Apache-2.0): https://github.com/runpod/runpod-plugins-official . No application dependencies or package lock changed.

## Installation and activation

Only the installer process used the isolated Node PATH. The archive/runtime/npm cache are in ignored `outputs/runpod-integration/`; deleting that cache later does not remove installed skills or change global Node.

```powershell
# Run under the isolated Node22.20.0 runtime, not global22.14:
npx -y skills@1.7.4 add runpod/runpod-plugins-official --skill '*' --agent codex --yes --global
npx -y skills@1.7.4 list --global --agent codex
codex plugin marketplace add https://github.com/runpod/runpod-plugins-official.git
codex plugin add runpod@runpod
codex mcp add runpod --url https://mcp.getrunpod.io/
```

The final command detected OAuth and successfully completed login. No API key was copied into MCP config. If a future session needs renewed login, use `codex mcp login runpod`, then personally complete the browser sign-in with the intended account. Do not send credentials/callback URLs in chat.

**VS Code action:** reload its window/restart the Codex extension, then start a new Codex chat to load the skills/server. The native plugin is registered for Codex CLI; current [OpenAI plugin documentation](https://learn.chatgpt.com/docs/plugins) says the IDE extension does not load native plugins. Standalone Codex skills and the direct MCP entry provide the IDE integration. [MCP documentation](https://learn.chatgpt.com/docs/extend/mcp) confirms CLI/IDE share Codex host configuration.

The guide currently names `mcp.runpod.io`, whereas the official bundled `.mcp.json` names `mcp.getrunpod.io`. Both advertise OAuth metadata; the requested/bundled getrunpod endpoint was configured and passed actual reads. No alternate client/agent configuration was installed.

## Actual read-only verification

Used the installed Codex app-server's generated protocol: initialize, an ephemeral read-only thread (no model turn), `mcpServerStatus/list`, and allowlisted `mcpServer/tool/call`. Codex managed OAuth; no credential-store extraction. No creation/update/delete, job, funding or feedback calls.

- `list-pods`, `includeClusterPods:true`, `limit:1000`: **0 Pods**, `hasNextPage:false`.
- `list-gpu-types`, `include:["AVAILABILITY"]`, `product:["POD"]`, `cloud:"SECURE"`, `count:1`, `minCudaVersion:"12.8"`:48 catalog entries.
- Account name was personally confirmed by the user; kept in private evidence. **MCP profile identity is not independently verifiable:** this live90-tool catalog has no account/profile identity tool, and its resources are guides only. Do not represent console confirmation as an identity API result.

Relevant GPU results from that catalog read:

| Exact GPU ID | VRAM | Secure catalog $/hour | Availability |
|---|---:|---:|---|
| `NVIDIA A100 80GB PCIe` |80GB |1.79 |NONE |
| `NVIDIA A100-SXM4-80GB` |80GB |1.79 |MEDIUM aggregate; LOW in EUR-IS-1, US-KS-2, US-MD-1, US-WA-1 |

SXM capacity lists host CUDA13.2 as available. These are catalog observations, not a complete offer or guarantee of117GB RAM/CPU/disk/image cache. No automatic hardware change or deployment. Recheck stock and obtain a live all-in quote before approval.

Private evidence: `outputs/runpod-integration/skills-install.log`, `skills-list.log`, `mcp-status.json`, redacted `readonly-results.json`, `verification-summary.json`. Config backups remain privately beside `~/.codex/config.toml`; never copy them or OAuth credentials into Git.

## Remaining benchmark gates

CPU preflight and five-file authenticated HF HEAD checks remain PASS. Browser Camera/project acceptance, live GPU+storage/fees quote, SSH/access details, always-awake external watchdog and verified termination/billing credentials, and explicit deployment/download/two-guide-transfer approval remain separate gates. MCP OAuth does not configure the existing Python watchdog's `RUNPOD_API_KEY`; that credential or a tested supported replacement must be prepared privately before any paid lease. No optional CLI is required for today's MCP reads.

Budget stays **$10 total; <=$6 initial all-in; >=$4 reserve; <=3h lease**. Nothing in this integration authorizes provisioning, funding, heavyweight downloads, private transfer or merging PR #3.
