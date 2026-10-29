import {consumerCopyIssues,promptResidue} from './consumer-copy.ts';
/** Honest quality control for composed static ads — labels drafts in UI metadata; never invents generative quality. */
import {contrast,luminance,type StaticDesign} from './static-ad.ts';
import {isInternalAdCopy,isWebsiteMetaCopy} from './creative-engine.ts';

export type AdQualityGrade='premium-candidate'|'usable'|'basic-draft';
export type AdQualityReport={
 grade:AdQualityGrade;
 score:number;
 issues:string[];
 label:string;
 method:string;
};

/** Geometry / director / QC language that must never reach a customer-facing PNG. */
export const INTERNAL_EXPORT_COPY={test:promptResidue};

export function scoreAdCopy(d:Pick<StaticDesign,'headline'|'body'|'cta'|'brandName'> & {copyEvidence?:string[];copyInternalTexts?:string[]}){
 return consumerCopyIssues(d,{approvedClaims:d.copyEvidence,internalTexts:d.copyInternalTexts});
}

export function scoreAdLayout(d:StaticDesign,opts?:{photoBox?:{x:number;y:number;width:number;height:number};canvas?:{width:number;height:number}}){
 const issues:string[]=[];
 if(contrast(d.background,d.textColor)<4.5)issues.push('Text/background contrast is below WCAG 4.5:1.');
 if(luminance(d.background)>0.08&&luminance(d.background)<0.35&&!d.campaign)issues.push('Mid-gray field risks a flat catalogue look.');
 if(d.campaign?.presentation==='editorial-original'&&luminance(d.background)>0.45&&d.campaign.archetype==='beauty-sensory')
  issues.push('Beauty campaign sits on a bright flat field; prefer a deeper mineral set.');
 const canvas=opts?.canvas,box=opts?.photoBox;
 if(canvas&&box){
  const fill=(box.width*box.height)/(canvas.width*canvas.height);
  if(fill<0.28)issues.push('Product occupies too little of the frame.');
  if(fill>0.92&&d.campaign?.presentation==='editorial-original')issues.push('Product nearly fills the frame with little room for hierarchy.');
  const cy=box.y+box.height/2,mid=canvas.height/2;
  if(Math.abs(cy-mid)<canvas.height*0.04&&box.width>canvas.width*0.55)issues.push('Product is dead-centered — catalogue paste risk.');
 }
 return issues;
}

export function evaluateAdQuality(d:StaticDesign,opts?:{photoBox?:{x:number;y:number;width:number;height:number};canvas?:{width:number;height:number}}):AdQualityReport{
 const issues=[...scoreAdCopy(d),...scoreAdLayout(d,opts)];
 const score=Math.max(0,100-issues.length*18);
 const grade:AdQualityGrade=score>=80?'premium-candidate':score>=55?'usable':'basic-draft';
 const label=grade==='premium-candidate'
  ?'Campaign still · review before publishing'
  :grade==='usable'
   ?'Usable draft · refine copy or lighting before calling it finished'
   :'Basic draft · not a finished premium advertisement';
 return {grade,score,issues,label,method:'Deterministic layout/copy heuristics; not a claim of commercial creative quality.'};
}

/** Strip or blank consumer-facing fields that still contain director / scene / QC language. */
export function sanitizeExportDesign(d:StaticDesign):{design:StaticDesign;warnings:string[];blocked:string[]}{
 const warnings:string[]=[],blocked:string[]=[];
 const clean=(value:string,field:string)=>{
  const t=(value||'').trim();
  if(!t)return '';
  if(isInternalAdCopy(t)||INTERNAL_EXPORT_COPY.test(t)||isWebsiteMetaCopy(t)){
   blocked.push(`${field} contained internal/scene language and was removed from the export.`);
   return '';
  }
  return t;
 };
 const headline=clean(d.headline,'headline')||(d.brandName||'').trim().slice(0,80);
 const body=clean(d.body||'','body');
 const cta=clean(d.cta||'','cta');
 if(!headline)warnings.push('Headline fell back to brand name after sanitizing internal copy.');
 if(blocked.length)warnings.push(...blocked);
 return {design:{...d,headline,body,cta},warnings,blocked};
}

/** Hard gate for API/export paths: refuse to ship ads with director language still in copy fields. */
export function assertExportableCampaignCopy(d:Pick<StaticDesign,'headline'|'body'|'cta'|'brandName'> & {copyEvidence?:string[];copyInternalTexts?:string[]}){
 const issues=scoreAdCopy(d);
 const fatal=issues;
 if(fatal.length)throw Error('Advertisement copy rejected at export: '+fatal.join(' '));
 return issues;
}
