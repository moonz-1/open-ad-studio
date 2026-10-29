import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile, stat, mkdtemp, rename, rm } from 'node:fs/promises';
import { join, resolve, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { createServer } from 'node:net';
import type { IncomingMessage } from 'node:http';
import { downloadModels, type ModelFile, type ModelPack } from './model-download.ts';
import {existingComfyLaunch} from './comfy-launch.ts';

export const COMFY_RELEASE='v0.41.3';
export const COMFY_COMMIT='8713616fcc321624e306bbd36be5906203dcb0dc';

type Env=Record<string,string|undefined>;
type Config={mode:'existing'|'managed';url:string;proxy:string;modelsDir:string;proxyExe?:string;gpu?:string;release?:string;launchDirectory?:string};
type Task={phase:string;message:string;startedAt:number;updatedAt:number;busy:boolean;received?:number;total?:number|null;file?:string;index?:number;count?:number;error?:string;log:string[]};
export function localComfyUrl(input:unknown):string{
 if(typeof input!=='string'||input.length>200)throw new Error('Enter a local ComfyUI URL.');const url=new URL(input);
 if(url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw new Error('Use a loopback HTTP address, such as http://127.0.0.1:8188.');return url.origin;
}
export function setupAccess(req:IncomingMessage):boolean{
 if(['forwarded','x-forwarded-for','x-forwarded-host','x-real-ip','cf-connecting-ip'].some(header=>Object.hasOwn(req.headers,header)))return false;
 const address=req.socket.remoteAddress||'';if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)||!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(req.headers.host||''))return false;
 if(req.headers['sec-fetch-site']==='cross-site')return false;
 if(req.headers.origin){try{const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host||origin.protocol!=='http:')return false}catch{return false}}
 return true;
}
export function freePort():Promise<number>{return new Promise((ok,fail)=>{const server=createServer();server.on('error',fail);server.listen(0,'127.0.0.1',()=>{const port=(server.address() as any).port;server.close(()=>ok(port))})})}
export class RuntimeSetup{
 readonly root:string;readonly env:Env;config:Config|null=null;task:Task={phase:'idle',message:'Choose an existing ComfyUI or set up a local instance.',startedAt:0,updatedAt:0,busy:false,log:[]};
 private discoveries:string[]=[];private checkedDiscoveryAt=0;
 private abort:AbortController|null=null;private managed:ChildProcess|null=null;private startProxy:(env:Env)=>Promise<void>;private onConfig:()=>void;private onServerLog:(url:string,text:string)=>void;
 constructor(root:string,env:Env,startProxy:(env:Env)=>Promise<void>,onConfig:()=>void,onServerLog:(url:string,text:string)=>void=()=>{}){this.onServerLog=onServerLog;this.root=root;this.env=env;this.startProxy=startProxy;this.onConfig=onConfig;try{this.config=JSON.parse(readFileSync(join(root,'outputs','runtime-config.json'),'utf8'));if(this.config){localComfyUrl(this.config.url);localComfyUrl(this.config.proxy);this.apply(this.config)}}catch{this.config=null}}
 private apply(config:Config){this.env.COMFYUI_URL=config.url;this.env.COMFY_BASE_URL=config.proxy;if(config.proxyExe)this.env.COMFY_API_PROXY=config.proxyExe;this.onConfig()}
 private async save(config:Config){await mkdir(join(this.root,'outputs'),{recursive:true});await writeFile(join(this.root,'outputs','runtime-config.json'),JSON.stringify(config,null,2));this.config=config;this.apply(config)}
 private phase(phase:string,message:string,more:Partial<Task>={}){this.task={...this.task,phase,message,updatedAt:Date.now(),received:undefined,total:undefined,file:undefined,index:undefined,count:undefined,...more}}
 private async command(exe:string,args:string[],cwd:string,signal?:AbortSignal):Promise<string>{return new Promise((ok,fail)=>{
  const child=spawn(exe,args,{cwd,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe'],signal});let output='';const capture=(chunk:Buffer)=>{const text=chunk.toString().replace(/\x1b\[[0-9;]*m/g,'');output=(output+text).slice(-12000);for(const line of text.split(/[\r\n]+/).filter(Boolean))this.task.log=[...this.task.log,line.slice(-500)].slice(-15)};child.stdout.on('data',capture);child.stderr.on('data',capture);child.on('error',fail);child.on('close',code=>code===0?ok(output):fail(new Error(`${exe.split(/[\\/]/).pop()} failed (${code}). ${output.slice(-1000)}`)));
 })}
 private async python():Promise<{exe:string;prefix:string[]}>{
  const candidates=process.platform==='win32'?[{exe:'py',prefix:['-3.13']},{exe:'py',prefix:['-3.12']},{exe:'python',prefix:[]}]:[{exe:'python3',prefix:[]},{exe:'python',prefix:[]}];
  for(const candidate of candidates)try{await this.command(candidate.exe,[...candidate.prefix,'-c','import sys; assert (3,12)<=sys.version_info[:2]<(3,14)'],this.root);return candidate}catch{}
  throw new Error('Install Python 3.12 or 3.13, then retry. The existing ComfyUI option does not require reinstalling ComfyUI.');
 }
 private venvPython(path:string){return join(path,process.platform==='win32'?'Scripts/python.exe':'bin/python')}
 private async connector(signal:AbortSignal):Promise<string>{
  const folder=join(this.root,'.runtime','connector'),python=this.venvPython(folder),exe=join(folder,process.platform==='win32'?'Scripts/comfy-api-proxy.exe':'bin/comfy-api-proxy');for(const candidate of [this.env.COMFY_API_PROXY,join(this.root,'.venv',process.platform==='win32'?'Scripts/comfy-api-proxy.exe':'bin/comfy-api-proxy'),exe])if(candidate&&existsSync(candidate))return candidate;try{await this.command('comfy-api-proxy',['--help'],this.root,signal);return'comfy-api-proxy'}catch{}
  this.phase('installing','Installing the local SDK connector. This is setup, not generation.');const base=await this.python();await mkdir(join(this.root,'.runtime'),{recursive:true});if(!existsSync(python))await this.command(base.exe,[...base.prefix,'-m','venv',folder],this.root,signal);
  await this.command(python,['-m','pip','install','-r',join(this.root,'shared/runtime/requirements.txt')],this.root,signal);return exe;
 }
 private launch(work:()=>Promise<void>){if(this.task.busy)throw new Error('Setup is already running.');this.abort=new AbortController();this.task={phase:'checking',message:'Checking local runtime…',startedAt:Date.now(),updatedAt:Date.now(),busy:true,log:[]};void work().then(()=>this.phase('ready','Setup complete. You’re ready to create.',{busy:false})).catch(error=>this.phase(this.abort?.signal.aborted?'cancelled':'error',this.abort?.signal.aborted?'Setup stopped. Existing files are kept; retry when ready.':String(error.message||error),{busy:false,error:String(error.message||error)}));return this.task}
 private async reachable(url:string){try{const response=await fetch(url+'/system_stats',{redirect:'error',signal:AbortSignal.timeout(2500)});const data=await response.json();return response.ok&&data?.system&&Array.isArray(data?.devices)}catch{return false}}
 private async proxyReady(url:string){try{return(await fetch(url+'/api/v2/health',{redirect:'error',signal:AbortSignal.timeout(1500)})).ok}catch{return false}}
 async status(){
  const url=this.env.COMFYUI_URL||'http://127.0.0.1:8188';const connected=!!await this.reachable(url);if(!connected&&Date.now()-this.checkedDiscoveryAt>15000){this.checkedDiscoveryAt=Date.now();const candidates=['http://127.0.0.1:8188','http://127.0.0.1:8000'].filter(candidate=>candidate!==url);this.discoveries=(await Promise.all(candidates.map(async candidate=>await this.reachable(candidate)?candidate:null))).filter((candidate):candidate is string=>!!candidate)}const candidates=[this.config?.modelsDir,this.env.COMFYUI_MODELS_DIR,join(homedir(),'Documents/ComfyUI/models'),join(homedir(),'ComfyUI/models'),join(this.root,'.runtime/ComfyUI/models')].filter((p):p is string=>!!p&&existsSync(p));
  const manifest=JSON.parse(await readFile(join(this.root,'shared/runtime/models.json'),'utf8')) as {packs:ModelPack[];models:ModelFile[]},models=manifest.models;let inventory:string[]=[];
  if(connected)try{
   const categories=await fetch(url+'/models',{signal:AbortSignal.timeout(2500)}).then(r=>r.json());
   const inventories=await Promise.all(categories.filter((category:string)=>['checkpoints','diffusion_models','unet','text_encoders','clip','vae'].includes(category)).map(async(category:string)=>{
    const files=await fetch(url+'/models/'+category,{signal:AbortSignal.timeout(2500)}).then(r=>r.json());
    const canonical=category==='clip'?'text_encoders':category==='unet'?'diffusion_models':category;
    return files.map((file:string)=>canonical+'/'+file.replaceAll('\\','/'));
   }));inventory=inventories.flat();
  }catch{}

  const launcher=existingComfyLaunch(this.root,this.env,this.config?.launchDirectory);
  return{connected,canStart:this.config?.mode==='managed'||!!launcher,launchDirectory:launcher?.directory,detectedInstances:connected?[url]:this.discoveries,proxy:await this.proxyReady(this.env.COMFY_BASE_URL||'http://127.0.0.1:8189'),url,config:this.config,modelsDirs:[...new Set(candidates)],platform:process.platform,managedDir:join(this.root,'.runtime/ComfyUI'),task:this.task,packs:(manifest.packs||[...new Set(models.map(m=>m.used_by))].map(id=>({id,label:id,capability:'video',tier:'fast',minVramGB:0}) as ModelPack)).map(pack=>({id:pack.id,name:pack.label,note:pack.note,models:models.filter(m=>m.used_by===pack.id).map(m=>({...m,installed:inventory.includes(m.file)||(!connected&&!!this.config?.modelsDir&&existsSync(join(this.config.modelsDir,m.file)))}))}))};
 }
 connect(input:any){const url=localComfyUrl(input.url);const modelsDir=typeof input.modelsDir==='string'&&input.modelsDir.trim()?resolve(input.modelsDir.trim()):'';if(modelsDir&&(!isAbsolute(input.modelsDir.trim())||!existsSync(modelsDir)))throw new Error('Choose an existing absolute models-folder path, or leave it blank to connect without downloads.');return this.launch(async()=>{
  if(!await this.reachable(url))throw new Error('ComfyUI was not found at that address. Start it and retry.');const signal=this.abort!.signal;let proxy=this.env.COMFY_BASE_URL||'http://127.0.0.1:8189',proxyExe=this.env.COMFY_API_PROXY;
  if(url!==(this.env.COMFYUI_URL||'http://127.0.0.1:8188')||!await this.proxyReady(proxy)){proxyExe=await this.connector(signal);proxy='http://127.0.0.1:'+await freePort();await this.startProxy({...this.env,COMFYUI_URL:url,COMFY_BASE_URL:proxy,COMFY_API_PROXY:proxyExe});if(!await this.proxyReady(proxy))throw new Error('ComfyUI connected, but the SDK connector could not start. Check the setup log.')}
  await this.save({mode:'existing',url,proxy,modelsDir,proxyExe});
 })}
 install(input:any){if(!['nvidia','apple','cpu'].includes(input.gpu))throw new Error('Choose NVIDIA, Apple Silicon or CPU. Other GPUs can use the existing ComfyUI option.');if(input.gpu==='apple'&&process.platform!=='darwin')throw new Error('Apple Silicon setup is only available on macOS.');return this.launch(async()=>{
  const signal=this.abort!.signal,folder=join(this.root,'.runtime/ComfyUI'),venv=join(this.root,'.runtime/comfy-python'),python=this.venvPython(venv);const base=await this.python();await this.command('git',['--version'],this.root,signal).catch(()=>{throw new Error('Install Git from git-scm.com, then retry.')});await mkdir(join(this.root,'.runtime'),{recursive:true});
  let release=COMFY_RELEASE;const lock=join(this.root,'.runtime/comfy-release.json');if(existsSync(lock)&&JSON.parse(await readFile(lock,'utf8')).release!==COMFY_RELEASE)throw new Error('An older managed ComfyUI is present. Connect it as an existing instance, or move the managed folder aside before reinstalling.');
  if(!existsSync(join(folder,'main.py'))){this.phase('downloading','Downloading ComfyUI from its official stable release. Not generation.');if(existsSync(folder))throw new Error('A partial ComfyUI folder exists in .runtime/ComfyUI. Move it aside before retrying; it has not been overwritten.');const staging=await mkdtemp(join(this.root,'.runtime','comfy-install-'));try{await this.command('git',['clone','--depth','1','--branch',release,'https://github.com/Comfy-Org/ComfyUI.git',staging],this.root,signal);if((await this.command('git',['-C',staging,'rev-parse','HEAD'],this.root,signal)).trim()!==COMFY_COMMIT)throw new Error('The downloaded ComfyUI revision does not match the pinned release.');await rename(staging,folder)}finally{if(resolve(staging).startsWith(resolve(this.root,'.runtime')+(process.platform==='win32'?'\\':'/')))await rm(staging,{recursive:true,force:true})}await writeFile(lock,JSON.stringify({release,commit:COMFY_COMMIT,source:'https://github.com/Comfy-Org/ComfyUI.git'}))}
  this.phase('installing','Installing Python and GPU dependencies. These downloads only happen during setup.');if(!existsSync(python))await this.command(base.exe,[...base.prefix,'-m','venv',venv],this.root,signal);
  const torch=['-m','pip','install','torch==2.12.1','torchvision','torchaudio'];if(input.gpu!=='apple')torch.push('--index-url',input.gpu==='nvidia'?'https://download.pytorch.org/whl/cu130':'https://download.pytorch.org/whl/cpu');await this.command(python,torch,this.root,signal);await this.command(python,['-m','pip','install','-r',join(folder,'requirements.txt')],this.root,signal);const proxyExe=await this.connector(signal);
  const config:Config={mode:'managed',url:'http://127.0.0.1:'+await freePort(),proxy:'http://127.0.0.1:'+await freePort(),modelsDir:join(folder,'models'),proxyExe,gpu:input.gpu,release};const previous=this.config,previousChild=this.managed;this.config=config;try{await this.startManaged(signal);await this.startProxy({...this.env,COMFYUI_URL:config.url,COMFY_BASE_URL:config.proxy,COMFY_API_PROXY:config.proxyExe});if(!await this.proxyReady(config.proxy))throw new Error('ComfyUI installed, but the connector could not start. Retry setup.');await this.save(config)}catch(error){if(this.managed&&this.managed!==previousChild){this.managed.kill();this.managed=null}this.config=previous;throw error}
 })}
 async startManaged(signal?:AbortSignal){const config=this.config;if(config?.mode!=='managed')throw new Error('No managed ComfyUI has been installed.');if(await this.reachable(config.url))return;if(this.managed&&this.managed.exitCode===null)throw new Error('ComfyUI is already starting. Wait a moment and retry.');
  this.phase('starting','Starting your local ComfyUI. The first launch may take a moment.');const python=this.venvPython(join(this.root,'.runtime/comfy-python')),args=[join(this.root,'.runtime/ComfyUI/main.py'),'--listen','127.0.0.1','--port',new URL(config.url).port];if(config.gpu==='cpu')args.push('--cpu');
  await this.startProcess(config.url,python,args,join(this.root,'.runtime/ComfyUI'),signal);
 }
 private async startProcess(url:string,python:string,args:string[],cwd:string,signal?:AbortSignal){
  const child=spawn(python,args,{cwd,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONUNBUFFERED:'1'}});this.managed=child;let failure='';child.stdout.on('data',(chunk:Buffer)=>this.onServerLog(url,chunk.toString()));child.stderr.on('data',(chunk:Buffer)=>{failure=(failure+chunk.toString()).slice(-2000);this.onServerLog(url,chunk.toString())});child.on('error',e=>{failure=e.message});
  const cancel=()=>child.kill();signal?.addEventListener('abort',cancel,{once:true});try{for(let i=0;i<120;i++){signal?.throwIfAborted();if(await this.reachable(url))return;if(child.exitCode!==null||failure.includes('ENOENT'))throw new Error('ComfyUI could not start. '+failure);await new Promise(r=>setTimeout(r,1000))}throw new Error('ComfyUI is taking too long to start. Check the local runtime and retry. '+failure)}finally{signal?.removeEventListener('abort',cancel)}
 }
 start(){return this.launch(async()=>{const signal=this.abort!.signal;let previous=this.config;
  if(previous?.mode==='managed')await this.startManaged(signal);
  else{
   const url=localComfyUrl(previous?.url||this.env.COMFYUI_URL||'http://127.0.0.1:8188');
   const launcher=existingComfyLaunch(this.root,this.env,previous?.launchDirectory);
   if(!await this.reachable(url)){
    if(!launcher)throw Error('No launchable local ComfyUI found. Install one in Local setup, or set COMFYUI_DIR to its folder.');
    if(this.managed&&this.managed.exitCode===null)throw Error('ComfyUI is already starting. Wait a moment and retry.');
    this.phase('starting','Starting your installed ComfyUI. No models are being generated.');
    const args=[join(launcher.directory,'main.py'),'--listen','127.0.0.1','--port',new URL(url).port||'80','--disable-auto-launch'];
    if(launcher.modelPaths.length)args.push('--extra-model-paths-config',...launcher.modelPaths);
    await this.startProcess(url,launcher.python,args,launcher.directory,signal);
   }
   previous={...previous,mode:'existing',url,proxy:previous?.proxy||this.env.COMFY_BASE_URL||'http://127.0.0.1:8189',modelsDir:previous?.modelsDir||this.env.COMFYUI_MODELS_DIR||'',...(launcher?{launchDirectory:launcher.directory}:{})};
  }
  if(!previous)throw Error('Local runtime configuration missing.');
  if(await this.proxyReady(previous.proxy)){await this.save(previous);return}
  const next={...previous,proxy:'http://127.0.0.1:'+await freePort(),proxyExe:await this.connector(signal)};await this.startProxy({...this.env,COMFYUI_URL:next.url,COMFY_BASE_URL:next.proxy,COMFY_API_PROXY:next.proxyExe});if(!await this.proxyReady(next.proxy))throw new Error('The SDK connector could not start. Check setup details and retry.');await this.save(next)
 })}
 download(input:any){const groups=input.packs;const manifest=JSON.parse(readFileSync(join(this.root,'shared/runtime/models.json'),'utf8')) as {packs?:ModelPack[];models:ModelFile[]},known=manifest.packs?manifest.packs.map(p=>p.id):manifest.models.map(m=>m.used_by);if(!Array.isArray(groups)||!groups.length||groups.some((g:unknown)=>!known.includes(g as string)))throw new Error('Choose at least one model pack.');const root=this.config?.modelsDir;if(!root)throw new Error('Connect a models folder before downloading.');return this.launch(async()=>{
  const models=(JSON.parse(await readFile(join(this.root,'shared/runtime/models.json'),'utf8')).models as ModelFile[]).filter(m=>groups.includes(m.used_by));this.phase('downloading','Downloading selected models. This is a one-time setup step, not generation.');await downloadModels(root,models,{token:this.env.HF_TOKEN,signal:this.abort!.signal,onProgress:update=>this.phase('downloading',`Downloading model ${update.index}/${update.count}: ${update.file}. Not generation.`,update)});
 })}
 cancel(){this.abort?.abort();return this.task}
}
