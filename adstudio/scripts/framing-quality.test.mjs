import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {Resvg} from '@resvg/resvg-js';
import {evaluateFramingQuality,framingBlocksPublish} from '../../shared/lib/framing-quality.ts';
import {reviewGeneratedCampaign} from '../../shared/lib/creative-visual-review.ts';
import {buildProductIdentityProfile} from '../../shared/lib/product-identity-profile.ts';

function png(svg){return Buffer.from(new Resvg(svg).render().asPng());}
const framed=()=>png(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#111"/><rect x="110" y="140" width="180" height="160" rx="12" fill="#d5cfc0"/><rect x="170" y="100" width="60" height="45" rx="4" fill="#ebe6da"/></svg>`);
const clippedRight=()=>png(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#111"/><rect x="250" y="140" width="160" height="170" rx="12" fill="#d5cfc0"/><rect x="300" y="100" width="55" height="45" rx="4" fill="#ebe6da"/></svg>`);
const closeUp=()=>png(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#111"/><rect x="260" y="80" width="160" height="280" rx="10" fill="#d5cfc0"/></svg>`);
const tinyProduct=()=>png(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#1a1f18"/><rect x="170" y="280" width="60" height="70" rx="6" fill="#d5cfc0"/></svg>`);
const fakeShelf=()=>png(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">
 <rect width="400" height="500" fill="#1c241c"/>
 <rect x="145" y="140" width="110" height="200" rx="8" fill="#d5cfc0"/>
 <ellipse cx="200" cy="355" rx="150" ry="12" fill="#000" opacity="0.35"/>
 <rect x="30" y="342" width="340" height="18" fill="#6a7068"/>
</svg>`);

test('fully visible centered product PASSes full-product framing',()=>{
 const report=evaluateFramingQuality(framed(),{framingMode:'full-product'});
 assert.equal(report.verdict,'PASS');
 assert.ok(!report.findings.some(f=>f.code==='PRODUCT_CLIPPED'));
 assert.ok(!report.findings.some(f=>f.code==='PRODUCT_TOO_SMALL'&&f.severity==='block'));
});

test('postage-stamp product FAILs PRODUCT_TOO_SMALL',()=>{
 const report=evaluateFramingQuality(tinyProduct(),{framingMode:'full-product',productScale:'dominant'});
 assert.equal(report.verdict,'FAIL');
 assert.ok(report.findings.some(f=>f.code==='PRODUCT_TOO_SMALL'&&f.severity==='block'));
});

test('unsegmentable full-product frame FAILs (cannot auto-approve)',()=>{
 const blank=png(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#222"/></svg>`);
 const report=evaluateFramingQuality(blank,{framingMode:'full-product'});
 assert.equal(report.verdict,'FAIL');
 assert.ok(report.findings.some(f=>f.code==='WEAK_SEGMENTATION'&&f.severity==='block'));
 assert.equal(framingBlocksPublish(report),true);
});

test('intentional-closeup weak segmentation is soft UNSUPPORTED, not a hard FAIL',()=>{
 const blank=png(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#222"/></svg>`);
 const report=evaluateFramingQuality(blank,{framingMode:'intentional-closeup',intentionalCropRequested:true});
 assert.equal(report.verdict,'UNSUPPORTED');
 assert.ok(report.findings.some(f=>f.code==='WEAK_SEGMENTATION'&&f.severity==='warn'));
 assert.equal(framingBlocksPublish(report),false);
});

test('well-framed full-product still PASSes after weak-seg hardening',()=>{
 const report=evaluateFramingQuality(framed(),{framingMode:'full-product'});
 assert.equal(report.verdict,'PASS');
 assert.equal(framingBlocksPublish(report),false);
});

test('hard synthetic shelf FAILs DISCONNECTED_SUPPORT',()=>{
 const report=evaluateFramingQuality(fakeShelf(),{framingMode:'full-product'});
 assert.equal(report.verdict,'FAIL');
 assert.ok(report.findings.some(f=>f.code==='DISCONNECTED_SUPPORT'));
});

test('product clipped at right edge FAILs full-product framing',()=>{
 const report=evaluateFramingQuality(clippedRight(),{framingMode:'full-product'});
 assert.equal(report.verdict,'FAIL');
 assert.ok(report.findings.some(f=>f.code==='PRODUCT_CLIPPED'&&(f.edge==='right'||!f.edge)||f.code==='INSUFFICIENT_MARGIN'||f.code==='EXTREME_PLACEMENT'));
 assert.equal(report.publishable,false);
});

test('intentional close-up with crop request does not auto-publish',()=>{
 const report=evaluateFramingQuality(closeUp(),{framingMode:'intentional-closeup',intentionalCropRequested:true});
 assert.notEqual(report.verdict,'FAIL');
 assert.equal(report.publishable,false);
});

test('intentional-closeup without brief request FAILs',()=>{
 const report=evaluateFramingQuality(closeUp(),{framingMode:'intentional-closeup',intentionalCropRequested:false});
 assert.equal(report.verdict,'FAIL');
 assert.ok(report.findings.some(f=>f.code==='FRAMING_MODE_MISMATCH'));
});

test('clipped Green Cedar photograph fails framing gate',async()=>{
 let raw;
 try{raw=await readFile('outputs/creative-acceptance/2026-10-29T15-31-40/flux3-green-cedar/flux3-mi2i-raw.png');}
 catch{return;}
 const report=evaluateFramingQuality(raw,{framingMode:'full-product',categoryHint:'fragrance-bottle'});
 assert.equal(report.verdict,'FAIL');
 assert.ok(report.findings.some(f=>['PRODUCT_CLIPPED','INSUFFICIENT_MARGIN','EXTREME_PLACEMENT'].includes(f.code)));
 const review=reviewGeneratedCampaign({
  design:{headline:'A quieter green.',body:'Complex, singular, grounding',cta:'',background:'#1c241c',textColor:'#fffaf0',brandName:'Abel',size:'feed',concept:'editorial'},
  framingQuality:report,
  identityVerify:{verdict:'PASS_PENDING_OWNER',score:5,findings:[],comparisons:{aspectWH:{relDelta:0.01}},publishable:false}
 });
 assert.equal(review.verdict,'NOT APPROVED');
 assert.ok(review.notes.some(n=>/Framing|typography cannot|composition FAIL/i.test(n)));
});

test('identity geometry PASS cannot override framing FAIL',()=>{
 const report=evaluateFramingQuality(clippedRight(),{framingMode:'full-product'});
 const review=reviewGeneratedCampaign({
  design:{headline:'A quieter green.',body:'ok',cta:'',background:'#111',textColor:'#fff',brandName:'Abel',size:'feed',concept:'editorial'},
  framingQuality:report,
  identityVerify:{verdict:'PASS_PENDING_OWNER',score:5,findings:[],comparisons:{aspectWH:{relDelta:0.01}},publishable:false}
 });
 assert.equal(review.verdict,'NOT APPROVED');
});

test('official packshot is fully framed (fixture)',async()=>{
 let pack;
 try{pack=await readFile('outputs/fixtures/abel/green-cedar.png');}
 catch{return;}
 const profile=buildProductIdentityProfile(pack,{kind:'packshot'});
 assert.ok(profile?.geometry.confidence>0.4);
 const report=evaluateFramingQuality(pack,{framingMode:'full-product'});
 assert.notEqual(report.verdict,'FAIL');
 assert.ok(!report.findings.some(f=>f.code==='PRODUCT_CLIPPED'));
});
