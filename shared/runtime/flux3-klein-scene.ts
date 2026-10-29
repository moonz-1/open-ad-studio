/** FLUX 3 Image Klein distilled multi-ref (mi2i) — optional Creative Restage engine.
 * Primary: flux3_klein_bf16_mi2i.json (reviewed source + identity). Explicit engine; no fallback.
 * Fail-closed until: workflow pinned + (local weights | ADSTUDIO_FLUX3_REMOTE_WEIGHTS=1) + ADSTUDIO_FLUX3_INFERENCE=1.
 * Optional cloud: Secure RunPod L40S via SSH tunnel to loopback Comfy — never public HTTP. */
import type {Comfy} from '@comfyorg/sdk';
import {createHash,randomBytes} from 'node:crypto';
import {access,mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {HeroError,heroSha,heroSource} from './hero-ad.ts';
import type {CompositionPlan} from '../lib/composition-dynamics.ts';
import {dynamicsToFlux3Spatial,flux3CaptionViolatesConstraints,type Flux3SpatialPlan} from '../lib/flux3-spatial.ts';
import type {AdScene} from '../lib/ad-scene.ts';
const workflows=join(dirname(fileURLToPath(import.meta.url)),'../workflows');
const MI2I_NAME='flux3_klein_bf16_mi2i.json';
const I2I_NAME='flux3_klein_bf16_i2i.json';
const CONTRACT_NAME='flux3_klein_bf16_mi2i_contract.json';

export type Flux3Mode='mi2i'|'i2i';
export type Flux3Contract={
 id:string;
 status:string;
 license:string;
 workflowFile:string;
 i2iWorkflowFile?:string;
 graphSha256:string|null;
 i2iGraphSha256?:string|null;
 officialWorkflowOid?:string;
 comfyUiMinVersion?:string;
 files:{file:string;bytes:number|null;sha256:string|null;license:string;gated?:boolean}[];
 defaults:{steps:number;guidance:number|null;promptUpsampler:boolean;checkpoint:string;references?:string[]};
 requiredNodes?:string[];
 note?:string;
};

function recursiveSort(v:any):any{
 if(Array.isArray(v))return v.map(recursiveSort);
 if(v&&typeof v==='object'){
  // Integer-like object keys are reordered by JSON.stringify in V8; emit sorted entries as arrays.
  return Object.keys(v).sort().map(k=>[k,recursiveSort(v[k])]);
 }
 return v;
}
/** Stable pin hash (avoids V8 integer-key reordering in JSON.stringify). */
export function flux3CanonSha(graph:any){
 return createHash('sha256').update(JSON.stringify(recursiveSort(graph))).digest('hex');
}

export async function flux3Contract():Promise<Flux3Contract>{
 return JSON.parse(await readFile(join(workflows,CONTRACT_NAME),'utf8'));
}

export async function flux3WorkflowPresent(mode:Flux3Mode='mi2i'):Promise<boolean>{
 try{await access(join(workflows,mode==='mi2i'?MI2I_NAME:I2I_NAME));return true;}catch{return false;}
}

export async function loadFlux3Workflow(mode:Flux3Mode='mi2i'){
 const pins=await flux3Contract();
 const expected=mode==='mi2i'?pins.graphSha256:pins.i2iGraphSha256;
 const file=mode==='mi2i'?MI2I_NAME:(pins.i2iWorkflowFile||I2I_NAME);
 if(!expected)throw new HeroError(503,'FLUX 3 Image Klein workflow is not pinned yet.');
 const path=join(workflows,file);
 try{await access(path);}catch{throw new HeroError(503,`Missing ${file}.`);}
 const g=JSON.parse(await readFile(path,'utf8'));
 if(flux3CanonSha(g)!==expected)throw new HeroError(503,'Pinned FLUX 3 Image Klein workflow changed. No inference started.');
 return {graph:g,pins,mode,file};
}

export function flux3InferenceAuthorized(env:Record<string,string|undefined>=process.env):boolean{
 return env.ADSTUDIO_FLUX3_INFERENCE==='1';
}

export function flux3Resources(stats:any,queue:any,busy=false){
 if(!Array.isArray(queue?.queue_running)||!Array.isArray(queue?.queue_pending))return {available:false,status:'queue-unknown',reason:'Cannot verify the ComfyUI queue.',vramFreeBytes:0,ramFreeBytes:0};
 if(busy||queue?.queue_running?.length||queue?.queue_pending?.length)
  return{available:false,status:'busy',reason:'ComfyUI queue is busy.',vramFreeBytes:0,ramFreeBytes:0};
 if(!stats?.system||!Array.isArray(stats.devices))
  return{available:false,status:'offline',reason:'Cannot verify ComfyUI runtime.',vramFreeBytes:0,ramFreeBytes:0};
 const d=stats.devices.find((x:any)=>x.type==='cuda');
 const free=d&&d.vram_free+Math.max(0,d.torch_vram_total-d.torch_vram_free);
 const ram=stats.system.ram_free;
 if(!Number.isFinite(free)||!Number.isFinite(ram)||free<18*1024**3||ram<12*1024**3)
  return{available:false,status:'insufficient-vram',reason:'FLUX 3 Image Klein BF16 mi2i needs ≥18 GiB reclaimable VRAM and ≥12 GiB free RAM (L40S 48GB target; sequential pup offload allowed).',vramFreeBytes:free,ramFreeBytes:ram};
 return{available:true,status:'available',reason:'Admission for distilled BF16 mi2i + prompt upsampler (16 steps, cfg 1).',vramFreeBytes:free,ramFreeBytes:ram};
}

async function missingWeightFiles(modelsDir:string|undefined,files:Flux3Contract['files'],env:Record<string,string|undefined>){
 if(env.ADSTUDIO_FLUX3_REMOTE_WEIGHTS==='1')return [];
 const missing:string[]=[];
 for(const f of files){
  if(f.bytes==null){missing.push(f.file+' (byte pin pending — download gated)');continue;}
  try{if(!modelsDir||(await stat(join(modelsDir,f.file))).size!==f.bytes)missing.push(f.file);}
  catch{missing.push(f.file);}
 }
 return missing;
}

export async function flux3Availability(modelsDir:string|undefined,stats:any,queue:any,busy=false,env:Record<string,string|undefined>=process.env,nodes?:Record<string,any>){
 const pins=await flux3Contract();
 const resources=flux3Resources(stats,queue,busy);
 let workflowReady=false;let graph:any;try{graph=(await loadFlux3Workflow('mi2i')).graph;workflowReady=true;}catch{}
 const nodeIssues=nodes?flux3NodeIssues(graph||{},nodes):['ComfyUI workflow components have not been checked.'];
 const skipPup=env.ADSTUDIO_FLUX3_SKIP_PUP==='1';
 const i2iReady=(await flux3WorkflowPresent('i2i'))&&!!pins.i2iGraphSha256;
 const missingFiles=await missingWeightFiles(modelsDir,pins.files,env);
 const authorized=flux3InferenceAuthorized(env);
 const ready=authorized&&workflowReady&&!missingFiles.length&&resources.available&&!nodeIssues.length;
 return{
  id:'flux3_klein',
  label:'FLUX 3 Image Klein distilled BF16 mi2i (evaluation)',
  license:pins.license,
  model:'flux3-klein-scene',
  fidelityMode:'creative-restage',
  mode:'mi2i' as Flux3Mode,
  i2iFallbackReady:i2iReady,
  available:ready,
  firstRunAvailable:false,
  installed:workflowReady&&!missingFiles.length,
  tested:false,
  workflowReady,
  authorized,
  missingFiles,
  officialWorkflowOid:pins.officialWorkflowOid,
  comfyUiMinVersion:pins.comfyUiMinVersion||'0.41.0',
  requiredNodes:pins.requiredNodes||[],
  nodeIssues,
  promptUpsampler:{enabled:!skipPup,compatibilityBypass:skipPup,note:skipPup?'Compatibility mode: prompt upsampler bypassed; the reviewed Dynamics prompt feeds the text encoder directly. Full intended upsampler workflow is not active.':'Prompt upsampler enabled; backend compatibility still requires live validation.'},
  status:!authorized?'awaiting-owner-auth':!workflowReady?'workflow-pending':missingFiles.length?'not-installed':nodeIssues.length?'nodes-unavailable':!resources.available?resources.status:'ready',
  reason:!authorized
   ?'FLUX 3 optional. Unset ADSTUDIO_FLUX3_INFERENCE keeps Product-safe / Klein paths. Set =1 only with HF license + weights/RunPod.'
   :!workflowReady
    ?(pins.note||'mi2i workflow not vendored/pinned yet.')
    :missingFiles.length
     ?`Missing FLUX 3 weights: ${missingFiles.join(', ')} (or set ADSTUDIO_FLUX3_REMOTE_WEIGHTS=1 when weights live on the tunneled Comfy host)`
     :nodeIssues.length?nodeIssues.join(' ')
     :!resources.available?resources.reason
     :skipPup?'FLUX 3 ready in compatibility mode: prompt upsampler bypassed; Dynamics prompt is encoded directly.':'FLUX 3 Image Klein BF16 mi2i ready (16 steps, cfg 1, dual-ref + prompt upsampler).',
  resources,
  defaults:pins.defaults,
  partnerNodeForbidden:true,
  pastePathForbidden:true,
  remote:{preferredGpu:'RunPod L40S 48GB Secure Cloud',transport:'SSH local-forward 8188 only — never public Comfy',diskHintGiB:40},
 };
}

export function prepareFlux3Spatial(dynamics:CompositionPlan,environment?:string):Flux3SpatialPlan{
 return dynamicsToFlux3Spatial(dynamics,{environment});
}

export function gateFlux3ExpandedCaption(caption:string,dynamics:CompositionPlan){
 const violations=flux3CaptionViolatesConstraints(caption,dynamics);
 if(violations.length)throw new HeroError(422,'Prompt upsampler caption violates Dynamics constraints: '+violations.join(' '));
 return violations;
}

/** Apply dual references + user prompt into a cloned mi2i graph (no submit).
 * Node 48 keeps the pup system prompt; node 49 is the short user request. */
export function bindFlux3Mi2iInputs(graph:any,opts:{prompt:string;seed:number;sourceImage:string;identityImage:string;filenamePrefix?:string},env:Record<string,string|undefined>=process.env){
 const g=structuredClone(graph);
 if(g['49']?.class_type==='PrimitiveStringMultiline')g['49'].inputs.value=opts.prompt;
 if(g['7']?.class_type==='KSampler'){g['7'].inputs.seed=opts.seed;g['7'].inputs.steps=16;g['7'].inputs.cfg=1;}
 if(g['9']?.class_type==='SaveImage')g['9'].inputs.filename_prefix=opts.filenamePrefix||'adstudio/flux3-mi2i';
 if(g['11']?.class_type==='LoadImage')g['11'].inputs.image=opts.sourceImage;
 if(g['111']?.class_type==='LoadImage')g['111'].inputs.image=opts.identityImage;
 // A40/torch stacks can crash TextGenerate (Flash Attention strides). Skip pup via ComfySwitch; Dynamics prompt still feeds CLIPTextEncode.
 if(env.ADSTUDIO_FLUX3_SKIP_PUP==='1'&&g['51']?.class_type==='ComfySwitchNode')g['51'].inputs.switch=true;
 return g;
}

function inspectFlux3Png(bytes:Buffer){
 if(bytes.length<60||bytes.length>32*1024*1024||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
  throw new HeroError(422,'FLUX 3 returned an invalid PNG.');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 if(!width||!height||width>4096||height>4096)throw new HeroError(422,'FLUX 3 PNG dimensions out of range.');
 return {width,height};
}

/** Validate enums and node presence before advertising a compatible backend. */
export function flux3NodeIssues(graph:Record<string,any>,nodes:Record<string,any>){
 const issues:string[]=[];
 for(const node of Object.values(graph)){
  const spec=nodes[node.class_type];if(!spec){issues.push('Missing '+node.class_type+'.');continue;}
  for(const [key,value]of Object.entries(node.inputs||{})){
   if(Array.isArray(value)||node.class_type==='LoadImage'&&key==='image')continue;
   const choices=spec.input?.required?.[key]?.[0]||spec.input?.optional?.[key]?.[0];
   if(Array.isArray(choices)&&!choices.includes(value))issues.push('Unsupported '+node.class_type+'.'+key+'.');
  }
 }
 return [...new Set(issues)];
}
/** Match BOTH executed input references to this request, never a sample image. */
export async function verifyFlux3References(native:any,hashes:string[],base:string,signal:AbortSignal){
 const u=new URL(base);if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password)throw new HeroError(503,'FLUX 3 requires a loopback ComfyUI connection or SSH tunnel.');
 for(const [i,node]of ['11','111'].entries()){
  const name=native.prompt?.[2]?.[node]?.inputs?.image;
  if(typeof name!=='string'||name.length>240||name.startsWith('/')||name.includes('..')||name.includes('\\')||!/^[-A-Za-z0-9_./ ()]+$/.test(name))throw new HeroError(422,'Invalid executed FLUX reference identity.');
  const slash=name.lastIndexOf('/'),url=new URL('/view',u);url.search=new URLSearchParams({type:'input',filename:name.slice(slash+1),subfolder:slash<0?'':name.slice(0,slash)}).toString();
  const r=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});if(!r.ok||!r.body)throw new HeroError(422,'Executed FLUX reference could not be verified.');
  const chunks:Uint8Array[]=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>8*1024*1024)throw new HeroError(422,'Executed FLUX reference exceeds the input limit.');chunks.push(chunk);}
  if(heroSha(Buffer.concat(chunks))!==hashes[i])throw new HeroError(422,'Executed FLUX reference differs from the reviewed customer image.');
 }
}
/** SDK/proxy inference only; native HTTP below is read-only receipt verification. */
export async function executeFlux3Sdk(c:Comfy,graph:Record<string,any>,sourcePath:string,identityPath:string,base:string,signal:AbortSignal,onProgress?:(m:string,p?:number)=>void){
 const wf=c.workflows.fromJson(graph);wf.setInput('11','image',c.assets.fromFile(sourcePath));wf.setInput('111','image',c.assets.fromFile(identityPath));
 if(signal.aborted)throw new HeroError(499,'FLUX 3 generation cancelled before submission.');
 const job=await c.submit(wf,{signal}),events=new AbortController();
 const stream=(async()=>{try{for await(const e of job.events(events.signal)){if(e.kind==='progress')onProgress?.('FLUX 3 generating'+(e.step?' · step '+e.step+'/'+e.steps:''),e.value);}}catch{}})();
 try{
  await job.wait(600000,signal);await job.result(signal);
  const response=await fetch(new URL('/history/'+encodeURIComponent(job.id),base),{signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});if(!response.ok)throw new HeroError(502,'FLUX 3 native receipt could not be read.');
  const history=await response.json(),native=history[job.id];if(native?.status?.completed!==true||native.status.status_str!=='success')throw new HeroError(502,'FLUX 3 native successful completion was not confirmed.');
  if(native.status.messages?.some((row:any)=>row[0]==='execution_cached'&&row[1]?.nodes?.includes('7')))throw new HeroError(502,'FLUX 3 sampler was cached; no fresh inference was confirmed.');
  await verifyFlux3References(native,[heroSha(await readFile(sourcePath)),heroSha(await readFile(identityPath))],base,signal);
  const output=job.getOutputs('9')[0];if(!output)throw new HeroError(502,'FLUX 3 returned no image on its output node.');
  return {promptId:job.id,bytes:Buffer.from(await output.toBytes({timeoutMs:15000,signal})),executed:native};
 }catch(error){(error as any).jobId=job.id;throw error;}finally{events.abort();void stream;}
}

/** Creative Restage via FLUX 3 mi2i. Identity defaults to the source when omitted. */
export async function renderFlux3KleinScene(
 outputs:string,
 modelsDir:string|undefined,
 stats:any,
 queue:any,
 c:Comfy,
 prompt:string,
 seed:number,
 image:string,
 identityImage:string|undefined,
 archetype:AdScene['archetype'],
 base:string,
 signal:AbortSignal,
 onProgress?:(m:string,p?:number)=>void,
 env:Record<string,string|undefined>=process.env,
 nodes?:Record<string,any>
):Promise<AdScene>{
 if(!flux3InferenceAuthorized(env))
  throw new HeroError(403,'FLUX 3 inference blocked. Set ADSTUDIO_FLUX3_INFERENCE=1 only with HF license + authorized weights/RunPod.');
 const avail=await flux3Availability(modelsDir,stats,queue,false,env,nodes);
 if(!avail.available)throw new HeroError(503,avail.reason);
 const loaded=await loadFlux3Workflow('mi2i');
 const source=await heroSource(outputs,image);
 let identityBytes=source.bytes;
 let identitySha=source.sha256;
 if(identityImage&&identityImage!==image){
  const idSource=await heroSource(outputs,identityImage);
  identityBytes=idSource.bytes;identitySha=idSource.sha256;
 }
 const id=randomBytes(8).toString('hex');
 const dir=join(outputs,'hero-flux3',id);
 await mkdir(dir,{recursive:true});
 await writeFile(join(dir,'reference.png'),source.bytes,{flag:'wx'});
 await writeFile(join(dir,'identity.png'),identityBytes,{flag:'wx'});
 const sourceName='flux3-source-'+id+'.png';
 const identityName='flux3-identity-'+id+'.png';
 const bound=bindFlux3Mi2iInputs(loaded.graph,{
  prompt,
  seed,
  sourceImage:sourceName,
  identityImage:identityName,
  filenamePrefix:'adstudio/flux3-mi2i-'+id
 },env);
 await writeFile(join(dir,'request.json'),JSON.stringify({prompt,seed,sourceSha256:source.sha256,identitySha256:identitySha,workflowSha:flux3CanonSha(loaded.graph)},null,2));
 const start=Date.now();
 const result=await executeFlux3Sdk(c,bound,join(dir,'reference.png'),join(dir,'identity.png'),base,signal,onProgress);
 await writeFile(join(dir,'native-history.json'),JSON.stringify(result.executed,null,2));
 if(result.bytes.length>32*1024*1024)throw new HeroError(422,'FLUX 3 output exceeds size limit.');
 await writeFile(join(dir,'received.png'),result.bytes,{flag:'wx'});
 const checked=inspectFlux3Png(result.bytes);
 await writeFile(join(dir,'raw.png'),result.bytes,{flag:'wx'});
 await writeFile(join(outputs,id+'.png'),result.bytes,{flag:'wx'});
 const response:AdScene={
  url:'/outputs/'+id+'.png',
  sha256:heroSha(result.bytes),
  width:checked.width,
  height:checked.height,
  seconds:(Date.now()-start)/1000,
  model:'flux3-klein-scene' as AdScene['model'],
  jobId:result.promptId,
  provenanceId:id,
  prompt,
  seed,
  workflowSha256:heroSha(JSON.stringify(result.executed.prompt[2])),
  sourceSha256:source.sha256,
  archetype,
  fidelityMode:'creative-restage',
  warning:'Creative Restage · FLUX 3 Image Klein BF16 mi2i. AI re-photographs from source + identity refs. Packaging/geometry may change. Compare with the original; not product-safe.'
 };
 await writeFile(join(dir,'provenance.json'),JSON.stringify({...response,identitySha256:identitySha,promptUpsamplerBypassed:env.ADSTUDIO_FLUX3_SKIP_PUP==='1',transport:'Comfy SDK -> comfy-api-proxy -> ComfyUI',weights:loaded.pins.files,ownerApproved:false},null,2));
 await writeFile(join(outputs,'hero-flux3','verified-scene.json'),JSON.stringify({jobId:result.promptId,workflowSha256:loaded.pins.graphSha256,comfyVersion:stats.system?.comfyui_version,gpu:stats.devices?.[0]?.name},null,2));
 return response;
}
