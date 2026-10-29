/** Application art director: photographic decisions from evidence/permissions, not category recipes. */
import type {CreativeInput,CreativeContext,CreativeConcept} from './creative-engine.ts';
import type {AdvertisingStrategy} from './advertising-strategy.ts';
export function photographicDirection(input:CreativeInput,context:CreativeContext,strategy:AdvertisingStrategy,index:number):Pick<CreativeConcept,'composition'|'camera'|'environment'|'lighting'|'hierarchy'|'layout'>{
 const c=context.controls,n=index%3,style=[...context.grounding?.preferences||[],input.brand.dna.visualStyle].join(' '),material=style.match(/\b(?:walnut|wood|paper|linen|ceramic|stone|mineral|metal|fabric)\b/i)?.[0];
 const plane=material?`a restrained ${material.toLowerCase()} supporting plane (a proposed set material, not a product ingredient claim)`:'a matte neutral supporting plane';
 const settings=[`The product rests on ${plane}; quiet layered depth behind the product; no added subjects.`,`A continuous matte sweep meets ${plane}; isolate observed surface detail against a soft horizon.`,`Two broad flat tonal planes behind ${plane}; graphic separation, no props or extra product variants.`];
 const keep=c.background==='keep',clean=c.background==='clean';
 const environment=keep?'Retain the original surroundings and materials.':clean?'Clean incidental background distractions; retain the original set and materials.':settings[n];
 const composition=c.crop==='none'?'Retain complete source framing and every product edge; adjust light within that composition.':[
  'Place the complete source grouping below centre with an asymmetric supporting plane; reserve a calm upper-right field for lettering.',
  'Bring the observed surface forward while keeping all required units, packaging and identity anchors inside frame; reserve a narrow calm upper copy band.',
  'Place the intact silhouette right of centre against broad tonal planes; leave the left third quiet for separate brand lettering.',
 ][n];
 const camera=c.angle==='none'||input.intent==='enhancement'?'Match the source viewpoint; do not expose unseen faces.':'Use only a small reference-supported perspective adjustment; preserve visible proportions and avoid inventing hidden faces.';
 const lighting=[
  'One broad key from camera-left, gradual falloff and soft reflected fill; maintain a natural contact shadow beneath the product.',
  'A low grazing key across the observed surface with restrained opposing fill; reveal real texture without inventing relief.',
  'A broad soft key and controlled edge separation; keep the complete silhouette legible against the tonal planes.',
 ][n];
 return {composition,camera,environment,lighting,hierarchy:`Product first. Emphasize the owner-observed focus: ${strategy.focus} Keep the stated copy field empty; typeset words separately.`,layout:(['editorial','spotlight','poster'] as const)[n]};
}
