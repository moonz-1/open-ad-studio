// ONE bounded Creative Restage proof: product-referenced Klein scene (not cutout composite).
// Owner-authorized medium fidelity — restage cookies without locking the foil tray.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {access,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {Comfy} from '@comfyorg/sdk';
import {assembleCreativePlan,creativeContext,conceptsFromArguments} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {adScenePrompt,sceneDirection} from '../../shared/lib/ad-scene.ts';
import {campaignExecutionStrategy} from '../../shared/lib/campaign-presentation.ts';
import {renderKleinScene} from '../../shared/runtime/klein-scene.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
import {startComfyProxy} from '../../shared/runtime/proxy.ts';
import {releaseKleinCache} from '../../shared/runtime/klein-background.ts';

const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=resolve('outputs','creative-acceptance',stamp,'creative-restage-product');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const runtime=JSON.parse(await readFile(resolve('outputs/runtime-config.json'),'utf8').catch(()=>'{}'));
const modelsDir=process.env.ADSTUDIO_KLEIN_MODELS_DIR||process.env.COMFYUI_MODELS_DIR||runtime.modelsDir;
if(!modelsDir)throw Error('Configure modelsDir (runtime-config or ADSTUDIO_KLEIN_MODELS_DIR).');
const comfyUrl=process.env.COMFYUI_URL||'http://127.0.0.1:8188';
const proxyUrl=process.env.COMFY_BASE_URL||'http://127.0.0.1:8189';
process.env.COMFYUI_URL=comfyUrl;process.env.COMFY_BASE_URL=proxyUrl;

const sourceFull=resolve('outputs/creative-acceptance/2026-10-28-readiness/previous-cookie-source.png');
const productRef=resolve('outputs/creative-acceptance/2026-10-28-readiness/cookie-product-reference.png');
await access(sourceFull);await access(productRef);
const sourceBytes=await readFile(sourceFull);
const refBytes=await readFile(productRef);
assert.equal(sha(sourceBytes),'209a46b99271245e4dee4c3865b84664097081d44c4a7b211e5b11bb7ba9e3b6','Authorized four-cookie source lock');
await copyFile(sourceFull,join(out,'source-full.png'));
await copyFile(productRef,join(out,'product-reference.png'));

const native=async p=>(await fetch(comfyUrl+p,{signal:AbortSignal.timeout(5000)})).json();
const free=async()=>{await fetch(comfyUrl+'/free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unload_models:true,free_memory:true}),signal:AbortSignal.timeout(5000)}).catch(()=>{});};
await free();await new Promise(r=>setTimeout(r,1500));
const queue=await native('/queue');assert.equal((queue.queue_running?.length||0)+(queue.queue_pending?.length||0),0,'Comfy queue must be idle');
const stats=await native('/system_stats');
const d=stats.devices?.[0];
const reclaim=((d?.vram_free||0)+Math.max(0,(d?.torch_vram_total||0)-(d?.torch_vram_free||0)))/1024**3;
const ram=(stats.system?.ram_free||0)/1024**3;
assert.ok(reclaim>=6,`Need ≥6 GiB free/reclaimable VRAM for Creative Restage, have ${reclaim.toFixed(2)}`);
assert.ok(ram>=6,`Need ≥6 GiB free RAM for Creative Restage, have ${ram.toFixed(2)}`);

const brand=newBrand('No Crumbs Bakery');
brand.dna.description='No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.';
brand.dna.tone='Warm, inviting and indulgent.';
brand.dna.visualStyle='Deep cocoa, warm cream, directional window light, tactile ceramic and appetizing editorial photography.';
brand.colors=['#3b2117','#f3dfbc','#9a5528'];
brand.overrides=['name','description','tone','visualStyle'];
brand.assets=[{id:'photo',assetId:'cookie-product-ref',name:'cookie-product-reference.png',role:'product',productId:'cookie'}];
brand.products=[{id:'cookie',name:'Chocolate chip cookie',description:'Thick golden chocolate chip cookie with irregular cracked crust and visible chips.',sellingPoints:'Shareable bakery cookie',imageIds:['photo']}];

const input={
 version:1,projectId:'creative-restage-cookie',brand,
 source:{id:'cookie-product-ref',name:'cookie-product-reference.png',kind:'original',sha256:heroSha(refBytes),originalSha256:heroSha(sourceBytes),width:0,height:0},
 facts:{
  description:'One thick chocolate chip cookie: golden-brown irregular cracked crust, soft bakery height, uneven edge silhouette and visibly embedded dark chocolate chips.',
  count:1,
  arrangement:'Single cookie as the advertising hero (product subject cropped from the authorized bakery photograph; foil packaging is not the product).',
  texture:'Golden cracked baked surface, porous crumb texture and uneven chocolate chips.',
  container:'None — product is the cookie itself; original foil tray is packaging only and must not appear in the restaged photograph.',
  confirmed:true
 },
 productType:'cookies',productId:'cookie',
 request:'Premium food editorial: one recognizable thick chocolate chip cookie on an attractive ceramic plate. Professional food lighting, intentional composition, calm space for lettering. New photograph — not a background paste. No aluminum foil tray.',
 intent:'campaign',format:'feed',seed:61,
 constraints:{exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',fidelity:'medium',creativity:'high'}
};

const ctx=creativeContext(input);
assert.equal(ctx.controls.fidelity,'medium');
const flat={arguments:[{
 title:'Cookie on ceramic',
 idea:'Present one recognizable thick chocolate chip cookie as a premium table object on ceramic, inviting a quiet pause rather than a bulk tray shot.',
 objective:'consideration',
 audienceHypothesis:'Hosts may want the cookie itself to feel special enough to serve alone before thinking about a whole tray.',
 tension:'Tray packaging reads as bulk takeaway; a ceramic plate reframes the same cookie as intentional hospitality.',
 businessFit:'No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.',
 feeling:'Warm anticipation of a single indulgent bite at the table.',
 memory:'Golden cracked crust and visible chips against calm ceramic.',
 focus:'One thick chocolate chip cookie with irregular cracked crust and visible chips.',
 opening:'Establish soft window light across a ceramic plate before the cookie lands as hero.',
 payoff:'Hold the cookie at recognition scale with empty space for brand lettering.',
 proofId:'brand-description',
 proofQuote:'No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.'
},{
 title:'Texture first',
 idea:'Lead with the cracked golden crust and uneven chips so the cookie feels thick and bakery-real, not generic.',
 objective:'consideration',
 audienceHypothesis:'Buyers may trust a visible bakery texture more than a polished studio cookie.',
 tension:'Smooth stock cookies erase the irregular character that makes this product recognizable.',
 businessFit:'No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.',
 feeling:'Quiet appetite from reading real surface detail.',
 memory:'Cracked crust and uneven chips remain the recognition cue.',
 focus:'Thick chocolate chip cookie with golden cracked crust and visible chips.',
 opening:'Bring the camera close enough to read crust cracks before revealing the plate.',
 payoff:'Resolve on the whole cookie silhouette so thickness stays obvious.',
 proofId:'brand-description',
 proofQuote:'No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.'
},{
 title:'Table readiness',
 idea:'Stage the cookie as already placed for a guest rather than still in takeaway packaging.',
 objective:'consideration',
 audienceHypothesis:'People setting a table may respond to food that already looks ready to serve.',
 tension:'Foil packaging signals transport; ceramic signals arrival at the table.',
 businessFit:'No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.',
 feeling:'Ease of offering something ready and warm.',
 memory:'Cookie on ceramic with soft window light reads as ready hospitality.',
 focus:'One thick chocolate chip cookie on a calm ceramic plate.',
 opening:'Introduce the plate and light before the cookie settles as the reason to pause.',
 payoff:'Hold empty space for brand lettering beside the plated cookie.',
 proofId:'brand-description',
 proofQuote:'No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.'
}]};
const concepts=conceptsFromArguments(flat,input,ctx);
const plan=assembleCreativePlan(input,concepts,{planningVersion:2,mode:'local-ai',model:'authored-validated-argument',reason:'Owner-authorized Creative Restage proof: product identity without packaging lock.',contribution:{format:'advertising-arguments-v1',modelFields:['title','idea','strategy'],appFields:['composition','camera','environment','lighting','copy']}},randomBytes(8).toString('hex').slice(0,16));
// Force creative-restage controls (creativeContext may tighten some campaign defaults).
plan.context.controls={...plan.context.controls,fidelity:'medium',exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',creativity:'high'};
const selected=plan.concepts.find(c=>c.id===plan.selectedId);
selected.composition='Close-to-medium food editorial: one cookie centered on a round ceramic plate with calm negative space above for lettering.';
selected.camera='Slightly elevated three-quarter tabletop view, shallow depth of field, product-readable.';
selected.environment='Quiet walnut table, matte cream ceramic plate, soft window falloff, no foil trays or bakery packaging.';
selected.lighting='Warm directional window side-light with soft fill; appetizing speculars on chocolate chips; natural contact shadow on ceramic.';
selected.hierarchy='Cookie is the sole hero; plate supports; no competing food props.';
assert.equal(campaignExecutionStrategy(plan),'creative-restage');
const prompt=adScenePrompt(plan);
await writeFile(join(out,'plan.json'),JSON.stringify({selectedId:plan.selectedId,title:selected.title,idea:selected.idea,strategy:selected.strategy,execution:campaignExecutionStrategy(plan),prompt,archetype:sceneDirection(plan).archetype,controls:plan.context.controls,productReferenceSha256:sha(refBytes),sourceFullSha256:sha(sourceBytes)},null,2));

const uploadName=randomBytes(8).toString('hex')+'.png';
const outputsRoot=resolve('outputs');
await writeFile(join(outputsRoot,uploadName),refBytes);
await startComfyProxy(resolve('.'),{COMFYUI_URL:comfyUrl,COMFY_BASE_URL:proxyUrl});
const c=new Comfy();
const report={stamp,mode:'creative-restage',sourceFullSha256:sha(sourceBytes),productReferenceSha256:sha(refBytes),vramReclaimGiB:+reclaim.toFixed(2),ramFreeGiB:+ram.toFixed(2),startedAt:new Date().toISOString()};
console.log('Starting ONE Creative Restage… reclaim GiB',reclaim.toFixed(2));
const started=Date.now();
const scene=await renderKleinScene(outputsRoot,modelsDir,await native('/system_stats'),await native('/queue'),c,prompt,61,'/outputs/'+uploadName,sceneDirection(plan).archetype,comfyUrl,AbortSignal.timeout(600000),m=>console.log(' ',m));
report.elapsedMs=Date.now()-started;
report.scene={model:scene.model,fidelityMode:scene.fidelityMode,jobId:scene.jobId,provenanceId:scene.provenanceId,seconds:scene.seconds,warning:scene.warning,sourceSha256:scene.sourceSha256,sha256:scene.sha256,width:scene.width,height:scene.height};
assert.equal(scene.model,'klein-scene');
assert.equal(scene.fidelityMode,'creative-restage');
assert.equal(scene.sourceSha256,heroSha(refBytes));
assert.notEqual(scene.jobId,'deterministic-empty');

const sceneBytes=await readFile(join(outputsRoot,scene.url.slice(9)));
await writeFile(join(out,'creative-restage.png'),sceneBytes);
await writeFile(join(out,'report.json'),JSON.stringify({...report,prompt,note:'Owner visual review required. Not a commercial PASS. Foil tray must be absent; cookie recognizability is comparative only.'},null,2));
const html=`<!doctype html><meta charset="utf-8"><title>Creative Restage product proof</title>
<style>body{font:16px/1.4 Georgia,serif;background:#141210;color:#f3ebe1;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}img{width:100%;background:#222;object-fit:contain;max-height:720px}code,pre{font:13px/1.35 ui-monospace,Consolas,monospace}</style>
<h1>Creative Restage · product-referenced · ${stamp}</h1>
<p>Full source <code>${sha(sourceBytes).slice(0,16)}…</code> · product reference <code>${sha(refBytes).slice(0,16)}…</code> · model <code>${scene.model}</code> · job <code>${scene.jobId}</code> · ${report.elapsedMs} ms</p>
<main>
<figure><img src="source-full.png"/><figcaption>Authorized full source (tray packaging present)</figcaption></figure>
<figure><img src="product-reference.png"/><figcaption>Product-focused reference crop (cookie identity)</figcaption></figure>
<figure><img src="creative-restage.png"/><figcaption>Klein Creative Restage (new photograph)</figcaption></figure>
</main>
<pre>${JSON.stringify({execution:'creative-restage',scene:report.scene,warning:scene.warning},null,2)}</pre>`;
await writeFile(join(out,'comparison.html'),html);
await releaseKleinCache(scene.jobId,comfyUrl).catch(()=>{});
console.log('RAW',join(out,'creative-restage.png'));
console.log('COMPARE',join(out,'comparison.html'));
console.log('JOB',scene.jobId,'model',scene.model,'fidelity',scene.fidelityMode);
process.exit(0);
