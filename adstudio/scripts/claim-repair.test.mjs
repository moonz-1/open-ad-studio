// Regression: real Qwen response from attempt 695a78fa15fd2320 ("Concept 3: Unsupported
// assertion: title"). Brand context is anonymized; evidence wording matches the failure. CPU only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inputFixture} from './creative-fixtures.mjs';
import {creativeContext,assembleCreativePlan,creativeConceptIssues} from '../../shared/lib/creative-engine.ts';
import {parseCreativeResponse} from '../../shared/runtime/creative-json.ts';
import {compileModelProposals,creativePlanningRequest} from '../../shared/runtime/creative-engine.ts';
import {repairArgumentClaims,unsupportedClaims,claimEvidence,removeClaims} from '../../shared/lib/claim-repair.ts';

const raw=readFileSync(new URL('./fixtures-qwen-695a78fa-response.txt',import.meta.url),'utf8');
function fragranceInput(){
 const input=inputFixture('bottle');
 input.brand.dna.name='Example Fragrance';
 input.brand.dna.description='The Official Site of Example Fragrance. High Performance Scents, Low Impact Packaging. 100% Natural Perfume. Shop the Range.';
 input.brand.products[0]={...input.brand.products[0],name:'Green Cedar',description:'A vibrant aromatic wood'};
 input.facts={...input.facts,description:'Photograph of Green Cedar.',count:undefined,confirmed:false};
 return input;
}

test('the exact failed response now compiles to three usable directions',()=>{
 const input=fragranceInput(),context=creativeContext(input);
 const {value}=parseCreativeResponse(raw);
 const compiled=compileModelProposals(value,input,context);
 assert.equal(compiled.concepts.length,3);
 assert.deepEqual(compiled.concepts.map(c=>c.title),['High Performance Scents','Low Impact Packaging','100% Natural Perfume'],'Verbatim source headlines survive, including the % token');
 assert.deepEqual(creativeConceptIssues({concepts:compiled.concepts},context),[]);
 const repaired=new Set(compiled.claimRepairs.map(r=>r.argument+':'+r.field));
 for(const key of ['0:idea','1:idea','2:idea','2:feeling'])assert.ok(repaired.has(key),'Unsupported claim repaired at '+key);
 const prose=compiled.concepts.map(c=>[c.title,c.idea,c.strategy.audienceHypothesis,c.strategy.tension,c.strategy.businessFit,c.strategy.feeling].join(' ')).join(' ');
 assert.doesNotMatch(prose,/\b(safety|purity|safe|eco-friendly|last all day|lasting)\b/i,'Unsupported factual claims removed');
 assert.deepEqual(compiled.modelProposals,JSON.parse(raw).arguments,'Original model proposals kept unmodified');
 assert.equal(compiled.concepts[1].idea,'Packaging reduces environmental impact','Model wording kept once the unsupported phrase is removed');
 assert.ok(compiled.claimRepairs.some(r=>r.method==='removed')&&compiled.claimRepairs.some(r=>r.method==='replaced'),'Minimal edits first; grounded replacement only for fragments');
 assert.ok(compiled.claimRepairs.every(r=>r.from&&r.to&&r.claims.length),'Every repair records before, after and the claims');
 const plan=assembleCreativePlan(input,compiled.concepts,{mode:'local-ai',reason:'regression',planningVersion:2},'b'.repeat(16));
 assert.equal(plan.concepts.length,3);
});

test('creative headlines pass; factual claims need verbatim evidence',()=>{
 const context=creativeContext(fragranceInput()),evidence=claimEvidence(context);
 assert.deepEqual(unsupportedClaims('A quieter green.',evidence),[]);
 assert.deepEqual(unsupportedClaims('100% Natural Perfume',evidence),[]);
 assert.deepEqual(unsupportedClaims('Clinically proven to last 48 hours',evidence),['Clinically proven','48 hours']);
 assert.deepEqual(unsupportedClaims('Save 20% today',evidence),['20%']);
 const shape=creativePlanningRequest(fragranceInput(),context);
 const one={arguments:JSON.parse(raw).arguments.map(a=>({...a}))};one.arguments[0].title='Clinically proven for 48 hours';
 const out=repairArgumentClaims(one,context);
 assert.equal(out.value.arguments[0].title,'High Performance Scents','Unsupported title replaced with the cited evidence quote');
 assert.equal(one.arguments[0].title,'Clinically proven for 48 hours','Input is not mutated');
 assert.match(shape.content,/safety/,'Planner prompt names the extra forbidden claim');
});

test('repairs remove only the unsupported phrase and keep imaginative wording',()=>{
 assert.equal(removeClaims('Experience powerful and long-lasting fragrance',['long-lasting'],'idea'),'Experience powerful fragrance');
 assert.equal(removeClaims('Safe, quiet green',['Safe'],'title'),'quiet green');
 assert.equal(removeClaims('Experience powerful fragrances that last all day',['last all day'],'idea'),'','A claim that is the sentence object leaves a fragment, so it is replaced');
 assert.equal(removeClaims('safe and confident',['safe'],'feeling'),'','Too short for a strategy field');
 const context=creativeContext(fragranceInput()),value={arguments:JSON.parse(raw).arguments.map(a=>({...a}))};
 value.arguments[0].title='A quieter green';value.arguments[1].title='Safe, quiet cedar';
 const out=repairArgumentClaims(value,context).value.arguments;
 assert.equal(out[0].title,'A quieter green','Creative headline without a factual claim is untouched');
 assert.equal(out[1].title,'Quiet cedar','Only the unsupported word is removed from a headline');
});

test('a business reason that ignores its own cited evidence is replaced with the quoted words and recorded',()=>{
 const context={productName:'Tiramisu Cinnamon Rolls',facts:[{id:'brand-story',kind:'source',text:'It started with a simple question about weekend baking.'}]};
 const arg={title:'Simple Beginnings',idea:'A story behind the cinnamon rolls',audienceHypothesis:'Families looking for quality treats',tension:'Lack of understanding about the brand',businessFit:'Personal challenge highlights quality',feeling:'Emotional connection',proofId:'brand-story',proofQuote:'It started with a simple question'};
 const {value,repairs}=repairArgumentClaims({arguments:[arg]},context);
 assert.match(value.arguments[0].businessFit,/It started with a simple question/);
 assert.equal(value.arguments[0].tension,arg.tension,'model wording outside the failing field is kept');
 assert.ok(repairs.some(r=>r.field==='businessFit'&&r.from===arg.businessFit&&r.method==='replaced'));
 const grounded={...arg,businessFit:'A simple question started every batch'};
 assert.equal(repairArgumentClaims({arguments:[grounded]},context).repairs.length,0,'grounded reasons are untouched');
});
