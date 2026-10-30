/** Presentation-only Journey gate copy. Does not change orchestration contracts. */
export type SourceGate={permission:boolean;draft:{facts:{description:string}};name?:string;review?:string;productName?:string};
/** A source is identified by a saved summary or a product name; image use is acknowledged once per campaign. */
export const sourceIdentified=(x:SourceGate)=>!!x.draft.facts.description.trim()||!!x.productName?.trim();
export function sourceReady(x:SourceGate,imageUseAcknowledged=false){return (!!x.permission||imageUseAcknowledged)&&sourceIdentified(x);}
export function introduceGate(address:string,name:string,sourceCount:number){
 if(address.trim())return '';
 if(!sourceCount)return 'Enter a public website, or upload a photograph and add a brand name.';
 if(!name.trim())return 'Add a brand name for photo-only projects, or enter a website instead.';
 return '';
}
export function discoverGate(brandName:string|undefined,sources:SourceGate[],imageUseAcknowledged=false){
 if(!brandName?.trim())return 'Add a brand name so the campaign knows who it is speaking for.';
 if(!sources.length)return 'Select a website product or upload a photograph to continue.';
 const unnamed=sources.filter(x=>!sourceIdentified(x)).length;
 if(unnamed)return `Name your uploaded product${unnamed===1?'':'s'} so the brief knows what ${unnamed===1?'it is':'they are'}.`;
 if(!imageUseAcknowledged&&sources.some(x=>!x.permission))return 'Confirm image use once for this campaign.';
 return '';
}
/** Concept selection is the confirmation — no separate facts checkbox. */
export function directionGate(selected:boolean){
 if(!selected)return 'Choose one creative direction for this product.';
 return '';
}
/** Directions already reviewed in Direction; Create Ads does not need a second batch checkbox. */
export function editionsGate(opts:{caps:boolean;resolved?:{label:string;reason:string}|null;queue:number;engineReason?:string;engineConflict?:string}){
 if(!opts.caps)return 'Checking local generation readiness… Stay on this page; Product-safe design works without ComfyUI.';
 if(!opts.queue)return 'Reviewed directions are out of date. Go back to Discover, develop again, then return here.';
 if(!opts.resolved)return opts.engineReason||'The selected generation engine is not ready. Open Advanced · generation engine and choose an available option.';
 if(opts.engineConflict)return opts.engineConflict;
 return '';
}
export function cardStateLabel(state:string,opts?:{readyMissing?:boolean}){
 if(state==='ready'&&opts?.readyMissing)return 'Saved output missing';
 switch(state){
  case 'waiting':return 'Waiting in queue';
  case 'generating':return 'Creating now';
  case 'ready':return 'Ready to review';
  case 'failed':return 'Stopped with an error';
  case 'cancelled':return 'Not started · cancelled';
  default:return state;
 }
}
export function cardStateHint(state:string,error?:string,message?:string){
 if(error)return error;
 if(message)return message;
 if(state==='waiting')return 'Your turn is next. One advertisement runs at a time.';
 if(state==='generating')return 'Composing this edition. Your original photograph stays retained.';
 if(state==='cancelled')return 'Skipped when remaining jobs were stopped. Completed ads are kept.';
 if(state==='failed')return 'This edition stopped. Completed ads above remain available.';
 return 'Your original is safely retained.';
}
export function sourceReviewLabel(x:SourceGate,imageUseAcknowledged=false){
 if(!sourceIdentified(x))return 'Needs a product name';
 if(sourceReady(x,imageUseAcknowledged))return 'Ready for direction';
 return 'Image use not yet confirmed';
}
