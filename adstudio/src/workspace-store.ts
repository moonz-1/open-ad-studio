// One application owner for project snapshots, ordered writes and job locks.
// React subscribes; inference/services use the same Projects facade. No DOM.
import {Projects,newProject,openProjectDriver,migrateProject,restoredAttempt,ACTIVE_KEY,type AdProject,type ProductAsset,type ProjectDriver} from './projects.ts';
import {validateBrand,type BrandProfile} from '../../shared/lib/brand.ts';
import type {MediaAsset} from './composition.ts';
type Remember=Pick<Storage,'getItem'|'setItem'>;
type Pending<T>={value:T;owner:string;revision:number};
export type WorkspaceSnapshot={projects:AdProject[];brands:BrandProfile[];activeId:string;status:'loading'|'saving'|'saved'|'error';saveError:string;error:string;busy:string;dirty:number;durable:boolean;notice:string};
const message=(e:unknown)=>e instanceof Error?e.message:String(e);
export class WorkspaceStore {
 readonly projects:Projects;
 private records=new Map<string,AdProject>();private brands=new Map<string,BrandProfile>();
 private photos=new Map<string,Pending<ProductAsset>>();private media=new Map<string,Pending<MediaAsset>>();
 private dirtyProjects=new Map<string,number>();private dirtyBrands=new Map<string,number>();
 private failures=new Map<string,string>();
 private listeners=new Set<()=>void>();private tail:Promise<unknown>=Promise.resolve();private revision=0;private dead=false;
 private state:WorkspaceSnapshot={projects:[],brands:[],activeId:'',status:'loading',saveError:'',error:'',busy:'',dirty:0,durable:true,notice:''};
 constructor(private driver:ProjectDriver,private remember?:Remember,private reopen:()=>Promise<ProjectDriver>=openProjectDriver,durable=true){
  this.state.durable=durable;
  this.projects=new Projects({all:async()=>structuredClone([...this.records.values()]),brands:async()=>structuredClone([...this.brands.values()]),asset:id=>this.asset(id),media:id=>this.mediaAsset(id),put:(p,a,m)=>this.put(p,a,m),putBrand:(b,a)=>this.putBrand(b,a)});
 }
 getSnapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private emit(patch:Partial<WorkspaceSnapshot>={}){if(this.dead)return;this.state={...this.state,...patch,projects:structuredClone([...this.records.values()]).sort((a,b)=>b.updated-a.updated),brands:structuredClone([...this.brands.values()]),dirty:this.dirtyProjects.size+this.dirtyBrands.size};for(const listener of this.listeners)listener();}
 async initialize(){
  // Read/validate everything before the first write; corrupt records never cause
  // a demo/blank registry to overwrite existing projects.
  const [list,brands]=await Promise.all([this.driver.all(),this.driver.brands?.()||[]]);
  for(const raw of list){const p=migrateProject(raw);this.records.set(p.id,p);}for(const raw of brands){const b=validateBrand(raw);this.brands.set(b.id,b);}
  let active='';try{active=this.remember?.getItem(ACTIVE_KEY)||'';}catch{this.state.notice='This browser cannot remember the selected project.';}
  const isNew=!this.records.size,p=this.records.get(active)||[...this.records.values()].sort((a,b)=>b.updated-a.updated)[0]||newProject('Your first advertisement');this.records.set(p.id,p);this.state.activeId=p.id;
  this.emit({status:this.state.durable?'saved':'error',saveError:this.state.durable?'':'Browser storage is unavailable. Keep this tab open and retry saving.'});this.rememberActive();
  if(isNew||restoredAttempt(p))await this.put(p).catch(()=>{});return this;
 }
 private rememberActive(){try{this.remember?.setItem(ACTIVE_KEY,this.state.activeId);}catch{this.emit({notice:'The selected project could not be remembered. Project data is saved separately.'});}}
 active(){const p=this.records.get(this.state.activeId);if(!p)throw Error('Open a saved project.');return structuredClone(p);}
 private queue(task:()=>Promise<void>){const next=this.tail.then(task);this.tail=next.catch(()=>{});return next;}
 private stageAssets(owner:string,revision:number,assets:ProductAsset[]=[],media:MediaAsset[]=[]){for(const a of assets)this.photos.set(a.id,{value:structuredClone(a),owner,revision});for(const m of media)this.media.set(m.id,{value:structuredClone(m),owner,revision});}
 private async put(project:AdProject,assets:ProductAsset[]=[],media:MediaAsset[]=[]){
  const p=migrateProject(structuredClone(project)),rev=++this.revision;this.records.set(p.id,p);this.stageAssets(p.id,rev,assets,media);this.dirtyProjects.set(p.id,rev);this.saved();
  const photos=[...this.photos.values()].filter(v=>v.owner===p.id),files=[...this.media.values()].filter(v=>v.owner===p.id);
  return this.queue(async()=>{try{if(!this.state.durable)throw Error('Browser database is unavailable.');await this.driver.put(p,photos.map(v=>v.value),files.map(v=>v.value));for(const a of photos)if(this.photos.get(a.value.id)?.revision===a.revision)this.photos.delete(a.value.id);for(const m of files)if(this.media.get(m.value.id)?.revision===m.revision)this.media.delete(m.value.id);if(this.dirtyProjects.get(p.id)===rev){this.dirtyProjects.delete(p.id);this.failures.delete('project:'+p.id);}this.saved();}catch(e){this.failed(e,'project:'+p.id);throw e;}});
 }
 private async putBrand(brand:BrandProfile,assets:ProductAsset[]=[]){
  const b=structuredClone(validateBrand(brand)),rev=++this.revision;this.brands.set(b.id,b);this.stageAssets('brand:'+b.id,rev,assets);this.dirtyBrands.set(b.id,rev);this.saved();const photos=[...this.photos.values()].filter(v=>v.owner==='brand:'+b.id);
  return this.queue(async()=>{try{if(!this.state.durable||!this.driver.putBrand)throw Error('Brand storage is unavailable.');await this.driver.putBrand(b,photos.map(v=>v.value));for(const a of photos)if(this.photos.get(a.value.id)?.revision===a.revision)this.photos.delete(a.value.id);if(this.dirtyBrands.get(b.id)===rev){this.dirtyBrands.delete(b.id);this.failures.delete('brand:'+b.id);}this.saved();}catch(e){this.failed(e,'brand:'+b.id);throw e;}});
 }
 private saved(){const dirty=this.dirtyProjects.size+this.dirtyBrands.size,error=[...this.failures.values()].at(-1)||'';this.emit({status:error?'error':dirty?'saving':'saved',saveError:error});}
 private failed(e:unknown,owner?:string){if(owner)this.failures.set(owner,message(e));this.emit({status:'error',saveError:message(e)});}
 async asset(id:string){return structuredClone(this.photos.get(id)?.value)||this.driver.asset(id);}
 async mediaAsset(id:string){return structuredClone(this.media.get(id)?.value)||this.driver.media?.(id);}
 async edit(change:(p:AdProject)=>void,assets:ProductAsset[]=[],media:MediaAsset[]=[]){if(this.state.busy)throw Error('Finish the current operation first.');if(this.dead)throw Error('This workspace is closed.');const p=this.active();change(p);return this.projects.save(p,assets,media);}
 async flush(){for(;;){const latest=this.tail;await latest;if(latest===this.tail)break;}if(this.dirtyProjects.size||this.dirtyBrands.size||!this.state.durable)throw Error('Latest changes are not saved. Retry saving before leaving this project.');}
 async retry(){if(this.state.busy||this.dead)throw Error('Finish the current operation before retrying storage.');this.emit({busy:'Retrying saved changes'});await this.tail;try{
   const driver=await this.reopen(); // Merge unseen records; never rewrite all projects.
   const existing=await driver.all(),brands=await driver.brands?.()||[];for(const raw of existing){const p=migrateProject(raw);if(!this.records.has(p.id))this.records.set(p.id,p);}for(const raw of brands){const b=validateBrand(raw);if(!this.brands.has(b.id))this.brands.set(b.id,b);}this.driver=driver;this.state.durable=true;
   for(const id of [...this.dirtyBrands.keys()])await this.putBrand(this.brands.get(id)!);for(const id of [...this.dirtyProjects.keys()])await this.put(this.records.get(id)!);this.saved();
  }catch(e){this.failed(e);throw e;}finally{this.emit({busy:''});}}
 async switchProject(id:string){return this.run('Opening project',async()=>{if(!this.records.has(id))throw Error('Project is missing.');this.emit({activeId:id,error:''});this.rememberActive();});}
 async createProject(name:string,initialize?:(p:AdProject)=>void){return this.run('Creating project',async()=>{const p=newProject(name);initialize?.(p);await this.projects.save(p);this.emit({activeId:p.id,error:''});this.rememberActive();return p;});}
 async run<T>(label:string,operation:()=>Promise<T>){if(this.state.busy)throw Error('An operation is already running. Do not submit twice.');if(this.dead)throw Error('This workspace is closed.');this.emit({busy:label,error:''});try{await this.flush();if(this.dead)throw Error('The workspace closed before the operation started.');return await operation();}catch(e){this.emit({error:message(e)});throw e;}finally{this.emit({busy:''});}}
 report(e:unknown){this.emit({error:message(e)});}
 notify(notice:string){this.emit({notice});}
 clearError(){this.emit({error:'',notice:''});}
 dispose(){this.dead=true;this.listeners.clear();}
}
