#!/usr/bin/env node
/** Composition & typography layout fixtures — CPU only.
 * DISCLOSURE: outputs are synthetic layout fixtures (packshot inset on SVG set + GAD type).
 * They are NOT generative FLUX photographs and NOT advertising-quality acceptance.
 * 1) Prove clipped Green Cedar FAILs framing (cannot be "fixed" by type).
 * 2) Build a labeled synthetic plate; show disconnected-shelf detection.
 * 3) Exercise OFL font wiring in Resvg exports — font install ≠ visual taste approval. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {evaluateFramingQuality} from '../../shared/lib/framing-quality.ts';
import {reviewGeneratedCampaign} from '../../shared/lib/creative-visual-review.ts';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {campaignDesign} from '../../shared/lib/ad-scene.ts';
import {withGraphicGeometry,selectGraphicStrategy} from '../../shared/lib/graphic-art-director.ts';
import {hintsFromPngBytes} from '../../shared/lib/png-luma.ts';
import {resvgFontOptions} from '../../shared/lib/ad-fonts.ts';
import {buildCompositionPlan} from '../../shared/lib/composition-dynamics.ts';
import {dynamicsToFlux3Spatial} from '../../shared/lib/flux3-spatial.ts';
import {buildProductIdentityProfile} from '../../shared/lib/product-identity-profile.ts';
import {assembleCreativePlan,creativeContext,conceptsFromArguments} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {createHash} from 'node:crypto';

const root=resolve('.');
const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=join(root,'outputs','creative-acceptance',stamp,'composition-typography-recovery');
await mkdir(out,{recursive:true});
const fonts=resvgFontOptions();
const render=svg=>Buffer.from(new Resvg(svg,fonts).render().asPng());
const sha=b=>createHash('sha256').update(b).digest('hex');

const clippedPath=join(root,'outputs/creative-acceptance/2026-10-29T15-31-40/flux3-green-cedar/flux3-mi2i-raw.png');
const beforeAd=join(root,'outputs/creative-acceptance/2026-10-29T15-31-40/graphic-art-director/green-cedar-FINAL.png');
const packPath=join(root,'outputs/fixtures/abel/green-cedar.png');
const pack=await readFile(packPath);
const clipped=await readFile(clippedPath);

// --- 1) Framing FAIL on clipped generation ---
const clipFrame=evaluateFramingQuality(clipped,{framingMode:'full-product',categoryHint:'fragrance-bottle'});
assert.equal(clipFrame.verdict,'FAIL');
const clipReview=reviewGeneratedCampaign({
 design:{headline:'A quieter green.',body:'Complex, singular, grounding',cta:'',background:'#1c241c',textColor:'#fffaf0',brandName:'Abel',size:'feed',concept:'editorial'},
 framingQuality:clipFrame,
 identityVerify:{verdict:'PASS_PENDING_OWNER',score:5,findings:[],comparisons:{aspectWH:{relDelta:0.01}},publishable:false}
});
assert.equal(clipReview.verdict,'NOT APPROVED');
await writeFile(join(out,'clipped-framing-report.json'),JSON.stringify({clipFrame,clipReview},null,2));
await copyFile(clippedPath,join(out,'BEFORE-clipped-raw.png'));
try{await copyFile(beforeAd,join(out,'BEFORE-rejected-ad.png'));}catch{/* optional */}

// --- 2) SYNTHETIC layout plate (packshot on SVG gradients + fake ledge) — NOT a generative photograph ---
const plateSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">
 <defs>
  <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0%" stop-color="#2c332a"/><stop offset="100%" stop-color="#1a1f18"/>
  </linearGradient>
  <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0">
   <stop offset="0%" stop-color="#1a1510"/><stop offset="100%" stop-color="#2a2218"/>
  </linearGradient>
 </defs>
 <rect width="1080" height="1350" fill="url(#wall)"/>
 <rect x="0" y="0" width="380" height="1350" fill="url(#wood)"/>
 <!-- intentional hard ledge — must be detected as DISCONNECTED_SUPPORT -->
 <ellipse cx="540" cy="1020" rx="340" ry="36" fill="#000" opacity="0.35"/>
 <rect x="160" y="990" width="760" height="28" fill="#5c6158" opacity="0.55"/>
 <image href="data:image/png;base64,${pack.toString('base64')}" x="265" y="430" width="520" height="520" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
const framedPhoto=render(plateSvg);
await writeFile(join(out,'SYNTHETIC-layout-plate.png'),framedPhoto);
await writeFile(join(out,'framed-photographic-plate.png'),framedPhoto); // legacy alias — still synthetic
const framedCheck=evaluateFramingQuality(framedPhoto,{framingMode:'full-product',categoryHint:'fragrance-bottle',productScale:'dominant'});
assert.ok(!framedCheck.findings.some(f=>f.code==='PRODUCT_CLIPPED'),'synthetic plate must keep product unclipped for layout tests');
assert.ok(
 framedCheck.findings.some(f=>f.code==='DISCONNECTED_SUPPORT'||f.code==='PRODUCT_TOO_SMALL'),
 'synthetic SVG shelf/plate must not pass as advertising-quality; expect DISCONNECTED_SUPPORT or PRODUCT_TOO_SMALL'
);
assert.equal(framedCheck.verdict,'FAIL');
await writeFile(join(out,'synthetic-plate-framing-report.json'),JSON.stringify({
 disclosure:'CPU SVG composite: official packshot inset on flat gradients + hard ledge. Not FLUX. Not advertising acceptance.',
 framedCheck
},null,2));

// Dominant-prominence plate without fake shelf — still synthetic, used only to exercise GAD font export wiring.
const promoSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">
 <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#243028"/><stop offset="100%" stop-color="#121612"/></linearGradient></defs>
 <rect width="1080" height="1350" fill="url(#g)"/>
 <image href="data:image/png;base64,${pack.toString('base64')}" x="210" y="360" width="660" height="700" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
const promoPlate=render(promoSvg);
await writeFile(join(out,'SYNTHETIC-prominence-plate.png'),promoPlate);

// --- 3) Composition layout + spatial (pre-gen zones) ---
const brand=newBrand('Abel');
brand.dna.description='Abel creates high-performance natural eau de parfum. Green Cedar: a vibrant aromatic wood.';
brand.dna.tone='Quiet, considered, natural luxury.';
brand.dna.visualStyle='Soft mineral and cedar light, frosted glass, architectural stillness.';
brand.dna.messaging='A quieter green.';
brand.colors=['#f6eada','#1c241c'];
brand.overrides=['name','description','tone','visualStyle','messaging'];
brand.assets=[{id:'photo',assetId:'gc',name:'green-cedar.png',role:'product',productId:'green-cedar'}];
brand.products=[{id:'green-cedar',name:'Green Cedar',description:'Aromatic wood.',sellingPoints:'Complex, singular, grounding.',imageIds:['photo']}];
const quote=brand.dna.description;
const input={
 version:1,projectId:'comp-recovery',brand,
 source:{id:'gc',name:'green-cedar.png',kind:'original',sha256:sha(pack),originalSha256:sha(pack),width:1080,height:1080},
 facts:{description:'SHORT BROAD frosted Green Cedar bottle',count:1,arrangement:'Single bottle',texture:'Frosted glass',container:'Bottle',confirmed:true},
 productType:'packaged-goods',productId:'green-cedar',request:'Luxury woody editorial with full bottle in frame and quiet lettering space',
 intent:'campaign',format:'feed',seed:7,
 constraints:{exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',fidelity:'medium',creativity:'high'}
};
const flat={arguments:[
 {title:'Cedar light',idea:'Argue for a premium woody atmosphere without inventing notes or performance claims.',objective:'consideration',audienceHypothesis:'People seeking quiet natural luxury may respond to architectural stillness around a recognizable frosted bottle.',tension:'Generic fragrance ads float bottles on colour fields; Green Cedar needs damp-earth calm and cedar architecture.',businessFit:quote,feeling:'Grounded, quiet resolve.',memory:'Frosted bottle on stone with soft cedar depth.',focus:'One frosted Green Cedar bottle — exact silhouette, cream cap, printed label.',opening:'Establish quiet architectural negative space, then land the bottle.',payoff:'Hold the authentic bottle with calm lettering room.',proofId:'brand-description',proofQuote:quote},
 {title:'Moss vignette',idea:'Argue for intimacy: bring the observed bottle close in a moss-mineral vignette so the viewer leans in — product identity stays exact.',objective:'consideration',audienceHypothesis:'Fragrance buyers lean into tactile materials when the bottle remains exact.',tension:'Wide lifestyle sets steal focus from the bottle; keep the vignette intimate.',businessFit:quote,feeling:'Quiet curiosity.',memory:'Close frosted glass against moss-mineral calm.',focus:'Frosted glass, cream cap, GREEN CEDAR label.',opening:'Graze light across frosted edges.',payoff:'Resolve on label-readable bottle.',proofId:'brand-description',proofQuote:quote},
 {title:'Walnut quiet',idea:'Argue for editorial calm: walnut and soft green depth create space for a restrained headline; silhouette remains the only subject.',objective:'consideration',audienceHypothesis:'Editorial shoppers want quiet luxury space around the object.',tension:'Busy sets erase the architectural bottle; keep walnut calm and empty.',businessFit:quote,feeling:'Editorial calm.',memory:'Bottle alone on walnut with soft green depth.',focus:'Exact trapezoidal bottle silhouette.',opening:'Broad soft key, then product.',payoff:'Open field for brand lettering.',proofId:'brand-description',proofQuote:quote}
]};
const ctx=creativeContext(input);
const plan=assembleCreativePlan(input,conceptsFromArguments(flat,input,ctx),{planningVersion:2,mode:'local-ai',model:'authored-validated-argument',reason:'composition recovery',contribution:{format:'advertising-arguments-v1',modelFields:['title','idea'],appFields:['dynamics']}},'c'.repeat(16));
const dynamics=plan.dynamics||buildCompositionPlan(plan);
assert.ok(dynamics.layout?.productSafe);
assert.ok(dynamics.layout?.copySafe);
assert.equal(dynamics.layout.framingMode,'full-product');
assert.equal(dynamics.layout.productScale,'dominant','fragrance lane must plan dominant product prominence');
assert.ok(dynamics.layout.productSafe.height>=0.55,'dominant productSafe height must be intentional');
assert.match(dynamics.acceptance.join(' '),/prominence|grounded contact|continuous photograph/i);
const identity=buildProductIdentityProfile(pack,{kind:'packshot',categoryHint:'fragrance-bottle'});
const spatial=dynamicsToFlux3Spatial(dynamics,{environment:plan.concepts.find(c=>c.id===plan.selectedId)?.environment,identity});
assert.match(spatial.directorPrompt,/FULL PRODUCT IN FRAME|full product/i);
assert.match(spatial.directorPrompt,/PRODUCT SCALE: dominant|dominant hero/i);
assert.match(spatial.directorPrompt,/continuous photograph|grounded contact|No cutout paste|flat.?colour/i);
const hero=spatial.elements.find(e=>e.id==='product_1').bbox;
assert.ok(hero[1]>=80&&hero[3]<=920,'hero guidance must keep horizontal inset');
await writeFile(join(out,'composition-layout.json'),JSON.stringify({layout:dynamics.layout,spatial:{silhouette:spatial.silhouette,hero,copy:spatial.elements.find(e=>e.id==='copy_space_1').bbox}},null,2));

// --- 4) GAD font-wiring fixtures on synthetic plate (NOT creative acceptance) ---
const measured=buildProductIdentityProfile(promoPlate,{kind:'scene',categoryHint:'fragrance-bottle'});
const productBox=measured?.geometry.bbox;
let design=campaignDesign({
 version:1,id:'gc',name:'gc',brandId:'b',brandRevision:1,brandReviewed:true,photoId:'scene',photoConfirmed:true,
 concept:'editorial',size:'feed',brandName:'Abel',headline:'A quieter green.',body:'Complex, singular, grounding',cta:'',
 website:'',background:'#1c241c',accent:'#5a6b3a',textColor:'#fffaf0'
},'beauty-sensory','scene','composite',{strategy:'editorial-luxury',showCta:false,showBody:true,showBrand:true});
design=withGraphicGeometry(design,spatial.elements,{strategy:'editorial-luxury',showCta:false,geometry:{productBox,copySafe:dynamics.layout.copySafe}});
const hints=hintsFromPngBytes(promoPlate,{productBox,copySafe:dynamics.layout.copySafe});
const photo='data:image/png;base64,'+promoPlate.toString('base64');
const strategies=['editorial-luxury','architectural-minimal','contemporary-luxury'];
const results=[];
for(const strategy of strategies){
 const d={...design,campaign:{...design.campaign,graphic:{...design.campaign.graphic,strategy}}};
 const laid=campaignSVG(d,{photo},1080,1350,hints);
 assert.ok(laid.graphicPlan);
 assert.match(laid.graphicPlan.typography.headline.family,/EB Garamond|Newsreader|Outfit|DM Sans|Source Sans/i);
 assert.ok(laid.graphicPlan.typography.brand.size>=13,'brand mark must be optically present');
 const png=render(laid.svg);
 await writeFile(join(out,`LAYOUT-FIXTURE-${strategy}.png`),png);
 results.push({strategy,family:laid.graphicPlan.typography.headline.family,brandSize:laid.graphicPlan.typography.brand.size,headlineBox:laid.graphicPlan.placement.headline,reason:laid.graphicPlan.reason,bytes:png.length});
}
// Legacy alias kept for path stability — still a layout fixture, not an accepted ad.
await copyFile(join(out,'LAYOUT-FIXTURE-editorial-luxury.png'),join(out,'AFTER-FINAL.png'));
await writeFile(join(out,'ARTIFACT-DISCLOSURE.json'),JSON.stringify({
 kind:'synthetic-cpu-layout-fixture',
 not:'generative-flux-photograph',
 notAdvertisingAcceptance:true,
 note:'OFL fonts prove Resvg/browser wiring only. Installing fonts does not improve advertising taste. Owner rejected AFTER-FINAL as premium advertising.',
 fontsLoaded:fonts.fontFiles?.length||0,
 selected:selectGraphicStrategy(design,{tone:brand.dna.tone,idea:'woody mineral cedar'}),
 results
},null,2));
await writeFile(join(out,'gad-results.json'),JSON.stringify({
 disclosure:'Font-wiring fixtures only — not visual quality acceptance.',
 selected:selectGraphicStrategy(design,{tone:brand.dna.tone,idea:'woody mineral cedar'}),
 results,fontsLoaded:fonts.fontFiles?.length||0
},null,2));

await writeFile(join(out,'comparison.html'),`<!doctype html><meta charset=utf-8><title>Layout fixtures (not ad acceptance)</title>
<style>body{font:16px/1.45 "Source Sans 3",system-ui;background:#0e1210;color:#f3ebe1;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}img{width:100%;background:#1a1f1c}figcaption{margin-top:6px;opacity:.85}.banner{border:1px solid #a67c2a;padding:12px 14px;margin:0 0 18px;background:#1a1810}</style>
<div class="banner"><strong>Not advertising acceptance.</strong> Clipped row is real FLUX evidence. All AFTER / LAYOUT-FIXTURE images are CPU SVG composites (packshot + fake set + GAD type). Framing PASS on margins ≠ premium ad. OFL fonts prove export wiring only.</div>
<h1>Composition / typography layout fixtures</h1>
<p>Clipped generation framing=${clipFrame.verdict}. Synthetic shelf plate framing=${framedCheck.verdict} (expected FAIL for disconnected support / prominence). Typography stack exercises OFL faces — not a geometry repair and not creative approval.</p>
<main>
<figure><img src="BEFORE-clipped-raw.png"/><figcaption>BEFORE — clipped FLUX raw (framing FAIL)</figcaption></figure>
<figure><img src="BEFORE-rejected-ad.png"/><figcaption>BEFORE — rejected ad treatment</figcaption></figure>
<figure><img src="SYNTHETIC-layout-plate.png"/><figcaption>SYNTHETIC — packshot on SVG + hard ledge (not FLUX)</figcaption></figure>
<figure><img src="AFTER-FINAL.png"/><figcaption>LAYOUT FIXTURE — editorial-luxury GAD over synthetic plate (rejected as ad quality)</figcaption></figure>
<figure><img src="LAYOUT-FIXTURE-architectural-minimal.png"/><figcaption>LAYOUT FIXTURE — architectural-minimal</figcaption></figure>
<figure><img src="LAYOUT-FIXTURE-contemporary-luxury.png"/><figcaption>LAYOUT FIXTURE — contemporary-luxury</figcaption></figure>
</main>`);

console.log(JSON.stringify({
 out,
 disclosure:'synthetic-cpu-layout-fixtures-not-ad-acceptance',
 clipFrame:clipFrame.verdict,
 syntheticPlate:framedCheck.verdict,
 productScale:dynamics.layout.productScale,
 afterAlias:join(out,'AFTER-FINAL.png'),
 fonts:fonts.fontFiles?.length||0
},null,2));
