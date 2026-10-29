#!/usr/bin/env node
/** FLUX 3 mi2i recovery generation — identity-safe dual-ref, directorPrompt when SKIP_PUP, consumer copy only. */
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {access,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Resvg} from '@resvg/resvg-js';
import {assembleCreativePlan,creativeContext,conceptsFromArguments,refinePlanComposition,consumerCampaignCopy} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {campaignExecutionStrategy} from '../../shared/lib/campaign-presentation.ts';
import {flux3CanonSha,prepareFlux3Spatial,flux3InferenceAuthorized,bindFlux3Mi2iInputs,loadFlux3Workflow} from '../../shared/runtime/flux3-klein-scene.ts';
import {flux3CaptionViolatesConstraints,flux3RuntimePrompt} from '../../shared/lib/flux3-spatial.ts';
import {campaignDesign,sceneDirection} from '../../shared/lib/ad-scene.ts';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {identityPrepPython} from '../../shared/lib/identity-reference.ts';
import {reviewGeneratedCampaign} from '../../shared/lib/creative-visual-review.ts';

assert.equal(process.env.ADSTUDIO_FLUX3_INFERENCE,'1');
const comfy=process.env.COMFYUI_URL||'http://127.0.0.1:18188';
const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=resolve('outputs','creative-acceptance',stamp,'flux3-mi2i-leave-nothing');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');

const sourceFull=resolve('outputs/creative-acceptance/2026-10-28-readiness/previous-cookie-source.png');
const sam3Rgba=resolve('outputs/creative-acceptance/2026-10-28T21-56-37/sam3-cookie-proof/cookie-cutout-rgba.png');
const identityOverride=process.env.ADSTUDIO_IDENTITY_PNG?resolve(process.env.ADSTUDIO_IDENTITY_PNG):null;
await access(sourceFull);
const sourceBytes=await readFile(sourceFull);
await copyFile(sourceFull,join(out,'source-full.png'));
const refPath=join(out,'product-identity-reference.png');
let refBytes,rw,rh,refSha;
if(identityOverride){
 await access(identityOverride);
 await copyFile(identityOverride,refPath);
 refBytes=await readFile(refPath);
 refSha=sha(refBytes);
 const py0=resolve(process.env.COMFY_PYTHON||'C:<home>/AppData/Local/Comfy-Desktop/ComfyUI-Installs/ComfyUI/ComfyUI/.venv/Scripts/python.exe');
 const dim=spawnSync(py0,['-c',`from PIL import Image;im=Image.open(r'''${refPath.replace(/\\/g,'/')}''');print(im.size[0],im.size[1])`],{encoding:'utf8'});
 [rw,rh]=dim.stdout.trim().split(/\s+/);
 console.log('IDENTITY_OVERRIDE',identityOverride,rw+'x'+rh,refSha.slice(0,12));
}else{
 await access(sam3Rgba);
 await copyFile(sam3Rgba,join(out,'sam3-cookie-rgba.png'));
 const py=resolve(process.env.COMFY_PYTHON||'C:<home>/AppData/Local/Comfy-Desktop/ComfyUI-Installs/ComfyUI/ComfyUI/.venv/Scripts/python.exe');
 const prep=spawnSync(py,['-c',identityPrepPython(sam3Rgba,refPath)],{encoding:'utf8'});
 if(prep.status!==0){console.error(prep.stderr||prep.stdout);throw Error('Identity reference prep failed');}
 [rw,rh,refSha]=prep.stdout.trim().split(/\s+/);
 refBytes=await readFile(refPath);
 assert.equal(sha(refBytes),refSha);
 console.log('IDENTITY',rw+'x'+rh,refSha.slice(0,12));
}

const brand=newBrand('No Crumbs Bakery');
brand.dna.description='No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.';
brand.dna.tone='Warm, inviting and indulgent.';
brand.dna.visualStyle='Deep cocoa, warm cream, sculptural studio light, tactile walnut and appetizing editorial photography.';
brand.dna.messaging='Leave Nothing Behind';
brand.colors=['#3b2117','#f3dfbc','#9a5528'];
brand.overrides=['name','description','tone','visualStyle','messaging'];
brand.assets=[{id:'photo',assetId:'sam3-identity',name:'product-identity-reference.png',role:'product',productId:'cookie'}];
brand.products=[{id:'cookie',name:'Chocolate chip cookie',description:'Thick irregular chocolate chip cookie.',sellingPoints:'Made to share — leave nothing behind.',imageIds:['photo']}];
const quote=brand.dna.description;

const input={
 version:1,projectId:'flux3-recovery',brand,
 source:{id:'sam3-identity',name:'product-identity-reference.png',kind:'original',sha256:sha(refBytes),originalSha256:sha(sourceBytes),width:+rw,height:+rh},
 facts:{
  description:'Thick irregular chocolate chip cookie with deep cracked golden crust, uneven lumpy planform and naturally distributed dark chocolate chunks — not a flat stock cookie and not a bread loaf. Foil tray is packaging and must not appear.',
  count:1,arrangement:'One hero cookie as the entire advertising subject.',
  texture:'Golden cracked crust, porous crumb, bakery height, uneven chocolate chunks (not flat melting disks).',
  container:'None — packaging omitted; product only.',confirmed:true
 },
 productType:'cookies',productId:'cookie',
 request:'Campaign: Leave Nothing Behind — one authentic No Crumbs cookie; sculptural studio presence; intentional composition; no foil tray; no kitchen-window cliché.',
 intent:'campaign',format:'feed',seed:91,
 constraints:{exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',fidelity:'medium',creativity:'high'}
};

const flat={arguments:[
 {title:'Leave Nothing Behind',idea:'Make finishing the last bite inevitable — one recognizable cookie, sculptural and alone, so desire comes from presence not kitchen lifestyle.',objective:'consideration',audienceHypothesis:'People who linger over dessert may respond to an honest bakery object that still looks unfinished and shareable.',tension:'Generic cookie ads look complete and forgettable; an unfinished authentic cookie holds attention.',businessFit:quote,feeling:'Warm resolve to finish what is in front of you.',memory:'One thick irregular cookie against calm sculptural studio depth.',focus:'One thick irregular chocolate chip cookie — cracks, chunks, bakery height — no foil.',opening:'Establish quiet negative space, then land the cookie as the only unfinished subject.',payoff:'Hold the authentic cookie with calm lettering room for Leave Nothing Behind.',proofId:'brand-description',proofQuote:quote},
 {title:'Thickness on display',idea:'Use bakery height and deep crust cracks as the reason to lean in — one cookie, no packaging theatre.',objective:'consideration',audienceHypothesis:'Hosts may want cookies that look substantial enough to share.',tension:'Flat stock cookies erase thick irregular character.',businessFit:quote,feeling:'Warm appetite from bakery height.',memory:'Deep cracks and uneven chunks on a thick cookie.',focus:'One thick chocolate chip cookie.',opening:'Graze light across mound.',payoff:'Hold cookie at recognition scale.',proofId:'brand-description',proofQuote:quote},
 {title:'Texture invitation',idea:'Lead with cracked crust and chunky chocolate without inventing fillings.',objective:'consideration',audienceHypothesis:'Buyers trust irregular bakery texture.',tension:'Smooth studio cookies hide cracked surfaces.',businessFit:quote,feeling:'Quiet curiosity.',memory:'Cracked crust and uneven chunks.',focus:'Golden cracked crust and chunks.',opening:'Graze light across cracks.',payoff:'Resolve with Leave Nothing Behind.',proofId:'brand-description',proofQuote:quote}
]};
const ctx=creativeContext(input);
let plan=assembleCreativePlan(input,conceptsFromArguments(flat,input,ctx),{planningVersion:2,mode:'local-ai',model:'authored-validated-argument',reason:'FLUX3 recovery generation',contribution:{format:'advertising-arguments-v1',modelFields:['title','idea','strategy'],appFields:['composition','camera','environment','lighting','copy','dynamics']}},randomBytes(8).toString('hex').slice(0,16));
const leave=plan.concepts.find(c=>/leave nothing behind/i.test(c.title));
if(leave){
 // Prefer sculptural studio over kitchen window for this recovery.
 leave.environment='Sculptural dark food studio: charcoal seamless sweep, single warm key from camera-left, deep falloff; product alone on a low matte plinth with a crisp contact shadow. Use neutral surroundings; no brand palette has been confirmed.';
 leave.lighting='Single warm key from camera-left with deep studio falloff, soft fill from below, and a sharp natural contact shadow on the plinth.';
 leave.composition='Sculptural hero: place one product unit slightly below centre on a quiet plinth; reserve a tall calm upper band for lettering; keep planform readable (not elongated).';
 plan={...plan,selectedId:leave.id,concepts:plan.concepts.map(c=>c.id===leave.id?leave:c)};
}
plan=refinePlanComposition(plan,'Leave more negative space for copy. Make it feel more like this brand. Bring the hero product closer.',randomBytes(8).toString('hex').slice(0,16));
plan={...plan,dynamics:{...plan.dynamics,mode:'static',product:{...plan.dynamics.product,count:1,arrangement:'Single hero cookie; compact irregular roundish planform; restrained placement; no multi-cookie inventing; no foil packaging.',packagingPolicy:'omit-if-not-product',identityAnchors:['irregular roundish / lumpy planform — not a loaf or bread roll','deep irregular cracked crust','uneven embedded chocolate chunks — not flat disks','thick bakery height']},frame:{...plan.dynamics.frame,energy:'restrained',heroPlacement:'Compact hero slightly below centre with open upper field.',negativeSpace:'Expand calm negative space for typography; reduce competing mid-ground detail.'}}};
assert.equal(campaignExecutionStrategy(plan),'creative-restage');
const selected=plan.concepts.find(c=>c.id===plan.selectedId);
const spatial=prepareFlux3Spatial(plan.dynamics,selected.environment);
assert.ok(!flux3CaptionViolatesConstraints(spatial.shortPrompt,plan.dynamics).length);
assert.equal(spatial.elements.find(e=>e.id==='product_1').bbox.join(','),'420,260,900,740');
const runtimePrompt=flux3RuntimePrompt(spatial,process.env.ADSTUDIO_FLUX3_SKIP_PUP!=='0');

const skipPup=process.env.ADSTUDIO_FLUX3_SKIP_PUP!=='0';
const loaded=await loadFlux3Workflow('mi2i');
// Dual-ref: use identity for BOTH slots when packaging is omitted — tray overhead source fights single-cookie identity.
const bound=bindFlux3Mi2iInputs(loaded.graph,{
 prompt:runtimePrompt+'\n\n'+spatial.captionWithBoxes,
 seed:91,
 sourceImage:'sam3-identity-reference.png',
 identityImage:'sam3-identity-reference.png',
 filenamePrefix:'adstudio/flux3-mi2i-recovery-'+stamp
});
if(skipPup&&bound['51']?.class_type==='ComfySwitchNode')bound['51'].inputs.switch=true;

await writeFile(join(out,'preflight.json'),JSON.stringify({stamp,comfy,seed:91,spatial,dynamics:plan.dynamics,concept:{title:selected.title,idea:selected.idea,environment:selected.environment},runtimePrompt,skipPup,dualRef:'identity-identity',graphSha:flux3CanonSha(bound),ownerRejectedPrior:'2026-10-29T10-54-57'},null,2));
await writeFile(join(out,'bound-workflow.api.json'),JSON.stringify(bound,null,2));
await writeFile(join(out,'short-prompt.txt'),spatial.shortPrompt);
await writeFile(join(out,'director-prompt.txt'),spatial.directorPrompt);
await writeFile(join(out,'runtime-prompt.txt'),runtimePrompt);
await writeFile(join(out,'caption-with-boxes.txt'),spatial.captionWithBoxes);

const stats=await (await fetch(comfy+'/system_stats',{signal:AbortSignal.timeout(10000)})).json();
console.log('REMOTE',stats.devices?.[0]?.name,'comfy',stats.system?.comfyui_version,'vram_free',stats.devices?.[0]?.vram_free);

async function upload(name,bytes){
 const form=new FormData();
 form.append('image',new Blob([bytes],{type:'image/png'}),name);
 form.append('overwrite','true');
 const r=await fetch(comfy+'/upload/image',{method:'POST',body:form,signal:AbortSignal.timeout(120000)});
 if(!r.ok)throw Error('upload failed '+name+' '+r.status);
 return r.json();
}
await upload('sam3-identity-reference.png',refBytes);
console.log('UPLOADED identity (both refs)');

const clientId=randomBytes(8).toString('hex');
const queued=await (await fetch(comfy+'/prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:bound,client_id:clientId}),signal:AbortSignal.timeout(30000)})).json();
if(queued.error||queued.node_errors&&Object.keys(queued.node_errors).length){
 await writeFile(join(out,'queue-error.json'),JSON.stringify(queued,null,2));
 throw Error('queue failed: '+JSON.stringify(queued.error||queued.node_errors).slice(0,800));
}
const promptId=queued.prompt_id;console.log('QUEUED',promptId);
const started=Date.now();
let hist;
for(let i=0;i<240;i++){
 await new Promise(r=>setTimeout(r,5000));
 hist=await (await fetch(comfy+'/history/'+promptId,{signal:AbortSignal.timeout(15000)})).json();
 if(hist[promptId]){console.log('DONE',i*5,'s');break;}
 if(i%6===0){
  const q=await (await fetch(comfy+'/queue',{signal:AbortSignal.timeout(10000)})).json();
  console.log('waiting',i*5,'s','running',q.queue_running?.length||0,'pending',q.queue_pending?.length||0);
 }
}
if(!hist?.[promptId])throw Error('timeout waiting for '+promptId);
await writeFile(join(out,'history.json'),JSON.stringify(hist[promptId],null,2));
if(hist[promptId].status?.status_str==='error'||hist[promptId].status?.messages?.some?.(m=>m[0]==='execution_error')){
 throw Error('execution error: '+JSON.stringify(hist[promptId].status).slice(0,800));
}
const outputs=hist[promptId].outputs||{};
let img;
for(const node of Object.values(outputs)){
 const images=node.images||[];
 if(images[0]){img=images[0];break;}
}
if(!img)throw Error('no image in history outputs');
const view=new URL('/view',comfy);
view.searchParams.set('filename',img.filename);
if(img.subfolder)view.searchParams.set('subfolder',img.subfolder);
view.searchParams.set('type',img.type||'output');
const raw=Buffer.from(await (await fetch(view,{signal:AbortSignal.timeout(60000)})).arrayBuffer());
await writeFile(join(out,'flux3-mi2i-raw.png'),raw);

const copy=consumerCampaignCopy(input,selected,ctx);
const design=campaignDesign({...plan.composition,headline:copy.headline||'Leave Nothing Behind',body:copy.body,cta:copy.cta||'Taste the real thing',brandName:'No Crumbs Bakery',website:'',size:'feed',background:'#14110f',textColor:'#fffaf0'},sceneDirection(plan).archetype,'scene','composite');
const laid=campaignSVG(design,{photo:'data:image/png;base64,'+raw.toString('base64')},1080,1350);
assert.ok(!/Basic draft|mounded cracked cookie in warm window|open space for/i.test(laid.svg));
const ad=Buffer.from(new Resvg(laid.svg).render().asPng());
await writeFile(join(out,'advertisement.png'),ad);
const review=reviewGeneratedCampaign({design:laid.design||design,dynamics:plan.dynamics,ownerRejectedPrior:true,rawNotes:['Inspect raw vs identity for loaf silhouette and disk chips.']});
await writeFile(join(out,'visual-review.json'),JSON.stringify(review,null,2));
const report={
 stamp,elapsedMs:Date.now()-started,comfy,promptId,seed:91,
 sha256:sha(raw),adSha256:sha(ad),identitySha256:refSha,
 concept:{title:selected.title,idea:selected.idea,environment:selected.environment},
 copy,spatialHeroBBox:spatial.elements.find(e=>e.id==='product_1').bbox,
 method:'flux3-klein-bf16-mi2i identity×2 + directorPrompt (SKIP_PUP) + near-square boxes + consumerCampaignCopy',
 review,
 NOT_APPROVED_PENDING_OWNER:true,
 note:'Owner visual review required. Prior kitchen-window candidate explicitly rejected.'
};
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
await writeFile(join(out,'comparison.html'),`<!doctype html><meta charset=utf-8><title>FLUX3 recovery</title>
<style>body{font:16px Georgia;background:#141210;color:#f3ebe1;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}img{width:100%;background:#222}</style>
<h1>${selected.title}</h1><p>${review.verdict} · ${promptId}</p><main>
<figure><img src=source-full.png><figcaption>authentic source</figcaption></figure>
<figure><img src=product-identity-reference.png><figcaption>identity (square-centred)</figcaption></figure>
<figure><img src=flux3-mi2i-raw.png><figcaption>FLUX3 mi2i raw</figcaption></figure>
<figure><img src=advertisement.png><figcaption>finished ad (no QC burn-in)</figcaption></figure>
</main>`);
console.log('RAW',join(out,'flux3-mi2i-raw.png'));
console.log('AD',join(out,'advertisement.png'));
console.log('SHA',report.sha256);
console.log('REVIEW',review.verdict);
process.exit(0);
