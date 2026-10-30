// Nonbillable Comfy Cloud FLUX unit tests. Never contacts cloud.comfy.org.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {
  adaptFlux3GraphForComfyCloud,
  assertComfyCloudSourceAuthorized,
  comfyCloudFluxAvailability,
  executeFlux3ComfyCloud,
} from '../../shared/runtime/comfy-cloud-flux.ts';
import {loadFlux3Workflow,bindFlux3Mi2iInputs} from '../../shared/runtime/flux3-klein-scene.ts';
import {createComfyCloudClient,COMFY_CLOUD_BASE_URL} from '../../shared/runtime/comfy-cloud-client.ts';
import {images} from './website-fixtures.mjs';

const baseEnv={
  ADSTUDIO_COMFY_CLOUD_ENABLED:'1',
  ADSTUDIO_COMFY_CLOUD_COMPAT_CONFIRMED:'1',
  ADSTUDIO_COMFY_CLOUD_SPEND_APPROVED:'0',
  COMFY_API_KEY:'comfyui-test-key-not-real',
};

test('Cloud availability stays closed without spend and without inventing readiness from a key alone',async()=>{
  const keyOnly=await comfyCloudFluxAvailability({COMFY_API_KEY:'comfyui-x',ADSTUDIO_COMFY_CLOUD_ENABLED:'0'});
  assert.equal(keyOnly.available,false);
  assert.match(keyOnly.reason,/disabled/i);
  const noSpend=await comfyCloudFluxAvailability(baseEnv);
  assert.equal(noSpend.available,false);
  assert.equal(noSpend.credentialsReady,true);
  assert.equal(noSpend.compatConfirmed,true);
  assert.equal(noSpend.spendApproved,false);
  assert.match(noSpend.reason,/spend is disabled/i);
  const ready=await comfyCloudFluxAvailability({...baseEnv,ADSTUDIO_COMFY_CLOUD_SPEND_APPROVED:'1'});
  assert.equal(ready.available,true);
  assert.equal(ready.endpoint,COMFY_CLOUD_BASE_URL);
  assert.equal(ready.partnerNodeForbidden,true);
  assert.equal(ready.weightProfile,'int8');
  assert.ok(ready.weightAdaptation.length>=1);
});

test('BF16 pin remaps to Cloud int8 template names without changing topology',async()=>{
  const {graph}=await loadFlux3Workflow('mi2i');
  const bound=bindFlux3Mi2iInputs(graph,{prompt:'p',seed:1,sourceImage:'a.png',identityImage:'b.png'},{});
  const adapted=adaptFlux3GraphForComfyCloud(bound,{ADSTUDIO_COMFY_CLOUD_WEIGHT_PROFILE:'int8'});
  assert.equal(adapted.graph['1'].inputs.unet_name,'flux3-image-klein-int8-convrot.safetensors');
  assert.equal(adapted.graph['2'].inputs.clip_name,'qwen3vl_4b_int8_convrot.safetensors');
  assert.equal(adapted.graph['3'].inputs.vae_name,'flux2-vae.safetensors');
  assert.equal(adapted.graph['11'].class_type,'LoadImage');
  assert.equal(adapted.graph['111'].class_type,'LoadImage');
  assert.equal(adapted.graph['9'].class_type,'SaveImage');
  const keep=adaptFlux3GraphForComfyCloud(bound,{ADSTUDIO_COMFY_CLOUD_WEIGHT_PROFILE:'bf16'});
  assert.equal(keep.graph['1'].inputs.unet_name,'flux3-image-klein-bf16.safetensors');
  assert.equal(keep.changes.length,0);
});

test('Cloud upload requires an exact authorized source hash',()=>{
  assert.throws(()=>assertComfyCloudSourceAuthorized('a'.repeat(64),{}),/not authorized|No product photograph/i);
  assert.throws(()=>assertComfyCloudSourceAuthorized('a'.repeat(64),{ADSTUDIO_COMFY_CLOUD_SOURCE_SHA256:'b'.repeat(64)}),/not authorized/i);
  assert.doesNotThrow(()=>assertComfyCloudSourceAuthorized('a'.repeat(64),{ADSTUDIO_COMFY_CLOUD_SOURCE_SHA256:'a'.repeat(64)}));
  assert.doesNotThrow(()=>assertComfyCloudSourceAuthorized('a'.repeat(64),{ADSTUDIO_COMFY_CLOUD_SOURCE_POLICY:'reviewed'}),'reviewed policy defers to the reviewed-brief binding');
  assert.throws(()=>assertComfyCloudSourceAuthorized('a'.repeat(64),{ADSTUDIO_COMFY_CLOUD_SOURCE_POLICY:'anything'}),/not authorized|No product photograph/i);
});

test('Isolated Cloud client construction does not leave COMFY_BASE_URL pointing at Cloud',()=>{
  process.env.COMFY_BASE_URL='http://127.0.0.1:8189';
  const c=createComfyCloudClient({apiKey:'comfyui-test'});
  assert.ok(c);
  assert.equal(process.env.COMFY_BASE_URL,'http://127.0.0.1:8189');
});

test('Mock Cloud submit uploads both refs once, uses idempotency key, and never auto-retries',async()=>{
  const dir=await mkdtemp(join(resolve('outputs'),'cloud-sdk-'));
  const source=join(dir,'source.png'),identity=join(dir,'identity.png');
  await writeFile(source,images[0]);await writeFile(identity,images[1]);
  const inputs=[];let submits=0;const keys=[];
  const c={
    workflows:{fromJson:g=>({json:g,setInput:(node,key,asset)=>inputs.push({node,key,asset})})},
    assets:{fromFile:file=>({file})},
    submit:async(_wf,opts)=>{
      submits++;keys.push(opts.idempotencyKey);
      return {
        id:'cloud-job-fixture',
        events:async function*(){},
        wait:async()=>{},
        result:async()=>{},
        getOutputs:()=>[{toBytes:async()=>images[2]}],
        cancel:async()=>{},
      };
    },
  };
  const {graph}=await loadFlux3Workflow('mi2i');
  const bound=bindFlux3Mi2iInputs(graph,{prompt:'cloud',seed:3,sourceImage:'s.png',identityImage:'i.png'},{ADSTUDIO_FLUX3_SKIP_PUP:'1'});
  const adapted=adaptFlux3GraphForComfyCloud(bound).graph;
  const out=await executeFlux3ComfyCloud(c,adapted,source,identity,'idem-fixed-1',new AbortController().signal);
  assert.equal(submits,1);
  assert.equal(keys[0],'idem-fixed-1');
  assert.deepEqual(inputs.map(i=>[i.node,i.asset.file]),[['11',source],['111',identity]]);
  assert.equal(out.promptId,'cloud-job-fixture');
  await rm(dir,{recursive:true,force:true});
});
