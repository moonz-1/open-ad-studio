import {assertConsumerCopy} from './consumer-copy.ts';
/** Campaign-surface SVG for product-safe and composite stills — authentic product pixels; brand-directed plate. */
import type {StaticDesign,StaticImages} from './static-ad.ts';
import {contrast,ink,luminance} from './static-ad.ts';
import {evaluateAdQuality,sanitizeExportDesign} from './ad-quality.ts';
import {
 ensureReadableTextColor,
 layoutHintsFromGeometry,
 planGraphicArt,
 type GraphicArtPlan,
 type PhotoLayoutHints,
} from './graphic-art-director.ts';

const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const estimate=(s:string,size:number)=>Array.from(s).reduce((n,c)=>n+((c.codePointAt(0)||0)>0x2fff?1.05:/[MW@%]/.test(c)?1:/[mw]/.test(c)?.86:/[ilI.,'!| ]/.test(c)?.3:/[\p{Lu}0-9]/u.test(c)?.79:/[frt]/.test(c)?.4:.6)*size,0);
function wrapped(value:string,width:number,size:number){const lines:string[]=[];let line='';for(const word of value.trim().split(/\s+/)){if(!word)continue;if(estimate(line+(line?' ':'')+word,size)<=width)line+=(line?' ':'')+word;else{if(line)lines.push(line);line='';for(const c of Array.from(word)){if(estimate(line+c,size)>width&&line){lines.push(line);line='';}line+=c;}}}if(line)lines.push(line);return lines;}
function mix(a:string,b:string,t:number){const parse=(c:string)=>c.slice(1).match(/../g)!.map(s=>parseInt(s,16));const A=parse(a),B=parse(b);return '#'+[0,1,2].map(i=>Math.round(A[i]+(B[i]-A[i])*t).toString(16).padStart(2,'0')).join('');}
function fitContain(iw:number,ih:number,bw:number,bh:number){const s=Math.min(bw/Math.max(1,iw),bh/Math.max(1,ih));const w=Math.max(1,Math.round(iw*s)),h=Math.max(1,Math.round(ih*s));return {width:w,height:h,x:Math.round((bw-w)/2),y:Math.round((bh-h)/2)};}
function fitCover(iw:number,ih:number,bw:number,bh:number){const s=Math.max(bw/Math.max(1,iw),bh/Math.max(1,ih));const w=Math.max(1,Math.round(iw*s)),h=Math.max(1,Math.round(ih*s));return {width:w,height:h,x:Math.round((bw-w)/2),y:Math.round((bh-h)/2)};}

/** Brand-directed empty-set atmosphere painted in SVG — no generative claim. */
function atmospherePlate(d:StaticDesign,w:number,h:number,parts:string[]){
 const arch=d.campaign?.archetype||'material-study';
 const deep=mix(d.background,'#050403',luminance(d.background)>.4?.55:.28);
 const lift=mix(d.background,d.accent,.22);
 const mist=mix(d.background,'#ffffff',luminance(d.background)>.35?.12:.06);
 parts.push(`<defs>
  <linearGradient id="osh-atm-v" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0%" stop-color="${escape(mix(deep,lift,.35))}"/>
   <stop offset="42%" stop-color="${escape(d.background)}"/>
   <stop offset="100%" stop-color="${escape(deep)}"/>
  </linearGradient>
  <radialGradient id="osh-atm-glow" cx="48%" cy="38%" r="58%">
   <stop offset="0%" stop-color="${escape(lift)}" stop-opacity="0.55"/>
   <stop offset="55%" stop-color="${escape(d.background)}" stop-opacity="0.12"/>
   <stop offset="100%" stop-color="${escape(deep)}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="osh-atm-floor" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0%" stop-color="${escape(deep)}" stop-opacity="0"/>
   <stop offset="40%" stop-color="${escape(mix(d.background,'#000000',.25))}" stop-opacity="0.35"/>
   <stop offset="100%" stop-color="${escape(mix(d.background,'#000000',.55))}" stop-opacity="0.92"/>
  </linearGradient>
  <linearGradient id="osh-atm-rail" x1="0" y1="0" x2="1" y2="0">
   <stop offset="0%" stop-color="${escape(mix(d.accent,deep,.4))}" stop-opacity="0"/>
   <stop offset="50%" stop-color="${escape(d.accent)}" stop-opacity="0.55"/>
   <stop offset="100%" stop-color="${escape(mix(d.accent,deep,.4))}" stop-opacity="0"/>
  </linearGradient>
 </defs>`);
 parts.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="url(#osh-atm-v)"/>`);
 parts.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="url(#osh-atm-glow)"/>`);
 if(arch==='beauty-sensory'){
  parts.push(`<ellipse cx="${w*0.72}" cy="${h*0.18}" rx="${w*0.42}" ry="${h*0.16}" fill="${escape(mist)}" opacity="0.18"/>`);
  parts.push(`<ellipse cx="${w*0.22}" cy="${h*0.55}" rx="${w*0.38}" ry="${h*0.22}" fill="${escape(mix(d.accent,deep,.5))}" opacity="0.14"/>`);
  parts.push(`<rect x="0" y="${h*0.58}" width="${w}" height="${h*0.42}" fill="url(#osh-atm-floor)"/>`);
  parts.push(`<rect x="${w*0.12}" y="${h*0.62}" width="${w*0.76}" height="2" fill="url(#osh-atm-rail)"/>`);
 }else if(arch==='food-editorial'){
  parts.push(`<rect x="0" y="${h*0.48}" width="${w}" height="${h*0.52}" fill="url(#osh-atm-floor)"/>`);
  parts.push(`<ellipse cx="${w*0.5}" cy="${h*0.72}" rx="${w*0.46}" ry="${h*0.12}" fill="${escape(mix(d.accent,'#000000',.35))}" opacity="0.25"/>`);
 }else if(arch==='graphic-energy'){
  parts.push(`<rect x="0" y="0" width="${Math.max(18,Math.round(w*0.028))}" height="${h}" fill="${escape(d.accent)}"/>`);
  parts.push(`<circle cx="${w*0.88}" cy="${h*0.12}" r="${w*0.28}" fill="${escape(lift)}" opacity="0.35"/>`);
 }else{
  parts.push(`<rect x="0" y="${h*0.55}" width="${w}" height="${h*0.45}" fill="url(#osh-atm-floor)"/>`);
  parts.push(`<rect x="${w*0.08}" y="${h*0.08}" width="${w*0.84}" height="1" fill="${escape(mix(d.accent,mist,.5))}" opacity="0.35"/>`);
 }
}

function renderTypedText(
 parts:string[],
 textBounds:{text:string;x:number;y:number;width:number;height:number;fontSize:number}[],
 warnings:string[],
 value:string,
 box:{x:number;y:number;width:number;height:number},
 initial:number,
 color:string,
 weight:number,
 tracking:number,
 family:string,
 lineHeight:number,
 transform:'none'|'uppercase',
 align:'left'|'center'|'right'
){
 if(!value.trim())return;
 const source=transform==='uppercase'?value.toUpperCase():value;
 let size=initial,lines=wrapped(source,box.width,size);
 while((lines.length*size*lineHeight>box.height||lines.some(l=>estimate(l,size)>box.width))&&size>14){size-=2;lines=wrapped(source,box.width,size);}
 if(lines.length*size*lineHeight>box.height)warnings.push('Copy was shortened to fit the layout.');
 textBounds.push({text:source,x:box.x,y:box.y,width:box.width,height:lines.length*size*lineHeight,fontSize:size});
 const anchor=align==='center'?'middle':align==='right'?'end':'start';
 const xFor=(line:string)=>{
  if(align==='center')return box.x+box.width/2;
  if(align==='right')return box.x+box.width;
  return box.x;
 };
 parts.push(`<text fill="${color}" font-family="${escape(family)}" font-size="${size}" font-weight="${weight}" letter-spacing="${tracking}" text-anchor="${anchor}">${lines.map((line,i)=>`<tspan x="${xFor(line)}" y="${box.y+size*.82+i*size*lineHeight}">${escape(line)}</tspan>`).join('')}</text>`);
}

function renderGraphicOverlay(
 d:StaticDesign,
 plan:GraphicArtPlan,
 w:number,
 h:number,
 parts:string[],
 textBounds:{text:string;x:number;y:number;width:number;height:number;fontSize:number}[],
 warnings:string[]
){
 const deep=mix(d.background,'#000000',0.55);
 // Prefer a column-local veil so the photograph remains the visual hero (not a template band).
 if(plan.veil.mode==='column'&&plan.veil.column){
  const c=plan.veil.column;
  const cx=Math.round(c.x+c.width*0.32);
  const cy=Math.round(c.y+c.height*0.28);
  const rr=Math.round(Math.max(c.width*1.15,c.height*1.05));
  parts.push(`<defs>
  <radialGradient id="osh-gad-col" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${rr}">
   <stop offset="0%" stop-color="${escape(deep)}" stop-opacity="${(plan.veil.strength*0.88).toFixed(3)}"/>
   <stop offset="42%" stop-color="${escape(deep)}" stop-opacity="${(plan.veil.strength*0.48).toFixed(3)}"/>
   <stop offset="78%" stop-color="${escape(deep)}" stop-opacity="${(plan.veil.strength*0.12).toFixed(3)}"/>
   <stop offset="100%" stop-color="${escape(d.background)}" stop-opacity="0"/>
  </radialGradient>
 </defs>`);
  // Soft ellipse — no hard panel edge competing with the photograph.
  parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${Math.round(rr*0.92)}" ry="${Math.round(rr*0.78)}" fill="url(#osh-gad-col)"/>`);
 }else{
  parts.push(`<defs>
  <linearGradient id="osh-gad-top" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0%" stop-color="${escape(deep)}" stop-opacity="${(plan.veil.strength*0.95).toFixed(3)}"/>
   <stop offset="100%" stop-color="${escape(d.background)}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="osh-gad-bot" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0%" stop-color="${escape(d.background)}" stop-opacity="0"/>
   <stop offset="100%" stop-color="${escape(deep)}" stop-opacity="${(plan.veil.strength*0.85).toFixed(3)}"/>
  </linearGradient>
 </defs>`);
  parts.push(`<rect x="0" y="0" width="${w}" height="${Math.round(h*plan.veil.top)}" fill="url(#osh-gad-top)"/>`);
  if(plan.showBody||plan.showCta||plan.veil.bottom>0.14){
   parts.push(`<rect x="0" y="${Math.round(h*(1-plan.veil.bottom))}" width="${w}" height="${Math.round(h*plan.veil.bottom)}" fill="url(#osh-gad-bot)"/>`);
  }
 }

 if(plan.accentRule){
  const ruleY=plan.placement.brand.y+plan.placement.brand.height+6;
  parts.push(`<rect x="${plan.placement.headline.x}" y="${ruleY}" width="${Math.min(72,Math.round(w*0.07))}" height="2" fill="${escape(mix(d.accent,plan.textColor,.35))}" opacity="0.85"/>`);
 }

 if(plan.showBrand&&d.brandName.trim()){
  renderTypedText(parts,textBounds,warnings,d.brandName,plan.placement.brand,plan.typography.brand.size,plan.brandColor,plan.typography.brand.weight,plan.typography.brand.tracking,plan.typography.brand.family,plan.typography.brand.lineHeight,plan.typography.brand.transform,plan.typography.brand.align);
 }
 if(d.headline.trim()){
  renderTypedText(parts,textBounds,warnings,d.headline,plan.placement.headline,plan.typography.headline.size,plan.textColor,plan.typography.headline.weight,plan.typography.headline.tracking,plan.typography.headline.family,plan.typography.headline.lineHeight,plan.typography.headline.transform,plan.typography.headline.align);
 }
 if(plan.showBody&&d.body.trim()&&plan.placement.body){
  renderTypedText(parts,textBounds,warnings,d.body,plan.placement.body,plan.typography.body.size,plan.bodyColor,plan.typography.body.weight,plan.typography.body.tracking,plan.typography.body.family,plan.typography.body.lineHeight,plan.typography.body.transform,plan.typography.body.align);
 }
 if(plan.showCta&&d.cta.trim()&&plan.placement.cta){
  const box=plan.placement.cta;
  if(plan.ctaStyle==='filled'){
   parts.push(`<rect x="${box.x}" y="${box.y}" width="${Math.min(box.width,Math.max(160,estimate(d.cta,plan.typography.cta.size)+48))}" height="${Math.round(plan.typography.cta.size*2.2)}" fill="${escape(d.accent)}"/>`);
   renderTypedText(parts,textBounds,warnings,d.cta,{...box,y:box.y+Math.round(plan.typography.cta.size*0.45),height:Math.round(plan.typography.cta.size*1.4)},plan.typography.cta.size,ink(d.accent),plan.typography.cta.weight,plan.typography.cta.tracking,plan.typography.cta.family,plan.typography.cta.lineHeight,plan.typography.cta.transform,plan.typography.cta.align);
  }else if(plan.ctaStyle==='outline'){
   const bw=Math.min(box.width,Math.max(150,estimate(d.cta,plan.typography.cta.size)+56));
   const bh=Math.round(plan.typography.cta.size*2.3);
   parts.push(`<rect x="${box.x}" y="${box.y}" width="${bw}" height="${bh}" fill="none" stroke="${escape(plan.textColor)}" stroke-width="1.5" opacity="0.85"/>`);
   renderTypedText(parts,textBounds,warnings,d.cta,{x:box.x+20,y:box.y+Math.round(bh*0.28),width:bw-40,height:bh},plan.typography.cta.size,plan.textColor,plan.typography.cta.weight,plan.typography.cta.tracking,plan.typography.cta.family,plan.typography.cta.lineHeight,plan.typography.cta.transform,'left');
  }else{
   // text-link: quiet underline, no solid button.
   renderTypedText(parts,textBounds,warnings,d.cta,box,plan.typography.cta.size,plan.textColor,plan.typography.cta.weight,plan.typography.cta.tracking,plan.typography.cta.family,plan.typography.cta.lineHeight,plan.typography.cta.transform,plan.typography.cta.align);
   const underlineW=Math.min(box.width,estimate(d.cta,plan.typography.cta.size)+4);
   parts.push(`<rect x="${box.x}" y="${box.y+plan.typography.cta.size+4}" width="${underlineW}" height="1" fill="${escape(plan.textColor)}" opacity="0.55"/>`);
  }
 }
 if(d.website&&(plan.showCta||!plan.showBody)){
  const wx=w-Math.round(w*0.07)-260,wy=h-Math.round(h*0.045);
  renderTypedText(parts,textBounds,warnings,d.website,{x:wx,y:wy,width:260,height:24},13,mix(plan.textColor,d.background,.4),500,0.5,plan.typography.body.family,1.2,'none','right');
 }
}

export function campaignSVG(dIn:StaticDesign,images:StaticImages,w:number,h:number,layoutHints?:PhotoLayoutHints){
 assertConsumerCopy(dIn,{approvedClaims:dIn.copyEvidence,internalTexts:dIn.copyInternalTexts});
 // Export boundary: never burn internal scene instructions or QC status into the customer PNG.
 const {design:d,warnings:copyWarnings}=sanitizeExportDesign(dIn);
 const parts:string[]=[],textBounds:{text:string;x:number;y:number;width:number;height:number;fontSize:number}[]=[],warnings:string[]=[...copyWarnings];
 const editorial=d.campaign?.presentation==='editorial-original';
 const arch=d.campaign?.archetype||'material-study';
 const rect=(x:number,y:number,width:number,height:number,fill:string,extra='')=>parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${extra}/>`);
 const image=(data:string|undefined,x:number,y:number,width:number,height:number,fit='xMidYMid meet')=>{if(data){if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data))throw Error('Only embedded local raster images are supported.');parts.push(`<image href="${data}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${fit}"/>`);}};

 let graphicPlan:GraphicArtPlan|undefined;

 if(editorial){
  atmospherePlate(d,w,h,parts);
  if(images.support){
   image(images.support,0,0,w,h,'xMidYMid slice');
   rect(0,0,w,h,d.background,d.supportGeneration?'opacity="0.18"':'opacity="0.55"');
  }
  // Product-safe: authentic photo in a staged zone. Soft edge blend kills white studio letterboxing.
  const stageY=arch==='beauty-sensory'?Math.round(h*0.22):Math.round(h*0.2);
  const stageH=arch==='beauty-sensory'?Math.round(h*0.58):Math.round(h*0.6);
  const photoBox={x:Math.round(w*0.08),y:stageY,width:Math.round(w*0.84),height:stageH};
  parts.push(`<ellipse cx="${w/2}" cy="${photoBox.y+photoBox.height*0.9}" rx="${photoBox.width*0.28}" ry="${h*0.03}" fill="#000000" opacity="0.32"/>`);
  parts.push(`<defs>
   <radialGradient id="osh-photo-mask" cx="50%" cy="46%" r="58%">
    <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
    <stop offset="62%" stop-color="#ffffff" stop-opacity="1"/>
    <stop offset="82%" stop-color="#ffffff" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
   </radialGradient>
   <mask id="osh-photo-soft" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">
    <rect x="0" y="0" width="${w}" height="${h}" fill="#000000"/>
    <ellipse cx="${w/2}" cy="${photoBox.y+photoBox.height*0.48}" rx="${photoBox.width*0.48}" ry="${photoBox.height*0.52}" fill="url(#osh-photo-mask)"/>
   </mask>
   <linearGradient id="osh-veil-top" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${escape(mix(d.background,'#000000',.5))}" stop-opacity="0.96"/>
    <stop offset="65%" stop-color="${escape(d.background)}" stop-opacity="0.45"/>
    <stop offset="100%" stop-color="${escape(d.background)}" stop-opacity="0"/>
   </linearGradient>
   <linearGradient id="osh-veil-bot" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${escape(d.background)}" stop-opacity="0"/>
    <stop offset="30%" stop-color="${escape(mix(d.background,'#000000',.25))}" stop-opacity="0.6"/>
    <stop offset="100%" stop-color="${escape(mix(d.background,'#000000',.6))}" stop-opacity="0.96"/>
   </linearGradient>
  </defs>`);
  parts.push(`<g mask="url(#osh-photo-soft)">`);
  image(images.photo,photoBox.x,photoBox.y,photoBox.width,photoBox.height,'xMidYMid meet');
  parts.push(`</g>`);
  parts.push(`<defs><radialGradient id="osh-pack-fade" cx="50%" cy="46%" r="56%">
   <stop offset="0%" stop-color="${escape(d.background)}" stop-opacity="0"/>
   <stop offset="48%" stop-color="${escape(d.background)}" stop-opacity="0"/>
   <stop offset="72%" stop-color="${escape(d.background)}" stop-opacity="0.55"/>
   <stop offset="100%" stop-color="${escape(d.background)}" stop-opacity="0.97"/>
  </radialGradient></defs>`);
  rect(photoBox.x,photoBox.y,photoBox.width,photoBox.height,'url(#osh-pack-fade)');
  rect(0,0,w,Math.round(h*0.3),'url(#osh-veil-top)');
  rect(0,Math.round(h*0.66),w,Math.round(h*0.34),'url(#osh-veil-bot)');
  // Editorial-original still uses GAD for type decisions (no filled CTA by default on beauty).
  const hints:PhotoLayoutHints={
   productBox:{x:photoBox.x/w,y:photoBox.y/h,width:photoBox.width/w,height:photoBox.height/h},
   copySafe:{x:0.08,y:0.05,width:0.84,height:0.18},
  };
  // Lettering sits on the painted plate, not the uncomposited source photo.
  const plateType={...d,textColor:contrast(d.background,d.textColor)>=4.5?d.textColor:ink(d.background)};
  graphicPlan=ensureReadableTextColor(planGraphicArt(plateType,w,h,hints));
  renderGraphicOverlay(d,graphicPlan,w,h,parts,textBounds,warnings);
  if(contrast(d.background,d.textColor)<4.5)warnings.push('Text/background contrast is below 4.5:1.');
  const quality=evaluateAdQuality(d,{photoBox,canvas:{width:w,height:h}});
  for(const issue of quality.issues)if(!warnings.includes(issue))warnings.push(issue);
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`,width:w,height:h,photoBox,textBounds,warnings,quality,design:d,graphicPlan};
 }

 // Composite / restaged still: full-bleed product plane + Graphic Art Director.
 const photoBox={x:0,y:0,width:w,height:h};
 // Transparent source pixels inherit the approved canvas colour, keeping final PNGs opaque.
 rect(0,0,w,h,d.background);
 image(images.photo,0,0,w,h,'xMidYMid slice');
 const hints=layoutHints||layoutHintsFromGeometry(d.campaign?.graphic?.geometry);
 graphicPlan=planGraphicArt(d,w,h,hints);
 // Prefer luma of the chosen headline zone when available.
 const headNorm={
  x:graphicPlan.placement.headline.x/w,
  y:graphicPlan.placement.headline.y/h,
  width:graphicPlan.placement.headline.width/w,
  height:graphicPlan.placement.headline.height/h
 };
 const headZone=hints.zones?.map(z=>{
  const ix=Math.max(0,Math.min(headNorm.x+headNorm.width,z.box.x+z.box.width)-Math.max(headNorm.x,z.box.x));
  const iy=Math.max(0,Math.min(headNorm.y+headNorm.height,z.box.y+z.box.height)-Math.max(headNorm.y,z.box.y));
  return {z,area:ix*iy};
 }).sort((a,b)=>b.area-a.area)[0];
 if(headZone&&headZone.area>0)graphicPlan=ensureReadableTextColor(graphicPlan,headZone.z.meanLuma);
 renderGraphicOverlay(d,graphicPlan,w,h,parts,textBounds,warnings);

 if(contrast(d.background,d.textColor)<4.5)warnings.push('Text/background contrast is below 4.5:1.');
 const quality=evaluateAdQuality(d,{photoBox,canvas:{width:w,height:h}});
 for(const issue of quality.issues)if(!warnings.includes(issue))warnings.push(issue);
 // Quality grade stays in returned metadata for the UI — never drawn into the advertising asset.

 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`,width:w,height:h,photoBox,textBounds,warnings,quality,design:d,graphicPlan};
}

export {fitContain,fitCover};
