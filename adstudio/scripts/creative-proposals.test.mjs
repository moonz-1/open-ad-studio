// CPU regressions for bounded creative contributions. No model or browser.
import assert from 'node:assert/strict';
import {parseVisualProposals,conceptsFromProposals} from '../../shared/lib/creative-proposals.ts';
import {creativeContext,fallbackConcepts,compileCreativeDraft} from '../../shared/lib/creative-engine.ts';
import {inputFixture,mockProposals} from './creative-fixtures.mjs';
for(const kind of ['bakery','bottle'])for(const background of ['replace','keep','clean']){
 const input={...inputFixture(kind),constraints:{background}},ctx=creativeContext(input),raw=mockProposals(input),parsed=parseVisualProposals(raw,ctx),concepts=conceptsFromProposals(input,ctx,parsed),base=fallbackConcepts(input,ctx);
 assert.equal(concepts.length,3);assert.equal(new Set(concepts.map(c=>c.composition)).size,3);
 for(let i=0;i<3;i++){
  for(const k of ['composition','camera','hierarchy','copyId','evidenceIds','scores'])assert.deepEqual(concepts[i][k],base[i][k],k+' is owned by the app');
  assert.equal(concepts[i].idea,parsed[i].hook);assert.equal(concepts[i].lighting,parsed[i].lighting);
  const draft=compileCreativeDraft(input,concepts[i]);assert.equal(draft.reviewedSnapshot,undefined);assert.equal(draft.input.source.sha256,input.source.sha256);assert.equal(draft.input.execution.seed,42);
 }
 assert.equal(raw,mockProposals(input),'Model values never rewritten to pass');
 for(const bad of ['',raw+'\n'+raw.split('\n')[0],raw.replace('GRAPHIC','EDITORIAL'),raw.replace('GRAPHIC','UNKNOWN'),raw.replace(' | ',' | extra | ')])assert.throws(()=>parseVisualProposals(bad,ctx));
 if(background==='replace')for(const text of ['a glass of milk and a cutting board','one single cinnamon roll on a wooden tray','a new low-angle camera and extreme close-up','handmade certified organic food with brand text','Replace the dish with new packaging','Freshly baked cookies with chocolate and nuts'])assert.throws(()=>conceptsFromProposals(input,ctx,parseVisualProposals(raw.replace('An approachable everyday pause with warm tactile surroundings',text),ctx)));
}
// Actual failed response shapes: no JSON repair, no second model invocation.
const ctx=creativeContext(inputFixture());
// Exact raw decisions from the single real No Crumbs attempt: parser success
// alone is insufficient; new props/flour/container changes invalidate the batch.
const actualFailed='EDITORIAL | golden hour glow filtering through bakery windows | white baking dish surrounded by warm wooden counter and flour-dusted apron | soft side light emphasizing roll textures\nDETAIL | textured ceramic dish resting on linen cloth | baking dish covered in fine flour dust and faintly textured counter | directional light highlighting frosting ridges and cinnamon patterns\nGRAPHIC | stark white background with minimal shadows | baking dish centered on clean white surface | controlled overhead light casting sharp shadows around rolls';
assert.throws(()=>parseVisualProposals(actualFailed,ctx),/app-owned|unobserved/);
for(const bad of ['Warm flour-dusted apron and wooden counter','Plain linen cloth and an unobserved spoon','baking dish centered on clean white surface','baking dish covered in fine flour dust'])assert.throws(()=>parseVisualProposals(mockProposals(inputFixture()).replace('A quiet plain bakery counter and receding cream wall',bad),ctx),/app-owned|unobserved/);
for(const raw of ['{"concepts":[{"id":"c1","rationale":"x","},{"id":"c2"}]}','EDITORIAL | A single cinnamon roll on a small wooden tray | Warm light\nDETAIL | x | y\nGRAPHIC | x | y'])assert.throws(()=>parseVisualProposals(raw,ctx));
console.log('PASS compact proposals: three approaches; app-owned count/camera/schema/evidence; no automatic review; malformed/unsafe product, prop, claim, camera and packaging proposals rejected. CPU only.');
