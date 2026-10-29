import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {Resvg} from '@resvg/resvg-js';
import {buildProductIdentityProfile,silhouetteForSpatial,identityConstraintLines} from '../../shared/lib/product-identity-profile.ts';
import {verifyProductIdentity,applyIdentityGateToScorecard,searchFromFluxBBox} from '../../shared/lib/product-identity-verify.ts';
import {dynamicsToFlux3Spatial,defaultHeroCopyBoxes} from '../../shared/lib/flux3-spatial.ts';
import {reviewGeneratedCampaign} from '../../shared/lib/creative-visual-review.ts';

function pngFromSvg(svg){return Buffer.from(new Resvg(svg).render().asPng());}

const squat=()=>pngFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#000"/><rect x="50" y="170" width="300" height="130" rx="16" fill="#d5cfc0"/><rect x="155" y="110" width="90" height="65" rx="6" fill="#ebe6da"/></svg>`);
const tall=()=>pngFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#000"/><rect x="145" y="50" width="110" height="270" rx="16" fill="#d5cfc0"/><rect x="160" y="25" width="80" height="45" rx="6" fill="#ebe6da"/></svg>`);

const bottleDynamics={
 version:1,mode:'static',
 concept:{title:'Cedar',idea:'woody',audienceResponse:'calm',memory:'bottle'},
 product:{subjects:'One frosted Green Cedar perfume bottle',identityAnchors:['trapezoidal bottle','cream cap','GREEN CEDAR label'],count:1,arrangement:'Single bottle',packagingPolicy:'preserve'},
 frame:{heroPlacement:'Asymmetric',depth:'Foreground',negativeSpace:'Open',hierarchy:'Product',energy:'restrained'},
 camera:{viewpoint:'three-quarter',distance:'closer',framing:'open',lensFeel:'still'},
 light:{key:'directional',atmosphere:'woody'},
 brand:{tone:'quiet',flexibility:'strict',constraints:[]},
 supports:{allowed:false,note:''},
 typography:{safeRegion:'left'},
 layout:{
  productSafe:{x:0.24,y:0.40,width:0.52,height:0.48},
  copySafe:{x:0.08,y:0.06,width:0.84,height:0.28},
  placementBias:'lower-center',productScale:'balanced',framingMode:'full-product',
  outputAspect:'feed',lightDirection:'camera-left',balanceNote:'test'
 },
 progression:{beats:[{at:'still',attention:'x',change:'y'}]},
 acceptance:[]
};

test('squat synthetic classifies squat-wide and maps to squat-bottle boxes',()=>{
 const profile=buildProductIdentityProfile(squat(),{kind:'packshot'});
 assert.equal(profile.geometry.silhouetteClass,'squat-wide');
 assert.ok(profile.geometry.aspectWH>1.1);
 assert.equal(silhouetteForSpatial(profile),'squat-bottle');
 const boxes=defaultHeroCopyBoxes('restrained','squat-bottle');
 const [t,l,b,r]=boxes.hero;
 assert.ok((r-l)>(b-t),'squat hero box must be wider than tall');
});

test('bottle subject without identity must NOT default to tall-bottle',()=>{
 const spatial=dynamicsToFlux3Spatial(bottleDynamics,{environment:'cedar set'});
 assert.notEqual(spatial.silhouette,'tall-bottle');
 assert.equal(spatial.identityProfileUsed,false);
});

test('bottle subject WITH squat identity uses squat-bottle and short/broad constraints',()=>{
 const profile=buildProductIdentityProfile(squat(),{kind:'packshot'});
 const spatial=dynamicsToFlux3Spatial(bottleDynamics,{environment:'cedar set',identity:profile});
 assert.equal(spatial.silhouette,'squat-bottle');
 assert.equal(spatial.identityProfileUsed,true);
 assert.match(spatial.directorPrompt,/SHORT and BROAD|short and broad|squat/i);
 assert.match(identityConstraintLines(profile).join(' '),/SHORT and BROAD|wider than tall/i);
 const [t,l,b,r]=spatial.elements.find(e=>e.id==='product_1').bbox;
 assert.ok((r-l)>=(b-t)*0.9,'identity-aware hero should not be a tall portrait slab');
});

test('verifier FAIL on squat→tall distortion',()=>{
 const report=verifyProductIdentity({referenceBytes:squat(),generatedBytes:tall()});
 assert.equal(report.verdict,'FAIL');
 assert.ok(report.findings.some(f=>f.category==='GEOMETRY_MISMATCH'&&f.severity==='block'));
 assert.ok(report.score<4);
});

test('verifier does not PASS when legacy scorecard ignored geometry',()=>{
 const report=verifyProductIdentity({referenceBytes:squat(),generatedBytes:tall()});
 const gated=applyIdentityGateToScorecard({
  scores:{productFidelity:4,brandUnderstanding:5,creativeDirection:4,visualQuality:4,publishability:4},
  pass:true,defects:[]
 },report);
 assert.equal(gated.pass,false);
 assert.ok(gated.scores.productFidelity<4);
});

test('creative review NOT APPROVED on geometry block',()=>{
 const report=verifyProductIdentity({referenceBytes:squat(),generatedBytes:tall()});
 const review=reviewGeneratedCampaign({
  design:{
   version:1,id:'d',name:'t',brandId:'b',brandRevision:1,brandReviewed:true,photoId:'p',photoConfirmed:true,
   concept:'editorial',size:'feed',brandName:'Abel',headline:'A quieter green.',body:'x',cta:'',website:'',
   background:'#111',accent:'#333',textColor:'#fff'
  },
  identityVerify:report
 });
 assert.equal(review.verdict,'NOT APPROVED');
});

test('Green Cedar real packshot is squat-wide; prior gen fails identity gate',async()=>{
 let ref,gen,plan;
 try{
  ref=await readFile('outputs/fixtures/abel/green-cedar.png');
  gen=await readFile('outputs/creative-acceptance/2026-10-29T13-57-37/flux3-green-cedar/flux3-mi2i-raw.png');
  plan=JSON.parse(await readFile('outputs/creative-acceptance/2026-10-29T13-57-37/flux3-green-cedar/plan.json','utf8'));
 }catch{return;}
 const profile=buildProductIdentityProfile(ref,{kind:'packshot'});
 assert.ok(profile.geometry.silhouetteClass==='squat-wide'||(profile.geometry.bodyAspectWH??profile.geometry.aspectWH)>1.1);
 assert.ok((profile.geometry.bodyAspectWH??profile.geometry.aspectWH)>1.05);
 const bbox=plan.spatial?.elements?.find(e=>e.id==='product_1')?.bbox;
 const report=verifyProductIdentity({
  referenceBytes:ref,generatedBytes:gen,
  generatedSearch:searchFromFluxBBox(bbox),
  categoryHint:'fragrance'
 });
 assert.equal(report.verdict,'FAIL');
 assert.ok(report.findings.some(f=>f.category==='GEOMETRY_MISMATCH'));
 const spatial=dynamicsToFlux3Spatial(plan.dynamics,{identity:profile,environment:'cedar'});
 assert.equal(spatial.silhouette,'squat-bottle');
 assert.notDeepEqual(spatial.elements.find(e=>e.id==='product_1').bbox,[260,400,900,820]);
});
