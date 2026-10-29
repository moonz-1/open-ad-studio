// CPU-only correction: recompose saved BiRefNet cutout onto deterministic empty set.
// No Klein / LTX. Uses the authorized four-cookie cutout from the prior live run.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {assembleCreativePlan,creativeContext,conceptsFromArguments} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {campaignDesign,sceneDirection,adCampaignPrompt} from '../../shared/lib/ad-scene.ts';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {productFidelityReport} from '../../shared/lib/product-fidelity.ts';
import {deterministicEmptySet,integrateProduct} from '../../shared/runtime/product-campaign.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';

const prior=resolve('outputs/creative-acceptance/2026-10-28T16-04-52/product-locked-still');
const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=resolve('outputs','creative-acceptance',stamp,'product-locked-recompose');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const sourceBytes=await readFile(join(prior,'source.png'));
const cutoutBytes=await readFile(join(prior,'cutout.png'));
const prov=JSON.parse(await readFile(resolve('outputs/hero-cutouts/722a4535fe0f9355/provenance.json'),'utf8'));
assert.equal(sha(sourceBytes),'209a46b99271245e4dee4c3865b84664097081d44c4a7b211e5b11bb7ba9e3b6');
assert.equal(prov.sourceSha256,sha(sourceBytes));
await copyFile(join(prior,'source.png'),join(out,'source.png'));
await copyFile(join(prior,'cutout.png'),join(out,'cutout.png'));
await copyFile(join(prior,'campaign-integrated.png'),join(out,'previous-klein-bg-composite.png'));
await copyFile(join(prior,'previous-failed-restage.png'),join(out,'previous-failed-restage.png'));
await copyFile(join(prior,'empty-set.png'),join(out,'previous-klein-empty-set.png'));

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
const flat={arguments:[{
 title:'The shared tray',idea:'Make the intact four-cookie tray the reason a table gathers without splitting servings.',objective:'consideration',
 audienceHypothesis:'Hosts may want one ready tray that feels like an invitation rather than four separate treats.',
 tension:'Individual cookies say little about a shared table moment; the complete tray changes the invitation.',
 businessFit:'No Crumbs Bakery sells trays of four thick chocolate chip cookies meant for sharing at the table.',
 feeling:'Warm anticipation of sitting down together, presented as a hypothesis rather than a measured claim.',
 memory:'The ridged foil tray and counted four-cookie column hold the invitation without added bakery props.',
 focus:'Four thick chocolate chip cookies overlapping in the rectangular foil tray.',
 opening:'Let warm window light graze the cracked cookie tops while the complete tray stays still.',
 payoff:'Hold the intact four-cookie tray at recognition scale before brand lettering.',
 proofId:'brand-description',proofQuote:'No Crumbs Bakery sells trays of four thick chocolate chip cookies meant for sharing at the table.'
},{
 title:'Counted generosity',idea:'Show that every guest can see four complete cookies before anyone reaches for one.',objective:'consideration',
 audienceHypothesis:'Guests may trust a visible count more than an unspecified pile of bakery items.',
 tension:'A vague bakery shot hides how many cookies are actually offered to the table.',
 businessFit:'The business description names trays of four chocolate chip cookies for sharing.',
 feeling:'Quiet confidence that the offer is concrete and fair.',
 memory:'A clear four-cookie count against calm negative space makes generosity legible.',
 focus:'All four cookies remain individually visible in the original foil tray.',
 opening:'Establish the full tray silhouette before any closer material reading.',
 payoff:'Resolve on the complete counted tray so the share size stays obvious.',
 proofId:'brand-description',proofQuote:'No Crumbs Bakery sells trays of four thick chocolate chip cookies meant for sharing at the table.'
},{
 title:'Foil on walnut',idea:'Let the ridged foil tray read as a ready table object rather than a studio prop.',objective:'consideration',
 audienceHypothesis:'People setting a casual table may notice a tray that already looks ready to place.',
 tension:'Loose cookies on a board can feel unfinished; the foil tray looks ready to serve.',
 businessFit:'Trays of four cookies are what No Crumbs Bakery sells for sharing.',
 feeling:'Ease of placing something ready-made on the table.',
 memory:'Ridged foil edges against a quiet walnut plane form a recognizable serving cue.',
 focus:'Rectangular ridged foil tray holding the four overlapping cookies.',
 opening:'Introduce the foil silhouette on a calm supporting plane with soft window falloff.',
 payoff:'Hold the ready tray so packaging and count stay truthful.',
 proofId:'brand-description',proofQuote:'No Crumbs Bakery sells trays of four thick chocolate chip cookies meant for sharing at the table.'
}]};
const plan=assembleCreativePlan(input,conceptsFromArguments(flat,input,creativeContext(input)),{planningVersion:2,mode:'local-ai',model:'authored-validated-argument',reason:'Recompose after Klein empty-set invented duplicate food.'},randomBytes(8).toString('hex').slice(0,16));
const selected=plan.concepts.find(c=>c.id===plan.selectedId);
assert.ok(plan.context.controls.exactCount,'Count lock required for deterministic empty path');

const empty=deterministicEmptySet(plan);
await writeFile(join(out,'empty-set.png'),empty.bytes);
const integrated=integrateProduct(empty.bytes,cutoutBytes,prov.box,sceneDirection(plan).archetype);
assert.equal(integrated.placement.rotation,0);
assert.equal(integrated.productLocked,true);
await writeFile(join(out,'campaign-integrated.png'),integrated.bytes);

// Pixel-level check: opaque cutout interior must survive in the composite (scaled sample).
const decode=(b,ww,hh)=>new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${ww}" height="${hh}"><image href="data:image/png;base64,${b.toString('base64')}" width="${ww}" height="${hh}"/></svg>`).render().pixels;
const cw=cutoutBytes.readUInt32BE(16),ch=cutoutBytes.readUInt32BE(20);
const cutPx=decode(cutoutBytes,cw,ch),compPx=decode(integrated.bytes,768,960);
const sx=Math.round(prov.box.x+prov.box.width/2),sy=Math.round(prov.box.y+prov.box.height*.35);
const cutI=(sy*cw+sx)*4;assert.ok(cutPx[cutI+3]>200,'Cutout sample opaque');
const dx=Math.round(integrated.placement.x+integrated.placement.width/2);
const dy=Math.round(integrated.placement.y+integrated.placement.height*.35);
const compI=(dy*768+dx)*4;assert.ok(compPx[compI+3]>200,'Composite product sample opaque');
// Restored RGB should stay close after bilinear scale (allow modest channel drift).
for(const chn of [0,1,2])assert.ok(Math.abs(compPx[compI+chn]-cutPx[cutI+chn])<48,`channel ${chn} restore drift`);

plan.composition={...plan.composition,headline:selected.title,body:selected.strategy.memory,cta:'Share the tray',brandName:'No Crumbs Bakery'};
const design=campaignDesign(plan.composition,sceneDirection(plan).archetype,'scene');
design.headline=selected.title;design.body=selected.strategy.memory;design.cta='Share the tray';design.brandName='No Crumbs Bakery';design.size='feed';
const laid=campaignSVG(design,{photo:'data:image/png;base64,'+integrated.bytes.toString('base64')},1080,1350);
const adBytes=Buffer.from(new Resvg(laid.svg).render().asPng());
await writeFile(join(out,'advertisement.png'),adBytes);
await writeFile(join(out,'advertisement.json'),JSON.stringify({design:{headline:design.headline,body:design.body,cta:design.cta,brandName:design.brandName,archetype:design.campaign?.archetype},photoBox:laid.photoBox,warnings:laid.warnings,sha256:sha(adBytes)},null,2));

const fidelity=productFidelityReport({model:'klein-integrated',fidelityMode:'product-fidelity',cutout:{sha256:sha(cutoutBytes)},sourceSha256:sha(sourceBytes),warning:'CPU recompose onto deterministic empty set'});
const report={
 stamp,method:'cpu-recompose-deterministic-empty',priorLiveDir:prior,
 cutoutJob:prov.maskJobId,box:prov.box,placement:integrated.placement,fidelity,
 selected:{title:selected.title,idea:selected.idea,memory:selected.strategy.memory},
 emptyPrompt:empty.prompt,emptyModel:empty.model,campaignPromptWouldHaveBeen:adCampaignPrompt(plan),
 gpu:{kleinBackground:0,birefnetReuse:true,priorKleinJobId:'7ed4eabc-14e7-445c-bdb7-5c9d74c37d95',ltx:0},
 pixelRestore:{sampleCutout:[cutPx[cutI],cutPx[cutI+1],cutPx[cutI+2],cutPx[cutI+3]],sampleComposite:[compPx[compI],compPx[compI+1],compPx[compI+2],compPx[compI+3]]},
 outputs:{integrated:join(out,'campaign-integrated.png'),advertisement:join(out,'advertisement.png'),empty:join(out,'empty-set.png'),comparison:join(out,'comparison.html')},
 pass:fidelity.productLocked,
 note:'Dominant defect corrected: generative empty set replaced with deterministic walnut plate; original four-cookie cutout restored. Human visual review required.'
};
const cell=(href,label)=>`<figure><img src="${href}"/><figcaption>${label}</figcaption></figure>`;
const html=`<!doctype html><meta charset="utf-8"><title>Product-locked recompose</title>
<style>body{font:16px/1.4 Georgia,serif;background:#141210;color:#f3ebe1;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}img{width:100%;max-height:680px;object-fit:contain;background:#222}code,pre{font:12px/1.35 ui-monospace,Consolas,monospace}</style>
<h1>Product-locked recompose · ${stamp}</h1>
<p>BiRefNet cutout reused · deterministic empty set · no second Klein plate · ${selected.title}</p>
<main>
${cell('source.png','Source (exactly 4 cookies)')}
${cell('previous-failed-restage.png','Failed Creative Restage')}
${cell('previous-klein-empty-set.png','Prior Klein “empty” set (invented food)')}
${cell('previous-klein-bg-composite.png','Prior composite (duplicate tray)')}
${cell('cutout.png','Saved BiRefNet cutout')}
${cell('empty-set.png','Deterministic empty set')}
${cell('campaign-integrated.png','Corrected composite')}
${cell('advertisement.png','Lettered export')}
</main><pre>${JSON.stringify(report,null,2)}</pre>`;
await writeFile(join(out,'comparison.html'),html);
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(report.pass?'PASS':'FAIL',report.note);
console.log('AD',report.outputs.advertisement);
console.log('COMPARE',report.outputs.comparison);
process.exit(report.pass?0:1);
