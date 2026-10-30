// Deterministic claim repair for model advertising arguments.
// Creative wording is kept. Factual claims (health/safety, certifications,
// performance, offers, numbers) survive only when they appear verbatim in owner
// or source evidence. An unsupported phrase is removed with its joining word;
// only when the remainder is no longer a usable phrase is the field replaced
// with evidence-grounded wording. Every change is recorded. Evidence is never invented.
import type {CreativeContext} from './creative-engine.ts';
import {engages} from './advertising-strategy.ts';

export type ClaimRepair={argument:number;field:string;from:string;to:string;claims:string[];reason:string;method:'removed'|'replaced'};

const claimPattern=/\b(?:organic|vegan|cruelty[- ]free|certified|award[- ]winning|handmade|clinically(?: proven| tested)?|dermatologist[- ]tested|hypoallergenic|skin[- ]friendl(?:y|iness)|gentle and effective|non[- ]toxic|waterproof|sugar[- ]free|gluten[- ]free|freshly baked|sustainab\w*|recycl\w*|biodegradable|compostable|carbon[- ]neutral|zero[- ]waste|plastic[- ]free|guarantee\w*|eco[- ]friendly|ethical(?:ly)?|health(?:y|ier|iest)?|safe(?:ty|r|st)?|purity|cures?|heals?|proven to|doubles?|(?:long[- ])?lasting|lasts? all day|all[- ]day|sale|discount\w*|free shipping|limited time)\b|[$€£]\s?\d[\d.,]*|\b\d[\d.,]*\s?%|\b\d[\d.,]*(?:[- ]?(?:hours?|hrs?|days?|percent|x))\b/gi;
const norm=(s:string)=>s.toLowerCase().replace(/[-\s]+/g,' ').trim();

/** Business evidence the planner may cite: owner/source facts only, never inferred hypotheses. */
export function claimEvidence(context:CreativeContext){return norm(context.facts.filter(f=>f.kind==='owner'||f.kind==='source').map(f=>f.text).join(' \n '));}
/** Factual claims in text that do not appear verbatim in the evidence. */
export function unsupportedClaims(text:string,evidence:string){
 return [...new Set((text.match(claimPattern)||[]).map(m=>m.trim()).filter(m=>!evidence.includes(norm(m))))];
}

const fields=['title','idea','audienceHypothesis','tension','businessFit','feeling'] as const;
type Field=typeof fields[number];
const words=(s:string)=>s.trim().split(/\s+/).filter(Boolean).length;
const minWords:Record<Field,number>={title:2,idea:3,audienceHypothesis:3,tension:3,businessFit:4,feeling:2};
// Strategy fields share the advertising-strategy validator's 12-character minimum.
const minChars:Record<Field,number>={title:4,idea:12,audienceHypothesis:12,tension:12,businessFit:12,feeling:12};
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const dangling=/(?:^|\s)(?:and|or|&|for|of|the|a|an|with|to|in|by|about|than|that|which|who|more|most|very|truly|is|are|be|ensures?|delivers?|provides?|offers?|guarantees?)$/i;

/** Remove each unsupported phrase with its joining "and"/"or"/comma; returns '' when nothing usable remains. */
export function removeClaims(text:string,claims:string[],field:Field){
 let out=text;
 for(const claim of claims){
  const c=escape(claim).replace(/[- ]/g,'[- ]'),edge='(?![\\w-])',before=new RegExp(`\\s*(?:,|\\band\\b|\\bor\\b|&)\\s*${c}${edge}`,'i'),after=new RegExp(`(?<![\\w-])${c}\\s*(?:,|\\band\\b|\\bor\\b|&)\\s*`,'i'),alone=new RegExp(`(?<![\\w-])${c}${edge}`,'i'),last=new RegExp(`(?<![\\w-])${c}[\\s.!?]*$`,'i');
  if(before.test(out))out=out.replace(before,'');
  else if(after.test(out))out=out.replace(after,'');
  else if(last.test(out))return ''; // the claim is the sentence's object; removing it leaves a fragment
  else out=out.replace(alone,'');
 }
 out=out.replace(/\s{2,}/g,' ').replace(/\s+([,.;:!?])/g,'$1').replace(/^[\s,;:&-]+|[\s,;:&-]+$/g,'').replace(/^(?:and|or)\s+/i,'');
 if(!out||words(out)<minWords[field]||out.length<minChars[field]||dangling.test(out.replace(/[.!?]$/,'')))return '';
 return out;
}

/** Repair a flat `{arguments:[...]}` model proposal. Returns a new value; the input is not mutated. */
export function repairArgumentClaims(value:any,context:CreativeContext):{value:any;repairs:ClaimRepair[]}{
 if(!value||typeof value!=='object'||!Array.isArray(value.arguments))return {value,repairs:[]};
 const evidence=claimEvidence(context),repairs:ClaimRepair[]=[],product=context.productName||'this product',titles=new Set<string>();
 const args=value.arguments.map((arg:any,index:number)=>{
  if(!arg||typeof arg!=='object'||typeof arg.proofQuote!=='string')return arg;
  const quote=arg.proofQuote.trim(),quoteOk=quote.length>=2&&!unsupportedClaims(quote,evidence).length;
  const grounded:Record<Field,string>={
   title:quoteOk&&words(quote)>=2&&words(quote)<=6&&!titles.has(norm(quote))?quote:product.split(/\s+/).slice(0,6).join(' '),
   idea:`Let ${product} carry the brand's own promise: ${quote}.`,
   audienceHypothesis:`Customers who respond to the brand's stated promise: ${quote}.`,
   tension:`Uncertainty about what sets ${product} apart: ${quote}.`,
   businessFit:`The brand's own words, "${quote}", answer that question directly.`,
   feeling:`Curious to experience ${product} as the brand describes it.`,
  };
  const next={...arg};
  for(const field of fields){
   const text=next[field];if(typeof text!=='string')continue;
   const claims=unsupportedClaims(text,evidence);if(!claims.length)continue;
   const kept=removeClaims(text,claims,field),usable=kept&&!unsupportedClaims(kept,evidence).length&&!(field==='title'&&titles.has(norm(kept)));
   next[field]=usable?(field==='title'||field==='idea'?kept[0].toUpperCase()+kept.slice(1):kept):grounded[field];
   repairs.push({argument:index,field,from:text,to:next[field],claims,method:usable?'removed':'replaced',reason:usable?'Unsupported factual phrase removed; the remaining creative wording is the model’s own.':'Unsupported factual claim not found in owner/source evidence; replaced with evidence-grounded wording.'});
  }
  if(quoteOk&&typeof next.businessFit==='string'&&typeof next.tension==='string'&&!engages(next.businessFit+' '+next.tension,quote)){
   const from=next.businessFit;next.businessFit=grounded.businessFit;
   repairs.push({argument:index,field:'businessFit',from,to:next.businessFit,claims:[],method:'replaced',reason:'The business reason did not use its cited evidence; replaced with the brand’s own words.'});
  }
  if(typeof next.title==='string')titles.add(norm(next.title));
  return next;
 });
 return {value:{...value,arguments:args},repairs};
}
