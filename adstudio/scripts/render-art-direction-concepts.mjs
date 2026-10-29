/**
 * Owner-review art direction: two finished campaign PNGs from the authorized
 * four-cookie source. CPU only — no GPU, no pretended AI environments.
 *
 * A — Premium editorial: brand-color graphic poster; product as a deliberate plate.
 * B — Photographic: same-source wood extension + reframed product; type in calm zones.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFile,mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {Resvg} from '@resvg/resvg-js';

const mainRoot=resolve('C:<home>/open-ad-studio');
const prior=join(mainRoot,'outputs/creative-acceptance/2026-10-28T16-04-52/product-locked-still');
const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=resolve('outputs','creative-acceptance',stamp,'art-direction-concepts');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]||c));

await access(join(prior,'source.png'));
const sourceBytes=await readFile(join(prior,'source.png'));
assert.equal(sha(sourceBytes),'209a46b99271245e4dee4c3865b84664097081d44c4a7b211e5b11bb7ba9e3b6');
await copyFile(join(prior,'source.png'),join(out,'source.png'));
try{await copyFile(join(prior,'cutout.png'),join(out,'cutout.png'));}catch{/* optional */}

const SW=1152,SH=1536;
// Authorized product bbox from BiRefNet provenance (source pixels).
const box={x:267,y:190,width:580,height:1190};
const srcUri='data:image/png;base64,'+sourceBytes.toString('base64');
const W=1080,H=1350;

const brand='No Crumbs Bakery';
const cocoa='#24150f',cream='#f3dfbc',ink='#1a100c',warm='#9a5528';

/** Measure-ish wrap for campaign type (matches campaign-ad heuristic). */
function wrap(value,width,size){
 const measure=s=>Array.from(s).reduce((n,c)=>n+(/[MW@]/.test(c)?.95:/[ilI.,' ]/.test(c)?.28:.57)*size,0);
 const lines=[];let line='';
 for(const word of value.trim().split(/\s+/)){
  if(line&&measure(line+' '+word)>width){lines.push(line);line=word;}
  else line+=(line?' ':'')+word;
 }
 if(line)lines.push(line);return lines;
}
function textBlock(value,x,y,width,initial,family,fill,weight=400,spacing=0,maxLines=4){
 if(!value.trim())return{svg:'',bottom:y,size:initial,lines:[]};
 let size=initial,lines=[];
 for(;size>=18;size-=2){lines=wrap(value,width,size);if(lines.length<=maxLines&&lines.length*size*1.08<size*maxLines*1.15)break;}
 const svg=`<text fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}">${lines.map((l,i)=>`<tspan x="${x}" y="${y+size*.82+i*size*1.08}">${esc(l)}</tspan>`).join('')}</text>`;
 return{svg,bottom:y+lines.length*size*1.08,size,lines};
}

/**
 * Concept A — Premium editorial (graphic-design-led).
 * Brand field + negative space carry the ad; product is a framed plate, not full-bleed photo+overlay.
 */
function conceptA(){
 // Product plate: lower canvas, generous margins; cover-crop source onto plate (wood remains in plate).
 const plate={x:150,y:560,w:780,h:620};
 // Cover-fit source into plate, bias slightly toward product center.
 const cx=box.x+box.width/2,cy=box.y+box.height*0.42;
 const cover=Math.max(plate.w/SW,plate.h/SH);
 let iw=SW*cover,ih=SH*cover;
 let ix=plate.x+plate.w/2-iw*(cx/SW);
 let iy=plate.y+plate.h/2-ih*(cy/SH);
 // Keep plate filled.
 ix=Math.min(plate.x,Math.max(plate.x+plate.w-iw,ix));
 iy=Math.min(plate.y,Math.max(plate.y+plate.h-ih,iy));

 const m=72;
 const brandT=textBlock(brand.toUpperCase(),m,56,W-2*m,18,'Arial, Helvetica, sans-serif',cream,600,2.2,1);
 const head=textBlock('Leave Nothing Behind',m,118,W-2*m-40,72,'Georgia, Times New Roman, serif',cream,400,-0.6,3);
 const sub=textBlock('Four thick cookies. One shared tray.',m,head.bottom+28,W*0.72,28,'Arial, Helvetica, sans-serif',cream,400,0,2);
 // Assert type ends well above the plate.
 assert.ok(sub.bottom<plate.y-36,`Concept A type collides with product plate (${sub.bottom} vs ${plate.y})`);
 const foot=textBlock('Share the table.',m,H-78,W*0.55,22,'Arial, Helvetica, sans-serif',cream,600,0.4,1);

 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
   <clipPath id="plate"><rect x="${plate.x}" y="${plate.y}" width="${plate.w}" height="${plate.h}"/></clipPath>
   <linearGradient id="topFade" x2="0" y2="1"><stop offset="0" stop-color="${cocoa}" stop-opacity="1"/><stop offset="1" stop-color="${cocoa}" stop-opacity="0"/></linearGradient>
   <filter id="plateShadow" x="-20%" y="-10%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity=".45"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="${cocoa}"/>
  <rect x="0" y="0" width="${W}" height="8" fill="${warm}"/>
  ${brandT.svg}
  ${head.svg}
  ${sub.svg}
  <line x1="${m}" y1="${sub.bottom+36}" x2="${m+120}" y2="${sub.bottom+36}" stroke="${warm}" stroke-width="2"/>
  <g filter="url(#plateShadow)">
   <rect x="${plate.x}" y="${plate.y}" width="${plate.w}" height="${plate.h}" fill="#120c08"/>
  </g>
  <g clip-path="url(#plate)">
   <image href="${srcUri}" x="${ix}" y="${iy}" width="${iw}" height="${ih}"/>
  </g>
  <rect x="${plate.x}" y="${plate.y}" width="${plate.w}" height="${plate.h}" fill="none" stroke="${cream}" stroke-opacity=".18" stroke-width="1"/>
  ${foot.svg}
 </svg>`;
 return{svg,meta:{
  concept:'A-premium-editorial',
  method:'graphic brand field + framed photographic plate',
  rendered:['cocoa brand field','cream typography','warm rule','drop shadow under plate'],
  composited:['authorized source photograph cover-cropped into a deliberate lower plate'],
  notUsed:['AI environment','BiRefNet restage','deterministic gradient-as-photo'],
  copy:{headline:'Leave Nothing Behind',body:'Four thick cookies. One shared tray.',cta:'Share the table.'},
  productPlate:plate,
  typeClearsProduct:true
 }};
}

/**
 * Concept B — Photographic food ad.
 * Extend calm wood from the same source (blurred photographic crop — not a gradient).
 * Scale the authorized still for breathing room; reserve upper band for type.
 */
function conceptB(){
 // Sharp still entirely below the type band — no text on foil, cookies, or plate edge.
 const photoScale=0.66;
 const pw=W*photoScale,ph=pw*(SH/SW);
 const px=(W-pw)/2,py=H-ph-36;
 const typeFloor=py-32; // clear air between copy and the photographic plate

 const m=72;
 const brandT=textBlock(brand.toUpperCase(),m,48,W-2*m,16,'Arial, Helvetica, sans-serif','#fff8ef',600,2.6,1);
 const head=textBlock('Leave Nothing Behind',m,96,W-2*m-40,58,'Georgia, Times New Roman, serif','#fff8ef',400,-0.5,3);
 const sub=textBlock('Warm from the tray.',m,head.bottom+20,W*0.68,24,'Arial, Helvetica, sans-serif','#f3ebe1',400,0,2);
 assert.ok(sub.bottom<typeFloor,`Concept B type overlaps product plate (${sub.bottom} vs safe ${typeFloor})`);

 // Wood extension: blurred full-source cover (photographic material from the set).
 const bgCover=Math.max(W/SW,H/SH)*1.2;
 const bw=SW*bgCover,bh=SH*bgCover,bx=(W-bw)/2,by=(H-bh)/2;
 const veilH=Math.min(py-8,H*0.38);

 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
   <filter id="woodBlur" x="-5%" y="-5%" width="110%" height="110%">
    <feGaussianBlur stdDeviation="32"/>
    <feColorMatrix type="matrix" values="1 0 0 0 0  0 .95 0 0 0  0 0 .9 0 0  0 0 0 1 0"/>
   </filter>
   <filter id="stillShadow" x="-25%" y="-15%" width="150%" height="140%">
    <feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#000" flood-opacity=".48"/>
   </filter>
   <linearGradient id="readVeil" x2="0" y2="1">
    <stop offset="0" stop-color="#100a08" stop-opacity=".62"/>
    <stop offset=".55" stop-color="#100a08" stop-opacity=".32"/>
    <stop offset="1" stop-color="#100a08" stop-opacity="0"/>
   </linearGradient>
   <clipPath id="still"><rect x="${px}" y="${py}" width="${pw}" height="${ph}"/></clipPath>
  </defs>
  <g filter="url(#woodBlur)">
   <image href="${srcUri}" x="${bx}" y="${by}" width="${bw}" height="${bh}"/>
  </g>
  <rect width="${W}" height="${H}" fill="#1a100c" opacity=".14"/>
  <g filter="url(#stillShadow)">
   <rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="#120c08"/>
  </g>
  <g clip-path="url(#still)">
   <image href="${srcUri}" x="${px}" y="${py}" width="${pw}" height="${ph}"/>
  </g>
  <rect width="${W}" height="${veilH}" fill="url(#readVeil)"/>
  ${brandT.svg}
  ${head.svg}
  ${sub.svg}
 </svg>`;
 return{svg,meta:{
  concept:'B-photographic',
  method:'blurred same-source wood field + scaled authorized still + upper type veil',
  rendered:['typography','legibility veil','contact shadow under still'],
  composited:[
   'background = enlarged gaussian-blurred crop of the authorized photograph (wood/set material)',
   'hero still = authorized photograph scaled for breathing room (no BiRefNet cutout this pass)'
  ],
  notUsed:['AI-generated empty set','Klein environment','deterministic color gradient as “photography”'],
  copy:{headline:'Leave Nothing Behind',body:'Warm from the tray.',cta:''},
  still:{x:px,y:py,w:pw,h:ph},
  typeClearsProduct:true,
  typeFloor
 }};
}

const a=conceptA(),b=conceptB();
const aBytes=Buffer.from(new Resvg(a.svg,{fitTo:{mode:'width',value:W},font:{loadSystemFonts:true,defaultFontFamily:'Georgia'}}).render().asPng());
const bBytes=Buffer.from(new Resvg(b.svg,{fitTo:{mode:'width',value:W},font:{loadSystemFonts:true,defaultFontFamily:'Georgia'}}).render().asPng());
await writeFile(join(out,'concept-a-premium-editorial.png'),aBytes);
await writeFile(join(out,'concept-b-photographic.png'),bBytes);
await writeFile(join(out,'concept-a.svg'),a.svg);
await writeFile(join(out,'concept-b.svg'),b.svg);

const report={
 stamp,
 sourceSha256:sha(sourceBytes),
 ownerReview:true,
 visualAcceptance:'OWNER_DECIDES',
 concepts:{A:a.meta,B:b.meta},
 outputs:{
  a:join(out,'concept-a-premium-editorial.png'),
  b:join(out,'concept-b-photographic.png'),
  source:join(out,'source.png')
 },
 limits:[
  'Source is a tight overhead tray shot; native negative space is limited — breathing room requires scale-down or graphic framing.',
  'No new photographic set was AI-generated this pass (owner asked to assess designs before a GPU cycle).',
  'Concept B wood field is a blurred derivative of the same authorized photo, not a second camera setup.'
 ]
};
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
const html=`<!doctype html><meta charset="utf-8"><title>Art direction concepts</title>
<style>
 body{margin:0;background:#120e0c;color:#f3ebe1;font:16px/1.45 Georgia,serif}
 header{padding:28px 32px 8px;max-width:1200px}
 main{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:16px 32px 48px;max-width:1200px}
 figure{margin:0}
 img{width:100%;background:#000;display:block}
 figcaption{padding:12px 4px;font:13px/1.4 Arial,sans-serif;opacity:.85}
 .tag{display:inline-block;border:1px solid #9a5528;color:#f3dfbc;padding:2px 8px;font:11px Arial;letter-spacing:.08em;margin-bottom:8px}
</style>
<header>
 <div class="tag">OWNER REVIEW · NOT AUTO-ACCEPTED</div>
 <h1>Two art-directed concepts</h1>
 <p>Authorized four-cookie source. CPU layouts only. You decide visual acceptance.</p>
</header>
<main>
 <figure>
  <img src="concept-a-premium-editorial.png" alt="Concept A"/>
  <figcaption><strong>A — Premium editorial.</strong> Graphic cocoa field, deliberate product plate, type in reserved negative space. Product photograph framed — not full-bleed overlay.</figcaption>
 </figure>
 <figure>
  <img src="concept-b-photographic.png" alt="Concept B"/>
  <figcaption><strong>B — Photographic.</strong> Blurred same-source wood as environment; authorized still scaled for air; type above the cookies. No AI set, no gradient-as-photo.</figcaption>
 </figure>
</main>`;
await writeFile(join(out,'review.html'),html);
console.log(JSON.stringify({ok:true,out,a:report.outputs.a,b:report.outputs.b},null,2));
