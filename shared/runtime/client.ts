// Browser client for the generation API in shared/runtime/api.ts (mounted on the Vite server).
// When the API isn't reachable (no ComfyUI, or a non-localhost host without the token),
// `online` stays false and apps show their offline state.

export type Health = { comfyui: boolean; proxy: boolean; queued: number };
export type KeyframeResult = { url: string; seconds: number };
export type ShotResult = { url: string; seconds: number; frames: number;fps?:number;duration?:number;jobId?:string };
export type ShotKey = { image: string; t: number; strength?: number };
export type ProductVideoOptions = { image: string; background?: string; mode: 'locked' | 'camera'; ratio: '16:9' | '9:16' | '1:1'; duration: number; motion?: 'push' | 'pan-left' | 'pan-right' };
export type ProductVideoResult = ShotResult & { width: number; height: number; mode: 'locked' | 'camera'; motion: string; protectedRect: { x: number; y: number; width: number; height: number } | null };
import type { ModelChoice } from './model-catalog';
import { creativePlanRequestMs } from '../lib/creative-deadline.ts';
import type { ServerTiming } from './render-timings';
export type LocalModels = { keyframe: ModelChoice[]; video: ModelChoice[]; geometry?:ModelChoice[]; audio?:{available:boolean;model:string}; timing: ServerTiming; research: { repo: string; revision: string; bytes: number }[]; inventory: { category: string; files: string[] }[] };

let online = false;
let info: Health | null = null;
let reason = "";

async function health(): Promise<{ online: boolean; info: Health | null; reason: string }> {
  try {
    const r = await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.statusText);
    info = j as Health;
    online = info.comfyui && info.proxy;
    reason = online ? "" : !info.comfyui ? "ComfyUI isn't running" : "comfy-api-proxy isn't running";
  } catch (e) {
    online = false;
    info = null;
    reason = (e as Error).message;
  }
  return { online, info, reason };
}

export type GenerationActivity={id:string;phase:string;message:string;phaseStartedAt:number;startedAt:number;updatedAt:number;percent:number|null;step:number|null;steps:number|null;diagnostics?:{at:number;source:'sdk'|'comfy-server'|'managed-server';message:string}[]};
function emitActivity(detail:GenerationActivity){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('osh-generation-progress',{detail}))}
async function post<T>(name: string, body: unknown, signal?:AbortSignal): Promise<T> {
  const tracked=['shot','keyframe','audio','captions','training','geometry','hero/reimagine','hero/qwen','hero/background','hero/scene','hero/campaign'].includes(name),id=tracked?((name==='hero/background'||name==='hero/scene'||name==='hero/campaign')?String((body as any)?.requestId||''):crypto.randomUUID().replaceAll('-','')):null;let finished=false,polling=false,failed=false;
  const poll=async()=>{if(!id||finished||polling)return;polling=true;try{const r=await fetch('/api/activity/'+id,{cache:'no-store',signal:AbortSignal.timeout(3000)});if(r.ok&&!finished){const state=await r.json();if(typeof state.serverNow==='number')state.phaseStartedAt=Date.now()-Math.max(0,state.serverNow-state.phaseStartedAt);emitActivity(state)}}catch{/* Progress failure must never cancel a render. */}finally{polling=false}};
  let timer:ReturnType<typeof setInterval>|undefined;if(id){const now=Date.now();emitActivity({id,phase:'queued',message:'Waiting for the local runtime…',phaseStartedAt:now,startedAt:now,updatedAt:now,percent:null,step:null,steps:null});timer=setInterval(()=>void poll(),700)}
  try{
   const r = await fetch('/api/'+name, { method:'POST',headers:{'Content-Type':'application/json',...(id?{'X-OSH-Request':id}:{})},body:JSON.stringify(body),signal });
   const j=await r.json().catch(()=>({error:r.statusText}));if(!r.ok||j.error)throw new Error(j.error||r.statusText);
   return j as T;
  } catch(error){failed=true;if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('osh-request-error',{detail:{operation:name,message:(error as Error).message,id}}));throw error} finally{finished=true;if(timer)clearInterval(timer);if(id){const now=Date.now();emitActivity({id,phase:failed?'error':'complete',message:failed?'Generation failed. Check the message in the workspace.':'Media ready.',startedAt:now,phaseStartedAt:now,updatedAt:now,percent:null,step:null,steps:null})}}
}

export type HeroResult={url:string;width:number;height:number;sha256:string;sourceSha256:string;seconds:number;method:string;workflowSha256?:string;model?:string;jobId?:string;provenanceId?:string;originalSha256?:string};
export const OSH = {
  async creativeStatus(){const r=await fetch('/api/creative/status',{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||r.statusText);return data as {available:boolean;model:string;reason:string;busy:boolean;wait?:boolean;deadlineMs?:number;fallback:string;imageGeneration:false};},
  creativePlan:(body:{image:string;input:import('../lib/creative-engine').CreativeInput;planningMode?:'ai'|'basic'},signal?:AbortSignal)=>post<import('../lib/creative-engine').CreativePlan>('creative/plan',body,signal?AbortSignal.any([signal,AbortSignal.timeout(creativePlanRequestMs)]):AbortSignal.timeout(creativePlanRequestMs)),
  creativeSelect:(body:{planId:string;projectId:string;conceptId:string;facts?:import('../lib/product-brief').SourceFacts})=>post<import('../lib/creative-engine').CreativePlan>('creative/select',body),
  creativeRefineComposition:(body:{planId:string;projectId:string;text:string})=>post<import('../lib/creative-engine').CreativePlan>('creative/refine-composition',body),
  async creativePlanRecord(planId:string,projectId:string){const r=await fetch('/api/creative/plan/'+encodeURIComponent(planId)+'?projectId='+encodeURIComponent(projectId),{cache:'no-store',signal:AbortSignal.timeout(10000)});const d=await r.json();if(!r.ok)throw Error(d.error||r.statusText);return d as import('../lib/creative-engine').CreativePlan;},
  creativePrepare:(body:{planId:string;current:import('../lib/creative-engine').CreativeInput;image:string;original:string;confirmation:{direction:boolean;facts:boolean}})=>post<import('../lib/creative-engine').CreativePrepared>('creative/prepare',body),
  reviewSceneFraming:(body:{projectId:string;planId:string;preparedId:string;current:import('../lib/creative-engine').CreativeInput;image:string;output:string;decision:'accept'|'reject';confirmed:boolean})=>post<{review:import('../lib/scene-framing-review').ManualFramingReview;inspection:Partial<import('../lib/ad-scene').AdScene>}>('creative/review-framing',body),
  exportReviewedScene:(body:{projectId:string;planId:string;preparedId:string;current:import('../lib/creative-engine').CreativeInput;image:string;output:string;reviewId:string;design:import('../lib/static-ad').StaticDesign;logo?:string})=>post<{url:string;width:number;height:number;sha256:string;sources:Record<string,string>;warnings:string[];framingReviewId:string}>('creative/export-reviewed-scene',body),
  inspectScene:(body:{projectId:string;planId:string;preparedId:string;current:import('../lib/creative-engine').CreativeInput;image:string;output:string})=>post<Partial<import('../lib/ad-scene').AdScene>>('creative/inspect-scene',body),
  creativeCompose:(body:{planId:string;preparedId:string;projectId:string;hero:string;provenanceId:string;heroAssetId:string;logo?:string;logoAssetId?:string;fidelityReviewed:boolean;copy?:Partial<Pick<import('../lib/static-ad').StaticDesign,'headline'|'body'|'cta'|'size'>>})=>post<{url:string;width:number;height:number;sha256:string;sources:Record<string,string>;design:import('../lib/static-ad').StaticDesign}>('creative/compose',body),
  captions:(audio:string,model?:string,device?:string,language='auto')=>post<{model:string;language:string|null;duration:number;seconds:number;segments:import('../lib/captions').CaptionSegment[];srt?:string|null}>('captions',{audio,model,device,language}),
  adBackground:(body:{requestId:string;projectId:string;planId:string;preparedId:string;image:string;current:import('../lib/creative-engine').CreativeInput})=>post<import('../lib/ad-background').AdBackground>('hero/background',body),
  adScene:(body:{promptSha256:string;requestId:string;projectId:string;planId:string;preparedId:string;image:string;current:import('../lib/creative-engine').CreativeInput;engine?:'klein'|'flux3'|'flux3-cloud';identityImage?:string})=>post<import('../lib/ad-scene').AdScene>('hero/scene',body),
  adCampaign:(body:{promptSha256:string;requestId:string;projectId:string;planId:string;preparedId:string;image:string;current:import('../lib/creative-engine').CreativeInput})=>post<import('../lib/ad-scene').AdScene>('hero/campaign',body),
  cancelBackground:(requestId:string,projectId:string)=>post<{cancellationRequested:boolean}>('hero/background/cancel',{requestId,projectId}),
  qwenHero:(image:string,settings:import('../lib/hero-ad').HeroSettings,original:string,projectId?:string)=>post<HeroResult>('hero/qwen',{image,settings,original,...(projectId?{projectId}:{})}),

  finishHero:(image:string,settings:import('../lib/hero-ad').HeroSettings)=>post<HeroResult>('hero/finish',{image,settings}),
  reimagineHero:(image:string,settings:import('../lib/hero-ad').HeroSettings)=>post<HeroResult>('hero/reimagine',{image,settings}),
  heroAd:(body:{hero:string;logo?:string;reviewed:boolean;copy:{headline:string;productName:string;website:string}})=>post<{url:string;width:number;height:number;sha256:string}>('hero/export',body),
  staticAd:(body:{design:import('../lib/static-ad').StaticDesign;photo:string;logo?:string;support?:string})=>post<{url:string;width:number;height:number;sha256:string;sources:Record<string,string>;warnings:string[]}>('static-ad',body),
  audio:(prompt:string,duration:number,seed=1,video?:string)=>post<{audio:string;video?:string;duration:number;seconds:number}>('audio',{prompt,duration,seed,video}),
  geometry:(body:{image:string;model?:string;seed:number;steps:number;resolution:number})=>post<{url:string;seconds:number;model:string}>('geometry',body),
  training:(body:import('./training').TrainingInput)=>post<import('./training').TrainingRun>('training',body),
  health,
  async models(): Promise<LocalModels> {
    const r = await fetch('/api/models', { cache: 'no-store' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  },
  get online() { return online; },
  get reason() { return reason; },
  upload: (image: string) => post<{ url: string; width: number; height: number }>("upload", { image }),
  exportVideo: (video: string, overlay?: string) => post<{ url: string; seconds: number }>("export", { video, overlay }),
  productVideo: (options: ProductVideoOptions) => post<ProductVideoResult>('product-video', options),
  editVideo:(options:{video:string;keepAudio?:boolean;start:number;end:number;speed:number;reverse:boolean;width:number;height:number})=>post<{url:string;seconds:number;width:number;height:number}>('edit-video',options),
  keyframe: (prompt: string, seed = 1, size: { width?: number; height?: number;textDevice?:'default'|'cpu' } = {}, model?: string) => post<KeyframeResult>("keyframe", { prompt, seed, ...size, model }),
  // Preserve Director's model argument and Ad Studio's size argument; options can combine both.
  shot: (keys: ShotKey[], prompt: string, duration: number, seed = 1, options: string | { width?: number; height?: number; model?: string;textDevice?:'default'|'cpu';frames?:number;fps?:number;workflow?:'ad-film' } = {}) => post<ShotResult>("shot", { keys, prompt, duration, seed, ...(typeof options === 'string' ? { model: options } : options) }),
};
