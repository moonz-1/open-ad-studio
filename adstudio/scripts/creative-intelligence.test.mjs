import assert from 'node:assert/strict';
import {buildCreativeIntelligence,proposeCreativeHooks} from '../../shared/lib/creative-intelligence.ts';
import {planFromReference,planOriginalCampaign} from '../../shared/lib/reference-video.ts';

const basePlan=(overrides={})=>({
 version:1,id:'plan1',projectId:'proj1',created:1,
 input:{
  productType:overrides.productType||'other',
  request:overrides.request||'Launch campaign',
  seed:61,
  brand:{id:'b1',updated:1,dna:{name:'Acme',tone:'calm craft',visualStyle:'mineral light',positioning:'considered goods'}},
  facts:{description:overrides.description||'A glass bottle with blank label',arrangement:'upright',texture:'glass',container:'bottle',confirmed:true},
  source:{id:'s1',sha256:'a'.repeat(64),originalSha256:'b'.repeat(64),kind:'original',name:'p.png'},
  ...overrides.input
 },
 concepts:[{id:'c1',title:'Quiet presence',idea:'Material honesty and calm desire',composition:'hero',environment:'stone',lighting:'soft window'}],
 selectedId:'c1',selectionReason:'test',
 draft:{modelPrompt:'x'},composition:{headline:'Stay',body:'',cta:'',size:'story',concept:'spotlight'},
 context:{facts:{},controls:{fidelity:'recognizable',angle:'keep',crop:'keep',background:'new'}},
 provider:{mode:'deterministic',reason:'test'},layout:{width:1080,height:1350,photoBox:{x:0,y:0,width:1,height:1},textBounds:[],fit:'contain'},
 exportIntent:'png',warnings:[],reviewRequired:true,generationRun:false
});

const food=basePlan({productType:'cookies',description:'Four chocolate chip cookies on walnut',request:'Warm sensory food film'});
const beauty=basePlan({productType:'packaged-goods',description:'Frosted glass serum bottle, blank label',request:'Coastal mineral fragrance atmosphere',input:{productType:'packaged-goods',request:'Coastal mineral fragrance atmosphere soft fabrics'}});
// fix beauty properly
const beautyPlan=basePlan({productType:'other',description:'Frosted glass serum bottle, blank label',request:'Coastal spa beauty atmosphere'});
beautyPlan.concepts[0].idea='Soft mineral light and calm tactile comfort';
beautyPlan.concepts[0].environment='wet stone by turquoise water';

const foodHooks=proposeCreativeHooks(food);
assert.ok(foodHooks.length>=2);
assert.ok(foodHooks.some(h=>h.hook==='sensory-reveal'));
const foodIntel=buildCreativeIntelligence(food);
assert.equal(foodIntel.archetype,'food-editorial');
assert.equal(foodIntel.sensoryLane,'indulgent-food');
assert.ok(foodIntel.factualConstraints.some(c=>/invent/i.test(c)));

const beautyIntel=buildCreativeIntelligence(beautyPlan);
assert.equal(beautyIntel.archetype,'beauty-sensory');
assert.ok(beautyIntel.photographicApproach.length>10);
assert.ok(foodIntel.videoConcept!==beautyIntel.videoConcept||foodIntel.creativeHook!==beautyIntel.creativeHook,'strategies should diverge across categories');

const lotion=basePlan({productType:'other',description:'Matte pump bottle of body lotion, blank label',request:'Comforting soft-fabric spa mood'});
lotion.concepts[0].idea='Calm tactile comfort without clinical claims';
const lotionIntel=buildCreativeIntelligence(lotion);
assert.equal(lotionIntel.sensoryLane,'comfort-care');

// Real acceptance regression: the negative constraint 'no new food' must not turn consideration into a launch.
assert.equal(buildCreativeIntelligence(basePlan({request:'Prioritize consideration and recognition. No new food, props or people.'})).marketingGoal,'consideration');
assert.equal(buildCreativeIntelligence(basePlan({request:'No new food, props or people.'})).marketingGoal,'desire');
const original=planOriginalCampaign(beautyPlan);
assert.ok(original.shots.length>=2,'original plans must be multi-beat');

const analysis={
 version:1,id:'ref1',created:1,sourceUrl:'/outputs/ref-aaaaaaaa.mp4',originalUrl:'/outputs/ref-aaaaaaaa.mp4',bytes:1000,
 duration:8,width:720,height:1280,fps:24,rights:'inspiration-only',
 creativeMechanism:'dramatic-reveal',mechanismConfidence:'observed',
 shots:[
  {index:0,start:0,end:2.5,duration:2.5,purpose:'anticipation',composition:'storefront',camera:{motion:'static',confidence:'observed'},interaction:'none',keyframeUrls:[]},
  {index:1,start:2.5,end:5,duration:2.5,purpose:'reveal',composition:'wipe',camera:{motion:'subtle-move',confidence:'observed'},interaction:'transition',keyframeUrls:[]},
  {index:2,start:5,end:8,duration:3,purpose:'payoff',composition:'overhead',camera:{motion:'static',confidence:'observed'},interaction:'product-array',keyframeUrls:[]}
 ],
 transitions:[{at:2.5,kind:'wipe',confidence:'measured'},{at:5,kind:'cut',confidence:'measured'}],
 pacing:{avgShotSec:2.67,relative:[{index:0,share:0.31},{index:1,share:0.31},{index:2,share:0.38}],note:'measured'},
 visualStyle:{lighting:'natural',graphics:'end card',ending:'brand',confidence:'inferred'},
 transferablePrinciples:['Anticipation','Obscuring transition','Product reveal','Brand payoff'],
 analysisMethod:'test',warnings:[]
};

const shotPlan=planFromReference(food,analysis);
assert.equal(shotPlan.version,1);
assert.ok(shotPlan.shots.length>=2&&shotPlan.shots.length<=3);
assert.equal(shotPlan.rights,'inspiration-only');
assert.match(shotPlan.note,/never be exported|approved campaign still/i);
assert.ok(shotPlan.shots.every(s=>!/No Crumbs|reference frames copied/i.test(s.sceneBrief)));
assert.ok(shotPlan.shots[0].sceneBrief.includes('Acme')||shotPlan.brandName==='Acme');
assert.ok(shotPlan.shots.every(s=>s.startKeyframeStrategy==='hero-still'),'all beats seed from approved campaign still');
assert.equal(shotPlan.shots.at(-1)?.purpose,'payoff');
assert.equal(shotPlan.editing.endingCta,true);
assert.ok(shotPlan.fidelityRequirements.some(r=>/fidelity|Motion may soften/i.test(r)));

assert.equal(shotPlan.shots.length,2);
assert.ok(shotPlan.editing.transition);
assert.equal(original.shots.length,2);
assert.ok(original.shots.every(s=>s.startKeyframeStrategy==='source-still'&&s.execution==='approved-still'),'Default photograph motion uses originals without inference; real LTX is an explicit film mode.');
assert.equal(original.shots.at(-1)?.purpose,'payoff');

console.log('creative-intelligence.test PASS',{foodHook:foodIntel.creativeHook,beautyHook:beautyIntel.creativeHook,lotionLane:lotionIntel.sensoryLane,shotCount:shotPlan.shots.length,originalShots:original.shots.length});
