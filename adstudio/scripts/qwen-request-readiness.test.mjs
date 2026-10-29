// Actual application/brand/planner/storage/request logic; synthetic media and
// explicitly MOCK text inference. RAM driver, never the owner's IndexedDB.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createBrandService} from '../../shared/runtime/brand-service.ts';
import {collectBrandImage} from '../../shared/runtime/brand-research.ts';
import {createCreativeEngine,creativePlanningRequest} from '../../shared/runtime/creative-engine.ts';
import {creativeContext} from '../../shared/lib/creative-engine.ts';
import {brandFieldStatus,editBrandField,approveBrandField} from '../../shared/lib/brand.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
import {WorkspaceStore} from '../src/workspace-store.ts';
import {memoryDriver} from '../src/projects.ts';
import {AdApplication,draftFor} from '../src/ad-application.ts';
import {CreativeStudioService} from '../src/creative-service.ts';
import {encode} from './creative-fixtures.mjs';
import {images} from './website-fixtures.mjs';
import {catalogFixture} from './catalog-fixtures.mjs';
const root=resolve('outputs'),out=await mkdtemp(join(root,'qwen-readiness-cpu-')),driver=memoryDriver(),store=await new WorkspaceStore(driver).initialize(),f=catalogFixture();let calls=0;
const answer=['tone | source-1 | Suggest a calm and welcoming voice for the supplied fragrance catalog.','visualStyle | source-1 | Propose restrained surroundings and clear material edges around the unchanged reference product.','audience | source-1 | Hypothesis: fragrance shoppers may appreciate readable descriptions of the listed products.','guidelines | source-1 | Keep product names accurate and avoid unsupported claims in the advertisement.'].join('\n');
const svc=createBrandService({}, {status:async()=>({available:true,model:'MOCK Qwen3',reason:'CPU contract test'}),generate:async()=>{calls++;return answer;}},f.read);
const upload=async data=>{const bytes=Buffer.from(data.split(',')[1],'base64'),name=heroSha(bytes).slice(0,16)+'.png';await writeFile(join(out,name),bytes);return {url:'/outputs/'+name};};
const engine=createCreativeEngine(out,{status:async()=>({available:false,model:'Qwen3',reason:'Text planner intentionally unavailable in CPU test'}),generate:async()=>assert.fail('No planning inference')}),creative=new CreativeStudioService(store.projects,{upload,creativePlan:b=>engine.plan(b),creativePlanRecord:(id,pid)=>engine.get(id,pid),creativeSelect:b=>engine.select(b),creativePrepare:b=>engine.prepare(b)},encode);
const app=new AdApplication(store,creative,{upload,research:website=>svc.discover({website,deferAnalysis:true}),analyze:key=>svc.analyze({key}),image:b=>collectBrandImage(b,f.read),capabilities:async()=>({finish:true,qwen:{available:false,reason:'No authorized image service'}}),staticAd:async()=>assert.fail('No image export')},encode);
try{
 let brand=await app.discoverWebsite(f.base+'/collections/perfumes');await app.waitForAnalysis(brand.id);brand=store.getSnapshot().brands.find(b=>b.id===brand.id);assert.equal(calls,1);assert.equal(brand.research.aiCompleted,true);assert.equal(brandFieldStatus(brand,'tone'),'inferred');assert.equal(brand.approvedFields?.includes('tone')||false,false);
 const product=brand.products[0],asset=await app.importWebsiteProduct(product.id,product.discovery.imageUrls[0],async file=>({id:crypto.randomUUID(),name:file.name,original:file,normalized:new Blob([images[2]],{type:'image/png'}),width:320,height:360,created:1}));
 assert.equal(asset.provenance.accuracyConfirmed,false);assert.equal(asset.provenance.permissionConfirmed,false);await assert.rejects(()=>app.develop('basic'),/photograph/);
 await app.confirmWebsiteSource(true,false);await assert.rejects(()=>app.develop('basic'),/permission/);await app.confirmWebsiteSource(true,true);
 brand=store.getSnapshot().brands.find(b=>b.id===brand.id);brand.palette={approved:['#17364a','#f8ead5'],preferred:['#f8ead5','#17364a']};editBrandField(brand,'creativePreferences','Quiet, clear and practical product presentation.');approveBrandField(brand,'tone');await app.saveBrand(brand);
 const plan=await app.develop('basic'),context=creativeContext(plan.input),planning=creativePlanningRequest(plan.input,context);assert.equal(plan.provider.mode,'deterministic');assert.match(plan.provider.reason,/Explicit basic draft/);assert.deepEqual(context.grounding.palette,brand.palette.preferred);assert.match(planning.content,/Quiet, clear and practical/);assert.match(context.facts.find(f=>f.id==='brand-tone').text,/calm and welcoming/);assert.match(planning.content,/fragrance shoppers/);assert.equal(context.facts.find(f=>f.id==='brand-tone').kind,'inferred');assert.equal(context.facts.find(f=>f.id==='product').kind,'source');
 await assert.rejects(()=>app.request());await assert.rejects(()=>app.approve(plan.id,false),/confirm/);const prepared=await app.approve(plan.id,true);const request=await app.request(),raw=heroSha(Buffer.from(await asset.original.arrayBuffer())),normalized=heroSha(Buffer.from(await asset.normalized.arrayBuffer()));assert.notEqual(raw,normalized);
 assert.equal(request.draft.input.source.originalSha256,raw);assert.equal(request.draft.input.source.sha256,normalized);assert.equal(request.payload.settings.seed,42);assert.equal(request.payload.settings.imageModel,'qwen-fp8');assert.equal(request.payload.settings.productId,product.id);assert.equal(request.payload.settings.brandId,brand.id);assert.equal(request.payload.settings.sourceId,asset.id);assert.equal(request.draft.input.source.provenance.discoveryKey,product.discovery.key);assert.equal(request.draft.input.source.provenance.accuracyConfirmed,true);assert.equal(request.draft.input.source.provenance.permissionConfirmed,true);assert.equal(prepared.paidApproved,false);assert.equal(prepared.privateUploadApproved,false);assert.equal(request.generationRun,false);assert.equal(request.ownerApproved,false);
 assert.equal(request.draft.input.brand.signals.find(s=>s.field==='tone').status,'inferred','Accepting a style preference is not source verification');assert.ok(context.grounding.preferences.some(p=>/tone \(inferred\).*calm and welcoming/.test(p)));assert.equal(request.draft.input.facts.confirmed,true);
 await store.flush();const reopened=await new WorkspaceStore(driver).initialize();assert.equal(reopened.active().hero.settings.sourceId,asset.id);assert.deepEqual(reopened.active().hero.settings.briefDraft.reviewedSnapshot,store.active().hero.settings.briefDraft.reviewedSnapshot);assert.equal(heroSha(Buffer.from(await(await reopened.asset(asset.id)).original.arrayBuffer())),raw);assert.equal(reopened.getSnapshot().brands.find(b=>b.id===brand.id).dna.tone,brand.dna.tone);reopened.dispose();
 // Edit each relevant dimension against the same saved review, without new AI.
 const intended=structuredClone(draftFor(store.active()));for(const patch of [{seed:43},{request:'A changed direction'},{productId:brand.products[1].id},{sourceId:'missing-original'}]){await app.editDraft(patch);await assert.rejects(()=>app.request());await app.editDraft(intended);await assert.rejects(()=>app.request(),'Restoring values alone cannot invent a fresh review');await app.approve((await app.develop('basic')).id,true);}
 const current=store.getSnapshot().brands.find(b=>b.id===brand.id);editBrandField(current,'tone','A revised owner voice.');await app.saveBrand(current);await assert.rejects(()=>app.request());
 await mkdir('outputs/qwen-reliability',{recursive:true});await writeFile('outputs/qwen-reliability/synthetic-generation-brief.json',JSON.stringify(request,null,2));
 console.log('PASS source -> validated MOCK suggestions -> saved brand -> truthful deterministic plan -> explicit accuracy/rights/direction review -> exact original/normalized hashes and product/source provenance -> unpaid Qwen request; palette/preferences, RAM persistence and stale source/product/prompt/seed/brand rejection. No browser or image inference.');
}finally{store.dispose();if(!out.startsWith(root+sep))throw Error('Unsafe fixture cleanup');await rm(out,{recursive:true,force:true});}
