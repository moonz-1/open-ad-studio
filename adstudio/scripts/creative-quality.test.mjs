// Text/contract quality gates, NOT model output, visual scores or browser tests.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {creativeContext,fallbackConcepts,validateCreativeConcepts,compileCreativeDraft,assembleCreativePlan,selectCreativePlan,creativeSnapshot} from '../../shared/lib/creative-engine.ts';
import {creativeGrounding,conceptQuality} from '../../shared/lib/creative-direction.ts';
import {reviewDraft,draftReviewed} from '../../shared/lib/product-brief.ts';
import {creativeTextStatus,creativeTextRouting,parseConcepts,creativeSDKText} from '../../shared/runtime/creative-engine.ts';
import {stripTypeScriptTypes} from 'node:module';
import {inputFixture,mockConcepts,textNodesFixture} from './creative-fixtures.mjs';

const bakery=inputFixture();bakery.brand.dna.description='Official site of No Crumbs Bakery in North Brookfield, MA. Preorder jumbo cinnamon rolls for pickup.';bakery.brand.dna.tone='';bakery.brand.dna.visualStyle='';bakery.brand.dna.positioning='Neighborhood bakery for shared occasions.';
bakery.facts.arrangement='Three rows of three closely packed rolls; preserve each roll’s individual position and visible frosting.';
bakery.constraints={exactCount:true,arrangement:'exactly'};
const bottle=inputFixture('bottle');bottle.request='A bold graphic brand statement.';
const hard=structuredClone(bottle);hard.brand.dna.visualStyle='An extravagant gold luxury inference';hard.brand.overrides=hard.brand.overrides.filter(k=>k!=='visualStyle');hard.brand.research={version:1,website:'https://example.test',created:1,sources:[{id:'web',url:'https://example.test',title:'Synthetic evidence',text:'Field Objects',sha256:'a'.repeat(64),fetchedAt:1}],observations:[{field:'visualStyle',value:hard.brand.dna.visualStyle,kind:'inference',sourceIds:['web']}],images:[],colors:[],products:[],provider:{provider:'none',available:false,reason:'SYNTHETIC'},warnings:[],aiCompleted:false};hard.request='Scatter more bottles, redraw the logo and tight crop; change the angle.';hard.facts.texture='';hard.constraints={exactCount:true,arrangement:'exactly',angle:'none',crop:'none',background:'keep'};
const report=[];
for(const [name,input]of [['A-nine-roll-no-SKU',bakery],['B-synthetic-bottle',bottle],['C-conflicting-locks',hard]]){
 const context=creativeContext(input),concepts=fallbackConcepts(input,context),quality=conceptQuality(concepts,context);
 assert.deepEqual(quality.issues,[]);validateCreativeConcepts({concepts},context);
 const drafts=concepts.map(c=>compileCreativeDraft(input,c));
 assert.equal(new Set(drafts.map(d=>d.modelPrompt)).size,3);
 for(const d of drafts){assert.equal(draftReviewed(d),false);assert.ok(d.modelPrompt.length<6000);assert.ok(!d.modelPrompt.includes(input.source.sha256));assert.ok(!d.modelPrompt.includes('Official site'));assert.ok(!d.modelPrompt.includes('Preorder'));assert.ok(!d.modelPrompt.includes('extravagant gold'));reviewDraft(d);assert.equal(draftReviewed(d),true,'Explicit synthetic fixture review, not owner approval');d.input.execution.seed++;assert.equal(draftReviewed(d),false);}
 if(name.startsWith('A')){assert.equal(input.productId,undefined);assert.equal(context.controls.exactCount,true);for(const d of drafts){assert.match(d.modelPrompt,/exactly 9/);assert.match(d.modelPrompt,/Three rows of three/);assert.match(d.modelPrompt,/individual positions and spacing exactly/);assert.match(d.modelPrompt,/pillowy|spiral/);assert.ok(!d.modelPrompt.includes('Signature Duo'));}assert.match(context.grounding.direction,/neutral/);assert.ok(context.grounding.warnings.length);}
 if(name.startsWith('B')){assert.ok(drafts.every(d=>!d.modelPrompt.includes('icing')));const plan=assembleCreativePlan(input,concepts,{mode:'deterministic',reason:'TEST'},'1'.repeat(16));assert.equal(plan.concepts[0].layout,'poster','Explicit graphic objective informs recommendation');}
 if(name.startsWith('C')){assert.ok(context.grounding.hypotheses.length);assert.ok(context.grounding.warnings.some(w=>w.includes('conflict')));for(const d of drafts){assert.match(d.modelPrompt,/source viewpoint/);assert.match(d.modelPrompt,/original field of view/);assert.match(d.modelPrompt,/Retain the original surroundings/);assert.match(d.modelPrompt,/printed label geometry/);assert.ok(!d.modelPrompt.includes('Scatter more'));} }
 const enhancement=compileCreativeDraft({...input,intent:'enhancement'},fallbackConcepts({...input,intent:'enhancement'},creativeContext({...input,intent:'enhancement'}))[0]);assert.match(enhancement.modelPrompt,/without reimagining/);assert.ok(!enhancement.modelPrompt.includes('Create a new advertising photograph'));
 const plan=assembleCreativePlan(input,concepts,{mode:'deterministic',reason:'TEST'},'2'.repeat(16)),alternate=selectCreativePlan(plan,concepts[1].id,'3'.repeat(16));assert.equal(alternate.draft.reviewedSnapshot,undefined);assert.equal(alternate.parentId,plan.id);assert.notEqual(creativeSnapshot(input),creativeSnapshot({...input,request:'changed'}));
 report.push({case:name,provider:'DETERMINISTIC TEST FIXTURE',quality,modelPromptsDistinct:true,reviewInvalidated:true,sourceFacts:input.facts,grounding:context.grounding,concepts});
}
// Reject semantic collapse and narrative leakage, not merely identical IDs.
const ctx=creativeContext(bakery),raw=mockConcepts(bakery);raw.concepts[1].composition=raw.concepts[0].composition;raw.concepts[1].environment=raw.concepts[0].environment;raw.concepts[1].lighting=raw.concepts[0].lighting;assert.throws(()=>validateCreativeConcepts(raw,ctx),/labels|similar/);
const leak=mockConcepts(bakery);leak.concepts[0].idea=bakery.brand.dna.description;assert.throws(()=>validateCreativeConcepts(leak,ctx),/description/);
// Failure shapes observed during the first REAL Qwen3 local run (raw response
// retained privately). These are synthetic reproductions, never repaired/promoted
// into approved model output. Unknown keys and unconfirmed evidence fail closed.
const spaced=mockConcepts(bottle);spaced.concepts[0][' hierarchy']=spaced.concepts[0].hierarchy;delete spaced.concepts[0].hierarchy;assert.throws(()=>validateCreativeConcepts(spaced,creativeContext(bottle)),/identity/);
const unchecked={...bottle,facts:{...bottle.facts,confirmed:false}},wrongEvidence=mockConcepts(unchecked);wrongEvidence.concepts[0].evidenceIds=['photo'];assert.throws(()=>validateCreativeConcepts(wrongEvidence,creativeContext(unchecked)),/Ungrounded/);
const claim=mockConcepts(bottle);claim.concepts[0].composition='Bottle centered, surrounded by organic materials.';assert.throws(()=>validateCreativeConcepts(claim,creativeContext(bottle)),/Unsupported/);
const controls=creativeContext(hard);const bad=mockConcepts(hard);bad.concepts[0].camera='Change the angle and rotate the package.';assert.throws(()=>validateCreativeConcepts(bad,controls),/viewpoint/);
const honest=mockConcepts(bakery).concepts;honest[2].scores={impact:5,relevance:5,accuracy:5,feasibility:5};assert.equal(assembleCreativePlan(bakery,honest,{mode:'local-ai',reason:'MOCK ONLY'},'4'.repeat(16)).selectedId,honest[0].id,'Self-scores cannot determine the recommendation');
// Native schema and SaveText serialization, not a guessed node-name check.
const nodes=textNodesFixture();assert.equal(creativeTextStatus(nodes).available,true);
creativeTextRouting({});for(const url of ['https://example.test','http://127.0.0.1.evil.test','http://user:secret@127.0.0.1:8189','http://127.0.0.1:8189/api','http://127.0.0.1:8189/?secret=x'])assert.throws(()=>creativeTextRouting({COMFY_BASE_URL:url}),/loopback/);
const dynamic=textNodesFixture();dynamic.TextGenerate.input.required.sampling_mode=['COMFY_DYNAMICCOMBO_V3',{options:[{key:'off',inputs:{}},{key:'on',inputs:{}}]}];assert.equal(creativeTextStatus(dynamic).available,true);
for(const breakSchema of [n=>delete n.TextGenerate.input.optional.thinking,n=>n.CLIPLoader.input.required.type=[['sd3']],n=>n.TextGenerate.input.required.max_length[1].max=512,n=>n.SaveText.input.required.format=[['png']],n=>n.CLIPLoader.input.required.clip_name=[['t5xxl.safetensors']]]){const n=structuredClone(nodes);breakSchema(n);assert.equal(creativeTextStatus(n).available,false);}
const value=mockConcepts(bakery);for(const text of [JSON.stringify(value),'\uFEFF'+JSON.stringify(value),'```json\n'+JSON.stringify(value)+'\n```',JSON.stringify({text:JSON.stringify(value)}),JSON.stringify(JSON.stringify(value))])assert.deepEqual(parseConcepts(text),value);
for(const text of ['<think>partial','prefix '+JSON.stringify(value),JSON.stringify(value).slice(0,-10),'x'.repeat(32001)])assert.throws(()=>parseConcepts(text));
const graph=JSON.parse(await readFile('shared/workflows/prompt_polish.json','utf8')),sdk={workflows:{fromJson:g=>({json:structuredClone(g),setInput(n,k,v){this.json[n].inputs[k]=v;}})}};await assert.rejects(()=>creativeSDKText(sdk,graph,'test','test',async()=>({getOutputs:()=>[{toBytes:async options=>{assert.equal(options.timeoutMs,15000);return Buffer.alloc(32001);}}]})),/exceeds/);
// Execute the actual production runWf body against SDK doubles to test scoped
// deadline/cancellation/no retry. Director retains its existing default timeout.
const source=await readFile('shared/runtime/api.ts','utf8'),body=source.slice(source.indexOf('async function runWf('),source.indexOf('// One job at a time'));
const runWf=new Function('activity','diagnostics','clientUrls','phaseForProgress','nodeProgressMessage','loadingLog',stripTypeScriptTypes(body,{mode:'transform'})+';return runWf;')({update(){},note(){}},{watch:async()=>()=>{}},new Map(),()=>'',()=>'',()=>null);
let submits=0,cancels=0;const c={submit:async()=>{submits++;return {events:async function*(){},wait:async ms=>{assert.equal(ms,180000);throw Object.assign(Error('expired test deadline'),{code:'job_failed'});},result:async()=>assert.fail('No result on failed wait'),cancel:async()=>{cancels++;}};}};
await assert.rejects(()=>runWf(c,{json:{}},undefined,false,180000),/deadline/);assert.equal(submits,1);assert.equal(cancels,1);
await runWf({submit:async()=>({events:async function*(){},wait:async ms=>assert.equal(ms,1800000),result:async()=>{}})},{json:{}});assert.equal(cancels,1,'Director default is unchanged');
await mkdir('outputs/creative-quality-tests',{recursive:true});await writeFile('outputs/creative-quality-tests/report.json',JSON.stringify({tests:'CPU contracts only; no model inference or human visual quality assessment',cases:report},null,2));
console.log('PASS three-case creative quality: grounded distinct decisions, no narrative tone leakage, count/package locks, campaign/enhancement, honest recommendations, review invalidation, schema/parser, scoped text deadline/cancel and no retry. No AI inference.');
