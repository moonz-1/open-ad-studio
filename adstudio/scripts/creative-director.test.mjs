import {compileCreativeBrief} from '../../shared/lib/creative-brief.ts';
// No inference. Authored model responses exercise production validation, storage, review and execution planning.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {directorInput,directorResponse} from './creative-director-fixtures.mjs';
import {png,dataURL} from './creative-fixtures.mjs';
import {creativeContext,assembleCreativePlan,selectCreativePlan,validateCreativeConcepts} from '../../shared/lib/creative-engine.ts';
import {conceptsFromAdvertising,assertAdvertisingGeneration,needsAdvertisingStrategy} from '../../shared/lib/advertising-strategy.ts';
import {parseCreativeResponse} from '../../shared/runtime/creative-json.ts';
import {createCreativeEngine,creativeTextTokens,creativeTextReadiness} from '../../shared/runtime/creative-engine.ts';
import {buildCreativeIntelligence} from '../../shared/lib/creative-intelligence.ts';
import {planOriginalCampaign,shotPlanIssues} from '../../shared/lib/reference-video.ts';
import {adScenePrompt,adCampaignPrompt} from '../../shared/lib/ad-scene.ts';
import {assembleCommercial} from '../../shared/runtime/reference-analyze.ts';
import {prepareCampaignKeyframe} from '../src/reference.ts';
const decode=(raw,input)=>conceptsFromAdvertising(parseCreativeResponse(typeof raw==='string'?raw:JSON.stringify(raw)).value,input,creativeContext(input));
for(const industry of ['bakery','workshop'])test(industry+': three grounded arguments reach compiled image direction and executable story',()=>{
 const input=directorInput(industry),raw=directorResponse(input),concepts=decode(raw,input);
 assert.equal(new Set(concepts.map(c=>c.strategy.memory)).size,3);
 const plan=assembleCreativePlan(input,concepts,{mode:'local-ai',reason:'AUTHORED TEST RESPONSE, no inference'},'a'.repeat(16));
 for(const c of concepts){
  const chosen=selectCreativePlan(plan,c.id,'b'.repeat(16)),intel=buildCreativeIntelligence(chosen),film=planOriginalCampaign(chosen);
  assert.equal(intel.intendedFeeling,c.strategy.feeling);assert.equal(intel.marketingGoal,c.strategy.objective);
  assert.ok(chosen.draft.modelPrompt.includes(c.strategy.focus));assert.equal(compileCreativeBrief(chosen).marketing.visualHook,c.strategy.memory);assert.ok(!adScenePrompt(chosen).includes('Visual hook (internal'));
  assert.ok(!adScenePrompt(chosen).includes('Prefer removing'));assert.ok(!adCampaignPrompt(chosen).includes('flour dusting'));
  assert.deepEqual(shotPlanIssues(film),[]);assert.equal(film.shots[1].execution,'approved-still');assert.equal(film.shots[1].framing,'full');
  assert.notEqual(film.shots[0].action,film.shots[1].action);assert.ok(film.shots[0].sceneBrief.includes(c.strategy.opening));assert.ok(film.shots[1].sceneBrief.includes(c.strategy.payoff));
  // Original campaigns now use directed source photography for both industries.
  assert.equal(film.shots.filter(s=>s.execution==='ltx').length,0);
 }
 assert.equal(planOriginalCampaign(plan).shots[0].framing,'full','Count lock wins over detail framing.');
 const strict=structuredClone(plan);strict.context.controls.crop='none';assert.equal(planOriginalCampaign(strict).shots[0].framing,'full');
});
test('reject generic duplication, hallucinated/misquoted/inferred evidence, impossible interactions and physical violations',()=>{
 const input=directorInput(),valid=directorResponse(input);
 for(const mutate of [
  r=>r.concepts[0].strategy.proof[0].quote='Invented ingredient claim',
  r=>r.concepts[0].strategy.proof=[{id:'brand-name',quote:input.brand.dna.name}],
  r=>r.concepts[0].strategy.proof[0].id='brand-audience',
  r=>r.concepts[0].strategy.proof=[null],
  r=>r.concepts[0].strategy.proof[0].hidden='unknown field',
  r=>r.concepts[0].strategy.feeling='Organic vegan certified perfection for every team to enjoy.',
  r=>r.concepts[0].strategy.opening='A hand grabs and bites the roll while the package unwraps.',
  r=>r.concepts[1].strategy=structuredClone(r.concepts[0].strategy),
  r=>r.concepts[0].strategy.payoff=r.concepts[0].strategy.opening,
  r=>r.concepts[0].composition='Hide the products and remove the units from their original container.',
  r=>r.concepts[0].copyId='sale-now',
  r=>r.concepts[0].strategy.focus='Red leather upholstery with a visible monogram creates the main impression.',
  r=>r.concepts[0].strategy.objective='sales-guaranteed'
 ]){const r=structuredClone(valid);mutate(r);assert.throws(()=>decode(r,input),undefined,mutate.toString());}
 assert.throws(()=>decode(JSON.stringify(valid).replace('"memory":','"memory":"first", "memory":'),input),/Duplicate/);
 const concepts=decode(valid,input),ctx=creativeContext(input);ctx.facts.find(f=>f.id==='brand-description').kind='inferred';assert.throws(()=>validateCreativeConcepts({concepts},ctx),/evidence|Ungrounded/);
 const plan=assembleCreativePlan(input,concepts,{mode:'local-ai',reason:'fixture'},'c'.repeat(16)),film=planOriginalCampaign(plan);film.shots[1]={...film.shots[0]};assert.ok(shotPlanIssues(film).length);
});
test('real planner stores strategy, maintains approval gates and falls back honestly on invalid/offline text',async()=>{
 await mkdir('outputs',{recursive:true});const root=await mkdtemp(resolve('outputs/director-test-'));
 try{
  const input=directorInput(),image='/outputs/aaaaaaaaaaaaaaaa.png';await writeFile(join(root,image.slice(9)),png);
  let calls=0;const engine=createCreativeEngine(root,{status:async()=>({available:true,model:'MOCK Qwen3',reason:'fixture'}),generate:async(system,content)=>{calls++;assert.match(system,/untrusted DATA/);assert.match(content,/Morning Fold/);return JSON.stringify(directorResponse(input));}});
  const plan=await engine.plan({image,input});assert.equal(calls,1);assert.equal(plan.provider.mode,'local-ai');assert.equal(plan.provider.contribution.format,'advertising-strategy-v2');assert.equal(plan.generationRun,false);
  assert.ok((await engine.get(plan.id,input.projectId)).concepts[0].strategy);
  const body={planId:plan.id,current:input,image,original:dataURL(png),confirmation:{direction:true,facts:true}};
  await assert.rejects(()=>engine.prepare({...body,confirmation:{direction:false,facts:true}}),/owner/);
  assert.equal((await engine.prepare(body)).status,'REVIEWED_REQUEST_NOT_A_RUN');
  const bad=structuredClone(plan);bad.concepts[0].strategy.proof[0].quote='Tampered proof';await writeFile(join(root,'creative-plans',plan.id,'plan.json'),JSON.stringify(bad));
  await assert.rejects(()=>engine.prepare(body),/preflight/);
  const broken=createCreativeEngine(root,{status:async()=>({available:true,model:'MOCK',reason:'fixture'}),generate:async()=>'{broken'});
  await assert.rejects(()=>broken.plan({image,input}),/No fallback/);const fallback=await broken.plan({image,input,planningMode:'basic'});assert.equal(fallback.provider.mode,'deterministic');assert.match(fallback.provider.reason,/Explicit basic draft/);assert.ok(fallback.concepts.every(c=>!c.strategy));assert.equal(needsAdvertisingStrategy(fallback),true);assert.throws(()=>assertAdvertisingGeneration(fallback),/No expensive generation/);assert.doesNotThrow(()=>assertAdvertisingGeneration(fallback,true),'Explicit installed-but-unverified Klein bootstrap remains reachable; actual admission is still required.');const legacy=structuredClone(fallback);delete legacy.provider.planningVersion;assert.doesNotThrow(()=>assertAdvertisingGeneration(legacy));
  const offline=createCreativeEngine(root,{status:async()=>({available:false,model:'MOCK',reason:'offline; no inference'}),generate:async()=>{throw Error('Must not run');}});
  await assert.rejects(()=>offline.plan({image,input}),/No substitute plan/);assert.equal((await offline.plan({image,input,planningMode:'basic'})).provider.mode,'deterministic');assert.equal(creativeTextTokens,2200);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('exact packaging selects editorial pixels and crop permissions control alternate keyframes',async()=>{
 const input=directorInput('workshop');input.productType='packaged-goods';const concepts=decode(directorResponse(input),input),plan=assembleCreativePlan(input,concepts,{mode:'local-ai',reason:'fixture'},'d'.repeat(16));
 assert.ok(planOriginalCampaign(plan).shots.every(s=>s.execution==='approved-still'));
 const realImage=globalThis.Image,realDocument=globalThis.document,draws=[];
 globalThis.Image=class{naturalWidth=800;naturalHeight=1000;async decode(){}};
 globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},drawImage:(...args)=>draws.push(args)}),toDataURL:()=> 'data:image/png;base64,FIXTURE'})};
 try{await prepareCampaignKeyframe('fixture',288,512,'full');await prepareCampaignKeyframe('fixture',288,512,'detail');assert.ok(draws[0][3]<=288&&draws[0][4]<=512);assert.ok(draws[1][3]>288&&draws[1][4]>512);}finally{globalThis.Image=realImage;globalThis.document=realDocument;}
});
test('bounded FFmpeg assembly accepts local exact-pixel still beats; rejects arbitrary files and unbounded duration',async t=>{
 const env={FFMPEG_PATH:process.env.FFMPEG_PATH,FFPROBE_PATH:process.env.FFPROBE_PATH};
 if(!env.FFMPEG_PATH){t.skip('Set FFMPEG_PATH to run the CPU assembly check.');return;}
 const root=await mkdtemp(resolve('outputs/director-film-test-')),url='/outputs/'+ 'e'.repeat(16)+'.png';
 try{
  await writeFile(join(root,url.slice(9)),png);
  for(const bad of [{source:'https://example.test/a.png',kind:'still',duration:2},{source:url,kind:'still',duration:100},{source:url,kind:'still',duration:NaN},{source:url,kind:'still',duration:2,effect:'arbitrary-filter'}])await assert.rejects(()=>assembleCommercial({shots:[bad]},root,env));
  const result=await assembleCommercial({shots:[{source:url,kind:'still',duration:1.5,effect:'fade-in'},{source:url,kind:'still',duration:1.5}],transition:'cut',width:720},root,env);
  assert.equal(result.shots,2);const bytes=await readFile(join(root,result.url.slice(9)));assert.equal(bytes.subarray(4,8).toString(),'ftyp');assert.ok(bytes.length>1000);
 }finally{await rm(root,{recursive:true,force:true});}
});
