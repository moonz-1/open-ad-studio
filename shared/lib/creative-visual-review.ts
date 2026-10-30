/** Practical creative review — programmatic gates + explicit saved evidence.
 * Does not invent numerical taste scores. Marks candidates NOT APPROVED with reasons.
 * When identityVerify is supplied, GEOMETRY_MISMATCH blocks approval regardless of set beauty. */
import {isInternalAdCopy} from './creative-engine.ts';
import {evaluateAdQuality,INTERNAL_EXPORT_COPY} from './ad-quality.ts';
import type {StaticDesign} from './static-ad.ts';
import type {CompositionPlan} from './composition-dynamics.ts';
import type {IdentityVerifyReport} from './product-identity-verify.ts';
import {framingBlocksPublish,type FramingQualityReport} from './framing-quality.ts';

export type CreativeVisualReview={
 approved:false|true;
 verdict:'NOT APPROVED'|'CONDITIONAL'|'APPROVED_PENDING_OWNER';
 productFidelity:string[];
 creativeQuality:string[];
 copyIssues:string[];
 notes:string[];
 method:string;
 identityVerify?:IdentityVerifyReport;
 framingQuality?:FramingQualityReport;
};

export function reviewGeneratedCampaign(opts:{
 design:StaticDesign;
 dynamics?:CompositionPlan;
 rawNotes?:string[];
 ownerRejectedPrior?:boolean;
 identityVerify?:IdentityVerifyReport;
 framingQuality?:FramingQualityReport;
}):CreativeVisualReview{
 const productFidelity:string[]=[];
 const creativeQuality:string[]=[];
 const copyIssues:string[]=[];
 const notes=[...(opts.rawNotes||[])];
 const quality=evaluateAdQuality(opts.design);
 for(const i of quality.issues){
  if(/copy|headline|body|metadata|geometry rather/i.test(i))copyIssues.push(i);
  else creativeQuality.push(i);
 }
 if(isInternalAdCopy(opts.design.headline)||isInternalAdCopy(opts.design.body||'')||INTERNAL_EXPORT_COPY.test(opts.design.headline)||INTERNAL_EXPORT_COPY.test(opts.design.body||''))
  copyIssues.push('Customer-facing copy still contains director/scene language.');
 if(opts.dynamics?.product.count===1)
  productFidelity.push('Automated count check cannot see pixels — compare visually that exactly one product unit is present.');
 if(opts.dynamics)
  productFidelity.push('Compare silhouette and surface anchors against identity reference: '+opts.dynamics.product.identityAnchors.join('; '));
 if(opts.identityVerify){
  for(const f of opts.identityVerify.findings)productFidelity.push(`[${f.category}] ${f.message}`);
  notes.push(`Identity verify verdict=${opts.identityVerify.verdict} score=${opts.identityVerify.score} aspectΔ=${(opts.identityVerify.comparisons.aspectWH.relDelta*100).toFixed(0)}%`);
 }
 if(opts.framingQuality){
  for(const f of opts.framingQuality.findings){
   if(f.severity==='block'||f.severity==='warn')productFidelity.push(`[framing:${f.code}] ${f.message}`);
  }
  notes.push(`Framing verdict=${opts.framingQuality.verdict} mode=${opts.framingQuality.framingMode}`);
  if(framingBlocksPublish(opts.framingQuality))
   notes.push('Framing/composition FAIL — typography, fonts, or unrelated PASS scores cannot repair clipped, tiny, or disconnected product staging. Regenerate an integrated photograph.');
 }
 if(opts.ownerRejectedPrior)
  creativeQuality.push('Owner previously rejected a similar kitchen-window / bread-morphology candidate — do not re-present it as best.');
 notes.push(quality.label);
 const geoBlock=opts.identityVerify?.findings.some(f=>f.severity==='block')||opts.identityVerify?.verdict==='FAIL';
 const frameBlock=opts.framingQuality?framingBlocksPublish(opts.framingQuality):false;
 const fatal=copyIssues.length>0||quality.grade==='basic-draft'||!!geoBlock||frameBlock;
 const conditional=!fatal&&(quality.grade==='usable'||productFidelity.length>1||opts.identityVerify?.verdict==='CONDITIONAL'||(opts.framingQuality?.verdict==='CONDITIONAL'||opts.framingQuality?.verdict==='UNSUPPORTED'));
 return {
  approved:false, // never auto-approve commercial taste
  verdict:fatal?'NOT APPROVED':conditional?'CONDITIONAL':'APPROVED_PENDING_OWNER',
  productFidelity,
  creativeQuality,
  copyIssues,
  notes,
  method:'Heuristic copy/layout gates + identity geometry + rendered-pixel framing (clip, margin, prominence, disconnected support). Attractive sets, installed fonts, and unrelated PASS scores cannot override GEOMETRY_MISMATCH, PRODUCT_CLIPPED, PRODUCT_TOO_SMALL, or DISCONNECTED_SUPPORT. Not owner approval or advertising-taste acceptance.',
  identityVerify:opts.identityVerify,
  framingQuality:opts.framingQuality,
 };
}
