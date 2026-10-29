// CPU contracts only. No inference, cloud, downloaded assets or owner browser data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filmReadiness,filmGraph,filmModel,filmSigmas} from '../../shared/runtime/film.ts';
import {directedFilmPlan,filmKind} from '../src/film.ts';
import {shotPlanIssues,motionPromptForShot} from '../../shared/lib/reference-video.ts';
import {assembleCreativePlan,creativeContext,fallbackConcepts} from '../../shared/lib/creative-engine.ts';
import {inputFixture} from './creative-fixtures.mjs';
import {heroDefaults} from '../../shared/lib/hero-ad.ts';
import {WorkspaceStore} from '../src/workspace-store.ts';
import {memoryDriver} from '../src/projects.ts';
import {AdApplication} from '../src/ad-application.ts';
const template=JSON.parse(readFileSync(new URL('../../shared/workflows/ad_film_ltxv.json',import.meta.url)));
const nodes=Object.fromEntries(Object.values(template).map(n=>[n.class_type,{}]));
nodes.CheckpointLoaderSimple={input:{required:{ckpt_name:[[filmModel]]}}};nodes.CLIPLoader={input:{required:{clip_name:[['t5xxl_fp8_e4m3fn_scaled.safetensors']]}}};
const stats={system:{ram_free:8*1024**3},devices:[{vram_free:8*1024**3}]},queue={queue_running:[],queue_pending:[]};
const input=inputFixture(),plan=assembleCreativePlan(input,fallbackConcepts(input,creativeContext(input)),{mode:'deterministic',reason:'CPU fixture'},'d'.repeat(16));
test('video admission fails closed for missing runtime, active queues and unmeasured or insufficient memory',()=>{
 assert.equal(filmReadiness(nodes,stats,queue,false,8192).available,true);
 for(const args of [[{},stats,queue,false,8192],[nodes,stats,null,false,8192],[nodes,stats,queue,true,8192],[nodes,stats,{...queue,queue_pending:[[1,'another-job']]},false,8192],[nodes,stats,queue,false,undefined],[nodes,stats,queue,false,2048],[nodes,{...stats,system:{ram_free:1}},queue,false,8192]])assert.equal(filmReadiness(...args).available,false);
 assert.equal(filmReadiness(nodes,stats,queue,false,8192).inferenceVerified,false,'Availability cannot certify a real render');
});
test('film workflow uses checkpoint-specific eight-step sigmas, first-frame conditioning and tiled decode',()=>{
 const options={width:288,height:512,frames:97,fps:24,seed:123,prompt:'One intact product. A shallow lateral glide.'},g=filmGraph(template,options);
 assert.equal(g['13'].inputs.sigmas,filmSigmas);assert.equal(g['8'].class_type,'LTXVImgToVideo');assert.equal(g['8'].inputs.strength,1);assert.equal(g['8'].inputs.length,97);assert.equal(g['16'].class_type,'VAEDecodeTiled');assert.equal(g['14'].inputs.cfg,1);assert.equal(g['3'].inputs.text,options.prompt);
 for(const patch of [{frames:96},{frames:121},{fps:30},{width:720},{height:511}])assert.throws(()=>filmGraph(template,{...options,...patch}));
 assert.notEqual(template['14'].inputs.noise_seed,123,'Builder must not mutate its shared template');
});
test('explicit film modes preserve the campaign concept, distinguish execution and keep product in payoff',()=>{
 const generated=directedFilmPlan(plan,'generative'),photo=directedFilmPlan(plan,'photograph-motion');
 assert.deepEqual(shotPlanIssues(generated),[]);assert.deepEqual(shotPlanIssues(photo),[]);
 assert.equal(generated.shots[0].execution,'ltx');assert.equal(generated.shots[0].duration,4);assert.equal(generated.shots[1].execution,'approved-still');assert.ok(photo.shots.every(s=>s.execution==='approved-still'));
 assert.ok(generated.shots[0].sceneBrief.includes(plan.concepts.find(c=>c.id===plan.selectedId).lighting));
 assert.match(motionPromptForShot(generated.shots[0],plan.input.facts.description),/lateral|parallax/);assert.match(generated.shots[1].endingComposition,/remains visible/);
 assert.match(filmKind('editorial-source-motion'),/no AI video/);assert.match(filmKind(filmModel,'ltx'),/Generated video/);assert.match(filmKind(filmModel),/Saved prior video/);
});
test('an unavailable generated-film request saves failure and never uploads, composes or substitutes an old video',async()=>{
 const driver=memoryDriver(),store=await new WorkspaceStore(driver,undefined,async()=>driver).initialize(),p=store.active(),oldFetch=globalThis.fetch;let uploads=0,jobs=0;
 plan.projectId=p.id;p.hero=heroDefaults();p.hero.takes=[{id:'fixture-take',assetId:'fixture',sha256:'a'.repeat(64),sourceSha256:'a'.repeat(64),url:'/outputs/'+ 'a'.repeat(16)+'.png',settings:structuredClone(p.hero.settings),model:'product-safe',method:'source-photograph',seconds:0}];p.creative={version:1,plans:[],activeId:plan.id};const before=p.takes.length;await store.projects.save(p);
 globalThis.fetch=async url=>{assert.equal(url,'/api/film/capabilities');return new Response(JSON.stringify({available:false,reason:'GPU occupied by another operation.'}),{headers:{'Content-Type':'application/json'}});};
 try{const app=new AdApplication(store,{open:async()=>structuredClone(plan)},{upload:async()=>{uploads++;throw Error('No upload permitted');},shot:async()=>{jobs++;throw Error('No job permitted');}});await assert.rejects(()=>app.animateCampaign('fixture-take','generative'),/No film was generated/);assert.equal(store.active().takes.length,before);assert.equal(store.active().attempt.status,'failed');assert.equal(store.active().attempt.engine,'ltx-video');assert.equal(uploads,0);assert.equal(jobs,0);
 const restored=await new WorkspaceStore(driver,undefined,async()=>driver).initialize();assert.equal(restored.active().attempt.status,'failed');assert.equal(restored.active().takes.length,before);restored.dispose();}finally{globalThis.fetch=oldFetch;store.dispose();}
});
