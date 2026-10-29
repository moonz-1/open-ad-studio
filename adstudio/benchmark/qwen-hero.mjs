// Isolated Qwen benchmark using the EXISTING SDK/proxy. No UI/runtime changes,
// downloads, Pod creation or implicit renders. --check is the default.
import {Comfy} from '@comfyorg/sdk';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnv} from 'vite';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),folder=join(root,'outputs/qwen-hero-benchmark');
const sha=b=>createHash('sha256').update(b).digest('hex');
export const prompts={
 lighting:'Edit image 1 as a photograph of the SAME nine cinnamon rolls in the SAME white rectangular baking pan. Preserve their individual shapes, arrangement, irregular cinnamon spirals, pale cream-cheese frosting coverage, baked edges and visible dough texture. Keep the overhead camera angle. Change only the photographic lighting and the surroundings: soft diffused window light from the left, natural white balance, gentle highlights, warm neutral stone surface around the pan. Keep believable frosting, not plastic gloss. Do not add food, toppings, ingredients, extra rolls, hands, logos, letters, packaging or graphic design. The complete pan and all nine rolls remain visible.',
 cinematic:'Create a premium editorial bakery product PHOTOGRAPH from image 1, preserving the exact nine cinnamon rolls and their original white baking pan. Keep the overhead viewpoint, roll arrangement and recognizable irregular spirals, thick pale frosting, tender folded dough and browned edges. Place the pan on a warm understated wooden breakfast table with a small neutral linen edge outside the pan. Beautiful directional morning window light, soft natural shadows, rich but realistic baked tones, tactile frosting and restrained highlights. The food is the hero; no fantasy glaze, no added cinnamon dust, no toppings, no extra ingredients, no steam, no hands, no additional rolls, no lettering, no logos or graphic overlays. Keep the complete pan in frame.'
};
export async function qwenGraph(kind='lighting',precision='fp8'){
 if(!Object.hasOwn(prompts,kind)||!['fp8','bf16'].includes(precision))throw Error('Use lighting|cinematic and fp8|bf16.');
 const graph=JSON.parse(await readFile(join(root,'shared/workflows/hero_qwen2511_benchmark.json'),'utf8'));
 graph['1'].inputs.unet_name=`qwen_image_edit_2511_${precision==='fp8'?'fp8mixed':'bf16'}.safetensors`;
 graph['6'].inputs.prompt=prompts[kind];return graph;
}
export function inspectQwen(graph,nodes){
 const missingNodes=[],missingModels=[],invalid=[];
 for(const [id,n]of Object.entries(graph)){
  const spec=nodes[n.class_type];if(!spec){missingNodes.push(n.class_type);continue;}
  for(const key of Object.keys(spec.input?.required||{}))if(!(key in n.inputs))invalid.push(`${id}.${key}: required`);
  for(const [key,value]of Object.entries(n.inputs)){
   const def=spec.input?.required?.[key]||spec.input?.optional?.[key];if(!def){invalid.push(`${id}.${key}: unknown`);continue;}
   if(Array.isArray(value)){const upstream=graph[value[0]];if(!upstream||!Number.isInteger(value[1])||value[1]<0)invalid.push(`${id}.${key}: invalid link`);else if(nodes[upstream.class_type]?.output?.[value[1]]&&nodes[upstream.class_type].output[value[1]]!==def[0]&&def[0]!=='*')invalid.push(`${id}.${key}: type mismatch`);continue;}
   const options=Array.isArray(def[0])?def[0]:def[1]?.options;
   if(options&&!options.includes(value)){if(['unet_name','clip_name','vae_name'].includes(key))missingModels.push(value);else if(key!=='image')invalid.push(`${id}.${key}: unsupported value`);}
  }
 }
 return {ready:!missingNodes.length&&!missingModels.length&&!invalid.length,missingNodes,missingModels,invalid};
}
export async function prepareQwen(){
 const sources=JSON.parse(await readFile(join(root,'outputs/benchmark-ad-v1/sources.json'),'utf8')),s=sources.original;
 const bytes=await readFile(s.path);if(sha(bytes)!==s.sha256)throw Error('Original source hash changed. Stop; do not substitute an enhanced photo.');
 await mkdir(folder,{recursive:true});await copyFile(s.path,join(folder,'original-reference.jpeg'));
 const env={...loadEnv('development',root,''),...process.env},guide=join(folder,'original-guide.png');
 await promisify(execFile)(env.FFMPEG_PATH||'ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y','-i',s.path,'-vf','scale=1536:1536:force_original_aspect_ratio=decrease','-frames:v','1',guide],{windowsHide:true});
 const png=await readFile(guide),manifest={version:1,original:join(folder,'original-reference.jpeg'),originalPath:s.path,originalSha256:sha(bytes),guide,guideSha256:sha(png),guideWidth:png.readUInt32BE(16),guideHeight:png.readUInt32BE(20),preparation:'EXIF-aware decode, uniform resize and PNG only. NO photographic finish, retouch, overlays or generated pixels.',product:'Nine original cinnamon rolls in white baking pan',ownerApproved:false,cases:Object.entries(prompts).map(([id,prompt])=>({id,prompt,seed:42}))};
 await writeFile(join(folder,'input.json'),JSON.stringify(manifest,null,2));return manifest;
}
async function main(){
 const args=process.argv.slice(2),option=(key,fallback)=>{const i=args.indexOf(key);return i===-1?fallback:args[i+1];},kind=option('--case','lighting'),precision=option('--precision','fp8');
 if(args.includes('--prepare')){await prepareQwen();console.log('Prepared ORIGINAL reference and exact prompts locally. No generated image.');}
 const graph=await qwenGraph(kind,precision),comfy=process.env.BENCHMARK_COMFY_URL||'http://127.0.0.1:8188',proxy=process.env.COMFY_BASE_URL||'http://127.0.0.1:8189';
 for(const u of [comfy,proxy])if(!['127.0.0.1','localhost','[::1]'].includes(new URL(u).hostname))throw Error('Use local services or an explicitly approved SSH loopback tunnel, not public HTTP.');
 const read=async path=>{const r=await fetch(comfy+path,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error(path+': HTTP'+r.status);return r.json();};
 const [nodes,stats]=await Promise.all([read('/object_info'),read('/system_stats')]);
 const readiness={...inspectQwen(graph,nodes),precision,comfyVersion:stats.system?.comfyui_version,devices:stats.devices,ramTotal:stats.system?.ram_total,ramFree:stats.system?.ram_free,checked:new Date().toISOString(),inferenceRun:false};await mkdir(folder,{recursive:true});await writeFile(join(folder,'readiness.json'),JSON.stringify(readiness,null,2));console.log(JSON.stringify(readiness));
 if(!args.includes('--render')){console.log('CHECK ONLY: no model run, downloads, private upload or paid operation.');return;}
 if(!args.includes('--approved'))throw Error('Rendering requires explicit model/use approval and --approved.');
 // Windows-local execution only in this milestone. Future remote execution must
 // integrate a separately approved quote/lease and termination gate first.
 if(stats.system?.os!=='win32'||args.includes('--remote'))throw Error('Remote rendering is not enabled by this preparation. Obtain separate deployment/upload approval and integrate the existing lease gate.');
 if(!readiness.ready)throw Error('Required weights/nodes missing; NO fallback or download.');
 const input=JSON.parse(await readFile(join(folder,'input.json'),'utf8'));if(sha(await readFile(input.original))!==input.originalSha256||sha(await readFile(input.guide))!==input.guideSha256)throw Error('Reference changed.');
 const queue=await read('/queue');if(queue.queue_running?.length||queue.queue_pending?.length)throw Error('Shared ComfyUI is busy. Do not interrupt Director.');
 const destination=join(folder,kind+'-'+precision+'-seed42');try{await stat(join(destination,'render.json'));throw Error('Attempt already exists; inspect it, no automatic rerender.');}catch(e){if(e.code!=='ENOENT')throw e;}
 await mkdir(destination,{recursive:true});const pins=JSON.parse(await readFile(join(root,'adstudio/benchmark/qwen-hero-pins.json'),'utf8')),record={version:1,status:'preparing',input,graph,graphSha256:sha(JSON.stringify(graph)),pins,stats:{system:{os:stats.system?.os,comfyui_version:stats.system?.comfyui_version,pytorch_version:stats.system?.pytorch_version,ram_total:stats.system?.ram_total},devices:stats.devices},case:kind,precision,ownerApproved:false,started:new Date().toISOString()};
 const save=()=>writeFile(join(destination,'render.json'),JSON.stringify(record,null,2));await save();
 const modelsDir=option('--models-dir','');if(!modelsDir)throw Error('Pass the actual ComfyUI --models-dir to verify the selected weights before inference.');
 const selected=pins.files.filter(f=>!f.file.includes(precision==='fp8'?'_bf16':'_fp8mixed'));for(const file of selected){const path=join(resolve(modelsDir),file.file),info=await stat(path);if(info.size!==file.bytes)throw Error('Weight size mismatch: '+file.file);const h=createHash('sha256');for await(const chunk of createReadStream(path))h.update(chunk);if(h.digest('hex')!==file.sha256)throw Error('Weight hash mismatch: '+file.file);}record.weightsVerified=true;await save();
 process.env.COMFY_BASE_URL=proxy;const client=new Comfy(),workflow=client.workflows.fromJson(graph);workflow.setInput('4','image',client.assets.fromFile(input.guide));const start=Date.now();let job;
 try{job=await client.submit(workflow);record.jobId=job.id;record.status='running';await save();await job.wait(30*60*1000);await job.result();const output=job.getOutputs('15')[0];if(!output)throw Error('No raw SaveImage output');await output.toFile(join(destination,'raw.png'));record.rawSha256=sha(await readFile(join(destination,'raw.png')));record.status='complete';}catch(e){record.status='failed-or-interrupted';record.error=String(e);if(job){try{await job.cancel(AbortSignal.timeout(5000));record.cancelRequested=true;}catch(cancelError){record.cancelError=String(cancelError);}}throw e;}finally{record.seconds=(Date.now()-start)/1000;await save();}
 console.log('Saved RAW model output without typography, logo or finishing:',destination);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
