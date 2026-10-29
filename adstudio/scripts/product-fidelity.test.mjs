// Measurable product-fidelity gates. No GPU.
import test from 'node:test';
import assert from 'node:assert/strict';
import {productFidelityReport,allowsProductMotion} from '../../shared/lib/product-fidelity.ts';
import {directorInput,directorResponse} from './creative-director-fixtures.mjs';
import {creativeContext,assembleCreativePlan} from '../../shared/lib/creative-engine.ts';
import {conceptsFromAdvertising} from '../../shared/lib/advertising-strategy.ts';
import {planOriginalCampaign} from '../../shared/lib/reference-video.ts';

test('restage never product-locks; integrated/harmonized with cutout do',()=>{
 assert.equal(productFidelityReport({model:'klein-scene',fidelityMode:'creative-restage'}).productLocked,false);
 assert.equal(allowsProductMotion({model:'klein-scene',fidelityMode:'creative-restage'}),false);
 assert.equal(productFidelityReport({model:'klein-integrated',fidelityMode:'product-fidelity',cutout:{sha256:'a'.repeat(64)}}).productLocked,true);
 assert.equal(allowsProductMotion({model:'klein-harmonized',fidelityMode:'hybrid-harmonize',cutout:{sha256:'b'.repeat(64)}}),true);
 assert.equal(productFidelityReport({model:'klein-harmonized',fidelityMode:'hybrid-harmonize'}).productLocked,false);
 assert.equal(productFidelityReport({model:'product-safe'}).productLocked,true);
});

test('original campaigns preserve source photographs for locked and unlocked products',()=>{
 const bakery=directorInput('bakery'),bakeryPlan=assembleCreativePlan(bakery,conceptsFromAdvertising(directorResponse(bakery),bakery,creativeContext(bakery)),{mode:'local-ai',reason:'fixture',planningVersion:2},'a'.repeat(16));
 assert.ok(bakeryPlan.context.controls.exactCount);
 assert.equal(planOriginalCampaign(bakeryPlan).shots.filter(s=>s.execution==='ltx').length,0);
 const workshop=directorInput('workshop'),workshopPlan=assembleCreativePlan(workshop,conceptsFromAdvertising(directorResponse(workshop),workshop,creativeContext(workshop)),{mode:'local-ai',reason:'fixture',planningVersion:2},'b'.repeat(16));
 assert.equal(!!workshopPlan.context.controls.exactCount,false);
 assert.equal(planOriginalCampaign(workshopPlan).shots.filter(s=>s.execution==='ltx').length,0);
});
