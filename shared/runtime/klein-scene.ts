import {campaignExecutionStrategy} from '../lib/campaign-presentation.ts';
import {buildProductIdentityProfile} from '../lib/product-identity-profile.ts';
// Native reference-conditioned scene editing. Reuses existing verified weights,
// SDK/proxy execution, review checks, receipts and exact-job cancellation.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import type {Comfy} from '@comfyorg/sdk';
import {heroSha,HeroError,heroSource} from './hero-ad.ts';
import {inspectQwenPNG,verifyWeightFiles} from './qwen-hero.ts';
import {kleinContract,kleinResources,kleinReadiness,runKleinSDK,validateBackgroundRequest} from './klein-background.ts';
import {adScenePrompt,flux3ScenePrompt,adCampaignPrompt,sceneDirection,type AdScene} from '../lib/ad-scene.ts';
const workflows=join(dirname(fileURLToPath(import.meta.url)),'../workflows');
export const sceneContract=async()=>JSON.parse(await readFile(join(workflows,'klein4b_scene_contract.json'),'utf8'));
export async function sceneWorkflow(){const g=JSON.parse(await readFile(join(workflows,'klein4b_scene.json'),'utf8')),pin=await sceneContract();if(heroSha(JSON.stringify(g))!==pin.graphSha256)throw new HeroError(503,'Pinned reference-scene workflow changed.');return g;}
export function sceneResources(stats:any,queue:any,busy=false){const r=kleinResources(stats,queue,busy);if(!r.available)return r;if((r.vramFreeBytes??0)<6*1024**3||(r.ramFreeBytes??0)<6*1024**3)return {...r,available:false,status:'insufficient-vram',reason:'Reference-scene editing requires 6 GiB free/reclaimable VRAM and 6 GiB free RAM for the bounded 768x960 workflow. Product-safe remains available.'};return {...r,reason:'768x960 reference scene, four steps with native offloading. Lower-headroom performance is not established.'};}
export async function sceneAvailability(outputs:string,modelsDir:string|undefined,nodes:any,stats:any,queue:any,busy=false){
 const pins=await kleinContract(),g=await sceneWorkflow();
 const ready=await kleinReadiness(outputs,modelsDir,nodes,stats,g,pins.files,'hero-klein/verified-scene.json',sceneResources(stats,queue,busy));
 return {...ready,id:'klein',mode:'reference-scene',label:'FLUX.2 Klein - product scene',license:'Apache-2.0',generatesAiPixels:true,preservesOriginalPhotograph:false,editsReference:true,
  reason:ready.available?'Local reference-conditioned scene generation ready. Product details are redrawn; compare before publishing.':ready.reason};
}
export async function validateSceneRequest(outputs:string,body:any){
 const checked=await validateBackgroundRequest(outputs,body);
 if(body.identityImage&&body.identityImage!==body.image)throw new HeroError(400,'Journey identity reference must be the current reviewed source. A separately reviewed identity picker is not connected.');
 const engine=body.engine==='flux3'?'flux3':'klein';
 if(engine==='flux3'&&campaignExecutionStrategy(checked.plan)!=='creative-restage')throw new HeroError(409,'Reviewed geometry locks require a product-locked engine. Choose Creative Restage and review a fresh plan before FLUX 3; no inference was submitted.');
 const requestedPrompt=engine==='flux3'?flux3ScenePrompt(checked.plan):adScenePrompt(checked.plan);
 if(body.promptSha256!==heroSha(requestedPrompt))throw new HeroError(409,'The scene prompt changed. Review the current direction before generating.');
 // Bind measured geometry only after the reviewed client caption and source bytes pass admission.
 const source=engine==='flux3'?await heroSource(outputs,body.image):undefined;
 const identityProfile=source?buildProductIdentityProfile(source.bytes,{kind:'packshot',sha256:source.sha256,categoryHint:checked.plan.input.productType,foodIrregular:['cookies','cinnamon-rolls','bakery'].includes(checked.plan.input.productType)}):undefined;
 const prompt=engine==='flux3'?flux3ScenePrompt(checked.plan,identityProfile):requestedPrompt;
 if(prompt.length>8000)throw new HeroError(422,'The photographic brief exceeds the saved-scene limit. Shorten source notes and review again; no inference was submitted.');
 return {...checked,prompt,requestedPromptSha256:heroSha(requestedPrompt),identityProfile,engine,archetype:sceneDirection(checked.plan).archetype};
}
export async function validateCampaignRequest(outputs:string,body:any){const checked=await validateBackgroundRequest(outputs,body);const prompt=adCampaignPrompt(checked.plan);if(body.promptSha256!==heroSha(prompt))throw new HeroError(409,'The scene prompt changed. Review the current direction before generating.');return {...checked,prompt,archetype:sceneDirection(checked.plan).archetype};}
export async function verifyScenePNG(bytes:Buffer,graph:any,sourceSha256:string,base:string,signal:AbortSignal,dimensions={width:768,height:960}){
 const checked=inspectQwenPNG(bytes,graph,'14'),u=new URL(base),reference=checked.executedGraph['14']?.inputs.image;
 if(u.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.pathname!=='/'||u.username||u.password)throw new HeroError(503,'Local reference verification requires loopback ComfyUI.');
 // Comfy's normal collision-safe upload naming is "reference (1).png".
 // Keep paths relative and bounded; URLSearchParams encodes literal filename
 // characters, and the downloaded input must still match the reviewed SHA256.
 if(typeof reference!=='string'||reference.length>240||reference.startsWith('/')||reference.includes('..')||reference.includes('\\')||!/^[-A-Za-z0-9_./ ()]+$/.test(reference))throw new HeroError(422,'Invalid executed reference identity.');
 const slash=reference.lastIndexOf('/'),q=new URLSearchParams({filename:reference.slice(slash+1),subfolder:slash<0?'':reference.slice(0,slash),type:'input'});
 const r=await fetch(u.origin+'/view?'+q,{signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});if(!r.ok||Number(r.headers.get('content-length'))>8*1024*1024)throw new HeroError(422,'Executed reference cannot be verified.');
 const chunks:Uint8Array[]=[];let size=0;for await(const chunk of r.body!){size+=chunk.length;if(size>8*1024*1024)throw new HeroError(422,'Executed reference exceeds size limit.');chunks.push(chunk);}if(heroSha(Buffer.concat(chunks))!==sourceSha256)throw new HeroError(422,'Executed reference hash differs from the reviewed photograph.');
 if(checked.width!==dimensions.width||checked.height!==dimensions.height)throw new HeroError(422,'Unexpected reference-scene dimensions.');return checked;
}
export async function renderKleinScene(outputs:string,modelsDir:string,stats:any,queue:any,c:Comfy,prompt:string,seed:number,image:string,archetype:AdScene['archetype'],base:string,signal:AbortSignal,onProgress?:(m:string,p?:number)=>void):Promise<AdScene>{
 const r=sceneResources(stats,queue);if(!r.available)throw new HeroError(503,r.reason);
 const pins=await kleinContract(),g=await sceneWorkflow(),basis=heroSha(JSON.stringify(g)),source=await heroSource(outputs,image);await verifyWeightFiles(modelsDir,pins.files);
 const id=randomBytes(8).toString('hex'),dir=join(outputs,'hero-klein',id);await mkdir(dir,{recursive:true});await writeFile(join(dir,'reference.png'),source.bytes,{flag:'wx'});
 g['4'].inputs.text=prompt;g['7'].inputs.noise_seed=seed;g['13'].inputs.filename_prefix='adstudio/klein-scene-'+id;
 // Preserve an immutable graph for comparison: SDK replaces its local asset handle.
 const expected=structuredClone(g),start=Date.now();let jobId='';await writeFile(join(dir,'request.json'),JSON.stringify({prompt,seed,workflow:expected,sourceSha256:source.sha256,weights:pins.files},null,2));
 try{const result=await runKleinSDK(c,g,signal,onProgress,join(dir,'reference.png'));jobId=result.jobId;
  if(result.bytes.length>32*1024*1024)throw new HeroError(422,'Scene output exceeds size limit.');
  await writeFile(join(dir,'received.png'),result.bytes,{flag:'wx'});await writeFile(join(dir,'delivery.json'),JSON.stringify({jobId,status:'received-unverified',sha256:heroSha(result.bytes),seconds:(Date.now()-start)/1000}));
  const checked=await verifyScenePNG(result.bytes,expected,source.sha256,base,signal);
  const response:AdScene={url:'/outputs/'+id+'.png',sha256:heroSha(result.bytes),width:checked.width,height:checked.height,seconds:(Date.now()-start)/1000,model:'klein-scene',jobId:result.jobId,provenanceId:id,prompt,seed,workflowSha256:heroSha(JSON.stringify(checked.executedGraph)),sourceSha256:source.sha256,archetype,fidelityMode:'creative-restage',warning:'Creative Restage · AI re-photographs the product in a new scene. Packaging, labels and geometry may change. Compare with the original; not product-safe.'};
  await writeFile(join(dir,'raw.png'),result.bytes,{flag:'wx'});await writeFile(join(outputs,id+'.png'),result.bytes,{flag:'wx'});await writeFile(join(dir,'provenance.json'),JSON.stringify({...response,weights:pins.files,workflow:checked.executedGraph,ownerApproved:false},null,2));
  await writeFile(join(outputs,'hero-klein','verified-scene.json'),JSON.stringify({jobId:result.jobId,workflowSha256:basis,weights:heroSha(JSON.stringify(pins.files)),comfyVersion:stats.system.comfyui_version,gpu:stats.devices[0].name},null,2));return response;
 }catch(error){jobId=(error as any).jobId||jobId;await writeFile(join(dir,'failure.json'),JSON.stringify({error:String((error as Error).message),jobId,elapsedMs:Date.now()-start,automaticRetry:false}));throw Object.assign(error as Error,{jobId});}
}
