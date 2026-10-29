// Actual app/storage/compositor with MOCK background inference only. No browser,
// native inference or owner's project. Guards against nested ads on later export.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {WorkspaceStore} from '../src/workspace-store.ts';
import {memoryDriver} from '../src/projects.ts';
import {AdApplication} from '../src/ad-application.ts';
import {CreativeStudioService} from '../src/creative-service.ts';
import {createCreativeEngine} from '../../shared/runtime/creative-engine.ts';
import {exportStaticAd} from '../../shared/runtime/static-ad.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
import {png,encode} from './creative-fixtures.mjs';
const parent=resolve('outputs'),out=await mkdtemp(join(parent,'klein-app-cpu-')),driver=memoryDriver(),store=await new WorkspaceStore(driver).initialize(),realFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>typeof url==='string'&&url.startsWith('/outputs/')?new Response(await readFile(join(out,url.slice(9))),{headers:{'Content-Type':'image/png'}}):realFetch(url,options);
const upload=async data=>{const b=Buffer.from(data.split(',')[1],'base64'),file=heroSha(b).slice(0,16)+'.png';await writeFile(join(out,file),b);return {url:'/outputs/'+file};},engine=createCreativeEngine(out,{status:async()=>({available:false,model:'MOCK unavailable text',reason:'No inference'}),generate:async()=>assert.fail('No inference')}),creative=new CreativeStudioService(store.projects,{upload,creativePlan:b=>engine.plan(b),creativePlanRecord:(id,p)=>engine.get(id,p),creativeSelect:b=>engine.select(b),creativePrepare:b=>engine.prepare(b)},encode);
let calls=0,fail=false;const raw=Buffer.from(new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="640"><rect width="512" height="640" fill="#d8ceb5"/></svg>').render().asPng());await writeFile(join(out,'bbbbbbbbbbbbbbbb.png'),raw);
const app=new AdApplication(store,creative,{upload,staticAd:b=>exportStaticAd(b,out),research:async()=>assert.fail('No website'),capabilities:async()=>({finish:true,qwen:{available:false},klein:{available:!fail,installed:true,tested:true,status:fail?'busy':'available',reason:'MOCK CPU capability only'}}),adBackground:async body=>{calls++;assert.ok(body.preparedId);return {model:'klein-background',jobId:'MOCK-NOT-INFERENCE',provenanceId:'b'.repeat(16),url:'/outputs/bbbbbbbbbbbbbbbb.png',width:512,height:640,sha256:heroSha(raw),workflowSha256:'e'.repeat(64),seconds:1,prompt:'MOCK CPU background',seed:42};}},encode);
try{
 await app.addPhoto({id:'authorized-synthetic',name:'Synthetic.png',original:new Blob([png],{type:'image/png'}),normalized:new Blob([png],{type:'image/png'}),width:2,height:2,created:1});await app.editOnboarding({name:'Synthetic test brand'});await app.editDraft({productType:'packaged-goods',facts:{description:'One synthetic colored bottle fixture with a matte cap.',arrangement:'',texture:'',container:'',confirmed:false}});const plan=await app.develop('basic');await app.approve(plan.id,true);await app.selectEngine('klein');const take=await app.generateWithBackground(plan.id,await creative.open(store.active().id,plan.id),'cpu-legacy-background');assert.equal(calls,1);assert.equal(take.model,'klein-background');assert.equal(take.sourceSha256,heroSha(png));assert.equal(take.background.sha256,heroSha(raw));assert.ok(take.adDesign);
 let result=await app.exportTake(take,{headline:'Edited copy'},true);assert.equal(result.sources.photo,heroSha(png));assert.equal(result.sources.support,heroSha(raw));
 const brand=store.getSnapshot().brands.find(b=>b.id===store.active().brandId);brand.dna.tone='Customer correction.';await app.saveBrand(brand);assert.equal(store.active().creative.activeId,undefined);result=await app.exportTake(take,{headline:'Historical edit'},true);assert.equal(result.sources.photo,heroSha(png),'Never use the already-composed ad as the photo');assert.equal(result.sources.support,heroSha(raw));assert.equal(result.design.concept,take.adDesign.concept);assert.equal(calls,1,'Editing/export never reruns inference');
 await store.flush();const restored=await new WorkspaceStore(driver).initialize();assert.equal(restored.active().hero.takes[0].background.sha256,heroSha(raw));assert.equal(restored.active().creative.generationEngine,'klein');assert.equal(heroSha(Buffer.from(await(await restored.asset(take.background.assetId)).original.arrayBuffer())),heroSha(raw));restored.dispose();
 fail=true;const reviewed=await app.develop('basic');await app.approve(reviewed.id,true);await assert.rejects(()=>app.generate(reviewed.id,'klein'),/MOCK CPU capability/);const baseline=await app.generate(reviewed.id,'automatic');assert.equal(baseline.model,'product-safe');assert.equal(calls,1);assert.ok(store.active().hero.takes.some(t=>t.id===take.id));
 console.log('PASS actual app/RAM storage/static renderer: MOCK background -> saved raw + completed PNG; model/hash/history persistence; original source on historical export; no rerun; explicit unavailable AI fails while Automatic safely produces product-safe output. MOCK inference only.');
}finally{globalThis.fetch=realFetch;store.dispose();if(!out.startsWith(parent+sep))throw Error('Unsafe cleanup');await rm(out,{recursive:true,force:true});}
