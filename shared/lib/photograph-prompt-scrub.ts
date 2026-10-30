/** Keep FLUX photographic prompts free of advertisement typography cues.
 * Consumer copy belongs only in GAD (post-generation). Mentions of lettering,
 * headlines, CTAs, posters or “copy fields” reliably cause gibberish text in-frame. */

const TYPOGRAPHY_CUE=/\b(lettering|typography|typeset|typeface|font|headline|tagline|slogan|caption|poster|signage|watermark|cta|call to action|marketing copy|brand lettering|graphic copy|copy field|copy-safe|copy safe|text-safe|text safe|for lettering|for typography|for type|for copy|typeset words|brand artwork|end card)\b/gi;

/** Soft photographic substitutes — never invite the model to paint words. */
export function scrubPhotographyPrompt(text:string):string{
 if(!text)return text;
 let out=text
  .replace(/\b(separately rendered|later|for later)\s+(typography|lettering|brand lettering|headline lettering|type)\b/gi,'empty open field')
  .replace(/\b(reserve|leave|keep)\s+(a\s+)?(calm|quiet|generous|narrow|open)?\s*(upper[- ]right|upper|right|left)?\s*(field|band|column|area|region)?\s*(for|of)\s+(lettering|typography|type|copy|headline|brand lettering)\b/gi,'leave a calm empty open field')
  .replace(/\bText-safe region:\s*/gi,'Open field (unlettered materials only): ')
  .replace(/\bTypography-safe region:\s*/gi,'Open field (unlettered materials only): ')
  .replace(/\bcopy_space_1\b/g,'open_field_1')
  .replace(/\bfor later (brand )?lettering\b/gi,'and must stay blank')
  .replace(/\bNo new scene headlines, CTAs, watermarks or branding\./gi,'Unlettered photograph aside from genuine product packaging printed on the reference.')
  .replace(/\bPreserve existing product labels and artwork only from the reference; consumer copy is typeset separately\./gi,'Preserve existing product packaging labels from the reference only; do not invent any other writing.')
  .replace(/\bKeep the stated copy field empty; typeset words separately\./gi,'Keep the adjacent open field empty of writing, symbols and posters.')
  .replace(/\bseparate graphic copy\b/gi,'open field')
  .replace(/\bconsumer copy\b/gi,'open field')
  .replace(TYPOGRAPHY_CUE,'open field');
 // Collapse accidental doubles after substitution.
 out=out.replace(/\bopen field(\s+open field)+\b/gi,'open field').replace(/[ \t]{2,}/g,' ').replace(/\n{3,}/g,'\n\n');
 return out.trim();
}

/** True when a photographic prompt still contains typography invitation language. */
export function photographyPromptHasTypographyCues(text:string):boolean{
 const scrubbed=scrubPhotographyPrompt(text);
 // After scrub, residual cues mean the scrubber needs extension — treat original as dirty if raw matches.
 return TYPOGRAPHY_CUE.test(text)&&TYPOGRAPHY_CUE.test(scrubbed.replace(/\bopen field\b/gi,''));
}

export function assertPhotographyPromptClean(text:string){
 const cleaned=scrubPhotographyPrompt(text);
 if(/\b(lettering|typography|headline|tagline|slogan|poster lettering|brand lettering|typeset|cta)\b/i.test(cleaned))
  throw Error('Photographic prompt still invites scene typography after scrub. Fix the compiler; no inference submitted.');
 return cleaned;
}
