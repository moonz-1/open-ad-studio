// Deterministic Phase 1: argument-first planning compiles visuals in-app.
// Uses recorded failure shapes + authored arguments. No GPU / no live Qwen.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {directorInput,directorResponse} from './creative-director-fixtures.mjs';
import {png,dataURL} from './creative-fixtures.mjs';
import {creativeContext,conceptsFromArguments,assembleCreativePlan,creativeComposition} from '../../shared/lib/creative-engine.ts';
import {parseCreativeResponse} from '../../shared/runtime/creative-json.ts';
import {createCreativeEngine,creativePlanningRequest} from '../../shared/runtime/creative-engine.ts';
import {planOriginalCampaign} from '../../shared/lib/reference-video.ts';

function argumentPayload(input){
 const full=directorResponse(input);
 return {arguments:full.concepts.map(c=>{
  const s=c.strategy,p=s.proof[0];
  return {title:c.title,idea:c.idea,objective:s.objective,audienceHypothesis:s.audienceHypothesis,tension:s.tension,businessFit:s.businessFit,feeling:s.feeling,memory:s.memory,focus:s.focus,opening:s.opening,payoff:s.payoff,proofId:p.id,proofQuote:p.quote};
 })};
}

test('argument-first schema parses and compiles three distinct strategies with app-owned visuals',()=>{
 const input=directorInput('bakery'),ctx=creativeContext(input),payload=argumentPayload(input);
 const decoded=parseCreativeResponse(JSON.stringify(payload));
 assert.ok(decoded.value.arguments);assert.equal(decoded.value.arguments.length,3);
 const concepts=conceptsFromArguments(decoded.value,input,ctx);
 assert.equal(concepts.length,3);
 assert.equal(new Set(concepts.map(c=>c.strategy.memory)).size,3);
 assert.equal(new Set(concepts.map(c=>c.environment)).size,3,'App templates supply distinct environments');
 const plan=assembleCreativePlan(input,concepts,{mode:'local-ai',reason:'argument-first fixture',planningVersion:2},'a'.repeat(16));
 const selected=plan.concepts.find(c=>c.id===plan.selectedId);
 assert.equal(plan.composition.headline,'Made to share.','Bakery copy follows the observed shared format, not skin/cream language');
 assert.ok(!plan.composition.body.includes(selected.strategy.memory.slice(0,20)),'Internal production direction must not become customer copy');
 assert.equal(planOriginalCampaign(plan).shots.every(s=>s.execution==='approved-still'),true,'Exact count bakery never spends LTX');
});

test('recorded failure shapes: wrong proof IDs and spaced keys still reject or normalize safely',()=>{
 const input=directorInput('bakery'),ctx=creativeContext(input),good=argumentPayload(input);
 // Website source IDs were a live failure mode — reject, never fabricate.
 const badIds=structuredClone(good);badIds.arguments[0].proofId='source-0';
 assert.throws(()=>conceptsFromArguments(badIds,input,ctx),/Unsupported|evidence|business-specific/);
 // Spaced keys normalize; values untouched.
 const spaced=JSON.stringify(good).replaceAll('"title"','" title "').replaceAll('"proofId"','" proofId "');
 const decoded=parseCreativeResponse(spaced);
 assert.ok(decoded.normalizations.length>=1);
 assert.doesNotThrow(()=>conceptsFromArguments(decoded.value,input,ctx));
 // Duplicate memory/tension fails distinctness.
 const clones=structuredClone(good);clones.arguments[1].tension=clones.arguments[0].tension;clones.arguments[1].memory=clones.arguments[0].memory;
 assert.throws(()=>conceptsFromArguments(clones,input,ctx),/repeat|persuasion|memory/i);
 // Nested strategy shape remains accepted for authored fixtures.
 const nested={arguments:directorResponse(input).concepts.map(c=>({title:c.title,idea:c.idea,strategy:c.strategy}))};
 assert.equal(conceptsFromArguments(nested,input,ctx).length,3);
});

test('live planner request asks for arguments only; engine compiles arguments and rejects invalid without substitution',async()=>{
 await mkdir('outputs',{recursive:true});const root=await mkdtemp(resolve('outputs/arg-plan-'));
 try{
  const input=directorInput('bakery'),image='/outputs/aaaaaaaaaaaaaaaa.png';await writeFile(join(root,image.slice(9)),png);
  const req=creativePlanningRequest(input,creativeContext(input));
  assert.match(req.system,/first, second, third/);
  assert.ok(!req.fields.includes('composition'));
  assert.ok(req.appCompiledFields.includes('composition'));
  let calls=0;
  const engine=createCreativeEngine(root,{status:async()=>({available:true,model:'MOCK Qwen3',reason:'fixture'}),generate:async(system,content)=>{calls++;assert.match(system,/first, second, third/);assert.ok(!/"layout"/i.test(system)||system.includes('Do NOT invent composition'));return JSON.stringify(argumentPayload(input));}});
  const plan=await engine.plan({image,input});
  assert.equal(calls,1);assert.equal(plan.provider.mode,'local-ai');assert.equal(plan.provider.contribution.format,'advertising-arguments-v1');
  assert.ok(plan.concepts.every(c=>c.strategy&&c.composition&&c.environment));
  assert.equal(creativeComposition(input,plan.concepts[0],plan.context).headline,'Made to share.');
  const body={planId:plan.id,current:input,image,original:dataURL(png),confirmation:{direction:true,facts:true}};
  assert.equal((await engine.prepare(body)).status,'REVIEWED_REQUEST_NOT_A_RUN');
  const broken=createCreativeEngine(root,{status:async()=>({available:true,model:'MOCK',reason:'fixture'}),generate:async()=>'{"arguments":[{"title":"x"}]}'});
  await assert.rejects(()=>broken.plan({image,input}),/No fallback/);const fallback=await broken.plan({image,input,planningMode:'basic'});assert.equal(fallback.provider.mode,'deterministic');
 }finally{await rm(root,{recursive:true,force:true});}
});


test('v2 model strategy binds visual IDs to literal observations, preserves raw text and rejects invented choices',async()=>{
 const {photoPlanningOptions,bindPhotographicArguments}=await import('../../shared/lib/planning-visual-contract.ts');
 const input=directorInput('bakery'),context=creativeContext(input),legacy=argumentPayload(input),options=photoPlanningOptions(input);
 const model={arguments:legacy.arguments.map((a,i)=>{const {focus,memory,opening,payoff,...marketing}=a;return {...marketing,focusId:options.anchors[0].id,mechanismId:options.mechanisms[i].id};})};
 const bound=bindPhotographicArguments(model,input);assert.equal(bound.bindings.length,3);assert.equal(bound.value.arguments[0].focus,input.facts.description);assert.equal(conceptsFromArguments(bound.value,input,context).length,3);
 for(const mutate of [x=>x.arguments[0].focusId='performance',x=>x.arguments[0].mechanismId='orbit-hidden-back',x=>x.arguments[1].mechanismId=x.arguments[0].mechanismId,x=>x.arguments[0].focus='invented cream cap']){const x=structuredClone(model);mutate(x);assert.throws(()=>bindPhotographicArguments(x,input));}
 const spaced=structuredClone(model);spaced.arguments[0].objective=' consideration ';spaced.arguments[0].focusId+=' ';const decoded=parseCreativeResponse(JSON.stringify(spaced));assert.equal(decoded.normalizations.length,2);assert.equal(bindPhotographicArguments(decoded.value,input).bindings[0].focus,input.facts.description);
 const root=await mkdtemp(resolve('outputs/bound-plan-'));try{const image='/outputs/aaaaaaaaaaaaaaaa.png';await writeFile(join(root,image.slice(9)),png);const raw=JSON.stringify(spaced),engine=createCreativeEngine(root,{status:async()=>({available:true,model:'CPU RESPONSE',reason:'not inference'}),generate:async()=>raw});const p=await engine.plan({image,input});assert.equal(p.provider.contribution.format,'advertising-arguments-v2');assert.deepEqual(p.provider.contribution.bindings,bound.bindings);assert.equal(p.brief.schema,'creative-brief-v2');assert.equal(p.brief.execution.liveInferenceVerified,false);assert.equal(await (await import('node:fs/promises')).readFile(join(root,'creative-plans',p.id,'model-response.txt'),'utf8'),raw);const req=creativePlanningRequest(input,context);assert.equal(req.fields.includes('focus'),false);assert.ok(req.appCompiledFields.includes('focus'));assert.equal(JSON.parse(req.content).assignments.length,3);}finally{await rm(root,{recursive:true,force:true});}
});

test('live request exposes forbidden claims and exact business excerpts without accepting the recorded unsupported claim',async()=>{const {bindPhotographicArguments,photoPlanningOptions}=await import('../../shared/lib/planning-visual-contract.ts');const i=directorInput('bakery'),ctx=creativeContext(i),r=JSON.parse(creativePlanningRequest(i,ctx).content);assert.ok(r.forbiddenClaims.includes('sustainable'));assert.ok(r.assignments.every(p=>ctx.facts.find(f=>f.id===p.proofId).text.includes(p.proofQuote)));const o=photoPlanningOptions(i),v={arguments:argumentPayload(i).arguments.map((a,n)=>{const {focus,memory,opening,payoff,...rest}=a;return {...rest,focusId:o.anchors[0].id,mechanismId:o.mechanisms[n].id};})};v.arguments[0].businessFit+=' sustainable';assert.throws(()=>conceptsFromArguments(bindPhotographicArguments(v,i).value,i,ctx),/Unsupported claim: sustainable/);});

test('a cited percentage stays in marketing strategy and cannot contaminate physical rationale',async()=>{const {photoPlanningOptions,bindPhotographicArguments}=await import('../../shared/lib/planning-visual-contract.ts');const i=directorInput('bakery');i.brand.dna.description+=' 100% Natural Perfume';const ctx=creativeContext(i),o=photoPlanningOptions(i),args=argumentPayload(i).arguments.map((a,n)=>{const {focus,memory,opening,payoff,...marketing}=a;return {...marketing,focusId:o.anchors[0].id,mechanismId:o.mechanisms[n].id};});args[2].businessFit='100% Natural Perfume addresses the stated customer consideration';args[2].proofId='brand-description';args[2].proofQuote='100% Natural Perfume';const concepts=conceptsFromArguments(bindPhotographicArguments({arguments:args},i).value,i,ctx);assert.match(concepts[2].strategy.businessFit,/100%/);assert.doesNotMatch(concepts[2].rationale,/%/);const invalid=structuredClone(concepts);invalid[2].composition+=' 100% Natural Perfume';assert.ok((await import('../../shared/lib/creative-engine.ts')).creativeConceptIssues({concepts:invalid},ctx).some(x=>x.includes('Unsupported assertion: composition')));});

test('an unmapped source never borrows another catalog product description or selling points',async()=>{const {consumerCampaignCopy}=await import('../../shared/lib/creative-engine.ts');const i=directorInput('bakery');delete i.productId;i.brand.products.push({id:'unselected-sku',name:'Another product',description:'A dark smoky amber from an unrelated SKU',sellingPoints:'UNRELATED CATALOG DESCRIPTION',imageIds:[]});const ctx=creativeContext(i),concept=directorResponse(i).concepts[0],copy=consumerCampaignCopy(i,concept,ctx);assert.ok(!copy.body.includes('UNRELATED'));assert.ok(!copy.body.includes('smoky amber'));assert.ok(!copy.headline.includes('UNRELATED'));});
