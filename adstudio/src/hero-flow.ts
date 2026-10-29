// Hero interaction policy only. No storage migration, inference or browser side effects.
import {newGenerationDraft,prepareConciseDraft,draftReviewed,reviewedPromptFor,effectiveControls,intentLabels,signalsFromBrand,type GenerationDraft} from '../../shared/lib/product-brief.ts';
import type {HeroSettings} from '../../shared/lib/hero-ad';
import type {BrandProfile} from '../../shared/lib/brand';
export type SaveState={saved:boolean;message:string};

// Recompile normal form edits, but never replace a manually edited/legacy prompt.
// Those drafts retain the existing explicit Advanced rebuild/compile actions.
export function syncSimpleDraft(d:GenerationDraft,previous:GenerationDraft){
 d.reviewedSnapshot=undefined;
 if(!previous.promptFormat)return d;
 const baseline=newGenerationDraft(previous.input);
 baseline.decisions=structuredClone(previous.decisions);
 prepareConciseDraft(baseline);
 if(JSON.stringify(previous.sections)!==JSON.stringify(baseline.sections)||previous.prompt!==baseline.prompt||previous.modelPrompt!==baseline.modelPrompt)return d;
 const next=newGenerationDraft(d.input);
 next.decisions=structuredClone(d.decisions);
 next.legacyPrompt=d.legacyPrompt;
 return prepareConciseDraft(next);
}
export function directionSummary(d:GenerationDraft){
 const c=effectiveControls(d.input.controls);
 return `${intentLabels[c.intent]}. ${d.decisions?.direction||'Your saved full prompt is retained in Advanced.'} ${c.exactCount?'Keep the observed count. ':''}${c.angle==='none'?'Keep the original viewpoint. ':''}${c.crop==='none'?'Keep the full original framing. ':''}${c.background==='clean'?'Tidy the existing background.':c.background==='keep'?'Keep the existing background.':'Allow a new surrounding background.'} These are requests to the model; product fidelity still needs inspection.`;
}
export function reviewedHeroPrompt(s:HeroSettings,sourceReady:boolean,brand?:BrandProfile){
 const d=s.briefDraft;
 if(!sourceReady||!d)throw Error('Restore the selected photograph before reviewing or exporting.');
 if(JSON.stringify(d.input.brand)!==JSON.stringify(brand?signalsFromBrand(brand,s.productId):undefined))throw Error('Brand changed. Refresh and review the direction again.');
 if(s.imageModel==='qwen-fp8'&&s.sourceKind!=='original')throw Error('Choose the genuine original photograph for Qwen.');
 return reviewedPromptFor(d,{sourceId:s.sourceId,sourceKind:s.sourceKind,...(s.imageModel==='qwen-fp8'?{adapter:'qwen-fp8' as const,seed:s.seed}:{adapter:'zimage-local' as const,seed:s.seed,strength:s.strength})});
}
export function heroReviewReady(s:HeroSettings,sourceReady:boolean,brand?:BrandProfile){
 try{reviewedHeroPrompt(s,sourceReady,brand);return true;}catch{return false;}
}
export function heroModelMessage(method:HeroSettings['method'],model:HeroSettings['imageModel'],ready:boolean){
 if(method==='finish')return 'Local photographic finishing selected. This does not generate an AI photograph. Choose Qwen for AI generation.';
 const name=model==='qwen-fp8'?'Qwen':'Z-Image';
 return ready?`${name} is available. Review your direction before generating; inspect product details afterward.`:`${name} generation is not ready on this connection. Review your direction and export the request JSON instead. No image has been generated.`;
}
export function heroRequestManifest(project:{id:string;name:string},s:HeroSettings,sourceReady:boolean,brand?:BrandProfile){
 const prompt=reviewedHeroPrompt(s,sourceReady,brand),qwen=s.imageModel==='qwen-fp8';
 return {version:1,ownerApproved:false,generationRun:false,project:{id:project.id,name:project.name},draft:structuredClone(s.briefDraft!),payload:{status:'REVIEW_MANIFEST_NOT_A_RUN',endpoint:qwen?'/api/hero/qwen':'/api/hero/reimagine',image:'API URL resolved from saved reference '+s.sourceId,original:qwen?'Saved original bytes; SHA256 '+s.briefDraft!.input.source.originalSha256:undefined,settings:{...structuredClone(s),method:'reimagine',prompt},framing:qwen?'Official Qwen reference scaling; preservation is a prompt request, not an enforced mask.':'Local Z-Image fixed 4:5 center crop.'}};
}
export function briefReviewMessage(d:GenerationDraft){
 if(draftReviewed(d))return 'Direction reviewed. Export the request below, or generate when the selected model is ready.';
 if(d.basis!==JSON.stringify(d.input)||d.sectionsBasis!==JSON.stringify(d.sections))return 'Saved custom brief needs updating in Advanced before review. Your edits have been kept.';
 return 'Check the photograph and source facts, then review this direction. Any later change requires review again.';
}

export function canDevelopHero(busy:boolean,s:HeroSettings,modelReady:boolean,reviewed:boolean,takeCount:number){
 return !busy&&Boolean(s.sourceId)&&takeCount<80&&(s.method==='finish'||modelReady&&reviewed);
}
