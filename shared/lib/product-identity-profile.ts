/**
 * Product Identity Profile — image-evidence geometry and materials for advertising fidelity.
 * Deterministic analysis first. Vision-language observations are optional and must be labeled.
 * Never invent proportions from product names.
 */
import {decodePngRgba} from './png-luma.ts';

export type SilhouetteClass=
 | 'squat-wide'       // width ≫ height (e.g. short fragrance bottles)
 | 'tall-narrow'      // height ≫ width (classic tall flacons)
 | 'near-square'      // roughly equal
 | 'compact-irregular'// food / organic lumps
 | 'unknown';

export type NormRect={x:number;y:number;width:number;height:number};

export type MeasuredGeometry={
 /** Axis-aligned product bbox in normalized image coords 0–1. */
 bbox:NormRect;
 /** width / height of the product bbox (>1 = wider than tall). */
 aspectWH:number;
 /** height / width (>1 = taller than wide). */
 aspectHW:number;
 /** Body-only width/height when cap band is separated. */
 bodyAspectWH?:number;
 silhouetteClass:SilhouetteClass;
 pixelCount:number;
 coverage:number;
 confidence:number;
 method:string;
 limitations:string[];
};

export type ProductIdentityProfile={
 version:1;
 source:{width:number;height:number;sha256?:string;kind:'packshot'|'scene'|'unknown'};
 categoryHint?:string; // from owner facts — not used to invent geometry
 geometry:MeasuredGeometry;
 colors:{dominantRgb:number[];meanLuma:number;frostedLikely:boolean};
 materials:{transparencyHint:'opaque'|'frosted-translucent'|'clear'|'unknown';notes:string[]};
 components:{
  /** Heuristic cap band as fraction of product height from top, when detectable. */
  capHeightFraction?:number;
  bodyHeightFraction?:number;
  confidence:number;
  notes:string[];
 };
 identityCritical:string[];
 unknown:string[];
 /** Optional VLM text — never treated as measurement. */
 visionLanguage?:{available:false;reason:string}|{available:true;model:string;observations:string[];confidence:number};
 generatedAt:number;
};

const luma=(r:number,g:number,b:number)=>0.2126*r+0.7152*g+0.0722*b;

function classifySilhouette(aspectWH:number,irregular=false):SilhouetteClass{
 if(irregular)return 'compact-irregular';
 if(!Number.isFinite(aspectWH)||aspectWH<=0)return 'unknown';
 // Slightly wide (≥1.05) counts as squat — short fragrance bottles often sit near 1.0–1.2 once the cap is included.
 if(aspectWH>=1.05)return 'squat-wide';
 if(aspectWH<=0.82)return 'tall-narrow';
 return 'near-square';
}

/** Prefer body-only aspect when a cap band is measurable (caps inflate height and hide squat bodies).
 * Never let a weak body estimate override a clearly tall overall bbox (common failure mode). */
function refineSilhouetteClass(aspectWH:number,capHeightFraction?:number,irregular=false):{silhouetteClass:SilhouetteClass;bodyAspectWH?:number}{
 if(irregular)return {silhouetteClass:'compact-irregular'};
 if(aspectWH<=0.82)return {silhouetteClass:'tall-narrow'}; // overall tall wins
 if(capHeightFraction!==undefined&&capHeightFraction>0.08&&capHeightFraction<0.55){
  const bodyAspectWH=aspectWH/Math.max(0.35,1-capHeightFraction);
  // Cap-inflated near-square overall → body can prove squat (reference fragrance bottles).
  if(aspectWH>=0.9&&bodyAspectWH>=1.12)return {silhouetteClass:'squat-wide',bodyAspectWH};
  if(bodyAspectWH<=0.85)return {silhouetteClass:'tall-narrow',bodyAspectWH};
  return {silhouetteClass:classifySilhouette(aspectWH),bodyAspectWH};
 }
 return {silhouetteClass:classifySilhouette(aspectWH)};
}

/** Foreground mask for high-contrast packshots (dark or light studio) and simple scenes. */
export function measureProductGeometry(
 bytes:Uint8Array|Buffer,
 opts?:{search?:NormRect;bgMode?:'auto'|'dark'|'light';minCoverage?:number}
):MeasuredGeometry|null{
 const img=decodePngRgba(bytes);if(!img)return null;
 const {width:w,height:h,data}=img;
 const search=opts?.search||{x:0.02,y:0.02,width:0.96,height:0.96};
 const x0=Math.floor(search.x*w),y0=Math.floor(search.y*h);
 const x1=Math.min(w,Math.ceil((search.x+search.width)*w));
 const y1=Math.min(h,Math.ceil((search.y+search.height)*h));
 // Border sample for background estimate — prefer search-region perimeter when cropped to a product box.
 const border:number[]=[];
 const sampleBorder=(x:number,y:number)=>{
  const xx=Math.max(0,Math.min(w-1,x)),yy=Math.max(0,Math.min(h-1,y));
  const i=(yy*w+xx)*4;border.push(luma(data[i],data[i+1],data[i+2]));
 };
 const useSearchBorder=!!opts?.search;
 if(useSearchBorder){
  for(let x=x0;x<x1;x+=Math.max(1,Math.floor((x1-x0)/48))){sampleBorder(x,y0);sampleBorder(x,y1-1);}
  for(let y=y0;y<y1;y+=Math.max(1,Math.floor((y1-y0)/48))){sampleBorder(x0,y);sampleBorder(x1-1,y);}
 }else{
  for(let x=0;x<w;x+=Math.max(1,Math.floor(w/64))){sampleBorder(x,0);sampleBorder(x,h-1);}
  for(let y=0;y<h;y+=Math.max(1,Math.floor(h/64))){sampleBorder(0,y);sampleBorder(w-1,y);}
 }
 const bgMean=border.reduce((a,b)=>a+b,0)/Math.max(1,border.length);
 const mode=opts?.bgMode||'auto';
 const darkBg=mode==='dark'||(mode==='auto'&&bgMean<80);
 const lightBg=mode==='light'||(mode==='auto'&&bgMean>200);
 const thr=darkBg?28:lightBg?40:38;
 // Local median inside search — frosted products on mid-tone sets are often the brighter mass.
 const samples:number[]=[];
 const probe=Math.max(1,Math.floor(Math.min(x1-x0,y1-y0)/64));
 for(let y=y0;y<y1;y+=probe)for(let x=x0;x<x1;x+=probe){
  const i=(y*w+x)*4;if(data[i+3]<20)continue;samples.push(luma(data[i],data[i+1],data[i+2]));
 }
 samples.sort((a,b)=>a-b);
 const localMedian=samples.length?samples[Math.floor(samples.length*0.5)]:bgMean;
 let minX=w,minY=h,maxX=0,maxY=0,count=0;
 const step=Math.max(1,Math.floor(Math.min(w,h)/512));
 for(let y=y0;y<y1;y+=step)for(let x=x0;x<x1;x+=step){
  const i=(y*w+x)*4;
  const Y=luma(data[i],data[i+1],data[i+2]);
  const a=data[i+3];
  if(a<20)continue;
  let fg=false;
  if(darkBg)fg=Y>bgMean+thr;
  else if(lightBg)fg=Y<bgMean-thr;
  else if(useSearchBorder)fg=Y>localMedian+18||Y>bgMean+thr;
  else fg=Math.abs(Y-bgMean)>thr+8;
  if(!fg)continue;
  count++;
  if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
 }
 const minCov=opts?.minCoverage??0.01;
 const coverage=count/((w*h)/(step*step));
 if(count<50||maxX<=minX||maxY<=minY||coverage<minCov){
  return null;
 }
 // Expand bbox slightly for step undersampling
 const pad=step*2;
 minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);
 maxX=Math.min(w-1,maxX+pad);maxY=Math.min(h-1,maxY+pad);
 const bw=maxX-minX+1,bh=maxY-minY+1;
 const aspectWH=bw/Math.max(1,bh);
 const aspectHW=bh/Math.max(1,bw);
 const silhouetteClass=classifySilhouette(aspectWH);
 const limitations=[
  'Axis-aligned bbox from luminance contrast — not a pixel-perfect matte.',
  'Perspective foreshortening can change apparent aspect; treat as evidence for this viewpoint.',
 ];
 if(!darkBg&&!lightBg)limitations.push('Complex background: geometry confidence reduced.');
 const confidence=darkBg||lightBg?Math.min(0.92,0.55+coverage*2):Math.min(0.7,0.35+coverage);
 return {
  bbox:{x:minX/w,y:minY/h,width:bw/w,height:bh/h},
  aspectWH,aspectHW,silhouetteClass,pixelCount:count,coverage,confidence,
  method:`luma-contrast-${darkBg?'dark-bg':lightBg?'light-bg':'mixed-bg'}-step${step}`,
  limitations
 };
}

function dominantColors(bytes:Uint8Array|Buffer,bbox:NormRect){
 const img=decodePngRgba(bytes);if(!img)return {dominantRgb:[128,128,128],meanLuma:0.5,frostedLikely:false};
 const {width:w,height:h,data}=img;
 const x0=Math.floor(bbox.x*w),y0=Math.floor(bbox.y*h);
 const x1=Math.min(w,Math.ceil((bbox.x+bbox.width)*w));
 const y1=Math.min(h,Math.ceil((bbox.y+bbox.height)*h));
 let sr=0,sg=0,sb=0,n=0,varAcc=0;const means:number[]=[];
 const step=Math.max(1,Math.floor(Math.min(x1-x0,y1-y0)/48));
 for(let y=y0;y<y1;y+=step)for(let x=x0;x<x1;x+=step){
  const i=(y*w+x)*4;if(data[i+3]<40)continue;
  sr+=data[i];sg+=data[i+1];sb+=data[i+2];n++;
  means.push(luma(data[i],data[i+1],data[i+2]));
 }
 if(!n)return {dominantRgb:[128,128,128],meanLuma:0.5,frostedLikely:false};
 const meanL=means.reduce((a,b)=>a+b,0)/means.length;
 for(const m of means)varAcc+=(m-meanL)**2;
 const variance=varAcc/means.length;
 // Frosted glass packshots often sit mid-luma with modest variance on dark bg.
 const frostedLikely=meanL>70&&meanL<210&&variance<2200;
 return {
  dominantRgb:[Math.round(sr/n),Math.round(sg/n),Math.round(sb/n)],
  meanLuma:meanL/255,
  frostedLikely
 };
}

/** Cap band: top strip of product bbox that differs in luma from body mid-band (heuristic). */
function estimateCapFraction(bytes:Uint8Array|Buffer,bbox:NormRect):{capHeightFraction?:number;bodyHeightFraction?:number;confidence:number;notes:string[]}{
 const img=decodePngRgba(bytes);if(!img)return {confidence:0,notes:['PNG decode failed']};
 const {width:w,height:h,data}=img;
 const x0=Math.floor((bbox.x+bbox.width*0.25)*w);
 const x1=Math.floor((bbox.x+bbox.width*0.75)*w);
 const y0=Math.floor(bbox.y*h);
 const y1=Math.floor((bbox.y+bbox.height)*h);
 const rows=Math.max(8,y1-y0);
 const band=Math.max(2,Math.floor(rows/12));
 const rowLuma=(yStart:number,yEnd:number)=>{
  let s=0,n=0;
  for(let y=yStart;y<yEnd;y++)for(let x=x0;x<x1;x++){const i=(y*w+x)*4;if(data[i+3]<40)continue;s+=luma(data[i],data[i+1],data[i+2]);n++;}
  return n?s/n:0;
 };
 const top=rowLuma(y0,Math.min(y1,y0+band*2));
 const mid=rowLuma(y0+Math.floor(rows*0.4),y0+Math.floor(rows*0.65));
 const delta=Math.abs(top-mid);
 if(delta<12)return {confidence:0.2,notes:['Cap/body luma separation weak — cap fraction uncertain.']};
 // Walk down until luma approaches body
 let capEnd=y0+band;
 for(let y=y0+band;y<y0+Math.floor(rows*0.55);y+=band){
  const L=rowLuma(y,y+band);
  if(Math.abs(L-mid)<delta*0.35){capEnd=y;break;}
  capEnd=y+band;
 }
 const capHeightFraction=Math.min(0.55,Math.max(0.08,(capEnd-y0)/rows));
 return {
  capHeightFraction,
  bodyHeightFraction:1-capHeightFraction,
  confidence:Math.min(0.75,0.35+delta/80),
  notes:['Cap height inferred from top-vs-body luminance bands — approximate.']
 };
}

export function buildProductIdentityProfile(
 bytes:Uint8Array|Buffer,
 opts?:{
  sha256?:string;
  kind?:ProductIdentityProfile['source']['kind'];
  categoryHint?:string;
  search?:NormRect;
  foodIrregular?:boolean;
 }
):ProductIdentityProfile|null{
 const img=decodePngRgba(bytes);if(!img)return null;
 const geometry=measureProductGeometry(bytes,{search:opts?.search});
 if(!geometry){
  return {
   version:1,
   source:{width:img.width,height:img.height,sha256:opts?.sha256,kind:opts?.kind||'unknown'},
   categoryHint:opts?.categoryHint,
   geometry:{
    bbox:{x:0,y:0,width:1,height:1},aspectWH:1,aspectHW:1,silhouetteClass:'unknown',
    pixelCount:0,coverage:0,confidence:0,method:'failed',limitations:['Could not separate product from background.']
   },
   colors:{dominantRgb:[0,0,0],meanLuma:0,frostedLikely:false},
   materials:{transparencyHint:'unknown',notes:['No reliable foreground.']},
   components:{confidence:0,notes:['No geometry.']},
   identityCritical:['MISSING_IDENTITY_EVIDENCE: foreground not measurable'],
   unknown:['silhouette','proportions','materials'],
   visionLanguage:{available:false,reason:'No vision-language model wired; deterministic analysis only.'},
   generatedAt:Date.now()
  };
 }
 const colors=dominantColors(bytes,geometry.bbox);
 const components=estimateCapFraction(bytes,geometry.bbox);
 const refined=refineSilhouetteClass(geometry.aspectWH,components.capHeightFraction,opts?.foodIrregular);
 geometry.silhouetteClass=refined.silhouetteClass;
 if(refined.bodyAspectWH!==undefined)geometry.bodyAspectWH=refined.bodyAspectWH;
 const identityCritical:string[]=[
  `silhouette:${geometry.silhouetteClass}`,
  `aspectWH:${geometry.aspectWH.toFixed(3)}`,
  `aspectHW:${geometry.aspectHW.toFixed(3)}`,
 ];
 if(geometry.bodyAspectWH!==undefined)identityCritical.push(`bodyAspectWH:${geometry.bodyAspectWH.toFixed(3)}`);
 if(components.capHeightFraction!==undefined)
  identityCritical.push(`capHeightFraction~${components.capHeightFraction.toFixed(2)}`);
 if(colors.frostedLikely)identityCritical.push('material:frosted-or-matte-midtone');

 return {
  version:1,
  source:{width:img.width,height:img.height,sha256:opts?.sha256,kind:opts?.kind||'packshot'},
  categoryHint:opts?.categoryHint,
  geometry,
  colors,
  materials:{
   transparencyHint:colors.frostedLikely?'frosted-translucent':'unknown',
   notes:colors.frostedLikely
    ?['Mid-tone low-variance body consistent with frosted/matte translucent materials (heuristic).']
    :['Material class not confidently inferred from pixels alone.']
  },
  components,
  identityCritical,
  unknown:[
   'Unseen faces / rear geometry',
   'Exact label OCR (not run in this profile)',
   ...(geometry.limitations)
  ],
  visionLanguage:{available:false,reason:'Open-weight VLM not attached in this path; measurements are deterministic image analysis only.'},
  generatedAt:Date.now()
 };
}

/** Human + model-facing identity constraints derived from measured evidence. */
export {identityConstraintLines,silhouetteForSpatial,identityAwareHeroBox,type HeroPlacementBias} from './identity-constraints.ts';
