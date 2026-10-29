import assert from 'node:assert/strict';
import {test} from 'node:test';
import {needsPhysicalCutout,preferDeterministicEmpty,emptySetSpec,sourceViewpoint,preferEditorialOriginal,presentationMode,campaignExecutionStrategy} from '../../shared/lib/campaign-presentation.ts';
import {deterministicEmptySet} from '../../shared/runtime/product-campaign.ts';
import {assembleCreativePlan,creativeContext,fallbackConcepts,consumerCampaignCopy,isInternalAdCopy} from '../../shared/lib/creative-engine.ts';
import {adCampaignPrompt} from '../../shared/lib/ad-scene.ts';
import {inputFixture} from './creative-fixtures.mjs';

test('digital and service never require physical cutouts',()=>{
 assert.equal(needsPhysicalCutout({productType:'digital',facts:{description:'SaaS dashboard screenshot',arrangement:'',texture:'',container:'',confirmed:true}}),false);
 assert.equal(needsPhysicalCutout({productType:'service',facts:{description:'Consulting offer page',arrangement:'',texture:'',container:'',confirmed:true}}),false);
 assert.equal(needsPhysicalCutout({productType:'packaged-goods',facts:{description:'Glass perfume bottle',arrangement:'one bottle',texture:'glass',container:'glass bottle',confirmed:true}}),true);
 assert.equal(needsPhysicalCutout({productType:'cookies',facts:{description:'Four cookies',count:4,arrangement:'tray',texture:'baked',container:'foil tray',confirmed:true}}),true);
 assert.equal(needsPhysicalCutout({productType:'other',facts:{description:'Abstract graphic',arrangement:'',texture:'',container:'',confirmed:true}}),false);
 assert.equal(needsPhysicalCutout({productType:'other',facts:{description:'Pump bottle on marble',arrangement:'standing',texture:'glass',container:'pump bottle',confirmed:true}}),true);
});

test('empty set reflects brand palette and selected argument, not a single bakery template',()=>{
 const bakery=inputFixture();
 const bakeryPlan=assembleCreativePlan(bakery,fallbackConcepts(bakery,creativeContext(bakery)),{mode:'deterministic',reason:'CPU',model:'None'},'a'.repeat(16));
 // High/exactCount must NOT force deterministic SVG when AI empty-set is available.
 assert.equal(preferDeterministicEmpty(bakeryPlan,true),false);
 assert.equal(preferDeterministicEmpty(bakeryPlan,false),true);
 const food=emptySetSpec(bakeryPlan);
 assert.equal(food.material,'walnut');
 const foodPlate=deterministicEmptySet(bakeryPlan);
 assert.match(foodPlate.prompt,/deterministic-empty-set:walnut/);
 assert.match(foodPlate.prompt,/brand=/);

 const beauty=inputFixture();
 beauty.productType='packaged-goods';
 beauty.request='Coastal mineral beauty campaign';
 beauty.brand.dna.visualStyle='Cool stone, soft linen, mineral light';
 beauty.brand.colors=['#e8eef1','#9aa7b0','#3a4a55'];
 beauty.facts={description:'One frosted glass perfume bottle with a silver cap.',arrangement:'Standing alone',texture:'Frosted glass',container:'Glass bottle with silver cap',confirmed:true,count:1};
 const beautyPlan=assembleCreativePlan(beauty,fallbackConcepts(beauty,creativeContext(beauty)),{mode:'deterministic',reason:'CPU',model:'None'},'b'.repeat(16));
 beautyPlan.concepts.forEach(c=>{c.environment='Cool mineral stone ledge beside linen';c.lighting='Soft north window wrap';c.idea='Quiet presence on stone';});
 const stone=emptySetSpec(beautyPlan);
 assert.ok(stone.material==='stone'||stone.archetype==='beauty-sensory');
 const beautyPlate=deterministicEmptySet(beautyPlan);
 assert.notEqual(beautyPlate.prompt,foodPlate.prompt);
 assert.match(beautyPlate.prompt,/idea=|env=/);
 assert.notEqual(foodPlate.bytes.equals(beautyPlate.bytes),true);

 const digital=inputFixture();
 digital.productType='digital';
 digital.brand.colors=['#0d1117','#238636','#c9d1d9'];
 digital.facts={description:'App home screen',arrangement:'',texture:'UI',container:'',confirmed:true};
 const digPlan=assembleCreativePlan(digital,fallbackConcepts(digital,creativeContext(digital)),{mode:'deterministic',reason:'CPU',model:'None'},'c'.repeat(16));
 digPlan.concepts.forEach(c=>{c.environment='Clean product UI on a soft screen field';});
 assert.equal(needsPhysicalCutout(digPlan.input),false);
 assert.equal(emptySetSpec(digPlan).material,'screen');
 assert.equal(campaignExecutionStrategy(digPlan),'product-safe');
});

test('overhead locked products use product-locked generative — not editorial-original posters',()=>{
 const bakery=inputFixture();
 bakery.facts={...bakery.facts,description:'Four cookies overlapping lengthwise in one rectangular foil tray, photographed from overhead.',arrangement:'Four cookies in one overlapping column along the long rectangular foil tray.',container:'One rectangular ridged foil tray.',confirmed:true,count:4};
 bakery.constraints={exactCount:true,arrangement:'exactly',angle:'none',crop:'none',fidelity:'high',background:'replace'};
 const bakeryPlan=assembleCreativePlan(bakery,fallbackConcepts(bakery,creativeContext(bakery)),{mode:'deterministic',reason:'CPU',model:'None'},'d'.repeat(16));
 assert.equal(sourceViewpoint(bakery),'overhead');
 assert.equal(campaignExecutionStrategy(bakeryPlan),'product-locked-generative');
 assert.equal(preferEditorialOriginal(bakeryPlan),false);
 assert.equal(presentationMode(bakeryPlan),'flat-lay-composite');
 assert.equal(bakeryPlan.composition.campaign.presentation,'composite');
 assert.match(adCampaignPrompt(bakeryPlan),/overhead|flat-lay|top-down/i);
 assert.match(adCampaignPrompt(bakeryPlan),/EMPTY/i);

 const beauty=inputFixture();
 beauty.productType='packaged-goods';
 beauty.request='Coastal mineral beauty campaign';
 beauty.brand.dna.visualStyle='Cool stone, soft linen, mineral light';
 beauty.brand.dna.messaging='A quiet presence.';
 beauty.brand.overrides=[...(beauty.brand.overrides||[]),'messaging'];
 beauty.facts={description:'One frosted glass perfume bottle with a silver cap, standing upright at eye level.',arrangement:'Standing alone, front-facing hero bottle.',texture:'Frosted glass',container:'Glass bottle with silver cap',confirmed:true,count:1};
 beauty.constraints={exactCount:true,arrangement:'exactly',angle:'slight',crop:'moderate',background:'replace',fidelity:'high'};
 const beautyPlan=assembleCreativePlan(beauty,fallbackConcepts(beauty,creativeContext(beauty)),{mode:'deterministic',reason:'CPU',model:'None'},'e'.repeat(16));
 assert.equal(sourceViewpoint(beauty),'eye-level');
 assert.equal(campaignExecutionStrategy(beautyPlan),'product-locked-generative');
 assert.equal(presentationMode(beautyPlan),'perspective-composite');
 assert.equal(beautyPlan.composition.headline,'A quiet presence.');
});

test('owner-authorized creative restage when fidelity is not a packaging lock',()=>{
 const open=inputFixture('bottle');
 open.constraints={exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',fidelity:'medium',creativity:'high'};
 const plan=assembleCreativePlan(open,fallbackConcepts(open,creativeContext(open)),{mode:'deterministic',reason:'CPU',model:'None'},'h'.repeat(16));
 assert.equal(campaignExecutionStrategy(plan),'creative-restage');
 assert.equal(preferEditorialOriginal(plan),false);
});

test('consumer copy never publishes strategy.memory or fidelity language',()=>{
 assert.equal(isInternalAdCopy('The ridged foil tray and counted four-cookie column hold the invitation without added bakery props.'),true);
 const bakery=inputFixture();
 bakery.brand.dna.messaging='Leave Nothing Behind';
 bakery.brand.overrides=[...(bakery.brand.overrides||[]),'messaging'];
 bakery.facts={...bakery.facts,description:'Four cookies overlapping lengthwise in one rectangular foil tray from overhead.',confirmed:true,count:4,container:'foil tray',arrangement:'overlapping column'};
 const ctx=creativeContext(bakery);
 const plan=assembleCreativePlan(bakery,fallbackConcepts(bakery,ctx),{mode:'deterministic',reason:'CPU',model:'None'},'g'.repeat(16));
 assert.equal(plan.composition.headline,'Leave Nothing Behind');
 assert.ok(!/counted four-cookie|bakery props|ridged foil tray and counted/i.test(plan.composition.body));
 assert.ok(!isInternalAdCopy(plan.composition.headline));
 const copy=consumerCampaignCopy(bakery,plan.concepts[0],ctx);
 assert.equal(copy.headline,'Leave Nothing Behind');
});
