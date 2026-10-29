// CPU demo: brand-adaptive composition plans for bakery vs premium laptop.
// No GPU. Writes comparable JSON for owner review.
import {writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {assembleCreativePlan,creativeContext,fallbackConcepts,refinePlanComposition} from '../../shared/lib/creative-engine.ts';
import {adScenePrompt} from '../../shared/lib/ad-scene.ts';
import {inputFixture} from './creative-fixtures.mjs';
import {newBrand} from '../../shared/lib/brand.ts';

const out=resolve('outputs','composition-dynamics-demo');
await mkdir(out,{recursive:true});

const bakeryInput=inputFixture('bakery');
bakeryInput.brand.dna.name='No Crumbs Bakery';
bakeryInput.brand.dna.description='No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.';
bakeryInput.brand.dna.tone='Warm, inviting and indulgent.';
bakeryInput.brand.dna.visualStyle='Deep cocoa, warm cream, tactile bakery editorial.';
bakeryInput.productType='cookies';
bakeryInput.facts={
 description:'Thick irregular mounded chocolate chip cookies with deep cracked golden crusts and uneven dark chocolate chunks.',
 count:3,arrangement:'Overlapping bakery cookies emphasizing thickness.',texture:'Golden cracked crust, porous crumb, irregular chips.',
 container:'None — original foil tray is packaging only, not the product.',confirmed:true
};
bakeryInput.constraints={fidelity:'medium',exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',creativity:'high'};
bakeryInput.request='Artisanal cookie advertising: recognizable thick cracked cookies in a dynamic edible arrangement without foil packaging.';

const laptopBrand=newBrand('Northline Machines');
laptopBrand.dna.description='Northline Machines designs thin aluminium notebooks with a visible hinge and edge profile for studio professionals.';
laptopBrand.dna.tone='Precise, quiet, architectural.';
laptopBrand.dna.visualStyle='Cool metal, controlled speculars, geometric depth.';
laptopBrand.products=[{id:'nb',name:'Studio Notebook',description:'Thin aluminium notebook with visible hinge.',sellingPoints:'',imageIds:[]}];
const laptopInput={
 version:1,projectId:'laptop-demo',brand:laptopBrand,
 source:{id:'s',name:'laptop.png',kind:'original',sha256:'b'.repeat(64),originalSha256:'c'.repeat(64)},
 facts:{description:'Thin aluminium notebook, lid open, visible hinge and sharp edge profile.',count:2,arrangement:'Two units for staggered angles.',texture:'Brushed aluminium with controlled speculars.',container:'No outer packaging.',confirmed:true},
 productType:'other',
 request:'Premium electronics: staggered notebooks — one display-forward, one thin-profile — geometric lighting. No invented specs.',
 intent:'campaign',format:'feed',seed:7,
 constraints:{fidelity:'medium',exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',creativity:'high'}
};

const bakery=assembleCreativePlan(bakeryInput,fallbackConcepts(bakeryInput,creativeContext(bakeryInput)),{mode:'deterministic',reason:'demo',model:'None'},'1'.repeat(16));
const laptop=assembleCreativePlan(laptopInput,fallbackConcepts(laptopInput,creativeContext(laptopInput)),{mode:'deterministic',reason:'demo',model:'None'},'2'.repeat(16));
const bakeryRefined=refinePlanComposition(bakery,'Arrange the products diagonally. Leave more negative space for copy.','3'.repeat(16));

const report={
 pathway:[
  'Brand evidence + owner photo facts enter CreativeInput',
  'Director arguments / fallback concepts supply idea + strategy',
  'buildCompositionPlan derives structured spatial dynamics (arrangement, camera, hierarchy, packaging policy)',
  'Selected concept prose is synced from dynamics',
  'adScenePrompt embeds compositionPlanPrompt for Klein ReferenceLatent',
  'Owner refineComposition maps natural language onto concrete dynamics fields'
 ],
 bakery:{dynamics:bakery.dynamics,prompt:adScenePrompt(bakery)},
 bakeryAfterRefinement:{dynamics:bakeryRefined.dynamics,prompt:adScenePrompt(bakeryRefined)},
 laptop:{dynamics:laptop.dynamics,prompt:adScenePrompt(laptop)},
 contrast:{
  bakeryArrangement:bakery.dynamics.product.arrangement,
  laptopArrangement:laptop.dynamics.product.arrangement,
  bakeryEnergy:bakery.dynamics.frame.energy,
  laptopEnergy:laptop.dynamics.frame.energy,
  bakeryPackaging:bakery.dynamics.product.packagingPolicy,
  laptopPackaging:laptop.dynamics.product.packagingPolicy
 }
};
await writeFile(join(out,'plans.json'),JSON.stringify(report,null,2));
console.log('WROTE',join(out,'plans.json'));
console.log('Bakery arrangement:',report.contrast.bakeryArrangement);
console.log('Laptop arrangement:',report.contrast.laptopArrangement);
