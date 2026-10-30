/** Framing-quality gate — inspects *rendered* product pixels, not requested layout boxes.
 * Full-product hero shots must keep the complete silhouette inside the canvas with margins.
 * Intentional close-ups are allowed only when the brief/framingMode says so.
 * Geometry identity PASS alone never implies publishable framing.
 * Passing clip/margin checks is not advertising-quality acceptance. */
import {decodePngRgba} from './png-luma.ts';
import {buildProductIdentityProfile,type NormRect,type ProductIdentityProfile} from './product-identity-profile.ts';

export type FramingMode='full-product'|'intentional-closeup';

export type FramingFinding={
 code:
  |'PRODUCT_CLIPPED'
  |'INSUFFICIENT_MARGIN'
  |'EXTREME_PLACEMENT'
  |'UNSAFE_ALT_CROP'
  |'INTENTIONAL_CLOSEUP_OK'
  |'WEAK_SEGMENTATION'
  |'FRAMING_MODE_MISMATCH'
  |'PRODUCT_TOO_SMALL'
  |'DISCONNECTED_SUPPORT'
  |'SUPPORT_REVIEW_REQUIRED';
 severity:'block'|'warn'|'info';
 message:string;
 edge?:'left'|'right'|'top'|'bottom';
 evidence?:{bandY:number;bandSpan:number;upperWidth:number;leftBoundaryContrast:number;rightBoundaryContrast:number;continuousGround:boolean};
};

export type FramingQualityReport={
 version:1;
 verdict:'PASS'|'FAIL'|'CONDITIONAL'|'UNSUPPORTED';
 publishable:false;
 framingMode:FramingMode;
 measured?:{
  bbox:NormRect;
  confidence:number;
  coverage:number;
  margins:{left:number;right:number;top:number;bottom:number};
  centroid:{x:number;y:number};
 };
 intended?:{productSafe?:NormRect;placementBias?:string};
 measurementConflict?:{originalVerdict:string;originalFindings:FramingFinding[];originalNotes:string[];independentBbox:NormRect;reason:string};
 findings:FramingFinding[];
 method:string;
 notes:string[];
};

export type FramingCheckOptions={
 framingMode?:FramingMode;
 /** Minimum normalized margin from canvas edge for full-product heroes (default 0.04). */
 minMargin?:number;
 /** Soft margin preferred for premium ads (default 0.06). */
 preferMargin?:number;
 /** Minimum product bbox height for full-product heroes (default 0.34). */
 minProductHeight?:number;
 /** Minimum product bbox area (width×height) for full-product heroes (default 0.12). */
 minProductArea?:number;
 /** Intended product-safe zone from pre-generation composition (normalized). */
 productSafe?:NormRect;
 placementBias?:string;
 productScale?:'dominant'|'balanced'|'intimate';
 /** Optional search region; default full frame. Prefer full frame so edge clipping is visible. */
 search?:NormRect;
 categoryHint?:string;
 /** When true, crop was explicitly requested in creative brief. */
 intentionalCropRequested?:boolean;
};

const luma=(r:number,g:number,b:number)=>0.2126*r+0.7152*g+0.0722*b;

/** Detect hard synthetic shelf / floating platform bands under the product when objectively flat.
 * Shelves are often absorbed into the product bbox by segmentation — look for a wide, low-variance
 * mid-tone horizontal band in the lower bbox that is much wider than the upper product mass.
 * Continuous dark photographic grounds (under-band ≈ frame background) must not false-positive. */
export function detectDisconnectedSupport(
 bytes:Uint8Array|Buffer,
 bbox:NormRect
):FramingFinding|undefined{
 const img=decodePngRgba(bytes);if(!img)return;
 const {width:w,height:h,data}=img;
 const x0=Math.max(0,Math.floor(bbox.x*w));
 const x1=Math.min(w,Math.ceil((bbox.x+bbox.width)*w));
 const y0=Math.max(0,Math.floor(bbox.y*h));
 const y1=Math.min(h,Math.ceil((bbox.y+bbox.height)*h));
 if(x1-x0<8||y1-y0<12)return;
 let bSum=0,bN=0;
 const bStep=Math.max(1,Math.floor(Math.min(w,h)/48));
 for(let x=0;x<w;x+=bStep){bSum+=luma(data[x*4],data[x*4+1],data[x*4+2]);bSum+=luma(data[((h-1)*w+x)*4],data[((h-1)*w+x)*4+1],data[((h-1)*w+x)*4+2]);bN+=2;}
 for(let y=0;y<h;y+=bStep){const i0=y*w*4,i1=((y*w)+(w-1))*4;bSum+=luma(data[i0],data[i0+1],data[i0+2]);bSum+=luma(data[i1],data[i1+1],data[i1+2]);bN+=2;}
 const bgMean=bN?bSum/bN:0;
 const thr=Math.max(22,bgMean+24);
 // Upper product mass width (exclude bottom 25% which may contain a fused ledge).
 const upperY1=y0+Math.floor((y1-y0)*0.7);
 let uMin=w,uMax=0,uCount=0;
 const step=Math.max(1,Math.floor((x1-x0)/80));
 for(let y=y0;y<upperY1;y+=step)for(let x=x0;x<x1;x+=step){
  const i=(y*w+x)*4;const Y=luma(data[i],data[i+1],data[i+2]);
  if(Y>thr){uCount++;if(x<uMin)uMin=x;if(x>uMax)uMax=x;}
 }
 const upperWidth=uCount>20?Math.max(1,uMax-uMin):Math.max(1,x1-x0);
 // Scan lower band (bottom 18% of bbox + slight below) for flat mid-tone ledge rows.
 const bandY0=y0+Math.floor((y1-y0)*0.78);
 const bandY1=Math.min(h,y1+Math.floor(h*0.02));
 let best:{span:number;mean:number;variance:number;y:number;minX:number;maxX:number}|undefined;
 for(let y=bandY0;y<bandY1;y+=Math.max(1,Math.floor((bandY1-bandY0)/6)||1)){
  let sum=0,sq=0,n=0,minX=w,maxX=0;
  for(let x=Math.max(0,x0-Math.floor(w*0.15));x<Math.min(w,x1+Math.floor(w*0.15));x+=step){
   const i=(y*w+x)*4;const Y=luma(data[i],data[i+1],data[i+2]);
   // Mid-tone ledge candidates: brighter than bg, not as bright as product highlight.
   if(Y>bgMean+18&&Y<Math.min(210,thr+70)){sum+=Y;sq+=Y*Y;n++;if(x<minX)minX=x;if(x>maxX)maxX=x;}
  }
  if(n<12)continue;
  const mean=sum/n,variance=Math.max(0,sq/n-mean*mean),span=maxX-minX;
  if(variance>140)continue;
  if(!best||span>best.span)best={span,mean,variance,y,minX,maxX};
 }
 // A vignetted/gradient tabletop can differ greatly from the frame-edge mean. Follow
 // adjacent colour steps from each candidate end to the frame, instead of demanding
 // the same luminance at both edges. A finite slab has abrupt boundaries at both ends.
 const colour=(x:number,y:number)=>{const i=(y*w+Math.max(0,Math.min(w-1,x)))*4;return [data[i],data[i+1],data[i+2]];};
 const contrastAt=(x:number,y:number,dir:number)=>{
  const inside=colour(x-dir*step,y),outside=colour(x+dir*Math.max(step,Math.floor(w*0.015)),y);
  return Math.max(...inside.map((v,i)=>Math.abs(v-outside[i])));
 };
 const smoothToEdge=(x:number,y:number,dir:number)=>{
  const hop=Math.max(1,Math.floor(w*0.004));let previous=colour(x,y);
  for(let next=x+dir*hop;next>=0&&next<w;next+=dir*hop){const c=colour(next,y);if(Math.max(...c.map((v,i)=>Math.abs(v-previous[i])))>18)return false;previous=c;}
  return true;
 };
 if(best&&best.span>upperWidth*1.35&&best.span>w*0.45&&best.mean>bgMean+22){
  const leftBoundaryContrast=contrastAt(best.minX,best.y,-1),rightBoundaryContrast=contrastAt(best.maxX,best.y,1);
  const continuousGround=smoothToEdge(best.minX,best.y,-1)&&smoothToEdge(best.maxX,best.y,1);
  const evidence={bandY:best.y/h,bandSpan:best.span/w,upperWidth:upperWidth/w,leftBoundaryContrast,rightBoundaryContrast,continuousGround};
  if(!continuousGround){
   const finiteEnds=leftBoundaryContrast>24&&rightBoundaryContrast>24;
   return finiteEnds?{
    code:'DISCONNECTED_SUPPORT',severity:'block',evidence,
    message:'A broad flat support has two abrupt visible ends. Inspect the saved photo: the support may be disconnected from the scene.'
   }:{
    code:'SUPPORT_REVIEW_REQUIRED',severity:'warn',evidence,
    message:'The automatic check cannot establish how the product meets the surface. Review the saved photo and contact shadow; no floating-product defect is established.'
   };
  }
 }
 // Floating cutout just below bbox: flat void distinct from continuous set bg.
 const baseY=Math.min(h-2,y1);
 const underY1=Math.min(h,baseY+Math.max(4,Math.floor(h*0.04)));
 let uSum=0,uN=0,uSq=0,cSum=0,cN=0;
 const contactY0=Math.max(y0,baseY-Math.floor((y1-y0)*0.08));
 for(let y=contactY0;y<baseY;y+=step)for(let x=uMin;x<=uMax;x+=step){
  const i=(y*w+x)*4;cSum+=luma(data[i],data[i+1],data[i+2]);cN++;
 }
 for(let y=baseY;y<underY1;y+=step)for(let x=uMin;x<=uMax;x+=step){
  const i=(y*w+x)*4;const Y=luma(data[i],data[i+1],data[i+2]);uSum+=Y;uSq+=Y*Y;uN++;
 }
 if(cN>8&&uN>8){
  const cMean=cSum/cN,uMean=uSum/uN,uVar=Math.max(0,uSq/uN-uMean*uMean);
  if(Math.abs(uMean-bgMean)>=22&&uMean<40&&uVar<50&&cMean>70){
   return{
    code:'SUPPORT_REVIEW_REQUIRED',severity:'warn',
    message:'A dark region beneath the product needs visual review. This measurement alone cannot distinguish a contact shadow from a gap.'
   };
  }
 }
}

/** Product extent for composed sets (two-tone walls, floor planes, soft shadows) where one border mean
 * cannot separate product from background. Background = everything reachable from the frame border through
 * small colour steps on a 128px box-averaged image; the product stays enclosed by its own outline.
 * Products whose lower surfaces match the set colour can only be under-measured by this method. */
export function measureByBorderFlood(bytes:Uint8Array|Buffer,step=8,size=128):{bbox:NormRect;coverage:number;fill:number}|undefined{
 const img=decodePngRgba(bytes);if(!img)return;
 const {width:W,height:H,data}=img;
 const S=Math.max(1,Math.floor(Math.max(W,H)/size)),w=Math.floor(W/S),h=Math.floor(H/S);if(w<16||h<16)return;
 const C=new Float32Array(w*h*3);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let r=0,g=0,b=0;for(let yy=0;yy<S;yy++)for(let xx=0;xx<S;xx++){const i=((y*S+yy)*W+(x*S+xx))*4;r+=data[i];g+=data[i+1];b+=data[i+2];}const k=(y*w+x)*3,n=S*S;C[k]=r/n;C[k+1]=g/n;C[k+2]=b/n;}
 const near=(a:number,b:number)=>Math.max(Math.abs(C[a*3]-C[b*3]),Math.abs(C[a*3+1]-C[b*3+1]),Math.abs(C[a*3+2]-C[b*3+2]))<step;
 const bg=new Uint8Array(w*h),queue:number[]=[];
 for(let x=0;x<w;x++)queue.push(x,(h-1)*w+x);
 for(let y=0;y<h;y++)queue.push(y*w,y*w+w-1);
 for(const k of queue)bg[k]=1;
 const around=(k:number)=>{const x=k%w,y=(k-x)/w;return [x>0?k-1:-1,x<w-1?k+1:-1,y>0?k-w:-1,y<h-1?k+w:-1];};
 while(queue.length){const k=queue.pop()!;for(const n of around(k))if(n>=0&&!bg[n]&&near(k,n)){bg[n]=1;queue.push(n);}}
 const seen=new Uint8Array(w*h);let best:{n:number;x0:number;y0:number;x1:number;y1:number}|undefined;
 for(let k=0;k<w*h;k++){
  if(bg[k]||seen[k])continue;
  const c={n:0,x0:w,y0:h,x1:0,y1:0},stack=[k];seen[k]=1;
  while(stack.length){const p=stack.pop()!,x=p%w,y=(p-x)/w;c.n++;if(x<c.x0)c.x0=x;if(x>c.x1)c.x1=x;if(y<c.y0)c.y0=y;if(y>c.y1)c.y1=y;for(const n of around(p))if(n>=0&&!bg[n]&&!seen[n]){seen[n]=1;stack.push(n);}}
  if(!best||c.n>best.n)best=c;
 }
 if(!best)return;
 const bw=best.x1-best.x0+1,bh=best.y1-best.y0+1,coverage=best.n/(w*h),fill=best.n/(bw*bh);
 const bbox={x:best.x0/w,y:best.y0/h,width:bw/w,height:bh/h};
 if(coverage<0.015||fill<0.3||bbox.width*bbox.height>0.8||edgeTouch(marginsFromBBox(bbox)).length>=3)return;
 return {bbox,coverage,fill};
}

function marginsFromBBox(b:NormRect){
 return {
  left:b.x,
  right:1-(b.x+b.width),
  top:b.y,
  bottom:1-(b.y+b.height),
 };
}

function edgeTouch(m:ReturnType<typeof marginsFromBBox>,eps=0.012):('left'|'right'|'top'|'bottom')[]{
 const hit:('left'|'right'|'top'|'bottom')[]=[];
 if(m.left<=eps)hit.push('left');
 if(m.right<=eps)hit.push('right');
 if(m.top<=eps)hit.push('top');
 if(m.bottom<=eps)hit.push('bottom');
 return hit;
}

/** Overlap ratio of measured product with intended safe box (0–1). */
function overlapRatio(a:NormRect,b:NormRect){
 const x0=Math.max(a.x,b.x),y0=Math.max(a.y,b.y);
 const x1=Math.min(a.x+a.width,b.x+b.width),y1=Math.min(a.y+a.height,b.y+b.height);
 const iw=Math.max(0,x1-x0),ih=Math.max(0,y1-y0);
 const area=a.width*a.height;if(area<=1e-9)return 0;
 return (iw*ih)/area;
}

/** Evaluate framing from the generated PNG bytes (pixel segmentation). */
export function evaluateFramingQuality(
 generatedBytes:Uint8Array|Buffer,
 opts:FramingCheckOptions={}
):FramingQualityReport{
 const framingMode:FramingMode=opts.framingMode
  ||(opts.intentionalCropRequested?'intentional-closeup':'full-product');
 const minMargin=opts.minMargin??0.04;
 const preferMargin=opts.preferMargin??0.06;
 const minProductHeight=opts.minProductHeight??(opts.productScale==='dominant'?0.40:opts.productScale==='intimate'?0.48:0.34);
 const minProductArea=opts.minProductArea??(opts.productScale==='dominant'?0.16:opts.productScale==='intimate'?0.22:0.12);
 const findings:FramingFinding[]=[];
 const notes:string[]=[];

 const profile=buildProductIdentityProfile(generatedBytes,{
  kind:'scene',
  categoryHint:opts.categoryHint,
  // Full-frame search so boundary clipping is not hidden by a pre-shrunk search box.
  search:opts.search||{x:0.005,y:0.005,width:0.99,height:0.99},
 });

 // A full-frame luminance box (touching 3+ edges) is set planes merged into the product, not a product
 // larger than the canvas; measure composed sets by border flood instead.
 const lumaBox=profile?.geometry.bbox,lumaUsable=!!profile&&profile.geometry.confidence>=0.28&&profile.geometry.coverage>=0.02&&edgeTouch(marginsFromBBox(lumaBox!)).length<3&&!(lumaBox!.width>0.9&&lumaBox!.height>0.9);
 const flood=lumaUsable?undefined:measureByBorderFlood(generatedBytes);
 if(!lumaUsable&&!flood){
  // Measurement uncertainty is not an observed defect. Export still requires an explicit
  // source/output-bound decision through the scene gate; this report never auto-verifies it.
  const severity='warn' as const;
  findings.push({
   code:'WEAK_SEGMENTATION',severity:severity,
   message:'Framing could not be verified automatically because the product blends with its surroundings. Compare the complete product with the original and accept or reject the saved photograph.'
  });
  return {
   version:1,
   verdict:'UNSUPPORTED',
   publishable:false,framingMode,findings,
   method:'Deterministic luminance segmentation of the delivered PNG. Requested spatial boxes are not used as proof of framing.',
   notes:['Weak segmentation — do not auto-approve framing.']
  };
 }

 const bbox=flood?flood.bbox:profile!.geometry.bbox;
 const confidence=flood?Math.min(0.6,0.35+flood.fill*0.3):profile!.geometry.confidence,coverage=flood?flood.coverage:profile!.geometry.coverage;
 if(flood)notes.push('Composed set: product extent measured by border flood (luminance segmentation merged the set planes). Product size can be under-measured when its surfaces match the set; confirm visually.');
 const m=marginsFromBBox(bbox);
 const centroid={x:bbox.x+bbox.width/2,y:bbox.y+bbox.height/2};
 const touches=edgeTouch(m);

 if(framingMode==='full-product'){
  for(const edge of touches){
   findings.push({
    code:'PRODUCT_CLIPPED',severity:'block',edge,
    message:`Product silhouette appears clipped at the ${edge} edge of the canvas — unacceptable for a full-product hero.`
   });
  }
  for(const [edge,val] of [['left',m.left],['right',m.right],['top',m.top],['bottom',m.bottom]] as const){
   if(val>0.012&&val<minMargin){
    findings.push({
     code:'INSUFFICIENT_MARGIN',severity:'block',edge,
     message:`Product breathing room on ${edge} is only ${(val*100).toFixed(1)}% (< ${(minMargin*100).toFixed(0)}% required for full-product heroes).`
    });
   }else if(val>=minMargin&&val<preferMargin){
    findings.push({
     code:'INSUFFICIENT_MARGIN',severity:'warn',edge,
     message:`Tight ${edge} margin (${(val*100).toFixed(1)}%) — prefer ≥${(preferMargin*100).toFixed(0)}% for premium full-product framing.`
    });
   }
  }
  // Extreme placement: centroid jammed into a corner with large opposite empty field.
  if(centroid.x>0.72&&m.right<preferMargin){
   findings.push({
    code:'EXTREME_PLACEMENT',severity:touches.includes('right')?'block':'warn',
    message:'Product sits extremely far right with little canvas safety — avoid defaulting every hero to the right edge.'
   });
  }
  if(centroid.x<0.28&&m.left<preferMargin){
   findings.push({
    code:'EXTREME_PLACEMENT',severity:touches.includes('left')?'block':'warn',
    message:'Product sits extremely far left with little canvas safety.'
   });
  }
  // Alternate aspect safety: if product already near edges, 4:5 or 9:16 center-crops would amputate it.
  if(m.left<0.08||m.right<0.08||m.top<0.08||m.bottom<0.08){
   findings.push({
    code:'UNSAFE_ALT_CROP',severity:'warn',
    message:'Margins are too tight for safe re-crop to alternate feed/story aspects without clipping the product.'
   });
  }
 }else{
  // Intentional close-up: clipping may be OK if brand/label still readable and brief requested it.
  if(!opts.intentionalCropRequested){
   findings.push({
    code:'FRAMING_MODE_MISMATCH',severity:'block',
    message:'intentional-closeup framingMode used without an explicit creative-brief crop request.'
   });
  }else if(touches.length){
   findings.push({
    code:'INTENTIONAL_CLOSEUP_OK',severity:'info',
    message:`Intentional close-up touches ${touches.join(', ')} — verify remaining branding/product visibility before publish.`
   });
  }
  notes.push('Close-up mode: proportion match alone does not grant publishability.');
 }

 if(opts.productSafe){
  const overlap=overlapRatio(bbox,opts.productSafe);
  if(overlap<0.55&&framingMode==='full-product'){
   findings.push({
    code:'EXTREME_PLACEMENT',severity:'warn',
    message:`Measured product overlaps intended product-safe zone by only ${(overlap*100).toFixed(0)}% — placement drifted from the planned shot.`
   });
  }
 }

 if(framingMode==='full-product'){
  const area=bbox.width*bbox.height;
  if(bbox.height<minProductHeight||area<minProductArea){
   findings.push({
    code:'PRODUCT_TOO_SMALL',severity:flood?'warn':'block',
    message:`Product prominence is too small for a full-product hero (height ${(bbox.height*100).toFixed(0)}% / area ${(area*100).toFixed(1)}%; need ≥${(minProductHeight*100).toFixed(0)}% height and ≥${(minProductArea*100).toFixed(0)}% area). Framing margins alone do not make a postage-stamp product advertising-ready.`
   });
  }else if(bbox.height<minProductHeight+0.05||area<minProductArea+0.04){
   findings.push({
    code:'PRODUCT_TOO_SMALL',severity:'warn',
    message:`Product scale is marginal for premium advertising prominence (height ${(bbox.height*100).toFixed(0)}%, area ${(area*100).toFixed(1)}%).`
   });
  }
  const support=detectDisconnectedSupport(generatedBytes,bbox);
  if(support)findings.push(support);
 }

 const blocked=findings.some(f=>f.severity==='block');
 const warned=findings.some(f=>f.severity==='warn');
 const verdict=blocked?'FAIL':warned?'CONDITIONAL':'PASS';
 if(verdict==='PASS')notes.push('Full product silhouette fits inside the frame with required margins (automation). This is not advertising-taste approval — owner review still required.');
 if(verdict==='FAIL')notes.push('Framing/composition FAIL — do not hide with typography. Regenerate an integrated photograph; layout fixtures are not substitutes.');

 return {
  version:1,
  verdict,
  publishable:false,
  framingMode,
  measured:{bbox,confidence,coverage,margins:m,centroid},
  intended:{productSafe:opts.productSafe,placementBias:opts.placementBias},
  findings,
  method:flood?'Border-flood segmentation of the delivered PNG (composed set). Requested FLUX boxes are never accepted as framing proof.':'Pixel segmentation of delivered PNG via Product Identity Profile. Requested FLUX boxes are never accepted as framing proof.',
  notes,
 };
}

/** Map framing report into creative-review / scorecard language.
 * Hard-block on FAIL or any severity:block finding. Do not treat soft UNSUPPORTED
 * (e.g. intentional-closeup weak segmentation warn) as an automatic reject — review
 * stays CONDITIONAL / owner-facing, not a silent false FAIL on valid close-up paths. */
export function framingBlocksPublish(report:FramingQualityReport){
 return report.verdict==='FAIL'||report.findings.some(f=>f.severity==='block');
}

export function framingModeFromDynamics(text:string|undefined,cropConstraint?:string):FramingMode{
 const t=`${text||''} ${cropConstraint||''}`.toLowerCase();
 if(/\b(intentional close-?up|detail crop|macro|fill the frame|extreme crop|crop into)\b/.test(t))return 'intentional-closeup';
 if(cropConstraint==='tight'&&/\b(close|detail|macro)\b/.test(t))return 'intentional-closeup';
 return 'full-product';
}

/** Helper: NormRect from FLUX 0–1000 [top,left,bottom,right] box — for *intended* zones only. */
export function normRectFromFluxBBox(bbox:[number,number,number,number]):NormRect{
 const [t,l,b,r]=bbox;
 return {x:Math.min(l,r)/1000,y:Math.min(t,b)/1000,width:Math.abs(r-l)/1000,height:Math.abs(b-t)/1000};
}

export type {ProductIdentityProfile};
