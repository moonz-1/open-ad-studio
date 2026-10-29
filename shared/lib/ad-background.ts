import type {CreativePlan} from './creative-engine.ts';
export type AdBackground={url:string;sha256:string;width:number;height:number;seconds:number;model:string;jobId:string;provenanceId:string;prompt:string;seed:number;workflowSha256:string;assetId?:string};
// The diffusion model receives surroundings/light, never product-copy promises.
export function adBackgroundPrompt(plan:CreativePlan){
 const c=plan.concepts.find(c=>c.id===plan.selectedId);if(!c)throw Error('Choose a saved creative direction.');
 return `Photographic advertising background plate only. Empty setting: ${c.environment.slice(0,500)} Lighting: ${c.lighting.slice(0,450)}. Palette cues: ${plan.context.grounding?.palette.slice(0,3).join(', ')||'restrained neutral tones'}. Generous quiet central negative space behind a separately composited product photograph. Believable materials, coherent perspective and natural light falloff. No products, no food, no people, no packaging, no logos, no lettering, no typography. The actual product and accurate text will be added separately. Do not depict the product.`;
}
