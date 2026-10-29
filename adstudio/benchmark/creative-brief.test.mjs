import assert from 'node:assert/strict';
import {cinnamonConcepts} from './creative-concepts.mjs';
import {compileQwenBrief,validateBrief,campaignGraph,validateCampaign} from './creative-brief.mjs';
import {qwenGraph} from './qwen-hero.mjs';
const briefs=cinnamonConcepts({originalSha256:'a'.repeat(64),websiteSha256:'b'.repeat(64),website:'https://example.test/'});
assert.equal(new Set(briefs.map(compileQwenBrief)).size,3);
for(const b of briefs){
  validateBrief(b);const p=compileQwenBrief(b);assert.ok(p.includes('image 1'));assert.ok(p.includes('COPY SPACE'));assert.ok(p.includes('DO NOT INVENT'));assert.ok(p.includes('hand-spread'));
  const graph=await campaignGraph(b),fallback=await qwenGraph('lighting');
  graph['6'].inputs.prompt=fallback['6'].inputs.prompt;graph['15'].inputs.filename_prefix=fallback['15'].inputs.filename_prefix;
  assert.deepEqual(graph,fallback,'Only prompt/save prefix change: official reference graph and sampler intact');
}
assert.match(briefs[0].camera,/overhead/);assert.match(briefs[1].referenceInstruction,/crop/);assert.match(briefs[2].environment,/dark warm-charcoal/);
assert.ok(briefs[1].uncertainties.some(s=>s.includes('inferred')));assert.ok(briefs[2].uncertainties.some(s=>s.includes('infer')));
for(const mutate of [b=>b.facts[0].evidenceIds=['unknown'],b=>b.evidence[0].kind='ai-vision-guessed',b=>b.negativeSpace='',b=>b.preserve=[],b=>b.uncertainties='none']){
  const b=structuredClone(briefs[0]);mutate(b);assert.throws(()=>compileQwenBrief(b));
}
const generic=structuredClone(briefs[0]);generic.product='a hand-painted enamel mug';generic.facts=[{text:'The mug has one chipped blue rim.',evidenceIds:['photo-1']}];generic.preserve=['Keep the chipped rim and original handle.'];assert.match(compileQwenBrief(generic),/enamel mug/);
const plan={version:1,model:'Qwen-Image-Edit-2511-FP8',cases:briefs.map(brief=>({id:brief.id,seed:42,brief,prompt:compileQwenBrief(brief),reference:{kind:'original',path:'outputs/fixture.png',sha256:'a'.repeat(64),originalPath:'outputs/original.jpg',originalSha256:'c'.repeat(64)}}))};
validateCampaign(plan);assert.throws(()=>validateCampaign({...plan,cases:plan.cases.slice(0,2)}));const tampered=structuredClone(plan);tampered.cases[1].prompt+=' fabricate an offer';assert.throws(()=>validateCampaign(tampered));
console.log('PASS 3 distinct source-grounded briefs, unknown-fact rejection, reusable fields, unchanged official workflow, fixed seed and prompt-tamper gate. No inference.');
