// CPU admission/receipt regressions. No real inference or owner browser storage.
import assert from 'node:assert/strict';
import {createServer as httpServer} from 'node:http';
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {creativeTextReadiness,creativeTextDeadlineMs,waitCreativeTextJob,textDeadlineError} from '../../shared/runtime/creative-engine.ts';
import {createBrandService} from '../../shared/runtime/brand-service.ts';
import {comfyApi} from '../../shared/runtime/api.ts';
import {catalogFixture} from './catalog-fixtures.mjs';
import {textNodesFixture} from './creative-fixtures.mjs';
const gib=1024**3,nodes=textNodesFixture(),queue={queue_running:[],queue_pending:[]},stats={system:{ram_free:8*gib},devices:[{type:'cuda',vram_free:8*gib,torch_vram_total:gib,torch_vram_free:gib/2}]};
assert.equal(creativeTextDeadlineMs,90000);
assert.equal(textDeadlineError(Error('job example not terminal after 90000ms (status=running)')),true);
assert.equal(textDeadlineError(Error('Invalid brand-analysis line.')),false);
let waits=0,results=0;const short=AbortSignal.timeout(15),keepAlive=setTimeout(()=>{},100);
try{await assert.rejects(()=>waitCreativeTextJob({wait:async(ms,signal)=>{waits++;assert.equal(ms,90000);assert.equal(signal,short);await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));},result:async()=>{results++;}},short),/timeout/i);}finally{clearTimeout(keepAlive);}
assert.equal(waits,1);assert.equal(results,0,'An aborted polling call cannot start result polling or another submission');
const signal=new AbortController().signal;await waitCreativeTextJob({wait:async(ms,s)=>{assert.equal(s,signal);waits++;},result:async s=>{assert.equal(s,signal);results++;}},signal);assert.equal(waits,2);assert.equal(results,1);
// Execute the actual shared runner with the narrow text hooks, SDK doubles and
// a short injected test signal. Production always supplies the 180-second one.
const apiSource=await readFile('shared/runtime/api.ts','utf8'),runSource=apiSource.slice(apiSource.indexOf('async function runWf('),apiSource.indexOf('// One job at a time'));
const runWorkflow=Function('ctx','with(ctx){'+stripTypeScriptTypes(runSource,{mode:'transform'})+';return runWf}')({activity:{update(){},note(){}},diagnostics:{},clientUrls:new WeakMap(),phaseForProgress:()=>'',loadingLog:()=>null,nodeProgressMessage:()=>null});
let submits=0,cancels=0,diagnosed=0;const sdk={submit:async()=>{submits++;return {id:'exact-synthetic-text',events:async function*(){},wait:async(ms,s)=>new Promise((_,reject)=>s.addEventListener('abort',()=>reject(s.reason),{once:true})),result:async()=>assert.fail('No result after deadline'),cancel:async()=>{cancels++;}};}};
const retained=setTimeout(()=>{},100);try{await assert.rejects(()=>runWorkflow(sdk,{json:{}},undefined,false,90000,{wait:j=>waitCreativeTextJob(j,AbortSignal.timeout(15)),failed:async(j,error,_started,cancellation)=>{diagnosed++;assert.equal(j.id,'exact-synthetic-text');assert.match(cancellation,/not proof of termination/);return error;}}),/timeout/i);}finally{clearTimeout(retained);}
assert.equal(submits,1);assert.equal(cancels,1);assert.equal(diagnosed,1);
assert.equal(creativeTextReadiness(nodes,queue,stats).available,true);
assert.equal(creativeTextReadiness(nodes,queue,stats,true).available,false);
assert.match(creativeTextReadiness(nodes,{...queue,queue_running:[[1,'other-job']]},stats).reason,/busy \(1 running/);
assert.equal(creativeTextReadiness(nodes,{...queue,queue_pending:[[1,'pending']]},stats).available,false);
assert.equal(creativeTextReadiness(nodes,null,stats).available,false);
assert.equal(creativeTextReadiness(nodes,queue,null).available,false);
assert.equal(creativeTextReadiness({},queue,stats).available,false);
const pressure={...stats,devices:[{...stats.devices[0],vram_free:gib,torch_vram_total:64*1024**2,torch_vram_free:58*1024**2}]};
assert.match(creativeTextReadiness(nodes,queue,pressure).reason,/memory pressure.*no text job submitted/i);
const occupied={...stats,devices:[{...stats.devices[0],vram_free:gib,torch_vram_total:6*gib,torch_vram_free:0}]};
assert.equal(creativeTextReadiness(nodes,queue,occupied).available,true,'Comfy-owned occupied memory is reclaimable; another app memory is not');
assert.equal(creativeTextReadiness(nodes,queue,{...stats,system:{ram_free:gib}}).available,false);
const f=catalogFixture(),site=f.base+'/collections/perfumes';let clock=1000,calls=0;
const answer=['tone | source-1 | Suggest a calm and welcoming voice for the supplied fragrance catalog.','visualStyle | source-1 | Propose restrained surroundings and clear material edges around the unchanged reference product.','audience | source-1 | Hypothesis: fragrance shoppers may appreciate readable descriptions of the listed products.','guidelines | source-1 | Keep product names accurate and avoid unsupported claims in the advertisement.'].join('\n');
const backend={status:async()=>({available:true,model:'MOCK Qwen3',reason:'Synthetic CPU test'}),generate:async()=>{calls++;if(calls===1)throw Error('Timed out waiting for job; text job synthetic-id, native running, cancellation requested. No retry.');return answer;}};
const service=createBrandService({},backend,f.read,()=>clock),input={website:site,deferAnalysis:true};
const first=await service.discover(input),failed=await service.analyze({key:first.analysisKey});assert.equal(failed.analysisState,'failed');assert.match(failed.warnings.join(' '),/180-second deadline.*synthetic-id/);
assert.deepEqual(await service.analyze({key:first.analysisKey}),failed);assert.equal(calls,1);
const immediate=await service.discover(input);assert.equal(immediate.analysisState,'failed');await service.analyze({key:immediate.analysisKey});assert.equal(calls,1,'Failure cooldown prevents repeated rediscovery attempts');
clock+=60001;const fresh=await service.discover(input);assert.equal(fresh.analysisState,'pending');const pair=await Promise.all([service.analyze({key:fresh.analysisKey}),service.analyze({key:fresh.analysisKey})]);assert.equal(calls,2);assert.equal(pair[0].aiCompleted,true);assert.deepEqual(pair[0],pair[1]);
assert.deepEqual(await service.analyze({key:first.analysisKey}),failed,'An expired failure cache never retries the original receipt');assert.equal(calls,2);
const cached=await service.discover(input);assert.equal(cached.aiCompleted,true);assert.equal(calls,2);
let release;const gate=new Promise(ok=>release=ok),slow=createBrandService({}, {...backend,generate:async()=>{await gate;return answer;}},f.read),a=await slow.discover(input),pending=slow.analyze({key:a.analysisKey});
const same=await slow.discover(input),sameJob=slow.analyze({key:same.analysisKey});
const second=await slow.discover({...input,website:f.base+'/'}),busy=await slow.analyze({key:second.analysisKey});assert.equal(busy.analysisState,'unavailable');assert.match(busy.provider.reason,/busy/);release();assert.equal((await pending).aiCompleted,true);assert.equal((await sameJob).aiCompleted,true,'Identical in-flight evidence is deduplicated');
const malformed=createBrandService({}, {...backend,generate:async()=>'<untrusted malformed response>'},f.read),m=await malformed.discover(input),invalid=await malformed.analyze({key:m.analysisKey});assert.equal(invalid.analysisState,'failed');assert.equal(invalid.aiCompleted,false);assert.equal(invalid.analysisRaw,'<untrusted malformed response>');assert.equal(invalid.observations.some(o=>o.kind==='inference'),false);
// Real Vite API against an explicitly MOCK native runtime. Never submit a job.
let nativeQueue={...queue,queue_running:[[1,'another-developer-job']]},nativeStats=stats,submissions=0,vite;
const native=httpServer((req,res)=>{let value;if(req.method==='POST'){submissions++;res.writeHead(500);res.end('{}');return;}if(req.url==='/object_info')value=nodes;else if(req.url==='/queue')value=nativeQueue;else if(req.url==='/system_stats')value=nativeStats;else value={status:'ok'};res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));});
try{
 await new Promise(ok=>native.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+native.address().port;
 vite=await createServer({configFile:false,root:process.cwd(),plugins:[comfyApi({COMFYUI_URL:base,COMFY_BASE_URL:base})],server:{host:'127.0.0.1',port:0,hmr:false,watch:null},logLevel:'error'});await vite.listen();const api='http://127.0.0.1:'+vite.httpServer.address().port;
 let s=await(await fetch(api+'/api/brand/status')).json();assert.equal(s.available,false);assert.match(s.reason,/busy/);
 nativeQueue=queue;nativeStats=pressure;s=await(await fetch(api+'/api/creative/status')).json();assert.equal(s.available,false);assert.match(s.reason,/memory pressure/);
 nativeStats=stats;s=await(await fetch(api+'/api/brand/status')).json();assert.equal(s.available,true);assert.equal(s.provider,'comfy-qwen3');assert.equal(submissions,0);
 console.log('PASS Qwen text admission (native queue/memory/offline), unchanged 180s bound, one attempt/receipt, short failure cooldown and explicit rediscovery recovery, in-flight dedup, fail-fast competing evidence, raw invalid output quarantine, real Vite status. MOCK CPU only.');
}finally{await vite?.close();await new Promise(ok=>native.close(ok));}
