// MOCK HTTP inference fixtures only. Not browser acceptance or a real Comfy job.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createServer} from 'node:http';
import {crc32} from 'node:zlib';
import {Resvg} from '@resvg/resvg-js';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
import {generateQwenHero,qwenContract} from '../../shared/runtime/qwen-hero.ts';
import {createQwenRelay} from '../../shared/runtime/qwen-relay.ts';
import {acceptanceGate,claimAcceptanceJob} from '../../shared/runtime/qwen-app-session.ts';
import {newGenerationDraft,briefDefaults,prepareConciseDraft,reviewDraft,generationPrompt} from '../../shared/lib/product-brief.ts';
import {heroDefaults} from '../../shared/lib/hero-ad.ts';
const parent=resolve('outputs'),root=await mkdtemp(join(parent,'qwen-relay-fixture-')),local=join(root,'local'),remote=join(root,'remote');await mkdir(local);await mkdir(remote);
const png=new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64"><rect width="48" height="64" fill="orange"/></svg>').render().asPng();
const withPrompt=graph=>{const type=Buffer.from('tEXt'),data=Buffer.from('prompt\0'+JSON.stringify(graph)),chunk=Buffer.alloc(data.length+12);chunk.writeUInt32BE(data.length);type.copy(chunk,4);data.copy(chunk,8);chunk.writeUInt32BE(crc32(Buffer.concat([type,data])),data.length+8);return Buffer.concat([png.subarray(0,-12),chunk,png.subarray(-12)]);};
let server,submits=0,uploads=0,corrupt=false,available=true;
const origin='http://127.0.0.1:8301',hash=heroSha(png),image='/outputs/aaaaaaaaaaaaaaaa.png';
const input={version:1,source:{id:'ref',name:'MOCK orange rectangle',sha256:hash,originalSha256:hash,kind:'original'},facts:{description:'Fixture packaged product',count:1,arrangement:'Centered',texture:'Printed paper',container:'Paper box',confirmed:true},productType:'packaged-goods',productName:'Fixture',notes:'',brand:{id:'brand',name:'Fixture',revision:1,signals:[],evidence:[],colors:[]},controls:briefDefaults(),execution:{adapter:'qwen-fp8',seed:42}};
const draft=prepareConciseDraft(newGenerationDraft(input));reviewDraft(draft);
const settings={...heroDefaults().settings,method:'reimagine',imageModel:'qwen-fp8',sourceKind:'original',sourceId:'ref',brandId:'brand',productName:'Fixture',seed:42,briefDraft:draft,prompt:generationPrompt(draft)};
const body={image,projectId:'MOCK-project',original:'data:image/png;base64,'+png.toString('base64'),settings,_requestId:'c'.repeat(32)};
async function fixture(name){const dir=join(root,name);await mkdir(dir);const now=Date.now()/1000,lease={version:1,podId:'MOCK-NOT-A-POD',name:'adstudio-qwen2511-CPU-MOCK',created:now-60,deadline:now+6800,cap:2,gpuRate:.59,storageHourly:.02,image:'runpod/comfyui@sha256:7ed65713a24c7c836cea8e5ba338ee140b0257b0a086cc3835784e0473efe2f2'};
 const plan={version:1,projectId:'MOCK-project',brandId:'brand',sourceId:'ref',purpose:'qwen-app-acceptance',paidApproved:true,privateUploadApproved:true,maxJobs:1,maxSpendUSD:2,reserveUSD:4,seed:42,originalSha256:hash,referenceSha256:hash,promptSha256:heroSha(settings.prompt),codeCommit:'a'.repeat(40),remoteOrigin:'http://127.0.0.1:28301',browserOrigin:origin,podId:lease.podId};
 const files={approval:join(dir,'acceptance.json'),lease:join(dir,'lease.json'),watchdog:join(dir,'watchdog.json'),receipt:join(dir,'one-job.json')};
 const save=async(p,x)=>writeFile(p,JSON.stringify(x));await save(files.approval,plan);await save(files.lease,lease);await save(files.watchdog,{podId:lease.podId,state:'armed',checked:now,deadline:lease.deadline});return {files,plan,lease,save};}
try{
 await writeFile(join(local,'aaaaaaaaaaaaaaaa.png'),png);await writeFile(join(local,'bbbbbbbbbbbbbbbb.png'),'OLD LOCAL OUTPUT');
 const contract=await qwenContract();
 server=createServer(async(req,res)=>{try{let data='';for await(const c of req)data+=c;const json=x=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(x));};
  if(req.url==='/api/hero/capabilities')return json({qwen:{available,reason:'MOCK unavailable'}});
  if(req.url==='/api/upload'){uploads++;assert.equal(heroSha(Buffer.from(JSON.parse(data).image.split(',')[1],'base64')),hash);await writeFile(join(remote,'aaaaaaaaaaaaaaaa.png'),png);return json({url:image});}
  if(req.url==='/api/hero/qwen'){const b=JSON.parse(data);const result=await generateQwenHero(b,remote,{check:async()=>({available:true}),weights:async()=>contract.files,progress:()=>{},execute:async(graph,ref,out)=>{submits++;await writeFile(out,withPrompt(graph));return {jobId:'MOCK-HTTP-JOB-'+submits};}});return json(result);}
  if(req.url.startsWith('/api/activity/'))return json({phase:'generating',message:'MOCK HTTP only',percent:50});
  if(req.url.startsWith('/api/hero/qwen/provenance/')){const record=JSON.parse(await readFile(join(remote,'hero-qwen',req.url.split('/').pop(),'provenance.json'),'utf8'));if(corrupt)record.originalSha256='f'.repeat(64);return json(record);}
  if(/^\/outputs\/[a-f0-9]{16}\.png$/.test(req.url))return res.end(await readFile(join(remote,req.url.slice(9))));
  res.statusCode=404;json({error:'MOCK missing'});
 }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}});
 await new Promise((ok,no)=>{server.once('error',no);server.listen(28301,'127.0.0.1',ok);});
 const first=await fixture('success'),relay=createQwenRelay(local,'http://127.0.0.1:28301',first.files);
 assert.equal((await relay.capability(origin)).available,true);
 await assert.rejects(()=>relay.generate(body,'http://localhost:8301',()=>{}),/approval\/origin/);
 first.plan.paidApproved=false;await first.save(first.files.approval,first.plan);await assert.rejects(()=>relay.generate(body,origin,()=>{}),/approval\/origin/);first.plan.paidApproved=true;await first.save(first.files.approval,first.plan);
 await first.save(first.files.watchdog,{podId:first.lease.podId,state:'armed',checked:Date.now()/1000-90,deadline:first.lease.deadline});await assert.rejects(()=>relay.generate(body,origin,()=>{}),/watchdog/);await first.save(first.files.watchdog,{podId:first.lease.podId,state:'armed',checked:Date.now()/1000,deadline:first.lease.deadline});
 const wrongProject={...body,projectId:'other-project'};await assert.rejects(()=>relay.generate(wrongProject,origin,()=>{}),/approved project/);
 const stale=structuredClone(body);stale.settings.prompt+=' stale';await assert.rejects(()=>relay.generate(stale,origin,()=>{}));assert.equal(uploads,0);assert.equal(submits,0);
 available=false;await assert.rejects(()=>relay.generate(body,origin,()=>{}),/unavailable/);assert.equal(uploads,0);available=true;
 const delivered=await relay.generate(body,origin,()=>{});assert.equal(submits,1);assert.equal(delivered.collectionVerified,true);assert.equal(heroSha(await readFile(join(local,delivered.url.slice(9)))),delivered.sha256);
 const collected=JSON.parse(await readFile(first.files.receipt+'.status.json','utf8'));assert.equal(collected.state,'collected');assert.equal(collected.files.length,5);for(const f of collected.files)assert.equal(heroSha(await readFile(f.path)),f.sha256);assert.equal(JSON.parse(await readFile(join(local,'hero-qwen',delivered.provenanceId,'provenance.json'),'utf8')).url,delivered.url);
 assert.equal(await readFile(join(local,'bbbbbbbbbbbbbbbb.png'),'utf8'),'OLD LOCAL OUTPUT');assert.equal(heroSha(await readFile(join(local,'aaaaaaaaaaaaaaaa.png'))),hash);
 await assert.rejects(()=>relay.generate(body,origin,()=>{}),/already used/);assert.equal(submits,1);
 const failure=await fixture('corrupt');corrupt=true;const bad=createQwenRelay(local,'http://127.0.0.1:28301',failure.files);await assert.rejects(()=>bad.generate(body,origin,()=>{}),/provenance/);assert.equal(JSON.parse(await readFile(failure.files.receipt+'.status.json','utf8')).state,'failed');await assert.rejects(()=>bad.generate(body,origin,()=>{}),/already used/);assert.equal(submits,2);
 const race=await fixture('race');const claims=await Promise.allSettled([claimAcceptanceJob(race.files,{}),claimAcceptanceJob(race.files,{})]);assert.equal(claims.filter(x=>x.status==='fulfilled').length,1);
 await new Promise(ok=>server.close(ok));server=null;
 assert.equal(heroSha(await readFile(join(local,delivered.url.slice(9)))),delivered.sha256,'Collected raw output survives remote shutdown');
 assert.equal((await relay.capability(origin)).available,false);await assert.rejects(()=>relay.generate(body,origin,()=>{}),/already used/);
 console.log('PASS MOCK HTTP only: same-origin exact lease/source/review/one-job gates, unavailable and corrupt recovery, durable five-file collection before delivery, original/old output preservation, remote-off retrieval. NO browser acceptance or real inference.');
}finally{if(server)await new Promise(ok=>server.close(ok));if(!root.startsWith(parent+(process.platform==='win32'?'\\':'/')))throw Error('Unsafe fixture cleanup');await rm(root,{recursive:true,force:true});}
