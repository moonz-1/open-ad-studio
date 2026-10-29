import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {Resvg} from '@resvg/resvg-js';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {campaignDesign} from '../../shared/lib/ad-scene.ts';
import {selectGraphicStrategy,withGraphicGeometry,planGraphicArt,GRAPHIC_STRATEGIES,preferMeasuredProductBox} from '../../shared/lib/graphic-art-director.ts';
import {hintsFromPngBytes} from '../../shared/lib/png-luma.ts';
import {sanitizeExportDesign} from '../../shared/lib/ad-quality.ts';
import {resvgFontOptions} from '../../shared/lib/ad-fonts.ts';
import {evaluateFramingQuality} from '../../shared/lib/framing-quality.ts';

const tinyPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function base(arch,extra={}){
 return campaignDesign({
  version:1,id:'d',name:'t',brandId:'b',brandRevision:1,brandReviewed:true,photoId:'p',photoConfirmed:true,
  concept:'editorial',size:'feed',brandName:extra.brandName||'Abel',headline:extra.headline||'A quieter green.',
  body:extra.body||'Complex, singular, grounding',cta:extra.cta||'Explore',website:'',
  background:extra.background||'#1c241c',accent:'#5a6b3a',textColor:'#fffaf0'
 },arch,'p','composite',extra.graphic);
}

test('beauty fragrance defaults to editorial-luxury without filled CTA',()=>{
 const d=base('beauty-sensory');
 assert.equal(selectGraphicStrategy(d,{tone:'Quiet natural luxury',idea:'woody mineral'}), 'editorial-luxury');
 const plan=planGraphicArt(d,1080,1350,{productBox:{x:0.4,y:0.4,width:0.45,height:0.45},copySafe:{x:0.04,y:0.04,width:0.35,height:0.4}});
 assert.equal(plan.showCta,false);
 assert.equal(plan.ctaStyle,'none');
 assert.ok(plan.placement.headline.x+plan.placement.headline.width < plan.productAvoid.x+40 || plan.placement.headline.y+plan.placement.headline.height < plan.productAvoid.y+20);
 assert.match(plan.typography.headline.family,/EB Garamond|Newsreader/);
 assert.ok(plan.typography.brand.size>=14,'brand mark must not be a whisper');
 assert.ok(plan.placement.body,'supporting copy stays in the type stack');
 assert.ok(Math.abs(plan.placement.body.x-plan.placement.headline.x)<40,'body aligns with headline column');
});

test('bakery food-editorial prefers refined-product and quiet text-link CTA',()=>{
 const d=base('food-editorial',{brandName:'No Crumbs Bakery',headline:'Leave Nothing Behind',body:'Share the last bite.',cta:'Taste the real thing',background:'#14110f',graphic:{showCta:true}});
 assert.equal(selectGraphicStrategy(d,{tone:'Warm shareable bakery'}), 'refined-product');
 const plan=planGraphicArt(d,1080,1350,{productBox:{x:0.3,y:0.35,width:0.4,height:0.4}});
 assert.equal(plan.showCta,true);
 assert.equal(plan.ctaStyle,'text-link');
 assert.equal(plan.veil.mode,'column');
 assert.ok(plan.veil.column);
 assert.notEqual(plan.strategy,'editorial-luxury');
 assert.match(plan.typography.headline.family,/DM Sans|Outfit|Source Sans/);
});

test('preferMeasuredProductBox favors confident measured silhouette over oversized plan',()=>{
 const measured={x:0.42,y:0.48,width:0.28,height:0.38};
 const planned={x:0.35,y:0.3,width:0.55,height:0.6};
 assert.deepEqual(preferMeasuredProductBox({productBox:measured},{productBox:planned}),measured);
});

test('fragrance editorial plan uses column veil and no CTA',()=>{
 const d=base('beauty-sensory');
 const plan=planGraphicArt(d,1080,1350,{productBox:{x:0.45,y:0.42,width:0.4,height:0.48},copySafe:{x:0.06,y:0.06,width:0.38,height:0.36}});
 assert.equal(plan.veil.mode,'column');
 assert.ok(plan.veil.column.width>100);
 assert.equal(plan.showCta,false);
 assert.ok(plan.typography.headline.size>=60);
});

test('different archetypes do not collapse to one strategy',()=>{
 const beauty=selectGraphicStrategy(base('beauty-sensory'),{tone:'quiet luxury'});
 const food=selectGraphicStrategy(base('food-editorial',{brandName:'No Crumbs Bakery'}),{tone:'warm bakery share'});
 const energy=selectGraphicStrategy(base('graphic-energy'),{tone:'athletic energy bold'});
 assert.notEqual(beauty,food);
 assert.ok(GRAPHIC_STRATEGIES.includes(beauty));
 assert.ok(GRAPHIC_STRATEGIES.includes(food));
 assert.equal(energy,'playful-expressive');
});

test('campaignSVG composite has no solid Explore button by default for beauty',()=>{
 const d=withGraphicGeometry(base('beauty-sensory'),[
  {id:'product_1',bbox:[400,400,900,900]},
  {id:'copy_space_1',bbox:[40,40,360,420]}
 ]);
 const laid=campaignSVG(d,{photo:tinyPng},1080,1350);
 assert.ok(!/Explore<\/tspan>/.test(laid.svg)||laid.graphicPlan?.showCta===false);
 // Filled accent CTA rects used the old path with height 56 — ensure no large filled accent CTA slab for luxury default.
 assert.equal(laid.graphicPlan?.showCta,false);
 assert.ok(!laid.svg.includes('Basic draft'));
});

test('spatial geometry prefers copy-safe side away from product',()=>{
 const d=withGraphicGeometry(base('beauty-sensory'),[
  {id:'product_1',bbox:[500,400,920,880]},
  {id:'copy_space_1',bbox:[40,40,340,460]}
 ]);
 const plan=planGraphicArt(d,1080,1350, {productBox:d.campaign.graphic.geometry.productBox,copySafe:d.campaign.graphic.geometry.copySafe});
 assert.ok(plan.placement.headline.x < 1080*0.45);
});

test('sanitize still strips internal copy from GAD path',()=>{
 const {design}=sanitizeExportDesign({
  ...base('beauty-sensory'),
  body:'One mounded cracked cookie in warm window light with open space for Leave Nothing Behind.'
 });
 assert.equal(design.body,'');
});

test('Green Cedar raw photo recomposes without QC burn-in',async()=>{
 const photoPath='outputs/creative-acceptance/2026-10-29T13-57-37/flux3-green-cedar/flux3-mi2i-raw.png';
 const planPath='outputs/creative-acceptance/2026-10-29T13-57-37/flux3-green-cedar/plan.json';
 let raw,plan;
 try{raw=await readFile(photoPath);plan=JSON.parse(await readFile(planPath,'utf8'));}catch{return;}
 let d=withGraphicGeometry(base('beauty-sensory'),plan.spatial.elements,{strategy:'editorial-luxury',showCta:false});
 const hints=hintsFromPngBytes(raw,d.campaign.graphic.geometry);
 const laid=campaignSVG(d,{photo:'data:image/png;base64,'+raw.toString('base64')},1080,1350,hints);
 const png=new Resvg(laid.svg,{font:resvgFontOptions()}).render().asPng();
 assert.ok(png.length>20000);
 assert.ok(!/premium-candidate|Basic draft|not a finished premium/i.test(laid.svg));
 assert.equal(laid.graphicPlan.strategy,'editorial-luxury');
});

test('typography strategies do not all share one serif stack',()=>{
 const d=base('beauty-sensory');
 const editorial=planGraphicArt({...d,campaign:{...d.campaign,graphic:{strategy:'editorial-luxury'}}},1080,1350);
 const contemporary=planGraphicArt({...d,campaign:{...d.campaign,graphic:{strategy:'contemporary-luxury'}}},1080,1350);
 const architectural=planGraphicArt({...d,campaign:{...d.campaign,graphic:{strategy:'architectural-minimal'}}},1080,1350);
 assert.notEqual(editorial.typography.headline.family,contemporary.typography.headline.family);
 assert.match(architectural.typography.headline.family,/Newsreader/);
});

test('GAD cannot launder a framing FAIL into an approved export story',async()=>{
 let raw;
 try{raw=await readFile('outputs/creative-acceptance/2026-10-29T15-31-40/flux3-green-cedar/flux3-mi2i-raw.png');}
 catch{return;}
 const framing=evaluateFramingQuality(raw,{framingMode:'full-product'});
 assert.equal(framing.verdict,'FAIL');
 // Even a beautiful GAD overlay must not change framing FAIL.
 assert.equal(framing.publishable,false);
});

test('transparent packshots compose onto an opaque approved campaign canvas',()=>{const d=base('beauty-sensory'),photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',art=campaignSVG(d,{photo},1080,1350),pixels=new Resvg(art.svg,{font:resvgFontOptions()}).render().pixels;assert.equal(pixels[3],255);assert.equal(pixels[pixels.length-1],255);});
