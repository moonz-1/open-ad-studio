/**
 * Graphic Art Director bench — recompose Green Cedar + No Crumbs photographs
 * into brand-adaptive advertisements (no paid inference).
 */
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {campaignDesign} from '../../shared/lib/ad-scene.ts';
import {withGraphicGeometry,selectGraphicStrategy,GRAPHIC_STRATEGIES,graphicStrategyLabel} from '../../shared/lib/graphic-art-director.ts';
import {hintsFromPngBytes} from '../../shared/lib/png-luma.ts';

const root=resolve('.');
const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const outDir=join(root,'outputs','creative-acceptance',stamp,'graphic-art-director');
await mkdir(outDir,{recursive:true});

async function renderAd({name,photoPath,planPath,base,strategies,preferred}){
 const raw=await readFile(photoPath);
 const plan=planPath?JSON.parse(await readFile(planPath,'utf8')):null;
 const spatial=plan?.spatial?.elements;
 let design=campaignDesign({
  version:1,id:name,name,brandId:'b',brandRevision:1,brandReviewed:true,photoId:'scene',photoConfirmed:true,
  concept:'editorial',size:'feed',brandName:base.brandName,headline:base.headline,body:base.body,cta:base.cta,
  website:'',background:base.background,accent:base.accent,textColor:base.textColor
 },base.archetype,'scene','composite',base.graphic);
 if(spatial)design=withGraphicGeometry(design,spatial,base.graphic);
 const hints=hintsFromPngBytes(raw,design.campaign?.graphic?.geometry);
 const photo='data:image/png;base64,'+raw.toString('base64');
 const auto=selectGraphicStrategy(design,{tone:base.tone,idea:plan?.concept?.idea,energy:plan?.dynamics?.frame?.energy,title:plan?.concept?.title});
 const results=[];
 for(const strategy of strategies){
  const d={...design,campaign:{...design.campaign,graphic:{...design.campaign.graphic,strategy,showCta:base.graphic?.showCta,showBody:base.graphic?.showBody!==false}}};
  const laid=campaignSVG(d,{photo},1080,1350,hints);
  const png=Buffer.from(new Resvg(laid.svg,{font:{loadSystemFonts:true,defaultFontFamily:'Georgia'}}).render().asPng());
  const file=`${name}-${strategy}.png`;
  await writeFile(join(outDir,file),png);
  results.push({
   strategy,file,reason:laid.graphicPlan?.reason,ctaStyle:laid.graphicPlan?.ctaStyle,
   showCta:laid.graphicPlan?.showCta,showBody:laid.graphicPlan?.showBody,
   headlineBox:laid.graphicPlan?.placement.headline,bytes:png.length
  });
  console.log(JSON.stringify({name,strategy,label:graphicStrategyLabel(strategy),reason:laid.graphicPlan?.reason,cta:laid.graphicPlan?.ctaStyle,bytes:png.length}));
 }
 // Preferred / auto pick
 const pick=preferred||auto;
 const winner=results.find(r=>r.strategy===pick)||results[0];
 await copyFile(join(outDir,winner.file),join(outDir,`${name}-SELECTED.png`));
 await copyFile(photoPath,join(outDir,`${name}-raw-photo.png`));
 return {auto,pick:winner.strategy,results,geometry:design.campaign?.graphic?.geometry};
}

const cedarPlan=join(root,'outputs/creative-acceptance/2026-10-29T13-57-37/flux3-green-cedar/plan.json');
const cedarPhoto=join(root,'outputs/creative-acceptance/2026-10-29T13-57-37/flux3-green-cedar/flux3-mi2i-raw.png');
const cookiePhoto=join(root,'outputs/creative-acceptance/2026-10-29T13-34-04/flux3-mi2i-leave-nothing/flux3-mi2i-raw.png');
const cookiePlan=join(root,'outputs/creative-acceptance/2026-10-29T13-34-04/flux3-mi2i-leave-nothing/history.json');

const cedar=await renderAd({
 name:'green-cedar',
 photoPath:cedarPhoto,
 planPath:cedarPlan,
 preferred:'editorial-luxury',
 strategies:['editorial-luxury','contemporary-luxury','architectural-minimal','dramatic-cinematic'],
 base:{
  brandName:'Abel',headline:'A quieter green.',body:'Complex, singular, grounding',cta:'Explore',
  background:'#1c241c',accent:'#5a6b3a',textColor:'#fffaf0',archetype:'beauty-sensory',
  tone:'Quiet, considered, natural luxury.',
  graphic:{showCta:false,showBody:true,showBrand:true}
 }
});

// Visual revision pass: architectural-minimal often suits cedar grain — also export a refined no-body variant.
{
 const raw=await readFile(cedarPhoto);
 const plan=JSON.parse(await readFile(cedarPlan,'utf8'));
 let design=withGraphicGeometry(campaignDesign({
  version:1,id:'gc-rev',name:'gc',brandId:'b',brandRevision:1,brandReviewed:true,photoId:'scene',photoConfirmed:true,
  concept:'editorial',size:'feed',brandName:'Abel',headline:'A quieter green.',body:'Complex, singular, grounding',cta:'',
  website:'',background:'#1c241c',accent:'#5a6b3a',textColor:'#fffaf0'
 },'beauty-sensory','scene','composite',{strategy:'architectural-minimal',showCta:false,showBody:true,showBrand:true}),plan.spatial.elements);
 const hints=hintsFromPngBytes(raw,design.campaign.graphic.geometry);
 const laid=campaignSVG(design,{photo:'data:image/png;base64,'+raw.toString('base64')},1080,1350,hints);
 const png=Buffer.from(new Resvg(laid.svg,{font:{loadSystemFonts:true,defaultFontFamily:'Georgia'}}).render().asPng());
 await writeFile(join(outDir,'green-cedar-REVISION-architectural.png'),png);
}
 // Judged FINAL: editorial-luxury after visual revision (no CTA, body with headline). Architectural kept as candidate.
 await copyFile(join(outDir,'green-cedar-editorial-luxury.png'),join(outDir,'green-cedar-SELECTED.png'));
 await copyFile(join(outDir,'green-cedar-editorial-luxury.png'),join(outDir,'green-cedar-FINAL.png'));

let cookieMeta={};
try{
 await readFile(cookiePhoto);
 // history may not have spatial — try report sibling
 let elements;
 try{
  const hist=JSON.parse(await readFile(cookiePlan,'utf8'));
  elements=hist?.spatial?.elements||hist?.plan?.spatial?.elements;
 }catch{/* optional */}
 cookieMeta=await renderAd({
  name:'no-crumbs',
  photoPath:cookiePhoto,
  planPath:null,
  preferred:'refined-product',
  strategies:['refined-product','playful-expressive','editorial-luxury'],
  base:{
   brandName:'No Crumbs Bakery',headline:'Leave Nothing Behind',body:'Share the last bite.',cta:'Taste the real thing',
   background:'#14110f',accent:'#9a5528',textColor:'#fffaf0',archetype:'food-editorial',
   tone:'Warm, generous, shareable.',
   graphic:{showCta:true,showBody:true,showBrand:true,strategy:'refined-product',
    geometry:elements?undefined:{productBox:{x:0.28,y:0.32,width:0.48,height:0.48},copySafe:{x:0.06,y:0.06,width:0.5,height:0.28}}}
  }
 });
}catch(e){
 cookieMeta={error:String(e)};
 console.warn('No Crumbs photo missing',e.message);
}

// Before/after comparison HTML
const beforeAd=join(root,'outputs/creative-acceptance/2026-10-29T13-57-37/flux3-green-cedar/advertisement.png');
await copyFile(beforeAd,join(outDir,'green-cedar-BEFORE.png'));
const html=`<!doctype html><meta charset="utf-8"/><title>Graphic Art Director</title>
<style>body{margin:0;font:14px/1.4 Georgia,serif;background:#111;color:#eee}grid,section{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));padding:16px}img{width:100%;height:auto;background:#000}h1,h2{font-weight:500;letter-spacing:.02em}</style>
<h1>Green Cedar — before / candidates / final</h1>
<section>
<figure><img src="green-cedar-BEFORE.png"/><figcaption>Before (generic overlay)</figcaption></figure>
<figure><img src="green-cedar-editorial-luxury.png"/><figcaption>Editorial luxury</figcaption></figure>
<figure><img src="green-cedar-contemporary-luxury.png"/><figcaption>Contemporary luxury</figcaption></figure>
<figure><img src="green-cedar-architectural-minimal.png"/><figcaption>Architectural minimal</figcaption></figure>
<figure><img src="green-cedar-dramatic-cinematic.png"/><figcaption>Dramatic cinematic</figcaption></figure>
<figure><img src="green-cedar-FINAL.png"/><figcaption><strong>FINAL</strong> · architectural minimal, no CTA</figcaption></figure>
</section>
<h2>No Crumbs generalization</h2>
<section>
<figure><img src="no-crumbs-refined-product.png"/><figcaption>Refined product</figcaption></figure>
<figure><img src="no-crumbs-playful-expressive.png"/><figcaption>Playful expressive</figcaption></figure>
<figure><img src="no-crumbs-editorial-luxury.png"/><figcaption>Editorial luxury (should feel wrong for bakery)</figcaption></figure>
<figure><img src="no-crumbs-SELECTED.png"/><figcaption>Selected bakery layout</figcaption></figure>
</section>`;
await writeFile(join(outDir,'comparison.html'),html);
await writeFile(join(outDir,'report.json'),JSON.stringify({
 stamp,outDir,cedar,cookie:cookieMeta,strategies:GRAPHIC_STRATEGIES,
 note:'Photography unchanged; Graphic Art Director owns final advertisement composition.'
},null,2));
console.log(JSON.stringify({outDir,cedarPick:cedar.pick,cedarAuto:cedar.auto,cookiePick:cookieMeta.pick||cookieMeta.error},null,2));
