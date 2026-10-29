// Serializable composition state. Imported originals live in IndexedDB, not here.
export type ComposerMedia={id:string;name:string;source:string;kind:'video'|'audio';duration:number;width:number;height:number;audio:boolean;takeId?:string};
export type MediaAsset={id:string;original:Blob;name:string};
export type ComposerShot={id:string;mediaId:string;start:number;end:number};
export type CompositionExport={id:string;url:string;created:number;duration:number;recipe:string};
export type Composition={version:1;media:ComposerMedia[];shots:ComposerShot[];brand:string;headline:string;cta:string;ctaSeconds:number;transition:'cut'|'dissolve';width:720|1080;keepAudio:boolean;music?:{mediaId:string;volume:number};exports:CompositionExport[]};
export const emptyComposition=():Composition=>({version:1,media:[],shots:[],brand:'Your brand',headline:'Your product, in focus.',cta:'Explore the collection',ctaSeconds:3,transition:'cut',width:1080,keepAudio:true,exports:[]});
export const ownedVideo=(url:unknown)=>typeof url==='string'&&/^\/outputs\/[a-f0-9]{16}\.(mp4|webm)$/.test(url);
const finite=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
export function validateComposition(value:unknown):Composition{
 const c=value as Composition;
 const invalid=()=>{throw new Error('Invalid saved composition. Original project data was not overwritten.');};
 if(!c||c.version!==1||!Array.isArray(c.media)||!Array.isArray(c.shots)||!Array.isArray(c.exports)||c.media.length>250||c.shots.length>12)return invalid();
 if(!['cut','dissolve'].includes(c.transition)||![720,1080].includes(c.width)||typeof c.keepAudio!=='boolean'||!finite(c.ctaSeconds,0,8)||(c.ctaSeconds>0&&c.ctaSeconds<.5))return invalid();
 for(const [text,max]of [[c.brand,60],[c.headline,100],[c.cta,80]] as const)if(typeof text!=='string'||text.length>max)return invalid();
 const ids=new Set<string>();
 for(const m of c.media){if(!m||typeof m.id!=='string'||ids.has(m.id)||typeof m.name!=='string'||m.name.length>200||!finite(m.duration,.001,600)||!['video','audio'].includes(m.kind)||!(m.kind==='video'?ownedVideo(m.source):/^\/outputs\/[a-f0-9]{16}\.(mp3|wav|m4a|flac|ogg)$/.test(m.source)))return invalid();ids.add(m.id);}
 const shotIds=new Set<string>();for(const s of c.shots){const m=c.media.find(m=>m.id===s?.mediaId);if(!s||typeof s.id!=='string'||shotIds.has(s.id)||!m||m.kind!=='video'||!finite(s.start,0,m.duration)||!finite(s.end,0,m.duration+.05)||s.end-s.start<.5)return invalid();shotIds.add(s.id);}
 if(c.music&&(!c.media.some(m=>m.id===c.music!.mediaId&&m.kind==='audio')||!finite(c.music.volume,0,1)))return invalid();
 if(c.exports.some(e=>!e||!ownedVideo(e.url)||typeof e.id!=='string'||!finite(e.duration,.001,90)||typeof e.recipe!=='string'))return invalid();
 return c;
}
export function compositionRecipe(c:Composition){return JSON.stringify({...c,exports:[]});}
export function compositionDuration(c:Composition){const lengths=c.shots.map(s=>Math.round((s.end-s.start)*24)/24);if(c.ctaSeconds)lengths.push(Math.round(c.ctaSeconds*24)/24);return Math.max(0,Math.ceil((lengths.reduce((a,b)=>a+b,0)-(c.transition==='dissolve'?.3:0)*Math.max(0,lengths.length-1))*24)/24);}
export function moveShot(c:Composition,id:string,offset:number){const index=c.shots.findIndex(s=>s.id===id),next=index+offset;if(index<0||next<0||next>=c.shots.length)return;const [shot]=c.shots.splice(index,1);c.shots.splice(next,0,shot);}
