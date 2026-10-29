// Exactly two approved prompts, through the existing SDK/proxy SSH tunnel.
import {Comfy} from '@comfyorg/sdk';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {qwenGraph,inspectQwen,prompts} from './qwen-hero.mjs';
import {campaignGraph,validateCampaign} from './creative-brief.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),root=resolve('outputs/qwen-hero-benchmark'),session=resolve(process.env.QWEN_SESSION_DIR||join(root,'session'));
if(!session.startsWith(resolve('outputs')+'/')&&!session.startsWith(resolve('outputs')+'\\'))throw Error('Session must stay in private outputs');
async function checkedPlan(path){
 const p=validateCampaign(JSON.parse(await readFile(path,'utf8')));
 for(const c of p.cases){
  if(sha(JSON.stringify(await campaignGraph(c.brief)))!==c.graphSha256)throw Error('Campaign workflow changed after preparation');
  const image=await readFile(c.reference.path),original=await readFile(c.reference.originalPath);
  if(sha(image)!==c.reference.sha256||sha(original)!==c.reference.originalSha256)throw Error('Campaign original/crop changed');
  if(image.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||image.readUInt32BE(16)>2048||image.readUInt32BE(20)>2048)throw Error('Expected bounded PNG guide');
  if(original.subarray(0,3).toString('hex')!=='ffd8ff'&&original.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Original must be a photograph, not another local file');
 }
 return p;
}
const checkIndex=process.argv.indexOf('--check-plan');
if(checkIndex>=0){const p=await checkedPlan(process.argv[checkIndex+1]);console.log(`PASS offline campaign: ${p.cases.length} compiled prompts, original/crop and workflow hashes. No network, upload, inference or spend.`);process.exit();}
if(!process.argv.includes('--approved')){console.log('DRY RUN: no generation/private upload');process.exit();}
const lease=JSON.parse(await readFile(join(session,'lease.json'),'utf8')),pins=JSON.parse(await readFile('adstudio/benchmark/qwen-hero-pins.json','utf8')),input=JSON.parse(await readFile(join(root,'input.json'),'utf8')),health=JSON.parse(await readFile(join(session,'health.json'),'utf8'));
const planIndex=process.argv.indexOf('--plan'),plan=planIndex<0?null:await checkedPlan(process.argv[planIndex+1]);
if(plan && session===join(root,'session'))throw Error('Creative sprint must use a new QWEN_SESSION_DIR; preserve earlier outputs');
const cases=plan?plan.cases:input.cases.map(c=>({...c,reference:{path:input.guide,sha256:input.guideSha256,originalPath:input.originalPath,originalSha256:input.originalSha256}}));
if(lease.cap!==2||lease.gpuRate!==.59||lease.deadline-lease.created>7200||!health.ready||health.podId!==lease.podId||health.comfyCommit!==pins.runtime.remoteComfyCommit||!health.stats.devices?.[0]?.name?.includes('A40'))throw Error('Approved hardware/lease/runtime gate failed');
const models=pins.files.filter(f=>!f.file.includes('_bf16'));for(const f of models)if(!health.models.some(m=>m.file===f.file&&m.bytes===f.bytes&&m.sha256===f.sha256))throw Error('Verified remote model hash missing');
for(const [file,hash]of [[input.original,input.originalSha256],[input.originalPath,input.originalSha256],[input.guide,input.guideSha256]])if(sha(await readFile(file))!==hash)throw Error('Original/reference changed');
for(const c of cases)for(const [file,hash]of [[c.reference.path,c.reference.sha256],[c.reference.originalPath,c.reference.originalSha256]])if(sha(await readFile(file))!==hash)throw Error('Campaign original/crop changed');
const guard=async()=>{const r=JSON.parse(await readFile(join(session,'watchdog-ready.json'),'utf8'));if(r.podId!==lease.podId||r.state!=='armed'||Date.now()/1000-r.checked>40||lease.deadline-Date.now()/1000<900)throw Error('Watchdog/deadline gate failed before private upload');};
process.env.COMFY_BASE_URL='http://127.0.0.1:28189';delete process.env.COMFY_API_KEY;
const client=new Comfy();
for(const entry of cases){
 const kind=entry.id;await guard();if(!plan&&(!input.cases.some(c=>c.id===kind&&c.prompt===prompts[kind]&&c.seed===42)))throw Error('Prepared prompt differs');
 const folder=join(session,'candidates',kind);await mkdir(folder,{recursive:true});try{await stat(join(folder,'render.json'));throw Error('Already attempted this candidate; no automatic duplicate');}catch(e){if(e.code!=='ENOENT')throw e;}
 const graph=plan?await campaignGraph(entry.brief):await qwenGraph(kind,'fp8');
 if(plan&&sha(JSON.stringify(graph))!==entry.graphSha256)throw Error('Campaign workflow changed after preparation');
 const nodes=await(await fetch('http://127.0.0.1:28188/object_info')).json(),validation=inspectQwen(graph,nodes);if(!validation.ready)throw Error(JSON.stringify(validation));
 const queue=await(await fetch('http://127.0.0.1:28188/queue')).json();if(queue.queue_running?.length||queue.queue_pending?.length)throw Error('Unexpected remote queue');
 const record={version:1,status:'submitting',ownerApproved:false,case:kind,prompt:entry.prompt,brief:entry.brief||null,reference:entry.reference,seed:42,precision:'fp8mixed',graph,graphSha256:sha(JSON.stringify(graph)),pins,input,podId:lease.podId,started:new Date().toISOString(),modelHashes:health.models};
 const save=()=>writeFile(join(folder,'render.json'),JSON.stringify(record,null,2));await save();
 const workflow=client.workflows.fromJson(graph);workflow.setInput('4','image',client.assets.fromFile(entry.reference.path));const started=Date.now();let job;
 try{
  await guard();job=await client.submit(workflow);record.jobId=job.id;record.status='running';await save();console.log('REAL QWEN JOB:',kind,job.id);
  await job.wait(Math.min(40*60*1000,(lease.deadline-Date.now()/1000-600)*1000));await job.result();
  const output=job.getOutputs('15')[0];if(!output)throw Error('No raw SaveImage output');await output.toFile(join(folder,'raw.png'));
  const bytes=await readFile(join(folder,'raw.png'));if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid model PNG');record.width=bytes.readUInt32BE(16);record.height=bytes.readUInt32BE(20);record.rawSha256=sha(bytes);record.status='complete';record.metrics=job.metrics||null;
  const h=await fetch('http://127.0.0.1:28188/history/'+encodeURIComponent(job.id));if(h.ok)await writeFile(join(folder,'comfy-history.json'),JSON.stringify(await h.json(),null,2));console.log('RAW PNG COLLECTED:',kind,record.width,record.height,record.rawSha256);
 }catch(e){record.status='failed-or-interrupted';record.error=String(e);if(job)await job.cancel(AbortSignal.timeout(5000)).catch(()=>{});throw e;}
 finally{record.seconds=(Date.now()-started)/1000;record.finished=new Date().toISOString();await save();}
}
console.log(`Exactly ${cases.length} planned raw candidates collected. STOP; no more generation authorized.`);
