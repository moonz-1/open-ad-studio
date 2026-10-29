// ONE controlled real Klein product-locked campaign + lettered export.
// Source: authorized four-cookie tray. No Creative Restage. No LTX.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {access,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {Comfy} from '@comfyorg/sdk';
import {assembleCreativePlan,creativeContext,conceptsFromArguments} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {campaignDesign,adCampaignPrompt,sceneDirection} from '../../shared/lib/ad-scene.ts';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {productFidelityReport} from '../../shared/lib/product-fidelity.ts';
import {renderProductCampaign} from '../../shared/runtime/product-campaign.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
import {startComfyProxy} from '../../shared/runtime/proxy.ts';

const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=resolve('outputs','creative-acceptance',stamp,'product-locked-still');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const runtime=JSON.parse(await readFile(resolve('outputs/runtime-config.json'),'utf8').catch(()=>'{}'));
const modelsDir=process.env.ADSTUDIO_KLEIN_MODELS_DIR||process.env.COMFYUI_MODELS_DIR||runtime.modelsDir;
if(!modelsDir)throw Error('Configure modelsDir (runtime-config or ADSTUDIO_KLEIN_MODELS_DIR).');
const comfyUrl=process.env.COMFYUI_URL||'http://127.0.0.1:8188';
const proxyUrl=process.env.COMFY_BASE_URL||'http://127.0.0.1:8189';
process.env.COMFYUI_URL=comfyUrl;process.env.COMFY_BASE_URL=proxyUrl;

const sourcePath=resolve('outputs/creative-acceptance/2026-10-28-readiness/previous-cookie-source.png');
const failedRestage=resolve('outputs/creative-acceptance/2026-10-28-live/campaign-raw.png');
await access(sourcePath);
const sourceBytes=await readFile(sourcePath);
assert.equal(sha(sourceBytes),'209a46b99271245e4dee4c3865b84664097081d44c4a7b211e5b11bb7ba9e3b6','Authorized four-cookie source lock');
await copyFile(sourcePath,join(out,'source.png'));
try{await copyFile(failedRestage,join(out,'previous-failed-restage.png'));}catch{/* */}

const native=async p=>(await fetch(comfyUrl+p,{signal:AbortSignal.timeout(5000)})).json();
const queue=await native('/queue');assert.equal((queue.queue_running?.length||0)+(queue.queue_pending?.length||0),0,'Comfy queue must be idle');
const stats=await native('/system_stats');
const free=((stats.devices?.[0]?.vram_free)||0)/1024**3;
assert.ok(free>=3.5,`Need ≥3.5 GiB free VRAM, have ${free.toFixed(2)}`);

const brand=newBrand('No Crumbs Bakery');
brand.dna.description='No Crumbs Bakery sells trays of four thick chocolate chip cookies meant for sharing at the table.';
brand.dna.tone='Warm, inviting and indulgent.';
brand.dna.visualStyle='Deep cocoa, warm cream, directional window light, tactile walnut and appetizing editorial photography.';
brand.colors=['#3b2117','#f3dfbc','#9a5528'];
brand.overrides=['name','description','tone','visualStyle'];
brand.assets=[{id:'photo',assetId:'cookie-source',name:'cookies.png',role:'product',productId:'tray'}];
brand.products=[{id:'tray',name:'Four-cookie tray',description:'Four thick chocolate chip cookies overlapping in one rectangular foil tray.',sellingPoints:'Shared table tray',imageIds:['photo']}];
const input={
 version:1,projectId:'product-locked-cookie',brand,
 source:{id:'cookie-source',name:'cookies.png',kind:'original',sha256:heroSha(sourceBytes),originalSha256:heroSha(sourceBytes),width:1152,height:1536},
 facts:{description:'Four thick chocolate chip cookies closely overlapping lengthwise in one rectangular foil tray.',count:4,arrangement:'Four cookies in one overlapping column along the long rectangular foil tray, all four individually visible.',texture:'Golden cracked baked surfaces and uneven visible chocolate chips.',container:'One rectangular ridged foil tray.',confirmed:true},
 productType:'cookies',productId:'tray',
 request:'Warm sharing-table bakery campaign. Keep the intact four-cookie foil tray as the reason to gather. No invented food or packaging.',
 intent:'campaign',format:'feed',seed:42,
 constraints:{exactCount:true,arrangement:'exactly',angle:'none',crop:'none',background:'replace',fidelity:'high'}
};
const ctx=creativeContext(input);
const flat={arguments:[{
 title:'The shared tray',
 idea:'Make the intact four-cookie tray the reason a table gathers without splitting servings.',
 objective:'consideration',
 audienceHypothesis:'Hosts may want one ready tray that feels like an invitation rather than four separate treats.',
 tension:'Individual cookies say little about a shared table moment; the complete tray changes the invitation.',
 businessFit:'No Crumbs Bakery sells trays of four thick chocolate chip cookies meant for sharing at the table.',
 feeling:'Warm anticipation of sitting down together, presented as a hypothesis rather than a measured claim.',
 memory:'The ridged foil tray and counted four-cookie column hold the invitation without added bakery props.',
 focus:'Four thick chocolate chip cookies overlapping in the rectangular foil tray.',
 opening:'Let warm window light graze the cracked cookie tops while the complete tray stays still.',
 payoff:'Hold the intact four-cookie tray at recognition scale before brand lettering.',
 proofId:'brand-description',
 proofQuote:'No Crumbs Bakery sells trays of four thick chocolate chip cookies meant for sharing at the table.'
},{
 title:'Counted generosity',
 idea:'Show that every guest can see four complete cookies before anyone reaches for one.',
 objective:'consideration',
 audienceHypothesis:'Guests may trust a visible count more than an unspecified pile of bakery items.',
 tension:'A vague bakery shot hides how many cookies are actually offered to the table.',
 businessFit:'The business description names trays of four chocolate chip cookies for sharing.',
 feeling:'Quiet confidence that the offer is concrete and fair.',
 memory:'A clear four-cookie count against calm negative space makes generosity legible.',
 focus:'All four cookies remain individually visible in the original foil tray.',
 opening:'Establish the full tray silhouette before any closer material reading.',
 payoff:'Resolve on the complete counted tray so the share size stays obvious.',
 proofId:'brand-description',
 proofQuote:'No Crumbs Bakery sells trays of four thick chocolate chip cookies meant for sharing at the table.'
},{
 title:'Foil on walnut',
 idea:'Let the ridged foil tray read as a ready table object rather than a studio prop.',
 objective:'consideration',
 audienceHypothesis:'People setting a casual table may notice a tray that already looks ready to place.',
 tension:'Loose cookies on a board can feel unfinished; the foil tray looks ready to serve.',
 businessFit:'Trays of four cookies are what No Crumbs Bakery sells for sharing.',
 feeling:'Ease of placing something ready-made on the table.',
 memory:'Ridged foil edges against a quiet walnut plane form a recognizable serving cue.',
 focus:'Rectangular ridged foil tray holding the four overlapping cookies.',
 opening:'Introduce the foil silhouette on a calm supporting plane with soft window falloff.',
 payoff:'Hold the ready tray so packaging and count stay truthful.',
 proofId:'brand-description',
 proofQuote:'No Crumbs Bakery sells trays of four thick chocolate chip cookies meant for sharing at the table.'
}]};
const concepts=conceptsFromArguments(flat,input,ctx);
const plan=assembleCreativePlan(input,concepts,{planningVersion:2,mode:'local-ai',model:'authored-validated-argument',reason:'Owner-validated marketing argument for product-locked still acceptance; photographic direction compiled by the app.',contribution:{format:'advertising-arguments-v1',modelFields:['title','idea','strategy'],appFields:['composition','camera','environment','lighting','copy']}},randomBytes(8).toString('hex').slice(0,16));
const selected=plan.concepts.find(c=>c.id===plan.selectedId);
plan.composition={...plan.composition,headline:selected.title,body:selected.strategy.memory,cta:'Share the tray',brandName:'No Crumbs Bakery'};
await writeFile(join(out,'plan.json'),JSON.stringify({selectedId:plan.selectedId,title:selected.title,idea:selected.idea,strategy:selected.strategy,prompt:adCampaignPrompt(plan),archetype:sceneDirection(plan).archetype},null,2));

const uploadName=randomBytes(8).toString('hex')+'.png';
const outputsRoot=resolve('outputs');
await writeFile(join(outputsRoot,uploadName),sourceBytes);
await startComfyProxy(resolve('.'),{COMFYUI_URL:comfyUrl,COMFY_BASE_URL:proxyUrl});
const c=new Comfy();
const report={stamp,sourceSha256:sha(sourceBytes),modelsDirConfigured:true,vramFreeGiB:+free.toFixed(2),startedAt:new Date().toISOString()};
const started=Date.now();
console.log('Starting ONE product-locked campaign… free GiB',free.toFixed(2));
const scene=await renderProductCampaign(outputsRoot,modelsDir,await native('/system_stats'),await native('/queue'),c,plan,'/outputs/'+uploadName,comfyUrl,AbortSignal.timeout(600000),m=>console.log(' ',m));
report.elapsedMs=Date.now()-started;
report.scene={model:scene.model,fidelityMode:scene.fidelityMode,jobId:scene.jobId,provenanceId:scene.provenanceId,seconds:scene.seconds,warning:scene.warning,placement:scene.placement,cutoutMethod:scene.cutout?.method,sourceSha256:scene.sourceSha256};
const fidelity=productFidelityReport(scene);
report.fidelity=fidelity;
assert.equal(fidelity.productLocked,true,fidelity.reason);
assert.equal(scene.model,'klein-integrated');
assert.equal(scene.sourceSha256,heroSha(sourceBytes));

const sceneBytes=await readFile(join(outputsRoot,scene.url.slice(9)));
await writeFile(join(out,'campaign-integrated.png'),sceneBytes);
if(scene.background)await copyFile(join(outputsRoot,scene.background.url.slice(9)),join(out,'empty-set.png'));
if(scene.cutout)await copyFile(join(outputsRoot,scene.cutout.url.slice(9)),join(out,'cutout.png'));
if(scene.preHarmonize)await copyFile(join(outputsRoot,scene.preHarmonize.url.slice(9)),join(out,'pre-harmonize.png'));

const design=campaignDesign(plan.composition,scene.archetype,'scene');
design.headline=selected.title;design.body=selected.strategy.memory;design.cta='Share the tray';design.brandName='No Crumbs Bakery';design.size='feed';
const photoData='data:image/png;base64,'+sceneBytes.toString('base64');
const laid=campaignSVG(design,{photo:photoData},1080,1350);
const adBytes=Buffer.from(new Resvg(laid.svg).render().asPng());
await writeFile(join(out,'advertisement.png'),adBytes);
await writeFile(join(out,'advertisement.json'),JSON.stringify({design,photoBox:laid.photoBox,warnings:laid.warnings,sha256:sha(adBytes),width:laid.width,height:laid.height},null,2));

// Comparison sheet: source | failed restage | product-locked | lettered export
const failedBytes=await readFile(failedRestage).catch(()=>null);
const cell=(href,label)=>`<figure><img src="${href}"/><figcaption>${label}</figcaption></figure>`;
const html=`<!doctype html><meta charset="utf-8"><title>Product-locked still acceptance</title>
<style>body{font:16px/1.4 Georgia,serif;background:#141210;color:#f3ebe1;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}img{width:100%;background:#222;object-fit:contain;max-height:720px}code,pre{font:13px/1.35 ui-monospace,Consolas,monospace}</style>
<h1>Product-locked still · ${stamp}</h1>
<p>Source lock sha256 <code>${sha(sourceBytes).slice(0,16)}…</code> · model <code>${scene.model}</code> · ${report.elapsedMs} ms · ${fidelity.reason}</p>
<main>
${cell('source.png','Authorized source (exactly 4 cookies)')}
${failedBytes?cell('previous-failed-restage.png','Previous failed Creative Restage (3 cookies)'):''}
${cell('campaign-integrated.png','Product-locked composite (restored cutout + empty set)')}
${cell('advertisement.png','Lettered export')}
${cell('cutout.png','Isolated cutout')}
${cell('empty-set.png','Generated empty set')}
</main>
<pre>${JSON.stringify({selected:{title:selected.title,idea:selected.idea,memory:selected.strategy.memory},fidelity,scene:report.scene},null,2)}</pre>`;
await writeFile(join(out,'comparison.html'),html);
report.pass=fidelity.productLocked&&scene.model==='klein-integrated'&&!!scene.cutout;
report.outputs={source:join(out,'source.png'),integrated:join(out,'campaign-integrated.png'),advertisement:join(out,'advertisement.png'),comparison:join(out,'comparison.html')};
report.note=report.pass?'Product-locked still delivered with restored cutout; human visual review still required for count/edges/quality.':'Fidelity gate failed.';
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(report.pass?'PASS':'FAIL',report.note);
console.log('AD:',report.outputs.advertisement);
console.log('COMPARE:',report.outputs.comparison);
process.exit(report.pass?0:1);
