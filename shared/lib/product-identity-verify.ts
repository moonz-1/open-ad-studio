/**
 * Post-generation product identity verification.
 * Compares measured reference geometry to the generated photograph.
 * Attractive sets cannot compensate for merchandise redesign.
 */
import {buildProductIdentityProfile,type ProductIdentityProfile,type NormRect,type SilhouetteClass} from './product-identity-profile.ts';
import {decodePngRgba} from './png-luma.ts';

export type FidelityFailureCategory=
 | 'GEOMETRY_MISMATCH'
 | 'LABEL_DISTORTION'
 | 'MATERIAL_MISMATCH'
 | 'MISSING_IDENTITY_EVIDENCE'
 | 'EXTRA_PRODUCT'
 | 'REFERENCE_CONFLICT'
 | 'UNSUPPORTED_VIEWPOINT';

export type IdentityVerifyFinding={
 category:FidelityFailureCategory;
 severity:'block'|'warn';
 message:string;
 evidence:Record<string,number|string|boolean|undefined>;
};

export type IdentityVerifyReport={
 version:1;
 publishable:false|true;
 verdict:'FAIL'|'CONDITIONAL'|'PASS_PENDING_OWNER';
 score:number; // 0–5 internal fidelity — never owner approval
 findings:IdentityVerifyFinding[];
 reference:ProductIdentityProfile|null;
 generated:ProductIdentityProfile|null;
 comparisons:{
  aspectWH:{ref:number;gen:number;relDelta:number};
  silhouette:{ref:SilhouetteClass;gen:SilhouetteClass;match:boolean};
  capHeightFraction?:{ref?:number;gen?:number;relDelta?:number};
 };
 method:string;
 notes:string[];
};

function relDelta(a:number,b:number){if(!a)return b?1:0;return Math.abs(a-b)/Math.abs(a);}

/** Prefer searching the intended product region when Dynamics/spatial boxes exist (0–1000 → norm). */
export function searchFromFluxBBox(bbox?:[number,number,number,number]):NormRect|undefined{
 if(!bbox||bbox.length!==4)return;
 const [t,l,b,r]=bbox;
 const pad=0.04;
 return {
  x:Math.max(0,Math.min(l,r)/1000-pad),
  y:Math.max(0,Math.min(t,b)/1000-pad),
  width:Math.min(1,Math.abs(r-l)/1000+pad*2),
  height:Math.min(1,Math.abs(b-t)/1000+pad*2)
 };
}

export function verifyProductIdentity(opts:{
 referenceBytes:Uint8Array|Buffer;
 generatedBytes:Uint8Array|Buffer;
 referenceSearch?:NormRect;
 generatedSearch?:NormRect;
 categoryHint?:string;
 foodIrregular?:boolean;
 /** Relative aspect tolerance before GEOMETRY_MISMATCH blocks (default 0.22 = 22%). */
 aspectTolerance?:number;
}):IdentityVerifyReport{
 const notes:string[]=[];
 const findings:IdentityVerifyFinding[]=[];
 const reference=buildProductIdentityProfile(opts.referenceBytes,{
  kind:'packshot',categoryHint:opts.categoryHint,search:opts.referenceSearch,foodIrregular:opts.foodIrregular
 });
 const generated=buildProductIdentityProfile(opts.generatedBytes,{
  kind:'scene',categoryHint:opts.categoryHint,search:opts.generatedSearch,foodIrregular:opts.foodIrregular
 });

 if(!reference||reference.geometry.confidence<0.25){
  findings.push({
   category:'MISSING_IDENTITY_EVIDENCE',severity:'block',
   message:'Reference product silhouette could not be measured reliably.',
   evidence:{confidence:reference?.geometry.confidence}
  });
 }
 if(!generated||generated.geometry.confidence<0.2){
  findings.push({
   category:'MISSING_IDENTITY_EVIDENCE',severity:'warn',
   message:'Generated product silhouette is uncertain (busy set). Geometry comparison degraded.',
   evidence:{confidence:generated?.geometry.confidence}
  });
  notes.push('Generated-scene measurement is harder than packshot — treat aspect delta with wider uncertainty when confidence is low.');
 }

 // Compare overall bbox aspects for geometry gate — bodyAspect is advisory for class, not a soft escape hatch.
 const refA=reference?.geometry.aspectWH??0;
 const genA=generated?.geometry.aspectWH??0;
 const aspectRel=relDelta(refA,genA);
 const refBody=reference?.geometry.bodyAspectWH;
 const genBody=generated?.geometry.bodyAspectWH;
 if(refBody!==undefined&&genBody!==undefined){
  notes.push(`Body-only aspectWH ref=${refBody.toFixed(3)} gen=${genBody.toFixed(3)} (advisory).`);
 }
 const tol=opts.aspectTolerance??0.22;
 const silMatch=!!reference&&!!generated&&reference.geometry.silhouetteClass===generated.geometry.silhouetteClass
  && reference.geometry.silhouetteClass!=='unknown';

 const comparisons:IdentityVerifyReport['comparisons']={
  aspectWH:{ref:refA,gen:genA,relDelta:aspectRel},
  silhouette:{
   ref:reference?.geometry.silhouetteClass||'unknown',
   gen:generated?.geometry.silhouetteClass||'unknown',
   match:silMatch
  }
 };

 if(reference&&generated&&reference.geometry.confidence>=0.25&&generated.geometry.confidence>=0.15){
  // Class flip (squat ↔ tall) is always a block when both confidences are usable.
  const refC=reference.geometry.silhouetteClass,genC=generated.geometry.silhouetteClass;
  if((refC==='squat-wide'&&genC==='tall-narrow')||(refC==='tall-narrow'&&genC==='squat-wide')){
   findings.push({
    category:'GEOMETRY_MISMATCH',severity:'block',
    message:`Silhouette class flipped (${refC} → ${genC}). Physical merchandise proportions were redesigned.`,
    evidence:{refAspectWH:refA,genAspectWH:genA,relDelta:aspectRel}
   });
  }else if(aspectRel>tol){
   const severity:FidelityFailureCategory='GEOMETRY_MISMATCH';
   // High-confidence packshot vs measurable gen: block. Low gen confidence: warn unless delta is extreme.
   const block=generated.geometry.confidence>=0.28||aspectRel>tol*1.6;
   findings.push({
    category:severity,severity:block?'block':'warn',
    message:`Product aspect width/height changed by ${(aspectRel*100).toFixed(0)}% (ref ${refA.toFixed(2)} → gen ${genA.toFixed(2)}; tolerance ${(tol*100).toFixed(0)}%).`,
    evidence:{refAspectWH:refA,genAspectWH:genA,relDelta:aspectRel,tolerance:tol,genConfidence:generated.geometry.confidence}
   });
  }

  if(reference.components.capHeightFraction!==undefined&&generated.components.capHeightFraction!==undefined
   &&reference.components.confidence>=0.35&&generated.components.confidence>=0.3){
   const d=relDelta(reference.components.capHeightFraction,generated.components.capHeightFraction);
   comparisons.capHeightFraction={
    ref:reference.components.capHeightFraction,
    gen:generated.components.capHeightFraction,
    relDelta:d
   };
   if(d>0.45){
    findings.push({
     category:'GEOMETRY_MISMATCH',severity:'warn',
     message:`Cap-to-body height relationship drifted by ${(d*100).toFixed(0)}%.`,
     evidence:{refCap:reference.components.capHeightFraction,genCap:generated.components.capHeightFraction,relDelta:d}
    });
   }
  }

  if(reference.materials.transparencyHint==='frosted-translucent'&&generated.materials.transparencyHint==='opaque'){
   findings.push({
    category:'MATERIAL_MISMATCH',severity:'warn',
    message:'Reference reads frosted/translucent; generated body reads opaque in the measured region.',
    evidence:{}
   });
  }
 }

 // Perspective note — we only compared same-ish frontal crops; three-quarter can shift aspect.
 notes.push('Aspect comparison assumes a compatible near-frontal product reading. Extreme viewpoint changes need UNSUPPORTED_VIEWPOINT handling, not raw bbox equality.');
 if(opts.generatedSearch)notes.push('Generated measurement restricted to provided search region (spatial/product box).');

 const blocks=findings.filter(f=>f.severity==='block');
 const warns=findings.filter(f=>f.severity==='warn');
 let score=5;
 score-=blocks.length*2;
 score-=warns.length*0.75;
 if(!silMatch&&reference&&generated)score-=1;
 score=Math.max(0,Math.min(5,Math.round(score*10)/10));

 const publishable=blocks.length===0&&score>=3.5&&silMatch;
 const verdict:IdentityVerifyReport['verdict']=blocks.length?'FAIL':!publishable?'CONDITIONAL':'PASS_PENDING_OWNER';

 return {
  version:1,
  publishable:false, // never auto-publish; publishable flag here means "automation would not block"
  verdict:blocks.length?'FAIL':verdict==='PASS_PENDING_OWNER'&&blocks.length===0&&score>=4?'PASS_PENDING_OWNER':'CONDITIONAL',
  score:blocks.length?Math.min(score,2.5):score,
  findings,
  reference,
  generated,
  comparisons,
  method:'Deterministic silhouette/aspect/cap-band comparison against identity reference. Not OCR; not owner approval. Attractive backgrounds do not raise the score.',
  notes:publishable
   ?[...notes,'Automation would not block on geometry — owner review still required.']
   :notes
 };
}

/** Patch a legacy subjective scorecard that ignored geometry. */
export function applyIdentityGateToScorecard(scorecard: {
 scores:{productFidelity:number;[k:string]:number};
 pass:boolean;
 defects?:string[];
 strengths?:string[];
},report:IdentityVerifyReport){
 const next={...scorecard,scores:{...scorecard.scores}};
 next.scores.productFidelity=Math.min(next.scores.productFidelity,report.score);
 const geo=report.findings.filter(f=>f.category==='GEOMETRY_MISMATCH');
 if(geo.length){
  next.defects=[...(next.defects||[]),...geo.map(f=>f.message)];
  next.pass=false;
 }
 if(report.verdict==='FAIL')next.pass=false;
 if(next.scores.productFidelity<4)next.pass=false;
 return {...next,identityVerify:report,pass:next.pass&&report.verdict!=='FAIL'&&next.scores.productFidelity>=4};
}

/** Quick synthetic distortion helper for evaluator unit tests (CPU). */
export function stretchPngVertical(bytes:Buffer,factorY:number):Buffer|null{
 const img=decodePngRgba(bytes);if(!img)return null;
 // Return null — callers use Resvg SVG scale for fixtures; keep API honest.
 void factorY;void img;
 return null;
}
