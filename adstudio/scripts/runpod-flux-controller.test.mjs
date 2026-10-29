/** CPU tests for one-click FLUX RunPod controller — no live create/terminate. */
import {strict as assert} from 'node:assert';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gateFluxSpend,fluxBudgetFromEnv,estimateFluxJobUSD,liveProvisionAuthorized,autoprovEnabled} from '../../shared/runtime/runpod-flux-budget.ts';
import {planFluxProvision,ensureFluxGpuSession,isFluxPodName,detectHealthyFluxComfy} from '../../shared/runtime/runpod-flux-controller.ts';

const pins = {
  budgetDefaults: {protectedReserveUSD: 2.96, maxJobUSD: 0.5, maxSessionUSD: 0.5, maxLeaseSeconds: 2400, idleReleaseSeconds: 180},
  gpu: {hourlyUSD: 0.59},
  storage: {storageHourlyBoundUSD: 0.02},
};

{
  const budget = fluxBudgetFromEnv(pins, {});
  assert.equal(budget.protectedReserveUSD, 2.96);
  assert.ok(estimateFluxJobUSD(budget) <= budget.maxJobUSD + 0.01);
  const blocked = gateFluxSpend(3.56, 0, false, budget);
  // 3.56 - 2.96 = 0.60 spendable; estimate for 2400s * 0.61/hr ≈ 0.407 → should pass
  assert.equal(blocked.ok, true, blocked.reason);
  const reserve = gateFluxSpend(3.0, 0, false, budget);
  assert.equal(reserve.ok, false);
  assert.match(reserve.reason, /Spendable|reserve/i);
  assert.equal(gateFluxSpend(10, 0, true, budget).ok, false);
  assert.equal(gateFluxSpend(10, 0.5, false, budget).ok, false);
}

assert.equal(liveProvisionAuthorized({}), false);
assert.equal(liveProvisionAuthorized({ADSTUDIO_RUNPOD_LIVE: '1', ADSTUDIO_FLUX3_SPEND_APPROVED: '1'}), true);
assert.equal(autoprovEnabled({ADSTUDIO_FLUX3_AUTOPROVISION: '1'}), true);
assert.equal(isFluxPodName('adstudio-flux3-2026'), true);
assert.equal(isFluxPodName('adstudio-qwen2511-x'), false);

{
  const planned = await planFluxProvision({
    ADSTUDIO_RUNPOD_BALANCE_HINT: '3.56',
    ADSTUDIO_FLUX3_AUTOPROVISION: '1',
  });
  assert.equal(planned.live, false);
  assert.ok(planned.plan.createBlockedReason);
  assert.match(String(planned.plan.createBlockedReason), /Dry-run|ADSTUDIO_RUNPOD_LIVE/);
  assert.equal(planned.gate.ok, true);
}

{
  const dir = await mkdtemp(join(tmpdir(), 'flux-runpod-'));
  try {
    const session = await ensureFluxGpuSession({
      env: {
        ADSTUDIO_FLUX3_AUTOPROVISION: '1',
        ADSTUDIO_FLUX3_SESSION_DIR: dir,
        ADSTUDIO_RUNPOD_BALANCE_HINT: '3.56',
        COMFYUI_URL: 'http://127.0.0.1:9',
      },
      fetchImpl: async () => { throw new Error('offline'); },
    });
    assert.equal(session.mode, 'dry-run');
    assert.equal(session.stage, 'Preparing GPU');
    assert.ok(session.plan.dryRun);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
}

{
  const healthy = await detectHealthyFluxComfy(
    {COMFYUI_URL: 'http://127.0.0.1:9'},
    async () => { throw new Error('refused'); },
  );
  assert.equal(healthy.ok, false);
}

console.log('runpod-flux-controller.test.mjs: PASS');

import test from 'node:test';
import {readFile,access} from 'node:fs/promises';
import {releaseFluxGpuSession,recoverFluxIntent,workerProfile} from '../../shared/runtime/runpod-flux-controller.ts';
import {loadFlux3Workflow} from '../../shared/runtime/flux3-klein-scene.ts';
const graph=(await loadFlux3Workflow('mi2i')).graph;
const nodes=Object.fromEntries(Object.values(graph).map(n=>[n.class_type,{input:{required:{}}}]));
for(const n of Object.values(graph))for(const [k,v] of Object.entries(n.inputs||{}))if(!Array.isArray(v)&&!(n.class_type==='LoadImage'&&k==='image')){const choices=nodes[n.class_type].input.required[k]||[[]];if(!choices[0].includes(v))choices[0].push(v);nodes[n.class_type].input.required[k]=choices;}
const stats={system:{comfyui_version:'0.42.4',ram_free:64*1024**3},devices:[{type:'cuda',vram_free:40*1024**3,torch_vram_total:0,torch_vram_free:0}]};
const healthyFetch=async u=>new Response(JSON.stringify(String(u).endsWith('/object_info')?nodes:String(u).endsWith('/queue')?{queue_running:[],queue_pending:[]}:stats));
async function fixture(){
 const dir=await mkdtemp(join(tmpdir(),'flux-owned-'));await writeFile(join(dir,'key'),'test-only');await writeFile(join(dir,'key.pub'),'ssh-ed25519 CPU-only');
 const env={ADSTUDIO_FLUX3_SESSION_DIR:dir,ADSTUDIO_FLUX3_AUTOPROVISION:'1',ADSTUDIO_FLUX3_INFERENCE:'1',ADSTUDIO_RUNPOD_LIVE:'1',ADSTUDIO_FLUX3_SPEND_APPROVED:'1',RUNPOD_API_KEY:'CPU-ONLY-NOT-A-KEY',COMFYUI_URL:'http://127.0.0.1:9',ADSTUDIO_RUNPOD_SSH_KEY:join(dir,'key'),ADSTUDIO_FLUX3_WORKER_IMAGE:'example/flux@sha256:'+'a'.repeat(64),ADSTUDIO_FLUX3_WORKER_MODELS_DIR:'/opt/ComfyUI/models',ADSTUDIO_FLUX3_WORKER_ARGS_JSON:'["/start-private-flux"]'};
 let pod=null;const calls=[],stages=[];let fileChecks=0,tunnelStops=0;
 const http=async(path,init={})=>{calls.push({path,...init});if(path==='graphql')return {status:200,json:{data:{myself:{clientBalance:3.56,currentSpendPerHr:0,isAutoPayEnabled:false}}}};if(path.startsWith('/catalog/'))return {status:200,json:{price:{secure:0.59},dataCenters:[{id:'US-TEST',availability:'HIGH'}]}};if(path==='/pods'&&init.method==='POST'){pod={id:'cpu-pod',name:init.body.name,status:'RUNNING',cost:0.59,locked:false,ssh:{direct:{host:'192.0.2.1',port:12345,username:'root'}}};return {status:201,json:pod};}if(path==='/pods')return {status:200,json:{pods:pod?[pod]:[],pagination:{hasNextPage:false}}};if(path==='/pods/cpu-pod'&&init.method==='DELETE'){pod=null;return {status:204,json:null};}if(path==='/pods/cpu-pod')return {status:pod?200:404,json:pod};throw Error('Unexpected mock route '+path);};
 const deps={verifyFiles:async()=>{fileChecks++;},tunnel:async()=>({stop:async()=>{tunnelStops++;}}),waitReady:async()=>stats,watchdog:()=>undefined,sleep:async()=>{}};
 const opts={env,httpFactory:()=>http,fetchImpl:async u=>String(u).includes(':9/')?Promise.reject(Error('No local FLUX')):healthyFetch(u),onStage:(stage,detail)=>stages.push({stage,detail}),deps};
 return {dir,env,http,opts,calls,stages,deps,get pod(){return pod;},get fileChecks(){return fileChecks;},get tunnelStops(){return tunnelStops;},close:()=>rm(dir,{recursive:true,force:true})};
}
test('live planning cannot use a balance hint when account read fails',async()=>{const f=await fixture();try{const r=await planFluxProvision(f.env,()=>async()=>({status:503,json:{}}));assert.equal(r.plan.balance.verified,false);assert.match(r.plan.createBlockedReason,/balance/);}finally{await f.close();}});
test('lease estimate cannot be truncated to evade a smaller ceiling',()=>{const b=fluxBudgetFromEnv(pins,{ADSTUDIO_RUNPOD_MAX_JOB_USD:'0.01'});assert.equal(gateFluxSpend(3.56,0,false,b).ok,false);assert.throws(()=>fluxBudgetFromEnv(pins,{ADSTUDIO_RUNPOD_MAX_JOB_USD:'1'}));assert.throws(()=>fluxBudgetFromEnv(pins,{ADSTUDIO_RUNPOD_PROTECTED_RESERVE_USD:'0'}));assert.equal(gateFluxSpend(NaN,0,false,b).ok,false);});
test('explicit dry-run remains mutation-free even with all live flags',async()=>{const f=await fixture();try{const r=await ensureFluxGpuSession({...f.opts,dryRunOnly:true});assert.equal(r.mode,'dry-run');assert.equal(f.calls.some(c=>c.method==='POST'&&c.path==='/pods'||c.method==='DELETE'),false);assert.equal(f.fileChecks,0);}finally{await f.close();}});
test('a healthy server without FLUX model choices is rejected',async()=>{const r=await detectHealthyFluxComfy({COMFYUI_URL:'http://127.0.0.1:9'},async u=>new Response(JSON.stringify(String(u).endsWith('/object_info')?{}:String(u).endsWith('/queue')?{queue_running:[],queue_pending:[]}:stats)));assert.equal(r.ok,false);assert.match(r.reason,/Missing/);});
test('node filename mismatch and insufficient host RAM fail readiness',async()=>{const wrong=structuredClone(nodes);wrong.UNETLoader.input.required.unet_name=[['qwen-only.safetensors']];const r=await detectHealthyFluxComfy({COMFYUI_URL:'http://127.0.0.1:9'},async u=>new Response(JSON.stringify(String(u).endsWith('/object_info')?wrong:String(u).endsWith('/queue')?{queue_running:[],queue_pending:[]}:stats)));assert.equal(r.ok,false);assert.match(r.reason,/UNETLoader/);const low=structuredClone(stats);low.system.ram_free=2*1024**3;const lowResult=await detectHealthyFluxComfy({COMFYUI_URL:'http://127.0.0.1:9'},async u=>new Response(JSON.stringify(String(u).endsWith('/object_info')?nodes:String(u).endsWith('/queue')?{queue_running:[],queue_pending:[]}:low)));assert.equal(lowResult.ok,false);});
test('public Comfy URL is rejected before any fetch',async()=>{let calls=0;const r=await detectHealthyFluxComfy({COMFYUI_URL:'https://example.com'},async()=>{calls++;});assert.equal(r.ok,false);assert.equal(calls,0);});
test('prepared-worker configuration is mandatory before provisioning',async()=>{const f=await fixture();try{delete f.env.ADSTUDIO_FLUX3_WORKER_IMAGE;assert.equal(workerProfile(f.env).valid,false);const s=await ensureFluxGpuSession(f.opts);assert.equal(s.mode,'dry-run');assert.match(s.plan.createBlockedReason,/WORKER_IMAGE/);assert.equal(f.calls.some(c=>c.path==='/pods'&&c.method==='POST'),false);}finally{await f.close();}});
test('successful mocked lease uses schema-correct private create and teardown even after flags clear',async()=>{const f=await fixture();try{const session=await ensureFluxGpuSession(f.opts);assert.equal(session.mode,'provisioned');assert.equal(session.plan.modelStorageVerified,true);assert.equal(f.fileChecks,1);const body=f.calls.find(c=>c.path==='/pods'&&c.method==='POST').body;assert.deepEqual(body.ports,['22/tcp']);assert.ok(Array.isArray(body.cmd));assert.equal(body.args,undefined);assert.equal(body.gpu.minCudaVersion,'12.8');assert.equal(JSON.stringify(body).includes(f.env.RUNPOD_API_KEY),false);const result=await releaseFluxGpuSession(session,{...f.env,ADSTUDIO_RUNPOD_LIVE:'0',ADSTUDIO_FLUX3_SPEND_APPROVED:'0'},()=>f.http);assert.equal(result.terminated,true);assert.equal(f.pod,null);assert.equal(f.tunnelStops,1);await assert.rejects(access(join(f.dir,'intent.json')));}finally{await f.close();}});
test('SSH opening failure tears down the exact created Pod',async()=>{const f=await fixture();try{f.deps.tunnel=async()=>{throw Error('mock tunnel failed');};await assert.rejects(ensureFluxGpuSession(f.opts),/tunnel failed/);assert.equal(f.pod,null);assert.ok(f.calls.some(c=>c.method==='DELETE'));}finally{await f.close();}});
test('missing remote model files fail before native upload and release the Pod',async()=>{const f=await fixture();try{f.deps.verifyFiles=async()=>{throw Error('missing weights');};await assert.rejects(ensureFluxGpuSession(f.opts),/missing weights/);assert.equal(f.pod,null);assert.equal(f.tunnelStops,1);}finally{await f.close();}});
test('cancellation during model checks cleans up; cancellation before create does not provision',async()=>{const f=await fixture();try{const c=new AbortController();f.deps.verifyFiles=async()=>{c.abort(Error('owner cancelled'));throw c.signal.reason;};await assert.rejects(ensureFluxGpuSession({...f.opts,signal:c.signal}),/cancelled/);assert.equal(f.pod,null);const count=f.calls.length;await assert.rejects(ensureFluxGpuSession({...f.opts,signal:c.signal}));assert.equal(f.calls.length,count);}finally{await f.close();}});
test('persisted cleanup refuses a changed resource identity',async()=>{const f=await fixture();try{const session=await ensureFluxGpuSession(f.opts),path=join(f.dir,'intent.json'),intent=JSON.parse(await readFile(path,'utf8'));await writeFile(path,JSON.stringify({...intent,name:'adstudio-flux3-another-owner'}));await assert.rejects(recoverFluxIntent(f.env,()=>f.http),/ownership mismatch/);assert.ok(f.pod);await writeFile(path,JSON.stringify(intent));assert.equal((await releaseFluxGpuSession(session,f.env,()=>f.http)).terminated,true);}finally{await f.close();}});
test('ambiguous create retains the intent and does not silently authorize retry',async()=>{const f=await fixture();try{const http=async(path,init={})=>{if(path==='/pods'&&init.method==='POST')throw Error('network timeout');return f.http(path,init);};await assert.rejects(ensureFluxGpuSession({...f.opts,httpFactory:()=>http}),/outcome uncertain/);await access(join(f.dir,'intent.json'));assert.equal(f.pod,null);}finally{await f.close();}});

test('conservative persisted session ledger prevents a second paid lease',async()=>{const f=await fixture();try{const s=await ensureFluxGpuSession(f.opts);await releaseFluxGpuSession(s,f.env,()=>f.http);const r=await ensureFluxGpuSession(f.opts);assert.equal(r.mode,'dry-run');assert.match(r.plan.createBlockedReason,/Session budget/);assert.equal(f.calls.filter(c=>c.path==='/pods'&&c.method==='POST').length,1);}finally{await f.close();}});

test('full ceiling is protected despite an optimistic lease estimate',()=>{const b=fluxBudgetFromEnv(pins,{});assert.equal(gateFluxSpend(3.40,0,false,b).ok,false);assert.throws(()=>fluxBudgetFromEnv(pins,{ADSTUDIO_RUNPOD_STORAGE_HOURLY_USD:'0'}));assert.throws(()=>fluxBudgetFromEnv(pins,{ADSTUDIO_RUNPOD_GPU_HOURLY_USD:'0.01'}));});

test('a stale watchdog token cannot tear down a newer lease',async()=>{const f=await fixture();try{const session=await ensureFluxGpuSession(f.opts);await assert.rejects(recoverFluxIntent(f.env,()=>f.http,session.intentPath,'f'.repeat(32)),/older lease/);assert.ok(f.pod);await releaseFluxGpuSession(session,f.env,()=>f.http);}finally{await f.close();}});
