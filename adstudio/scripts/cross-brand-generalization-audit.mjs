#!/usr/bin/env node
/** Cross-brand generalization audit — CPU only, shared production path.
 * DISCLOSURE: Does not claim advertising-quality visuals. No RunPod / no vision model.
 * Distinguishes image observations (pixels) from owner facts/inferences and unavailable VLM. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {newBrand} from '../../shared/lib/brand.ts';
import {signalsFromBrand} from '../../shared/lib/product-brief.ts';
import {assembleCreativePlan,creativeContext,conceptsFromArguments} from '../../shared/lib/creative-engine.ts';
import {buildCompositionPlan} from '../../shared/lib/composition-dynamics.ts';
import {dynamicsToFlux3Spatial} from '../../shared/lib/flux3-spatial.ts';
import {buildProductIdentityProfile} from '../../shared/lib/product-identity-profile.ts';
import {verifyProductIdentity} from '../../shared/lib/product-identity-verify.ts';
import {evaluateFramingQuality} from '../../shared/lib/framing-quality.ts';
import {reviewGeneratedCampaign} from '../../shared/lib/creative-visual-review.ts';
import {campaignDesign} from '../../shared/lib/ad-scene.ts';
import {selectGraphicStrategy,withGraphicGeometry} from '../../shared/lib/graphic-art-director.ts';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {hintsFromPngBytes} from '../../shared/lib/png-luma.ts';
import {resvgFontOptions} from '../../shared/lib/ad-fonts.ts';

const root=resolve('.');
const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=join(root,'outputs','creative-acceptance',stamp,'cross-brand-generalization');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const png=svg=>Buffer.from(new Resvg(svg).render().asPng());
const fonts=resvgFontOptions();

/** Original synthetic electronics reference — authored for this audit, not a third-party likeness. */
const speakerSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900">
 <rect width="900" height="900" fill="#0e1216"/>
 <rect x="290" y="180" width="320" height="520" rx="28" fill="#1a3a5c"/>
 <rect x="320" y="220" width="260" height="260" rx="130" fill="#0a1622"/>
 <circle cx="450" cy="350" r="70" fill="#24384c"/>
 <rect x="340" y="520" width="220" height="28" rx="6" fill="#c8d2dc"/>
 <rect x="370" y="570" width="160" height="14" rx="4" fill="#6a7a8a"/>
</svg>`;
const speakerRef=png(speakerSvg);
await writeFile(join(out,'FIELD-AUDIO-speaker-SYNTHETIC-REFERENCE.png'),speakerRef);
await writeFile(join(out,'FIELD-AUDIO-DISCLOSURE.json'),JSON.stringify({
 kind:'original-synthetic-reference',
 not:'photograph-of-commercial-product',
 notAdvertisingAcceptance:true,
 purpose:'Third previously-unoptimized category (refined electronics) for CPU generalization audit',
 legal:'Original SVG authored for Open Ad Studio tests; no third-party likeness'
},null,2));

const abelRef=await readFile(join(root,'outputs/fixtures/abel/green-cedar.png'));
const cookieRef=await readFile(join(root,'outputs/creative-acceptance/2026-10-28-readiness/cookie-product-reference.png'));
let abelClipped;try{abelClipped=await readFile(join(root,'outputs/creative-acceptance/2026-10-29T15-31-40/flux3-green-cedar/flux3-mi2i-raw.png'));}catch{abelClipped=null;}
let cookieGen;try{cookieGen=await readFile(join(root,'outputs/creative-acceptance/2026-10-29T13-34-04/flux3-mi2i-leave-nothing/flux3-mi2i-raw.png'));}catch{cookieGen=null;}

const distortedTall=()=>png(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#111"/><rect x="150" y="40" width="100" height="300" rx="12" fill="#d5cfc0"/></svg>`);
const clippedRight=()=>png(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#111"/><rect x="250" y="120" width="160" height="200" rx="12" fill="#d5cfc0"/></svg>`);
const tinyProduct=()=>png(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#1a1f18"/><rect x="170" y="280" width="60" height="70" rx="6" fill="#d5cfc0"/></svg>`);
const wellFramed=(fill='#d5cfc0')=>png(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#141814"/><rect x="100" y="140" width="200" height="240" rx="14" fill="${fill}"/></svg>`);

function brandCase(cfg){
 const brand=newBrand(cfg.brandName);
 Object.assign(brand.dna,cfg.dna);
 brand.colors=cfg.colors;
 brand.overrides=['name','description','tone','visualStyle','messaging'];
 brand.assets=[{id:'photo',assetId:cfg.productId,name:cfg.refName,role:'product',productId:cfg.productId}];
 brand.products=[{id:cfg.productId,name:cfg.productName,description:cfg.productDescription,sellingPoints:cfg.sellingPoints,imageIds:['photo']}];
 return brand;
}

/** Same authored-argument shape for every brand — content from owner facts, not hand-tuned rescue prompts. */
function flatArguments(input,quote){
 const name=input.brand.dna.name;
 const product=input.facts.description;
 return {arguments:[
  {title:'Recognition first',idea:`Argue for consideration by keeping ${product} unmistakable while the set supports brand tone.`,objective:'consideration',audienceHypothesis:'Customers respond when the real product remains recognizable.',tension:'Generic stock sets erase product identity.',businessFit:quote,feeling:'Clear recognition.',memory:`${product} held in a calm brand-compatible set.`,focus:product,opening:'Establish quiet negative space, then land the product.',payoff:'Hold authentic product with lettering room.',proofId:'brand-description',proofQuote:quote},
  {title:'Material reading',idea:`Argue for intimacy through observed material of ${product} without inventing claims.`,objective:'consideration',audienceHypothesis:'Buyers lean into tactile materials when identity stays exact.',tension:'Wide lifestyle sets steal focus.',businessFit:quote,feeling:'Quiet curiosity.',memory:'Close material reading with open type field.',focus:product,opening:'Graze light across observed surfaces.',payoff:'Resolve on product recognition.',proofId:'brand-description',proofQuote:quote},
  {title:'Editorial calm',idea:`Argue for editorial calm around ${name}: open space for lettering; silhouette remains the only subject.`,objective:'consideration',audienceHypothesis:'Editorial shoppers want quiet space around the object.',tension:'Busy sets erase the product.',businessFit:quote,feeling:'Editorial calm.',memory:'Product alone with soft depth.',focus:product,opening:'Broad soft key, then product.',payoff:'Open field for brand lettering.',proofId:'brand-description',proofQuote:quote}
 ]};
}

const cases=[
 {
  id:'abel-green-cedar',
  category:'short/wide perfume packaging',
  refKind:'private-packshot-png',
  refBytes:abelRef,
  refName:'green-cedar.png',
  brandName:'Abel',
  productId:'green-cedar',
  productName:'Green Cedar',
  productDescription:'Aromatic wood eau de parfum in frosted glass.',
  sellingPoints:'Complex, singular, grounding.',
  dna:{description:'Abel creates high-performance natural eau de parfum. Green Cedar: a vibrant aromatic wood.',tone:'Quiet, considered, natural luxury.',visualStyle:'Soft mineral and cedar light, frosted glass, architectural stillness.',messaging:'A quieter green.'},
  colors:['#f6eada','#1c241c'],
  facts:{description:'SHORT BROAD frosted Green Cedar bottle',count:1,arrangement:'Single bottle',texture:'Frosted glass',container:'Bottle',confirmed:true},
  productType:'packaged-goods',
  request:'Luxury woody editorial with full bottle in frame and quiet lettering space',
  foodIrregular:false,
  categoryHint:'fragrance-bottle',
  expectSilhouette:['squat-wide','near-square'],
  expectLaneHint:/refreshing-scent|general/,
  expectScale:'dominant',
  expectStrategy:/editorial-luxury|architectural-minimal|contemporary-luxury|refined-product/,
  realClipped:abelClipped,
  realGen:null
 },
 {
  id:'no-crumbs-bakery',
  category:'irregular real food geometry',
  refKind:'owner-product-reference-png',
  refBytes:cookieRef,
  refName:'cookie-product-reference.png',
  brandName:'No Crumbs Bakery',
  productId:'cookie',
  productName:'Chocolate chip cookie',
  productDescription:'Thick irregular handmade chocolate chip cookie.',
  sellingPoints:'Leave nothing behind.',
  dna:{description:'No Crumbs Bakery bakes thick irregular chocolate chip cookies meant to be finished.',tone:'Warm, inviting and playful.',visualStyle:'Warm cream, cocoa and cracked crust texture.',messaging:'Leave Nothing Behind'},
  colors:['#f5e7c4','#321a12'],
  facts:{description:'One thick irregular chocolate chip cookie with cracked crust and uneven chunks',count:1,arrangement:'Single cookie',texture:'Cracked crust, uneven chocolate chunks',container:'None — cookie is the product',confirmed:true},
  productType:'cookies',
  request:'Warm bakery editorial; full cookie in frame with open lettering space',
  foodIrregular:true,
  categoryHint:'cookie',
  expectSilhouette:['compact-irregular','squat-wide','near-square'],
  expectLaneHint:/indulgent-food/,
  expectScale:'dominant',
  expectStrategy:/refined-product|playful-expressive|food|editorial/,
  realClipped:null,
  realGen:cookieGen
 },
 {
  id:'field-audio-speaker',
  category:'refined electronics (previously unoptimized)',
  refKind:'original-synthetic-svg-png',
  refBytes:speakerRef,
  refName:'FIELD-AUDIO-speaker-SYNTHETIC-REFERENCE.png',
  brandName:'Field Audio',
  productId:'desktop-speaker',
  productName:'Field Speaker',
  productDescription:'Compact desktop speaker with circular driver and aluminium baffle.',
  sellingPoints:'Clear desk presence.',
  dna:{description:'Field Audio makes compact desktop speakers for focused workspaces.',tone:'Precise, calm and functional.',visualStyle:'Cool mineral tones, aluminium and quiet geometry.',messaging:'Sound that stays on the desk.'},
  colors:['#dce4e7','#142a35'],
  facts:{description:'One compact blue desktop speaker with circular driver',count:1,arrangement:'Single upright speaker',texture:'Matte blue housing, aluminium accents',container:'The speaker is the product',confirmed:true},
  productType:'other',
  request:'Precise product photograph; full speaker in frame with calm lettering column',
  foodIrregular:false,
  categoryHint:'electronics-speaker',
  expectSilhouette:['tall-narrow','near-square'],
  expectLaneHint:/refined-object|athletic-energy|general/,
  expectScale:'dominant',
  expectStrategy:/architectural-minimal|contemporary-luxury|refined-product/,
  realClipped:null,
  realGen:null
 }
];

const capabilities=[
 'brand_product_evidence_extraction',
 'product_identity_profile',
 'reference_selection_contract',
 'geometry_framing_instructions',
 'photographic_composition_camera',
 'copy_safe_product_safe_regions',
 'graphic_layout_selection',
 'quality_gate_blocks_distortion',
 'quality_gate_blocks_clip',
 'quality_gate_blocks_tiny',
 'vision_language_observations',
 'live_flux_generalization',
 'advertising_visual_quality'
];

const matrix={};for(const c of capabilities)matrix[c]={};
const reports=[];

for(const cfg of cases){
 const row={id:cfg.id,category:cfg.category,refKind:cfg.refKind,observations:{},inferences:{},unavailable:[],results:{}};
 const brand=brandCase(cfg);
 const signals=signalsFromBrand(brand,cfg.productId);
 row.results.brand_product_evidence_extraction=
  signals.name===cfg.brandName&&signals.signals.length>=2&&signals.product?.name===cfg.productName?'PASS':'FAIL';
 row.observations.brandSignals=signals.signals.map(s=>({field:s.field,status:s.status,chars:s.text.length}));
 row.inferences={note:'Brand DNA is owner/user overrides in this audit — not live website extraction.'};

 // Identity from pixels
 const profile=buildProductIdentityProfile(cfg.refBytes,{
  kind:cfg.refKind.includes('synthetic')?'packshot':'packshot',
  categoryHint:cfg.categoryHint,
  foodIrregular:cfg.foodIrregular,
  sha256:sha(cfg.refBytes)
 });
 const sil=profile?.geometry.silhouetteClass;
 const idOk=profile&&profile.geometry.confidence>=0.28&&cfg.expectSilhouette.includes(sil);
 row.results.product_identity_profile=idOk?'PASS':'FAIL';
 row.observations.identity={
  silhouetteClass:sil,
  aspectWH:profile?.geometry.aspectWH,
  bodyAspectWH:profile?.geometry.bodyAspectWH,
  confidence:profile?.geometry.confidence,
  coverage:profile?.geometry.coverage,
  bbox:profile?.geometry.bbox,
  visionLanguage:profile?.visionLanguage,
  materialsNote:profile?.materials?.notes?.[0],
  method:profile?.geometry.method
 };
 row.unavailable.push('Vision-language product observations (VLM not wired)');

 // Reference selection contract (asset role + product imageIds) — structural, same code path
 const refOk=brand.assets[0]?.role==='product'&&brand.products[0]?.imageIds.includes('photo');
 row.results.reference_selection_contract=refOk?'PASS':'FAIL';

 const quote=brand.dna.description;
 const input={
  version:1,projectId:'xbrand-'+cfg.id,brand,
  source:{id:cfg.productId,name:cfg.refName,kind:'original',sha256:sha(cfg.refBytes),originalSha256:sha(cfg.refBytes),width:0,height:0},
  facts:cfg.facts,productType:cfg.productType,productId:cfg.productId,request:cfg.request,
  intent:'campaign',format:'feed',seed:11,
  constraints:{exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',fidelity:'medium',creativity:'high'}
 };
 const ctx=creativeContext(input);
 const plan=assembleCreativePlan(input,conceptsFromArguments(flatArguments(input,quote),input,ctx),{
  planningVersion:2,mode:'local-ai',model:'authored-validated-argument',
  reason:'cross-brand generalization audit (authored args; not live Qwen)',
  contribution:{format:'advertising-arguments-v1',modelFields:['title','idea'],appFields:['dynamics']}
 },'a'.repeat(16));
 const dynamics=plan.dynamics||buildCompositionPlan(plan);
 const spatial=dynamicsToFlux3Spatial(dynamics,{
  environment:plan.concepts.find(c=>c.id===plan.selectedId)?.environment,
  identity:profile
 });

 const geoInstr=/FULL PRODUCT IN FRAME|full product|PRODUCT SCALE|identity|silhouette|proportion/i.test(spatial.directorPrompt);
 row.results.geometry_framing_instructions=geoInstr?'PASS':'FAIL';
 const camOk=!!dynamics.camera?.viewpoint&&!!dynamics.light?.key&&!!dynamics.layout?.framingMode;
 const scaleOk=dynamics.layout?.productScale===cfg.expectScale;
 row.results.photographic_composition_camera=(camOk&&scaleOk)?'PASS':'FAIL';
 const zonesOk=dynamics.layout?.productSafe?.width>0.3&&dynamics.layout?.copySafe?.width>0.2
  &&dynamics.layout.productSafe.height>=0.48;
 row.results.copy_safe_product_safe_regions=zonesOk?'PASS':'FAIL';

 const design=withGraphicGeometry(campaignDesign({
  version:1,id:cfg.id,name:cfg.id,brandId:brand.id,brandRevision:1,brandReviewed:true,photoId:'scene',photoConfirmed:true,
  concept:'editorial',size:'feed',brandName:cfg.brandName,headline:cfg.dna.messaging||cfg.productName,
  body:cfg.sellingPoints,cta:'',website:'',background:cfg.colors[1]||'#111',accent:cfg.colors[0]||'#ccc',textColor:'#fffaf0'
 },cfg.productType==='cookies'?'food-editorial':cfg.categoryHint.includes('fragrance')?'beauty-sensory':'material-study','scene','composite',{strategy:'auto'}),spatial.elements);
 const strategy=selectGraphicStrategy(design,{tone:brand.dna.tone,idea:plan.concepts[0]?.idea,title:plan.concepts[0]?.title});
 row.results.graphic_layout_selection=cfg.expectStrategy.test(strategy)?'PASS':'FAIL';
 row.observations.composition={
  productScale:dynamics.layout.productScale,
  placementBias:dynamics.layout.placementBias,
  framingMode:dynamics.layout.framingMode,
  productSafe:dynamics.layout.productSafe,
  copySafe:dynamics.layout.copySafe,
  acceptanceSample:dynamics.acceptance.slice(0,3),
  spatialSilhouette:spatial.silhouette,
  identityProfileUsed:spatial.identityProfileUsed,
  graphicStrategy:strategy,
  directorHasContinuousPhoto:/continuous photograph|grounded contact|No cutout paste/i.test(spatial.directorPrompt)
 };

 // Negative regressions — shared gates
 const dist=verifyProductIdentity({
  referenceBytes:cfg.refBytes,
  generatedBytes:distortedTall(),
  foodIrregular:cfg.foodIrregular,
  categoryHint:cfg.categoryHint
 });
 const distReview=reviewGeneratedCampaign({
  design,identityVerify:dist,
  framingQuality:evaluateFramingQuality(wellFramed(),{framingMode:'full-product'})
 });
 // Distortion should FAIL identity OR at least not APPROVED when geometry blocks
 const distBlocked=dist.verdict==='FAIL'||dist.findings.some(f=>f.severity==='block');
 row.results.quality_gate_blocks_distortion=distBlocked&&distReview.verdict==='NOT APPROVED'?'PASS':'FAIL';

 const clip=evaluateFramingQuality(clippedRight(),{framingMode:'full-product',productScale:dynamics.layout.productScale});
 const clipReview=reviewGeneratedCampaign({design,framingQuality:clip,identityVerify:{verdict:'PASS_PENDING_OWNER',score:5,findings:[],comparisons:{aspectWH:{relDelta:0.01}},publishable:false}});
 row.results.quality_gate_blocks_clip=clip.verdict==='FAIL'&&clipReview.verdict==='NOT APPROVED'?'PASS':'FAIL';

 const tiny=evaluateFramingQuality(tinyProduct(),{framingMode:'full-product',productScale:'dominant'});
 row.results.quality_gate_blocks_tiny=tiny.findings.some(f=>f.code==='PRODUCT_TOO_SMALL'&&f.severity==='block')?'PASS':'FAIL';

 // Optional real clipped FLUX evidence (Abel only) — observation, not mocked
 if(cfg.realClipped){
  const realClip=evaluateFramingQuality(cfg.realClipped,{framingMode:'full-product',categoryHint:cfg.categoryHint,productScale:dynamics.layout.productScale});
  row.observations.realFluxClippedFraming=realClip.verdict;
  assert.equal(realClip.verdict,'FAIL');
 }
 if(cfg.realGen&&profile){
  const genId=verifyProductIdentity({referenceBytes:cfg.refBytes,generatedBytes:cfg.realGen,foodIrregular:cfg.foodIrregular,categoryHint:cfg.categoryHint});
  row.observations.realFluxIdentityVsRef=genId.verdict;
 }

 row.results.vision_language_observations='NOT TESTED';
 row.results.live_flux_generalization='NOT TESTED';
 row.results.advertising_visual_quality='NOT TESTED';

 // Layout fixture only — prove GAD runs; not ad acceptance
 try{
  const plate=wellFramed(cfg.colors[0]||'#ccc');
  const hints=hintsFromPngBytes(plate,{productBox:profile?.geometry.bbox,copySafe:dynamics.layout.copySafe});
  const laid=campaignSVG(design,{photo:'data:image/png;base64,'+plate.toString('base64')},1080,1350,hints);
  const exportPng=Buffer.from(new Resvg(laid.svg,fonts).render().asPng());
  await writeFile(join(out,`LAYOUT-FIXTURE-${cfg.id}.png`),exportPng);
  row.observations.layoutFixtureBytes=exportPng.length;
  row.observations.layoutFixtureNote='Synthetic plate + GAD — not advertising-quality acceptance';
 }catch(e){row.observations.layoutFixtureError=String(e.message||e);}

 for(const cap of capabilities)matrix[cap][cfg.id]=row.results[cap]||'NOT TESTED';
 reports.push(row);

 // Hard asserts for regression harness (shared path must not approve bad frames)
 assert.equal(row.results.quality_gate_blocks_clip,'PASS',cfg.id+' clip gate');
 assert.equal(row.results.quality_gate_blocks_tiny,'PASS',cfg.id+' tiny gate');
 assert.equal(row.results.quality_gate_blocks_distortion,'PASS',cfg.id+' distortion gate');
 assert.equal(row.results.copy_safe_product_safe_regions,'PASS',cfg.id+' zones');
 assert.equal(row.results.photographic_composition_camera,'PASS',cfg.id+' composition scale');
}

const summary={
 disclosure:'CPU cross-brand generalization audit. Layout fixtures are not ads. No RunPod. VLM unavailable.',
 stamp,out,
 matrix,
 brands:reports.map(r=>({
  id:r.id,category:r.category,refKind:r.refKind,
  identity:r.observations.identity,
  composition:r.observations.composition,
  realFlux: {clipped:r.observations.realFluxClippedFraming,identity:r.observations.realFluxIdentityVsRef}
 })),
 failCells:[],
 passCells:[]
};
for(const [cap,by] of Object.entries(matrix)){
 for(const [brand,v] of Object.entries(by)){
  if(v==='FAIL')summary.failCells.push(`${cap}/${brand}`);
  if(v==='PASS')summary.passCells.push(`${cap}/${brand}`);
 }
}

await writeFile(join(out,'generalization-matrix.json'),JSON.stringify(summary,null,2));
await writeFile(join(out,'generalization-matrix.md'),[
 '# Cross-brand generalization matrix (CPU)',
 '',
 '_Not advertising-quality acceptance. Layout fixtures are synthetic. Live FLUX and VLM = NOT TESTED._',
 '',
 '| Capability | Abel Green Cedar | No Crumbs Bakery | Field Audio (synthetic electronics) |',
 '|---|---|---|---|',
 ...capabilities.map(cap=>`| ${cap} | ${matrix[cap]['abel-green-cedar']} | ${matrix[cap]['no-crumbs-bakery']} | ${matrix[cap]['field-audio-speaker']} |`),
 '',
 '## Observations vs inferences',
 '- **Image observations:** Product Identity Profile geometry/coverage/silhouette from PNG pixels.',
 '- **Owner facts / signals:** brand DNA + confirmed source facts supplied to the same Creative Intelligence path.',
 '- **Unavailable:** vision-language observations; live FLUX re-generation (no spend).',
 '',
 `FAIL cells: ${summary.failCells.join(', ')||'none'}`,
].join('\n'));

console.log(JSON.stringify({
 out,
 failCells:summary.failCells,
 matrix:Object.fromEntries(capabilities.map(c=>[c,matrix[c]]))
},null,2));

if(summary.failCells.length){
 console.error('GENERALIZATION_FAIL',summary.failCells);
 process.exitCode=1;
}
