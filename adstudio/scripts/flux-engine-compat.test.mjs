// Nonbillable FLUX / Comfy Cloud admission for the Abel-shaped plan that was rejected after Generate.
// Real plan/select/prepare files and real server scene validation on CPU; no network, no inference.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {campaignExecutionStrategy,fluxRestageBlock,isFluxEngine} from '../../shared/lib/campaign-presentation.ts';
import {flux3ScenePrompt} from '../../shared/lib/ad-scene.ts';
import {createCreativeEngine} from '../../shared/runtime/creative-engine.ts';
import {validateSceneRequest} from '../../shared/runtime/klein-scene.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
import {editionsGate} from '../src/journey/gates.ts';
import {inputFixture,png,dataURL} from './creative-fixtures.mjs';

/** Website perfume as saved by Discover: category left at "other", automatic photo summary, default campaign controls. */
function abelInput(){
 const input=inputFixture('bottle');
 input.productType='other';
 input.brand.products[0].name='Green Cedar';
 input.facts={description:'Photograph of Green Cedar.',arrangement:'',texture:'',container:'',confirmed:true};
 return input;
}
async function withPlan(input,run){
 const out=await mkdtemp(join(resolve('outputs'),'flux-compat-'));
 try{
  await writeFile(join(out,'aaaaaaaaaaaaaaaa.png'),png);
  const e=createCreativeEngine(out,{status:async()=>({available:false,reason:'CPU test',model:'MOCK'}),generate:async()=>assert.fail('No inference')});
  const base=await e.plan({planningMode:'basic',image:'/outputs/aaaaaaaaaaaaaaaa.png',input});
  await run(e,base,out);
 }finally{await rm(out,{recursive:true,force:true});}
}
async function admission(e,out,input,planId,engine){
 const prepared=await e.prepare({planId,current:input,image:'/outputs/aaaaaaaaaaaaaaaa.png',original:dataURL(png),confirmation:{facts:true,direction:true}});
 const plan=JSON.parse(readFileSync(join(out,'creative-plans',planId,'plan.json'),'utf8'));
 const body={projectId:input.projectId,planId,preparedId:prepared.preparedId,image:'/outputs/aaaaaaaaaaaaaaaa.png',current:input,engine,promptSha256:heroSha(flux3ScenePrompt(plan))};
 return {plan,body,checked:await validateSceneRequest(out,body)};
}

test('the exact Abel plan shape was routed away from FLUX before; it is now Cloud-compatible',async()=>{
 const input=abelInput();
 await withPlan(input,async(_e,base)=>{
  assert.equal(campaignExecutionStrategy(base),'product-safe','Reproduces the routing that raised "Creative Restage only" after Generate');
  assert.equal(base.context.controls.fidelity,'high');
  assert.equal(fluxRestageBlock(base),'');
 });
});

test('every concept of the Abel plan reaches Comfy Cloud admission with identity-bound prompts',async()=>{
 const input=abelInput();
 await withPlan(input,async(e,base,out)=>{
  assert.equal(base.concepts.length,3);
  const prompts=new Set();
  for(const concept of base.concepts){
   const child=await e.select({planId:base.id,projectId:input.projectId,conceptId:concept.id});
   const {plan,checked}=await admission(e,out,input,child.id,'flux3-cloud');
   assert.equal(plan.selectedId,concept.id);
   assert.equal(checked.engine,'flux3-cloud');
   assert.match(checked.prompt,/Reference geometry must not be reshaped/);
   assert.equal(checked.plan.input.source.sha256,input.source.sha256,'Source binding retained');
   assert.ok(checked.receipt,'Receipt path remains bound for duplicate protection');
   prompts.add(checked.prompt);
  }
  assert.equal(prompts.size,3,'Each concept keeps its own photographic direction');
 });
});

test('a changed prompt is still refused, and digital or strict plans are refused before submission',async()=>{
 const input=abelInput();
 await withPlan(input,async(e,base,out)=>{
  const {body}=await admission(e,out,input,base.id,'flux3-cloud');
  await assert.rejects(()=>validateSceneRequest(out,{...body,promptSha256:'f'.repeat(64)}),/prompt changed/);
 });
 const digital=abelInput();digital.productType='digital';
 await withPlan(digital,async(e,base,out)=>{
  assert.match(fluxRestageBlock(base),/digital or service/);
  await assert.rejects(()=>admission(e,out,digital,base.id,'flux3-cloud'),/digital or service offer.*No inference was submitted/);
 });
 const strict=abelInput();strict.intent='enhancement';Object.assign(strict.facts,{count:1,arrangement:'One bottle standing upright.'});
 await withPlan(strict,async(e,base,out)=>{
  assert.equal(base.context.controls.fidelity,'strict');
  await assert.rejects(()=>admission(e,out,strict,base.id,'flux3'),/strict photo fidelity.*No inference was submitted/);
 });
});

test('Editions blocks Create with the reason and the client checks before any attempt is recorded',()=>{
 const resolved={label:'Comfy Cloud / FLUX',reason:'ready'};
 assert.equal(editionsGate({caps:true,resolved,queue:1}),'');
 assert.match(editionsGate({caps:true,resolved,queue:1,engineConflict:fluxRestageBlock({input:{productType:'service'},context:{controls:{fidelity:'high'}}})}),/Product-safe/);
 assert.equal(isFluxEngine('flux3-cloud'),true);assert.equal(isFluxEngine('klein'),false);
 const app=readFileSync(new URL('../src/ad-application.ts',import.meta.url),'utf8'),journey=readFileSync(new URL('../src/journey-service.ts',import.meta.url),'utf8');
 assert.ok(app.indexOf('fluxRestageBlock(plan)')<app.indexOf("p.attempt={id:crypto.randomUUID(),status:'running'"),'FLUX compatibility is checked before an attempt exists');
 assert.doesNotMatch(app,/Creative Restage only\. Loosen packaging/);
 assert.ok(journey.indexOf('plans.map(fluxRestageBlock)')<journey.indexOf('j.batchId=crypto.randomUUID()'),'Campaign checks every plan before cards are created');
 assert.match(journey,/Only an edition that stopped before submission can be retried here/);
});
