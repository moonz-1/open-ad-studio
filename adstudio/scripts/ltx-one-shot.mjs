// One local LTX inference maximum. Default mode only prepares/validates; no GPU job.
import {open,readFile,writeFile,mkdir,stat,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Comfy} from '@comfyorg/sdk';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=join(root,'outputs/video-quality/ltx-one-shot');
const comfy='http://127.0.0.1:8188',proxy='http://127.0.0.1:8189';
const modelRoot=process.env.LTX_MODELS_DIR;
if(!modelRoot)throw Error('Set LTX_MODELS_DIR to the existing Comfy models directory. No downloads.');
const run=process.argv.includes('--run');
const source=join(root,'outputs/video-quality/original.png');
const graph=JSON.parse(await readFile(join(root,'adstudio/benchmark/ltx-one-shot.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const save=(name,value)=>writeFile(join(out,name),JSON.stringify(value,null,2)+'\n');
const get=async(base,path)=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return r.json();};
const exec=(exe,args)=>{const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:8*1024*1024});if(r.error||r.status!==0)throw Error(`${exe}: ${r.error?.message||r.stderr}`);return r.stdout;};
await mkdir(out,{recursive:true});
if((await stat(join(out,'attempt.json')).catch(e=>{if(e.code==='ENOENT')return null;throw e;})))throw Error('This one-shot attempt has already been consumed; preserve its evidence and review before authorizing another.');
// This source is the previously authorized original, not a generated campaign image.
const sourceBytes=await readFile(source);
if(sha(sourceBytes)!=='209a46b99271245e4dee4c3865b84664097081d44c4a7b211e5b11bb7ba9e3b6')throw Error('Original source hash differs; review before running.');
const checkpoint=join(modelRoot,'checkpoints',graph['1'].inputs.ckpt_name);
const fd=await open(checkpoint,'r');let config;
try{const size=Buffer.alloc(8);await fd.read(size,0,8,0);const length=Number(size.readBigUInt64LE());if(length>16*1024*1024)throw Error('Unexpected model header');const header=Buffer.alloc(length);await fd.read(header,0,length,8);config=JSON.parse(JSON.parse(header.toString()).__metadata__.config);}finally{await fd.close();}
const expected=[1,0.9937,0.9875,0.9812,0.975,0.9094,0.725,0.4219];
if(JSON.stringify(config.allowed_inference_steps)!==JSON.stringify(expected))throw Error('Checkpoint schedule differs');
if(graph['13'].inputs.sigmas!==[...expected,0].join(', '))throw Error('Graph schedule differs');
const encoder=join(modelRoot,'text_encoders',graph['2'].inputs.clip_name);
const files=await Promise.all([checkpoint,encoder].map(async p=>({file:p,bytes:(await stat(p)).size})));
const nodes=await get(comfy,'/object_info');
for(const [id,node]of Object.entries(graph)){
 const spec=nodes[node.class_type];if(!spec)throw Error(`Missing node ${node.class_type}`);
 for(const name of Object.keys(spec.input.required||{}))if(!(name in node.inputs))throw Error(`${id}: missing ${name}`);
 for(const [key,value] of Object.entries(node.inputs)){
  if(Array.isArray(value)){if(!graph[value[0]]||value[1]>=nodes[graph[value[0]].class_type].output.length)throw Error(`Bad graph link ${id}.${key}`);}
  else{const choices=spec.input.required?.[key]?.[0]||spec.input.optional?.[key]?.[0];if(!(id==='5'&&key==='image')&&Array.isArray(choices)&&!choices.includes(value))throw Error(`Unsupported ${id}.${key}: ${value}`);}
 }
}
const health=await get(proxy,'/api/v2/health');
if(health.upstream!==comfy)throw Error('Proxy targets a different Comfy instance');
async function admission(){
 const [queue,stats]=await Promise.all([get(comfy,'/queue'),get(comfy,'/system_stats')]);
 const physical=exec('nvidia-smi',['--query-gpu=memory.free','--format=csv,noheader,nounits']).trim().split(/\r?\n/).map(Number);
 const free=stats.devices?.[0]?.vram_free||0;
 if(queue.queue_running.length||queue.queue_pending.length)throw Error('GPU queue busy; no submission');
 if(physical.length!==1||physical[0]<6144||free<6*1024**3||stats.system.ram_free<4*1024**3)throw Error('Need 6 GiB physical/Comfy VRAM and 4 GiB RAM free; no unload or retry');
 return {at:new Date().toISOString(),queue,stats,physicalFreeMiB:physical[0]};
}
const readiness=await admission();
await save('configuration.json',{mode:run?'requested-run':'prepared-only',source,sourceSha256:sha(sourceBytes),files,checkpointConfig:config,graphSha256:sha(JSON.stringify(graph)),readiness,proxy:health,dimensions:[480,640],frames:97,fps:24,seed:291026,steps:8,limits:['one submission, no retry','600-second job wait','no new models, unload, process shutdown or remote service','first-frame guidance does not guarantee product identity','single-scale test; not the upstream optional spatial-upscaler pipeline']});
await save('workflow.json',graph);
console.log('Prepared compatible graph; 480x640 / 97 frames / 24 fps / eight distilled steps.');
if(!run)process.exit(0);
if(process.env.LTX_GPU_RESERVED!=='1')throw Error('Run only after Cursor releases the GPU: set LTX_GPU_RESERVED=1');
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';exec(ffmpeg,['-version']);
const ffprobe=process.env.FFPROBE_PATH||join(dirname(ffmpeg),'ffprobe.exe');exec(ffprobe,['-version']);
// Permanent once-only receipt: a failed/ambiguous submission also consumes this attempt.
await writeFile(join(out,'attempt.json'),JSON.stringify({at:new Date().toISOString(),sourceSha256:sha(sourceBytes),graphSha256:sha(JSON.stringify(graph))},null,2),{flag:'wx'});
process.env.COMFY_BASE_URL=proxy;
const client=new Comfy(),wf=client.workflows.fromJson(graph);
wf.setInput('5','image',client.assets.fromFile(source));
const events=[],started=Date.now(),abort=new AbortController();let job,stream;
try{
 await save('admission-at-submit.json',await admission());
 job=await client.submit(wf);await save('submitted.json',{id:job.id,at:new Date().toISOString()});console.log('SUBMITTED',job.id);
 stream=(async()=>{try{for await(const event of job.events(abort.signal)){const row={at:new Date().toISOString(),...event};events.push(row);await appendFile(join(out,'events.jsonl'),JSON.stringify(row)+'\n');if(event.kind==='progress')console.log('PROGRESS',event.currentNode,event.step,event.steps);}}catch(e){if(!abort.signal.aborted)console.log('Event stream:',e.message);}})();
 await job.wait(600000);await job.result();
 const result=job.getOutputs('17')[0];if(!result)throw Error('No generated video output');
 const raw=join(out,'raw-ltx.webm');await result.toFile(raw);
 const history=await get(comfy,'/history/'+encodeURIComponent(job.id));await save('native-history.json',history);
 const native=history[job.id];if(!native?.status?.completed||native.status.status_str!=='success')throw Error('Native successful history not confirmed');
 const cached=native.status.messages.filter(x=>x[0]==='execution_cached').flatMap(x=>x[1].nodes||[]);if(cached.includes('14'))throw Error('Sampler cached: not fresh inference');
 const mp4=join(out,'no-crumbs-ltx-shot.mp4');
 exec(ffmpeg,['-nostdin','-v','error','-n','-i',raw,'-map','0:v:0','-an','-c:v','libx264','-crf','17','-preset','medium','-pix_fmt','yuv420p','-movflags','+faststart',mp4]);
 const probe=JSON.parse(exec(ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',mp4]));await save('ffprobe.json',probe);
 if(Number(probe.streams[0].nb_read_frames)!==97||probe.streams[0].width!==480||probe.streams[0].height!==640)throw Error('Unexpected output geometry/frame count');
 for(const frame of [0,16,32,48,64,80,96])exec(ffmpeg,['-nostdin','-v','error','-n','-i',mp4,'-vf',`select=eq(n\\,${frame})`,'-frames:v','1',join(out,`frame-${String(frame).padStart(3,'0')}.png`)]);
 exec(ffmpeg,['-nostdin','-v','error','-n','-i',mp4,'-vf','select=not(mod(n\\,16)),scale=240:320,tile=7x1','-frames:v','1',join(out,'contact-sheet.png')]);
 exec(ffmpeg,['-nostdin','-v','error','-i',mp4,'-f','null','-']);
 await save('result.json',{status:'inference-complete-awaiting-visual-review',jobId:job.id,seconds:(Date.now()-started)/1000,rawSha256:sha(await readFile(raw)),mp4Sha256:sha(await readFile(mp4)),samplerCached:false,frames:97,fps:24,mp4,events:events.length});
 console.log('GENERATED',mp4);
}catch(error){
 let cancellation='not needed';
 if(job){try{const q=await get(comfy,'/queue');const own=q.queue_running.filter(x=>x[1]===job.id);if(own.length===1&&q.queue_running.length===1){await job.cancel(AbortSignal.timeout(5000));cancellation='requested for own running job; verify queue';}else if(q.queue_pending.some(x=>x[1]===job.id)&&q.queue_running.length===0){await job.cancel(AbortSignal.timeout(5000));cancellation='requested for own pending job';}else cancellation='not requested: no exclusively owned running/pending job';await save('failure-history.json',await get(comfy,'/history/'+encodeURIComponent(job.id)));}catch(e){cancellation=e.message;}}
 await save('failure.json',{error:error.message,jobId:job?.id,seconds:(Date.now()-started)/1000,cancellation});throw error;
}finally{abort.abort();if(stream)await stream;}
