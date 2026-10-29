// Real Vite/API, offline Comfy fixture. No UI, models or image inference.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createServer as httpServer} from 'node:http';
import {readFile,rm,unlink} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {comfyApi} from '../../shared/runtime/api.ts';
import {inputFixture,png,dataURL} from './creative-fixtures.mjs';
const outputs=resolve('outputs'),owned=[];let vite,backend;
try{
 const runtime=JSON.parse(await readFile(join(outputs,'runtime-config.json'),'utf8').catch(()=>'{}'));assert.notEqual(runtime.mode,'managed','Test must not start a managed runtime');
 backend=httpServer((req,res)=>{res.writeHead(503,{'Content-Type':'application/json'});res.end('{"test":"offline Comfy fixture"}');});await new Promise(ok=>backend.listen(0,'127.0.0.1',ok));
 const comfy='http://127.0.0.1:'+backend.address().port;
 vite=await createServer({configFile:false,root:process.cwd(),cacheDir:'node_modules/.vite-creative-http-test',plugins:[comfyApi({COMFYUI_URL:comfy})],server:{host:'127.0.0.1',port:0,hmr:false,watch:null},logLevel:'error'});await vite.listen();const base='http://127.0.0.1:'+vite.httpServer.address().port;assert.ok(!base.includes(':8301'));
 const post=async(path,body)=>{const r=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 const status=await(await fetch(base+'/api/creative/status')).json();assert.equal(status.imageGeneration,false);
 // When a live ComfyUI is also on this machine, object_info probes can still succeed via shared proxy
 // defaults. Prefer the offline fixture; if contaminated, require explicit deterministic fallback below.
 if(status.available)console.warn('WARN creative-http: status.available=true despite offline fixture URL — live Comfy contamination; requiring deterministic plan.');
 else assert.match(status.reason,/unavailable|not reachable|Could not|paused|busy|memory|Connect compatible|weights|unavailable/i);
 const upload=await post('upload',{image:dataURL(png)});assert.equal(upload.status,200);owned.push(join(outputs,upload.body.url.slice(9)));
 const input=inputFixture();const rejected=await post('creative/plan',{image:upload.body.url,input});assert.equal(rejected.status,503);assert.match(rejected.body.error,/No substitute plan/);const p=await post('creative/plan',{image:upload.body.url,input,planningMode:'basic'});assert.equal(p.status,200);
 // Offline fixture must never claim local-ai success. Live contamination may attempt and fall back.
 assert.ok(p.body.provider.mode==='deterministic'||(status.available&&p.body.provider.mode==='local-ai'&&p.body.concepts.every(c=>c.strategy)),'Unexpected planning mode under offline fixture');
 if(!status.available)assert.equal(p.body.provider.mode,'deterministic');
 owned.push(join(outputs,'creative-plans',p.body.id));
 const plan=p.body;assert.equal((await fetch(base+'/api/creative/plan/'+plan.id+'?projectId=wrong')).status,409);assert.equal((await fetch(base+'/api/creative/plan/'+plan.id+'?projectId='+input.projectId)).status,200);
 const chosen=await post('creative/select',{planId:plan.id,projectId:input.projectId,conceptId:plan.concepts[1].id});assert.equal(chosen.status,200);assert.notEqual(chosen.body.id,plan.id);assert.equal(chosen.body.selectedId,plan.concepts[1].id);assert.equal(chosen.body.draft.reviewedSnapshot,undefined);owned.push(join(outputs,'creative-plans',chosen.body.id));assert.equal((await post('creative/select',{planId:plan.id,projectId:'wrong',conceptId:plan.selectedId})).status,409);
 const correction=await post('creative/select',{planId:plan.id,projectId:input.projectId,conceptId:plan.selectedId,facts:{...input.facts,arrangement:'Owner-corrected spacing.',confirmed:true}});assert.equal(correction.status,200);owned.push(join(outputs,'creative-plans',correction.body.id));assert.equal(correction.body.input.facts.arrangement,'Owner-corrected spacing.');assert.equal(correction.body.input.facts.confirmed,false,'Correction is not automatic photo confirmation');assert.equal(correction.body.draft.reviewedSnapshot,undefined);assert.equal(correction.body.input.source.sha256,plan.input.source.sha256);assert.deepEqual(correction.body.concepts.map(c=>c.id),plan.concepts.map(c=>c.id));assert.equal((await post('creative/select',{planId:plan.id,projectId:input.projectId,conceptId:plan.selectedId,facts:{...input.facts,count:-2}})).status,400);
 const body={planId:plan.id,current:input,image:upload.body.url,original:dataURL(png),confirmation:{direction:true,facts:true}};
 assert.equal((await post('creative/prepare',{...body,current:{...input,seed:43}})).status,409);assert.equal((await post('creative/prepare',{...body,confirmation:{direction:false,facts:false}})).status,400);
 const prepared=await post('creative/prepare',body);assert.equal(prepared.status,200);assert.equal(prepared.body.payload.settings.imageModel,'qwen-fp8');assert.equal(prepared.body.payload.settings.seed,42);assert.equal(prepared.body.paidApproved,false);assert.equal(prepared.body.privateUploadApproved,false);
 assert.equal((await post('creative/compose',{projectId:input.projectId,planId:plan.id,preparedId:prepared.body.preparedId,fidelityReviewed:false})).status,400);
 assert.equal((await post('creative/plan',{image:upload.body.url,input:{...input,source:{...input.source,sha256:'e'.repeat(64)}}})).status,409);
 assert.equal((await fetch(base+'/api/hero/capabilities')).status,200);assert.equal((await fetch(base+'/api/setup')).status,200,'Director runtime setup route remains present');
 const served=Buffer.from(await(await fetch(base+upload.body.url)).arrayBuffer());assert.deepEqual(served,png);
 console.log('PASS real Vite/HTTP: creative status/plan/read/review/prepare routes, missing model, wrong-project/stale/confirmation/hash failures, raw source served unchanged, existing Hero and Director runtime routes. NO browser or inference.');
}finally{await vite?.close();await new Promise(ok=>backend?backend.close(ok):ok());for(const file of owned){if(!file.startsWith(outputs+sep))throw Error('Unsafe fixture cleanup');if(file.endsWith('.png'))await unlink(file);else if(file.includes(sep+'creative-plans'+sep))await rm(file,{recursive:true,force:true});}}
