/**
 * Graphic Art Director — turns a campaign photograph + approved copy into a
 * brand-adaptive advertisement layout. Owns typography, placement and hierarchy.
 * Does not invent marketing copy (Codex / creative-engine owns that).
 * Browser-safe: no Node builtins. PNG luma sampling lives in png-luma.ts.
 */
import {contrast,luminance,type StaticDesign} from './static-ad.ts';

export const GRAPHIC_STRATEGIES=[
 'editorial-luxury',
 'contemporary-luxury',
 'architectural-minimal',
 'playful-expressive',
 'dramatic-cinematic',
 'refined-product',
] as const;
export type GraphicStrategyId=typeof GRAPHIC_STRATEGIES[number];

export type NormRect={x:number;y:number;width:number;height:number};
export type PixelRect={x:number;y:number;width:number;height:number};

export type GraphicDirection={
 strategy?:GraphicStrategyId|'auto';
 /** Brand/concept evidence used for strategy selection — never brand-hardcoded. */
 signals?:{tone?:string;idea?:string;energy?:string;title?:string};
 showCta?:boolean;
 showBody?:boolean;
 showBrand?:boolean;
 placement?:'auto'|'upper-left'|'upper-right'|'lower-left'|'lower-right'|'center-left';
 /** Normalized 0–1 geometry from Composition & Dynamics / spatial plan. */
 geometry?:{productBox?:NormRect;copySafe?:NormRect};
};

export type PhotoLayoutHints={
 productBox?:NormRect;
 copySafe?:NormRect;
 /** Mean luminance 0–1 for candidate zones (optional pixel analysis). */
 zones?:{id:string;box:NormRect;meanLuma:number;variance:number}[];
};

export type GraphicTypeSpec={
 family:string;
 weight:number;
 size:number;
 tracking:number;
 lineHeight:number;
 transform:'none'|'uppercase';
 align:'left'|'center'|'right';
};

export type GraphicArtPlan={
 strategy:GraphicStrategyId;
 reason:string;
 showBrand:boolean;
 showBody:boolean;
 showCta:boolean;
 ctaStyle:'none'|'text-link'|'outline'|'filled';
 textColor:string;
 brandColor:string;
 bodyColor:string;
 accentRule:boolean;
 /** Soft readability field. Prefer column-local veils so the photograph stays the hero. */
 veil:{top:number;bottom:number;strength:number;mode:'band'|'column';column?:PixelRect};
 typography:{brand:GraphicTypeSpec;headline:GraphicTypeSpec;body:GraphicTypeSpec;cta:GraphicTypeSpec};
 placement:{brand:PixelRect;headline:PixelRect;body?:PixelRect;cta?:PixelRect};
 productAvoid:PixelRect;
};

/** OFL-first stacks — paired with bundled TTFs in shared/fonts for Resvg. Avoid one generic Georgia look. */
const EDITORIAL_SERIF='"EB Garamond", "Iowan Old Style", Palatino, Georgia, serif';
const NEWS_SERIF='"Newsreader", "Source Serif 4", Georgia, serif';
const SANS='"Source Sans 3", "Segoe UI", Inter, Arial, Helvetica, sans-serif';
const DISPLAY_SANS='"Outfit", "DM Sans", "Segoe UI Semibold", Inter, Arial, sans-serif';
const PRODUCT_SANS='"DM Sans", "Source Sans 3", Inter, Arial, sans-serif';

export function isGraphicStrategy(v:unknown):v is GraphicStrategyId{
 return typeof v==='string'&&(GRAPHIC_STRATEGIES as readonly string[]).includes(v);
}

export function spatialBoxesToGeometry(elements?:{id:string;bbox:number[]}[]):GraphicDirection['geometry']|undefined{
 if(!elements?.length)return;
 const grid=1000;
 const norm=(b:number[]):NormRect=>({
  x:Math.min(b[1],b[3])/grid,y:Math.min(b[0],b[2])/grid,
  width:Math.abs(b[3]-b[1])/grid,height:Math.abs(b[2]-b[0])/grid
 });
 const product=elements.find(e=>/^product/i.test(e.id));
 const copy=elements.find(e=>/copy|type|letter/i.test(e.id));
 if(!product&&!copy)return;
 return {
  ...(product?{productBox:norm(product.bbox)}:{}),
  ...(copy?{copySafe:norm(copy.bbox)}:{}),
 };
}

/** Select a reusable graphic strategy from brand/archetype/concept signals — never brand-hardcoded. */
export function selectGraphicStrategy(d:StaticDesign,signals?:{tone?:string;idea?:string;energy?:string;title?:string}):GraphicStrategyId{
 const forced=d.campaign?.graphic?.strategy;
 if(forced&&forced!=='auto'&&isGraphicStrategy(forced))return forced;
 const arch=d.campaign?.archetype||'material-study';
 signals={...d.campaign?.graphic?.signals,...signals};
 // Exclude archetype id tokens from the free-text blob so "food-editorial" does not trip beauty "editorial".
 const blob=[d.brandName,signals?.tone,signals?.idea,signals?.energy,signals?.title].filter(Boolean).join(' ').toLowerCase();
 // Explicit brand evidence takes precedence over category defaults.
 if(/\b(dramatic|theatrical|cinematic|moody|spotlight)\b/.test(blob))return 'dramatic-cinematic';
 if(/\b(playful|expressive|energetic|fun)\b/.test(blob))return 'playful-expressive';
 if(/\b(architectural|structured|grid)\b/.test(blob))return 'architectural-minimal';
 if(/\b(contemporary|modern|minimal)\b/.test(blob))return 'contemporary-luxury';
 if(arch==='food-editorial'||/\b(bakery|cookie|kitchen|pastry|crumb|cinnamon|oven)\b/.test(blob)){
  if(/\b(playful|fun|bright|bold|energetic)\b/.test(blob))return 'playful-expressive';
  return 'refined-product';
 }
 if(arch==='graphic-energy'||/\b(sport|athletic|energy|poster)\b/.test(blob))return 'playful-expressive';
 if(arch==='beauty-sensory'||/\b(quiet|restrained|mineral|woody|botanical|fragrance|perfume|serum|parfum|luxury)\b/.test(blob)){
  if(/\b(bold|dramatic|night|cinematic|spotlight)\b/.test(blob))return 'dramatic-cinematic';
  if(/\b(architect|structure|grid|stone|cedar|material)\b/.test(blob))return 'architectural-minimal';
  if(/\b(modern|contemporary|clean|minimal)\b/.test(blob))return 'contemporary-luxury';
  return 'editorial-luxury';
 }
 if(/\b(dramatic|cinematic|shadow|moody)\b/.test(blob))return 'dramatic-cinematic';
 if(arch==='material-study')return 'architectural-minimal';
 return 'refined-product';
}

export function resolveGraphicElements(d:StaticDesign,strategy:GraphicStrategyId){
 const g=d.campaign?.graphic||{};
 const luxury=strategy==='editorial-luxury'||strategy==='contemporary-luxury'||strategy==='architectural-minimal'||strategy==='dramatic-cinematic';
 const showBrand=g.showBrand!==false;
 const showBody=g.showBody!==undefined?g.showBody:Boolean((d.body||'').trim())&&!(luxury&&(d.body||'').trim().length>90);
 // Luxury default: no CTA. Bakery/product can keep a quiet text link when CTA is present.
 const showCta=g.showCta!==undefined?g.showCta:Boolean((d.cta||'').trim())&&!luxury;
 return {showBrand,showBody:showBody&&Boolean((d.body||'').trim()),showCta:showCta&&Boolean((d.cta||'').trim())};
}

/** Prefer measured product pixels over oversized pre-gen spatial boxes when both exist. */
export function preferMeasuredProductBox(hints?:PhotoLayoutHints,geometry?:GraphicDirection['geometry']):NormRect|undefined{
 const measured=hints?.productBox,planned=geometry?.productBox;
 if(measured&&planned){
  const mArea=measured.width*measured.height,pArea=planned.width*planned.height;
  // Spatial guides are often oversized; measured silhouettes win when confident-sized.
  if(mArea>0.04&&mArea<pArea*0.92)return measured;
 }
 return measured||planned;
}

function overlaps(a:PixelRect,b:PixelRect,pad=0){
 return !(a.x+a.width+pad<=b.x||b.x+b.width+pad<=a.x||a.y+a.height+pad<=b.y||b.y+b.height+pad<=a.y);
}

function clampRect(r:PixelRect,w:number,h:number,m:number):PixelRect{
 const width=Math.min(r.width,w-2*m),height=Math.min(r.height,h-2*m);
 return {
  x:Math.max(m,Math.min(r.x,w-m-width)),
  y:Math.max(m,Math.min(r.y,h-m-height)),
  width,height
 };
}

function scoreZone(box:NormRect,product?:NormRect,copySafe?:NormRect,zone?:{meanLuma:number;variance:number},preferDarkText=false){
 let score=0;
 if(copySafe){
  const ix=Math.max(0,Math.min(box.x+box.width,copySafe.x+copySafe.width)-Math.max(box.x,copySafe.x));
  const iy=Math.max(0,Math.min(box.y+box.height,copySafe.y+copySafe.height)-Math.max(box.y,copySafe.y));
  score+= (ix*iy)/(box.width*box.height+1e-6)*40;
 }
 if(product){
  const cx=box.x+box.width/2,cy=box.y+box.height/2;
  const px=product.x+product.width/2,py=product.y+product.height/2;
  const dist=Math.hypot(cx-px,cy-py);
  score+=Math.min(30,dist*40);
  if(overlaps(
   {x:box.x,y:box.y,width:box.width,height:box.height},
   {x:product.x,y:product.y,width:product.width,height:product.height},
   0.02
  ))score-=50;
 }
 if(zone){
  // Prefer calm (low variance) fields; match luma to intended ink.
  score+=Math.max(0,18-zone.variance*40);
  if(preferDarkText)score+=zone.meanLuma*12;
  else score+=(1-zone.meanLuma)*12;
 }
 return score;
}

function candidateAnchors(placement:GraphicDirection['placement'],product?:NormRect):{id:string;box:NormRect}[]{
 const forced=placement&&placement!=='auto'?placement:undefined;
 const all:[string,NormRect][]=[
  ['upper-left',{x:0.06,y:0.06,width:0.42,height:0.28}],
  ['upper-right',{x:0.52,y:0.06,width:0.42,height:0.28}],
  ['center-left',{x:0.06,y:0.28,width:0.4,height:0.32}],
  ['lower-left',{x:0.06,y:0.62,width:0.4,height:0.24}],
  ['lower-right',{x:0.52,y:0.62,width:0.4,height:0.24}],
 ];
 if(forced)return all.filter(([id])=>id===forced).map(([id,box])=>({id,box}));
 // Bias away from product centroid.
 if(product){
  const right=product.x+product.width/2>0.5;
  const filtered=right
   ?all.filter(([id])=>id.includes('left'))
   :all.filter(([id])=>id.includes('right')||id==='upper-left');
  return filtered.map(([id,box])=>({id,box}));
 }
 return all.map(([id,box])=>({id,box}));
}

function typeFor(strategy:GraphicStrategyId,role:'brand'|'headline'|'body'|'cta',w:number,h:number):GraphicTypeSpec{
 const scale=Math.min(w,h)/1080;
 // Optical sizes tuned for feed 1080×1350 — brand mark must read as a signature, not a caption.
 if(strategy==='editorial-luxury'){
  if(role==='brand')return {family:SANS,weight:600,size:Math.round(17*scale),tracking:6.2,lineHeight:1.1,transform:'uppercase',align:'left'};
  if(role==='headline')return {family:EDITORIAL_SERIF,weight:500,size:Math.round(72*scale),tracking:-0.85,lineHeight:1.02,transform:'none',align:'left'};
  if(role==='body')return {family:SANS,weight:400,size:Math.round(17*scale),tracking:0.55,lineHeight:1.45,transform:'none',align:'left'};
  return {family:SANS,weight:500,size:Math.round(14*scale),tracking:1.8,lineHeight:1.2,transform:'none',align:'left'};
 }
 if(strategy==='contemporary-luxury'){
  if(role==='brand')return {family:DISPLAY_SANS,weight:600,size:Math.round(16*scale),tracking:5.2,lineHeight:1.1,transform:'uppercase',align:'left'};
  if(role==='headline')return {family:DISPLAY_SANS,weight:600,size:Math.round(58*scale),tracking:-1.9,lineHeight:1.02,transform:'none',align:'left'};
  if(role==='body')return {family:SANS,weight:400,size:Math.round(16*scale),tracking:0.1,lineHeight:1.42,transform:'none',align:'left'};
  return {family:DISPLAY_SANS,weight:600,size:Math.round(14*scale),tracking:1.4,lineHeight:1.2,transform:'uppercase',align:'left'};
 }
 if(strategy==='architectural-minimal'){
  if(role==='brand')return {family:SANS,weight:500,size:Math.round(15*scale),tracking:7.2,lineHeight:1.1,transform:'uppercase',align:'left'};
  if(role==='headline')return {family:NEWS_SERIF,weight:400,size:Math.round(54*scale),tracking:0.15,lineHeight:1.1,transform:'none',align:'left'};
  if(role==='body')return {family:SANS,weight:400,size:Math.round(15*scale),tracking:0.7,lineHeight:1.42,transform:'none',align:'left'};
  return {family:SANS,weight:500,size:Math.round(13*scale),tracking:2.8,lineHeight:1.2,transform:'uppercase',align:'left'};
 }
 if(strategy==='dramatic-cinematic'){
  if(role==='brand')return {family:SANS,weight:600,size:Math.round(16*scale),tracking:4.4,lineHeight:1.1,transform:'uppercase',align:'left'};
  if(role==='headline')return {family:NEWS_SERIF,weight:600,size:Math.round(68*scale),tracking:-0.7,lineHeight:1.0,transform:'none',align:'left'};
  if(role==='body')return {family:SANS,weight:400,size:Math.round(16*scale),tracking:0.2,lineHeight:1.38,transform:'none',align:'left'};
  return {family:SANS,weight:600,size:Math.round(15*scale),tracking:1.1,lineHeight:1.2,transform:'none',align:'left'};
 }
 if(strategy==='playful-expressive'){
  // Weights match bundled OFL faces (DMSans-Medium, Outfit-SemiBold) — avoid 700→serif fallback.
  if(role==='brand')return {family:PRODUCT_SANS,weight:600,size:Math.round(17*scale),tracking:1.4,lineHeight:1.1,transform:'uppercase',align:'left'};
  if(role==='headline')return {family:DISPLAY_SANS,weight:600,size:Math.round(60*scale),tracking:-2.0,lineHeight:1.0,transform:'none',align:'left'};
  if(role==='body')return {family:PRODUCT_SANS,weight:500,size:Math.round(18*scale),tracking:0,lineHeight:1.32,transform:'none',align:'left'};
  return {family:PRODUCT_SANS,weight:600,size:Math.round(16*scale),tracking:0.3,lineHeight:1.2,transform:'none',align:'left'};
 }
 // refined-product — warm bakery/object campaign; never a luxury-serif clone
 if(role==='brand')return {family:PRODUCT_SANS,weight:600,size:Math.round(18*scale),tracking:2.4,lineHeight:1.1,transform:'uppercase',align:'left'};
 if(role==='headline')return {family:DISPLAY_SANS,weight:600,size:Math.round(52*scale),tracking:-1.2,lineHeight:1.05,transform:'none',align:'left'};
 if(role==='body')return {family:SANS,weight:400,size:Math.round(18*scale),tracking:0.05,lineHeight:1.38,transform:'none',align:'left'};
 return {family:PRODUCT_SANS,weight:600,size:Math.round(16*scale),tracking:0.4,lineHeight:1.2,transform:'none',align:'left'};
}

export function planGraphicArt(
 d:StaticDesign,
 w:number,
 h:number,
 hints?:PhotoLayoutHints,
 signals?:{tone?:string;idea?:string;energy?:string;title?:string}
):GraphicArtPlan{
 const strategy=selectGraphicStrategy(d,signals);
 const els=resolveGraphicElements(d,strategy);
 const m=Math.round(Math.min(w,h)*0.065);
 const product=preferMeasuredProductBox(hints,d.campaign?.graphic?.geometry);
 const copySafe=hints?.copySafe||d.campaign?.graphic?.geometry?.copySafe;
 const preferDark=luminance(d.textColor)<0.45;
 const anchors=candidateAnchors(d.campaign?.graphic?.placement,product);
 let best=anchors[0],bestScore=-Infinity;
 for(const a of anchors){
  const zone=hints?.zones?.find(z=>z.id===a.id);
  const s=scoreZone(a.box,product,copySafe,zone,preferDark);
  if(s>bestScore){bestScore=s;best=a;}
 }
 const anchor=best.box;
 const productAvoid:PixelRect=product
  ?{x:Math.round(product.x*w),y:Math.round(product.y*h),width:Math.round(product.width*w),height:Math.round(product.height*h)}
  :{x:Math.round(w*0.45),y:Math.round(h*0.35),width:Math.round(w*0.5),height:Math.round(h*0.55)};

 const headlineType=typeFor(strategy,'headline',w,h);
 const brandType=typeFor(strategy,'brand',w,h);
 const bodyType=typeFor(strategy,'body',w,h);
 const ctaType=typeFor(strategy,'cta',w,h);
 const headLines=Math.max(1,Math.min(3,Math.ceil((d.headline||'').trim().split(/\s+/).length/3)));

 // Optical stack: brand → air → headline → air → body as one column in the copy-safe zone.
 const brandGap=Math.round(brandType.size*1.15);
 const headGap=Math.round(Math.max(12,bodyType.size*0.7));
 let headBox=clampRect({
  x:Math.round(anchor.x*w),
  y:Math.round(anchor.y*h)+(els.showBrand?Math.round(brandType.size*2.8):0),
  width:Math.round(Math.min(anchor.width*w,w*(strategy==='refined-product'||strategy==='playful-expressive'?0.58:0.5))),
  height:Math.round(Math.min(anchor.height*h*0.78,headlineType.size*headlineType.lineHeight*(headLines+0.35)))
 },w,h,m);
 if(overlaps(headBox,productAvoid,16)){
  const leftRoom=productAvoid.x-m;
  const rightRoom=w-m-(productAvoid.x+productAvoid.width);
  if(leftRoom>rightRoom&&leftRoom>w*0.3){
   headBox={...headBox,x:m,width:Math.min(headBox.width,leftRoom-20)};
  }else if(rightRoom>w*0.3){
   headBox={...headBox,x:productAvoid.x+productAvoid.width+20,width:Math.min(headBox.width,rightRoom-20)};
  }else{
   headBox={...headBox,y:Math.max(m,productAvoid.y-headBox.height-28)};
  }
  headBox=clampRect(headBox,w,h,m);
 }

 // Brand sits above the headline with a hard optical gap — never collide after clamping.
 const brandH=Math.round(brandType.size*1.5);
 const brandYIdeal=Math.max(m,headBox.y-brandH-Math.round(brandGap*0.85));
 let brandBox:PixelRect={
  x:headBox.x,
  y:brandYIdeal,
  width:Math.min(headBox.width,Math.round(w*0.42)),
  height:brandH
 };
 if(brandBox.y+brandBox.height+8>headBox.y){
  // Push headline down rather than stacking glyphs on top of each other.
  const shift=brandBox.y+brandBox.height+Math.round(brandType.size*0.9)-headBox.y;
  headBox=clampRect({...headBox,y:headBox.y+Math.max(0,shift)},w,h,m);
  brandBox={...brandBox,y:Math.max(m,headBox.y-brandH-Math.round(brandGap*0.85))};
 }

 let bodyBox:PixelRect|undefined;
 if(els.showBody){
  // Keep supporting copy optically under the headline — never strand it in a distant corner.
  const under={
   x:headBox.x,
   y:headBox.y+headBox.height+headGap,
   width:Math.min(headBox.width,Math.round(w*0.46)),
   height:Math.round(bodyType.size*bodyType.lineHeight*2.2)
  };
  bodyBox=clampRect(under,w,h,m);
  if(overlaps(bodyBox,productAvoid,10)){
   // Prefer shrinking the stack upward rather than teleporting body elsewhere.
   bodyBox=clampRect({
    ...under,
    y:Math.max(m,productAvoid.y-under.height-12),
    width:Math.min(under.width,Math.max(120,productAvoid.x-m-16))
   },w,h,m);
   if(overlaps(bodyBox,productAvoid,8)){
    bodyBox=clampRect({
     x:headBox.x,
     y:Math.min(headBox.y+headBox.height+8,h-m-under.height),
     width:Math.min(headBox.width,Math.round(w*0.4)),
     height:under.height
    },w,h,m);
   }
  }
  // If body still climbs into the headline, drop the supporting line rather than illegible stack.
  if(bodyBox.y<headBox.y+headBox.height+6)bodyBox=undefined;
 }

 let ctaBox:PixelRect|undefined;
 let ctaStyle:GraphicArtPlan['ctaStyle']='none';
 if(els.showCta){
  // Quiet text-link by default; outline only for playful energy — never a filled luxury button.
  ctaStyle=strategy==='playful-expressive'?'outline':'text-link';
  const stackEnd=bodyBox?bodyBox.y+bodyBox.height:headBox.y+headBox.height;
  const baseY=stackEnd+Math.round(ctaType.size*1.35);
  ctaBox=clampRect({x:headBox.x,y:baseY,width:Math.round(w*0.36),height:Math.round(ctaType.size*2.2)},w,h,m);
  if(overlaps(ctaBox,productAvoid,8))ctaBox=clampRect({...ctaBox,y:Math.min(ctaBox.y,productAvoid.y-ctaBox.height-16)},w,h,m);
  // Drop CTA when it would collide with body/headline after clamp.
  const floor=(bodyBox?bodyBox.y+bodyBox.height:headBox.y+headBox.height)+8;
  if(ctaBox.y<floor){ctaBox=undefined;ctaStyle='none';}
 }

 const showBody=Boolean(bodyBox)&&els.showBody;
 const showCta=Boolean(ctaBox)&&els.showCta&&ctaStyle!=='none';
 const luxury=strategy==='editorial-luxury'||strategy==='architectural-minimal'||strategy==='contemporary-luxury';
 // Bakery/refined needs a stronger local veil on busy crumbs; luxury photos often already provide dark wood.
 const veilStrength=strategy==='dramatic-cinematic'?0.48:strategy==='refined-product'||strategy==='playful-expressive'?0.52:strategy==='editorial-luxury'?0.26:luxury?0.28:0.34;
 // The photographed copy region, rather than the brand swatch, determines legible ink.
 const zone=hints?.zones?.find(z=>z.id===best.id);
 const sampled=zone?Math.pow(zone.meanLuma*(1-veilStrength*0.6),2.2):undefined;
 const inkContrast=(ink:string)=>sampled===undefined?Infinity:(Math.max(luminance(ink),sampled)+0.05)/(Math.min(luminance(ink),sampled)+0.05);
 const textColor=sampled!==undefined&&inkContrast(d.textColor)<4.5
  ?(inkContrast('#181c16')>=inkContrast('#f8f7ef')?'#181c16':'#f8f7ef'):d.textColor;
 const brandColor=mixHex(textColor,d.background,0.18);
 const bodyColor=mixHex(textColor,d.background,0.1);
 const stackBottom=(ctaBox?ctaBox.y+ctaBox.height:bodyBox?bodyBox.y+bodyBox.height:headBox.y+headBox.height)+Math.round(h*0.02);
 const column:PixelRect={
  x:Math.max(0,headBox.x-Math.round(w*0.035)),
  y:Math.max(0,brandBox.y-Math.round(h*0.025)),
  width:Math.min(w,Math.max(headBox.width,bodyBox?.width||0)+Math.round(w*0.08)),
  height:Math.min(h-brandBox.y,stackBottom-brandBox.y+Math.round(h*0.04))
 };

 return {
  strategy,
  reason:`${strategy} · anchor ${best.id} · ${showCta?ctaStyle:'no-cta'} · column veil · product-aware`,
  showBrand:els.showBrand,
  showBody,
  showCta,
  ctaStyle:showCta?ctaStyle:'none',
  textColor,brandColor,bodyColor,
  accentRule:strategy==='architectural-minimal'||strategy==='refined-product'||strategy==='editorial-luxury',
  veil:{
   top:0.08,
   bottom:0.06,
   strength:veilStrength,
   mode:'column',
   column
  },
  typography:{brand:brandType,headline:headlineType,body:bodyType,cta:ctaType},
  placement:{brand:brandBox,headline:headBox,body:bodyBox,cta:ctaBox},
  productAvoid
 };
}

function mixHex(a:string,b:string,t:number){
 const parse=(c:string)=>c.slice(1).match(/../g)!.map(s=>parseInt(s,16));
 const A=parse(a),B=parse(b);
 return '#'+[0,1,2].map(i=>Math.round(A[i]+(B[i]-A[i])*t).toString(16).padStart(2,'0')).join('');
}

export function layoutHintsFromGeometry(geometry?:GraphicDirection['geometry'],zones?:PhotoLayoutHints['zones']):PhotoLayoutHints{
 return {productBox:geometry?.productBox,copySafe:geometry?.copySafe,zones};
}

export function ensureReadableTextColor(plan:GraphicArtPlan,zoneLuma?:number){
 if(zoneLuma===undefined)return plan;
 const darkInk=luminance(plan.textColor)<0.45;
 const needsMore=!darkInk&&zoneLuma>0.62||darkInk&&zoneLuma<0.35;
 if(!needsMore)return plan;
 // Deepen the local veil; for column mode, strength matters more than band height.
 return {...plan,veil:{
  ...plan.veil,
  strength:Math.min(0.78,plan.veil.strength+0.22),
  top:plan.veil.mode==='column'?plan.veil.top:Math.max(plan.veil.top,0.22)
 }};
}

export function graphicStrategyLabel(id:GraphicStrategyId){
 return ({
  'editorial-luxury':'Editorial luxury',
  'contemporary-luxury':'Contemporary luxury',
  'architectural-minimal':'Architectural minimal',
  'playful-expressive':'Playful expressive',
  'dramatic-cinematic':'Dramatic cinematic',
  'refined-product':'Refined product campaign',
 } as const)[id];
}

export function validateGraphicDirection(g:unknown):GraphicDirection|undefined{
 if(g===undefined)return undefined;
 if(!g||typeof g!=='object')throw Error('Invalid graphic direction.');
 const o=g as GraphicDirection;
 if(o.strategy!==undefined&&o.strategy!=='auto'&&!isGraphicStrategy(o.strategy))throw Error('Unknown graphic strategy.');
 if(o.placement!==undefined&&!['auto','upper-left','upper-right','lower-left','lower-right','center-left'].includes(o.placement))throw Error('Unknown placement.');
 for(const k of ['showCta','showBody','showBrand'] as const)if(o[k]!==undefined&&typeof o[k]!=='boolean')throw Error('Invalid graphic toggle.');
 if(o.signals!==undefined){
  if(!o.signals||typeof o.signals!=='object'||Object.entries(o.signals).some(([k,v])=>!['tone','idea','energy','title'].includes(k)||typeof v!=='string'||v.length>2500))
   throw Error('Invalid graphic evidence signals.');
 }
 if(o.geometry!==undefined){
  if(!o.geometry||typeof o.geometry!=='object')throw Error('Invalid graphic geometry.');
  for(const box of Object.values(o.geometry) as (NormRect|undefined)[]){
   if(!box||typeof box!=='object'||![box.x,box.y,box.width,box.height].every(n=>typeof n==='number'&&Number.isFinite(n))||box.x<0||box.y<0||box.width<=0||box.height<=0||box.x+box.width>1.000001||box.y+box.height>1.000001)throw Error('Invalid graphic geometry bounds.');
  }
 }
 return o;
}

/** Attach Dynamics spatial boxes onto a campaign design for image-aware typography. */
export function withGraphicGeometry(design:StaticDesign,elements?:{id:string;bbox:number[]}[],patch?:Partial<GraphicDirection>):StaticDesign{
 const geometry=spatialBoxesToGeometry(elements);
 const graphic:GraphicDirection={...(design.campaign?.graphic||{}),...(geometry?{geometry}:{}),...patch};
 if(!design.campaign)return design;
 return {...design,campaign:{...design.campaign,graphic}};
}

export function contrastOk(bgHint:string,fg:string){return contrast(bgHint,fg)>=3;}
