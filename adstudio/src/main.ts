import {OSH,type ShotResult,type LocalModels} from '../../shared/runtime/client';
import {taglineOverlay} from './overlay';
import {prepareReference} from './reference';
import {Projects,openProjectDriver,memoryDriver,newProject,migrateProject,validName,restoredAttempt,ACTIVE_KEY,type AdProject,type Settings,type Take,type ProductAsset,type Ratio} from './projects';
import {blobDataURL,normalizeProduct} from './assets';
import {templates,templateSettings,resizeDimensions} from './templates';
import {canGenerate,renderEstimate,type ApiCapabilities} from './availability';
import {mountComposer} from './composer';
import type {MediaAsset} from './composition';
import {mountBrand} from './brand-ui';
import {mountStaticAds} from './static-ui';
import {mountHero} from './hero-ui';

const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const photo=el<HTMLInputElement>('photo'),product=el<HTMLImageElement>('product'),fields=el<HTMLFieldSetElement>('fields'),go=el<HTMLButtonElement>('go'),status=el('status'),outs=el('outs'),exportAll=el<HTMLButtonElement>('export-all');
const sizes={'16:9':{width:512,height:288},'9:16':{width:288,height:512},'1:1':{width:384,height:384}};
const vibes={studio:'Clean studio background, controlled lighting, smooth camera movement.',life:'Natural daylight, lifestyle commercial, gentle cinematic camera movement.',ugc:'Natural handheld camera movement, authentic product demonstration.'};
let repository:Projects,project:AdProject,image='',busy=false,reading=true,exporting=0,selection=0,saving=Promise.resolve(),durable=false;
let api:ApiCapabilities|null=null,catalog:LocalModels|null=null,checking=false;
const projects=new Map<string,AdProject>(),pendingAssets=new Map<string,{projectId:string;asset:ProductAsset}>();
const dirtyProjects=new Set<string>(),writeVersions=new Map<string,number>();
const pendingMedia=new Map<string,{projectId:string;asset:MediaAsset}>();
let composer:ReturnType<typeof mountComposer>|undefined;
let brandWorkspace:Awaited<ReturnType<typeof mountBrand>>|undefined;
let heroWorkspace:ReturnType<typeof mountHero>|undefined;
let staticWorkspace:ReturnType<typeof mountStaticAds>|undefined;
type Card={take:Take;video:HTMLVideoElement;button:HTMLButtonElement;message:HTMLElement;exportLinks:HTMLElement};
const cards:Card[]=[];
const errorText=(error:unknown)=>error instanceof Error?error.message:String(error);
function storageNotice(text:string){el('storage-status').textContent=text;heroWorkspace?.storageChanged();}
async function persist(asset?:ProductAsset|ProductAsset[],media?:MediaAsset|MediaAsset[]) {
 for(const file of asset?(Array.isArray(asset)?asset:[asset]):[])pendingAssets.set(file.id,{projectId:project.id,asset:file});
 for(const file of media?(Array.isArray(media)?media:[media]):[])pendingMedia.set(file.id,{projectId:project.id,asset:file});
 project.updated=Date.now();projects.set(project.id,project);
 dirtyProjects.add(project.id);const revision=(writeVersions.get(project.id)||0)+1;writeVersions.set(project.id,revision);storageNotice('Saving changes...');
 const snapshot=structuredClone(project),assets=[...pendingAssets.values()].filter(a=>a.projectId===snapshot.id).map(a=>a.asset);
 const mediaFiles=[...pendingMedia.values()].filter(a=>a.projectId===snapshot.id).map(a=>a.asset);
 const task=saving.then(async()=>{await repository.save(snapshot,assets,mediaFiles);if(!durable)throw new Error('Browser database unavailable; this session is not saved.');for(const a of assets)pendingAssets.delete(a.id);for(const a of mediaFiles)pendingMedia.delete(a.id);if(writeVersions.get(snapshot.id)===revision)dirtyProjects.delete(snapshot.id);storageNotice(dirtyProjects.size?`Unsaved changes in ${dirtyProjects.size} project(s). Retry saving if this persists.`:'Saved on this browser.');});
 saving=task.catch(error=>storageNotice('Not saved — '+errorText(error)+' Keep this tab open and retry saving.'));
 await saving;
}
function working(){return busy||reading||exporting>0||Boolean(composer?.busy)||Boolean(brandWorkspace?.busy)||Boolean(staticWorkspace?.busy)||Boolean(heroWorkspace?.busy);}
function showWorkspace(value:boolean|'brand'|'static'|'hero'){const view=typeof value==='string'?value:value?'compose':'create';for(const name of ['brand','static','hero','create','compose']){el(name+'-workspace').hidden=name!==view;el('show-'+name).setAttribute('aria-selected',String(name===view));}el('projects').closest<HTMLElement>('.project-bar')!.hidden=view==='brand';history.replaceState(null,'',location.pathname+location.search+'#'+view);}
el('show-create').onclick=()=>showWorkspace(false);el('show-compose').onclick=()=>showWorkspace(true);
el('show-hero').onclick=()=>{showWorkspace('hero');void heroWorkspace?.refresh();};
el('show-brand').onclick=()=>showWorkspace('brand');
el('show-static').onclick=()=>{showWorkspace('static');void staticWorkspace?.refresh();};
showWorkspace(location.hash==='#compose'?true:location.hash==='#create'?false:location.hash==='#static'?'static':location.hash==='#hero'?'hero':'brand');
function ready(){
 for(const name of ['brand','static','hero','create','compose'])el<HTMLButtonElement>('show-'+name).disabled=working();
 go.disabled=working()||!image||!canGenerate(project?.settings.mode,api,OSH.online,catalog);
 exportAll.disabled=working()||!api?.ffmpeg.available||!cards.some(c=>!c.take.exports.length);
 photo.disabled=working();fields.disabled=busy||reading;
 for(const id of ['projects','new-project','rename-project','project-name','open-cookie-demo','open-static-demo'])el<HTMLInputElement>(id).disabled=working();
 document.querySelectorAll<HTMLButtonElement>('[data-processing]').forEach(b=>b.disabled=working()||!api?.ffmpeg.available);
 document.querySelectorAll<HTMLButtonElement>('[data-template]').forEach(b=>{b.disabled=working();b.setAttribute('aria-pressed',String(b.dataset.template===project?.settings.template));});
 el('empty-results').hidden=cards.length>0;
}
function readSettings():Settings {
 return {...project.settings,model:el<HTMLSelectElement>('video-model').value||undefined,mode:el<HTMLSelectElement>('mode').value as Settings['mode'],motion:el<HTMLSelectElement>('camera-motion').value as Settings['motion'],ratios:[...document.querySelectorAll<HTMLInputElement>('input[name="ratio"]:checked')].map(c=>c.value as Ratio),duration:+el<HTMLSelectElement>('duration').value,seed:Number.isFinite(el<HTMLInputElement>('seed').valueAsNumber)?el<HTMLInputElement>('seed').valueAsNumber:project.settings.seed,pitch:el<HTMLTextAreaElement>('pitch').value,tagline:el<HTMLInputElement>('tagline').value,vibe:el<HTMLSelectElement>('vibe').value as Settings['vibe'],framing:el<HTMLSelectElement>('framing').value as Settings['framing']};
}
function updateMode(){
 const mode=el<HTMLSelectElement>('mode').value;
 for(const id of ['pitch','seed','vibe'])el<HTMLInputElement>(id).disabled=mode==='camera';
 el<HTMLTextAreaElement>('pitch').required=mode!=='camera';
 el<HTMLSelectElement>('camera-motion').disabled=mode!=='camera';el<HTMLSelectElement>('framing').disabled=mode!=='creative';
 el('mode-help').textContent=mode==='camera'?'Conventional push/pan of your photo. No AI scene movement.':mode==='locked'?'A static original-photo rectangle over an LTX background. No automatic product segmentation.':'Experimental LTX generation. Product shapes, textures and lettering can change; commercial quality has not passed acceptance.';
 go.textContent=mode==='camera'?'Animate photo':'Generate experimental video';ready();
 el<HTMLSelectElement>('video-model').disabled=mode==='camera'||!catalog?.video.length;
 const first=sizes[project.settings.ratios[0]||'9:16'];
 el('estimate').textContent=mode==='camera'?'Local photo animation. No GPU or model generation.':renderEstimate(catalog,el<HTMLSelectElement>('video-model').value,first.width,first.height,project.settings.duration);
}
function applySettings(){
 const s=project.settings;
 for(const [id,value]of Object.entries({mode:s.mode,'camera-motion':s.motion,pitch:s.pitch,tagline:s.tagline,vibe:s.vibe,framing:s.framing,duration:s.duration,seed:s.seed}))el<HTMLInputElement>(id).value=String(value);
 document.querySelectorAll<HTMLInputElement>('input[name="ratio"]').forEach(c=>c.checked=s.ratios.includes(c.value as Ratio));
 if(s.model)el<HTMLSelectElement>('video-model').value=s.model;
 updateMode();
}
function projectOptions(){
 const select=el<HTMLSelectElement>('projects');select.replaceChildren();
 for(const p of [...projects.values()].sort((a,b)=>b.updated-a.updated)){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;select.append(option);}
 select.value=project.id;el<HTMLInputElement>('project-name').value=project.name;
}
async function openProject(next:AdProject){
 if(busy||exporting)return;
 const ticket=++selection;reading=true;project=next;image='';product.removeAttribute('src');cards.length=0;outs.replaceChildren();photo.value='';applySettings();projectOptions();
 try{localStorage.setItem(ACTIVE_KEY,project.id);}catch{storageNotice('Active project could not be remembered; browser storage is restricted.');}
 try {
  if(project.assetId){const asset=pendingAssets.get(project.assetId)?.asset||await repository.asset(project.assetId);if(!asset)throw new Error('Saved product reference is missing. Upload a replacement; previous takes are kept.');image=await blobDataURL(asset.normalized);if(ticket!==selection)return;product.src=image;}
  status.textContent=project.attempt?.error||'Project opened. Previous takes are kept when you generate variations.';
 }catch(error){status.textContent=errorText(error);}
 if(ticket!==selection)return;
 for(const take of project.takes)renderTake(take);
 await composer?.refresh();
 if(!el('static-workspace').hidden)await staticWorkspace?.refresh();
 if(!el('hero-workspace').hidden)await heroWorkspace?.refresh();
 if(restoredAttempt(project)){status.textContent=project.attempt!.error!;await persist();}
 reading=false;ready();
}
function outputLink(url:string,label:string,filename?:string){const a=document.createElement('a');a.href=url;a.textContent=label;if(filename)a.download=filename;return a;}
function exportLinks(card:Card){card.exportLinks.replaceChildren();for(const item of card.take.exports)card.exportLinks.append(outputLink(item.url,'Download MP4',`ad-${card.take.id}.mp4`));}
function renderTake(take:Take){
 const article=document.createElement('article');article.className='out';article.dataset.takeId=take.id;
 const title=document.createElement('strong');title.textContent=`${take.kind==='edit'?'Adjusted · ':''}${take.mode==='camera'?'Camera':take.mode==='locked'?'Product-Locked':'Creative experimental'} · ${take.ratio} · ${(take.frames/take.fps).toFixed(2)} s`;
 const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.src=take.exports.at(-1)?.url||take.source;
 const details=document.createElement('details'),summary=document.createElement('summary'),copy=document.createElement('p');summary.textContent='Generation details';copy.className='note';copy.textContent=take.mode==='camera'?`FFmpeg ${take.settings.motion}; no model, prompt or seed used.`:`${take.settings.model||'LTX-Video 2B fallback'} · seed ${take.settings.seed} · ${take.prompt}`;details.append(summary,copy);
 const button=document.createElement('button');button.type='button';button.dataset.processing='';button.textContent=take.exports.length?'Export another MP4':'Export MP4';
 const message=document.createElement('p');message.className='note';message.setAttribute('role','status');
 const links=document.createElement('div'),card={take,video,button,message,exportLinks:links};cards.push(card);exportLinks(card);
 video.addEventListener('error',()=>{message.textContent='Preview unavailable. The local API or output file may be missing. Retry loading, or generate a new variation; history is kept.';});
 const retry=document.createElement('button');retry.type='button';retry.textContent='Reload preview';retry.onclick=()=>{video.load();message.textContent='Checking the saved output…';void checkPreview(card);};
 button.onclick=()=>void exportTake(card);
 article.append(title,video,outputLink(take.source,'Download original WebM',`ad-${take.id}.webm`),button,links,message,retry,details);
 if(take.background)article.append(outputLink(take.background,'Inspect Creative background'));
 if(take.parentId){const parent=project.takes.find(t=>t.id===take.parentId);if(parent){const compare=document.createElement('button');compare.type='button';compare.textContent='Compare previous version';let original=false;compare.onclick=()=>{original=!original;video.src=original?parent.source:take.source;compare.textContent=original?'Show adjusted version':'Compare previous version';};article.append(compare);}}
 article.append(adjustPanel(take,card));
 const compose=document.createElement('button');compose.type='button';compose.textContent='Add to ad';compose.onclick=()=>composer?.addTake(take);article.append(compose);
 void checkPreview(card);
 outs.prepend(article);
}
async function checkPreview(card:Card){
 const url=card.take.exports.at(-1)?.url||card.take.source;
 try {const response=await fetch(url,{signal:AbortSignal.timeout(5000)});await response.body?.cancel();if(response.status===404){card.message.textContent='Saved output file is missing from the local runtime. History and source photo are kept. Generate a new variation.';if(url!==card.take.source){card.video.src=card.take.source;card.message.textContent+=' Trying the original WebM preview.';}}else if(!response.ok)card.message.textContent='The local API cannot serve this output. Retry the connection; your history is kept.';}
 catch{card.message.textContent='Cannot reach the saved output. Reconnect the local API and reload this preview. Your history is kept.';}
}
function adjustPanel(take:Take,card:Card){
 const panel=document.createElement('details');panel.className='adjust';
 const summary=document.createElement('summary');summary.textContent='Adjust · trim, speed, reverse & resize';panel.append(summary);
 function number(label:string,value:number){const wrap=document.createElement('label'),input=document.createElement('input');input.type='number';input.value=String(value);input.step='any';input.min='0';wrap.append(label,input);panel.append(wrap);return input;}
 const duration=take.frames/take.fps,start=number('Trim start (seconds)',0),end=number('Trim end (seconds)',duration),width=number('Output width',take.width);
 const dim=resizeDimensions(take.width,take.height,take.width);width.step=String(dim.step);width.min=String(dim.step);width.max='4096';
 const size=document.createElement('p');size.className='note';size.textContent=`${take.width}×${take.height}. Width snaps to ${dim.step}px to keep the exact aspect ratio.`;panel.append(size);
 width.oninput=()=>{try{const d=resizeDimensions(take.width,take.height,width.valueAsNumber);size.textContent=`Output ${d.width}×${d.height}. Original aspect ratio preserved.`;}catch(e){size.textContent=errorText(e);}};
 const speedLabel=document.createElement('label'),speed=document.createElement('select');speedLabel.append('Playback speed',speed);for(const n of [.25,.5,1,2,4]){const o=document.createElement('option');o.value=String(n);o.textContent=n+'×';speed.append(o);}speed.value='1';panel.append(speedLabel);
 const reverseLabel=document.createElement('label'),reverse=document.createElement('input');reverse.type='checkbox';reverseLabel.append(reverse,' Reverse');panel.append(reverseLabel);
 const render=document.createElement('button');render.type='button';render.dataset.processing='';render.textContent='Save adjusted version';panel.append(render);
 render.onclick=async()=>{
  if(working())return;
  let started=false;
  try {
   const from=start.valueAsNumber,to=end.valueAsNumber,rate=+speed.value;
   if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||from>=to||to>duration+.001)throw new Error('Choose a trim range inside this clip.');
   const d=resizeDimensions(take.width,take.height,width.valueAsNumber);width.value=String(d.width);
   const recipe={start:from,end:to,speed:rate,reverse:reverse.checked,width:d.width,height:d.height};
   exporting++;started=true;ready();card.message.textContent='Rendering an adjusted copy. Original kept…';
   const result=await OSH.editVideo({video:take.source,keepAudio:true,...recipe});
   const adjusted:Take={...structuredClone(take),id:crypto.randomUUID(),created:Date.now(),source:result.url,parentId:take.id,kind:'edit',edit:recipe,width:d.width,height:d.height,fps:24,frames:Math.max(1,Math.round((to-from)/rate*24)),seconds:result.seconds,exports:[]};
   project.takes.push(adjusted);await persist();renderTake(adjusted);composer?.refreshLibrary();card.message.textContent='Adjusted version added to history. Original unchanged.';
  }catch(e){card.message.textContent=errorText(e)+' Original unchanged.';}
  finally{if(started)exporting--;ready();}
 };
 return panel;
}
async function exportTake(card:Card){
 if(working())return false;
 exporting++;card.button.disabled=true;ready();card.message.textContent='Exporting MP4…';
 try {
  const tagline=project.settings.tagline.trim(),overlay=tagline?(await OSH.upload(taglineOverlay(card.take.width,card.take.height,tagline))).url:undefined;
  const result=await OSH.exportVideo(card.take.source,overlay);
  card.take.exports.push({id:crypto.randomUUID(),url:result.url,tagline,created:Date.now()});await persist();exportLinks(card);card.video.src=result.url;card.button.textContent='Export another MP4';card.message.textContent=`MP4 ready · ${result.seconds}s. Original video kept.`;return true;
 }catch(error){card.message.textContent=errorText(error)+' Original video is unchanged; retry export.';return false;}
 finally {exporting--;card.button.disabled=false;ready();}
}
exportAll.onclick=async()=>{if(working())return;const pending=cards.filter(c=>!c.take.exports.length);for(const card of pending)if(!await exportTake(card))break;};
async function check(){
 if(checking)return;checking=true;el<HTMLButtonElement>('check').disabled=true;
 try {
  const [health,local]=await Promise.allSettled([OSH.health(),fetch('/api/capabilities',{signal:AbortSignal.timeout(4000)}).then(async r=>{if(!r.ok)throw new Error('API unavailable');return r.json() as Promise<ApiCapabilities>;})]);
  api=local.status==='fulfilled'?local.value:null;
  const online=health.status==='fulfilled'&&health.value.online;
  catalog=online?await OSH.models().catch(()=>null):null;
  el('health').textContent=!api?'Local API unavailable — drafts and history stay here.':!api.ffmpeg.available?'FFmpeg unavailable — local animation/edit/export need configuration.':online?'Local API, FFmpeg and ComfyUI connected.':'ComfyUI offline — Camera, editing and export remain available.';
  const select=el<HTMLSelectElement>('video-model'),prior=project?.settings.model||select.value;select.replaceChildren();
  for(const model of catalog?.video||[]){const o=document.createElement('option');o.value=model.id;o.textContent=model.label+' · experimental';select.append(o);}if(prior&&catalog?.video.some(m=>m.id===prior))select.value=prior;
  const list=el('capabilities');list.replaceChildren();
  const labels=[`Local API: ${api?'available':'unreachable'}`,`Camera / Adjust / MP4: ${api?.ffmpeg.available?'available through FFmpeg':'unavailable'}`,`Video models: ${catalog?.video.length?catalog.video.map(m=>m.label).join(', '):'no verified runnable model'}`,`Image API: ${api?.keyframe?'available':'unreachable'}; ${catalog?.keyframe.length?'compatible weights installed; image creation UI not connected in this milestone':'no verified runnable image weights/nodes'}`,`Audio API: ${api?.audio?'available':'unreachable'}; ${catalog?.audio?.available?'compatible weights installed; audio UI not connected in this milestone':'no verified runnable audio weights/nodes'}`];
  for(const label of labels){const item=document.createElement('li');item.textContent=label;list.append(item);}
 }catch(error){el('health').textContent='Connection check failed: '+errorText(error);}
 finally {checking=false;el<HTMLButtonElement>('check').disabled=false;if(project)updateMode();else ready();}
}
el('check').onclick=()=>void check();
for(const event of ['online','focus'])addEventListener(event,()=>void check());
addEventListener('offline',()=>{api=null;el('health').textContent='Connection interrupted. Drafts and history remain here; reconnect before retrying.';ready();});
setInterval(()=>{if(!document.hidden)void check();},8000);
addEventListener('beforeunload',event=>{if(dirtyProjects.size){event.preventDefault();event.returnValue='';}});
const templateList=el('templates');for(const template of templates){const button=document.createElement('button');button.type='button';button.dataset.template=template.id;const title=document.createElement('strong'),description=document.createElement('span');title.textContent=template.name;description.textContent=template.description;button.append(title,description);button.onclick=()=>{if(working())return;project.settings=templateSettings(template.id,readSettings());applySettings();void persist();};templateList.append(button);}
photo.onchange=async()=>{
 const ticket=++selection,file=photo.files?.[0];if(!file)return;reading=true;ready();
 try {const asset=await normalizeProduct(file);const url=await blobDataURL(asset.normalized);if(ticket!==selection)return;project.assetId=asset.id;image=url;product.src=url;await persist(asset);status.textContent='Product ready. Your previous takes are kept.';}
 catch(error){status.textContent=errorText(error)+' Previous product reference is unchanged.';}
 finally{if(ticket===selection){reading=false;ready();}}
};
el<HTMLFormElement>('brief').addEventListener('input',()=>{if(!project||busy)return;project.settings=readSettings();updateMode();void persist();});
el<HTMLFormElement>('brief').onsubmit=async event=>{
 event.preventDefault();if(working()||!image)return;project.settings=readSettings();const settings=structuredClone(project.settings),assetId=project.assetId!;
 if(!canGenerate(settings.mode,api,OSH.online,catalog)){status.textContent='This configuration is unavailable. Check connection and model readiness.';return;}
 if(!settings.ratios.length){status.textContent='Select at least one format.';return;}
 if(settings.mode!=='camera'&&!settings.pitch.trim()){status.textContent='Write a motion brief.';return;}
 busy=true;ready();project.attempt={id:crypto.randomUUID(),created:Date.now(),status:'running',takeIds:[]};await persist();
 try {
  if(settings.mode!=='camera'){await check();if(!OSH.online)throw new Error(OSH.reason);}
  const prompt=`${settings.pitch.trim()} ${vibes[settings.vibe]} Preserve the reference product appearance and branding. No added text.`;
  const original=settings.mode!=='creative'?await OSH.upload(image):null;
  const cropped=settings.mode==='creative'&&settings.framing==='crop'?await OSH.upload(image):null;
  for(const ratio of settings.ratios){
   const size=sizes[ratio];let result:ShotResult,background:ShotResult|undefined;
   status.textContent=`${settings.mode==='camera'?'Animating':'Generating'} ${ratio}… ${project.attempt.takeIds.length+1}/${settings.ratios.length}.`;
   if(settings.mode==='camera')result=await OSH.productVideo({image:original!.url,mode:'camera',ratio,duration:settings.duration,motion:settings.motion});
   else {
    const reference=cropped||await OSH.upload(await prepareReference(image,size.width,size.height,settings.mode==='creative'?settings.framing:'fit'));
    result=await OSH.shot([{image:reference.url,t:0}],prompt,settings.duration,settings.seed,{...size,model:settings.model});
    if(settings.mode==='locked'){background=result;result=await OSH.productVideo({image:original!.url,background:result.url,mode:'locked',ratio,duration:settings.duration});}
   }
   const take:Take={id:crypto.randomUUID(),created:Date.now(),assetId,source:result.url,kind:'generation',mode:settings.mode,ratio,settings:structuredClone(settings),prompt:settings.mode==='camera'?'':prompt,frames:result.frames,fps:result.fps||24,...size,seconds:result.seconds+(background?.seconds||0),background:background?.url,exports:[]};
   project.takes.push(take);project.attempt.takeIds.push(take.id);await persist();renderTake(take);composer?.refreshLibrary();
  }
  project.attempt.status='complete';status.textContent='Videos ready. Preview, export, or make another variation. Earlier takes are kept.';
 }catch(error){project.attempt.status='failed';project.attempt.error=errorText(error);status.textContent=`${project.attempt.takeIds.length} take(s) ready in this tab. ${errorText(error)} Check results before retrying; a disconnected render may still be running.`;}
 finally {await persist();busy=false;updateMode();}
};
el<HTMLSelectElement>('projects').onchange=async()=>{if(working())return;await saving;const next=projects.get(el<HTMLSelectElement>('projects').value);if(next)await openProject(next);};
el('new-project').onclick=async()=>{if(working())return;try{await saving;const next=newProject(el<HTMLInputElement>('project-name').value||'Untitled ad');project=next;projects.set(next.id,next);await persist();await openProject(next);}catch(error){status.textContent=errorText(error);}};
el('rename-project').onclick=async()=>{if(working())return;try{project.name=validName(el<HTMLInputElement>('project-name').value);await persist();projectOptions();}catch(error){status.textContent=errorText(error);}};
async function retryStorage(){
 if(working())return;reading=true;ready();storageNotice('Retrying unsaved changes…');
 // Use the SAME write chain as normal edits. A later edit must never be
 // overwritten by a retry that started earlier, nor lose its pending Blob.
 const task=saving.then(async()=>{repository=new Projects(await openProjectDriver());durable=true;
  for(const id of [...dirtyProjects]){const snapshot=structuredClone(projects.get(id)!),revision=writeVersions.get(id),assets=[...pendingAssets.values()].filter(a=>a.projectId===id),media=[...pendingMedia.values()].filter(a=>a.projectId===id);await repository.save(snapshot,assets.map(a=>a.asset),media.map(a=>a.asset));for(const a of assets)if(pendingAssets.get(a.asset.id)===a)pendingAssets.delete(a.asset.id);for(const a of media)if(pendingMedia.get(a.asset.id)===a)pendingMedia.delete(a.asset.id);if(writeVersions.get(id)===revision)dirtyProjects.delete(id);}
  storageNotice(dirtyProjects.size?'Newer changes are still saving.':'Saved on this browser.');const existing=await repository.list();for(const p of existing)if(!projects.has(p.id))projects.set(p.id,p);projectOptions();
 });saving=task.catch(error=>{durable=false;storageNotice('Not saved — '+errorText(error)+' Keep this tab open and retry saving.');});
 try{await saving;}finally{reading=false;ready();}
}
el('retry-save').onclick=()=>void retryStorage();
el('open-cookie-demo').onclick=async()=>{
 if(working())return;reading=true;ready();
 try{
  const response=await fetch('/api/ad-composer-demo');if(!response.ok)throw Error('The local cookie example is unavailable.');
  const example=migrateProject(await response.json()),existing=projects.get(example.id);
  if(existing){reading=false;await openProject(existing);showWorkspace(true);return;}
  const media:MediaAsset[]=await Promise.all(example.composition.media.map(async m=>{const r=await fetch(m.source);if(!r.ok)throw Error('An example source is missing. Rebuild the local example.');return{id:m.id,name:m.name,original:await r.blob()};}));
  await saving;project=example;projects.set(example.id,example);await persist(undefined,media);reading=false;await openProject(example);showWorkspace(true);
 }catch(e){status.textContent=errorText(e);}finally{reading=false;ready();}
};
async function start(){
 try {repository=new Projects(await openProjectDriver());const list=await repository.list();for(const p of list)projects.set(p.id,p);durable=true;storageNotice('Saved projects stay on this browser.');}
 catch(error){repository=new Projects(memoryDriver());storageNotice('Session only — '+errorText(error)+' Keep this tab open; retry saving.');}
 let active='';try{active=localStorage.getItem(ACTIVE_KEY)||'';}catch{}
 project=projects.get(active)||[...projects.values()][0]||newProject();projects.set(project.id,project);
 composer=mountComposer({project:()=>project,save:asset=>persist(undefined,asset),asset:id=>repository.media(id),changed:ready,show:()=>showWorkspace(true)});
 heroWorkspace=mountHero({project:()=>project,storage:()=>({saved:durable&&!dirtyProjects.has(project.id),message:el('storage-status').textContent||'Storage status unknown'}),repository:()=>repository,asset:async id=>pendingAssets.get(id)?.asset||await repository.asset(id),save:persist,changed:ready,brand:()=>showWorkspace('brand'),demo:async()=>{
  const r=await fetch('/api/hero/demo');if(!r.ok)throw Error('No private benchmark example prepared.');const demo=await r.json(),example=migrateProject(demo.project),existing=projects.get(example.id);if(existing){project=existing;await openProject(existing);return;}
  const files:ProductAsset[]=await Promise.all(demo.files.map(async(f:any)=>{const original=await(await fetch(f.original)).blob(),normalized=f.normalized?await(await fetch(f.normalized)).blob():original;return {id:f.assetId,name:f.name,original,normalized,width:f.width,height:f.height,created:Date.now()};}));
  if(!(await repository.brands()).some(b=>b.id===demo.brand.id))await repository.saveBrand(demo.brand,files);await saving;project=example;projects.set(example.id,example);await persist(files);await openProject(example);await brandWorkspace?.refreshList();
 }});
 staticWorkspace=mountStaticAds({project:()=>project,repository:()=>repository,asset:async id=>pendingAssets.get(id)?.asset||await repository.asset(id),save:persist,changed:ready,brand:()=>showWorkspace('brand')});
 brandWorkspace=await mountBrand({repository:()=>repository,durable:()=>durable,retry:retryStorage,changed:ready,create:async(brand,productId)=>{if(busy||reading||exporting||composer?.busy||staticWorkspace?.busy||heroWorkspace?.busy)throw Error('Wait for the current operation to finish.');await staticWorkspace?.refresh(brand,productId);showWorkspace('static');},use:async brand=>{if(busy||reading||exporting||composer?.busy||heroWorkspace?.busy)throw Error('Wait for the current project operation to finish.');project.brandId=brand.id;project.composition.brand=brand.dna.name.slice(0,60);await persist();await composer?.refresh();showWorkspace(true);}});
 await persist();await openProject(project);void check();
 void fetch('/api/ad-composer-demo').then(r=>{el('open-cookie-demo').hidden=!r.ok;}).catch(()=>{});
 void fetch('/api/static-ad-demo').then(async r=>{await r.body?.cancel();el('open-static-demo').hidden=!r.ok;}).catch(()=>{});
}
el('open-static-demo').onclick=async()=>{
 if(working())return;reading=true;ready();
 try{const r=await fetch('/api/static-ad-demo');if(!r.ok)throw Error('Local example unavailable.');const demo=await r.json(),example=migrateProject(demo.project),existing=projects.get(example.id);
  if(existing){reading=false;await openProject(existing);await staticWorkspace?.refresh();showWorkspace('static');return;}
  const files:ProductAsset[]=await Promise.all(demo.files.map(async(f:any)=>{const original=await(await fetch(f.original)).blob(),normalized=f.normalized?await(await fetch(f.normalized)).blob():original;return {id:f.assetId,name:f.name,original,normalized,width:f.width,height:f.height,created:Date.now()};}));
  if(!(await repository.brands()).some(b=>b.id===demo.brand.id))await repository.saveBrand(demo.brand,files);
  await saving;project=example;projects.set(example.id,example);await persist(files);reading=false;await openProject(example);await brandWorkspace?.refreshList();await staticWorkspace?.refresh(demo.brand);showWorkspace('static');
 }catch(e){status.textContent=errorText(e);}finally{reading=false;ready();}
};
window.addEventListener('beforeunload',event=>{if(dirtyProjects.size||working()){event.preventDefault();event.returnValue='';}});
void start();
