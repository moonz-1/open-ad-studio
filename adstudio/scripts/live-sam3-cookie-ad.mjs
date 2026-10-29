// ONE authentic product-only ad proof: SAM3 cookie RGBA + Klein EMPTY set + composite + lettering.
// No cookie/tray reference in Klein conditioning. No multi-cookie Dynamics. No merge.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {access,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {Comfy} from '@comfyorg/sdk';
import {assembleCreativePlan,creativeContext,conceptsFromArguments,refinePlanComposition} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {adCampaignPrompt,campaignDesign,sceneDirection} from '../../shared/lib/ad-scene.ts';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {productFidelityReport} from '../../shared/lib/product-fidelity.ts';
import {integrateProduct} from '../../shared/runtime/product-campaign.ts';
import {renderKleinBackground,releaseKleinCache,kleinResources} from '../../shared/runtime/klein-background.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
import {startComfyProxy} from '../../shared/runtime/proxy.ts';

const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=resolve('outputs','creative-acceptance',stamp,'sam3-cookie-ad');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const runtime=JSON.parse(await readFile(resolve('outputs/runtime-config.json'),'utf8').catch(()=>'{}'));
const modelsDir=process.env.ADSTUDIO_KLEIN_MODELS_DIR||process.env.COMFYUI_MODELS_DIR||runtime.modelsDir;
if(!modelsDir)throw Error('Configure modelsDir.');
const comfyUrl=process.env.COMFYUI_URL||'http://127.0.0.1:8188';
const proxyUrl=process.env.COMFY_BASE_URL||'http://127.0.0.1:8189';
process.env.COMFYUI_URL=comfyUrl;process.env.COMFY_BASE_URL=proxyUrl;

const cutoutPath=resolve('outputs/creative-acceptance/2026-10-28T21-56-37/sam3-cookie-proof/cookie-cutout-rgba.png');
const sourceFull=resolve('outputs/creative-acceptance/2026-10-28-readiness/previous-cookie-source.png');
await access(cutoutPath);await access(sourceFull);
const cutoutBytes=await readFile(cutoutPath),sourceBytes=await readFile(sourceFull);
assert.equal(sha(cutoutBytes),'1ee0debb7bc50a5427273e9f577a737a6c56d05b90bdcce61ac0cf06ab2734f7');
await copyFile(cutoutPath,join(out,'cookie-cutout-rgba.png'));
await copyFile(sourceFull,join(out,'source-full.png'));

/** Alpha AABB of an RGBA PNG (full-frame SAM3 cutout). */
function alphaBox(png){
 const w=png.readUInt32BE(16),h=png.readUInt32BE(20);
 const pixels=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><image href="data:image/png;base64,${png.toString('base64')}" width="${w}" height="${h}"/></svg>`).render().pixels;
 let left=w,top=h,right=0,bottom=0,area=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(pixels[(y*w+x)*4+3]>16){area++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 }
 assert.ok(area>1000,'Cutout alpha empty.');
 return {x:left,y:top,width:right-left+1,height:bottom-top+1,widthFull:w,heightFull:h,area};
}
const box=alphaBox(cutoutBytes);

const native=async p=>(await fetch(comfyUrl+p,{signal:AbortSignal.timeout(8000)})).json();
const free=async()=>{await fetch(comfyUrl+'/free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unload_models:true,free_memory:true}),signal:AbortSignal.timeout(5000)}).catch(()=>{});};
await free();await new Promise(r=>setTimeout(r,1500));
const queue=await native('/queue');assert.equal((queue.queue_running?.length||0)+(queue.queue_pending?.length||0),0);
const stats=await native('/system_stats');
const resource=kleinResources(stats,queue);
assert.ok(resource.available,resource.reason);
const reclaim=(resource.vramFreeBytes||0)/1024**3;

const brand=newBrand('No Crumbs Bakery');
brand.dna.description='No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.';
brand.dna.tone='Warm, inviting and indulgent.';
brand.dna.visualStyle='Deep cocoa, warm cream, directional window light, tactile walnut and appetizing editorial photography.';
brand.colors=['#3b2117','#f3dfbc','#9a5528'];
brand.overrides=['name','description','tone','visualStyle'];
brand.assets=[{id:'photo',assetId:'sam3-cookie',name:'cookie-cutout-rgba.png',role:'product',productId:'cookie'}];
brand.products=[{id:'cookie',name:'Chocolate chip cookie',description:'One thick irregular chocolate chip cookie.',sellingPoints:'Authentic bakery cookie',imageIds:['photo']}];

const input={
 version:1,projectId:'sam3-cookie-ad',brand,
 source:{id:'sam3-cookie',name:'cookie-cutout-rgba.png',kind:'original',sha256:heroSha(cutoutBytes),originalSha256:heroSha(sourceBytes),width:box.widthFull,height:box.heightFull},
 facts:{
  description:'One thick irregular chocolate chip cookie with cracked golden crust and uneven dark chocolate chunks — visible top surface from an overhead bakery photograph; underside and occluded rim are not in the cutout.',
  count:1,
  arrangement:'Single cookie, near-overhead view matching the authorized source camera.',
  texture:'Golden cracked crust, mounded bakery height, uneven chocolate chunks.',
  container:'None — foil packaging excluded by SAM3 product-only extraction.',
  confirmed:true
 },
 productType:'cookies',productId:'cookie',
 request:'Overhead bakery campaign for one authentic cookie on a calm photographic surface. Leave Nothing Behind. Generous negative space for lettering. No tray, no duplicate cookies.',
 intent:'campaign',format:'feed',seed:61,
 // High fidelity → product-locked generative path (empty Klein set + original pixels).
 constraints:{exactCount:true,arrangement:'exactly',angle:'none',crop:'none',background:'replace',fidelity:'high',creativity:'low'}
};

const quote='No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.';
const flat={arguments:[
 {title:'Leave Nothing Behind',idea:'Present one authentic bakery cookie as the whole invitation — visible cracks and chunks, no packaging theatre.',objective:'consideration',audienceHypothesis:'People may respond to a single honest bakery object more than a staged tray.',tension:'Trays and props can hide what the cookie actually looks like.',businessFit:quote,feeling:'Quiet appetite from reading real bakery texture.',memory:'One cracked chocolate chip cookie on a calm walnut plane with open lettering space.',focus:'One thick chocolate chip cookie, overhead, foil excluded.',opening:'Establish a quiet overhead surface before the cookie lands as the only subject.',payoff:'Hold the authentic cookie with calm negative space for Leave Nothing Behind.',proofId:'brand-description',proofQuote:quote},
 {title:'Texture invitation',idea:'Lead with cracked crust and chunky chocolate on a single cookie without inventing fillings.',objective:'consideration',audienceHypothesis:'Buyers may trust irregular bakery texture more than a polished generic cookie.',tension:'Smooth studio cookies erase the cracked surfaces that identify this product.',businessFit:quote,feeling:'Quiet curiosity about the tactile surface.',memory:'Cracked crust and uneven chunks remain the recognition cue.',focus:'Golden cracked crust and large dark chocolate chunks on one thick cookie.',opening:'Graze light across crust cracks on a flat-lay plane.',payoff:'Resolve on one cookie at recognition scale with open copy space.',proofId:'brand-description',proofQuote:quote},
 {title:'Table calm',idea:'Stage a ready single cookie on a photographic surface without takeaway foil.',objective:'consideration',audienceHypothesis:'People setting a table may respond to food that already looks ready to place.',tension:'Foil signals transport; a clear surface signals arrival.',businessFit:quote,feeling:'Ease of offering something ready and warm.',memory:'One thick cookie on walnut with soft window light, no foil tray.',focus:'One thick chocolate chip cookie without packaging.',opening:'Introduce warm overhead light and walnut before the cookie lands as hero.',payoff:'Leave calm negative space for typography beside the cookie.',proofId:'brand-description',proofQuote:quote}
]};
const ctx=creativeContext(input);
let plan=assembleCreativePlan(input,conceptsFromArguments(flat,input,ctx),{planningVersion:2,mode:'local-ai',model:'authored-validated-argument',reason:'SAM3 authentic single-cookie ad proof.',contribution:{format:'advertising-arguments-v1',modelFields:['title','idea','strategy'],appFields:['composition','camera','environment','lighting','copy','dynamics']}},randomBytes(8).toString('hex').slice(0,16));
// Dynamics: one product, overhead flat-lay, negative space — not a multi-cookie rearrange.
plan=refinePlanComposition(plan,'Leave more negative space for copy. Make it feel more like this brand.',randomBytes(8).toString('hex').slice(0,16));
plan={...plan,dynamics:{...plan.dynamics,mode:'static',product:{...plan.dynamics.product,count:1,arrangement:'Single authentic cookie centered on a calm overhead plane; no duplicates; no packaging.',packagingPolicy:'omit-if-not-product'},frame:{...plan.dynamics.frame,energy:'restrained',heroPlacement:'Lower-centre to mid-frame hero with balanced margins and open upper copy field.',negativeSpace:'Expand calm negative space for typography; reduce competing mid-ground detail.'},camera:{...plan.dynamics.camera,viewpoint:'True overhead / top-down flat-lay matching the source cookie cutout. Do not invent eye-level.',distance:'Product-dominant recognition scale with breathing room.',framing:'Leave a generous open field above and beside the hero for lettering.',lensFeel:'Shallow but readable overhead food editorial.'}}};
const emptyPrompt=adCampaignPrompt(plan);
assert.match(emptyPrompt,/EMPTY/i);
assert.match(emptyPrompt,/no cookies/i);
assert.match(emptyPrompt,/overhead|top-down|flat-lay/i);
await writeFile(join(out,'plan.json'),JSON.stringify({selectedId:plan.selectedId,title:plan.concepts.find(c=>c.id===plan.selectedId).title,dynamics:plan.dynamics,emptyPrompt,archetype:sceneDirection(plan).archetype,cutoutBox:box,cutoutSha256:sha(cutoutBytes)},null,2));

await startComfyProxy(resolve('.'),{COMFYUI_URL:comfyUrl,COMFY_BASE_URL:proxyUrl});
const c=new Comfy();
const outputsRoot=resolve('outputs');
console.log('ONE Klein EMPTY set (no product reference)… reclaim',reclaim.toFixed(2));
const started=Date.now();
let bg;
try{
 bg=await renderKleinBackground(outputsRoot,modelsDir,await native('/system_stats'),await native('/queue'),c,emptyPrompt,61,AbortSignal.timeout(900000),m=>console.log(' ',m));
}catch(error){
 const jobId=error.jobId;
 console.error('SDK wait failed:',error.message,'jobId',jobId);
 if(!jobId)throw error;
 for(let i=0;i<90;i++){const q=await native('/queue');if(!(q.queue_running?.length||q.queue_pending?.length))break;await new Promise(r=>setTimeout(r,2000));}
 const hist=await native('/history/'+jobId);const img=hist?.[jobId]?.outputs?.['13']?.images?.[0];
 if(!img?.filename)throw error;
 const view=new URL('/view',comfyUrl);view.searchParams.set('filename',img.filename);if(img.subfolder)view.searchParams.set('subfolder',img.subfolder);view.searchParams.set('type',img.type||'output');
 const bytes=Buffer.from(await (await fetch(view,{signal:AbortSignal.timeout(30000)})).arrayBuffer());
 const id=randomBytes(8).toString('hex');
 await writeFile(join(outputsRoot,id+'.png'),bytes);
 bg={url:'/outputs/'+id+'.png',sha256:heroSha(bytes),width:512,height:640,seconds:(Date.now()-started)/1000,model:'klein-background',jobId,provenanceId:id,prompt:emptyPrompt,seed:61,recovered:true};
}
assert.equal(bg.model,'klein-background');
const emptyBytes=await readFile(join(outputsRoot,bg.url.slice(9)));
await writeFile(join(out,'empty-scene.png'),emptyBytes);

// Upscale empty plate to campaign plate size expected by integrateProduct (768×960).
const emptyPlate=Buffer.from(new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="768" height="960"><image href="data:image/png;base64,${emptyBytes.toString('base64')}" width="768" height="960"/></svg>`).render().asPng());
const integrated=integrateProduct(emptyPlate,cutoutBytes,box,'food-editorial',{plane:'flat-lay'});
assert.equal(integrated.productLocked,true);
assert.equal(integrated.placement.rotation,0);
await writeFile(join(out,'integrated.png'),integrated.bytes);

const selected=plan.concepts.find(c=>c.id===plan.selectedId);
const design=campaignDesign({...plan.composition,headline:'Leave Nothing Behind',body:selected.strategy?.memory||'One authentic bakery cookie — cracks, chunks, and all.',cta:'Taste the real thing',brandName:'No Crumbs Bakery',website:'',size:'feed',background:'#14110f',textColor:'#fffaf0'},sceneDirection(plan).archetype,'scene','composite');
const laid=campaignSVG(design,{photo:'data:image/png;base64,'+integrated.bytes.toString('base64')},1080,1350);
const adBytes=Buffer.from(new Resvg(laid.svg).render().asPng());
await writeFile(join(out,'advertisement.png'),adBytes);

const fidelity=productFidelityReport({model:'klein-integrated',fidelityMode:'product-fidelity',cutout:{sha256:sha(cutoutBytes)},sourceSha256:sha(cutoutBytes),warning:'SAM3 visible-surface cutout composited into Klein empty set. Occluded geometry not invented.'});
const report={
 stamp,elapsedMs:Date.now()-started,reclaimGiB:+reclaim.toFixed(2),
 method:'sam3-cutout + klein-empty + integrateProduct + campaignSVG',
 klein:{model:bg.model,jobId:bg.jobId,provenanceId:bg.provenanceId,sha256:bg.sha256,recovered:!!bg.recovered,seed:61,prompt:emptyPrompt},
 cutout:{path:'cookie-cutout-rgba.png',sha256:sha(cutoutBytes),box,note:'Visible top surface only; occluded rim / underside not present.'},
 placement:integrated.placement,fidelity,
 dynamics:plan.dynamics,
 design:{headline:design.headline,body:design.body,cta:design.cta,brandName:design.brandName},
 outputs:{empty:'empty-scene.png',cutout:'cookie-cutout-rgba.png',integrated:'integrated.png',advertisement:'advertisement.png',comparison:'comparison.html'},
 criticalReview:{
  authenticIdentity:'Cookie RGB from SAM3 cutout restored; foil excluded.',
  belongsInScene:'Owner must judge lighting/perspective match on overhead plate.',
  perspective:'Cutout remains near-overhead; no invented eye-level rotation.',
  matteEdges:'Inspect soft alpha fringe from SAM3 binary mask.',
  contactShadow:'Silhouette AO/contact from integrateProduct.',
  composition:'Single cookie + Leave Nothing Behind; restrained Dynamics.',
  notCommercialPass:true,
  limitations:['Occluded upper rim / underside absent','Only one Klein empty generation','SAM3 optional Meta license weight not in git']
 },
 note:'Owner visual review required. Not a commercial PASS. No merge.'
};
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
await writeFile(join(out,'comparison.html'),`<!doctype html><meta charset="utf-8"><title>SAM3 cookie ad proof</title>
<style>body{font:16px/1.4 Georgia,serif;background:#141210;color:#f3ebe1;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}img{width:100%;max-height:720px;object-fit:contain;background:#222}pre{font:12px/1.35 ui-monospace,Consolas,monospace;white-space:pre-wrap}</style>
<h1>Authentic product-only ad · ${stamp}</h1>
<p>Klein empty job <code>${bg.jobId}</code> · SAM3 cutout · no tray · ${report.elapsedMs} ms</p>
<main>
<figure><img src="source-full.png"/><figcaption>Authorized full source (context)</figcaption></figure>
<figure><img src="cookie-cutout-rgba.png"/><figcaption>SAM3 cookie RGBA</figcaption></figure>
<figure><img src="empty-scene.png"/><figcaption>Klein EMPTY scene (no product ref)</figcaption></figure>
<figure><img src="integrated.png"/><figcaption>Integrated still</figcaption></figure>
<figure><img src="advertisement.png"/><figcaption>Finished advertisement</figcaption></figure>
</main>
<pre>${JSON.stringify(report.criticalReview,null,2)}</pre>`);
await releaseKleinCache(bg.jobId,comfyUrl).catch(()=>{});
console.log('EMPTY',join(out,'empty-scene.png'));
console.log('INTEGRATED',join(out,'integrated.png'));
console.log('AD',join(out,'advertisement.png'));
console.log('JOB',bg.jobId);
process.exit(0);
