// FINAL alignment proof: Director → Dynamics → Klein Creative Restage (integrated scene).
// SAM3 cookie cutout is identity REFERENCE only — not pasted onto an empty plate.
// ONE Klein scene generation. Product-locked compositing remains a separate path.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {access,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Resvg} from '@resvg/resvg-js';
import {Comfy} from '@comfyorg/sdk';
import {assembleCreativePlan,creativeContext,conceptsFromArguments,refinePlanComposition} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {adScenePrompt,campaignDesign,sceneDirection} from '../../shared/lib/ad-scene.ts';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {campaignExecutionStrategy} from '../../shared/lib/campaign-presentation.ts';
import {renderKleinScene} from '../../shared/runtime/klein-scene.ts';
import {releaseKleinCache} from '../../shared/runtime/klein-background.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
import {startComfyProxy} from '../../shared/runtime/proxy.ts';

const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=resolve('outputs','creative-acceptance',stamp,'creative-engine-alignment');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const runtime=JSON.parse(await readFile(resolve('outputs/runtime-config.json'),'utf8').catch(()=>'{}'));
const modelsDir=process.env.ADSTUDIO_KLEIN_MODELS_DIR||process.env.COMFYUI_MODELS_DIR||runtime.modelsDir;
if(!modelsDir)throw Error('Configure modelsDir.');
const comfyUrl=process.env.COMFYUI_URL||'http://127.0.0.1:8188';
const proxyUrl=process.env.COMFY_BASE_URL||'http://127.0.0.1:8189';
process.env.COMFYUI_URL=comfyUrl;process.env.COMFY_BASE_URL=proxyUrl;

const sourceFull=resolve('outputs/creative-acceptance/2026-10-28-readiness/previous-cookie-source.png');
const sam3Rgba=resolve('outputs/creative-acceptance/2026-10-28T21-56-37/sam3-cookie-proof/cookie-cutout-rgba.png');
await access(sourceFull);await access(sam3Rgba);
const sourceBytes=await readFile(sourceFull),rgbaBytes=await readFile(sam3Rgba);
assert.equal(sha(sourceBytes),'209a46b99271245e4dee4c3865b84664097081d44c4a7b211e5b11bb7ba9e3b6');
assert.equal(sha(rgbaBytes),'1ee0debb7bc50a5427273e9f577a737a6c56d05b90bdcce61ac0cf06ab2734f7');
await copyFile(sourceFull,join(out,'source-full.png'));
await copyFile(sam3Rgba,join(out,'sam3-cookie-rgba.png'));

// Klein LoadImage / VAEEncode does not preserve alpha as "product only".
// Composite onto a neutral cocoa matte so transparency does not become black voids.
const py=resolve(process.env.COMFY_PYTHON||'C:<home>/AppData/Local/Comfy-Desktop/ComfyUI-Installs/ComfyUI/ComfyUI/.venv/Scripts/python.exe');
const refPath=join(out,'product-identity-reference.png');
const prep=spawnSync(py,['-c',`
from PIL import Image
import hashlib
rgba=Image.open(r'''${sam3Rgba.replace(/\\/g,'/')}''').convert('RGBA')
# Tight crop to opaque content, then square pad on cocoa matte for ~0.33MP-friendly aspect
a=rgba.split()[-1]
bbox=a.getbbox()
assert bbox, 'empty alpha'
crop=rgba.crop(bbox)
pad=24
w,h=crop.size
side=max(w,h)+pad*2
matte=(42,28,22,255)  # deep cocoa — not foil, not cream plate cliché
canvas=Image.new('RGBA',(side,side),matte)
canvas.paste(crop,((side-w)//2,(side-h)//2),crop)
rgb=canvas.convert('RGB')
rgb.save(r'''${refPath.replace(/\\/g,'/')}''')
print(rgb.size[0],rgb.size[1],hashlib.sha256(open(r'''${refPath.replace(/\\/g,'/')}''','rb').read()).hexdigest())
`],{encoding:'utf8'});
if(prep.status!==0){console.error(prep.stderr||prep.stdout);throw Error('Failed to prepare identity reference RGB');}
const [rw,rh,refSha]=prep.stdout.trim().split(/\s+/);
const refBytes=await readFile(refPath);
assert.equal(sha(refBytes),refSha);

const native=async p=>(await fetch(comfyUrl+p,{signal:AbortSignal.timeout(8000)})).json();
const free=async()=>{await fetch(comfyUrl+'/free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unload_models:true,free_memory:true}),signal:AbortSignal.timeout(5000)}).catch(()=>{});};
await free();await new Promise(r=>setTimeout(r,1500));
const queue=await native('/queue');assert.equal((queue.queue_running?.length||0)+(queue.queue_pending?.length||0),0);
const stats=await native('/system_stats'),d=stats.devices?.[0];
const reclaim=((d?.vram_free||0)+Math.max(0,(d?.torch_vram_total||0)-(d?.torch_vram_free||0)))/1024**3;
const ram=(stats.system?.ram_free||0)/1024**3;
assert.ok(reclaim>=6,`Need ≥6 GiB reclaimable, have ${reclaim.toFixed(2)}`);
assert.ok(ram>=6,`Need ≥6 GiB RAM, have ${ram.toFixed(2)}`);

const brand=newBrand('No Crumbs Bakery');
brand.dna.description='No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.';
brand.dna.tone='Warm, inviting and indulgent.';
brand.dna.visualStyle='Deep cocoa, warm cream, directional window light, tactile walnut and appetizing editorial photography.';
brand.colors=['#3b2117','#f3dfbc','#9a5528'];
brand.overrides=['name','description','tone','visualStyle'];
brand.assets=[{id:'photo',assetId:'sam3-identity',name:'product-identity-reference.png',role:'product',productId:'cookie'}];
brand.products=[{id:'cookie',name:'Chocolate chip cookie',description:'Thick irregular chocolate chip cookie.',sellingPoints:'Shareable bakery cookie',imageIds:['photo']}];

const brandEvidence=[
 {id:'brand-name',kind:'owner',text:'No Crumbs Bakery'},
 {id:'brand-description',kind:'owner',text:brand.dna.description},
 {id:'brand-tone',kind:'owner',text:brand.dna.tone},
 {id:'brand-visualStyle',kind:'owner',text:brand.dna.visualStyle},
 {id:'tagline',kind:'owner',text:'Leave Nothing Behind'},
 {id:'product-visible',kind:'source',text:'SAM3-isolated cookie: thick irregular mound, deep cracked golden crust, uneven prominent chocolate chunks; foil packaging excluded; occluded rim/underside not visible in source.'}
];

const input={
 version:1,projectId:'creative-engine-alignment',brand,
 source:{id:'sam3-identity',name:'product-identity-reference.png',kind:'original',sha256:heroSha(refBytes),originalSha256:heroSha(sourceBytes),width:+rw,height:+rh},
 facts:{
  description:'Thick irregular mounded chocolate chip cookie with deep cracked golden crust, uneven edges and large dark chocolate chunks — not a flat round stock cookie. Foil tray is packaging and must not appear.',
  count:1,
  arrangement:'One hero cookie as the entire advertising subject.',
  texture:'Golden cracked crust, porous crumb, mounded bakery height, uneven chocolate chunks.',
  container:'None — packaging omitted; product only.',
  confirmed:true
 },
 productType:'cookies',productId:'cookie',
 request:'Campaign: Leave Nothing Behind — one authentic No Crumbs cookie as the unfinished invitation; warm editorial photography; intentional composition with copy space; no foil tray.',
 intent:'campaign',format:'feed',seed:77,
 // Owner-authorized creative campaign → Creative Restage (generative integrated scene).
 constraints:{exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',fidelity:'medium',creativity:'high'}
};

const quote=brand.dna.description;
const flat={arguments:[
 {title:'Leave Nothing Behind',idea:'Make the unfinished last bite the campaign — one thick cracked cookie so present that finishing it feels inevitable.',objective:'consideration',audienceHypothesis:'People who linger over dessert may respond to an honest bakery object that still looks unfinished and shareable.',tension:'Generic cookie ads look complete and forgettable; an unfinished authentic cookie holds attention.',businessFit:quote,feeling:'Warm resolve to finish what is in front of you.',memory:'One mounded cracked cookie in warm window light with open space for Leave Nothing Behind.',focus:'One thick irregular chocolate chip cookie — cracks, chunks, bakery height — no foil.',opening:'Establish quiet negative space, then land the cookie as the only unfinished subject.',payoff:'Hold the authentic cookie with calm lettering room for Leave Nothing Behind.',proofId:'brand-description',proofQuote:quote},
 {title:'Thickness on display',idea:'Use bakery height and deep crust cracks as the reason to lean in — one cookie, no packaging theatre.',objective:'consideration',audienceHypothesis:'Hosts may want cookies that look substantial enough to share as a real bakery object.',tension:'Flat stock cookies erase the thick irregular character that makes these cookies recognizable.',businessFit:quote,feeling:'Warm appetite from reading real bakery height and cracks.',memory:'Deep cracks and uneven chunks on a thick cookie against calm walnut.',focus:'One thick chocolate chip cookie with cracked golden crust and uneven chunks.',opening:'Graze light across mound and cracks before the set settles.',payoff:'Hold the cookie at recognition scale with open brand lettering.',proofId:'brand-description',proofQuote:quote},
 {title:'Texture invitation',idea:'Lead with cracked crust and chunky chocolate so the cookie feels handmade-thick without inventing fillings.',objective:'consideration',audienceHypothesis:'Buyers may trust irregular bakery texture more than a polished generic cookie.',tension:'Smooth studio cookies hide the cracked surfaces that identify this product.',businessFit:quote,feeling:'Quiet curiosity about the tactile surface.',memory:'Cracked crust and uneven chunks remain the recognition cue.',focus:'Golden cracked crust and large dark chocolate chunks on one thick cookie.',opening:'Graze light across crust cracks before revealing the full cookie.',payoff:'Resolve on the cookie at recognition scale with Leave Nothing Behind.',proofId:'brand-description',proofQuote:quote}
]};
const ctx=creativeContext(input);
let plan=assembleCreativePlan(input,conceptsFromArguments(flat,input,ctx),{planningVersion:2,mode:'local-ai',model:'authored-validated-argument',reason:'Creative engine alignment: generative restage directed by Creative Director + Dynamics.',contribution:{format:'advertising-arguments-v1',modelFields:['title','idea','strategy'],appFields:['composition','camera','environment','lighting','copy','dynamics']}},randomBytes(8).toString('hex').slice(0,16));
// Prefer the Leave Nothing Behind argument if present.
const leave=plan.concepts.find(c=>/leave nothing behind/i.test(c.title));
if(leave)plan={...plan,selectedId:leave.id,selectionReason:'Owner-aligned tagline concept selected for alignment proof.'};
plan=refinePlanComposition(plan,'Leave more negative space for copy. Make it feel more like this brand. Bring the hero product closer.',randomBytes(8).toString('hex').slice(0,16));
plan={...plan,dynamics:{...plan.dynamics,mode:'static',product:{...plan.dynamics.product,count:1,arrangement:'Single hero cookie; restrained placement with readable silhouette; no multi-cookie inventing; no foil packaging.',packagingPolicy:'omit-if-not-product'},frame:{...plan.dynamics.frame,energy:'restrained',heroPlacement:'Lower-centre to mid-frame hero with open upper field for Leave Nothing Behind.',negativeSpace:'Expand calm negative space for typography; reduce competing mid-ground detail.'}}};
assert.equal(campaignExecutionStrategy(plan),'creative-restage');
const selected=plan.concepts.find(c=>c.id===plan.selectedId);
const prompt=adScenePrompt(plan);
const archetype=sceneDirection(plan).archetype;

// Pre-generation evidence package (required before Klein).
const preflight={
 stamp,execution:'creative-restage',
 brandEvidence,
 productIdentityReferences:{
  sourceFullSha256:sha(sourceBytes),
  sam3RgbaSha256:sha(rgbaBytes),
  kleinIdentityReference:refPath,
  kleinIdentityReferenceSha256:sha(refBytes),
  referencePrep:'SAM3 RGBA tight-cropped onto deep cocoa RGB matte (no foil). Klein scene scales to 0.33MP via ImageScaleToTotalPixels then VAEEncode+ReferenceLatent.',
  identityLimits:'Visible top surface only; occluded rim/underside absent — generative reconstruction may approximate but cannot certify exact identity.'
 },
 selectedConcept:{id:selected.id,title:selected.title,idea:selected.idea,rationale:plan.selectionReason,strategy:selected.strategy,composition:selected.composition,camera:selected.camera,environment:selected.environment,lighting:selected.lighting},
 dynamics:plan.dynamics,
 klein:{workflow:'klein4b_scene.json',conditioning:'ReferenceLatent on pos+neg, CFG1, 4-step Euler, 768x960',prompt,seed:77,archetype,noProductPaste:true},
 expectedVisual:'Integrated photographic ad still: one thick cracked No Crumbs-like cookie in a warm brand-consistent scene; foil absent; open copy space for Leave Nothing Behind; not a cutout paste.'
};
await writeFile(join(out,'preflight.json'),JSON.stringify(preflight,null,2));
await writeFile(join(out,'plan.json'),JSON.stringify({selectedId:plan.selectedId,title:selected.title,execution:campaignExecutionStrategy(plan),dynamics:plan.dynamics,prompt,archetype,controls:plan.context.controls},null,2));

const uploadName=randomBytes(8).toString('hex')+'.png';
const outputsRoot=resolve('outputs');
await writeFile(join(outputsRoot,uploadName),refBytes);
await startComfyProxy(resolve('.'),{COMFYUI_URL:comfyUrl,COMFY_BASE_URL:proxyUrl});
const c=new Comfy();
console.log('ONE Creative Restage (integrated scene; SAM3 identity ref)… reclaim',reclaim.toFixed(2));
const started=Date.now();
let scene;
try{
 scene=await renderKleinScene(outputsRoot,modelsDir,await native('/system_stats'),await native('/queue'),c,prompt,77,'/outputs/'+uploadName,archetype,comfyUrl,AbortSignal.timeout(900000),m=>console.log(' ',m));
}catch(error){
 const jobId=error.jobId;console.error('SDK failed:',error.message,'jobId',jobId);if(!jobId)throw error;
 for(let i=0;i<90;i++){const q=await native('/queue');if(!(q.queue_running?.length||q.queue_pending?.length))break;await new Promise(r=>setTimeout(r,2000));}
 const hist=await native('/history/'+jobId);const img=hist?.[jobId]?.outputs?.['13']?.images?.[0];
 if(!img?.filename)throw error;
 const view=new URL('/view',comfyUrl);view.searchParams.set('filename',img.filename);if(img.subfolder)view.searchParams.set('subfolder',img.subfolder);view.searchParams.set('type',img.type||'output');
 const bytes=Buffer.from(await (await fetch(view,{signal:AbortSignal.timeout(30000)})).arrayBuffer());
 const id=(img.filename.match(/klein-scene-([a-f0-9]+)/)||[])[1]||randomBytes(8).toString('hex');
 await writeFile(join(outputsRoot,id+'.png'),bytes).catch(async()=>writeFile(join(outputsRoot,id+'-recovered.png'),bytes));
 scene={url:'/outputs/'+id+'.png',sha256:heroSha(bytes),width:768,height:960,seconds:(Date.now()-started)/1000,model:'klein-scene',jobId,provenanceId:id,prompt,seed:77,sourceSha256:sha(refBytes),archetype,fidelityMode:'creative-restage',warning:'Recovered after SDK timeout. Creative Restage — identity not certified.',recovered:true};
}
assert.equal(scene.model,'klein-scene');
assert.equal(scene.fidelityMode,'creative-restage');
let sceneBytes;try{sceneBytes=await readFile(join(outputsRoot,scene.url.slice(9)));}catch{sceneBytes=await readFile(join(outputsRoot,scene.provenanceId+'-recovered.png'));}
await writeFile(join(out,'creative-restage.png'),sceneBytes);

const design=campaignDesign({...plan.composition,headline:'Leave Nothing Behind',body:selected.strategy?.memory||selected.idea,cta:'Taste the real thing',brandName:'No Crumbs Bakery',website:'',size:'feed',background:'#14110f',textColor:'#fffaf0'},archetype,'scene','composite');
const laid=campaignSVG(design,{photo:'data:image/png;base64,'+sceneBytes.toString('base64')},1080,1350);
const adBytes=Buffer.from(new Resvg(laid.svg).render().asPng());
await writeFile(join(out,'advertisement.png'),adBytes);

const report={
 stamp,elapsedMs:Date.now()-started,reclaimGiB:+reclaim.toFixed(2),
 method:'creative-director + dynamics + klein-scene ReferenceLatent (SAM3 identity ref)',
 NOT_APPROVED_PENDING_OWNER:true,
 scene:{model:scene.model,fidelityMode:scene.fidelityMode,jobId:scene.jobId,provenanceId:scene.provenanceId,sha256:scene.sha256||sha(sceneBytes),width:scene.width,height:scene.height,seed:77,recovered:!!scene.recovered,warning:scene.warning},
 selectedConcept:{title:selected.title,idea:selected.idea},
 prompt,dynamics:plan.dynamics,
 identityReferenceSha256:sha(refBytes),
 criticalReview:{
  productResemblance:'Compare vs SAM3/source — expect partial identity under 4-step ReferenceLatent; mark NOT APPROVED if generic.',
  advertisingIdea:'Must express Leave Nothing Behind / unfinished authentic cookie, not generic stock.',
  artDirection:'Composition should follow Dynamics (single hero, copy space, brand warmth).',
  brandCharacter:'Warm cocoa / walnut editorial — not sterile catalogue.',
  commercialPhotograph:'Integrated generative scene (not paste).',
  misrepresentationRisk:'Do not claim exact bakery geometry or invent fillings.',
  pastePathUsed:false,
  emptyScenePasteUsed:false
 },
 note:'Owner visual review required. Generative identity is requested, not certified. No commercial PASS. No merge.'
};
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
await writeFile(join(out,'comparison.html'),`<!doctype html><meta charset="utf-8"><title>Creative engine alignment</title>
<style>body{font:16px/1.4 Georgia,serif;background:#141210;color:#f3ebe1;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}img{width:100%;max-height:720px;object-fit:contain;background:#222}pre{font:12px/1.35 ui-monospace,Consolas,monospace;white-space:pre-wrap}</style>
<h1>Creative engine alignment · ${stamp}</h1>
<p>${selected.title} · Klein scene <code>${scene.jobId}</code> · Creative Restage · not paste</p>
<main>
<figure><img src="source-full.png"/><figcaption>Authorized source</figcaption></figure>
<figure><img src="sam3-cookie-rgba.png"/><figcaption>SAM3 product isolation</figcaption></figure>
<figure><img src="product-identity-reference.png"/><figcaption>Klein identity reference (RGB matte)</figcaption></figure>
<figure><img src="creative-restage.png"/><figcaption>Integrated generative scene</figcaption></figure>
<figure><img src="advertisement.png"/><figcaption>Finished advertisement</figcaption></figure>
</main>
<pre>${JSON.stringify({concept:selected.title,idea:selected.idea,dynamics:plan.dynamics.product,scene:report.scene},null,2)}</pre>`);
await releaseKleinCache(scene.jobId,comfyUrl).catch(()=>{});
console.log('RAW',join(out,'creative-restage.png'));
console.log('AD',join(out,'advertisement.png'));
console.log('JOB',scene.jobId);
console.log('SHA',report.scene.sha256);
process.exit(0);
