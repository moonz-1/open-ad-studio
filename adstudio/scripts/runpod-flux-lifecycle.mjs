#!/usr/bin/env node
/** Dry-run (default) lifecycle for one-click FLUX RunPod. Always forces dry-run; never creates a Pod, including when live flags are set. */
import {writeFile, mkdir} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {planFluxProvision, ensureFluxGpuSession, CUSTOMER_STAGES} from '../../shared/runtime/runpod-flux-controller.ts';
import {liveProvisionAuthorized} from '../../shared/runtime/runpod-flux-budget.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const out = join(root, 'outputs/runpod-flux-session');
await mkdir(out, {recursive: true});

const live = process.argv.includes('--live');
if (live) {
  if (!liveProvisionAuthorized(process.env)) {
    console.error('Refusing --live: set ADSTUDIO_RUNPOD_LIVE=1 and ADSTUDIO_FLUX3_SPEND_APPROVED=1');
    process.exit(2);
  }
  console.error('LIVE MODE would bill RunPod. This script still only plans unless you call ensure with live flags from the API.');
}

const stages = [];
const planned = await planFluxProvision(process.env);
await writeFile(join(out, 'lifecycle-plan.json'), JSON.stringify({at: new Date().toISOString(), stages: CUSTOMER_STAGES, planned}, null, 2) + '\n');
console.log('PLAN', JSON.stringify({
  live: planned.live,
  gate: planned.gate,
  estimatedJobUSD: planned.plan.estimatedJobUSD,
  createBlockedReason: planned.plan.createBlockedReason,
  balance: planned.plan.balance,
}, null, 2));

const session = await ensureFluxGpuSession({
  env: process.env,
  dryRunOnly: true,
  onStage: (stage, detail) => {
    stages.push({stage, detail, at: new Date().toISOString()});
    console.log('STAGE', stage, detail || '');
  },
});
await writeFile(join(out, 'lifecycle-session.json'), JSON.stringify({
  mode: session.mode,
  stage: session.stage,
  comfyUrl: session.comfyUrl,
  proxyUrl: session.proxyUrl,
  created: !!session.created,
  podId: session.podId,
  stages,
  plan: session.plan,
}, null, 2) + '\n');

console.log('SESSION', session.mode, session.stage);
if (session.mode === 'dry-run') {
  console.log('Dry-run complete. No Pod created. Future live prerequisites and exact owner procedure: docs/RUNPOD_ONE_CLICK_FLUX.md. This CLI always stays nonbillable.');
  process.exit(0);
}
console.log('Session ready at', session.comfyUrl);
