import {existsSync,readdirSync,statSync} from 'node:fs';
import {join,resolve,isAbsolute} from 'node:path';
import {homedir} from 'node:os';
export type ComfyLaunch={directory:string;python:string;modelPaths:string[]};
/** Detect known local installs; never execute a shell command supplied by the browser. */
export function existingComfyLaunch(root:string,env:Record<string,string|undefined>,savedDirectory?:string,home=homedir(),platform=process.platform):ComfyLaunch|null{
 const desktop=join(home,'AppData/Local/Comfy-Desktop/ComfyUI-Installs/ComfyUI/ComfyUI');
 const candidates=[savedDirectory,env.COMFYUI_DIR,join(root,'.runtime/ComfyUI'),desktop,join(home,'Documents/ComfyUI'),join(home,'ComfyUI')];
 const file=(path:string)=>{try{return statSync(path).isFile()}catch{return false}};
 for(const candidate of candidates){
  if(!candidate||!isAbsolute(candidate))continue;const directory=resolve(candidate);if(!file(join(directory,'main.py')))continue;
  const python=[join(directory,platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python'),join(directory,'../python_embeded/python.exe'),...(directory===resolve(root,'.runtime/ComfyUI')?[join(root,platform==='win32'?'.runtime/comfy-python/Scripts/python.exe':'.runtime/comfy-python/bin/python')]:[])].find(file);
  if(!python)continue;
  let modelPaths:string[]=[];const folder=join(home,'AppData/Roaming/Comfy Desktop/instance-model-paths');
  if(directory===resolve(desktop)&&existsSync(folder))try{modelPaths=readdirSync(folder).filter(name=>/\.ya?ml$/i.test(name)).slice(0,32).map(name=>join(folder,name)).filter(file)}catch{}
  return {directory,python:resolve(python),modelPaths};
 }
 return null;
}
