// CPU: structured composition dynamics + refinement mapping. No inference.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assembleCreativePlan,creativeContext,fallbackConcepts,refinePlanComposition,parseCompositionRefinement} from '../../shared/lib/creative-engine.ts';
import {compositionPlanPrompt} from '../../shared/lib/composition-dynamics.ts';
import {adScenePrompt} from '../../shared/lib/ad-scene.ts';
import {inputFixture} from './creative-fixtures.mjs';
import {newBrand} from '../../shared/lib/brand.ts';

test('bakery and laptop plans differ spatially without invented specs',()=>{
 const bakeryInput=inputFixture('bakery');
 bakeryInput.brand.dna.name='No Crumbs Bakery';
 bakeryInput.brand.dna.description='No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.';
 bakeryInput.productType='cookies';
 bakeryInput.facts={description:'Thick irregular chocolate chip cookies with cracked golden crusts and visible chips.',count:3,arrangement:'Overlapping bakery cookies.',texture:'Golden cracked crust, mounded height, uneven chips.',container:'None — foil tray is packaging only.',confirmed:true};
 bakeryInput.constraints={fidelity:'medium',exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',creativity:'high'};
 bakeryInput.request='Artisanal cookie campaign emphasizing thickness and texture without the foil tray.';
 const bakery=assembleCreativePlan(bakeryInput,fallbackConcepts(bakeryInput,creativeContext(bakeryInput)),{mode:'deterministic',reason:'cpu',model:'None'},'a'.repeat(16));
 assert.ok(bakery.dynamics);
 assert.equal(bakery.dynamics.product.packagingPolicy,'omit-if-not-product');
 assert.match(bakery.dynamics.product.arrangement,/diagonal|stack|hero|thickness/i);
 assert.ok(bakery.dynamics.product.identityAnchors.some(a=>/crack|thick|chip|golden/i.test(a)));

 const laptopBrand=newBrand('Northline Machines');
 laptopBrand.dna.description='Northline Machines designs thin aluminium notebooks with a visible hinge and edge profile for studio professionals.';
 laptopBrand.dna.tone='Precise, quiet, architectural.';
 laptopBrand.dna.visualStyle='Cool metal, controlled speculars, geometric depth.';
 laptopBrand.products=[{id:'nb',name:'Studio Notebook',description:'Thin aluminium notebook with visible hinge.',sellingPoints:'',imageIds:[]}];
 const laptopInput={
  version:1,projectId:'laptop-demo',brand:laptopBrand,
  source:{id:'s',name:'laptop.png',kind:'original',sha256:'b'.repeat(64),originalSha256:'c'.repeat(64)},
  facts:{description:'One thin aluminium notebook, lid open, visible hinge and edge profile.',count:2,arrangement:'Two units available for staggered angles.',texture:'Brushed aluminium with sharp edge speculars.',container:'No outer packaging.',confirmed:true},
  productType:'other',request:'Premium electronics campaign: staggered notebooks emphasizing display and thin profile. No invented performance specs.',
  intent:'campaign',format:'feed',seed:7,
  constraints:{fidelity:'medium',exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',creativity:'high'}
 };
 const laptop=assembleCreativePlan(laptopInput,fallbackConcepts(laptopInput,creativeContext(laptopInput)),{mode:'deterministic',reason:'cpu',model:'None'},'d'.repeat(16));
 assert.ok(laptop.dynamics);
 assert.match(laptop.dynamics.product.arrangement,/stagger|angle|profile|display/i);
 assert.notEqual(bakery.dynamics.product.arrangement,laptop.dynamics.product.arrangement);
 const bakeryPrompt=adScenePrompt(bakery),laptopPrompt=adScenePrompt(laptop);
 assert.match(bakeryPrompt,/Composition|Arrangement|Identity anchors|Advertising concept/i);
 assert.match(laptopPrompt,/stagger|profile|aluminium|notebook/i);
 assert.ok(!/GHz|battery life|certified|waterproof/i.test(laptopPrompt),'No invented laptop specs');
});

test('refinement updates concrete dynamics fields rather than vague prose only',()=>{
 const input=inputFixture('bakery');
 input.constraints={fidelity:'medium',exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',creativity:'high'};
 input.facts={...input.facts,container:'None — packaging only.',confirmed:true};
 const plan=assembleCreativePlan(input,fallbackConcepts(input,creativeContext(input)),{mode:'deterministic',reason:'cpu',model:'None'},'e'.repeat(16));
 assert.ok(Object.keys(parseCompositionRefinement('Arrange the products diagonally and leave more negative space for copy.')).length>=2);
 const refined=refinePlanComposition(plan,'Arrange the products diagonally. Leave more negative space for copy.',('f'.repeat(16)));
 assert.match(refined.dynamics.product.arrangement,/diagonal/i);
 assert.match(refined.dynamics.frame.negativeSpace,/open field|unlettered|negative space/i);
 assert.equal(refined.dynamics.frame.energy,'dynamic');
 const prompt=compositionPlanPrompt(refined.dynamics);
 assert.match(prompt,/diagonal/i);
 assert.notEqual(plan.dynamics.product.arrangement,refined.dynamics.product.arrangement);
});

console.log('PASS composition dynamics: brand-adaptive bakery vs laptop plans; refinement maps to concrete fields.');
