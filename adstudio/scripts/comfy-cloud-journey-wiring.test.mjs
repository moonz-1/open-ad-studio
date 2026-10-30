// Nonbillable Journey wiring checks for Comfy Cloud / FLUX. No network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describeEngines,resolveGenerationEngine} from '../src/generation-engines.ts';

const api=readFileSync(new URL('../../shared/runtime/api.ts',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/ad-application.ts',import.meta.url),'utf8');
const journey=readFileSync(new URL('../src/journey-service.ts',import.meta.url),'utf8');
const cloud=readFileSync(new URL('../../shared/runtime/comfy-cloud-flux.ts',import.meta.url),'utf8');

test('Journey path names flux3-cloud through capabilities, Generate, scene POST and Cloud renderer',()=>{
  assert.match(api,/flux3Cloud=await comfyCloudFluxAvailability/);
  assert.match(api,/wantFlux3Cloud=scene&&!campaign&&body\.engine==='flux3-cloud'/);
  assert.match(api,/renderFlux3ComfyCloudScene\(/);
  assert.match(api,/idempotencyKey:id/);
  assert.match(api,/automaticRetry:false/);
  assert.match(api,/engine:'flux3-cloud'/);
  assert.match(app,/flux3-cloud/);
  assert.match(app,/engine:engineId/);
  assert.match(app,/never silent Klein/);
  assert.match(journey,/flux3-cloud/);
  assert.match(journey,/Preparing product references/);
  assert.match(journey,/never silently switch/);
});

test('Cloud path forbids Partner Node, auto-retry and process-global Cloud sticky base URL',()=>{
  assert.match(cloud,/partnerNodeForbidden:\s*true/);
  assert.match(cloud,/Partner Node \/ Router model endpoints are forbidden/);
  assert.match(cloud,/Never auto-retry submit/);
  assert.match(cloud,/automaticRetry:false/);
  assert.match(cloud,/sourcePhotoSubstitution:false/);
  const client=readFileSync(new URL('../../shared/runtime/comfy-cloud-client.ts',import.meta.url),'utf8');
  assert.match(client,/delete process\.env\[BASE_URL_ENV_VAR\]/);
  assert.match(client,/restoring any prior COMFY_BASE_URL/);
});

test('Engine panel exposes Comfy Cloud / FLUX only when spend+compat+key are ready; never via Automatic',()=>{
  const offline={finish:true,qwen:{available:false,reason:'n/a'}};
  assert.equal(describeEngines(offline).find(e=>e.id==='flux3-cloud')?.available,false);
  assert.throws(()=>resolveGenerationEngine('flux3-cloud',offline),/Comfy Cloud/);
  const armed={
    ...offline,
    flux3Cloud:{available:true,authorized:true,status:'available',reason:'ready'},
  };
  assert.equal(resolveGenerationEngine('flux3-cloud',armed).id,'flux3-cloud');
  assert.notEqual(resolveGenerationEngine('automatic',armed).id,'flux3-cloud');
});

test('Duplicate Cloud receipt claim is fail-closed in API source',()=>{
  assert.match(api,/already submitted\. Check saved results; no second billable job was created/);
  assert.match(api,/flag:'wx'/);
  assert.doesNotMatch(api,/wantFlux3Cloud[\s\S]{0,800}renderProductSafe|wantFlux3Cloud[\s\S]{0,800}editorial-original/);
});

test('Cloud jobs use their own one-at-a-time queue; local Qwen busy refusals name the running work',()=>{
  assert.match(api,/await serializeCloud\(async\(\)=>\{[\s\S]{0,600}renderFlux3ComfyCloudScene\(/);
  assert.doesNotMatch(api,/await serialize\(async\(\)=>\{[\s\S]{0,600}renderFlux3ComfyCloudScene\(/);
  assert.match(api,/Local Qwen is still finishing another text job \(website brand analysis or a creative plan\)/);
  assert.match(api,/textJobs\+\+;const text=await creativeSDKText\([\s\S]{0,900}\.finally\(\(\)=>\{textJobs--;\}\)/);
});
