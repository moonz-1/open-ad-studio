// Opt-in standalone SDK runner; never used by production /api/shot.
import {Comfy} from '@comfyorg/sdk';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {benchmarkGraph,validateGraph} from './graph.mjs';
import {validateRunGate} from './run-gate.mjs';
const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1],approved=args.includes('--approved');
if(!approved){console.log('DRY RUN: SDK I2V render requires explicit approval; no network or uploads.');process.exit(0);}
for(const key of ['BENCHMARK_LEASE','BENCHMARK_WATCHDOG_READY','BENCHMARK_HEALTH_REPORT'])if(!process.env[key])throw Error('Missing '+key+'; verify watchdog and remote health before private upload');
const folder=resolve('outputs/ltx25-benchmark'),root=dirname(fileURLToPath(import.meta.url));
const pinBytes=await readFile(join(root,'pins.json')),pins=JSON.parse(pinBytes),lease=JSON.parse(await readFile(process.env.BENCHMARK_LEASE,'utf8'));
const checkGate=async()=>validateRunGate(lease,JSON.parse(await readFile(process.env.BENCHMARK_WATCHDOG_READY,'utf8')),JSON.parse(await readFile(process.env.BENCHMARK_HEALTH_REPORT,'utf8')),createHash('sha256').update(pinBytes).digest('hex'));
await checkGate();
const deadline=lease.deadline*1000;
if(deadline-Date.now()<30*60*1000||deadline-lease.created*1000>9000000)throw Error('Insufficient session time or invalid lease. Stop and collect artifacts.');
const base=process.env.COMFY_BASE_URL||'http://127.0.0.1:28189',comfy=process.env.BENCHMARK_COMFY_URL||'http://127.0.0.1:28188';
for(const u of [base,comfy])if(!['127.0.0.1','localhost','[::1]'].includes(new URL(u).hostname))throw Error('Use an SSH loopback tunnel, not a public HTTP endpoint');
delete process.env.COMFY_API_KEY;process.env.COMFY_BASE_URL=base;
const manifest=JSON.parse(await readFile(resolve('outputs/ltx25-benchmark/inputs/manifest.json'),'utf8'));
const name=value('--case'),input=manifest.inputs.find(i=>i.id===name),seed=args.includes('--seed')?Number(value('--seed')):1;
if(!input||![1,2].includes(seed))throw Error('Use --case cookie|printed-label [--seed 1|2]');
const sha=b=>createHash('sha256').update(b).digest('hex');
if(sha(await readFile(input.guide))!==input.guideSha256)throw Error('Guide hash mismatch');
await mkdir(folder,{recursive:true});
const ledger=join(folder,'attempts.json');let attempts=[];try{attempts=JSON.parse(await readFile(ledger,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(attempts.length>=4||attempts.some(a=>a.case===name&&a.seed===seed))throw Error('Bounded experiment exhausted or duplicate attempt; inspect evidence, no automatic retry.');
const prompt='A slow, smooth camera push toward the photographed product. Warm bakery lighting, realistic depth and gentle perspective change. Keep the product shape, cookie count, chocolate chips, tray or packaging, printed lettering and colors consistent with the reference. No melting, no new ingredients, no hands, no added text.';
const graph=benchmarkGraph({prompt,seed});
const nodes=await(await fetch(comfy+'/object_info',{signal:AbortSignal.timeout(10000)})).json();validateGraph(graph,nodes);
const response=await fetch(comfy+'/system_stats',{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Remote system stats unavailable');const stats=await response.json();
const directory=join(folder,name+'-seed'+seed);await mkdir(directory,{recursive:true});
const record={version:1,case:name,seed,prompt,input,graph,graphSha256:sha(JSON.stringify(graph)),pins,stats,started:new Date().toISOString(),status:'submitting',jobId:null};
attempts.push({case:name,seed,created:record.started});await writeFile(ledger,JSON.stringify(attempts,null,2));
const save=()=>writeFile(join(directory,'render.json'),JSON.stringify(record,null,2));await save();
const client=new Comfy(),workflow=client.workflows.fromJson(graph);
workflow.setInput('2004','image',client.assets.fromFile(input.guide));
const begin=Date.now();
try {
 await checkGate(); // Re-read the independent heartbeat immediately before upload.
 delete manifest.uploaded;manifest.uploadStatus='Upload may occur during this authorized SDK submission';await writeFile(resolve('outputs/ltx25-benchmark/inputs/manifest.json'),JSON.stringify(manifest,null,2));
 const job=await client.submit(workflow,{idempotencyKey:randomUUID(),signal:AbortSignal.timeout(60000)});record.jobId=job.id;record.status='running';await save();console.log('Submitted job',job.id,'for',name);
 manifest.uploaded=true;manifest.uploadStatus='At least one guide uploaded by authorized SDK submission';await writeFile(resolve('outputs/ltx25-benchmark/inputs/manifest.json'),JSON.stringify(manifest,null,2));
 await job.result(AbortSignal.timeout(Math.min(25*60*1000,deadline-Date.now()-10*60*1000)));
 const out=job.getOutputs('4852')[0];if(!out)throw Error('No SaveVideo output');await out.toFile(join(directory,'video.mp4'),{signal:AbortSignal.timeout(120000)});
 record.videoSha256=sha(await readFile(join(directory,'video.mp4')));record.status='complete';
}catch(error){record.status='failed-or-interrupted';record.error=String(error);throw error;}
finally {record.seconds=(Date.now()-begin)/1000;record.finished=new Date().toISOString();await save();}
console.log('Saved private output and exact execution provenance:',directory);
