// Hybrid campaign: BiRefNet isolate → rich Klein environment → contact composite →
// optional Klein ReferenceLatent harmonize. Harmonize may alter product pixels; pre-harmonize retained.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {Resvg} from '@resvg/resvg-js';
import type {Comfy} from '@comfyorg/sdk';
import type {CreativePlan} from '../lib/creative-engine.ts';
import {adCampaignPrompt,sceneDirection,type AdScene} from '../lib/ad-scene.ts';
import {emptySetSpec,preferDeterministicEmpty,campaignExecutionStrategy} from '../lib/campaign-presentation.ts';
import {heroSource,heroSha,HeroError} from './hero-ad.ts';
import {verifyWeightFiles} from './qwen-hero.ts';
import {kleinAvailability,kleinReadiness,kleinResources,runKleinSDK,renderKleinBackground,releaseKleinCache} from './klein-background.ts';
import {verifyScenePNG} from './klein-scene.ts';
const workflows=join(dirname(fileURLToPath(import.meta.url)),'../workflows');
export async function cutoutContract(){return JSON.parse(await readFile(join(workflows,'product_cutout_contract.json'),'utf8'));}
export async function cutoutWorkflow(){const g=JSON.parse(await readFile(join(workflows,'product_cutout.json'),'utf8')),pin=await cutoutContract();if(heroSha(JSON.stringify(g))!==pin.graphSha256)throw new HeroError(503,'Pinned product extraction workflow changed.');return g;}
export async function campaignAvailability(outputs:string,modelsDir:string|undefined,nodes:any,stats:any,queue:any,busy=false){
 const k=await kleinAvailability(outputs,modelsDir,nodes,stats,queue,busy),pin=await cutoutContract(),g=await cutoutWorkflow();
 const extraction=await kleinReadiness(outputs,modelsDir,nodes,stats,g,pin.files,'hero-cutouts/verified-runtime.json',kleinResources(stats,queue,busy));
 const canRun=(k.available||k.firstRunAvailable)&&(extraction.available||extraction.firstRunAvailable),tested=k.tested&&extraction.tested;
 const extractionBytes=pin.files.reduce((sum:number,f:any)=>sum+f.bytes,0);
 const blocked=!(k.available||k.firstRunAvailable)?k:extraction;
 return {...k,mode:'source-integrated',label:'Klein hybrid campaign - isolate + rich set + harmonize',license:'Apache-2.0 + MIT',diskBytes:k.diskBytes+extractionBytes,newDownloadBytes:k.newDownloadBytes+extractionBytes,
  extraction:{...extraction,model:'BiRefNet',license:'MIT',bytes:extractionBytes},installed:k.installed&&extraction.installed,weightsVerified:k.weightsVerified&&extraction.weightsVerified,
  tested,available:canRun&&tested,firstRunAvailable:canRun&&!tested,readiness:!canRun?'not-ready':tested?'verified':'unverified',
  status:!canRun?blocked.status:tested?'available':'unverified',
  reason:!canRun?blocked.reason:!tested?'Installed and integrity checked; explicitly generate the hybrid campaign to verify its first local extraction/background renders.':'Local hybrid campaign: rich AI set, isolated original product, then Klein reference harmonize when VRAM allows. Compare with the original; packaging may shift. Product-safe remains available.'};
}

type Box={x:number;y:number;width:number;height:number};
function hull(points:number[][]){points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cross=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const half=(p:number[][])=>{const out:number[][]=[];for(const q of p){while(out.length>1&&cross(out.at(-2)!,out.at(-1)!,q)<=0)out.pop();out.push(q);}return out;};return [...half(points).slice(0,-1),...half([...points].reverse()).slice(0,-1)];}
export function productMatte(source:{data:string;width:number;height:number},mask:Buffer,container:string){
 const uri='data:image/png;base64,'+mask.toString('base64'),w=source.width,h=source.height,decoded=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><image href="${uri}" width="${w}" height="${h}"/></svg>`).render().pixels;
 let left=w,top=h,right=0,bottom=0,area=0;const points:number[][]=[];
 for(let y=0;y<h;y++){let lo=w,hi=-1;for(let x=0;x<w;x++)if(decoded[(y*w+x)*4]>64){lo=Math.min(lo,x);hi=Math.max(hi,x);area++;}if(hi>=0){points.push([lo,y],[hi,y]);left=Math.min(left,lo);right=Math.max(right,hi);top=Math.min(top,y);bottom=y;}}
 if(area<w*h*.03||area>w*h*.92||right-left<16||bottom-top<16)throw new HeroError(422,'The subject mask is empty or ambiguous. No framed fallback was produced. Original preserved.');
 // Convex container assembly: retain foil/dish seams rather than cutting model
 // holes through them. Never apply this to bottles/necks or unrelated objects.
 const convex=/\b(tray|baking dish|pan|plate)\b/i.test(container),shape=convex?`<polygon points="${hull(points).map(p=>p.join(',')).join(' ')}" fill="white"/>`:`<image href="${uri}" width="${w}" height="${h}"/>`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><mask id="subject" mask-type="luminance">${shape}</mask></defs><image href="${source.data}" width="${w}" height="${h}" mask="url(#subject)"/></svg>`,r=new Resvg(svg).render();
 return {bytes:Buffer.from(r.asPng()),box:{x:left,y:top,width:right-left+1,height:bottom-top+1},method:convex?'BiRefNet + convex container seam repair':'BiRefNet soft matte',coverage:area/(w*h)};
}
/** Deterministic empty supporting plate driven by brand palette + selected argument. Klein invents duplicate products; high-fidelity locks cannot spend that risk. */
export function deterministicEmptySet(plan:CreativePlan,w=768,h=960){
 const spec=emptySetSpec(plan);
 const flat=spec.plane==='flat-lay';
 const strokes=Array.from({length:spec.strokeCount},(_,i)=>{
  const y=Math.round(h*(.14+i*0.09)),amp=3+((i*11)%6),x0=((i*47)%50)-16;
  return `<path d="M${x0} ${y} C ${w*.25} ${y-amp} ${w*.55} ${y+amp} ${w+20} ${y+((i%2)?2:-2)}" fill="none"/>`;
 }).join('');
 const graphicBand=spec.material==='graphic'&&!flat?`<rect y="${Math.round(h*.62)}" width="${w}" height="${Math.round(h*.38)}" fill="${spec.accent}" opacity=".18"/>`:'';
 const screenGrid=spec.material==='screen'?`<g opacity=".08" stroke="${spec.grain}" stroke-width="1">${Array.from({length:6},(_,i)=>`<line x1="${Math.round(w*(.12+i*.14))}" y1="0" x2="${Math.round(w*(.12+i*.14))}" y2="${h}"/>`).join('')}</g>`:'';
 // Flat-lay: one overhead plane (no wall horizon / window wedge that reads as a room).
 const tableGrad=flat
  ?`<linearGradient id="table" x2="0.2" y2="1"><stop offset="0" stop-color="${spec.top}"/><stop offset=".55" stop-color="${spec.mid}"/><stop offset="1" stop-color="${spec.deep}"/></linearGradient>`
  :`<linearGradient id="table" x2="${spec.material==='graphic'?1:0.08}" y2="1"><stop offset="0" stop-color="${spec.top}"/><stop offset=".38" stop-color="${spec.mid}"/><stop offset="1" stop-color="${spec.deep}"/></linearGradient>`;
 const window=flat?'':`<linearGradient id="window" x2="1" y2="0.15"><stop offset="0" stop-color="#fff8ef" stop-opacity="${spec.lightOpacity}"/><stop offset=".4" stop-color="#fff8ef" stop-opacity="0"/></linearGradient>`;
 const falloff=flat
  ?`<radialGradient id="falloff" cx="50%" cy="48%" r="72%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".85" stop-color="#000" stop-opacity=".05"/><stop offset="1" stop-color="#050302" stop-opacity=".22"/></radialGradient>`
  :`<radialGradient id="falloff" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity=".07"/><stop offset="1" stop-color="#050302" stop-opacity=".46"/></radialGradient>`;
 const landing=flat
  ?`<radialGradient id="landing" cx="50%" cy="50%" r="38%"><stop offset="0" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`
  :`<radialGradient id="landing" cx="50%" cy="56%" r="34%"><stop offset="0" stop-color="#000" stop-opacity=".11"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
   ${tableGrad}${window}${falloff}${landing}
   <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${spec.grainFreq}" numOctaves="3" stitchTiles="stitch" result="n"/><feColorMatrix type="matrix" values="0 0 0 0 .16  0 0 0 0 .1  0 0 0 0 .07  0 0 0 ${spec.grainOpacity} 0" in="n"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#table)"/>
  ${graphicBand}${screenGrid}
  ${spec.strokeCount?`<g opacity=".12" stroke="${spec.grain}" stroke-width="1.25">${strokes}</g>`:''}
  <rect width="${w}" height="${h}" filter="url(#grain)"/>
  ${flat?'':`<rect width="${w}" height="${h}" fill="url(#window)"/>`}
  <ellipse cx="${w/2}" cy="${Math.round(h*(flat?.5:.55))}" rx="${Math.round(w*.3)}" ry="${Math.round(h*(flat?.22:.18))}" fill="url(#landing)"/>
  <rect width="${w}" height="${h}" fill="url(#falloff)"/>
 </svg>`;
 return {bytes:Buffer.from(new Resvg(svg).render().asPng()),prompt:spec.prompt,model:'deterministic-empty-set' as const,seed:plan.input.seed??42,material:spec.material,plane:spec.plane};
}
/** Cover-fit the authorized original into the campaign plate — keeps source perspective and lighting. */
export function fitEditorialOriginal(source:{data:string;width:number;height:number},w=768,h=960){
 const scale=Math.max(w/source.width,h/source.height),sw=source.width*scale,sh=source.height*scale,x=(w-sw)/2,y=(h-sh)/2;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><image href="${source.data}" x="${x}" y="${y}" width="${sw}" height="${sh}"/></svg>`;
 return {bytes:Buffer.from(new Resvg(svg).render().asPng()),productLocked:true as const,presentation:'editorial-original' as const,placement:{x:0,y:0,width:w,height:h,rotation:0}};
}
export function integrateProduct(background:Buffer,cutout:Buffer,box:Box,archetype='material-study',opts:{plane?:'flat-lay'|'perspective'}={}){
 // PS-Composite-style lock: environment + silhouette shadows may be invented;
 // original product RGB is restored last with zero rotation / color rewrite.
 const flat=opts.plane==='flat-lay';
 const w=768,h=960,maxW=archetype==='beauty-sensory'?600:flat?680:620,maxH=archetype==='food-editorial'?(flat?780:720):640;
 const scale=Math.min(maxW/box.width,maxH/box.height),pw=box.width*scale,ph=box.height*scale;
 // Flat-lay: center the overhead product on the plane (not "standing" mid-frame against a wall).
 const x=(w-pw)/2,y=flat?Math.round((h-ph)/2-h*0.02):archetype==='food-editorial'?Math.round(h*.18):280+(maxH-ph)/2;
 const rotation=0;
 const bg='data:image/png;base64,'+background.toString('base64'),fg='data:image/png;base64,'+cutout.toString('base64');
 const cw=cutout.readUInt32BE(16),ch=cutout.readUInt32BE(20);
 // Window light treated as upper-left → contact/ambient fall lower-right.
 // No bright edge-light fringe (that reads as a sticker halo).
 const lightDx=archetype==='beauty-sensory'?9:12,lightDy=archetype==='food-editorial'?14:11;
 const placed=(ox=0,oy=0)=>`<svg x="${x+ox}" y="${y+oy}" width="${pw}" height="${ph}" viewBox="${box.x} ${box.y} ${box.width} ${box.height}"><image href="${fg}" width="${cw}" height="${ch}"/></svg>`;
 // Silhouette shadow (not a generic ellipse): flatten cutout to dark alpha, blur for AO + contact.
 const silhouette=(id:string,opacity:number,ox=lightDx,oy=lightDy)=>`<g filter="url(#${id})" opacity="${opacity}">${placed(ox,oy)}</g>`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
   <filter id="ambient" x="-90%" y="-90%" width="280%" height="280%"><feColorMatrix type="matrix" values="0 0 0 0 0.018  0 0 0 0 0.012  0 0 0 0 0.008  0 0 0 0.5 0"/><feGaussianBlur stdDeviation="20"/></filter>
   <filter id="contact" x="-55%" y="-55%" width="210%" height="210%"><feColorMatrix type="matrix" values="0 0 0 0 0.012  0 0 0 0 0.008  0 0 0 0 0.006  0 0 0 0.78 0"/><feGaussianBlur stdDeviation="4.2"/></filter>
   <filter id="tight" x="-35%" y="-35%" width="170%" height="170%"><feColorMatrix type="matrix" values="0 0 0 0 0.008  0 0 0 0 0.006  0 0 0 0 0.004  0 0 0 0.9 0"/><feGaussianBlur stdDeviation="1.6"/></filter>
   <filter id="edgeAO" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="1.0"/><feColorMatrix type="matrix" values="0 0 0 0 0.02  0 0 0 0 0.014  0 0 0 0 0.01  0 0 0 0.26 0"/></filter>
  </defs>
  <image href="${bg}" width="${w}" height="${h}"/>
  ${silhouette('ambient',0.62)}
  ${silhouette('contact',0.78)}
  <g transform="translate(${Math.round(lightDx*0.4)} ${Math.round(lightDy*0.5)})" filter="url(#tight)" opacity=".5">${placed()}</g>
  <g filter="url(#edgeAO)">${placed()}</g>
  ${placed()}
 </svg>`;
 return {bytes:Buffer.from(new Resvg(svg).render().asPng()),placement:{x,y,width:pw,height:ph,rotation},sourceBox:box,productLocked:true as const,shadow:'silhouette-ao-contact' as const};
}
export async function renderProductCampaign(outputs:string,modelsDir:string,stats:any,queue:any,c:Comfy,plan:CreativePlan,image:string,base:string,signal:AbortSignal,progress:(m:string,p?:number)=>void):Promise<AdScene>{
 const source=await heroSource(outputs,image),started=Date.now();
 // Product-safe / digital fallback only — never the primary path for physical product campaigns.
 if(campaignExecutionStrategy(plan)==='product-safe'){
  progress('Product-safe layout — authorized photograph (no generative set)');
  const fitted=fitEditorialOriginal(source),filename=randomBytes(8).toString('hex')+'.png',provId=randomBytes(8).toString('hex');
  await writeFile(join(outputs,filename),fitted.bytes,{flag:'wx'});
  const warning='Product-safe: authorized photograph with brand layout. Not AI photography. Typography is composed separately.';
  const response:AdScene={url:'/outputs/'+filename,sha256:heroSha(fitted.bytes),width:768,height:960,seconds:(Date.now()-started)/1000,model:'editorial-original',jobId:'product-safe-layout',provenanceId:provId,prompt:'product-safe:'+source.sha256,seed:plan.input.seed??42,workflowSha256:heroSha('product-safe'),sourceSha256:source.sha256,archetype:sceneDirection(plan).archetype,warning,fidelityMode:'product-fidelity',placement:fitted.placement};
  await mkdir(join(outputs,'hero-klein',provId),{recursive:true});
  await writeFile(join(outputs,'hero-klein',provId,'integration.json'),JSON.stringify({...response,presentation:'editorial-original',execution:'product-safe',originalSha256:plan.input.source.originalSha256,source:plan.input.source,ownerApproved:false},null,2));
  return response;
 }
 const pins=await cutoutContract(),g=await cutoutWorkflow();await verifyWeightFiles(modelsDir,pins.files);const id=randomBytes(8).toString('hex'),dir=join(outputs,'hero-cutouts',id);await mkdir(dir,{recursive:true});
 let maskJobId='',backgroundJobId='';try{progress('Isolating the original product locally');const expected=structuredClone(g),result=await runKleinSDK(c,g,signal,()=>{},source.path);maskJobId=result.jobId;
  await writeFile(join(dir,'received-mask.png'),result.bytes);await verifyScenePNG(result.bytes,expected,source.sha256,base,signal,source);
  const matte=productMatte(source,result.bytes,plan.input.facts.container||''),cutoutName=randomBytes(8).toString('hex')+'.png';await writeFile(join(outputs,cutoutName),matte.bytes,{flag:'wx'});await writeFile(join(dir,'cutout.png'),matte.bytes);
  await writeFile(join(dir,'provenance.json'),JSON.stringify({sourceSha256:source.sha256,maskJobId,method:matte.method,box:matte.box,coverage:matte.coverage,weights:pins.files,workflow:expected},null,2));
  await writeFile(join(outputs,'hero-cutouts','verified-runtime.json'),JSON.stringify({workflowSha256:heroSha(JSON.stringify(expected)),weights:heroSha(JSON.stringify(pins.files)),comfyVersion:stats.system.comfyui_version,gpu:stats.devices[0].name,jobId:maskJobId}));
  await releaseKleinCache(maskJobId,base);
  // Prefer Klein AI empty supporting set (perspective-aware). Deterministic SVG only if AI empty-set fails or strict keep-background.
  let plate!:Buffer,bgMeta!:{url:string;sha256:string;jobId:string;provenanceId:string;prompt:string;seed:number;workflowSha256:string;model:string;seconds?:number;width?:number;height?:number};
  let deterministic=preferDeterministicEmpty(plan,true);
  if(!deterministic){
   try{
    progress('Generating the art-directed photographic environment');
    const native=async(path:string)=>(await fetch(new URL(path,base),{signal:AbortSignal.any([signal,AbortSignal.timeout(5000)])})).json(),freshStats=await native('/system_stats'),freshQueue=await native('/queue');
    const bg=await renderKleinBackground(outputs,modelsDir,freshStats,freshQueue,c,adCampaignPrompt(plan),plan.input.seed??42,signal,progress);backgroundJobId=bg.jobId;plate=await readFile(join(outputs,bg.url.slice(9)));bgMeta=bg;
   }catch(error){
    progress('AI environment unavailable — falling back to a brand-directed empty plate');
    deterministic=true;
    await writeFile(join(dir,'empty-set-fallback.json'),JSON.stringify({error:String((error as Error).message),fallback:'deterministic-empty'},null,2)).catch(()=>{});
   }
  }
  if(deterministic){
   progress('Building a brand-directed empty supporting set (fallback)');
   const empty=deterministicEmptySet(plan);plate=empty.bytes;const plateName=randomBytes(8).toString('hex')+'.png';await writeFile(join(outputs,plateName),plate,{flag:'wx'});
   bgMeta={url:'/outputs/'+plateName,sha256:heroSha(plate),jobId:'deterministic-empty',provenanceId:randomBytes(8).toString('hex'),prompt:empty.prompt,seed:empty.seed,workflowSha256:heroSha(empty.prompt),model:empty.model,seconds:0,width:768,height:960};
  }
  const plane=emptySetSpec(plan).plane;
  const integrated=integrateProduct(plate,matte.bytes,matte.box,sceneDirection(plan).archetype,{plane}),preName=randomBytes(8).toString('hex')+'.png';await writeFile(join(outputs,preName),integrated.bytes,{flag:'wx'});
  const finalBytes=integrated.bytes,finalModel:AdScene['model']='klein-integrated',finalJob=bgMeta.jobId,finalProv=bgMeta.provenanceId,finalPrompt=bgMeta.prompt,harmonize:AdScene['preHarmonize']={url:'/outputs/'+preName,sha256:heroSha(integrated.bytes)},warning=deterministic?'Original product isolated with BiRefNet and composited onto a brand-directed empty supporting set (deterministic plate). Not AI-generated photography of the product. Inspect matte edges before publishing.':'Original product pixels isolated with BiRefNet, composited into a generated empty set with contact shadows. No generative product rewrite. Inspect matte edges before publishing.';
  await writeFile(join(dir,'harmonize-skipped.json'),JSON.stringify({reason:deterministic?'high-fidelity-deterministic-empty':'product-locked-restore',fallback:'klein-integrated'},null,2)).catch(()=>{});
  const filename=randomBytes(8).toString('hex')+'.png';await writeFile(join(outputs,filename),finalBytes,{flag:'wx'});
  const background=bgMeta as any;
  const response:AdScene={url:'/outputs/'+filename,sha256:heroSha(finalBytes),width:768,height:960,seconds:(Date.now()-started)/1000,model:finalModel,jobId:finalJob,provenanceId:finalProv,prompt:finalPrompt,seed:plan.input.seed??42,workflowSha256:bgMeta.workflowSha256,sourceSha256:source.sha256,archetype:sceneDirection(plan).archetype,warning,fidelityMode:'product-fidelity',preHarmonize:harmonize,background,cutout:{url:'/outputs/'+cutoutName,sha256:heroSha(matte.bytes),jobId:maskJobId,method:matte.method,box:matte.box,width:source.width,height:source.height},placement:integrated.placement};
  await mkdir(join(outputs,'hero-klein',finalProv),{recursive:true});
  await writeFile(join(outputs,'hero-klein',finalProv,'integration.json'),JSON.stringify({...response,originalSha256:plan.input.source.originalSha256,source:plan.input.source,ownerApproved:false},null,2));return response;
 }catch(error){await writeFile(join(dir,'failure.json'),JSON.stringify({error:String((error as Error).message),maskJobId,backgroundJobId,automaticRetry:false}));throw Object.assign(error as Error,{jobId:(error as any).jobId||backgroundJobId||maskJobId});}
}
