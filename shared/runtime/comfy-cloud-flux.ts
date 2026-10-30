/**
 * Comfy Cloud FLUX 3 Klein mi2i adapter (workflow API v2 via @comfyorg/sdk).
 * Isolated from local/RunPod clients. Spend is off by default.
 *
 * Compatibility (docs 2026-10-29): Comfy Cloud hosts official FLUX 3 Image Klein
 * Distilled Image Edit templates with ReferenceMultiLatent. Our pinned mi2i graph
 * is the same node family (dual LoadImage 11/111, ReferenceMultiLatent, SaveImage 9).
 * Cloud templates ship int8-convrot weights; this adapter remaps BF16 filenames to
 * those Cloud template names unless ADSTUDIO_COMFY_CLOUD_WEIGHT_PROFILE=bf16.
 * Partner Node / Router model endpoints are forbidden.
 */
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {
  ComfyError,
  IdempotencyKeyReuse,
  InsufficientCredits,
  JobFailed,
  MissingCredentials,
  Unauthorized,
  type Comfy,
} from '@comfyorg/sdk';
import type {AdScene} from '../lib/ad-scene.ts';
import {HeroError,heroSha,heroSource} from './hero-ad.ts';
import {
  bindFlux3Mi2iInputs,
  flux3CanonSha,
  flux3Contract,
  loadFlux3Workflow,
} from './flux3-klein-scene.ts';
import {
  comfyCloudEnabled,
  comfyCloudSpendApproved,
  createComfyCloudClient,
  loadComfyCloudApiKey,
  COMFY_CLOUD_BASE_URL,
} from './comfy-cloud-client.ts';

/** Official Cloud distilled edit template weight names (docs.comfy.org/tutorials/flux/flux-3-klein). */
const BF16_TO_CLOUD_INT8:Record<string,string>={
  'flux3-image-klein-bf16.safetensors':'flux3-image-klein-int8-convrot.safetensors',
  'qwen3vl_4b_bf16.safetensors':'qwen3vl_4b_int8_convrot.safetensors',
};

export type ComfyCloudFluxAvailability={
  id:'flux3-cloud';
  label:string;
  available:boolean;
  authorized:boolean;
  enabled:boolean;
  spendApproved:boolean;
  sourcePolicy:'reviewed'|'allowlist';
  credentialsReady:boolean;
  workflowReady:boolean;
  compatConfirmed:boolean;
  weightProfile:'int8'|'bf16';
  weightAdaptation:string[];
  partnerNodeForbidden:true;
  status:string;
  reason:string;
  endpoint:string;
  concurrencyLimit:1;
  estimatedCreditsNote:string;
};

export function comfyCloudCompatConfirmed(env:Record<string,string|undefined>=process.env){
  return env.ADSTUDIO_COMFY_CLOUD_COMPAT_CONFIRMED==='1';
}

export function comfyCloudWeightProfile(env:Record<string,string|undefined>=process.env):'int8'|'bf16'{
  return env.ADSTUDIO_COMFY_CLOUD_WEIGHT_PROFILE==='bf16'?'bf16':'int8';
}

export function authorizedComfyCloudSourceHashes(env:Record<string,string|undefined>=process.env){
  return (env.ADSTUDIO_COMFY_CLOUD_SOURCE_SHA256||'').split(',').map(x=>x.trim()).filter(x=>/^[a-f0-9]{64}$/.test(x));
}

/** `reviewed`: any source bound to an owner-reviewed brief may upload. Default `allowlist`: exact hashes only. */
export function comfyCloudSourcePolicy(env:Record<string,string|undefined>=process.env):'reviewed'|'allowlist'{
  return env.ADSTUDIO_COMFY_CLOUD_SOURCE_POLICY==='reviewed'?'reviewed':'allowlist';
}

export function assertComfyCloudSourceAuthorized(sourceSha256:string,env:Record<string,string|undefined>=process.env){
  if(comfyCloudSourcePolicy(env)==='reviewed')return;
  const permitted=authorizedComfyCloudSourceHashes(env);
  if(!permitted.length)throw new HeroError(403,'No product photograph is authorized for Comfy Cloud upload. Set ADSTUDIO_COMFY_CLOUD_SOURCE_POLICY=reviewed, or ADSTUDIO_COMFY_CLOUD_SOURCE_SHA256 to the exact approved normalized source hash. No upload or job was started.');
  if(!permitted.includes(sourceSha256))throw new HeroError(403,'This photograph is not authorized for Comfy Cloud transfer. Configure its exact approved source hash; no upload or job was started.');
}

/** Remap BF16 pin filenames to Cloud template int8 names. Does not change topology. */
export function adaptFlux3GraphForComfyCloud(graph:Record<string,any>,env:Record<string,string|undefined>=process.env){
  const profile=comfyCloudWeightProfile(env);
  const g=structuredClone(graph);
  const changes:string[]=[];
  if(profile==='bf16')return {graph:g,changes,profile};
  for(const node of Object.values(g)){
    if(!node||typeof node!=='object')continue;
    const inputs=node.inputs;if(!inputs||typeof inputs!=='object')continue;
    for(const key of ['unet_name','clip_name','vae_name'] as const){
      const cur=inputs[key];
      if(typeof cur!=='string')continue;
      const next=BF16_TO_CLOUD_INT8[cur];
      if(next&&next!==cur){inputs[key]=next;changes.push(`${cur} → ${next}`);}
    }
  }
  return {graph:g,changes,profile};
}

export async function comfyCloudFluxAvailability(env:Record<string,string|undefined>=process.env):Promise<ComfyCloudFluxAvailability>{
  const enabled=comfyCloudEnabled(env);
  const spendApproved=comfyCloudSpendApproved(env);
  const key=loadComfyCloudApiKey(env);
  const credentialsReady=!!key;
  const compatConfirmed=comfyCloudCompatConfirmed(env);
  let workflowReady=false;
  let weightAdaptation:string[]=[];
  let profile=comfyCloudWeightProfile(env);
  try{
    const loaded=await loadFlux3Workflow('mi2i');
    workflowReady=true;
    weightAdaptation=adaptFlux3GraphForComfyCloud(loaded.graph,env).changes;
    profile=comfyCloudWeightProfile(env);
  }catch{}
  const pins=await flux3Contract().catch(()=>null);
  const authorized=enabled&&credentialsReady&&spendApproved&&compatConfirmed&&workflowReady;
  const available=authorized;
  let status='awaiting-owner-auth';
  let reason='Comfy Cloud / FLUX is not ready.';
  if(!enabled){status='awaiting-owner-auth';reason='Comfy Cloud engine disabled. Set ADSTUDIO_COMFY_CLOUD_ENABLED=1 after reading docs/COMFY_CLOUD_FLUX.md.';}
  else if(!credentialsReady){status='awaiting-owner-auth';reason='COMFY_API_KEY is missing. Create a key at https://platform.comfy.org/profile/api-keys and set it server-side only.';}
  else if(!compatConfirmed){status='awaiting-owner-auth';reason='Comfy Cloud FLUX compatibility is not owner-confirmed. Read docs/COMFY_CLOUD_FLUX.md, then set ADSTUDIO_COMFY_CLOUD_COMPAT_CONFIRMED=1. No credits were spent.';}
  else if(!workflowReady){status='not-installed';reason='Pinned FLUX 3 Klein mi2i workflow is missing or hash-mismatched.';}
  else if(!spendApproved){status='awaiting-owner-auth';reason='Comfy Cloud spend is disabled (default). Set ADSTUDIO_COMFY_CLOUD_SPEND_APPROVED=1 to let each Generate click spend Comfy Cloud credits. One job at a time; no automatic retries.';}
  else{status='available';reason=profile==='int8'
    ?`Comfy Cloud FLUX 3 Klein Distilled mi2i ready (API v2 → ${COMFY_CLOUD_BASE_URL}). Weight filenames remapped to Cloud int8 templates: ${weightAdaptation.join('; ')||'none'}. Partner nodes forbidden.`
    :`Comfy Cloud FLUX 3 Klein Distilled mi2i ready with BF16 filenames (Cloud may reject if only int8 is installed). Partner nodes forbidden.`;}
  return{
    id:'flux3-cloud',
    label:'Comfy Cloud / FLUX 3 Image Klein',
    available,
    authorized,
    enabled,
    spendApproved,
    sourcePolicy:comfyCloudSourcePolicy(env),
    credentialsReady,
    workflowReady,
    compatConfirmed,
    weightProfile:profile,
    weightAdaptation,
    partnerNodeForbidden:true,
    status,
    reason,
    endpoint:COMFY_CLOUD_BASE_URL,
    concurrencyLimit:1,
    estimatedCreditsNote:'Credits draw from the same Comfy Cloud monthly pool as the web UI. This app does not enforce a hard credit ceiling; Standard plan allows 1 concurrent workflow. Exact per-image credit cost is account/plan-specific — check platform.comfy.org before approving spend.',
    ...(pins?{license:pins.license,workflowFile:pins.workflowFile,graphSha256:pins.graphSha256}:{}),
  };
}

function inspectFlux3Png(bytes:Buffer){
  if(bytes.length<60||bytes.length>32*1024*1024||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
    throw new HeroError(422,'Comfy Cloud FLUX returned an invalid PNG.');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(!width||!height||width>4096||height>4096)throw new HeroError(422,'Comfy Cloud FLUX PNG dimensions out of range.');
  return {width,height};
}

function mapCloudError(error:unknown):never{
  if(error instanceof HeroError)throw error;
  if(error instanceof InsufficientCredits)
    throw new HeroError(402,'Comfy Cloud reports insufficient credits. Top up at platform.comfy.org. No automatic retry was started.');
  if(error instanceof MissingCredentials||error instanceof Unauthorized)
    throw new HeroError(401,'Comfy Cloud rejected the API key. Check COMFY_API_KEY server-side. No job was started.');
  if(error instanceof IdempotencyKeyReuse)
    throw new HeroError(409,'This Comfy Cloud submission key was already used. Recover the existing Cloud job from saved receipts; do not submit again (a naive retry can bill twice).');
  if(error instanceof JobFailed)
    throw new HeroError(502,'Comfy Cloud FLUX job failed: '+((error as Error).message||'unknown')+'. No automatic retry.');
  if(error instanceof ComfyError){
    const msg=String(error.message||error);
    if(/unsupported|unknown node|missing.*node|InvalidWorkflow/i.test(msg))
      throw new HeroError(503,'Comfy Cloud rejected the FLUX workflow (unsupported node or weight). '+msg+' Partner nodes were not used.');
    throw new HeroError(502,'Comfy Cloud error: '+msg);
  }
  throw error instanceof Error?error:new HeroError(502,String(error));
}

export type CloudFluxProgress=(stage:string,detail?:string,percent?:number)=>void;

/** Submit once with a fixed idempotency key. Never auto-retry submit. */
export async function executeFlux3ComfyCloud(
  c:Comfy,
  graph:Record<string,any>,
  sourcePath:string,
  identityPath:string,
  idempotencyKey:string,
  signal:AbortSignal,
  onProgress?:CloudFluxProgress,
){
  onProgress?.('Preparing product references');
  const wf=c.workflows.fromJson(graph);
  wf.setInput('11','image',c.assets.fromFile(sourcePath));
  wf.setInput('111','image',c.assets.fromFile(identityPath));
  if(signal.aborted)throw new HeroError(499,'Comfy Cloud generation cancelled before upload.');
  onProgress?.('Uploading to Comfy Cloud');
  onProgress?.('Submitting workflow');
  let job;
  try{
    job=await c.submit(wf,{idempotencyKey,signal});
  }catch(error){
    mapCloudError(error);
  }
  const events=new AbortController();
  const stream=(async()=>{
    try{
      for await(const e of job.events(events.signal)){
        if(e.kind==='progress')onProgress?.('Generating photograph',e.step?`step ${e.step}/${e.steps}`:undefined,e.value);
        else if(e.kind==='statusChange')onProgress?.('Generating photograph',String((e as any).status||''));
      }
    }catch{/* poll path remains authoritative */}
  })();
  try{
    onProgress?.('Generating photograph');
    await job.wait(600000,signal);
    await job.result(signal);
    onProgress?.('Downloading image');
    const output=job.getOutputs('9')[0];
    if(!output)throw new HeroError(502,'Comfy Cloud FLUX returned no image on SaveImage node 9.');
    const bytes=Buffer.from(await output.toBytes({timeoutMs:30000,signal}));
    return {promptId:job.id,bytes,idempotencyKey,cancel:()=>job.cancel()};
  }catch(error){
    (error as any).jobId=job.id;
    (error as any).idempotencyKey=idempotencyKey;
    mapCloudError(error);
  }finally{
    events.abort();
    void stream;
  }
}

export async function renderFlux3ComfyCloudScene(
  outputs:string,
  prompt:string,
  seed:number,
  image:string,
  identityImage:string|undefined,
  archetype:AdScene['archetype'],
  signal:AbortSignal,
  onProgress?:CloudFluxProgress,
  env:Record<string,string|undefined>=process.env,
  opts?:{idempotencyKey?:string;client?:Comfy},
):Promise<AdScene>{
  const avail=await comfyCloudFluxAvailability(env);
  if(!avail.available)throw new HeroError(503,avail.reason);
  const apiKey=loadComfyCloudApiKey(env);
  if(!apiKey)throw new HeroError(401,'COMFY_API_KEY is required for Comfy Cloud.');

  const loaded=await loadFlux3Workflow('mi2i');
  const source=await heroSource(outputs,image);
  assertComfyCloudSourceAuthorized(source.sha256,env);
  let identityBytes=source.bytes;
  let identitySha=source.sha256;
  if(identityImage&&identityImage!==image){
    const idSource=await heroSource(outputs,identityImage);
    identityBytes=idSource.bytes;identitySha=idSource.sha256;
  }

  const id=randomBytes(8).toString('hex');
  const dir=join(outputs,'hero-flux3-cloud',id);
  await mkdir(dir,{recursive:true});
  await writeFile(join(dir,'reference.png'),source.bytes,{flag:'wx'});
  await writeFile(join(dir,'identity.png'),identityBytes,{flag:'wx'});
  const sourceName='flux3-cloud-source-'+id+'.png';
  const identityName='flux3-cloud-identity-'+id+'.png';
  const bound=bindFlux3Mi2iInputs(loaded.graph,{
    prompt,
    seed,
    sourceImage:sourceName,
    identityImage:identityName,
    filenamePrefix:'adstudio/flux3-cloud-mi2i-'+id,
  },env);
  const adapted=adaptFlux3GraphForComfyCloud(bound,env);
  const idempotencyKey=opts?.idempotencyKey||randomUUID();
  await writeFile(join(dir,'request.json'),JSON.stringify({
    prompt,seed,
    sourceSha256:source.sha256,
    identitySha256:identitySha,
    workflowSha:flux3CanonSha(loaded.graph),
    weightProfile:adapted.profile,
    weightAdaptation:adapted.changes,
    idempotencyKey,
    endpoint:COMFY_CLOUD_BASE_URL,
    partnerNodeForbidden:true,
  },null,2));

  const client=opts?.client||createComfyCloudClient({apiKey});
  const start=Date.now();
  let result:{promptId:string;bytes:Buffer;idempotencyKey:string};
  try{
    result=await executeFlux3ComfyCloud(
      client,
      adapted.graph,
      join(dir,'reference.png'),
      join(dir,'identity.png'),
      idempotencyKey,
      signal,
      onProgress,
    );
  }catch(error){
    await writeFile(join(dir,'failure.json'),JSON.stringify({
      error:String((error as Error).message),
      jobId:(error as any).jobId||null,
      idempotencyKey,
      automaticRetry:false,
      elapsedMs:Date.now()-start,
    },null,2)).catch(()=>{});
    throw error;
  }

  if(result.bytes.length>32*1024*1024)throw new HeroError(422,'Comfy Cloud FLUX output exceeds size limit.');
  await writeFile(join(dir,'received.png'),result.bytes,{flag:'wx'});
  const checked=inspectFlux3Png(result.bytes);
  // Cloud does not expose local /view for native reference re-download; we prove
  // the bytes we uploaded and that the returned PNG is a fresh job output.
  if(heroSha(await readFile(join(dir,'reference.png')))!==source.sha256)
    throw new HeroError(422,'Cloud reference file was altered before upload.');
  if(heroSha(await readFile(join(dir,'identity.png')))!==identitySha)
    throw new HeroError(422,'Cloud identity file was altered before upload.');
  await writeFile(join(dir,'raw.png'),result.bytes,{flag:'wx'});
  await writeFile(join(outputs,id+'.png'),result.bytes,{flag:'wx'});

  const response:AdScene={
    url:'/outputs/'+id+'.png',
    sha256:heroSha(result.bytes),
    width:checked.width,
    height:checked.height,
    seconds:(Date.now()-start)/1000,
    model:'flux3-klein-scene',
    jobId:result.promptId,
    provenanceId:id,
    prompt,
    seed,
    workflowSha256:flux3CanonSha(adapted.graph),
    sourceSha256:source.sha256,
    archetype,
    fidelityMode:'creative-restage',
    warning:'Creative Restage · Comfy Cloud FLUX 3 Image Klein ('+adapted.profile+'). AI re-photographs from source + identity refs. Packaging/geometry may change. Compare with the original; not product-safe.',
  };
  await writeFile(join(dir,'provenance.json'),JSON.stringify({
    ...response,
    identitySha256:identitySha,
    promptUpsamplerBypassed:env.ADSTUDIO_FLUX3_SKIP_PUP==='1',
    transport:'Comfy SDK → Comfy Cloud API v2 ('+COMFY_CLOUD_BASE_URL+')',
    weightProfile:adapted.profile,
    weightAdaptation:adapted.changes,
    idempotencyKey:result.idempotencyKey,
    partnerNodeForbidden:true,
    ownerApproved:false,
    sourcePhotoSubstitution:false,
  },null,2));
  await writeFile(join(outputs,'hero-flux3-cloud','verified-scene.json'),JSON.stringify({
    jobId:result.promptId,
    workflowSha256:loaded.pins.graphSha256,
    weightProfile:adapted.profile,
    endpoint:COMFY_CLOUD_BASE_URL,
  },null,2));
  return response;
}
