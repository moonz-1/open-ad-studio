#!/usr/bin/env node
/** FLUX 3 mi2i fragrance benchmark — Abel Green Cedar via Dynamics + production workflow.
 * Private Secure Cloud only. Third-party packshot used for internal benchmark — do not publish assets. */
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {access,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {assembleCreativePlan,creativeContext,conceptsFromArguments,refinePlanComposition,consumerCampaignCopy} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {campaignExecutionStrategy} from '../../shared/lib/campaign-presentation.ts';
import {flux3CanonSha,prepareFlux3Spatial,bindFlux3Mi2iInputs,loadFlux3Workflow} from '../../shared/runtime/flux3-klein-scene.ts';
import {flux3CaptionViolatesConstraints,flux3RuntimePrompt} from '../../shared/lib/flux3-spatial.ts';
import {campaignDesign,sceneDirection,flux3ScenePrompt} from '../../shared/lib/ad-scene.ts';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {reviewGeneratedCampaign} from '../../shared/lib/creative-visual-review.ts';

assert.equal(process.env.ADSTUDIO_FLUX3_INFERENCE,'1');
const comfy=process.env.COMFYUI_URL||'http://127.0.0.1:18188';
const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=resolve('outputs','creative-acceptance',stamp,'flux3-green-cedar');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');

const packshot=resolve('outputs/fixtures/abel/green-cedar.png');
const meta=JSON.parse(await readFile(resolve('outputs/fixtures/abel/green-cedar-meta.json'),'utf8'));
await access(packshot);
const packBytes=await readFile(packshot);
await copyFile(packshot,join(out,'source-packshot.png'));
await copyFile(packshot,join(out,'product-identity-reference.png'));
await writeFile(join(out,'source-meta.json'),JSON.stringify({...meta,note:'Official CDN packshot cached for private internal benchmark. Do not publish without Abel permission.',sha256:sha(packBytes)},null,2));

const brand=newBrand('Abel');
brand.dna.description='Abel creates high-performance natural eau de parfum. Green Cedar: a vibrant aromatic wood — the tallest woods, earth damp underfoot; aromatic cardamom and velvety magnolia; complex, singular, grounding.';
brand.dna.tone='Quiet, considered, natural luxury.';
brand.dna.visualStyle='Soft mineral and cedar light, frosted glass, architectural stillness, restrained botanical depth.';
brand.dna.messaging='A quieter green.';
brand.colors=meta.colors||['#f6eada','#1c241c','#dad9d5','#414042'];
brand.overrides=['name','description','tone','visualStyle','messaging'];
brand.assets=[{id:'photo',assetId:'gc-packshot',name:'green-cedar.png',role:'product',productId:'green-cedar'}];
brand.products=[{id:'green-cedar',name:'Green Cedar',description:'A vibrant aromatic wood. Magnolia and cardamom over cypriol, guaiac, Texas and Atlas cedar.',sellingPoints:'Complex, singular, grounding.',imageIds:['photo']}];
const quote=brand.dna.description;

const input={
 version:1,projectId:'flux3-green-cedar',brand,
 source:{id:'gc-packshot',name:'green-cedar.png',kind:'original',sha256:sha(packBytes),originalSha256:sha(packBytes),width:1080,height:1080},
 facts:{
  description:'One frosted trapezoidal glass perfume bottle labeled GREEN CEDAR / 100% NATURAL EAU DE PARFUM / 50ML, cream cylindrical matte cap, embossed Abel mark near base, pale greenish liquid.',
  count:1,arrangement:'Single upright bottle, front label facing camera.',
  texture:'Frosted semi-opaque glass with soft edge highlights; matte cream cap; sharp black sans-serif label print.',
  container:'Glass perfume bottle with cream cap — the bottle is the product.',confirmed:true
 },
 productType:'packaged-goods',productId:'green-cedar',
 request:'Luxury fragrance campaign: restrained woody botanical editorial for Green Cedar — architectural stillness, not a green gradient packshot.',
 intent:'campaign',format:'feed',seed:41,
 constraints:{exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',fidelity:'medium',creativity:'high'}
};

const flat={arguments:[
 {title:'Cedar light',idea:'Argue for a premium woody atmosphere: sunlight, grain and stone make the bottle feel held in nature without inventing notes or performance claims.',objective:'consideration',audienceHypothesis:'People seeking quiet natural luxury may respond to architectural stillness around a recognizable frosted bottle.',tension:'Generic fragrance ads float bottles on colour fields; Green Cedar needs damp-earth calm and cedar architecture.',businessFit:quote,feeling:'Grounded, quiet resolve.',memory:'Frosted bottle on stone with soft cedar depth.',focus:'One frosted Green Cedar bottle — exact silhouette, cream cap, printed label.',opening:'Establish quiet architectural negative space, then land the bottle.',payoff:'Hold the authentic bottle with calm lettering room.',proofId:'brand-description',proofQuote:quote},
 {title:'Moss vignette',idea:'Argue for intimacy: bring the observed bottle close in a moss-mineral vignette so the viewer leans in — product identity stays exact.',objective:'consideration',audienceHypothesis:'Fragrance buyers lean into tactile materials when the bottle remains exact.',tension:'Wide lifestyle sets steal focus from the bottle.',businessFit:quote,feeling:'Quiet curiosity.',memory:'Close frosted glass against moss-mineral calm.',focus:'Frosted glass, cream cap, GREEN CEDAR label.',opening:'Graze light across frosted edges.',payoff:'Resolve on label-readable bottle.',proofId:'brand-description',proofQuote:quote},
 {title:'Walnut quiet',idea:'Argue for editorial calm: walnut and soft green depth create space for a restrained headline; silhouette remains the only subject.',objective:'consideration',audienceHypothesis:'Editorial shoppers want quiet luxury space around the object.',tension:'Busy sets erase the architectural bottle.',businessFit:quote,feeling:'Editorial calm.',memory:'Bottle alone on walnut with soft green depth.',focus:'Exact trapezoidal bottle silhouette.',opening:'Broad soft key, then product.',payoff:'Open field for brand lettering.',proofId:'brand-description',proofQuote:quote}
]};
const ctx=creativeContext(input);
let plan=assembleCreativePlan(input,conceptsFromArguments(flat,input,ctx),{planningVersion:2,mode:'local-ai',model:'authored-validated-argument',reason:'FLUX3 Green Cedar fragrance benchmark — authored arguments; Qwen Creative Director not claimed.',contribution:{format:'advertising-arguments-v1',modelFields:['title','idea','strategy'],appFields:['composition','camera','environment','lighting','copy','dynamics']}},randomBytes(8).toString('hex').slice(0,16));
const cedar=plan.concepts.find(c=>/cedar light/i.test(c.title))||plan.concepts[0];
if(cedar){
 cedar.environment='Asymmetric cedar-inspired architecture: vertical wood grain plane left, soft atmospheric depth right; product rests on a cool stone ledge with a believable contact shadow — no inventing fragrance ingredients. Surroundings may echo cream, mineral green and charcoal; keep the product\'s real colours.';
 cedar.lighting='Directional late-afternoon sunlight with soft leaf-shadow mottling on the rear plane, warm reflected fill from wood, and a crisp natural contact shadow under the bottle.';
 cedar.composition='Environmental editorial: place the bottle lower-left to mid-frame on a ledge; leave a tall quiet column of negative space on the right for headline lettering; keep a soft contact shadow.';
 cedar.camera='Slightly elevated three-quarter that keeps the full bottle and cream cap readable; low distortion.';
 plan={...plan,selectedId:cedar.id,concepts:plan.concepts.map(c=>c.id===cedar.id?cedar:c)};
}
plan=refinePlanComposition(plan,'Leave more negative space for copy. Make it feel more like this brand. Bring the hero product closer.',randomBytes(8).toString('hex').slice(0,16));
plan={...plan,dynamics:{...plan.dynamics,mode:'static',product:{...plan.dynamics.product,count:1,packagingPolicy:'preserve',arrangement:'Single upright frosted bottle slightly off-centre on a stone ledge; cream cap fully visible; front label readable; no second bottle.',identityAnchors:['trapezoidal bottle: wider base, soft taper to flat shoulder','frosted / matte glass body with soft edge light','matte cream cylindrical cap, flush and centered','front printed GREEN CEDAR label + embossed Abel mark','pale greenish liquid fill']},frame:{...plan.dynamics.frame,energy:'restrained',heroPlacement:'Asymmetric mid-right to lower-mid hero with tall quiet left/upper field for lettering.',negativeSpace:'Expand calm negative space for typography; reduce competing mid-ground detail.'},light:{...plan.dynamics.light,key:cedar.lighting,atmosphere:'Quiet woody-mineral luxury; damp-earth calm without inventing props theatre.'}}};
assert.equal(campaignExecutionStrategy(plan),'creative-restage');
const selected=plan.concepts.find(c=>c.id===plan.selectedId);
const spatial=prepareFlux3Spatial(plan.dynamics,selected.environment);
assert.ok(spatial.elements.find(e=>e.id==='product_1').bbox[2]-spatial.elements.find(e=>e.id==='product_1').bbox[0]>500,'tall bottle hero');
assert.ok(!flux3CaptionViolatesConstraints(spatial.shortPrompt,plan.dynamics).length);
assert.ok(!flux3CaptionViolatesConstraints(spatial.directorPrompt,plan.dynamics).length);

const skipPup=process.env.ADSTUDIO_FLUX3_SKIP_PUP==='1';
const runtimePrompt=flux3RuntimePrompt(spatial,skipPup);
const apiPrompt=flux3ScenePrompt(plan);
await writeFile(join(out,'short-prompt.txt'),spatial.shortPrompt);
await writeFile(join(out,'director-prompt.txt'),spatial.directorPrompt);
await writeFile(join(out,'runtime-prompt.txt'),runtimePrompt);
await writeFile(join(out,'api-flux3-scene-prompt.txt'),apiPrompt);
await writeFile(join(out,'caption-with-boxes.txt'),spatial.captionWithBoxes);
await writeFile(join(out,'plan.json'),JSON.stringify({selectedId:plan.selectedId,concept:{title:selected.title,idea:selected.idea,environment:selected.environment,lighting:selected.lighting,camera:selected.camera},dynamics:plan.dynamics,spatial,planning:{mode:plan.planning?.mode||'local-ai',model:'authored-validated-argument',qwenClaimed:false},skipPup},null,2));

const loaded=await loadFlux3Workflow('mi2i');
// Dual identity: same high-quality packshot for both refs (packaging is the product).
const bound=bindFlux3Mi2iInputs(loaded.graph,{
 prompt:skipPup?runtimePrompt+'\n\n'+spatial.captionWithBoxes:spatial.shortPrompt+'\n\n'+spatial.captionWithBoxes,
 seed:41,
 sourceImage:'abel-green-cedar-packshot.png',
 identityImage:'abel-green-cedar-packshot.png',
 filenamePrefix:'adstudio/flux3-mi2i-green-cedar-'+stamp
});
if(skipPup&&bound['51']?.class_type==='ComfySwitchNode')bound['51'].inputs.switch=true;
else if(bound['51']?.class_type==='ComfySwitchNode')bound['51'].inputs.switch=false;

await writeFile(join(out,'bound-workflow.api.json'),JSON.stringify(bound,null,2));
await writeFile(join(out,'preflight.json'),JSON.stringify({stamp,comfy,seed:41,skipPup,graphSha:flux3CanonSha(bound),refs:'packshot×2',licenseNote:'Private internal benchmark; official CDN asset not for public redistribution without Abel permission.'},null,2));

const stats=await (await fetch(comfy+'/system_stats',{signal:AbortSignal.timeout(10000)})).json();
console.log('REMOTE',stats.devices?.[0]?.name,'comfy',stats.system?.comfyui_version,'vram_free',stats.devices?.[0]?.vram_free,'skipPup',skipPup);

async function upload(name,bytes){
 const form=new FormData();
 form.append('image',new Blob([bytes],{type:'image/png'}),name);
 form.append('overwrite','true');
 const r=await fetch(comfy+'/upload/image',{method:'POST',body:form,signal:AbortSignal.timeout(120000)});
 if(!r.ok)throw Error('upload failed '+name+' '+r.status);
 return r.json();
}
await upload('abel-green-cedar-packshot.png',packBytes);
console.log('UPLOADED packshot×2');

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
let img;
for(const node of Object.values(hist[promptId].outputs||{})){
 if(node.images?.[0]){img=node.images[0];break;}
}
if(!img)throw Error('no image in history outputs');
const view=new URL('/view',comfy);
view.searchParams.set('filename',img.filename);
if(img.subfolder)view.searchParams.set('subfolder',img.subfolder);
view.searchParams.set('type',img.type||'output');
const raw=Buffer.from(await (await fetch(view,{signal:AbortSignal.timeout(60000)})).arrayBuffer());
await writeFile(join(out,'flux3-mi2i-raw.png'),raw);

const copy=consumerCampaignCopy(input,selected,ctx);
const design=campaignDesign({...plan.composition,headline:copy.headline||'A quieter green.',body:copy.body,cta:copy.cta||'Explore',brandName:'Abel',website:'',size:'feed',background:'#1c241c',textColor:'#fffaf0'},sceneDirection(plan).archetype,'scene','composite');
const laid=campaignSVG(design,{photo:'data:image/png;base64,'+raw.toString('base64')},1080,1350);
assert.ok(!/Basic draft|mounded cracked|warm window light|open space for/i.test(laid.svg));
const ad=Buffer.from(new Resvg(laid.svg).render().asPng());
await writeFile(join(out,'advertisement.png'),ad);
const review=reviewGeneratedCampaign({design:laid.design||design,dynamics:plan.dynamics,rawNotes:['Compare bottle silhouette, cream cap, GREEN CEDAR label and frosted glass to packshot.']});
await writeFile(join(out,'visual-review.json'),JSON.stringify(review,null,2));
const report={
 stamp,elapsedMs:Date.now()-started,comfy,promptId,seed:41,skipPup,
 sha256:sha(raw),adSha256:sha(ad),identitySha256:sha(packBytes),
 concept:{title:selected.title,idea:selected.idea,environment:selected.environment},
 copy,spatialHeroBBox:spatial.elements.find(e=>e.id==='product_1').bbox,
 method:'flux3-klein-bf16-mi2i packshot×2 + Dynamics tall-bottle boxes + '+(skipPup?'directorPrompt (SKIP_PUP)':'shortPrompt→pup'),
 planningHonest:'Authored validated advertising arguments + deterministic Dynamics; Qwen Creative Director not used this run.',
 review,NOT_APPROVED_PENDING_OWNER:true,
 scorecardPlaceholder:'Fill after pixel inspection'
};
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
await writeFile(join(out,'comparison.html'),`<!doctype html><meta charset=utf-8><title>FLUX3 Green Cedar</title>
<style>body{font:16px/1.4 Georgia;background:#0e1210;color:#f3ebe1;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}img{width:100%;background:#1a1f1c}</style>
<h1>${selected.title}</h1><p>${review.verdict} · ${promptId} · skipPup=${skipPup}</p><main>
<figure><img src=source-packshot.png><figcaption>Official packshot (private benchmark)</figcaption></figure>
<figure><img src=flux3-mi2i-raw.png><figcaption>FLUX 3 mi2i raw</figcaption></figure>
<figure><img src=advertisement.png><figcaption>Composed advertisement</figcaption></figure>
</main>`);
console.log('RAW',join(out,'flux3-mi2i-raw.png'));
console.log('AD',join(out,'advertisement.png'));
console.log('SHA',report.sha256);
console.log('REVIEW',review.verdict);
process.exit(0);
