// Real services and isolated memory storage. No owner IDB, browser or inference.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createCreativeEngine} from '../../shared/runtime/creative-engine.ts';
import {CreativeStudioService} from '../src/creative-service.ts';
import {AdApplication,draftFor,directionCurrent} from '../src/ad-application.ts';
import {WorkspaceStore} from '../src/workspace-store.ts';
import {memoryDriver,newProject} from '../src/projects.ts';
import {openCampaignReview} from '../src/review-handoff.ts';
import {inputFixture,png,encode} from './creative-fixtures.mjs';
const parent=resolve('outputs'),root=await mkdtemp(join(parent,'campaign-review-cpu-')),input=inputFixture(),driver=memoryDriver(),keys=new Map(),remember={getItem:k=>keys.get(k),setItem:(k,v)=>keys.set(k,v)};
let modelCalls=0;const engine=createCreativeEngine(root,{status:async()=>({available:false,model:'MOCK missing',reason:'CPU only'}),generate:async()=>{modelCalls++;throw Error('No model expected');}});
try{
 await writeFile(join(root,'aaaaaaaaaaaaaaaa.png'),png);
 const p=newProject('Existing saved project');p.id=input.projectId;p.brandId=input.brand.id;p.assetId=input.source.id;
 p.creative={version:1,plans:[{id:'old-record',created:1,sourceId:input.source.id,brandId:input.brand.id,summary:'Old direction',provider:'deterministic',basisHero:'old'}],activeId:'old-record',step:'result',draft:{sourceId:input.source.id,facts:input.facts,productType:input.productType,request:'Earlier draft',intent:'enhancement',format:'feed'}};
 const oldHero=structuredClone(p.hero),oldDraft=structuredClone(p.creative.draft),photo={id:input.source.id,name:input.source.name,original:new Blob([png],{type:'image/png'}),normalized:new Blob([png],{type:'image/png'}),width:96,height:128,created:1};
 const other=newProject('Other project');await driver.put(p,[photo],[]);await driver.put(other,[],[]);await driver.putBrand(input.brand,[]);
 const store=await new WorkspaceStore(driver,remember,async()=>driver).initialize();await store.switchProject(other.id);
 const client={creativePlanRecord:(id,pid)=>engine.get(id,pid),upload:async()=>{throw Error('Opening review must not upload');},qwenHero:async()=>{throw Error('Must never generate');}},service=new CreativeStudioService(store.projects,client,encode),app=new AdApplication(store,service);
 const plan=await engine.plan({planningMode:'basic',image:'/outputs/aaaaaaaaaaaaaaaa.png',input}),address='http://127.0.0.1:8310/adstudio/?campaign='+plan.id+'&project='+p.id+'#hero';
 for(const bad of [address.replace(':8310',':9999'),address.replace('127.0.0.1','localhost'),address.replace('#hero','&campaign='+plan.id+'#hero'),address.replace(plan.id,'../bad'),address.replace(p.id,'unknown')])await assert.rejects(()=>openCampaignReview(bad,app));
 assert.equal(store.active().id,other.id,'Failed link restores prior active project');
 const cleaned=await openCampaignReview(address,app);assert.equal(cleaned.href,'http://127.0.0.1:8310/adstudio/#hero');assert.equal(store.active().id,p.id);
 let saved=store.active();assert.equal(saved.creative.activeId,plan.id);assert.equal(saved.creative.step,'direction');assert.equal(saved.creative.plans.length,2);assert.equal(saved.creative.plans[1].preparedId,undefined);assert.equal(saved.creative.draft.facts.confirmed,false);assert.equal(plan.draft.reviewedSnapshot,undefined);assert.deepEqual(saved.hero,oldHero);assert.deepEqual(saved.creative.handoffs[0].draft,oldDraft);assert.equal(modelCalls,0);
 assert.equal(directionCurrent(saved,plan,input.brand),true);
 for(const patch of [{seed:43},{notes:'Changed notes'},{constraints:{angle:'none'}}]){const changed=structuredClone(saved);Object.assign(changed.creative.draft,patch);assert.equal(directionCurrent(changed,plan,input.brand),false);}
 await assert.rejects(()=>app.request(),/Accept/);
 await store.edit(p=>{p.creative.draft.request='Owner editing after open';});await openCampaignReview(address,app);assert.equal(draftFor(store.active()).request,'Owner editing after open','Link replay preserves later edits');assert.equal(store.active().creative.plans.length,2);
 const restored=await new WorkspaceStore(driver,remember,async()=>driver).initialize();assert.equal(restored.active().creative.activeId,plan.id);assert.equal(draftFor(restored.active()).request,'Owner editing after open');assert.deepEqual(restored.active().hero,oldHero);assert.equal(await(await restored.asset(photo.id)).original.text(),await photo.original.text());
 // Hash/brand changes fail before mutation, including real blob hashing.
 const newPlan=await engine.plan({planningMode:'basic',image:'/outputs/aaaaaaaaaaaaaaaa.png',input}),before=structuredClone(store.active());
 await store.projects.saveBrand({...input.brand,updated:input.brand.updated+1});await assert.rejects(()=>service.attachPlan(p.id,newPlan.id),/differs/);assert.deepEqual(store.active(),before);
 await store.projects.saveBrand(input.brand);await driver.put(store.active(),[{...photo,normalized:new Blob(['CORRUPT'])}],[]);await assert.rejects(()=>service.attachPlan(p.id,newPlan.id),/differs/);assert.deepEqual(store.active(),before);
 await assert.rejects(()=>service.attachPlan(other.id,newPlan.id),/another project/);assert.equal(modelCalls,0);store.dispose();restored.dispose();
 console.log('PASS same-origin owner review handoff: real hash/profile validation, old draft/history preserved, idempotent reopen, no upload/approval/generation, stale seed/notes/controls rejection, isolated durable reopen. NOT browser acceptance.');
}finally{if(!root.startsWith(parent+sep))throw Error('Unsafe test cleanup');await rm(root,{recursive:true,force:true});}
