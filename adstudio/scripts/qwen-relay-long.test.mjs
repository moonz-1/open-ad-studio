// Deliberate >5min REAL HTTP wait through production Vite/API/relay. All image,
// model and Pod records are CPU-only fixtures; NO browser/SSH/GPU/provider calls.
import assert from 'node:assert/strict';
import {createServer as httpServer,request} from 'node:http';
import {createServer as tcpServer} from 'node:net';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat,rename} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
import {crc32} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {Resvg} from '@resvg/resvg-js';
import {generateQwenHero,qwenContract} from '../../shared/runtime/qwen-hero.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
import {heroDefaults} from '../../shared/lib/hero-ad.ts';
import {newGenerationDraft,briefDefaults,prepareConciseDraft,reviewDraft,generationPrompt} from '../../shared/lib/product-brief.ts';
import {heroTakeFromDelivery} from '../src/hero-delivery.ts';
import {Projects,newProject,memoryDriver} from '../src/projects.ts';
if(!process.argv.includes('--run-long')){console.log('DRY RUN: --run-long performs a 315-second local HTTP fixture test; no paid services.');process.exit(0);}
const delayMs=315000,root=process.cwd(),outputs=resolve('outputs'),fixture=await mkdtemp(join(outputs,'qwen-long-http-')),remote=join(fixture,'mock-backend');await mkdir(remote);
const evidence=join(fixture,'evidence');await mkdir(evidence);
const initialServer=await readFile(join(outputs,'hero-serve-audit/server.json')).catch(()=>null);
const png=new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64"><rect width="48" height="64" fill="orange"/></svg>').render().asPng();
const withPrompt=graph=>{const data=Buffer.from('prompt\0'+JSON.stringify(graph)),type=Buffer.from('tEXt'),chunk=Buffer.alloc(data.length+12);chunk.writeUInt32BE(data.length);type.copy(chunk,4);data.copy(chunk,8);chunk.writeUInt32BE(crc32(Buffer.concat([type,data])),data.length+8);return Buffer.concat([png.subarray(0,-12),chunk,png.subarray(-12)]);};
const sourceId=randomBytes(8).toString('hex'),sourcePath=join(outputs,sourceId+'.png'),image='/outputs/'+sourceId+'.png',hash=heroSha(png);
const input={version:1,source:{id:'CPU-source',name:'MOCK orange rectangle, not a product photo',sha256:hash,originalSha256:hash,kind:'original'},facts:{description:'CPU-only packaged box fixture',count:1,arrangement:'Centered',texture:'Printed paper',container:'Box',confirmed:true},productType:'packaged-goods',productName:'CPU fixture',notes:'TEST ONLY',brand:{id:'CPU-brand',name:'CPU fixture',revision:1,signals:[],evidence:[],colors:[]},controls:briefDefaults(),execution:{adapter:'qwen-fp8',seed:42}};
const draft=prepareConciseDraft(newGenerationDraft(input));reviewDraft(draft);
const settings={...heroDefaults().settings,method:'reimagine',imageModel:'qwen-fp8',sourceKind:'original',sourceId:'CPU-source',brandId:'CPU-brand',productName:'CPU fixture',seed:42,briefDraft:draft,prompt:generationPrompt(draft)};
const body={image,projectId:'CPU-project',original:'data:image/png;base64,'+png.toString('base64'),settings};
let app,backend,current,heartbeat,mode='long',submissions=0,uploads=0,executions=0,headerWaitMs=0,heartbeatCount=0;
const deliveries=[],cases=[],artifactPaths=new Set([sourcePath]);
const save=(path,data)=>writeFile(path,JSON.stringify(data,null,2));
const freePort=async()=>{const server=tcpServer();await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});const port=server.address().port;await new Promise(ok=>server.close(ok));assert.notEqual(port,8301);return port;};
// Built-in HTTP here represents a browser connection, avoiding the very Node
// fetch header limit under test on the harness->application connection too.
function post(base,id){return new Promise((ok,no)=>{const bytes=Buffer.from(JSON.stringify(body));const req=request(base+'/api/hero/qwen',{method:'POST',agent:false,headers:{'Content-Type':'application/json','Content-Length':bytes.length,'X-OSH-Request':id}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('error',no);res.on('end',()=>{try{ok({status:res.statusCode,data:JSON.parse(Buffer.concat(chunks).toString())});}catch(e){no(e);}});});req.on('error',no);const timer=setTimeout(()=>req.destroy(Error('Local test overall deadline')),390000);req.on('close',()=>clearTimeout(timer));req.end(bytes);});}
async function start(name){
 const folder=join(fixture,name),session=join(folder,'session');await mkdir(session,{recursive:true});const now=Date.now()/1000;
 const lease={version:1,podId:'CPU-ONLY-NOT-A-POD-'+name,name:'adstudio-qwen2511-CPU-MOCK',created:now-5,deadline:now+7000,cap:2,gpuRate:.59,storageHourly:.02,image:'runpod/comfyui@sha256:7ed65713a24c7c836cea8e5ba338ee140b0257b0a086cc3835784e0473efe2f2'};
 const plan={version:1,purpose:'qwen-app-acceptance',projectId:body.projectId,brandId:settings.brandId,sourceId:settings.sourceId,paidApproved:true,privateUploadApproved:true,podId:lease.podId,maxJobs:1,maxSpendUSD:2,reserveUSD:4,seed:42,browserOrigin:'http://127.0.0.1:1024',remoteOrigin:'http://127.0.0.1:28301',codeCommit:'a'.repeat(40),originalSha256:hash,referenceSha256:hash,promptSha256:heroSha(settings.prompt)};
 current={session,plan,lease};await save(join(session,'acceptance.json'),plan);await save(join(session,'lease.json'),lease);
 const beat=async()=>{const target=join(session,'pod-watchdog-ready.json'),temp=target+'.tmp';await save(temp,{podId:lease.podId,state:'armed',checked:Date.now()/1000,deadline:lease.deadline});await rename(temp,target);heartbeatCount++;};await beat();
 let beating=false;heartbeat=setInterval(()=>{if(!beating){beating=true;beat().finally(()=>beating=false);}},2000);
 process.env.QWEN_APP_RELAY_URL=plan.remoteOrigin;process.env.QWEN_APP_SESSION_DIR=session;process.env.COMFYUI_URL='http://127.0.0.1:28301';process.env.COMFY_BASE_URL='http://127.0.0.1:28301';
 app=await createServer({configFile:join(root,'vite.config.ts'),cacheDir:join(fixture,'vite-cache-'+name),server:{host:'127.0.0.1',port:await freePort(),hmr:false,strictPort:true},logLevel:'error'});await app.listen();
 const base='http://127.0.0.1:'+app.httpServer.address().port;assert.notEqual(app.httpServer.address().port,8301);plan.browserOrigin=base;await save(join(session,'acceptance.json'),plan);return base;
}
async function stop(){clearInterval(heartbeat);await app?.close();app=null;}
try{
 let runtime;try{runtime=JSON.parse(await readFile(join(outputs,'runtime-config.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}assert.notEqual(runtime?.mode,'managed','Do not start an unrelated Comfy runtime');
 for(const k of ['RUNPOD_API_KEY','QWEN_TERMINATION_KEY','HF_TOKEN','QWEN_APP_REMOTE_SESSION','OSH_TOKEN'])delete process.env[k];
 await writeFile(sourcePath,png,{flag:'wx'});const contract=await qwenContract();
 backend=httpServer(async(req,res)=>{try{let text='';for await(const c of req)text+=c;const json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
  if(req.url==='/object_info')return json({});if(req.url==='/models')return json([]);if(req.url==='/system_stats'){res.statusCode=503;return json({fixture:true});}
  if(req.url==='/api/hero/capabilities')return json({qwen:{available:true,fixture:true}});
  if(req.url==='/api/upload'){uploads++;assert.equal(heroSha(Buffer.from(JSON.parse(text).image.split(',')[1],'base64')),hash);await writeFile(join(remote,'aaaaaaaaaaaaaaaa.png'),png);return json({url:'/outputs/aaaaaaaaaaaaaaaa.png'});}
  if(req.url.startsWith('/api/activity/'))return json({phase:'generating',message:'CPU MOCK long response only',percent:null});
  if(req.url==='/api/hero/qwen'){
   submissions++;if(mode==='disconnect')return req.socket.destroy();if(mode==='malformed'){res.setHeader('Content-Type','application/json');return res.end('BROKEN JSON');}
   const start=performance.now();assert.equal(res.headersSent,false);await new Promise(ok=>setTimeout(ok,mode==='long'?delayMs:0));assert.equal(res.headersSent,false);headerWaitMs=performance.now()-start;
   const result=await generateQwenHero(JSON.parse(text),remote,{check:async()=>({available:true}),weights:async()=>contract.files,progress:()=>{},execute:async(graph,ref,path)=>{executions++;await writeFile(path,withPrompt(graph));return {jobId:'CPU-MOCK-NOT-INFERENCE-'+executions};}});deliveries.push(result);return json(result);
  }
  if(req.url.startsWith('/api/hero/qwen/provenance/'))return json(JSON.parse(await readFile(join(remote,'hero-qwen',req.url.split('/').pop(),'provenance.json'),'utf8')));
  if(/^\/outputs\/[a-f0-9]{16}\.png$/.test(req.url))return res.end(await readFile(join(remote,req.url.slice(9))));
  res.statusCode=404;json({fixture:true});
 }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}});
 await new Promise((ok,no)=>{backend.once('error',no);backend.listen(28301,'127.0.0.1',ok);});
 const base=await start('delayed-success'),requestId=randomBytes(16).toString('hex'),wallStart=Date.now(),monotonicStart=performance.now();
 console.log(JSON.stringify({event:'LONG_WAIT_STARTED',delayMs,wallStart,base,fixture,realViteAPI:true,backend:'CPU MOCK ONLY'}));
 const response=await post(base,requestId),elapsedMs=performance.now()-monotonicStart;assert.equal(response.status,200,JSON.stringify(response.data));assert.ok(headerWaitMs>310000);assert.ok(elapsedMs>310000);assert.ok(heartbeatCount>140);assert.equal(submissions,1);assert.equal(executions,1);
 const result=response.data;assert.equal(result.collectionVerified,true);const collected=JSON.parse(await readFile(join(current.session,'one-job.json.status.json'),'utf8'));assert.equal(collected.state,'collected');assert.equal(collected.files.length,5);
 for(const f of collected.files){assert.equal(heroSha(await readFile(f.path)),f.sha256);artifactPaths.add(f.path);}
 // Run the actual pre-termination collection verifier WITHOUT any control-plane
 // request or key. It checks the five local files the watcher would delete for.
 const verify="import importlib.util,json,pathlib,sys;s=importlib.util.spec_from_file_location('m','adstudio/benchmark/qwen-app-monitor.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);r=json.loads(pathlib.Path(sys.argv[1]).read_text());assert m.verify_collection(r,{'podId':r['podId']},pathlib.Path.cwd());print('PASS actual five-file collection verifier, no provider calls')";
 execFileSync('python',['-c',verify,join(current.session,'one-job.json.status.json')],{cwd:root,env:{...process.env,QWEN_SESSION_DIR:current.session},stdio:'pipe'});
 const blob=new Blob([await readFile(join(outputs,result.url.slice(9)))]),asset={id:'CPU-delivered-asset',name:'CPU mock result.png',original:blob,normalized:blob,width:result.width,height:result.height,created:Date.now()};
 const take=await heroTakeFromDelivery(result,asset,settings),driver=memoryDriver(),projects=new Projects(driver),project=newProject('CPU delivery only');project.id=body.projectId;project.hero.settings=structuredClone(settings);project.hero.takes.push(take);project.hero.activeId=take.id;await projects.save(project,asset);const restored=(await new Projects(driver).list())[0];assert.equal(restored.hero.takes[0].jobId,result.jobId);assert.equal(heroSha(Buffer.from(await(await projects.asset(asset.id)).original.arrayBuffer())),result.sha256);
 const again=await post(base,randomBytes(16).toString('hex'));assert.equal(again.status,409);assert.equal(submissions,1);cases.push('315s before headers: full delivery, five-file hashes, isolated project restore, second job rejected');
 await save(join(evidence,'long-success.json'),{passed:true,wallStart,wallEnd:Date.now(),elapsedMs,headerWaitMs,delayMs,heartbeatCount,submissions,executions,collectionFiles:collected.files.length,projectDeliveryRestored:true,browserStorageTouched:false,requestId,model:'CPU MOCK ONLY - NO INFERENCE',sourceHashes:{original:hash,reference:hash},outputSha256:result.sha256});await stop();
 for(const failure of ['disconnect','malformed','expired']){
  mode=failure;const url=await start(failure),before=submissions;
  if(failure==='expired'){current.lease.deadline=Date.now()/1000-1;await save(join(current.session,'lease.json'),current.lease);}
  const r=await post(url,randomBytes(16).toString('hex'));assert.equal(r.status,failure==='expired'?503:502,JSON.stringify(r));assert.equal(submissions,before+(failure==='expired'?0:1));
  if(failure!=='expired'){assert.equal(JSON.parse(await readFile(join(current.session,'one-job.json.status.json'),'utf8')).state,'failed');assert.equal((await post(url,randomBytes(16).toString('hex'))).status,409);assert.equal(submissions,before+1);}
  else await assert.rejects(()=>stat(join(current.session,'one-job.json')),/ENOENT/);
  cases.push(failure+' failed closed with no duplicate/retry');await stop();
 }
 if(initialServer)assert.deepEqual(await readFile(join(outputs,'hero-serve-audit/server.json')),initialServer);
 const sourceHashes={};for(const p of ['shared/runtime/qwen-relay.ts','shared/runtime/qwen-inference-http.ts','adstudio/scripts/qwen-relay-long.test.mjs'])sourceHashes[p]=heroSha(await readFile(p));
 await save(join(evidence,'result.json'),{passed:true,cases,sourceHashes,headerWaitMs:JSON.parse(await readFile(join(evidence,'long-success.json'),'utf8')).headerWaitMs,elapsedMs,realApplicationAPI:true,submissions,completedFixtureResults:executions,actualGeneration:false,privateAssets:false,providerCalls:0,ownerStorageTouched:false});
 console.log('PASS actual >310s HTTP response and collection/project delivery, no retries: '+join(evidence,'result.json'));
}finally{
 await stop();if(backend){backend.closeAllConnections();await new Promise(ok=>backend.close(ok));}
 for(const p of artifactPaths){if(!resolve(p).startsWith(outputs+sep))throw Error('Unsafe fixture file cleanup');await rm(p,{force:true});}
 // Preserve safe evidence, remove synthetic approvals and mock artifacts.
 for(const name of ['delayed-success','disconnect','malformed','expired','mock-backend']){const p=join(fixture,name);if(!p.startsWith(outputs+sep))throw Error('Unsafe fixture cleanup');await rm(p,{recursive:true,force:true});}
}
