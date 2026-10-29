/**
 * Commercial visual quality sprint — GAD overlays on genuine photographs only.
 * No RunPod. No synthetic SVG sets presented as ads.
 *
 * Asset taxonomy (honest):
 * - packshot: official/customer product photography (Abel private; cookie owner)
 * - flux-raw: prior FLUX.3 inference pixels (not a new live run)
 * - gad-overlay: this script's typography on those pixels
 */
import {mkdir,readFile,writeFile,copyFile,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Resvg} from '@resvg/resvg-js';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {campaignDesign} from '../../shared/lib/ad-scene.ts';
import {withGraphicGeometry,selectGraphicStrategy,planGraphicArt} from '../../shared/lib/graphic-art-director.ts';
import {hintsFromPngBytes} from '../../shared/lib/png-luma.ts';
import {resvgFontOptions} from '../../shared/lib/ad-fonts.ts';
import {evaluateFramingQuality} from '../../shared/lib/framing-quality.ts';
import {buildProductIdentityProfile} from '../../shared/lib/product-identity-profile.ts';
import {verifyProductIdentity} from '../../shared/lib/product-identity-verify.ts';

const root=resolve('.');
const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const outDir=join(root,'outputs','creative-acceptance',stamp,'commercial-visual-sprint');
await mkdir(outDir,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const font=resvgFontOptions();

const ASSETS={
 abelPackshot:join(root,'outputs/fixtures/abel/green-cedar.png'),
 cedarFlux:join(root,'outputs/creative-acceptance/2026-10-29T15-31-40/flux3-green-cedar/flux3-mi2i-raw.png'),
 cedarFluxPlan:join(root,'outputs/creative-acceptance/2026-10-29T15-31-40/flux3-green-cedar/plan.json'),
 cedarFluxAlt:join(root,'outputs/creative-acceptance/2026-10-29T13-57-37/flux3-green-cedar/flux3-mi2i-raw.png'),
 cedarFluxAltPlan:join(root,'outputs/creative-acceptance/2026-10-29T13-57-37/flux3-green-cedar/plan.json'),
 cedarBeforeAd:join(root,'outputs/creative-acceptance/2026-10-29T13-57-37/flux3-green-cedar/advertisement.png'),
 cookieRef:join(root,'outputs/creative-acceptance/2026-10-28-readiness/cookie-product-reference.png'),
 cookieFlux:join(root,'outputs/creative-acceptance/2026-10-29T13-34-04/flux3-mi2i-leave-nothing/flux3-mi2i-raw.png'),
 cookieFluxAlt:join(root,'outputs/creative-acceptance/2026-10-29T01-00-45/flux3-mi2i-leave-nothing/flux3-mi2i-raw.png'),
};

async function exists(p){try{await access(p);return true;}catch{return false;}}

function design(base,arch,graphic){
 return campaignDesign({
  version:1,id:base.id||'ad',name:base.id||'ad',brandId:'b',brandRevision:1,brandReviewed:true,
  photoId:'scene',photoConfirmed:true,concept:'editorial',size:'feed',
  brandName:base.brandName,headline:base.headline,body:base.body,cta:base.cta||'',
  website:'',background:base.background,accent:base.accent,textColor:base.textColor
 },arch,'scene','composite',graphic);
}

async function render({file,photoPath,arch,base,graphic,spatial,label,kind,rights}){
 const raw=await readFile(photoPath);
 await copyFile(photoPath,join(outDir,`${file}-SOURCE.png`));
 let d=design(base,arch,graphic);
 if(spatial?.length)d=withGraphicGeometry(d,spatial,graphic);
 const geometry=d.campaign?.graphic?.geometry;
 const hints=hintsFromPngBytes(raw,geometry);
 const photo='data:image/png;base64,'+raw.toString('base64');
 const laid=campaignSVG(d,{photo},1080,1350,hints);
 const png=Buffer.from(new Resvg(laid.svg,{font}).render().asPng());
 await writeFile(join(outDir,`${file}.png`),png);
 const framing=evaluateFramingQuality(raw,{framingMode:'full-product'});
 const auto=selectGraphicStrategy(d,{tone:base.tone});
 const plan=laid.graphicPlan||planGraphicArt(d,1080,1350,hints);
 return {
  file:`${file}.png`,source:`${file}-SOURCE.png`,label,kind,rights,
  photoPath:photoPath.replace(root+ '\\','').replace(root+'/',''),
  photoSha256:sha(raw),adSha256:sha(png),bytes:png.length,
  strategy:plan.strategy,autoStrategy:auto,ctaStyle:plan.ctaStyle,showCta:plan.showCta,
  veilMode:plan.veil?.mode,reason:plan.reason,
  framing:{verdict:framing.verdict,publishable:framing.publishable,codes:(framing.findings||[]).map(i=>i.category||i.message)},
  headline:base.headline,brandName:base.brandName
 };
}

const matrix=[];
const candidates=[];

// --- 1) Abel packshot — product-accurate private photography (not FLUX) ---
if(await exists(ASSETS.abelPackshot)){
 const pack=await readFile(ASSETS.abelPackshot);
 const profile=buildProductIdentityProfile(pack,{kind:'packshot',categoryHint:'fragrance-bottle'});
 const productBox=profile?.geometry?.bbox||{x:0.28,y:0.18,width:0.44,height:0.64};
 const copySafe={x:0.08,y:0.06,width:0.84,height:0.14};
 const r=await render({
  file:'abel-packshot-architectural',
  photoPath:ASSETS.abelPackshot,
  arch:'beauty-sensory',
  base:{
   id:'abel-pack',brandName:'Abel',headline:'A quieter green.',
   body:'Complex, singular, grounding',cta:'',
   background:'#0a0a0a',accent:'#5a6b3a',textColor:'#fffaf0',
   tone:'Quiet architectural mineral luxury'
  },
  graphic:{
   strategy:'architectural-minimal',showCta:false,showBody:true,showBrand:true,
   placement:'upper-left',
   geometry:{productBox,copySafe}
  },
  label:'Abel packshot + architectural GAD (private benchmark)',
  kind:'packshot + gad-overlay',
  rights:'private-benchmark-only — third-party Abel packshot; do not publish without permission'
 });
 r.identity={silhouette:profile?.geometry?.silhouetteClass,aspect:profile?.geometry?.aspectWH,coverage:profile?.geometry?.coverage};
 r.framingNote='Official packshot framing — product-accurate geometry reference.';
 matrix.push(r);candidates.push(r);

 const r2=await render({
  file:'abel-packshot-editorial',
  photoPath:ASSETS.abelPackshot,
  arch:'beauty-sensory',
  base:{
   id:'abel-pack-ed',brandName:'Abel',headline:'A quieter green.',
   body:'The tallest woods. Earth damp underfoot.',cta:'',
   background:'#0a0a0a',accent:'#5a6b3a',textColor:'#fffaf0',
   tone:'Quiet natural luxury'
  },
  graphic:{
   strategy:'editorial-luxury',showCta:false,showBody:true,showBrand:true,
   placement:'upper-left',
   geometry:{productBox,copySafe}
  },
  label:'Abel packshot + editorial luxury GAD (private benchmark)',
  kind:'packshot + gad-overlay',
  rights:'private-benchmark-only'
 });
 matrix.push(r2);candidates.push(r2);
}

// --- 2) Green Cedar FLUX photograph (prior inference) — environment is the hero ---
for(const [tag,photo,planPath] of [
 ['flux-a',ASSETS.cedarFlux,ASSETS.cedarFluxPlan],
 ['flux-b',ASSETS.cedarFluxAlt,ASSETS.cedarFluxAltPlan],
]){
 if(!(await exists(photo)))continue;
 let spatial;
 try{spatial=JSON.parse(await readFile(planPath,'utf8'))?.spatial?.elements;}catch{/* optional */}
 const r=await render({
  file:`abel-cedar-${tag}-editorial`,
  photoPath:photo,
  arch:'beauty-sensory',
  base:{
   id:`cedar-${tag}`,brandName:'Abel',headline:'A quieter green.',
   body:'Complex, singular, grounding',cta:'',
   background:'#1c241c',accent:'#5a6b3a',textColor:'#fffaf0',
   tone:'Quiet woody mineral luxury'
  },
  graphic:{strategy:'editorial-luxury',showCta:false,showBody:true,showBrand:true},
  spatial,
  label:`Abel FLUX.3 raw (${tag}) + editorial GAD — prior inference, not a new run`,
  kind:'flux-raw + gad-overlay',
  rights:'private-benchmark-only — prior FLUX output; Abel likeness'
 });
 if(await exists(ASSETS.abelPackshot)){
  const pack=await readFile(ASSETS.abelPackshot);
  const gen=await readFile(photo);
  const id=verifyProductIdentity({referenceBytes:pack,generatedBytes:gen,categoryHint:'fragrance-bottle',aspectTolerance:0.12});
  r.identity={verdict:id.verdict,reason:id.findings?.[0]?.message||id.notes?.[0],aspectError:id.comparisons?.aspectWH?.relDelta};
 }
 matrix.push(r);
 if(r.framing?.verdict!=='FAIL'||tag==='flux-a')candidates.push(r);

 const arch=await render({
  file:`abel-cedar-${tag}-architectural`,
  photoPath:photo,
  arch:'beauty-sensory',
  base:{
   id:`cedar-${tag}-arch`,brandName:'Abel',headline:'A quieter green.',
   body:'Complex, singular, grounding',cta:'',
   background:'#1c241c',accent:'#5a6b3a',textColor:'#fffaf0',
   tone:'Architectural stone cedar'
  },
  graphic:{strategy:'architectural-minimal',showCta:false,showBody:true,showBrand:true},
  spatial,
  label:`Abel FLUX.3 raw (${tag}) + architectural GAD`,
  kind:'flux-raw + gad-overlay',
  rights:'private-benchmark-only'
 });
 matrix.push(arch);
}

// --- 3) No Crumbs — owner cookie reference (tight crop) + prior FLUX ---
if(await exists(ASSETS.cookieRef)){
 const r=await render({
  file:'nocrumbs-reference-refined',
  photoPath:ASSETS.cookieRef,
  arch:'food-editorial',
  base:{
   id:'nc-ref',brandName:'No Crumbs Bakery',headline:'Leave Nothing Behind',
   body:'Thick, irregular, meant to be finished.',cta:'Taste the real thing',
   background:'#14110f',accent:'#9a5528',textColor:'#fffaf0',
   tone:'Warm shareable bakery'
  },
  graphic:{
   strategy:'refined-product',showCta:true,showBody:true,showBrand:true,placement:'upper-left',
   geometry:{productBox:{x:0.05,y:0.08,width:0.9,height:0.84},copySafe:{x:0.06,y:0.04,width:0.5,height:0.22}}
  },
  label:'No Crumbs owner reference + refined GAD (tight crop; veil required)',
  kind:'owner-reference + gad-overlay',
  rights:'owner-controlled — public demo OK'
 });
 matrix.push(r);candidates.push(r);
}

for(const [tag,photo] of [['flux',ASSETS.cookieFlux],['flux-alt',ASSETS.cookieFluxAlt]]){
 if(!(await exists(photo)))continue;
 const r=await render({
  file:`nocrumbs-${tag}-refined`,
  photoPath:photo,
  arch:'food-editorial',
  base:{
   id:`nc-${tag}`,brandName:'No Crumbs Bakery',headline:'Leave Nothing Behind',
   body:'Share the last bite.',cta:'Taste the real thing',
   background:'#14110f',accent:'#9a5528',textColor:'#fffaf0',
   tone:'Warm generous shareable'
  },
  graphic:{
   strategy:'refined-product',showCta:true,showBody:true,showBrand:true,
   geometry:{productBox:{x:0.28,y:0.45,width:0.44,height:0.4},copySafe:{x:0.08,y:0.08,width:0.7,height:0.32}}
  },
  label:`No Crumbs prior FLUX.3 (${tag}) + refined GAD — identity vs owner ref may FAIL`,
  kind:'flux-raw + gad-overlay',
  rights:'owner-controlled campaign; prior FLUX pixels'
 });
 if(await exists(ASSETS.cookieRef)){
  const ref=await readFile(ASSETS.cookieRef);
  const gen=await readFile(photo);
  const id=verifyProductIdentity({referenceBytes:ref,generatedBytes:gen,categoryHint:'baked-good',foodIrregular:true,aspectTolerance:0.18});
  r.identity={verdict:id.verdict,reason:id.findings?.[0]?.message||id.notes?.[0]};
 }
 // Wrong-strategy control: luxury serif on bakery should feel alien
 const wrong=await render({
  file:`nocrumbs-${tag}-wrong-luxury`,
  photoPath:photo,
  arch:'food-editorial',
  base:{
   id:`nc-${tag}-lux`,brandName:'No Crumbs Bakery',headline:'Leave Nothing Behind',
   body:'Share the last bite.',cta:'',
   background:'#14110f',accent:'#9a5528',textColor:'#fffaf0',
   tone:'Warm bakery'
  },
  graphic:{strategy:'editorial-luxury',showCta:false,showBody:true,showBrand:true,
   geometry:{productBox:{x:0.28,y:0.45,width:0.44,height:0.4},copySafe:{x:0.08,y:0.08,width:0.7,height:0.32}}},
  label:`CONTROL — luxury serif on bakery (should feel wrong)`,
  kind:'flux-raw + gad-overlay (negative control)',
  rights:'owner-controlled'
 });
 matrix.push(r,wrong);
 if(r.identity?.verdict!=='FAIL')candidates.push(r);
 else matrix.find(m=>m.file===r.file); // keep in matrix with FAIL
 candidates.push(r); // still a layout candidate; disclose identity
}

// Before ad (generic overlay) for comparison
if(await exists(ASSETS.cedarBeforeAd)){
 await copyFile(ASSETS.cedarBeforeAd,join(outDir,'abel-cedar-BEFORE-generic-overlay.png'));
}

// Cross-brand honesty
const crossBrand={
 fragrance:{
  brand:'Abel Green Cedar',
  productAccuratePackshot:matrix.some(m=>m.file.startsWith('abel-packshot')&&m.framing?.verdict!=='FAIL')?'PASS':'FAIL',
  photographicEnvironmentAd:matrix.some(m=>m.file.includes('cedar-flux')&&m.framing?.verdict==='PASS')?'PASS':
   matrix.some(m=>m.file.includes('cedar-flux'))?'CONDITIONAL (framing/identity disclosed)':'NOT TESTED',
  graphicIdentityDistinct:matrix.some(m=>m.strategy==='editorial-luxury'||m.strategy==='architectural-minimal')?'PASS':'FAIL',
  liveNewInference:'NOT TESTED (no RunPod)',
  publishRights:'private-benchmark-only'
 },
 bakery:{
  brand:'No Crumbs Bakery',
  ownerReferenceLayout:matrix.some(m=>m.file.includes('nocrumbs-reference'))?'PASS (tight crop; veil)':'NOT TESTED',
  fluxLayout:matrix.some(m=>m.file.includes('nocrumbs-flux-refined'))?'PASS (layout)':'NOT TESTED',
  productIdentityVsOwnerRef:matrix.find(m=>m.file.includes('nocrumbs-flux-refined'))?.identity?.verdict||'NOT TESTED',
  notLuxurySerifClone:matrix.some(m=>m.file.includes('nocrumbs-flux-refined')&&m.strategy==='refined-product')?'PASS':'FAIL',
  liveNewInference:'NOT TESTED (no RunPod)',
  publishRights:'owner-controlled — preferred public demo brand'
 },
 thirdCategory:{
  brand:'Field Audio / other',
  status:'NOT TESTED',
  reason:'No genuine third-category commercial photograph available — only prior synthetic speaker fixture. Refusing to present synthetic as advertising quality.'
 }
};

// Pick strongest demo set (honest)
const selected=[];
const packEd=matrix.find(m=>m.file==='abel-packshot-editorial.png');
const packArch=matrix.find(m=>m.file==='abel-packshot-architectural.png');
const cedarBest=matrix.find(m=>m.file==='abel-cedar-flux-a-editorial.png')
 ||matrix.find(m=>m.file==='abel-cedar-flux-b-editorial.png');
const cookieBest=matrix.find(m=>m.file==='nocrumbs-flux-refined.png')
 ||matrix.find(m=>m.file==='nocrumbs-reference-refined.png');
for(const s of [packArch,packEd,cedarBest,cookieBest]){
 if(s){
  selected.push(s);
  await copyFile(join(outDir,s.file),join(outDir,`SELECTED-${s.file}`));
 }
}

const html=`<!doctype html><meta charset="utf-8"/><title>Commercial visual sprint</title>
<style>
body{margin:0;background:#0e0e0e;color:#ece7df;font:14px/1.45 "Source Sans 3",system-ui,sans-serif}
header{padding:28px 24px 8px;max-width:1100px}
h1{font:500 28px/1.15 "EB Garamond",Georgia,serif;margin:0 0 8px}
.note{opacity:.75;max-width:62ch}
.banner{background:#3a2218;color:#ffd7b8;padding:10px 14px;margin:12px 24px;max-width:1050px}
grid,section{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));padding:16px 24px 32px}
figure{margin:0;background:#161616}
img{width:100%;height:auto;display:block;background:#000}
figcaption{padding:10px 12px;font-size:12px;opacity:.85}
.tag{display:inline-block;margin-right:6px;padding:1px 6px;border:1px solid #555;font-size:10px;letter-spacing:.04em;text-transform:uppercase}
</style>
<header>
<h1>Commercial visual sprint</h1>
<p class="note">Typography recomposed on <strong>existing genuine photographs</strong>. No new model inference. Synthetic SVG sets are excluded from this gallery.</p>
</header>
<div class="banner"><strong>Rights:</strong> Abel assets = private benchmark only. No Crumbs = owner-controlled demo brand. FLUX files = prior recorded inference, not a live re-run.</div>
<h2 style="padding:8px 24px 0;font-weight:500">Selected candidates</h2>
<section>
${selected.map(s=>`<figure><img src="${s.file}"/><figcaption><span class="tag">${s.kind}</span><span class="tag">${s.strategy}</span><br/>${s.label}<br/>framing ${s.framing?.verdict||'?'} · identity ${s.identity?.verdict||s.identity?.silhouette||'n/a'}</figcaption></figure>`).join('')}
</section>
<h2 style="padding:8px 24px 0;font-weight:500">Full matrix</h2>
<section>
${matrix.map(s=>`<figure><img src="${s.file}"/><figcaption><span class="tag">${s.kind}</span>${s.label}<br/>${s.strategy} · veil ${s.veilMode} · CTA ${s.ctaStyle}<br/>framing ${s.framing?.verdict}</figcaption></figure>`).join('')}
</section>`;

await writeFile(join(outDir,'comparison.html'),html);
await writeFile(join(outDir,'report.json'),JSON.stringify({
 stamp,outDir,note:'Genuine photograph + GAD only. Not a synthetic layout benchmark.',
 noRunPod:true,priorInferenceOnly:true,
 crossBrand,selected:selected.map(s=>s.file),matrix
},null,2));
await writeFile(join(outDir,'CROSS-BRAND.md'),`# Cross-brand commercial visual matrix

Generated ${stamp}. Same GAD production code; no category-specific rescue prompts; no new RunPod.

| Dimension | Fragrance (Abel) | Bakery (No Crumbs) | Third category |
|---|---|---|---|
| Genuine photo available | PASS (packshot + prior FLUX) | PASS (owner ref + prior FLUX) | NOT TESTED (synthetic only) |
| Product-accurate packshot ad | ${crossBrand.fragrance.productAccuratePackshot} | n/a (food ref is tight crop) | NOT TESTED |
| Photographic environment + GAD | ${crossBrand.fragrance.photographicEnvironmentAd} | ${crossBrand.bakery.fluxLayout} | NOT TESTED |
| Distinct graphic strategy | ${crossBrand.fragrance.graphicIdentityDistinct} | ${crossBrand.bakery.notLuxurySerifClone} | NOT TESTED |
| Product identity vs reference | see matrix JSON | ${crossBrand.bakery.productIdentityVsOwnerRef} | NOT TESTED |
| Live new FLUX inference | NOT TESTED | NOT TESTED | NOT TESTED |
| Public demo rights | private benchmark | owner-controlled | n/a |

## Limitations
- Clipped / identity-fail FLUX frames cannot be “fixed” by typography.
- Cookie FLUX may fail product-identity vs owner reference — gate correctly refuses publish as identity-true.
- Field Audio remains synthetic test art — excluded from advertising claims.
`);

console.log(JSON.stringify({
 outDir,
 selected:selected.map(s=>s.file),
 strategies:matrix.map(m=>({file:m.file,strategy:m.strategy,veil:m.veilMode,framing:m.framing?.verdict,identity:m.identity?.verdict||m.identity?.silhouette})),
 crossBrand
},null,2));
