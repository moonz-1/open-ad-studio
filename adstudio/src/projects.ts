// Ad Studio domain/storage only. No Director UI imports or initialization side effects.
export const DATABASE = 'osh-adstudio-projects';
export const ACTIVE_KEY = 'osh-adstudio:active:v1';
import {emptyComposition,validateComposition,type Composition,type MediaAsset} from './composition.ts';
import {validateBrand,type BrandProfile} from '../../shared/lib/brand.ts';
import {heroDefaults,validateHeroWorkspace,type HeroWorkspace} from '../../shared/lib/hero-ad.ts';
import {emptyStaticAds,validateStaticWorkspace,type StaticWorkspace} from '../../shared/lib/static-ad.ts';
import type {CreativeWorkspace} from './creative-service.ts';
export type Ratio = '16:9'|'9:16'|'1:1';
export type Mode = 'camera'|'locked'|'creative';
export type Settings = {template:string;mode:Mode;motion:'push'|'pan-left'|'pan-right';ratios:Ratio[];duration:number;seed:number;pitch:string;tagline:string;vibe:'studio'|'life'|'ugc';framing:'fit'|'crop';model?:string};
export type ProductAsset = {palette?:import('../../shared/lib/brand.ts').ImagePalette;provenance?:import('../../shared/lib/source-provenance.ts').WebsiteSource;originalWidth?:number;originalHeight?:number;id:string;name:string;original:Blob;normalized:Blob;width:number;height:number;created:number};
export type EditRecipe = {start:number;end:number;speed:number;reverse:boolean;width:number;height:number};
export type Take = {film?:{execution:'ltx'|'photograph-motion';clips:{url:string;kind:'still'|'generated';duration:number;jobId?:string}[]};quality?:{status:'unreviewed';technical:'assembled';limitations:string[];shotPlanId:string};id:string;created:number;assetId:string;source:string;parentId?:string;kind:'generation'|'edit';mode:Mode;ratio:Ratio;settings:Settings;prompt:string;frames:number;fps:number;width:number;height:number;seconds:number;background?:string;edit?:EditRecipe;exports:{id:string;url:string;tagline:string;created:number}[]};
export type Attempt = {engine?:string;id:string;status:'running'|'complete'|'failed'|'interrupted';created:number;takeIds:string[];error?:string};
export type AdProject = {version:3;id:string;name:string;created:number;updated:number;settings:Settings;assetId?:string;brandId?:string;staticAds?:StaticWorkspace;hero?:HeroWorkspace;creative?:CreativeWorkspace;takes:Take[];attempt?:Attempt;composition:Composition};
export const defaults = ():Settings => ({template:'portrait-push',mode:'camera',motion:'push',ratios:['9:16'],duration:3,seed:1,pitch:'A slow camera push toward the product, soft studio lighting, subtle reflections, premium commercial product shot.',tagline:'',vibe:'studio',framing:'fit'});
export function newProject(name='Untitled ad'):AdProject {
 const now=Date.now();return {version:3,id:crypto.randomUUID(),name:validName(name),created:now,updated:now,settings:defaults(),takes:[],composition:emptyComposition(),staticAds:emptyStaticAds(),hero:heroDefaults()};
}
export function validName(name:string) {const value=name.trim();if(!value||value.length>60)throw new Error('Use a project name of 1–60 characters.');return value;}
export function migrateProject(value:unknown):AdProject {
 if(!value||typeof value!=='object')throw new Error('Project data is unreadable. Saved data was not overwritten.');
 const p=value as Record<string,any>;
 if(![1,2,3].includes(p.version)||typeof p.id!=='string'||typeof p.name!=='string')throw new Error('Unsupported project version. Saved data was not overwritten.');
 const settings={...defaults(),...p.settings};
 if(!['camera','locked','creative'].includes(settings.mode)||!Array.isArray(settings.ratios)||settings.ratios.some((r:unknown)=>!['16:9','9:16','1:1'].includes(String(r))))throw new Error('Invalid project settings. Saved data was not overwritten.');
 const takes=p.version===1?(p.outputs||[]).map((t:any,i:number)=>({...t,id:t.id||`legacy-${p.id}-${i}`,kind:t.kind||'generation',settings:t.settings||structuredClone(settings),exports:t.exports||[]})):p.takes;
 const video=(url:unknown)=>typeof url==='string'&&/^\/outputs\/[a-f0-9]{16}\.(webm|mp4)$/.test(url);
 const integer=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isInteger(n)&&n>=min&&n<=max;
 if(!Array.isArray(takes)||takes.some((t:any)=>!t||typeof t.id!=='string'||!t.id||!video(t.source)||(t.background&&!video(t.background))||!t.settings||!['camera','locked','creative'].includes(t.mode)||!['16:9','9:16','1:1'].includes(t.ratio)||!integer(t.width,16,4096)||!integer(t.height,16,4096)||t.width*t.height>4096*2160||!integer(t.frames,1,100000)||!integer(t.fps,1,120)||!Array.isArray(t.exports)||t.exports.some((e:any)=>!e||!video(e.url))))throw new Error('Invalid saved history. Saved data was not overwritten.');
 // Product-safe is local deterministic composition, so an interrupted attempt
 // with no delivered take has no unverified model job to acknowledge. Keep all
 // AI/unknown engines conservative and require an explicit new Generate click.
 const attempt=p.attempt&&typeof p.attempt==='object'?{...p.attempt}:undefined;
 if(attempt?.engine==='product-safe'&&attempt.status==='interrupted'&&Array.isArray(attempt.takeIds)&&attempt.takeIds.length===0){attempt.status='failed';attempt.error='Product-safe composition did not finish. Your original is saved; you can try again.';}
 return {...p,...(attempt?{attempt}:{}),version:3,settings,takes,composition:p.version===3?validateComposition(p.composition):emptyComposition(),hero:p.hero?validateHeroWorkspace(p.hero):heroDefaults(),staticAds:p.staticAds?validateStaticWorkspace(p.staticAds):emptyStaticAds()} as AdProject;
}
export interface ProjectDriver {all():Promise<unknown[]>;put(project:AdProject,assets?:ProductAsset[],media?:MediaAsset[]):Promise<void>;asset(id:string):Promise<ProductAsset|undefined>;media?(id:string):Promise<MediaAsset|undefined>;brands?():Promise<unknown[]>;putBrand?(brand:BrandProfile,assets:ProductAsset[]):Promise<void>}
export class Projects {
 private driver:ProjectDriver;
 constructor(driver:ProjectDriver) {this.driver=driver;}
 async list(){return (await this.driver.all()).map(migrateProject).sort((a,b)=>b.updated-a.updated);}
 async save(project:AdProject,assets:ProductAsset|ProductAsset[]=[],media:MediaAsset[]=[]){const snapshot=structuredClone(project);snapshot.updated=Date.now();await this.driver.put(snapshot,structuredClone(Array.isArray(assets)?assets:[assets]),structuredClone(media));}
 asset(id:string){return this.driver.asset(id);}
 media(id:string){return this.driver.media?.(id)||Promise.resolve(undefined);}
 async brands(){return (await this.driver.brands?.()||[]).map(validateBrand).sort((a,b)=>b.updated-a.updated);}
 async saveBrand(brand:BrandProfile,assets:ProductAsset[]=[]){if(!this.driver.putBrand)throw Error('Brand storage is unavailable.');const snapshot=structuredClone(validateBrand(brand));await this.driver.putBrand(snapshot,structuredClone(assets));}
}
export function memoryDriver():ProjectDriver {
 const projects=new Map<string,AdProject>(),assets=new Map<string,ProductAsset>(),media=new Map<string,MediaAsset>(),brands=new Map<string,BrandProfile>();
 return {all:async()=>structuredClone([...projects.values()]),put:async(p,list=[],files=[])=>{projects.set(p.id,structuredClone(p));for(const a of list)assets.set(a.id,structuredClone(a));for(const m of files)media.set(m.id,structuredClone(m));},asset:async id=>structuredClone(assets.get(id)),media:async id=>structuredClone(media.get(id)),brands:async()=>structuredClone([...brands.values()]),putBrand:async(b,list)=>{brands.set(b.id,structuredClone(b));for(const a of list)assets.set(a.id,structuredClone(a));}};
}
export function openProjectDriver():Promise<ProjectDriver> {
 return new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB)return reject(new Error('Browser database unavailable.'));
  const request=indexedDB.open(DATABASE,3);
  request.onupgradeneeded=()=>{const db=request.result;for(const store of ['projects','assets','media','brands'])if(!db.objectStoreNames.contains(store))db.createObjectStore(store,{keyPath:'id'});};
  request.onerror=()=>reject(request.error||new Error('Could not open project storage.'));
  request.onblocked=()=>reject(new Error('Close other Ad Studio tabs, then retry saving.'));
  request.onsuccess=()=>{
   const db=request.result;db.onversionchange=()=>db.close();
   function read<T>(store:string,key?:string):Promise<T>{return new Promise((ok,fail)=>{const tx=db.transaction(store,'readonly'),req=key===undefined?tx.objectStore(store).getAll():tx.objectStore(store).get(key);req.onsuccess=()=>ok(req.result);req.onerror=()=>fail(req.error);});}
   resolve({all:()=>read<unknown[]>('projects'),asset:id=>read<ProductAsset|undefined>('assets',id),media:id=>read<MediaAsset|undefined>('media',id),brands:()=>read<unknown[]>('brands'),putBrand:(brand,assets)=>new Promise<void>((ok,fail)=>{const tx=db.transaction(['brands','assets'],'readwrite');tx.oncomplete=()=>ok();tx.onabort=()=>fail(tx.error||new Error('Brand storage full or unavailable.'));tx.onerror=()=>{};tx.objectStore('brands').put(brand);for(const asset of assets)tx.objectStore('assets').put(asset);}),put:(project,assets=[],media=[])=>new Promise<void>((ok,fail)=>{const tx=db.transaction(['projects','assets','media'],'readwrite');tx.oncomplete=()=>ok();tx.onabort=()=>fail(tx.error||new Error('Storage full or unavailable.'));tx.onerror=()=>{};tx.objectStore('projects').put(project);for(const asset of assets)tx.objectStore('assets').put(asset);for(const file of media)tx.objectStore('media').put(file);})});
  };
 });
}
export function restoredAttempt(project:AdProject):boolean {
 if(project.attempt?.status!=='running')return false;
 project.attempt.status='interrupted';project.attempt.error='A previous render was interrupted. Inspect saved takes and the local queue before generating again.';return true;
}
