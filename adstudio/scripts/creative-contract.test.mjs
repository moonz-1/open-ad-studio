// CPU-only reproductions of the REAL Qwen3 failure; no model or owner database.
import assert from 'node:assert/strict';
import {parseCreativeResponse} from '../../shared/runtime/creative-json.ts';
import {creativePlanningRequest} from '../../shared/runtime/creative-engine.ts';
import {creativeContext,creativeConceptIssues,validateCreativeConcepts,compileCreativeDraft} from '../../shared/lib/creative-engine.ts';
import {inputFixture,mockConcepts} from './creative-fixtures.mjs';
const input=inputFixture('bottle'),ctx=creativeContext(input),valid=mockConcepts(input),json=JSON.stringify(valid);
const spaced=json.replace('"hierarchy":','" hierarchy ":').replace('"evidenceIds":','" evidenceIds ":').replace('"impact":','" impact ":');
const decoded=parseCreativeResponse(spaced);assert.deepEqual(decoded.value,valid);assert.equal(decoded.normalizations.length,3);validateCreativeConcepts(decoded.value,ctx);
const preserved=structuredClone(valid);preserved.concepts[0].idea='  Blue label { with "quoted" marks } — unchanged.  ';
assert.equal(parseCreativeResponse(JSON.stringify(preserved)).value.concepts[0].idea,preserved.concepts[0].idea,'String values are never trimmed or rewritten');
for(const raw of [
 String.raw`{"concepts":[{"id":"a","id":"b"}]}`,
 String.raw`{"concepts":[{"id":"a"," id ":"b"}]}`,
 String.raw`{"concepts":[{"id":"a","\u0069d":"b"}]}`,
 String.raw`{"concepts":[{"scores":{"impact":2," impact ":3}}]}`,
 String.raw`{"concepts":[]," concepts ":[]}`,
 String.raw`{"text":"{}"," text ":"{}"}`,
])assert.throws(()=>parseCreativeResponse(raw),/Duplicate|colliding/);
for(const raw of ['{" unknown ":1}','{"__proto__":{}}','{"concepts":[{"ID":"x"}]}','{"concepts":[{"scores":{" impactx ":4}}]}',json+' trailing',json+',','{"concepts":[],}',json.slice(0,-4),'```json\n'+json])assert.throws(()=>parseCreativeResponse(raw));
const unknown=JSON.parse(json);unknown.concepts[0].inventedField='x';assert.throws(()=>parseCreativeResponse(JSON.stringify(unknown)),/Unknown/);
const unchanged=JSON.parse(json);unchanged.concepts[0].evidenceIds=[' brand-name '];assert.equal(parseCreativeResponse(JSON.stringify(unchanged)).value.concepts[0].evidenceIds[0],' brand-name ');assert.throws(()=>validateCreativeConcepts(parseCreativeResponse(JSON.stringify(unchanged)).value,ctx),/Ungrounded/);
const numeric=JSON.parse(json);numeric.concepts[0].scores.impact='5';assert.throws(()=>validateCreativeConcepts(parseCreativeResponse(JSON.stringify(numeric)).value,ctx),/evaluation/);

// Reproduce all independent semantic failures after safe key normalization.
const unconfirmed={...input,facts:{...input.facts,confirmed:false}},uc=creativeContext(unconfirmed),failed=mockConcepts(unconfirmed);
failed.concepts[0].composition='Bottle centered, surrounded by organic materials.';
failed.concepts[0].evidenceIds=['photo','brand-name'];failed.concepts[1].evidenceIds=['photo'];
failed.concepts[2].idea='Bottle against a blue background with brand text.';
const rawFailure=JSON.stringify(failed).replace('"hierarchy":','" hierarchy":');
const issues=creativeConceptIssues(parseCreativeResponse(rawFailure).value,uc);
assert.ok(issues.some(s=>s.includes('Unsupported assertion: composition')));
assert.equal(issues.filter(s=>s.includes('Ungrounded')).length,2);
assert.ok(issues.some(s=>s.includes('generated typography')));
assert.throws(()=>validateCreativeConcepts(parseCreativeResponse(rawFailure).value,uc));
// An unambiguous proposed surrounding material is allowed; organic certification,
// health/price claims, count changes and redrawn labels remain rejected.
for(const text of ['Certified organic bottle','Vegan gluten-free product','$5 off','An award-winning product','Add ingredients','Change the label']){const c=mockConcepts(input);c.concepts[0].idea=text;assert.throws(()=>validateCreativeConcepts(c,ctx),/Unsupported/);}
const natural=mockConcepts(input);natural.concepts[0].environment='A plain matte tabletop with a tactile neutral mineral backdrop.';validateCreativeConcepts(natural,ctx);
for(const camera of ['low angle','overhead','from the side','side view','profile']){const c=mockConcepts(input);c.concepts[0].camera=camera;assert.throws(()=>validateCreativeConcepts(c,ctx),/slight perspective/);}
// Bare "side" / "side-light" must not trip the angle gate (lighting, not viewpoint).
{const c=mockConcepts(input);c.concepts[0].camera='soft side-light from camera left';validateCreativeConcepts(c,ctx);}
// Negated overhead in dynamics-style camera copy must not false-positive.
{const c=mockConcepts(input);c.concepts[0].camera='Slightly elevated three-quarter tabletop, not flat overhead tray copy.';validateCreativeConcepts(c,ctx);}
const centered=mockConcepts(input);for(const c of centered.concepts)c.composition='Bottle centered, label visible, surface empty.';assert.throws(()=>validateCreativeConcepts(centered,ctx),/centered/);
const batch=inputFixture(),batchContext=creativeContext(batch);
for(const text of ['Close-up of a single cinnamon roll.','Nine rolls with a glass of milk and a cutting board.']){const c=mockConcepts(batch);c.concepts[0].idea=text;assert.throws(()=>validateCreativeConcepts(c,batchContext),/count lock|unobserved extra item/);}
assert.throws(()=>parseCreativeResponse(String.raw`{"concepts":[{"id":"c1","rationale":"x","},{"id":"c2"}]}`),/Unknown|JSON/,'Never repair malformed object boundaries from the real product response');
const locks={...input,constraints:{exactCount:true,arrangement:'exactly',angle:'none',crop:'none',background:'keep'}};
for(const [field,text]of [['composition','Remove products and tight crop'],['camera','Change the angle and rotate the bottle'],['environment','Scatter the products across a table']]){const c=mockConcepts(locks);c.concepts[0][field]=text;assert.throws(()=>validateCreativeConcepts(c,creativeContext(locks)),/locked|lock/);}

const request=creativePlanningRequest(unconfirmed,uc);assert.ok(!request.permittedEvidenceIds.includes('brand-name'),'Identity alone cannot be a business proof');
const content=JSON.parse(request.content);assert.equal(content.observations.confirmed,false);assert.ok(content.businessProof.some(e=>e.id==='brand-description'));assert.equal(content.copyOptions,undefined);assert.equal(content.layoutOptions,undefined);
for(const a of content.assignments){assert.ok(content.businessProof.some(p=>p.id===a.proofId));assert.ok(uc.facts.find(f=>f.id===a.proofId).text.includes(a.proofQuote));}
assert.deepEqual(Object.keys(content.responseShape),['first','second','third']);assert.ok(!request.system.includes(unconfirmed.brand.dna.description),'Untrusted evidence stays in DATA');assert.ok(!request.fields.includes('proofId'));assert.ok(!request.fields.includes('focus'));assert.ok(request.appCompiledFields.includes('proofId'));assert.ok(request.appCompiledFields.includes('focus'));assert.ok(request.appCompiledFields.includes('composition'));assert.match(request.system,/DIFFERENT evidence-based reasons/);
assert.deepEqual(unconfirmed.facts.confirmed,false,'No automatic source confirmation');
for(const c of validateCreativeConcepts(valid,ctx)){const d=compileCreativeDraft(input,c);assert.ok(d.modelPrompt.length<6000);assert.equal(d.reviewedSnapshot,undefined);}
console.log('PASS strict key-only normalization, decoded duplicate/collision rejection, untouched values, exhaustive real-failure shapes, compact model instructions with app-owned evidence/schema, conservative claims, physical locks and distinct compiled prompts. CPU only.');
