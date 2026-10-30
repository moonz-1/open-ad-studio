import {inspectScenePixels} from './scene-inspection.ts';
import {verifyPlanningExecution,cancelOwnedPlanningJob} from './creative-proof.ts';
import {filmGraph,filmReadiness,physicalFreeMiB,filmModel} from './film.ts';
import {ErrorJournal} from './error-log.ts';
import {geometryGraph,geometryBase,trainingObj} from '../lib/geometry.ts';
import {trainingInput,trainingGraph,trainingRuns,saveTrainingRun,trainingBase,videoTrainingBase,geometryTrainingBase,trainingKind,type TrainingRun} from './training.ts';
import {searchInput,searchResults} from './semantic-search.ts';
/**
 * Local generation API for both apps, as a Vite plugin (dev + preview).
 *
 *   browser → Vite (/api/*, /outputs/*) → @comfyorg/sdk → comfy-api-proxy :8189 → ComfyUI :8188
 *
 * Security model:
 * - ComfyUI and comfy-api-proxy stay on 127.0.0.1; only Vite is ever exposed.
 * - /api is open to localhost only. From any other Host (e.g. a tunnel domain) it requires
 *   OSH_TOKEN: open the site once with ?token=… and an HttpOnly cookie is set.
 * - Inputs are validated, bodies are size-capped, jobs run one at a time with a short queue,
 *   and /outputs only serves files this API wrote (random hex names).
 */
import { RuntimeSetup, setupAccess } from './setup.ts';
import { startComfyProxy } from './proxy.ts';
import {PromptRewriter,PromptRewriteError,promptInstruction,promptModel,promptDevice} from './prompt-rewriter.ts';
import {precisionSources} from './precision-image.ts';
import {captionSegments,captionSrt} from '../lib/captions.ts';
import { JobActivity, phaseForProgress } from './job-activity.ts';
import {ComfyDiagnostics,loadingLog,nodeProgressMessage} from './comfy-diagnostics.ts';
import { Comfy } from "@comfyorg/sdk";
import { spawn } from "node:child_process";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { readFile, writeFile, unlink } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Connect, Plugin } from "vite";
import { imageModel, videoModel, qwenImageModel, zImageBaseModel, ltx25Model, ltxv13bModel, type ModelChoice } from './model-catalog.ts';

/** How each selectable model maps onto a workflow: which loader inputs to fill, and which filenames work there (best first). */
type Recipe={choice:ModelChoice;graph:string;needs:[node:string,classType:string,input:string,files:string[]][];settings?:Record<string,Record<string,unknown>>};
const imageRecipes:Recipe[]=[
  {choice:qwenImageModel,graph:'keyframe_qwen',needs:[['1','UNETLoader','unet_name',['qwen_image_2512_fp8_e4m3fn.safetensors','qwen_image_2512_bf16.safetensors']],['2','CLIPLoader','clip_name',['qwen_2.5_vl_7b_fp8_scaled.safetensors','qwen_2.5_vl_7b.safetensors']],['3','VAELoader','vae_name',['qwen_image_vae.safetensors']]]},
  {choice:zImageBaseModel,graph:'keyframe_zimage',needs:[['1','UNETLoader','unet_name',['z_image_bf16.safetensors']],['2','CLIPLoader','clip_name',['qwen_3_4b_fp8_mixed.safetensors','qwen_3_4b.safetensors']],['3','VAELoader','vae_name',['ae.safetensors']]],settings:{'8':{steps:50,cfg:4}}},
  {choice:imageModel,graph:'keyframe_zimage',needs:[['1','UNETLoader','unet_name',['z_image_turbo_bf16.safetensors']],['2','CLIPLoader','clip_name',['qwen_3_4b_fp8_mixed.safetensors','qwen_3_4b.safetensors']],['3','VAELoader','vae_name',['ae.safetensors']]]},
];
const videoRecipes:Recipe[]=[
  {choice:ltx25Model,graph:'shot_ltx25',needs:[['1','UNETLoader','unet_name',['ltx-2.5-22b-distilled-transformer-bf16.safetensors','ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors','ltx-2.5-22b-distilled-transformer-nvfp4.safetensors']],['2','CLIPLoader','clip_name',['gemma4-12b-with-proj-ltx-2.5-bf16.safetensors','gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors']],['10','VAELoader','vae_name',['ltx-2.5-audio-vae-bf16.safetensors']],['21','VAELoader','vae_name',['ltx-2.5-video-vae-bf16.safetensors']],['20','LatentUpscaleModelLoader','model_name',['ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors']]]},
  {choice:ltxv13bModel,graph:'shot_ltxv',needs:[['1','CheckpointLoaderSimple','ckpt_name',['ltxv-13b-0.9.8-distilled-fp8.safetensors','ltxv-13b-0.9.8-distilled.safetensors']],['2','CLIPLoader','clip_name',['t5xxl_fp8_e4m3fn_scaled.safetensors']]]},
  {choice:videoModel,graph:'shot_ltxv',needs:[['1','CheckpointLoaderSimple','ckpt_name',['ltxv-2b-0.9.8-distilled.safetensors']],['2','CLIPLoader','clip_name',['t5xxl_fp8_e4m3fn_scaled.safetensors']]]},
];
/** Installed model id -> recipe plus the actual filenames found for each loader. */
type Resolved={recipe:Recipe;files:Record<string,string>};
const resolvedModels=new Map<string,Resolved>();
function resolveRecipes(recipes:Recipe[],nodes:any,graphs:Record<string,Record<string,any>>):ModelChoice[]{
  const out:ModelChoice[]=[];
  for(const recipe of recipes){
    const graph=graphs[recipe.graph];if(!graph||!Object.values(graph).every((n:any)=>Boolean(nodes[n.class_type])))continue;
    const files:Record<string,string>={};let ok=true;
    for(const[node,classType,input,names]of recipe.needs){const options:unknown=nodes[classType]?.input?.required?.[input]?.[0];const found=Array.isArray(options)?names.find(n=>options.includes(n)):undefined;if(!found){ok=false;break}files[node]=found}
    if(!ok)continue;const id=files[recipe.needs[0][0]];resolvedModels.set(id,{recipe,files});out.push({...recipe.choice,id});
  }
  return out;
}
function applyResolved(graph:Record<string,any>,resolved:Resolved){
  for(const[node,,input]of resolved.recipe.needs)graph[node].inputs[input]=resolved.files[node];
  for(const[node,values]of Object.entries(resolved.recipe.settings||{}))Object.assign(graph[node].inputs,values);
  return graph;
}
import { identifyHardware, serverTiming, recordRender } from './render-timings.ts';
import { productFormats, productPlan, renderProduct, ProductRenderError, type ProductRatio, type ProductMode, type CameraMotion } from './product-video.ts';
import {importMedia,composeAd,ComposeError,mediaTypes} from './ad-compose.ts';
import {importReferenceVideo,analyzeReferenceVideo,assembleCommercial,searchInspiration,researchQueries,ReferenceError} from './reference-analyze.ts';
import {planFromReference,planOriginalCampaign} from '../lib/reference-video.ts';
import {buildCreativeIntelligence} from '../lib/creative-intelligence.ts';
import {planCampaignSound,soundCapabilitiesNote} from '../lib/sound-director.ts';
import {analyzeOutputAudio,extractReferenceAudio,importSoundtrack,mixCampaignSound,SoundError} from './sound-mix.ts';
import {analysisStatus,collectBrandImage} from './brand-research.ts';
import {BrandError} from './brand-web.ts';
import {exportStaticAd,StaticAdError} from './static-ad.ts';
import {finishHero,exportHeroAd,heroSource,heroSha,HeroError} from './hero-ad.ts';
import {validateHeroSettings} from '../lib/hero-ad.ts';
import {generateQwenHero,qwenAvailability,verifyWeightFiles,qwenContract} from './qwen-hero.ts';
import {qwenSDKTransport} from './qwen-sdk.ts';
import {createQwenRelay} from './qwen-relay.ts';
import {acceptanceGate,acceptanceRequest,claimAcceptanceJob} from './qwen-app-session.ts';
import {createBrandService} from './brand-service.ts';
import {campaignAvailability,renderProductCampaign} from './product-campaign.ts';
import {sceneAvailability,renderKleinScene,validateSceneRequest,validateCampaignRequest} from './klein-scene.ts';
import {flux3Availability,flux3InferenceAuthorized,renderFlux3KleinScene} from './flux3-klein-scene.ts';
import {comfyCloudFluxAvailability,renderFlux3ComfyCloudScene} from './comfy-cloud-flux.ts';
import {ensureFluxGpuSession,releaseFluxGpuSession,resumeFluxLeaseGuard,planFluxProvision,CUSTOMER_STAGES,type FluxSession} from './runpod-flux-controller.ts';
import {autoprovEnabled,liveProvisionAuthorized} from './runpod-flux-budget.ts';
import {kleinAvailability,renderKleinBackground,validateBackgroundRequest,releaseKleinCache} from './klein-background.ts';
import {brandBackendStatus} from './brand-analysis.ts';
import {createCreativeEngine,creativeTextReadiness,creativeTextRouting,creativeSDKText,creativeTextDeadlineMs,waitCreativeTextJob,textDeadlineError,CreativeError,type CreativeBackend} from './creative-engine.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WORKFLOWS = join(ROOT, "shared", "workflows");
const OUTPUTS = join(ROOT, "outputs");
const FPS = 24;
const MAX_BODY = 64 * 1024;
const MAX_UPLOAD_BODY = 8 * 1024 * 1024;
const MAX_QUEUE = 4;
const OUTPUT_NAME = /^[a-f0-9]{16}\.(png|obj|glb|webm|mp4|flac|mp3|wav|m4a|ogg|srt|safetensors)$/;

type Env = Record<string, string | undefined>;
type Key = { image: string; t: number; strength?: number };

// ---------------- ComfyUI side ----------------

let comfy: Comfy | null = null;
const activity=new JobActivity();
const diagnostics=new ComfyDiagnostics(),clientUrls=new WeakMap<Comfy,string>(),deploymentClients=new Map<string,Comfy>();
function client(env: Env): Comfy {
  const base=env.COMFY_BASE_URL||'http://127.0.0.1:8189',native=env.COMFYUI_URL||'http://127.0.0.1:8188',key=base+'|'+native;
  let value=deploymentClients.get(key);if(!value){const previous=process.env.COMFY_BASE_URL;try{process.env.COMFY_BASE_URL=base;value=new Comfy();deploymentClients.set(key,value);}finally{if(previous===undefined)delete process.env.COMFY_BASE_URL;else process.env.COMFY_BASE_URL=previous;}}clientUrls.set(value,native);return value;
}

async function up(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

/** Start comfy-api-proxy (pip tool) in front of ComfyUI if it isn't running. */
const proxyStarts=new Map<string,Promise<void>>();
async function ensureProxy(env:Env):Promise<void>{
 const key=(env.COMFY_BASE_URL||'http://127.0.0.1:8189')+'|'+(env.COMFYUI_URL||'http://127.0.0.1:8188');
 const pending=proxyStarts.get(key);if(pending)return pending;
 const work=startProxyProcess(env);proxyStarts.set(key,work);try{await work}finally{proxyStarts.delete(key)}
}
const startProxyProcess=(env:Env)=>startComfyProxy(ROOT,env);

async function loadGraph(name: string): Promise<Record<string, any>> {
  return JSON.parse(await readFile(join(WORKFLOWS, `${name}.json`), "utf8"));
}

function outputName(ext: string): string {
  mkdirSync(OUTPUTS, { recursive: true });
  return `${randomBytes(8).toString("hex")}.${ext}`;
}

async function save(job: Awaited<ReturnType<Comfy["run"]>>, node: string, ext: "png" | "webm" | "flac"): Promise<string> {
  const out = job.getOutputs(node)[0];
  if (!out) throw new Error(`workflow produced no output on node ${node}`);
  const name = outputName(ext);
  await out.toFile(join(OUTPUTS, name));
  return `/outputs/${name}`;
}

/** /outputs/<name> as returned by this API -> absolute path. Rejects anything else. */
function outputPath(url: unknown): string {
  const name = typeof url === "string" ? url.replace(/^\/outputs\//, "") : "";
  if (!OUTPUT_NAME.test(name)) throw new HttpError(400, "image must be an /outputs/… file from this API");
  const p = join(OUTPUTS, name);
  if (!existsSync(p)) throw new HttpError(400, `missing output ${name}`);
  return p;
}

function creativeTextExecution(c:Comfy,signal=AbortSignal.timeout(creativeTextDeadlineMs),onSubmitted?:(jobId:string)=>void){return {
 submit:async(wf:Parameters<Comfy['run']>[0])=>{const job=await c.submit(wf,{signal});onSubmitted?.(job.id);return job;},
 wait:(job:Parameters<typeof waitCreativeTextJob>[0])=>waitCreativeTextJob(job,signal),
 cancel:(job:Awaited<ReturnType<Comfy['submit']>>)=>cancelOwnedPlanningJob(job,clientUrls.get(c)||'http://127.0.0.1:8188'),
 failed:async(job:Awaited<ReturnType<Comfy['submit']>>,error:unknown,started:number,cancellation:string)=>{
  // Read only this text job's state, never its prompt or an unrelated job.
  const base=clientUrls.get(c)||'http://127.0.0.1:8188',read=async(path:string)=>{try{const r=await fetch(base+path,{signal:AbortSignal.timeout(2000)});return r.ok?await r.json():null;}catch{return null;}};
  const [queue,history]=await Promise.all([read('/queue'),read('/history/'+encodeURIComponent(job.id))]),native=history?.[job.id];
  const state=native?.status?.status_str||(queue?.queue_running?.some((r:any)=>r[1]===job.id)?'running':queue?.queue_pending?.some((r:any)=>r[1]===job.id)?'queued':'unknown'),message=String((error as Error)?.message||'Text execution failed').replace(/[\r\n]/g,' ').slice(0,180);
  return new CreativeError(textDeadlineError(error)?504:502,`${message}; text job ${job.id}, elapsed ${Date.now()-started} ms, native ${state}, cancellation ${cancellation}. No retry.`);
 }
};}
/** Run a workflow; retry once if the proxy reports the job expired (happens right after a proxy restart). */
async function runWf(c: Comfy, wf: Parameters<Comfy['run']>[0], requestId?:string,retryExpired=true,timeoutMs=30*60*1000,textExecution?:ReturnType<typeof creativeTextExecution>,ownedCancellation=false) {
 async function execute(){
  activity.update(requestId,'preparing','Preparing model and prompt. First-time loading can take a few minutes; no generation steps yet.');
  const stopDiagnostics=requestId?await diagnostics.watch(clientUrls.get(c)||'http://127.0.0.1:8188',entry=>activity.note(requestId,entry)):()=>{};
  try{
  const job=await (textExecution?.submit?textExecution.submit(wf):c.submit(wf)),controller=new AbortController();
  const stream=(async()=>{try{for await(const event of job.events(controller.signal)){
   if(event.kind==='progress'){const node=event.currentNode?(wf.json[event.currentNode] as any):undefined;const phase=phaseForProgress({...event,currentNodeClass:event.currentNodeClass||node?.class_type});const detail=nodeProgressMessage(node);activity.update(requestId,phase,phase==='generating'?`Generating${event.step!=null&&event.steps?' · step '+event.step+'/'+event.steps:''}`:phase==='encoding'?'Encoding and saving your media.':detail|| (phase==='running'?'ComfyUI is running. Waiting for its next progress update.':'Preparing model and prompt.'),{percent:phase!=='running'&&Number.isFinite(event.value)?Math.max(0,Math.min(100,event.value*100)):null,step:event.step,steps:event.steps})}
   else if(event.kind==='statusChange'&&event.status==='queued')activity.update(requestId,'queued','Waiting for the local generation worker.');
   else if(event.kind==='log'){const message=loadingLog(event.message);if(message){activity.note(requestId,{at:Date.now(),source:'sdk',message});if(/downloading/i.test(message))activity.update(requestId,'downloading',message);else if(/requested to load|loading (?:model|weights|checkpoint|text encoder)/i.test(message))activity.update(requestId,'preparing',message)}}
  }}catch{/* Completion polling remains authoritative if live progress is unavailable. */}})();
  const started=Date.now();
  try{if(textExecution)await textExecution.wait(job);else{await job.wait(timeoutMs);await job.result();}return job}catch(error){
   let cancellation='not requested';if(textExecution?.cancel)cancellation=await textExecution.cancel(job);else if(timeoutMs<30*60*1000)try{if(ownedCancellation){const q=await comfyJson({COMFYUI_URL:clientUrls.get(c)},'/queue');if(q.queue_running.length!==1||q.queue_running[0][1]!==job.id)throw Error('Cancellation skipped: job is not exclusively running.');}await job.cancel(AbortSignal.timeout(5000));cancellation='requested (not proof of termination)';}catch{cancellation='request failed';}
   if(textExecution)throw await textExecution.failed(job,error,started,cancellation);
   throw error;
  }finally{controller.abort();void stream}
  }finally{stopDiagnostics()}
 }
 try{return await execute()}catch(error:any){if(retryExpired&&error?.code==='job_failed'&&/expired/i.test(String(error.message)))return execute();throw error}
}

// One job at a time on the GPU; small queue, then 429.
let chain: Promise<unknown> = Promise.resolve();
let queued = 0;
const semanticCache=new Map<string,{model:string;results:{id:string;score:number}[]}>();
let semanticPending=false,trainingPending=false;
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  if (queued >= MAX_QUEUE) throw new HttpError(429, "GPU busy, try again in a moment");
  queued++;
  const run = chain.then(fn, fn).finally(() => queued--);
  chain = run.catch(() => {});
  return run;
}
// Comfy Cloud renders remotely: one Cloud job at a time, independent of the local GPU queue.
let cloudChain: Promise<unknown> = Promise.resolve(),cloudQueued = 0,textJobs = 0;
function serializeCloud<T>(fn: () => Promise<T>): Promise<T> {
  if (cloudQueued >= MAX_QUEUE) throw new HttpError(429, "Comfy Cloud is busy with earlier requests; try again when they finish.");
  cloudQueued++;
  const run = cloudChain.then(fn, fn).finally(() => cloudQueued--);
  cloudChain = run.catch(() => {});
  return run;
}

// ---------------- endpoints ----------------

async function comfyJson(env: Env, path: string): Promise<any> {
  try {
    const r = await fetch((env.COMFYUI_URL || "http://127.0.0.1:8188") + path, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`ComfyUI returned ${r.status}`);
    return await r.json();
  } catch { throw new HttpError(503, "Cannot read local models. Check ComfyUI on port 8188 and refresh."); }
}

async function localModels(env: Env) {
  const [categories, nodes] = await Promise.all([comfyJson(env, "/models"), comfyJson(env, "/object_info")]);
  const inventory = await Promise.all((categories as string[]).filter(c => !["configs", "custom_nodes"].includes(c)).map(async category => ({ category, files: await comfyJson(env, "/models/" + encodeURIComponent(category)) as string[] })));
  const has = (node: string, input: string, file: string) => nodes[node]?.input?.required?.[input]?.[0]?.includes(file) === true;
  const graphReady = (graph: Record<string, any>) => Object.values(graph).every(n => Boolean(nodes[n.class_type]));
  const names=[...new Set([...imageRecipes,...videoRecipes].map(r=>r.graph))];
  const graphs=Object.fromEntries(await Promise.all(names.map(async name=>[name,await loadGraph(name)])));
  const keyframe=resolveRecipes(imageRecipes,nodes,graphs),video=resolveRecipes(videoRecipes,nodes,graphs);
  const geometry:ModelChoice[]=nodes.ImageOnlyCheckpointLoader?.input?.required?.ckpt_name?.[0]?.includes(geometryBase)&&Object.values(geometryGraph()).every(node=>nodes[node.class_type])?[{id:geometryBase,label:'Hunyuan3D mini · geometry',family:'Hunyuan3D',description:'Image to untextured mesh',capabilities:[{name:'Image to geometry',status:'ready',detail:'Generate mesh geometry from one reference image.'}],timing:{low:20,high:90,width:512,height:512,basis:'Unmeasured estimate; depends on mesh decoding resolution.'}}]:[];
  // Experimental hero/precision graphs are built around Z-Image Turbo specifically.
  const zimageTurbo=keyframe.some(m=>m.id===imageModel.id);
  if(nodes.LoraLoaderModelOnly){const available:string[]=nodes.LoraLoaderModelOnly?.input?.required?.lora_name?.[0]||[];for(const run of await trainingRuns(OUTPUTS)){const target=trainingKind(run.model)==='video'?video:trainingKind(run.model)==='geometry'?geometry:keyframe,base=target.find(model=>model.id===run.model&&!model.parentId);if(run.status!=='complete'||!base||run.loraFile!=='studio/'+run.id+'.safetensors')continue;const file=available.find(file=>file.replaceAll('\\','/')===run.loraFile);if(file)target.push({...base,id:'studio-tune:'+run.id,parentId:base.id,loraFile:file,label:run.name,description:'LoRA · '+base.label+' · '+run.steps+' training steps'})}}

  let research: { repo: string; revision: string; bytes: number }[] = [];
  try {
    const lab = JSON.parse(await readFile(join(OUTPUTS, 'lora-lab', 'manifest.json'), 'utf8'));
    research = lab.models.map((m: any) => ({ repo: m.repo, revision: m.revision, bytes: m.files.reduce((sum: number, f: any) => sum + f.bytes, 0) }));
  } catch { /* Training assets are optional and not generation choices. */ }
  const hardware = identifyHardware(await comfyJson(env,'/system_stats').catch(()=>null));
  const audio=has('CheckpointLoaderSimple','ckpt_name','stable-audio-open-1.0.safetensors')&&has('CLIPLoader','clip_name','t5_base.safetensors')&&graphReady(await loadGraph('audio_stable'));
  return { keyframe, video, geometry, zimageTurbo, audio:{available:audio,model:'Stable Audio Open 1.0'}, research, timing: await serverTiming(OUTPUTS,hardware,queued), inventory: inventory.filter(c => c.files.length > 0) };
}

async function selectedModel(body: any, env: Env, kind: "keyframe" | "video") {
  const models = (await localModels(env))[kind];
  const model = body.model ?? models[0]?.id;
  if (!models.some(m => m.id === model)) throw new HttpError(400, `Selected ${kind} model is unavailable or has no compatible workflow. Refresh local models.`);
  await ensureProxy(env);
  return models.find(entry=>entry.id===model)!.parentId||model as string;
}

const str = (v: unknown, max: number, name: string): string => {
  if (typeof v !== "string" || !v.trim() || v.length > max) throw new HttpError(400, `${name} must be a non-empty string (≤ ${max} chars)`);
  return v;
};
const num = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = v === undefined ? dflt : Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) throw new HttpError(400, `number out of range [${lo}, ${hi}]`);
  return n;
};
function dimension(value: unknown, max: number, fallback: number, step: number) {
  const n=num(value,256,max,fallback);
  if (!Number.isInteger(n)) throw new HttpError(400,`Dimensions must be whole pixels (256–${max}).`);
  return n;
}
function cropOutput(graph:Record<string,any>,decode:string,output:string,width:number,height:number,step:number){
  const rw=Math.ceil(width/step)*step,rh=Math.ceil(height/step)*step;
  if(rw!==width||rh!==height){graph['exact_size']={class_type:'ImageCrop',inputs:{image:[decode,0],width,height,x:Math.floor((rw-width)/2),y:Math.floor((rh-height)/2)}};graph[output].inputs.images=['exact_size',0]}
  return {rw,rh};
}
async function timedRun(c: Comfy, wf: Parameters<Comfy['run']>[0], env: Env, model: string, width: number, height: number, frames: number, requestId?:string) {
  const hardware=identifyHardware(await comfyJson(env,'/system_stats').catch(()=>null));
  let executionSeconds=0;
  const job=await serialize(async()=>{const start=Date.now();const result=await runWf(c,wf,requestId);const ms=result.metrics?.execution_ms;executionSeconds=typeof ms==='number'?ms/1000:(Date.now()-start)/1000;
    const history=await comfyJson(env,'/history/'+encodeURIComponent(result.id)).catch(()=>null);
    const messages=history?.[result.id]?.status?.messages;
    const cached=Array.isArray(messages)&&messages.some(([event,data]:[string,any])=>event==='execution_cached'&&data.nodes?.includes(frames===1?'8':'14'));
    if(!cached&&history)await recordRender(OUTPUTS,hardware,{model,width,height,frames,seconds:executionSeconds,jobId:result.id});return result});
  return {job,executionSeconds};
}

/** Prompt -> image. shared/workflows/keyframe_zimage.json (Z-Image Turbo). */
async function keyframe(body: any, env: Env) {
  const textDevice=promptDevice(body.textDevice);
  const prompt = str(body.prompt, 2000, "prompt");
  const seed = Math.floor(num(body.seed, 0, 2 ** 32, 1));
  const width=dimension(body.width,1536,768,16),height=dimension(body.height,1536,448,16);
  const model = await selectedModel(body, env, "keyframe");
  const c = client(env);
  const tune=(await localModels(env)).keyframe.find(entry=>entry.id===body.model&&entry.loraFile);
  const resolved=resolvedModels.get(tune?tune.parentId!:model)!;
  const graph=applyResolved(await loadGraph(resolved.recipe.graph),resolved);
  if(tune){graph['90']={class_type:'LoraLoaderModelOnly',inputs:{model:['1',0],lora_name:tune.loraFile,strength_model:1}};graph['4'].inputs.model=['90',0]}
  const {rw,rh}=cropOutput(graph,'9','10',width,height,16);
  const wf = c.workflows.fromJson(graph);
  wf.setInput("2", "device", textDevice);
  wf.setInput("5", "text", prompt);
  wf.setInput("8", "seed", seed);
  wf.setInput('7','width',rw);wf.setInput('7','height',rh);
  const t = Date.now();
  const {job} = await timedRun(c,wf,env,model,rw,rh,1,body._requestId);
  return { url: await save(job, "10", "png"), seconds: +((Date.now() - t) / 1000).toFixed(1) };
}

/** Isolated experimental img2img. Production keyframes/video graphs are untouched. */
async function reimagineHero(body:any,env:Env){
 let settings;try{settings=validateHeroSettings(body?.settings)}catch(e){throw new HttpError(400,(e as Error).message)}
 if(settings.imageModel==='qwen-fp8')throw new HttpError(400,'Qwen requires /api/hero/qwen. No Z-Image fallback was started.');
 if(settings.method!=='reimagine'||!settings.prompt.trim())throw new HttpError(400,'Choose reimagine and provide a product-specific prompt.');
 const source=await heroSource(OUTPUTS,body.image),catalog=await localModels(env),nodes=await comfyJson(env,'/object_info');
 const graph=await loadGraph('hero_zimage_experimental');
 if(!catalog.zimageTurbo||!Object.values(graph).every(n=>nodes[n.class_type]))throw new HttpError(503,'Reference-conditioned image generation is unavailable: install a compatible Z-Image model pack yourself. No model download or fallback was started.');
 const model=await selectedModel({...body,model:imageModel.id},env,'keyframe'),c=client(env);graph['1'].inputs.unet_name=model;graph['5'].inputs.text=settings.prompt;graph['8'].inputs.seed=settings.seed;graph['8'].inputs.denoise=settings.strength;
 const workflowSha256=heroSha(JSON.stringify(graph)),wf=c.workflows.fromJson(graph);wf.setInput('11','image',c.assets.fromFile(source.path));const started=Date.now();
 const {job}=await timedRun(c,wf,env,model,768,960,1,body._requestId),url=await save(job,'10','png');
 return {url,width:768,height:960,sha256:heroSha(await readFile(outputPath(url))),sourceSha256:source.sha256,workflowSha256,seconds:(Date.now()-started)/1000,method:'Experimental Z-Image latent img2img',model,prompt:settings.prompt,seed:settings.seed,strength:settings.strength,warning:'Unvalidated for commercial product fidelity. Compare structure, ingredients and texture against the original before use.'};
}

/** shot_ltxv.json has one keyframe guide (node 8); clone image/scale/guide nodes for each extra keyframe. */
function shotGraph(g: Record<string, any>, nKeys: number): Record<string, any> {
  if (!nKeys) {
    delete g['5']; delete g['6']; delete g['8']; delete g['15'];
    Object.assign(g['11'].inputs,{positive:['3',0],negative:['4',0]});
    g['13'].inputs.latent=['7',0];g['14'].inputs.latent_image=['7',0];g['16'].inputs.samples=['14',0];
    return g;
  }
  let prev = "8";
  for (let i = 1; i < nKeys; i++) {
    const n = String(i).padStart(2, "0"), img = `5${n}`, scale = `6${n}`, guide = `8${n}`;
    g[img] = structuredClone(g["5"]);
    g[scale] = structuredClone(g["6"]);
    g[scale].inputs.image = [img, 0];
    g[guide] = structuredClone(g["8"]);
    Object.assign(g[guide].inputs, { positive: [prev, 0], negative: [prev, 1], latent: [prev, 2], image: [scale, 0] });
    prev = guide;
  }
  Object.assign(g["11"].inputs, { positive: [prev, 0], negative: [prev, 1] });
  g["13"].inputs.latent = [prev, 2];
  g["14"].inputs.latent_image = [prev, 2];
  return g;
}

/** Keyframes (images at times) + motion prompt -> video. shared/workflows/shot_ltxv.json (LTX-Video). */
async function shot(body: any, env: Env) {
  if(body.workflow!==undefined&&body.workflow!=='ad-film')throw new HttpError(400,'Unknown video workflow.');
  const textDevice=promptDevice(body.textDevice);
  if (body.keys === undefined) body.keys = [];
  if (!Array.isArray(body.keys) || body.keys.length > 8) throw new HttpError(400, "keys: 0–8 keyframes");
  const fps=num(body.fps,1,120,FPS);
  const length=body.frames===undefined?Math.max(25,Math.min(121,Math.round(num(body.duration,1,8,4)*fps/8)*8+1)):num(body.frames,9,121,97);
  if(!Number.isInteger(length)||(length-1)%8!==0)throw new HttpError(400,'frames must be 8n+1 (9, 17, 25…121)');
  const duration = body.frames===undefined?num(body.duration,1,8,4):length/fps;
  const keys: Key[] = body.keys
    .map((k: any) => ({ image: k.image, t: num(k.t, 0, duration, 0), strength: num(k.strength, 0, 1, 1) }))
    .sort((a: Key, b: Key) => a.t - b.t);
  const paths = keys.map((k) => {
    if (typeof k.image !== "string" || !/^\/outputs\/[a-f0-9]{16}\.png$/.test(k.image)) throw new HttpError(400, "keyframe image must be an API-owned PNG");
    return outputPath(k.image);
  });
  const model = await selectedModel(body, env, "video");
  const last = length - 1;
  const c = client(env);
  const width = dimension(body.width,1024,768,32);
  const height = dimension(body.height,1024,448,32);
  const resolved=resolvedModels.get(model)!;
  if(resolved.recipe.graph==='shot_ltx25'){
    if(keys.length>1)throw new HttpError(400,'LTX-2.5 uses one start-frame guide. Remove the extra keyframes, or choose LTX-Video for multi-keyframe shots.');
    const seed=Math.floor(num(body.seed,0,2**32,1));
    const graph=applyResolved(await loadGraph('shot_ltx25'),resolved);const {rw,rh}=cropOutput(graph,'31','32',width,height,64);
    if (rw * rh > 1024 * 1024) throw new HttpError(400, "shot resolution too large");
    if(!keys.length){graph['9'].inputs.bypass=true;graph['23'].inputs.bypass=true;delete graph['8'];graph['9'].inputs.image=graph['23'].inputs.image=['6',0];graph['6']={class_type:'EmptyImage',inputs:{width:rw,height:rh,batch_size:1,color:0}};delete graph['5']}
    else Object.assign(graph['6'].inputs,{width:rw,height:rh});
    Object.assign(graph['7'].inputs,{width:rw/2,height:rh/2,length});
    Object.assign(graph['12'].inputs,{frames_number:length,frame_rate:fps});
    graph['3'].inputs.text=body.prompt ? str(body.prompt, 2000, "prompt") : "cinematic shot";
    graph['11'].inputs.frame_rate=fps;graph['32'].inputs.fps=fps;graph['16'].inputs.noise_seed=seed;graph['27'].inputs.noise_seed=(seed+1)%2**32;graph['2'].inputs.device=textDevice;
    const first=keys[0];if(first)graph['9'].inputs.strength=0.7*(first.strength??1);
    const wf=c.workflows.fromJson(graph);if(keys.length)wf.setInput('5','image',c.assets.fromFile(paths[0]));
    const t=Date.now();const {job}=await timedRun(c,wf,env,model,rw,rh,length,body._requestId);
    return { url: await save(job, "32", "webm"), seconds: +((Date.now() - t) / 1000).toFixed(1), frames: length, fps, duration:length/fps };
  }
  if(body.workflow==='ad-film'){
   if(model!==filmModel||keys.length!==1||keys[0].t!==0||keys[0].strength!==1)throw new HttpError(400,'Generated film requires the LTX 2B model and one fully guided start image at time zero.');
   const snapshot=await Promise.all([comfyJson(env,'/object_info'),comfyJson(env,'/system_stats'),comfyJson(env,'/queue'),physicalFreeMiB()]);
   const ready=filmReadiness(snapshot[0],snapshot[1],snapshot[2],false,snapshot[3]);if(!ready.available)throw new HttpError(503,ready.reason);
   let graph;try{graph=filmGraph(await loadGraph('ad_film_ltxv'),{width,height,frames:length,fps,seed:Math.floor(num(body.seed,0,2**32,1)),prompt:str(body.prompt,2000,'prompt')});}catch(error:any){throw new HttpError(400,error.message);}
   const wf=c.workflows.fromJson(graph);wf.setInput('2','device',textDevice);wf.setInput('5','image',c.assets.fromFile(paths[0]));
   const t=Date.now(),job=await serialize(async()=>{
    const [stats,queue,physical]=await Promise.all([comfyJson(env,'/system_stats'),comfyJson(env,'/queue'),physicalFreeMiB()]);
    const admitted=filmReadiness(snapshot[0],stats,queue,false,physical);if(!admitted.available)throw new HttpError(503,admitted.reason);
    return runWf(c,wf,body._requestId,false,600000,undefined,true);
   });
   const history=await comfyJson(env,'/history/'+encodeURIComponent(job.id)),native=history?.[job.id];
   if(!native?.status?.completed||native.status.status_str!=='success')throw new HttpError(502,'Native video completion was not confirmed. No completed film was saved.');
   const url=await save(job,'17','webm'),receipt={jobId:job.id,url,model,frames:length,fps,width,height,workflowSha256:createHash('sha256').update(JSON.stringify(wf.json)).digest('hex'),nativeStatus:native.status,created:new Date().toISOString()};
   mkdirSync(join(OUTPUTS,'film-attempts'),{recursive:true});await writeFile(join(OUTPUTS,'film-attempts',job.id+'.json'),JSON.stringify(receipt,null,2));
   return {url,seconds:+((Date.now()-t)/1000).toFixed(1),frames:length,fps,duration:length/fps,jobId:job.id};
  }
  const graph=applyResolved(shotGraph(await loadGraph('shot_ltxv'),keys.length),resolved);const {rw,rh}=cropOutput(graph,'16','17',width,height,32);
  const tune=(await localModels(env)).video.find(entry=>entry.id===body.model&&entry.loraFile);if(tune){graph['90']={class_type:'LoraLoaderModelOnly',inputs:{model:['1',0],lora_name:tune.loraFile,strength_model:1}};graph['14'].inputs.model=['90',0]}
  if (rw * rh > 768 * 768) throw new HttpError(400, "shot resolution too large");
  const wf=c.workflows.fromJson(graph);wf.setInput('2','device',textDevice);
  wf.setInput("7", "width", rw);
  wf.setInput("7", "height", rh);
  keys.forEach((_, i) => {
    const node = i ? `6${String(i).padStart(2, "0")}` : "6";
    wf.setInput(node, "width", rw);
    wf.setInput(node, "height", rh);
  });
  wf.setInput("3", "text", body.prompt ? str(body.prompt, 2000, "prompt") : "cinematic shot");
  wf.setInput("7", "length", length);
  wf.setInput('11','frame_rate',fps);
  wf.setInput('17','fps',fps);
  wf.setInput("14", "noise_seed", Math.floor(num(body.seed, 0, 2 ** 32, 1)));
  keys.forEach((k, i) => {
    const n = i ? String(i).padStart(2, "0") : "";
    const f = Math.round((k.t * fps) / 8) * 8;
    wf.setInput(i ? `8${n}` : "8", "frame_idx", f >= last - 4 ? -1 : Math.min(f, last - 8)); // snap to latent frames; last key = end
    wf.setInput(i ? `8${n}` : "8", "strength", k.strength);
    wf.setInput(i ? `5${n}` : "5", "image", c.assets.fromFile(paths[i]));
  });
  const t = Date.now();
  const {job} = await timedRun(c,wf,env,model,rw,rh,length,body._requestId);
  return { url: await save(job, "17", "webm"), seconds: +((Date.now() - t) / 1000).toFixed(1), frames: length, fps, duration:length/fps };
}

async function health(env: Env, runtimeBusy=false) {
  const comfyui = await up((env.COMFYUI_URL || "http://127.0.0.1:8188") + "/system_stats");
  if (comfyui&&!runtimeBusy) await ensureProxy(env);
  return {
    comfyui,
    proxy: await up((env.COMFY_BASE_URL || "http://127.0.0.1:8189") + "/api/v2/health"),
    queued,
  };
}

// Local postprocessing readiness must not depend on ComfyUI or model availability.
let ffmpegCheck:Promise<boolean>|null=null,ffmpegCheckedAt=0;
async function capabilities(env:Env){
  if(!ffmpegCheck||Date.now()-ffmpegCheckedAt>30000){ffmpegCheckedAt=Date.now();ffmpegCheck=new Promise<boolean>(ok=>{
    const child=spawn(env.FFMPEG_PATH||'ffmpeg',['-version'],{windowsHide:true,stdio:'ignore'});
    const timer=setTimeout(()=>{child.kill();ok(false)},3000);
    child.on('error',()=>{clearTimeout(timer);ok(false)});child.on('close',code=>{clearTimeout(timer);ok(code===0)});
  });}
  return {upload:true,shot:true,keyframe:true,audio:true,productVideo:true,editVideo:true,exportVideo:true,ffmpeg:{available:await ffmpegCheck}};
}

/** Browser-normalized PNG only; saved under an opaque API-owned filename. */
async function upload(body: any) {
  if (typeof body.image !== "string" || !body.image.startsWith("data:image/png;base64,")) throw new HttpError(400, "upload must be a PNG data URL");
  const encoded = body.image.slice(22);
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new HttpError(400, "invalid PNG encoding");
  const data = Buffer.from(encoded, "base64");
  if (data.length > 5 * 1024 * 1024) throw new HttpError(413, "PNG exceeds 5 MB");
  if (data.length < 33 || data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || data.subarray(12, 16).toString() !== "IHDR") throw new HttpError(400, "invalid PNG");
  const width = data.readUInt32BE(16), height = data.readUInt32BE(20);
  if (!width || !height || width > 2048 || height > 2048) throw new HttpError(400, "PNG dimensions must be 1–2048 pixels");
  const name = outputName("png");
  await writeFile(join(OUTPUTS, name), data);
  return { url: `/outputs/${name}`, width, height };
}

/** Local postprocessing only: FFmpeg never receives a client-supplied path or filter. */
async function exportVideo(body: any, env: Env) {
  if (typeof body.video !== "string" || !/^\/outputs\/[a-f0-9]{16}\.webm$/.test(body.video)) throw new HttpError(400, "video must be an API-owned WebM");
  const video = outputPath(body.video);
  let overlay: string | undefined;
  if (body.overlay !== undefined) {
    if (typeof body.overlay !== "string" || !/^\/outputs\/[a-f0-9]{16}\.png$/.test(body.overlay)) throw new HttpError(400, "overlay must be an API-owned PNG");
    overlay = outputPath(body.overlay);
  }
  const name = outputName("mp4"), destination = join(OUTPUTS, name);
  const args = ["-nostdin", "-hide_banner", "-loglevel", "error", "-n", "-i", video];
  if (overlay) args.push("-i", overlay, "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto[v]", "-map", "[v]");
  else args.push("-map", "0:v:0");
  args.push('-map','0:a?','-c:a','aac', "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", destination);
  const t = Date.now();
  try {
    await serialize(() => new Promise<void>((ok, fail) => {
      const p = spawn(env.FFMPEG_PATH || "ffmpeg", args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      const timeout = setTimeout(() => { p.kill(); fail(new HttpError(504, "video export timed out")); }, 90_000);
      p.stderr.on("data", (data: Buffer) => { stderr = (stderr + data.toString()).slice(-16000); });
      p.on("error", (error) => {
        clearTimeout(timeout);
        console.error("[api] FFmpeg could not start:", error);
        fail(new HttpError(503, "FFmpeg unavailable: install it and set FFMPEG_PATH, then restart Vite"));
      });
      p.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 0) ok();
        else { console.error("[api] FFmpeg export failed:", stderr); fail(new HttpError(500, "video export failed (see server log)")); }
      });
    }));
  } catch (error) {
    await unlink(destination).catch(() => {});
    throw error;
  }
  return { url: `/outputs/${name}`, seconds: +((Date.now() - t) / 1000).toFixed(1) };
}

async function generateAudio(body:any,env:Env){
  const prompt=str(body.prompt,1500,'audio prompt'),duration=num(body.duration,.1,47,4),seed=Math.floor(num(body.seed,0,2**32,1));
  let source:string|undefined;
  if(body.video!==undefined){if(typeof body.video!=='string'||!/^\/outputs\/[a-f0-9]{16}\.(webm|mp4)$/.test(body.video))throw new HttpError(400,'Choose an API-owned video');source=outputPath(body.video)}
  if(!(await localModels(env)).audio.available)throw new HttpError(400,'Install Stable Audio Open 1.0 and T5-base, then refresh local models');
  await ensureProxy(env);const c=client(env),wf=c.workflows.fromJson(await loadGraph('audio_stable'));
  wf.setInput('3','text',prompt);wf.setInput('5','seconds_total',Math.max(1,duration));wf.setInput('6','seconds',Math.max(1,duration));wf.setInput('7','seed',seed);
  const t=Date.now(),job=await serialize(async()=>{const started=Date.now(),result=await runWf(c,wf,body._requestId),hardware=identifyHardware(await comfyJson(env,'/system_stats').catch(()=>null));await recordRender(OUTPUTS,hardware,{model:'stable-audio-open-1.0.safetensors',width:1,height:1,frames:Math.round(Math.max(1,duration)*44100),seconds:(Date.now()-started)/1000,jobId:result.id});return result}),audio=await save(job,'9','flac');
  let video:string|undefined;
  if(source){const name=outputName('webm'),destination=join(OUTPUTS,name),videoCodec=source.endsWith('.webm')?['-c:v','copy']:['-c:v','libvpx-vp9','-deadline','good','-cpu-used','4','-crf','25','-b:v','0'],args=['-nostdin','-hide_banner','-loglevel','error','-n','-i',source,'-i',outputPath(audio),'-map','0:v:0','-map','1:a:0',...videoCodec,'-c:a','libopus','-af','apad','-t',String(duration),destination];
    try{await serialize(()=>new Promise<void>((ok,fail)=>{const child=spawn(env.FFMPEG_PATH||'ffmpeg',args,{windowsHide:true,stdio:['ignore','ignore','pipe']});let error='';const timer=setTimeout(()=>{child.kill();fail(new HttpError(504,'Audio mux timed out'))},90000);child.stderr.on('data',(b:Buffer)=>error=(error+b.toString()).slice(-4000));child.on('error',()=>{clearTimeout(timer);fail(new HttpError(503,'FFmpeg unavailable'))});child.on('close',code=>{clearTimeout(timer);if(code===0)ok();else{console.error('[api] audio mux:',error);fail(new HttpError(500,'Could not combine audio and video; originals kept'))}})}));video='/outputs/'+name}catch(e){await unlink(destination).catch(()=>{});throw e}
  }
  return{audio,video,duration,seconds:(Date.now()-t)/1000};
}

// ---------------- HTTP plumbing ----------------

/** Original-photo compositing/camera prototypes. Existing generation/export routes are unchanged. */
async function productVideo(body: any, env: Env) {
  if (!body || !['locked', 'camera'].includes(body.mode)) throw new HttpError(400, 'mode must be locked or camera');
  if (typeof body.ratio !== 'string' || !Object.hasOwn(productFormats, body.ratio)) throw new HttpError(400, 'ratio must be 16:9, 9:16 or 1:1');
  const motion = body.motion === undefined ? 'push' : body.motion;
  if (!['push', 'pan-left', 'pan-right'].includes(motion)) throw new HttpError(400, 'unknown camera motion');
  if (typeof body.image !== 'string' || !/^\/outputs\/[a-f0-9]{16}\.png$/.test(body.image)) throw new HttpError(400, 'image must be an API-owned PNG');
  const source = outputPath(body.image);
  const png = await readFile(source);
  if (png.length < 24 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new HttpError(400, 'invalid source PNG');
  const sw = png.readUInt32BE(16), sh = png.readUInt32BE(20);
  if (!sw || !sh || sw > 2048 || sh > 2048) throw new HttpError(400, 'invalid source dimensions');
  const mode = body.mode as ProductMode;
  let background: string | undefined;
  if (mode === 'locked') {
    if (typeof body.background !== 'string' || !/^\/outputs\/[a-f0-9]{16}\.webm$/.test(body.background)) throw new HttpError(400, 'locked mode needs an API-owned WebM background');
    background = outputPath(body.background);
  }
  const duration = num(body.duration, 2, 5, 3);
  const plan = productPlan(mode, body.ratio as ProductRatio, duration, motion as CameraMotion, sw, sh);
  const name = outputName('webm'), destination = join(OUTPUTS, name);
  const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-n'];
  if (background) args.push('-i', background);
  args.push('-i', source, '-filter_complex', plan.filter, '-map', '[out]', '-frames:v', String(plan.frames), '-an',
    '-c:v', 'libvpx-vp9', '-lossless', '1', '-pix_fmt', 'yuv420p', '-deadline', 'realtime', '-cpu-used', '6', destination);
  const start = Date.now();
  try { await serialize(() => renderProduct(env.FFMPEG_PATH || 'ffmpeg', args)); }
  catch (error) {
    await unlink(destination).catch(() => {});
    if (error instanceof ProductRenderError) throw new HttpError(error.status, error.message);
    throw error;
  }
  return { url: `/outputs/${name}`, seconds: +((Date.now() - start) / 1000).toFixed(1), frames: plan.frames,
    width: plan.width, height: plan.height, mode, motion: plan.motion, protectedRect: mode === 'locked' ? plan.rect : null };
}
async function editVideo(body:any,env:Env){
  if(typeof body.video!=='string'||!/^\/outputs\/[a-f0-9]{16}\.(webm|mp4)$/.test(body.video))throw new HttpError(400,'Choose an API-owned video');
  const source=outputPath(body.video),start=num(body.start,0,60,0),end=num(body.end,0,60,5),speed=num(body.speed,.25,4,1);
  if(end<=start)throw new HttpError(400,'Trim end must be after start');
  const width=num(body.width,16,4096,768),height=num(body.height,16,4096,448);
  if(!Number.isInteger(width)||!Number.isInteger(height)||width*height>4096*2160)throw new HttpError(400,'Choose whole-pixel dimensions up to 4096×2160 total pixels');
  if(body.reverse!==undefined&&typeof body.reverse!=='boolean')throw new HttpError(400,'reverse must be true or false');
  const name=outputName('webm'),destination=join(OUTPUTS,name),filters=[...(body.reverse?['reverse']:[]),`setpts=(PTS-STARTPTS)/${speed}`,'fps=24',`scale=${width}:${height}:flags=lanczos`, 'setsar=1'];
  const audioFilters=[...(body.reverse?['areverse']:[]),'asetpts=PTS-STARTPTS',`atempo=${Math.sqrt(speed)}`,`atempo=${Math.sqrt(speed)}`];
  if(body.keepAudio!==undefined&&typeof body.keepAudio!=='boolean')throw new HttpError(400,'keepAudio must be true or false');
  const audioArgs=body.keepAudio===false?['-an']:['-map','0:a?','-af',audioFilters.join(','),'-c:a','libopus'];
  const args=['-nostdin','-hide_banner','-loglevel','error','-n','-ss',String(start),'-t',String(end-start),'-i',source,'-map','0:v:0',...audioArgs,'-vf',filters.join(','),'-c:v','libvpx-vp9','-deadline','good','-cpu-used','4','-crf','25','-b:v','0',destination];
  const t=Date.now();
  try{await serialize(()=>new Promise<void>((ok,fail)=>{const child=spawn(env.FFMPEG_PATH||'ffmpeg',args,{windowsHide:true,stdio:['ignore','ignore','pipe']});let error='';const timeout=setTimeout(()=>{child.kill();fail(new HttpError(504,'Video edit timed out'))},90000);child.stderr.on('data',(chunk:Buffer)=>error=(error+chunk.toString()).slice(-8000));child.on('error',()=>{clearTimeout(timeout);fail(new HttpError(503,'FFmpeg is unavailable'))});child.on('close',code=>{clearTimeout(timeout);if(code===0)ok();else{console.error('[api] edit failed:',error);fail(new HttpError(500,'Video edit failed; source is unchanged'))}})}))}catch(error){await unlink(destination).catch(()=>{});throw error}
  return {url:'/outputs/'+name,seconds:(Date.now()-t)/1000,width,height};
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function send(res: ServerResponse, status: number, obj: unknown) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(body);
}

function readBody(req: IncomingMessage, limit = MAX_BODY): Promise<any> {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) { fail(new HttpError(413, "request too large")); req.removeAllListeners("data"); req.resume(); }
      else chunks.push(c);
    });
    req.on("end", () => { try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch { fail(new HttpError(400, "invalid JSON")); } });
    req.on("error", fail);
  });
}

const isLocalHost = (host = "") => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
const cookie = (req: IncomingMessage, name: string) => (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(name + "="))?.slice(name.length + 1);
function sameToken(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function requirePathSeparator(){return process.platform==='win32'?'\\':'/';}

const kleinJobs=new Map<string,{projectId:string;controller:AbortController}>();
function middleware(env: Env,setup:RuntimeSetup,rewriter:PromptRewriter,creative:ReturnType<typeof createCreativeEngine>,brandBackend:CreativeBackend,brand:ReturnType<typeof createBrandService>): Connect.NextHandleFunction {
  const errors=new ErrorJournal(join(OUTPUTS,`runtime-errors-${Number(env.OSH_PORT||8288)}.json`));let lastSetupError='';
  void resumeFluxLeaseGuard(env);
  const token = env.OSH_TOKEN || "";
  const session=env.QWEN_APP_SESSION_DIR?resolve(env.QWEN_APP_SESSION_DIR):'';
  if(env.QWEN_APP_RELAY_URL&&(!session.startsWith(OUTPUTS+requirePathSeparator())||!session.endsWith(requirePathSeparator()+'session')))throw new Error('Qwen acceptance session must be an outputs/.../session folder.');
  const gateFiles=(folder:string)=>({approval:join(folder,'acceptance.json'),lease:join(folder,'lease.json'),watchdog:join(folder,'pod-watchdog-ready.json'),receipt:join(folder,'one-job.json')});
  const relay=env.QWEN_APP_RELAY_URL?createQwenRelay(OUTPUTS,env.QWEN_APP_RELAY_URL,gateFiles(session)):null;
  return async (req, res, next) => {
    const url = new URL(req.url || "/", "http://x");
    // ?token=… on any page: set the access cookie, then strip the token from the URL.
    if (token && url.searchParams.has("token")) {
      if (sameToken(url.searchParams.get("token") || undefined, token)) {
        url.searchParams.delete("token");
        res.writeHead(302, {
          "Set-Cookie": `osh_token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 24 * 14}`,
          Location: url.pathname + url.search,
        });
        return res.end();
      }
      return send(res, 403, { error: "bad token" });
    }
    const isApi = url.pathname.startsWith("/api/"), isOut = url.pathname.startsWith("/outputs/");
    if (!isApi && !isOut) return next();
    // Access: localhost always; anything else needs the token cookie (or Authorization: Bearer).
    const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || undefined;
    if (!isLocalHost(req.headers.host) && !(token && (sameToken(cookie(req, "osh_token"), token) || sameToken(bearer, token)))) {
      return send(res, 401, { error: token ? "locked: open the site with ?token=…" : "generation is only available on localhost" });
    }
    try {
      if (isOut) {
        const name = url.pathname.slice("/outputs/".length);
        if (!['GET','HEAD'].includes(req.method||'') || !OUTPUT_NAME.test(name)) return send(res, 404, { error: "not found" });
        const p = join(OUTPUTS, name);
        if (!existsSync(p)) return send(res, 404, { error: "not found" });
        const size=statSync(p).size,headers:Record<string,string|number>={"Content-Type":name.endsWith('.safetensors')?'application/octet-stream':name.endsWith('.glb')?'model/gltf-binary':name.endsWith('.srt')?'application/x-subrip; charset=utf-8':name.endsWith('.obj')?'text/plain':name.endsWith('.png')?'image/png':mediaTypes[name.split('.').at(-1)!]||'video/webm',"Accept-Ranges":"bytes","Cache-Control":"private, max-age=31536000, immutable","X-Content-Type-Options":"nosniff"};
        const range=req.headers.range;
        if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);let start=Number(match?.[1]||0),end=match?.[2]?Number(match[2]):size-1;if(match&&!match[1]&&match[2]){start=Math.max(0,size-Number(match[2]));end=size-1;}
          if(!match||(!match[1]&&!match[2])||start>end||start>=size||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}
          end=Math.min(end,size-1);res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});if(req.method==='HEAD')return res.end();return createReadStream(p,{start,end}).pipe(res);
        }
        res.writeHead(200,{...headers,'Content-Length':size});if(req.method==='HEAD')return res.end();return createReadStream(p).pipe(res);
      }
      const route = `${req.method} ${url.pathname}`;
      if(url.pathname==='/api/errors'){if(!setupAccess(req))return send(res,403,{error:'Error logs are only available from this computer and the app’s own origin.'});if(req.method==='GET')return send(res,200,{entries:errors.list()});return send(res,405,{error:'Method not allowed'})}
      if(route==='GET /api/film/capabilities'){
       try{const [nodes,stats,queue,physical]=await Promise.all([comfyJson(env,'/object_info'),comfyJson(env,'/system_stats'),comfyJson(env,'/queue'),physicalFreeMiB()]);return send(res,200,filmReadiness(nodes,stats,queue,queued>0||trainingPending||setup.task.busy,physical));}
       catch{return send(res,200,{available:false,reason:'The local video engine is offline. Photograph motion and saved films remain available.',model:filmModel,inferenceVerified:false});}
      }
      if(route==='GET /api/creative/status')return send(res,200,await creative.status());
      if(req.method==='GET'&&/^\/api\/creative\/plan\/[a-f0-9]{16}$/.test(url.pathname))return send(res,200,await creative.get(url.pathname.split('/').pop()!,url.searchParams.get('projectId')||''));
      if(route==='POST /api/creative/plan'){
       const controller=new AbortController(),abort=()=>controller.abort(Error('Planning client disconnected.')),closed=()=>{if(!res.writableEnded)abort();};req.once('aborted',abort);res.once('close',closed);
       try{return send(res,200,await creative.plan(await readBody(req,256*1024),{signal:controller.signal}));}finally{req.off('aborted',abort);res.off('close',closed);}
      }
      if(route==='POST /api/creative/select')return send(res,200,await creative.select(await readBody(req)));
      if(route==='POST /api/creative/refine-composition')return send(res,200,await creative.refineComposition(await readBody(req)));
      if(route==='POST /api/creative/prepare')return send(res,200,await creative.prepare(await readBody(req,20*1024*1024)));
      if(route==='POST /api/creative/inspect-scene'){const body=await readBody(req,256*1024),checked=await validateBackgroundRequest(OUTPUTS,body);return send(res,200,await inspectScenePixels(OUTPUTS,checked.plan,body.image,body.output));}
      if(route==='POST /api/creative/compose')return send(res,200,await creative.compose(await readBody(req)));
      if(req.method==='GET'&&/^\/api\/hero\/qwen\/provenance\/[a-f0-9]{16}$/.test(url.pathname)){
       const path=join(OUTPUTS,'hero-qwen',url.pathname.split('/').pop()!,'provenance.json');if(!existsSync(path))return send(res,404,{error:'No saved Qwen provenance'});if(statSync(path).size>512*1024)throw new HttpError(413,'Qwen provenance too large');return send(res,200,JSON.parse(await readFile(path,'utf8')));
      }
      if(route==='GET /api/hero/capabilities'){
       // finish/product-safe never depends on GPU admission. AI engines require installed
       // weights/nodes AND a verified free/reclaimable VRAM reading above the floor.
       const gib=1024**3,appBusy=queued>0||trainingPending||setup.task.busy;
       const [nodes,queue,stats]=await Promise.all([comfyJson(env,'/object_info').catch(()=>({})),comfyJson(env,'/queue').catch(()=>null),comfyJson(env,'/system_stats').catch(()=>null)]);
       const device=stats?.devices?.find((d:any)=>d.type==='cuda');
       const vramKnown=!!device&&[device.vram_free,device.torch_vram_total,device.torch_vram_free].every((v:any)=>Number.isFinite(v)&&v>=0);
       const vramFreeBytes=vramKnown?device.vram_free+Math.max(0,device.torch_vram_total-device.torch_vram_free):undefined;
       const queueKnown=Array.isArray(queue?.queue_running)&&Array.isArray(queue?.queue_pending);
       const queueBusy=queueKnown&&(queue.queue_running.length>0||queue.queue_pending.length>0);
       const busy=appBusy||queueBusy;
       const admit=(minGib:number)=>{
        if(appBusy)return {ok:false as const,reason:'Local generation or setup is busy. Product-safe design remains available.'};
        if(!queueKnown)return {ok:false as const,reason:'Cannot verify the local ComfyUI queue. Product-safe design remains available.'};
        if(queueBusy)return {ok:false as const,reason:`ComfyUI is busy (${queue.queue_running.length} running, ${queue.queue_pending.length} queued). Product-safe design remains available.`};
        if(typeof vramFreeBytes!=='number')return {ok:false as const,reason:'Cannot verify free GPU memory for local image generation. Product-safe design remains available.'};
        if(vramFreeBytes<minGib*gib)return {ok:false as const,reason:`Free/reclaimable VRAM ${(vramFreeBytes/gib).toFixed(1)} GiB is below the ${minGib} GiB admission floor for local image generation. Product-safe design remains available.`};
        return {ok:true as const,reason:''};
       };
       let installed=false;try{const models=await localModels(env),graph=await loadGraph('hero_zimage_experimental');installed=!!(models.zimageTurbo&&Object.values(graph).every(n=>nodes[n.class_type]));}catch{installed=false;}
       const zAdmit=admit(3.5),reimagine=installed&&zAdmit.ok;
       const zimage={available:reimagine,installed,reason:installed?(zAdmit.ok?'Local Z-Image Turbo graph and memory admission passed.':zAdmit.reason):'Z-Image Turbo is not available on this ComfyUI (weights or graph nodes missing).'};
       let qwen:any;try{qwen=relay?await relay.capability('http://'+req.headers.host):await qwenAvailability(nodes,setup.config?.modelsDir||env.COMFYUI_MODELS_DIR);}catch(error:any){qwen={id:'qwen-fp8',available:false,reason:String(error?.message||error||'Qwen capability check failed')};}
       const qAdmit=admit(8);if(!relay&&qwen?.available&&!qAdmit.ok)qwen={...qwen,available:false,reason:qAdmit.reason};
       const modelsDir=env.ADSTUDIO_KLEIN_MODELS_DIR||setup.config?.modelsDir||env.COMFYUI_MODELS_DIR;
       const klein=await sceneAvailability(OUTPUTS,modelsDir,nodes,stats,queue,appBusy).catch((e:any)=>({available:false,firstRunAvailable:false,installed:false,tested:false,weightsVerified:false,readiness:'not-ready',status:'unsupported',reason:String(e.message)}));
       const flux3=await flux3Availability(env.ADSTUDIO_FLUX3_MODELS_DIR||modelsDir,stats,queue,appBusy,env,nodes).catch((e:any)=>({available:false,authorized:flux3InferenceAuthorized(env),reason:String(e.message)}));
       let runpod:any=null;
       try{
        const planned=await planFluxProvision(env);
        runpod={
         autoprov:autoprovEnabled(env),
         liveAuthorized:liveProvisionAuthorized(env),
         stages:CUSTOMER_STAGES,
         gate:planned.gate,
         createBlockedReason:planned.plan.createBlockedReason,
         estimatedJobUSD:planned.plan.estimatedJobUSD,
         balance:planned.plan.balance,
         protectedReserveUSD:planned.budget.protectedReserveUSD,
         maxJobUSD:planned.budget.maxJobUSD,
        };
        if(!flux3.available&&autoprovEnabled(env)&&flux3InferenceAuthorized(env)&&!planned.plan.createBlockedReason&&liveProvisionAuthorized(env)){
         Object.assign(flux3,{available:true,status:'available',reason:'FLUX 3 will auto-provision a private RunPod GPU session for this job (SSH tunnel; never public Comfy).',runpodAutoprov:true});
        }else if(!flux3.available&&autoprovEnabled(env)&&flux3InferenceAuthorized(env)&&env.ADSTUDIO_FLUX3_DRY_RUN==='1'){
         Object.assign(flux3,{available:true,status:'unverified',reason:'Nonbillable orchestration dry-run only. Generate validates this request and GPU plan, then stops; no FLUX image or paid GPU is created.',runpodAutoprov:true});
        }else if(!flux3.available&&autoprovEnabled(env)){
         Object.assign(flux3,{runpodAutoprov:true,reason:(flux3.reason?flux3.reason+' ':'')+(planned.plan.createBlockedReason||planned.gate.reason||'RunPod auto-provision armed in dry-run mode.')});
        }
       }catch(e:any){runpod={error:String(e.message||e)};}
       const flux3Cloud=await comfyCloudFluxAvailability(env).catch((e:any)=>({available:false,authorized:false,reason:String(e.message||e)}));
       return send(res,200,{finish:true,reimagine,experimental:true,qwen,zimage,klein,flux3,flux3Cloud,runpod,vramFreeBytes:typeof vramFreeBytes==='number'?vramFreeBytes:null,comfyConnected:!!stats,busy});
      }
      if(route==='GET /api/hero/flux3/runpod'){
       const planned=await planFluxProvision(env);
       return send(res,200,{...planned.plan,stages:CUSTOMER_STAGES,liveAuthorized:liveProvisionAuthorized(env),autoprov:autoprovEnabled(env)});
      }
      if(route==='POST /api/hero/flux3/runpod/dry-run'){
       const session=await ensureFluxGpuSession({env,onStage:()=>{},dryRunOnly:true});
       return send(res,200,{mode:session.mode,stage:session.stage,comfyUrl:session.comfyUrl,proxyUrl:session.proxyUrl,plan:session.plan,budget:session.budget,created:!!session.created,live:false});
      }
      if(route==='POST /api/hero/finish')return send(res,200,await finishHero(await readBody(req),OUTPUTS,env));
      if(route==='POST /api/hero/export')return send(res,200,await exportHeroAd(await readBody(req),OUTPUTS));
      if(route==='GET /api/hero/demo'){const file=join(OUTPUTS,'benchmark-ad-v1','demo.json');if(!existsSync(file))return send(res,404,{error:'No private benchmark example prepared.'});if(statSync(file).size>45*1024*1024)throw new HttpError(400,'Example too large');return send(res,200,JSON.parse(await readFile(file,'utf8')));}
      if(route==='POST /api/static-ad')return send(res,200,await exportStaticAd(await readBody(req),OUTPUTS));
      if(route==='GET /api/static-ad-demo'){
        const file=join(OUTPUTS,'static-ads-demo','demo.json');if(!existsSync(file))return send(res,404,{error:'No local static-ad example has been prepared.'});
        if(statSync(file).size>32*1024*1024)throw new HttpError(400,'Local static example is too large');return send(res,200,JSON.parse(await readFile(file,'utf8')));
      }
      if(url.pathname.startsWith('/api/setup')){
       if(!setupAccess(req))return send(res,403,{error:'Runtime setup is only available from this computer and the app’s own origin.'});
       if(route==='GET /api/setup'){const status=await setup.status();if(status.task.phase==='error'){const key=status.task.startedAt+':'+status.task.message;if(lastSetupError!==key){lastSetupError=key;errors.add('Local setup',new Error(status.task.message))}}return send(res,200,{...status,rendering:queued>0||trainingPending})}
       if(req.method==='POST'){if((queued>0||trainingPending)&&route!=='POST /api/setup/cancel')return send(res,409,{error:'Finish the current generation before changing the local runtime or model files.'});const body=await readBody(req);try{const result=route==='POST /api/setup/connect'?setup.connect(body):route==='POST /api/setup/install'?setup.install(body):route==='POST /api/setup/download'?setup.download(body):route==='POST /api/setup/start'?setup.start():route==='POST /api/setup/cancel'?setup.cancel():null;return send(res,result?202:404,result||{error:'Unknown setup action'})}catch(error:any){errors.add(route,error,{status:400});return send(res,400,{error:error.message})}}
      }
      if(req.method==='GET'&&/^\/api\/activity\/[a-f0-9]{32}$/.test(url.pathname)){const state=activity.get(url.pathname.split('/').pop()!);return send(res,state?200:404,state?{...state,serverNow:Date.now()}:{error:'No activity for this request'})}
      const tracked=async(handler:(body:any)=>Promise<any>,limit=MAX_BODY)=>{if(setup.task.busy)throw new HttpError(503,'Local runtime setup is in progress. Finish or stop setup before generating.');const body=await readBody(req,limit);if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpError(400,'Expected a JSON request object.');body._requestId=req.headers['x-osh-request']||body._requestId;let id:string|null;try{id=activity.begin(body._requestId)}catch(error:any){throw new HttpError(400,error.message)}try{const result=await handler(body);activity.update(id,'complete','Media ready.');return result}catch(error:any){activity.update(id,'error','Generation stopped: '+String(error.message||error));throw error}};
      if(route==='POST /api/hero/background/cancel'){const body=await readBody(req),job=kleinJobs.get(body.requestId);if(!job||job.projectId!==body.projectId)return send(res,404,{error:'No matching local background job.'});job.controller.abort(new Error('Owner cancelled the local AI background job.'));return send(res,200,{cancellationRequested:true,terminated:false});}
      if(route==='POST /api/hero/background'||route==='POST /api/hero/scene'||route==='POST /api/hero/campaign')return send(res,200,await tracked(async body=>{
       creativeTextRouting(env);const scene=route==='POST /api/hero/scene',campaign=route==='POST /api/hero/campaign',checked=await (campaign?validateCampaignRequest:scene?validateSceneRequest:validateBackgroundRequest)(OUTPUTS,body),id=String(body._requestId||'');if(!/^[a-f0-9]{32}$/.test(id)||body.requestId!==id)throw new HttpError(400,'A matching local image request identity is required.');
       const wantFlux3Cloud=scene&&!campaign&&body.engine==='flux3-cloud';
       const wantFlux3=scene&&!campaign&&body.engine==='flux3';
       if(wantFlux3Cloud){
        const cloudReady=await comfyCloudFluxAvailability(env);if(!cloudReady.available)throw new HttpError(503,cloudReady.reason);
        if(existsSync(checked.receipt))throw new HttpError(409,'This reviewed Comfy Cloud request was already submitted. Check saved results; no second billable job was created.');
        const controller=new AbortController(),signal=AbortSignal.any([controller.signal,AbortSignal.timeout(900000)]);let jobId='';kleinJobs.set(id,{projectId:body.projectId,controller});
        try{
         try{await writeFile(checked.receipt,JSON.stringify({requestId:id,status:'claimed',created:Date.now(),projectId:body.projectId,engine:'flux3-cloud',idempotencyKey:id,endpoint:cloudReady.endpoint,automaticRetry:false}),{flag:'wx'});}catch{throw new HttpError(409,'This reviewed Comfy Cloud request was already submitted. Check history; no automatic retry.');}
         const result=await serializeCloud(async()=>{
          const progress=(stage:string,detail?:string,percent?:number)=>{
           const phase=/upload|preparing product|submitting/i.test(stage)?'preparing':/download|checking|designing/i.test(stage)?'encoding':'generating';
           activity.update(id,phase,detail?`${stage} · ${detail}`:stage,{percent:Number.isFinite(percent)?Math.round(percent!*100):null});
          };
          activity.update(id,'preparing','Preparing product references');
          const r=await renderFlux3ComfyCloudScene(OUTPUTS,checked.prompt,checked.seed,body.image,body.identityImage,(checked as Awaited<ReturnType<typeof validateSceneRequest>>).archetype,signal,progress,env,{idempotencyKey:id});
          jobId=r.jobId;activity.update(id,'encoding','Checking product identity');
          try{const inspected={...r,...await inspectScenePixels(OUTPUTS,checked.plan,body.image,r.url),executionKind:'model-output' as const,transport:'comfy-cloud'};activity.update(id,'encoding','Designing advertisement');return inspected;}
          catch(error){return {...r,inspectionError:String((error as Error).message),executionKind:'model-output' as const,transport:'comfy-cloud'};}
         });
         const bindDir=join(OUTPUTS,'hero-flux3-cloud',result.provenanceId);mkdirSync(bindDir,{recursive:true});
         await writeFile(join(bindDir,'binding.json'),JSON.stringify({projectId:body.projectId,planId:body.planId,preparedId:body.preparedId,source:checked.plan.input.source,prompt:result.prompt,seed:result.seed,engine:'flux3-cloud',jobId:result.jobId,idempotencyKey:id}));
         await writeFile(checked.receipt,JSON.stringify({requestId:id,status:'complete',engine:'flux3-cloud',jobId:result.jobId,idempotencyKey:id,result}));
         return result;
        }catch(e){jobId=(e as any).jobId||jobId;await writeFile(checked.receipt,JSON.stringify({requestId:id,status:'failed',engine:'flux3-cloud',error:String((e as Error).message),jobId,idempotencyKey:id,automaticRetry:false}));throw e;}
        finally{kleinJobs.delete(id);}
       }
       if(wantFlux3&&!flux3InferenceAuthorized(env))throw new HttpError(503,'FLUX 3 is disabled. Configure the accepted weights and a compatible backend before enabling inference. No image was generated.');
       if(wantFlux3&&existsSync(checked.receipt))throw new HttpError(409,'This reviewed request was already submitted. Check saved results; no GPU was created.');
       let fluxSession:FluxSession|null=null;
       let workEnv:Env={...env};
       const controller=new AbortController(),outerSignal=AbortSignal.any([controller.signal,AbortSignal.timeout(900000)]);let signal:AbortSignal=outerSignal,jobId='';kleinJobs.set(id,{projectId:body.projectId,controller});
       try{
       if(wantFlux3&&autoprovEnabled(env)&&env.ADSTUDIO_FLUX3_DRY_RUN!=='1'&&liveProvisionAuthorized(env)){
        const permitted=(env.ADSTUDIO_FLUX3_CLOUD_SOURCE_SHA256||'').split(',').map(x=>x.trim()).filter(x=>/^[a-f0-9]{64}$/.test(x));if(!permitted.includes(checked.plan.input.source.sha256))throw new HttpError(403,'This photograph is not authorized for cloud transfer. The owner must configure its exact approved source hash; no GPU was created or image uploaded.');
       }
       if(wantFlux3&&autoprovEnabled(env)){
        activity.update(id,'preparing','Preparing GPU');
        fluxSession=await ensureFluxGpuSession({
         env,
         signal:outerSignal,
         onStage:(stage,detail)=>activity.update(id,stage==='Generating photograph'?'generating':stage==='Loading model'?'downloading':'preparing',detail?`${stage} · ${detail}`:stage),
        });
        if(fluxSession.mode==='dry-run')throw new HttpError(503,'FLUX 3 orchestration stopped in dry-run mode: '+String(fluxSession.plan.createBlockedReason||'No paid execution authorized.')+' No GPU or image was created. Plan saved under outputs/runpod-flux-session/.');
        workEnv={...env,COMFYUI_URL:fluxSession.comfyUrl,COMFY_BASE_URL:fluxSession.proxyUrl,ADSTUDIO_FLUX3_REMOTE_WEIGHTS:fluxSession.mode==='provisioned'?'1':env.ADSTUDIO_FLUX3_REMOTE_WEIGHTS};if(fluxSession.leaseSignal)signal=AbortSignal.any([outerSignal,fluxSession.leaseSignal]);
       }
       const modelsDir=workEnv.ADSTUDIO_KLEIN_MODELS_DIR||setup.config?.modelsDir||workEnv.COMFYUI_MODELS_DIR||(wantFlux3&&workEnv.ADSTUDIO_FLUX3_REMOTE_WEIGHTS==='1'?'':undefined);if(modelsDir===undefined)throw new HttpError(503,'Configure the local model directory.');
       const snapshot=async(e:Env=workEnv)=>{const [nodes,stats,queue]=await Promise.all(['/object_info','/system_stats','/queue'].map(p=>comfyJson(e,p)));return {nodes,stats,queue};};
       const initial=await snapshot(),ready=await (campaign?campaignAvailability:scene?sceneAvailability:kleinAvailability)(OUTPUTS,modelsDir,initial.nodes,initial.stats,initial.queue,queued>0||trainingPending);const fluxReady=wantFlux3?await flux3Availability(workEnv.ADSTUDIO_FLUX3_MODELS_DIR||modelsDir,initial.stats,initial.queue,queued>0||trainingPending,workEnv,initial.nodes):null;if(wantFlux3){if(!fluxReady?.available)throw new HttpError(503,fluxReady?.reason||'FLUX 3 Image Klein is not available. Choose Product-safe or another engine.');}else if(!ready.available&&!ready.firstRunAvailable)throw new HttpError(503,ready.reason);
       // This reviewed Klein-specific POST is the explicit first-run path; never pre-create runtime proof.
       try{await writeFile(checked.receipt,JSON.stringify({requestId:id,status:'claimed',created:Date.now(),projectId:body.projectId,fluxSession:fluxSession?{mode:fluxSession.mode,podId:fluxSession.podId}:null}),{flag:'wx'});}catch{throw new HttpError(409,'This reviewed background request was already submitted. Check history; no automatic retry.');}
       const result=await serialize(async()=>{const latest=await snapshot(workEnv),admitted=await (campaign?campaignAvailability:scene?sceneAvailability:kleinAvailability)(OUTPUTS,modelsDir,latest.stats,latest.queue,trainingPending);const comfyBase=workEnv.COMFYUI_URL||'http://127.0.0.1:8188';const useFlux3=!!wantFlux3;if(useFlux3){const flux=await flux3Availability(workEnv.ADSTUDIO_FLUX3_MODELS_DIR||modelsDir,latest.stats,latest.queue,trainingPending,workEnv,latest.nodes);if(!flux.available)throw new HttpError(503,flux.reason);}else if(!admitted.available&&!admitted.firstRunAvailable)throw new HttpError(503,admitted.reason);await ensureProxy(workEnv);if(useFlux3){const proxy=workEnv.COMFY_BASE_URL||'http://127.0.0.1:8189',r=await fetch(proxy+'/api/v2/health',{signal:AbortSignal.timeout(5000)}),h=await r.json();if(!r.ok||String(h.upstream||'').replace(/\/$/,'')!==comfyBase.replace(/\/$/,''))throw new HttpError(503,'The SDK connector targets a different ComfyUI worker. Configure a matching loopback proxy before FLUX 3 generation. No job submitted.');}const progress=(message:string,percent?:number)=>{const stage=message.startsWith('FLUX')||/step/i.test(message)?'Generating photograph':message;activity.update(id,'generating',stage.includes('Generating')?stage:`Generating photograph · ${message}`,{percent:Number.isFinite(percent)?Math.round(percent!*100):null});};if(useFlux3)activity.update(id,'generating','Generating photograph');const r=campaign?await renderProductCampaign(OUTPUTS,modelsDir,latest.stats,latest.queue,client(workEnv),checked.plan,body.image,comfyBase,signal,progress):scene?(useFlux3?await renderFlux3KleinScene(OUTPUTS,workEnv.ADSTUDIO_FLUX3_MODELS_DIR||modelsDir,latest.stats,latest.queue,client(workEnv),checked.prompt,checked.seed,body.image,body.identityImage, (checked as Awaited<ReturnType<typeof validateSceneRequest>>).archetype,comfyBase,signal,progress,workEnv,latest.nodes):await renderKleinScene(OUTPUTS,modelsDir,latest.stats,latest.queue,client(workEnv),checked.prompt,checked.seed,body.image,(checked as Awaited<ReturnType<typeof validateSceneRequest>>).archetype,comfyBase,signal,progress)):await renderKleinBackground(OUTPUTS,modelsDir,latest.stats,latest.queue,client(workEnv),checked.prompt,checked.seed,signal,progress);jobId=r.jobId;if(scene||campaign){activity.update(id,'encoding','Checking product');try{const inspected={...r,...await inspectScenePixels(OUTPUTS,checked.plan,body.image,r.url),executionKind:'model-output' as const,runpod:fluxSession?{mode:fluxSession.mode,podId:fluxSession.podId}:undefined};activity.update(id,'encoding','Designing advertisement');return inspected;}catch(error){return {...r,inspectionError:String((error as Error).message),executionKind:'model-output' as const,runpod:fluxSession?{mode:fluxSession.mode,podId:fluxSession.podId}:undefined};}}return r;});
        const bindDir=join(OUTPUTS,wantFlux3?'hero-flux3':'hero-klein',result.provenanceId);mkdirSync(bindDir,{recursive:true});await writeFile(join(bindDir,'binding.json'),JSON.stringify({projectId:body.projectId,planId:body.planId,preparedId:body.preparedId,source:checked.plan.input.source,prompt:result.prompt,seed:result.seed,engine:wantFlux3?'flux3':'klein',runpod:fluxSession?{mode:fluxSession.mode,podId:fluxSession.podId}:null}));await writeFile(checked.receipt,JSON.stringify({requestId:id,status:'complete',result}));return result;
       }catch(e){jobId=(e as any).jobId||jobId;await writeFile(checked.receipt,JSON.stringify({requestId:id,status:'failed',error:String((e as Error).message),jobId,automaticRetry:false}));throw e;}finally{kleinJobs.delete(id);if(jobId)await releaseKleinCache(jobId,workEnv.COMFYUI_URL||'http://127.0.0.1:8188');if(fluxSession){activity.update(id,'preparing','Releasing GPU');await releaseFluxGpuSession(fluxSession,env);}}
      },256*1024));
      if (route === "GET /api/health") return send(res, 200, await health(env,setup.task.busy));
      if(route==='GET /api/prompt-rewriter')return send(res,200,await rewriter.status());
      if(route==='POST /api/prompt-rewriter'){const body=await readBody(req);return send(res,200,await rewriter.rewrite(body.prompt,body.details,body.device));}
      if(route==='GET /api/brand/status')return send(res,200,await (env.ADSTUDIO_BRAND_MODEL?analysisStatus(env):brandBackendStatus(brandBackend)));
      if(route==='POST /api/brand/research')return send(res,200,await brand.discover(await readBody(req)));
      if(route==='POST /api/brand/analyze')return send(res,200,await brand.analyze(await readBody(req)));
      if(route==='POST /api/brand/image')return send(res,200,await collectBrandImage(await readBody(req)));
      if(route==='GET /api/brand/demo'){
        const file=join(OUTPUTS,'brand-demo','demo.json');if(!existsSync(file))return send(res,404,{error:'No private local brand demo has been prepared.'});
        if(statSync(file).size>25*1024*1024)throw new HttpError(400,'Local demo is too large');return send(res,200,JSON.parse(await readFile(file,'utf8')));
      }
      if(route==='GET /api/ad-composer-demo'){
        const file=join(OUTPUTS,'composer-demo','project.json');if(!existsSync(file))return send(res,404,{error:'No local cookie example has been built.'});
        if(statSync(file).size>512*1024)throw new HttpError(400,'Local example is too large');return send(res,200,JSON.parse(await readFile(file,'utf8')));
      }
      if(route==='POST /api/media')return send(res,200,await importMedia(req,OUTPUTS,env));
      if(route==='POST /api/reference/upload'){
        try{return send(res,200,await importReferenceVideo(req,OUTPUTS,env));}
        catch(e:any){if(e instanceof ReferenceError)return send(res,e.status,{error:e.message});throw e;}
      }
      if(route==='POST /api/reference/analyze'){
        try{return send(res,200,await analyzeReferenceVideo(await readBody(req,64*1024),OUTPUTS,env));}
        catch(e:any){if(e instanceof ReferenceError)return send(res,e.status,{error:e.message});throw e;}
      }
      if(route==='POST /api/reference/plan'){
        const body=await readBody(req,2*1024*1024);
        try{
         if(!body?.plan)throw new ReferenceError(400,'Provide a reviewed creative plan.');
         const intel=buildCreativeIntelligence(body.plan,body.hook);
         const shotPlan=body.analysis?planFromReference(body.plan,body.analysis,intel):planOriginalCampaign(body.plan,body.hook);
         return send(res,200,{intelligence:intel,shotPlan,productReplacementAvailable:false});
        }catch(e:any){if(e instanceof ReferenceError)return send(res,e.status,{error:e.message});throw e;}
      }
      if(route==='POST /api/inspiration/search'){
        try{
         const body=await readBody(req,16*1024);
         if(body?.intelligence)body.query=body.query||researchQueries(body.intelligence)[0];
         return send(res,200,await searchInspiration(body,env));
        }catch(e:any){if(e instanceof ReferenceError)return send(res,e.status,{error:e.message});throw e;}
      }
      if(route==='POST /api/reference/assemble'){
        try{return send(res,200,await assembleCommercial(await readBody(req,256*1024),OUTPUTS,env));}
        catch(e:any){if(e instanceof ReferenceError)return send(res,e.status,{error:e.message});throw e;}
      }
      if(route==='GET /api/sound/capabilities'){
        // Must remain usable when ComfyUI is offline — Auto stays gated with an understandable note.
        const caps=await capabilities(env).catch(()=>({ffmpeg:{available:false},shot:false} as any));
        let audio:{available:boolean;model?:string}={available:false,model:'Stable Audio Open 1.0'};
        try{audio=(await localModels(env)).audio;}catch{/* Comfy offline → Stable Audio unavailable */}
        return send(res,200,{
          stableAudio:audio,ffmpeg:caps.ffmpeg,shot:!!caps.shot,
          note:soundCapabilitiesNote(!!audio.available),
          modes:['auto','mute','reference','replace'],
          rights:{videoVsAudio:'Video footage rights do not grant soundtrack rights.'}
        });
      }
      if(route==='POST /api/sound/plan'){
        const body=await readBody(req,2*1024*1024);
        try{
          if(!body?.creative||!body?.shotPlan||!body?.takeId)throw new SoundError(400,'Provide takeId, reviewed creative plan, and campaign shotPlan.');
          return send(res,200,{plan:planCampaignSound({
            takeId:String(body.takeId),creative:body.creative,shotPlan:body.shotPlan,
            videoDuration:body.videoDuration,referenceAudio:body.referenceAudio,
            videoRights:body.videoRights,audioRights:body.audioRights,preferSilence:!!body.preferSilence
          }),stableAudio:(await localModels(env)).audio});
        }catch(e:any){if(e instanceof SoundError)return send(res,e.status,{error:e.message});throw e;}
      }
      if(route==='POST /api/sound/analyze'){
        try{return send(res,200,await analyzeOutputAudio((await readBody(req,16*1024)).url,OUTPUTS,env));}
        catch(e:any){if(e instanceof SoundError)return send(res,e.status,{error:e.message});throw e;}
      }
      if(route==='POST /api/sound/upload'){
        try{
          const rights=String(req.headers['x-osh-audio-rights']||'')==='user-owned-or-licensed'?'user-owned-or-licensed':'inspiration-only';
          return send(res,200,await importSoundtrack(req,OUTPUTS,env,rights));
        }catch(e:any){if(e instanceof SoundError)return send(res,e.status,{error:e.message});throw e;}
      }
      if(route==='POST /api/sound/extract-reference'){
        try{return send(res,200,await extractReferenceAudio(await readBody(req,64*1024),OUTPUTS,env));}
        catch(e:any){if(e instanceof SoundError)return send(res,e.status,{error:e.message});throw e;}
      }
      if(route==='POST /api/sound/mix'){
        try{return send(res,200,await mixCampaignSound(await readBody(req,2*1024*1024),OUTPUTS,env));}
        catch(e:any){if(e instanceof SoundError)return send(res,e.status,{error:e.message});throw e;}
      }
      if(route==='POST /api/compose-ad')return send(res,200,await composeAd(await readBody(req),OUTPUTS,env));
      if (route === 'GET /api/capabilities') return send(res,200,await capabilities(env));
      if (route === "GET /api/models") return send(res, 200, await localModels(env));
      if(route==='POST /api/training-mesh'){
       const body=await readBody(req,6*1024*1024);let obj;try{obj=trainingObj(body?.obj)}catch(error:any){throw new HttpError(400,error.message)}const name=outputName('obj');await writeFile(join(OUTPUTS,name),obj);return send(res,200,{url:'/outputs/'+name});
      }
      if(route==='POST /api/geometry')return send(res,200,await tracked(async body=>{
       if(typeof body.image!=='string'||!/^\/outputs\/[a-f0-9]{16}\.png$/.test(body.image))throw new HttpError(400,'Choose an API-owned reference image.');
       const catalog=await localModels(env),selected=catalog.geometry.find(model=>model.id===(body.model||geometryBase));if(!selected)throw new HttpError(503,'Install the Hunyuan3D mini model and native geometry nodes.');
       const seed=Math.floor(num(body.seed,0,2147483647,7)),steps=Math.floor(num(body.steps,1,50,20)),resolution=Math.floor(num(body.resolution,32,256,128));await ensureProxy(env);const c=client(env),wf=c.workflows.fromJson(geometryGraph(selected.parentId||selected.id,selected.loraFile,seed,steps,resolution));wf.setInput('2','image',c.assets.fromFile(outputPath(body.image)));const started=Date.now(),job=await serialize(()=>runWf(c,wf,body._requestId)),outputs=job.getOutputs('9');if(!outputs.length)throw new HttpError(502,'Geometry decoding returned no mesh.');const bytes=Buffer.from(await outputs[0].toBytes());if(bytes.length<20||bytes.length>50*1024*1024||bytes.toString('ascii',0,4)!=='glTF')throw new HttpError(502,'Invalid GLB result.');const name=outputName('glb');await writeFile(join(OUTPUTS,name),bytes);return {url:'/outputs/'+name,seconds:(Date.now()-started)/1000,model:selected.id};
      }));
      if(route==='GET /api/training'){
       const nodes=await comfyJson(env,'/object_info'),catalog=await localModels(env),required=['TrainLoraNode','MakeTrainingDataset','OSHTrainingPairs','OSHSaveTraining','LoadImage','ImageScale','ImageBatch'];
       const missing=required.filter(name=>!nodes[name]),models=[...catalog.keyframe.filter(model=>model.id===trainingBase),...catalog.video.filter(model=>model.id===videoTrainingBase&&nodes.OSHVideoTrainingDataset&&nodes.OSHTrainingConcat&&nodes.LoadVideo),...catalog.geometry.filter(model=>model.id===geometryTrainingBase&&nodes.OSH3DTrainingDataset&&nodes.VAELoader?.input?.required?.vae_name?.[0]?.includes('hunyuan3d-vae-v2-mini-withencoder.ckpt'))],projectId=url.searchParams.get('projectId');
       return send(res,200,{available:!missing.length&&!!models.length,experimental:true,models,missing,runs:(await trainingRuns(OUTPUTS)).filter(run=>!projectId||run.projectId===projectId)});
      }
      if(route==='POST /api/training')return send(res,200,await tracked(async body=>{
       let input;try{input=trainingInput(body)}catch(error:any){throw new HttpError(400,error.message)}
       if(trainingPending||queued||setup.task.busy)throw new HttpError(409,'Finish the current generation or setup before training.');
       trainingPending=true;try{
       const nodes=await comfyJson(env,'/object_info'),catalog=await localModels(env);if(![...catalog.keyframe,...catalog.video,...catalog.geometry].some(model=>model.id===input.model)||!['TrainLoraNode','MakeTrainingDataset','OSHTrainingPairs','OSHSaveTraining'].every(name=>nodes[name]))throw new HttpError(503,'Install the Studio training I/O nodes and use a compatible local base.');
       if(trainingKind(input.model)==='video'&&(!nodes.OSHVideoTrainingDataset||!nodes.OSHTrainingConcat||!nodes.LoadVideo))throw new HttpError(503,'Update Studio training nodes and restart idle ComfyUI for video training.');
       if(trainingKind(input.model)==='geometry'&&!nodes.OSH3DTrainingDataset)throw new HttpError(503,'Update Studio geometry training nodes.');
       const queue=await comfyJson(env,'/queue');if(queue.queue_running?.length||queue.queue_pending?.length)throw new HttpError(409,'ComfyUI has another job. Train when its queue is empty.');
       input.images.forEach(image=>{const file=outputPath(image.url);if(statSync(file).size>(trainingKind(input.model)==='video'?100:10)*1024*1024)throw new HttpError(400,'Training file exceeds the supported size.')});
       const id=randomBytes(16).toString('hex'),run:TrainingRun={...input,id,createdAt:Date.now(),status:'running'};await saveTrainingRun(OUTPUTS,run);
       try{await ensureProxy(env);const c=client(env),graph=trainingGraph(input,id),wf=c.workflows.fromJson(graph);for(const [index,image]of input.images.entries()){wf.setInput(String(100+index*3),trainingKind(input.model)==='video'?'file':'image',c.assets.fromFile(outputPath(image.url)));if(trainingKind(input.model)==='geometry')wf.setInput(String(101+index*3),'mesh_obj',trainingObj(await readFile(outputPath(image.mesh!),'utf8')));}
        const job=await serialize(()=>runWf(c,wf,body._requestId,false)),outputs=job.getOutputs('8');if(outputs.length!==2)throw Error('Training did not return an adapter and result.');
        const metadata=JSON.parse(Buffer.from(await outputs[0].toBytes()).toString('utf8'));if(metadata.id!==id||metadata.base!==input.model||metadata.steps!==input.steps||metadata.loraFile!=='studio/'+id+'.safetensors')throw Error('Training result provenance did not match this run.');
        const bytes=Buffer.from(await outputs[1].toBytes());if(bytes.length<16||bytes.length>256*1024*1024)throw Error('Invalid adapter size.');
        const name=outputName('safetensors');await writeFile(join(OUTPUTS,name),bytes);Object.assign(run,{status:'complete',loraFile:metadata.loraFile,download:'/outputs/'+name,loss:Array.isArray(metadata.loss)?metadata.loss:[]});await saveTrainingRun(OUTPUTS,run);return run;
       }catch(error:any){run.status='error';run.error=String(error.message).slice(0,600);await saveTrainingRun(OUTPUTS,run);throw error}
       }finally{trainingPending=false}
      }));
      if(route==='GET /api/search'){
        const nodes=await comfyJson(env,'/object_info');return send(res,200,{available:!!nodes.OSHSemanticSearch?.input?.required?.model?.[0]?.includes('MiniLM L6 · CPU'),model:'MiniLM L6 · CPU'});
      }
      if(route==='POST /api/search'){
        let input;try{input=searchInput(await readBody(req))}catch(error:any){throw new HttpError(400,error.message)}
        const key=JSON.stringify(input),cached=semanticCache.get(key);if(cached)return send(res,200,cached);
        if(semanticPending||trainingPending||queued||setup.task.busy)throw new HttpError(409,'Local AI is busy. Showing text matches.');
        semanticPending=true;
        try{const nodes=await comfyJson(env,'/object_info');if(!nodes.OSHSemanticSearch?.input?.required?.model?.[0]?.includes('MiniLM L6 · CPU'))throw new HttpError(503,'Local semantic search needs setup. Showing text matches.');
         await ensureProxy(env);const c=client(env),wf=c.workflows.fromJson(await loadGraph('semantic_minilm'));wf.setInput('1','query',input.query);wf.setInput('1','documents',JSON.stringify(input.documents.map(doc=>doc.text)));
         const job=await serialize(()=>runWf(c,wf)),output=job.getOutputs('1')[0];if(!output)throw new HttpError(502,'Local search returned no scores.');
         const raw=JSON.parse(Buffer.from(await output.toBytes()).toString('utf8')),result={model:'MiniLM L6 · CPU',results:searchResults(input.documents,raw.scores)};
         if(semanticCache.size>=100)semanticCache.delete(semanticCache.keys().next().value!);semanticCache.set(key,result);return send(res,200,result);
        }finally{semanticPending=false}
      }
      if(route==='POST /api/captions/srt'){const body=await readBody(req,512*1024);if(!Array.isArray(body?.segments)||body.segments.length>500||body.segments.some((segment:any)=>!Number.isFinite(segment?.end)||segment.end>86400))throw new HttpError(400,'Check the caption text and timing before saving.');const segments=captionSegments(body.segments,86400);if(!segments.length||segments.length!==body.segments.length)throw new HttpError(400,'Check the caption text and timing before saving.');const name=outputName('srt');mkdirSync(OUTPUTS,{recursive:true});await writeFile(join(OUTPUTS,name),captionSrt(segments),'utf8');return send(res,200,{url:'/outputs/'+name})}
      if (route === 'GET /api/captions') {
        const nodes=await comfyJson(env,'/object_info');
        const models=(nodes.OSHWhisperCaptions?.input?.required?.model?.[0]||[]).filter((model:unknown)=>typeof model==='string'&&/^Whisper [\w.-]+ · CPU$/.test(model));
        return send(res,200,{available:!!nodes.LoadAudio&&models.length>0,model:models[0]||null,models,devices:nodes.OSHWhisperCaptions?.input?.optional?.device?.[0]||['cpu'],languageSelection:!!nodes.OSHWhisperCaptions?.input?.optional?.language,modelDevices:Object.fromEntries(models.map((model:string)=>[model,['cpu','cuda']])),setup:'Run shared/runtime/setup-captions.py with ComfyUI Python, then restart ComfyUI.'});
      }
      if (route === 'POST /api/captions') return send(res,200,await tracked(async body=>{
        if(typeof body.audio!=='string'||!/^\/outputs\/[a-f0-9]{16}\.(flac|wav|mp3|m4a|ogg|webm|mp4)$/.test(body.audio))throw new HttpError(400,'Select an audio or video file from this project.');
        const source=outputPath(body.audio);if(statSync(source).size>32*1024*1024)throw new HttpError(400,'Select audio under 32 MB and 10 minutes.');
        const nodes=await comfyJson(env,'/object_info'),models=nodes.OSHWhisperCaptions?.input?.required?.model?.[0]||[],model=body.model===undefined?models[0]:body.model;if(!nodes.LoadAudio||!models.length)throw new HttpError(503,'Install a local Whisper model and restart ComfyUI.');if(typeof model!=='string'||!models.includes(model))throw new HttpError(400,'Choose an installed caption model, then try again.');
        await ensureProxy(env);const c=client(env),wf=c.workflows.fromJson(await loadGraph('captions_whisper'));
        const devices=nodes.OSHWhisperCaptions?.input?.optional?.device?.[0]||['cpu'],device=body.device??devices[0]??'cpu';if(!['cpu','cuda'].includes(device)||!devices.includes(device))throw new HttpError(400,'Choose an available caption processing device.');if(nodes.OSHWhisperCaptions?.input?.optional?.device)wf.setInput('2','device',device);const language=body.language??'auto';if(typeof language!=='string'||!(/^(auto|[a-z]{2,3})$/).test(language))throw new HttpError(400,'Choose a supported caption language.');if(language!=='auto'&&!nodes.OSHWhisperCaptions?.input?.optional?.language)throw new HttpError(503,'Update the Studio caption node and restart ComfyUI to select a language.');if(nodes.OSHWhisperCaptions?.input?.optional?.language)wf.setInput('2','language',language);wf.setInput('2','model',model);wf.setInput('1','audio',c.assets.fromFile(source));const started=Date.now(),job=await serialize(()=>runWf(c,wf,body._requestId)),output=job.getOutputs('2')[0];
        if(!output)throw new HttpError(502,'The caption workflow returned no transcript.');
        const result=JSON.parse(Buffer.from(await output.toBytes()).toString('utf8'));
        const segments=captionSegments(result.segments),name=segments.length?outputName('srt'):null;if(name)await writeFile(join(OUTPUTS,name),captionSrt(segments),'utf8');return {model,language:typeof result.language==='string'?result.language:null,duration:result.duration,seconds:(Date.now()-started)/1000,segments,srt:name?'/outputs/'+name:null};
      }));
      if (route === 'GET /api/precision-image') {
        const catalog = await localModels(env), nodes = await comfyJson(env, '/object_info'), graph = await loadGraph('precision_zimage');
        return send(res, 200, {
          available: catalog.zimageTurbo && Object.values(graph).every(n => nodes[n.class_type]),
          automaticSubjectSelection: false,
          model: 'Z-Image Turbo · masked resynthesis',
          note: 'Experimental masked resynthesis, not an instruction-edit checkpoint. Outside the mask is composited from the original.',
        });
      }
      if (route === 'POST /api/precision-image') return send(res, 200, await tracked(async body => {
        let sources;
        try { sources = await precisionSources(OUTPUTS, body); }
        catch (error: any) { throw new HttpError(error.status || 400, error.message); }
        const catalog = await localModels(env);
        if (!catalog.zimageTurbo) throw new HttpError(503, 'Precision editing needs Z-Image Turbo (the fast image pack).');
        const c = client(env), wf = c.workflows.fromJson(await loadGraph('precision_zimage'));
        wf.setInput('11', 'image', c.assets.fromFile(sources.image.path));
        wf.setInput('12', 'image', c.assets.fromFile(sources.mask.path));
        wf.setInput('5', 'text', body.prompt);
        wf.setInput('8', 'seed', Math.floor(num(body.seed, 0, 2 ** 32, 1)));
        const start = Date.now(), job = await serialize(() => runWf(c, wf, body._requestId));
        return { url: await save(job, '10', 'png'), seconds: (Date.now() - start) / 1000, width: sources.image.width, height: sources.image.height };
      }));
      if (route === "POST /api/upload") return send(res, 200, await upload(await readBody(req, MAX_UPLOAD_BODY)));
      if (route === "POST /api/export") return send(res, 200, await exportVideo(await readBody(req), env));
      if (route === "POST /api/product-video") return send(res, 200, await productVideo(await readBody(req), env));
      if (route === 'POST /api/audio') return send(res,200,await tracked(body=>generateAudio(body,env)));
      if (route === 'POST /api/edit-video') return send(res,200,await editVideo(await readBody(req),env));
      if(route==='POST /api/hero/qwen'&&relay)return send(res,200,await tracked(body=>relay.generate(body,String(req.headers.origin||'http://'+req.headers.host),(phase,message,more)=>activity.update(body._requestId,phase,message,more)),20*1024*1024));
      if(route==='POST /api/hero/qwen')return send(res,200,await tracked(body=>serialize(async()=>{
       const modelsDir=setup.config?.modelsDir||env.COMFYUI_MODELS_DIR;
       return generateQwenHero(body,OUTPUTS,{
        check:async()=>qwenAvailability(await comfyJson(env,'/object_info'),modelsDir),
        weights:async()=>{if(!modelsDir)throw new HeroError(503,'Configure the connected ComfyUI models folder before Qwen generation.');return verifyWeightFiles(modelsDir,(await qwenContract()).files);},
        execute:async(graph,reference,output,progress)=>{
         if(env.QWEN_APP_REMOTE_SESSION){const files={approval:env.QWEN_APP_REMOTE_SESSION,lease:'/workspace/qwen-lease.json',watchdog:'/workspace/qwen-watchdog.json',receipt:join(OUTPUTS,'qwen-app-one-job.json')},gate=await acceptanceGate(files);acceptanceRequest(gate.plan,body);await claimAcceptanceJob(files,{podId:gate.lease.podId,requestId:body._requestId});}
         return qwenSDKTransport(client(env),()=>ensureProxy(env))(graph,reference,output,progress);
        },
        progress:(phase,message,more)=>activity.update(body._requestId,phase,message,more)
       });
      }),20*1024*1024));
      if(route==='POST /api/hero/reimagine')return send(res,200,await tracked(body=>reimagineHero(body,env)));
      if (route === "POST /api/keyframe") return send(res, 200, await tracked(body=>keyframe(body, env)));
      if (route === "POST /api/shot") return send(res, 200, await tracked(body=>shot(body, env)));
      return send(res, 404, { error: "unknown endpoint" });
    } catch (e: any) {
      const status = e instanceof HttpError || e instanceof ComposeError || e instanceof ReferenceError || e instanceof BrandError || e instanceof StaticAdError || e instanceof HeroError || e instanceof PromptRewriteError || e instanceof CreativeError ? e.status : 500;
      if(isApi&&url.pathname!=='/api/errors')errors.add(`${req.method} ${url.pathname}`,e,{status,requestId:typeof req.headers['x-osh-request']==='string'?req.headers['x-osh-request']:undefined});
      if (status === 500) console.error(`[api] ${url.pathname} failed:`, e);
      send(res, status, { error: status === 500 ? "generation failed (see server log)" : e.message });
    }
  };
}

/** Vite plugin: mounts /api + /outputs on the dev and preview servers. */
export function comfyApi(env: Env): Plugin {
  const setup=new RuntimeSetup(ROOT,env,ensureProxy,()=>{comfy=null},(url,text)=>diagnostics.capture(url,text));
  const rewriter=new PromptRewriter({
   status:async()=>{try{const nodes=await comfyJson(env,'/object_info');const available=!!nodes.TextGenerate?.input?.optional?.system_prompt&&!!nodes.SaveText&&nodes.CLIPLoader?.input?.required?.clip_name?.[0]?.includes(promptModel);return {available,cpuSupported:false,id:promptModel,model:'Qwen3 4B · ComfyUI',reason:available?'Uses installed Qwen3 through ComfyUI. GPU/offload is managed by ComfyUI unless CPU is selected.':'Prompt polishing needs current ComfyUI TextGenerate/SaveText nodes and the Qwen3 4B text encoder from the image model pack.'}}catch{return {available:false,id:promptModel,model:'Qwen3 4B · ComfyUI',reason:'Connect ComfyUI to polish prompts. Advanced manual editing is available.'}}},
   generate:async(content,device)=>{if(queued>0)throw new PromptRewriteError(409,'ComfyUI is busy generating. Polish again when the current job finishes.');await ensureProxy(env);const c=client(env),wf=c.workflows.fromJson(await loadGraph('prompt_polish'));wf.setInput('1','device',device);wf.setInput('2','prompt',content);wf.setInput('2','system_prompt',promptInstruction);if(queued>0)throw new PromptRewriteError(409,'ComfyUI is busy generating. Polish again when the current job finishes.');const job=await serialize(()=>runWf(c,wf));const output=job.getOutputs('3')[0];if(!output)throw new PromptRewriteError(502,'ComfyUI returned no polished prompt. Your prompt is unchanged.');return Buffer.from(await output.toBytes()).toString('utf8')}
  });
  const localBusy=(ownJob=false):string|false=>setup.task.busy?'Local runtime setup is in progress.':trainingPending?'Local adapter training is running.':ownJob||queued<1?false:textJobs>0?'Local Qwen is still finishing another text job (website brand analysis or a creative plan). Try again in a moment.':`Another local ComfyUI job is running (${queued} in the app queue). Try again when it finishes.`;
  const textReadiness=async(ownJob=false)=>{creativeTextRouting(env);const [nodes,queue,stats]=await Promise.all(['/object_info','/queue','/system_stats'].map(path=>comfyJson(env,path).catch(()=>null)));return creativeTextReadiness(nodes,queue,stats,localBusy(ownJob));};
  const creativeBackend:CreativeBackend={
   status:async()=>{try{return await textReadiness();}catch(e){return {available:false,model:promptModel,reason:(e as Error).message};}},
   generate:async(system,content,options={})=>{
    const signal=options.signal||AbortSignal.timeout(creativeTextDeadlineMs);signal.throwIfAborted();
    const ready=await textReadiness();signal.throwIfAborted();if(!ready.available)throw new CreativeError(409,ready.reason);await ensureProxy(env);signal.throwIfAborted();
    const h=await fetch((env.COMFY_BASE_URL||'http://127.0.0.1:8189')+'/api/v2/health',{signal:AbortSignal.any([signal,AbortSignal.timeout(5000)])}),health=await h.json();
    if(!h.ok||String(health.upstream||'').replace(/\/$/,'')!==(env.COMFYUI_URL||'http://127.0.0.1:8188').replace(/\/$/,''))throw new CreativeError(503,'Text SDK proxy points to a different worker. Configure matching loopback URLs; no planning job submitted.');
    const busy=localBusy();if(busy)throw new CreativeError(409,busy+' No text job submitted.');const c=client(env);let jobId:string|undefined;
    const textGraph=await loadGraph('prompt_polish');textJobs++;const text=await creativeSDKText(c,textGraph,system,content,wf=>serialize(async()=>{signal.throwIfAborted();const latest=await textReadiness(true);signal.throwIfAborted();if(!latest.available)throw new CreativeError(409,latest.reason);const job=await runWf(c,wf,undefined,false,creativeTextDeadlineMs,creativeTextExecution(c,signal,options.onSubmitted),true);jobId=job.id;await releaseKleinCache(job.id,env.COMFYUI_URL||'http://127.0.0.1:8188');return job;}),signal).finally(()=>{textJobs--;});
    signal.throwIfAborted();if(!jobId)throw new CreativeError(502,'Text SDK did not return a job identity.');const native=await fetch((env.COMFYUI_URL||'http://127.0.0.1:8188')+'/history/'+encodeURIComponent(jobId),{signal:AbortSignal.any([signal,AbortSignal.timeout(5000)])});if(!native.ok)throw new CreativeError(502,'Cannot verify the executed planning job.');const execution=verifyPlanningExecution(await native.json(),jobId,promptModel,system,content);options.onExecution?.(execution);return text;
   }
  };
  const creative=createCreativeEngine(OUTPUTS,creativeBackend),brand=createBrandService(env,creativeBackend);
  return {
    name: "osh-comfy-api",
    async configureServer(server) {
      server.middlewares.use(middleware(env,setup,rewriter,creative,creativeBackend,brand));
      if(setup.config?.mode==='managed'||setup.config?.launchDirectory)setup.start();
      else void (async()=>{if (!(await up((env.COMFYUI_URL || "http://127.0.0.1:8188") + "/system_stats"))) console.warn("[api] ComfyUI not reachable; open Local setup in Studio.");else await ensureProxy(env)})().catch(error=>console.warn('[setup]',error.message));
    },
    async configurePreviewServer(server) {
      server.middlewares.use(middleware(env,setup,rewriter,creative,creativeBackend,brand));
      if(setup.config?.mode==='managed'||setup.config?.launchDirectory)setup.start();else void ensureProxy(env).catch(error=>console.warn('[setup]',error.message));
    },
  };
}
