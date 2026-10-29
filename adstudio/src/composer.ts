import type {AdProject,Take} from './projects';
import {compositionDuration,compositionRecipe,moveShot,validateComposition,type ComposerMedia,type MediaAsset} from './composition';
import {compositionArt} from './composer-art';
import {OSH} from '../../shared/runtime/client';
import './composer.css';

type Options={project:()=>AdProject;save:(asset?:MediaAsset)=>Promise<void>;asset:(id:string)=>Promise<MediaAsset|undefined>;changed:()=>void;show:()=>void};
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
async function post<T>(path:string,body:unknown):Promise<T>{const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'Local operation failed');return data;}
export async function uploadComposerMedia(file:Blob){
 if(file.size>100*1024*1024)throw Error('Choose a media file under 100 MB.');
 const extensions:Record<string,string>={mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',flac:'audio/flac',ogg:'audio/ogg'};
 const extension=file instanceof File?file.name.split('.').at(-1)?.toLowerCase():undefined;
 const aliases:Record<string,string>={'audio/x-flac':'audio/flac','application/ogg':'audio/ogg'};
 const type=aliases[file.type]||file.type||extensions[extension||''];
 const r=await fetch('/api/media',{method:'POST',headers:{'Content-Type':type||'video/mp4'},body:file});const data=await r.json();if(!r.ok)throw Error(data.error||'Media import failed');return data as {url:string;kind:'video'|'audio';duration:number;width:number;height:number;audio:boolean};
}
export function mountComposer(options:Options){
 let busy=false,dragged='',opening=0;
 const current=()=>options.project().composition;
 const tell=(message:string)=>{$('compose-status').textContent=message;};
 function setBusy(value:boolean){busy=value;$('compose-workspace').querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button,input,select').forEach(e=>e.disabled=value);options.changed();}
 function changed(){validateComposition(current());void options.save();summary();$('compose-preview-state').textContent='Changes ready · render a preview to see the finished sequence.';}
 function summary(){const c=current(),duration=compositionDuration(c);$('compose-length').textContent=`${c.shots.length} shot${c.shots.length===1?'':'s'} · ${duration.toFixed(2)} s · 9:16`;}
 function add(media:ComposerMedia){if(busy)return;if(current().shots.length>=12){tell('A composition can contain up to 12 shots.');return;}current().shots.push({id:crypto.randomUUID(),mediaId:media.id,start:0,end:Math.min(media.duration,15)});changed();renderTimeline();}
 function mediaCard(media:ComposerMedia){
  const article=document.createElement('article');article.className='compose-media';
  const video=document.createElement('video');video.src=media.source;video.muted=true;video.preload='metadata';video.playsInline=true;article.append(video);
  const name=document.createElement('strong');name.textContent=media.name;article.append(name);
  const description=document.createElement('span');description.textContent=`${media.duration.toFixed(2)} s · ${media.width}×${media.height}`;article.append(description);
  const button=document.createElement('button');button.type='button';button.textContent='+ Add shot';button.onclick=()=>add(media);article.append(button);
  video.onerror=()=>{description.textContent='File unavailable. Restore the saved original or re-import.';video.hidden=true;};
  if(!media.takeId){const restore=document.createElement('button');restore.type='button';restore.textContent='Restore saved original';restore.onclick=async()=>{
   setBusy(true);try{const saved=await options.asset(media.id);if(!saved)throw Error('Original is missing from browser storage. Re-import the file.');const result=await uploadComposerMedia(saved.original);media.source=result.url;await options.save();render();tell('Restored from the browser’s original file. Trims and previous exports kept.');}catch(e){tell((e as Error).message);}finally{setBusy(false);}
  };article.append(restore);}
  return article;
 }
 function renderLibrary(){
  const library=$('compose-library');library.replaceChildren();const c=current();
  for(const take of options.project().takes){if(!c.media.some(m=>m.takeId===take.id))c.media.push({id:crypto.randomUUID(),takeId:take.id,name:`${take.mode==='camera'?'Camera':'Generated'} · ${new Date(take.created).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`,source:take.source,kind:'video',duration:take.frames/take.fps,width:take.width,height:take.height,audio:true});}
  for(const media of c.media.filter(m=>m.kind==='video'))library.append(mediaCard(media));
  $('compose-library-empty').hidden=Boolean(library.children.length);
 }
 function renderTimeline(){
  const c=current(),timeline=$('compose-timeline');timeline.replaceChildren();
  c.shots.forEach((shot,index)=>{
   const media=c.media.find(m=>m.id===shot.mediaId)!;const card=document.createElement('article');card.className='shot-card';card.draggable=true;card.dataset.shotId=shot.id;
   card.ondragstart=event=>{dragged=shot.id;event.dataTransfer?.setData('text/plain',shot.id);};card.ondragover=e=>e.preventDefault();card.ondrop=e=>{e.preventDefault();if(busy||!dragged)return;const from=c.shots.findIndex(s=>s.id===dragged);moveShot(c,dragged,index-from);dragged='';changed();renderTimeline();};
   const title=document.createElement('strong');title.textContent=`${String(index+1).padStart(2,'0')} · ${media.name}`;
   const video=document.createElement('video');video.src=media.source;video.preload='metadata';video.muted=true;video.playsInline=true;video.controls=true;video.onloadedmetadata=()=>{video.currentTime=shot.start;};
   video.ontimeupdate=()=>{if(video.currentTime>=shot.end&&!video.paused){video.pause();video.currentTime=shot.start;}};
   video.onerror=()=>tell('A shot source is unavailable. Restore its original from the media library or re-import it. Your timeline is kept.');
   const trim=document.createElement('div');trim.className='shot-trim';
   for(const [key,label]of [['start','In'],['end','Out']] as const){const wrap=document.createElement('label'),input=document.createElement('input');input.type='number';input.min='0';input.max=String(media.duration);input.step='0.01';input.value=shot[key].toFixed(3);input.setAttribute('aria-label',`${label} point for shot ${index+1}`);wrap.append(label,input);trim.append(wrap);input.onchange=()=>{const old=shot[key];shot[key]=input.valueAsNumber;try{validateComposition(c);changed();video.currentTime=shot.start;}catch(e){shot[key]=old;input.value=String(old);tell((e as Error).message+' Choose a trim inside the clip, at least 0.5 seconds.');}};}
   const actions=document.createElement('div');actions.className='shot-actions';
   for(const [text,action,disabled]of [
    ['←',()=>moveShot(c,shot.id,-1),index===0],['→',()=>moveShot(c,shot.id,1),index===c.shots.length-1],
    ['Duplicate',()=>{if(c.shots.length>=12)throw Error('Maximum 12 shots.');c.shots.splice(index+1,0,{...shot,id:crypto.randomUUID()});},false],
    ['Remove',()=>c.shots.splice(index,1),false]
   ] as [string,()=>void,boolean][]){const button=document.createElement('button');button.type='button';button.textContent=text;button.disabled=disabled;button.setAttribute('aria-label',text==='←'?'Move shot earlier':text==='→'?'Move shot later':text+' shot');button.onclick=()=>{try{action();changed();renderTimeline();}catch(e){tell((e as Error).message);}};actions.append(button);}
   card.append(title,video,trim,actions);timeline.append(card);
  });
  if(c.ctaSeconds){const end=document.createElement('article');end.className='shot-card ending-card';const label=document.createElement('strong');label.textContent=`END · ${c.ctaSeconds.toFixed(1)} s`;const preview=document.createElement('img');preview.src=compositionArt(c).closing;preview.alt='Editable branded closing card';end.append(label,preview);timeline.append(end);}
  $('compose-timeline-empty').hidden=Boolean(c.shots.length);summary();
 }
 function renderHistory(){const list=$('compose-exports');list.replaceChildren();for(const item of [...current().exports].reverse()){const link=document.createElement('a');link.href=item.url;link.download=`ad-${item.id}.mp4`;link.textContent=`Download MP4 · ${item.duration.toFixed(2)} s · ${new Date(item.created).toLocaleString()}`;list.append(link);}}
 function render(){
  const c=current();for(const key of ['brand','headline','cta','ctaSeconds','transition','width'] as const)$<HTMLInputElement>('compose-'+key).value=String(c[key]);
  $<HTMLInputElement>('compose-keep-audio').checked=c.keepAudio;$<HTMLInputElement>('compose-volume').value=String(c.music?.volume??.25);
  $('compose-music-name').textContent=c.music?c.media.find(m=>m.id===c.music!.mediaId)?.name||'Music file missing':'No background music';
  renderLibrary();renderTimeline();renderHistory();
 }
 async function refresh(){
  const ticket=++opening;const player=$<HTMLVideoElement>('compose-player');player.pause();player.removeAttribute('src');player.load();render();
  const latest=current().exports.at(-1);if(latest){player.src=latest.url;try{const r=await fetch(latest.url,{method:'HEAD'});if(ticket===opening&&!r.ok)tell('The previous export file is missing. Your shots/settings are kept; render a new copy.');}catch{if(ticket===opening)tell('Local server unavailable. Composition settings are still saved.');}}
  $('compose-preview-state').textContent=latest?'Last rendered advertisement':'Add shots, then preview your sequence.';
 }
 for(const key of ['brand','headline','cta','ctaSeconds','transition','width'] as const){const input=$<HTMLInputElement>('compose-'+key);input.oninput=()=>{const c=current(),old=c[key];if(['ctaSeconds','width'].includes(key))(c as any)[key]=Number(input.value);else (c as any)[key]=input.value;try{changed();if(key==='ctaSeconds'||key==='brand'||key==='headline'||key==='cta')renderTimeline();}catch{(c as any)[key]=old;tell('Keep the ending between 0 and 8 seconds and use a supported export size.');}};}
 $<HTMLInputElement>('compose-keep-audio').onchange=e=>{current().keepAudio=(e.target as HTMLInputElement).checked;changed();};
 $<HTMLInputElement>('compose-volume').oninput=e=>{if(current().music)current().music!.volume=Number((e.target as HTMLInputElement).value);changed();};
 async function importFile(file:File,kind:'video'|'audio'){
  const project=options.project();setBusy(true);tell('Importing and preserving the original file…');
  try{const result=await uploadComposerMedia(file);if(result.kind!==kind)throw Error('Choose a '+kind+' file.');const media:ComposerMedia={id:crypto.randomUUID(),name:file.name.slice(0,200),source:result.url,...result};delete (media as any).url;project.composition.media.push(media);if(kind==='audio')project.composition.music={mediaId:media.id,volume:.25};else if(project.composition.shots.length<12)project.composition.shots.push({id:crypto.randomUUID(),mediaId:media.id,start:0,end:Math.min(media.duration,15)});await options.save({id:media.id,original:file,name:media.name});render();tell('Imported. Check the storage status above; keep this tab open if saving is unavailable.');}
  catch(e){tell((e as Error).message+' Previous media and exports are unchanged.');}finally{setBusy(false);}
 }
 $<HTMLInputElement>('compose-import').onchange=e=>{const input=e.target as HTMLInputElement,file=input.files?.[0];if(file)void importFile(file,'video');input.value='';};
 $<HTMLInputElement>('compose-music').onchange=e=>{const input=e.target as HTMLInputElement,file=input.files?.[0];if(file)void importFile(file,'audio');input.value='';};
 $('compose-remove-music').onclick=()=>{delete current().music;changed();render();};
 async function exportAd(download:boolean){
  if(busy)return;const project=options.project(),c=project.composition;let cached=c.exports.findLast(e=>e.recipe===compositionRecipe(c));
  setBusy(true);tell('Building your ad locally. Originals and previous exports stay unchanged…');
  try{
   validateComposition(c);if(!c.shots.length)throw Error('Add at least one shot.');if(compositionDuration(c)>90)throw Error('Keep the ad under 90 seconds.');
   if(cached){const r=await fetch(cached.url,{method:'HEAD'});if(!r.ok)cached=undefined;}
   if(!cached){
    await document.fonts.ready;const art=compositionArt(c),overlay=(await OSH.upload(art.overlay)).url,closing=c.ctaSeconds?(await OSH.upload(art.closing)).url:undefined;
    const result=await post<{url:string;duration:number}>('compose-ad',{shots:c.shots.map(s=>({source:c.media.find(m=>m.id===s.mediaId)!.source,start:s.start,end:s.end})),width:c.width,transition:c.transition,keepAudio:c.keepAudio,ctaSeconds:c.ctaSeconds,overlay,closing,music:c.music?{source:c.media.find(m=>m.id===c.music!.mediaId)!.source,volume:c.music.volume}:undefined});
    cached={id:crypto.randomUUID(),url:result.url,duration:result.duration,recipe:compositionRecipe(c),created:Date.now()};c.exports.push(cached);await options.save();
   }
   const player=$<HTMLVideoElement>('compose-player');player.src=cached.url;player.load();$('compose-preview-state').textContent='Finished ad · exact export preview';renderHistory();tell(`MP4 ready · ${cached.duration.toFixed(2)} seconds · ${c.width}×${c.width*16/9}. Originals preserved.`);
   if(download){const a=document.createElement('a');a.href=cached.url;a.download=`${project.name.replace(/[^a-z0-9]+/gi,'-')}-ad.mp4`;a.click();}else await player.play().catch(()=>{});
  }catch(e){tell((e as Error).message+' Your composition and previous exports are kept.');}finally{setBusy(false);renderTimeline();}
 }
 $('compose-preview').onclick=()=>void exportAd(false);$('compose-export').onclick=()=>void exportAd(true);
 $<HTMLVideoElement>('compose-player').onerror=()=>tell('Preview unavailable. Reconnect the local server or render a new copy; your project is kept.');
 return {get busy(){return busy;},refresh,addTake(take:Take){if(busy)return;renderLibrary();const media=current().media.find(m=>m.takeId===take.id)!;add(media);options.show();},refreshLibrary:renderLibrary};
}
