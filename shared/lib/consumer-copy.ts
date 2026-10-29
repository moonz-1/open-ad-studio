/** Consumer copy is a separate boundary from scene captions and strategy memory. */
export type ConsumerCopy={headline:string;body:string;cta:string};
export type CopyEvidence={approvedClaims?:string[];internalTexts?:string[]};
const norm=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function promptResidue(text:string){
 const s=text.trim();
 return /\b(?:CLIPTextEncode|KSampler|TextGenerate|ReferenceMultiLatent|BiRefNet|SAM3|cfg scale|denoise|safetensors|negative prompt|prompt upsampler)\b/i.test(s)
  ||/\b(?:copy space|text.safe region|negative space for|open space for|identity anchors?|owner.confirmed|model.generated typography|preserve (?:the )?(?:source|product|geometry)|no (?:invented|additional|extra) (?:products?|units?|cookies?|bottles?)|three.quarter tabletop|hero lower|camera.left|basic draft|premium.candidate|not a finished premium)\b/i.test(s)
  ||/^(?:create|generate|render)\b.{0,50}\b(?:photograph|image|scene|commercial still)\b/i.test(s)
  ||(/\b(?:place|position|frame|retain|preserve|keep)\b/i.test(s)&&/\b(?:silhouette|geometry|viewpoint|framing|count|packaging|negative space)\b/i.test(s))
  ||(/\b(?:one|single)\b.{0,70}\b(?:cookie|bottle|product|speaker)\b/i.test(s)&&/\b(?:window light|mounded|cracked|three.quarter|upper field)\b/i.test(s));
}
export function websiteCopyResidue(s:string){return /\b(?:meta description|lorem ipsum|add to cart|official site of|home page|click here|shop now online)\b/i.test(s)||/^welcome to (?:our|the) (?:website|home ?page)/i.test(s.trim());}
export function genericCopy(s:string,field:'headline'|'body'|'cta'='headline'){if(field==='cta'&&/^(?:discover more|explore the collection)\.?$/i.test(s.trim()))return false;return /^(?:write (?:a|an|your) .+|headline(?: here)?|your (?:headline|tagline)|discover more\.?|explore the collection\.?|something worth discovering\.?|make room for a moment\.?|a closer look\.?|the everyday ritual\.?|material in focus\.?|the brand statement\.?|warm table invitation\.?)$/i.test(s.trim());}
export function consumerCopyIssues(copy:ConsumerCopy,proof:CopyEvidence={}):string[]{
 const issues:string[]=[];
 for(const field of ['headline','body','cta'] as const){const s=copy[field]||'';if(!s.trim())continue;
  if(promptResidue(s))issues.push(`${field}: internal scene/model instructions are not advertising copy.`);
  if(websiteCopyResidue(s))issues.push(`${field}: website metadata is not advertising copy.`);
  if(genericCopy(s,field))issues.push(`${field}: replace the generic placeholder with reviewed consumer copy.`);
  if((proof.internalTexts||[]).some(t=>t.trim().length>=24&&norm(t)===norm(s)))issues.push(`${field}: strategy memory or scene direction was reused as consumer copy.`);
  // Specific factual promises require retained evidence; ordinary evocative language does not.
  for(const claim of unsupportedCopyClaims(s,proof.approvedClaims||[]))issues.push(`${field}: unsupported commercial claim "${claim}".`);
 }
 if(!copy.headline.trim())issues.push('headline: provide a reviewed headline or literal brand identity.');
 return [...new Set(issues)];
}
export function assertConsumerCopy(copy:ConsumerCopy,proof:CopyEvidence={}){const issues=consumerCopyIssues(copy,proof);if(issues.length)throw Error('Advertisement copy rejected: '+issues.join(' '));}

export function unsupportedCopyClaims(s:string,evidence:string[]){
 const proof=norm(evidence.join(' '));const positive=s.replace(/\b(?:do not|never|without|no unsupported)\b[^.!?\n]{0,120}/gi,' ');
 const claims=positive.match(/\b(?:clinically (?:proven|tested)|cures?\s+\w+(?:\s+\w+)?|heals?\s+\w+|award.winning|certified(?: organic)?|100%\s*(?:natural|organic|recycled)|sugar.free|waterproof|lasts all day|boosts productivity|saves energy|\d+%\s*(?:off|faster|better)|no added sugar)\b/gi)||[];
 return claims.filter(claim=>!proof.includes(norm(claim)));
}
