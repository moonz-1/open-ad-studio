/** Presentation-only Journey gate copy. Does not change orchestration contracts. */
export type SourceGate={permission:boolean;draft:{facts:{description:string}};name?:string;review?:string};
export function sourceReady(x:SourceGate){return !!x.permission&&!!x.draft.facts.description.trim();}
export function introduceGate(address:string,name:string,sourceCount:number){
 if(address.trim())return '';
 if(!sourceCount)return 'Enter a public website, or upload a photograph and add a brand name.';
 if(!name.trim())return 'Add a brand name for photo-only projects, or enter a website instead.';
 return '';
}
export function discoverGate(brandName:string|undefined,sources:SourceGate[]){
 if(!brandName?.trim())return 'Add a brand name so the campaign knows who it is speaking for.';
 if(!sources.length)return 'Select a website product or upload a photograph to continue.';
 const pending=sources.filter(x=>!sourceReady(x));
 if(!pending.length)return '';
 const needDesc=pending.filter(x=>!x.draft.facts.description.trim()).length;
 const needPerm=pending.filter(x=>!x.permission).length;
 const parts:string[]=[];
 if(needDesc)parts.push(`write a short visible description for ${needDesc===1?'1 product':needDesc+' products'}`);
 if(needPerm)parts.push(`confirm image permission for ${needPerm===1?'1 photograph':needPerm+' photographs'}`);
 return 'Before developing a direction, '+parts.join(' and ')+'.';
}
/** Concept selection is the confirmation — no separate facts checkbox. */
export function directionGate(selected:boolean){
 if(!selected)return 'Choose one creative direction for this product.';
 return '';
}
/** Directions already reviewed in Direction; Create Ads does not need a second batch checkbox. */
export function editionsGate(opts:{caps:boolean;resolved?:{label:string;reason:string}|null;queue:number;engineReason?:string}){
 if(!opts.caps)return 'Checking local generation readiness… Stay on this page; Product-safe design works without ComfyUI.';
 if(!opts.queue)return 'Reviewed directions are out of date. Go back to Discover, develop again, then return here.';
 if(!opts.resolved)return opts.engineReason||'The selected generation engine is not ready. Open Advanced · generation engine and choose an available option.';
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
export function sourceReviewLabel(x:SourceGate){
 if(sourceReady(x))return 'Ready for direction';
 if(!x.draft.facts.description.trim()&&!x.permission)return 'Needs description & permission';
 if(!x.draft.facts.description.trim())return 'Add a short visible description';
 return 'Confirm image use';
}
