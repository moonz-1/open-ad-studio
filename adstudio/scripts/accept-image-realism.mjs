// CPU-only: perspective-aware editorial original + consumer copy. No GPU.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {copyFile,mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {assembleCreativePlan,creativeContext,conceptsFromArguments,consumerCampaignCopy,fallbackConcepts,isInternalAdCopy} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {campaignDesign,sceneDirection} from '../../shared/lib/ad-scene.ts';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {productFidelityReport} from '../../shared/lib/product-fidelity.ts';
import {campaignExecutionStrategy,preferDeterministicEmpty,presentationMode,sourceViewpoint} from '../../shared/lib/campaign-presentation.ts';
import {fitEditorialOriginal} from '../../shared/runtime/product-campaign.ts';
import {adCampaignPrompt} from '../../shared/lib/ad-scene.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';

const mainRoot=resolve('C:<home>/open-ad-studio');
const prior=join(mainRoot,'outputs/creative-acceptance/2026-10-28T16-04-52/product-locked-still');
const priorAbel=join(mainRoot,'outputs/creative-acceptance/2026-10-28T16-32-25/blind-journey-fragrance');
const priorRealism=join(mainRoot,'outputs/creative-acceptance');
const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=resolve('outputs','creative-acceptance',stamp,'image-quality-correction');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');

await access(join(prior,'source.png'));
const sourceBytes=await readFile(join(prior,'source.png'));
assert.equal(sha(sourceBytes),'209a46b99271245e4dee4c3865b84664097081d44c4a7b211e5b11bb7ba9e3b6');
await copyFile(join(prior,'source.png'),join(out,'source.png'));
await copyFile(join(prior,'advertisement.png'),join(out,'before-cookie-floating.png'));
try{await copyFile(join(priorAbel,'advertisement.png'),join(out,'before-abel.png'));}catch{/* */}

const brand=newBrand('No Crumbs Bakery');
brand.dna.description='No Crumbs Bakery sells trays of four thick chocolate chip cookies meant for sharing at the table.';
brand.dna.tone='Warm, inviting and indulgent.';
brand.dna.visualStyle='Deep cocoa, warm cream, directional window light, tactile walnut and appetizing editorial photography.';
brand.dna.messaging='Leave Nothing Behind';
brand.colors=['#3b2117','#f3dfbc','#9a5528'];
brand.overrides=['name','description','tone','visualStyle','messaging'];
brand.assets=[{id:'photo',assetId:'cookie-source',name:'cookies.png',role:'product',productId:'tray'}];
brand.products=[{id:'tray',name:'Four-cookie tray',description:'Four thick chocolate chip cookies overlapping in one rectangular foil tray.',sellingPoints:'Shared table tray',imageIds:['photo']}];

const input={version:1,projectId:'image-quality-cookie',brand,source:{id:'cookie-source',name:'cookies.png',kind:'original',sha256:heroSha(sourceBytes),originalSha256:heroSha(sourceBytes),width:1152,height:1536},facts:{description:'Four thick chocolate chip cookies closely overlapping lengthwise in one rectangular foil tray, photographed from overhead.',count:4,arrangement:'Four cookies in one overlapping column along the long rectangular foil tray, all four individually visible.',texture:'Golden cracked baked surfaces and uneven visible chocolate chips.',container:'One rectangular ridged foil tray.',confirmed:true},productType:'cookies',productId:'tray',request:'Warm sharing-table bakery campaign.',intent:'campaign',format:'feed',seed:42,constraints:{exactCount:true,arrangement:'exactly',angle:'none',crop:'none',background:'replace',fidelity:'high'}};

const flat={arguments:[{title:'The shared tray',idea:'Make the intact four-cookie tray the reason a table gathers without splitting servings.',objective:'consideration',audienceHypothesis:'Hosts may want one ready tray that feels like an invitation rather than four separate treats.',tension:'Individual cookies say little about a shared table moment; the complete tray changes the invitation.',businessFit:'No Crumbs Bakery sells trays of four thick chocolate chip cookies meant for sharing at the table.',feeling:'Warm anticipation of sitting down together.',memory:'The ridged foil tray and counted four-cookie column hold the invitation without added bakery props.',focus:'Four thick chocolate chip cookies overlapping in the rectangular foil tray.',opening:'Let warm window light graze the cracked cookie tops while the complete tray stays still.',payoff:'Hold the intact four-cookie tray at recognition scale before brand lettering.',proofId:'brand-description',proofQuote:'No Crumbs Bakery sells trays of four thick chocolate chip cookies meant for sharing at the table.'},{title:'Counted generosity',idea:'Show that every guest can see four complete cookies before anyone reaches for one.',objective:'consideration',audienceHypothesis:'Guests may trust a visible count more than an unspecified pile.',tension:'A vague bakery shot hides how many cookies are actually offered.',businessFit:'The business description names trays of four chocolate chip cookies for sharing.',feeling:'Quiet confidence that the offer is concrete and fair.',memory:'A clear four-cookie count against calm negative space makes generosity legible.',focus:'All four cookies remain individually visible in the original foil tray.',opening:'Establish the full tray silhouette before any closer material reading.',payoff:'Resolve on the complete counted tray so the share size stays obvious.',proofId:'brand-description',proofQuote:'No Crumbs Bakery sells trays of four thick chocolate chip cookies meant for sharing at the table.'},{title:'Foil on walnut',idea:'Let the ridged foil tray read as a ready table object rather than a studio prop.',objective:'consideration',audienceHypothesis:'People setting a casual table may notice a tray that already looks ready to place.',tension:'Loose cookies on a board can feel unfinished; the foil tray looks ready to serve.',businessFit:'Trays of four cookies are what No Crumbs Bakery sells for sharing.',feeling:'Ease of placing something ready-made on the table.',memory:'Ridged foil edges against a quiet walnut plane form a recognizable serving cue.',focus:'Rectangular ridged foil tray holding the four overlapping cookies.',opening:'Introduce the foil silhouette on a calm supporting plane with soft window falloff.',payoff:'Hold the ready tray so packaging and count stay truthful.',proofId:'brand-description',proofQuote:'No Crumbs Bakery sells trays of four thick chocolate chip cookies meant for sharing at the table.'}]};

const ctx=creativeContext(input);
const plan=assembleCreativePlan(input,conceptsFromArguments(flat,input,ctx),{planningVersion:2,mode:'local-ai',model:'authored-validated-argument',reason:'Image quality correction — editorial original'},randomBytes(8).toString('hex').slice(0,16));

assert.equal(sourceViewpoint(input),'overhead');
assert.equal(campaignExecutionStrategy(plan),'product-locked-generative');
assert.equal(preferDeterministicEmpty(plan,true),false);
assert.equal(presentationMode(plan),'flat-lay-composite');
assert.equal(plan.composition.campaign.presentation,'composite');
assert.match(adCampaignPrompt(plan),/overhead|flat-lay|top-down/i);
assert.equal(plan.composition.headline,'Leave Nothing Behind');
assert.ok(!isInternalAdCopy(plan.composition.headline));
assert.ok(!isInternalAdCopy(plan.composition.body||''));
assert.ok(!/counted four-cookie|strategy\.memory|shared tray/i.test(plan.composition.headline+' '+plan.composition.body));
assert.ok(ctx.copyOptions.some(o=>o.id==='messaging'));

const selected=plan.concepts.find(c=>c.id===plan.selectedId);
const copy=consumerCampaignCopy(input,selected,ctx);
assert.equal(copy.headline,'Leave Nothing Behind');
assert.ok(!/ridged foil tray and counted/i.test(copy.body));

// Product-safe lettering remains available as fallback (not the generative path).
const sourceUri='data:image/png;base64,'+sourceBytes.toString('base64');
const fitted=fitEditorialOriginal({data:sourceUri,width:1152,height:1536});
assert.equal(fitted.productLocked,true);
await writeFile(join(out,'product-safe-fallback-plate.png'),fitted.bytes);

const design=campaignDesign({...plan.composition,campaign:{...plan.composition.campaign,presentation:'editorial-original'}},sceneDirection(plan).archetype,'scene','editorial-original');
design.headline=plan.composition.headline;
design.body=plan.composition.body;
design.cta=plan.composition.cta||'';
design.brandName='No Crumbs Bakery';
design.size='feed';
const laid=campaignSVG(design,{photo:'data:image/png;base64,'+fitted.bytes.toString('base64')},1080,1350);
const adBytes=Buffer.from(new Resvg(laid.svg).render().asPng());
await writeFile(join(out,'product-safe-fallback-advertisement.png'),adBytes);

const fidelity=productFidelityReport({model:'editorial-original',fidelityMode:'product-fidelity',sourceSha256:sha(sourceBytes),warning:'product-safe-fallback'});
assert.equal(fidelity.productLocked,true);
assert.equal(fidelity.hasCutout,false);

// Second category (fragrance / packaged-goods): planning + layout only — eye-level may composite.
const fragBrand=newBrand('Abel');
fragBrand.dna.description='Abel creates refined fragrances in frosted glass bottles.';
fragBrand.dna.tone='Quiet, mineral, considered.';
fragBrand.dna.visualStyle='Cool stone, soft linen, mineral light.';
fragBrand.dna.messaging='A quiet presence.';
fragBrand.colors=['#e8eef1','#9aa7b0','#3a4a55'];
fragBrand.overrides=['name','description','tone','visualStyle','messaging'];
fragBrand.assets=[{id:'photo',assetId:'frag-source',name:'bottle.png',role:'product',productId:'bottle'}];
fragBrand.products=[{id:'bottle',name:'Fragrance bottle',description:'One frosted glass perfume bottle with a silver cap.',sellingPoints:'Sculptural presence',imageIds:['photo']}];
const fragInput={version:1,projectId:'image-quality-frag',brand:fragBrand,source:{id:'frag-source',name:'bottle.png',kind:'original',sha256:'a'.repeat(64),originalSha256:'a'.repeat(64),width:800,height:1000},facts:{description:'One frosted glass perfume bottle with a silver cap, standing upright at eye level.',count:1,arrangement:'Standing alone, front-facing hero bottle.',texture:'Frosted glass',container:'Glass bottle with silver cap',confirmed:true},productType:'packaged-goods',productId:'bottle',request:'Coastal mineral beauty campaign',intent:'campaign',format:'feed',seed:7,constraints:{exactCount:true,arrangement:'exactly',angle:'slight',crop:'moderate',background:'replace',fidelity:'high'}};
const fragCtx=creativeContext(fragInput);
const fragPlan=assembleCreativePlan(fragInput,fallbackConcepts(fragInput,fragCtx),{mode:'deterministic',reason:'layout-only fragrance check',model:'None'},'f'.repeat(16));
assert.equal(sourceViewpoint(fragInput),'eye-level');
assert.equal(campaignExecutionStrategy(fragPlan),'product-locked-generative');
assert.equal(presentationMode(fragPlan),'perspective-composite');
assert.equal(fragPlan.composition.campaign.presentation,'composite');
assert.equal(fragPlan.composition.headline,'A quiet presence.');
assert.ok(fragPlan.layout.photoBox.width>0);
await writeFile(join(out,'fragrance-layout.json'),JSON.stringify({viewpoint:sourceViewpoint(fragInput),execution:campaignExecutionStrategy(fragPlan),presentation:presentationMode(fragPlan),headline:fragPlan.composition.headline,body:fragPlan.composition.body,archetype:fragPlan.composition.campaign.archetype,photoBox:fragPlan.layout.photoBox},null,2));

const report={
 stamp,
 method:'product-locked-generative-path-restored',
 defectCorrected:'Fidelity locks no longer force editorial posters or deterministic SVG as the primary path; AI empty-set preferred',
 execution:campaignExecutionStrategy(plan),
 presentation:presentationMode(plan),
 viewpoint:sourceViewpoint(input),
 emptySetPromptPreview:adCampaignPrompt(plan).slice(0,240),
 copy:{headline:plan.composition.headline,body:plan.composition.body,cta:plan.composition.cta},
 fragrance:{viewpoint:sourceViewpoint(fragInput),execution:campaignExecutionStrategy(fragPlan),headline:fragPlan.composition.headline},
 fidelity,
 gpu:0,
 visualAcceptance:'OWNER_DECIDES — this script only checks structural routing, not commercial quality',
 pass:campaignExecutionStrategy(plan)==='product-locked-generative'&&preferDeterministicEmpty(plan,true)===false&&plan.composition.headline==='Leave Nothing Behind'
};
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(report.pass?'PASS_STRUCTURAL_ROUTING':'FAIL',report.defectCorrected);
console.log('EXECUTION',report.execution);
console.log('COPY',report.copy);
process.exit(report.pass?0:1);
