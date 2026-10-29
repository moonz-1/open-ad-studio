// CPU: export boundary must strip director language and never burn QC badges.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {assertExportableCampaignCopy,sanitizeExportDesign} from '../../shared/lib/ad-quality.ts';
import {isInternalAdCopy,consumerCampaignCopy,creativeContext} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {reviewGeneratedCampaign} from '../../shared/lib/creative-visual-review.ts';

const tinyPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('isInternalAdCopy catches the rejected Leave Nothing scene memory',()=>{
 assert.equal(isInternalAdCopy('One mounded cracked cookie in warm window light with open space for Leave Nothing Behind.'),true);
 assert.equal(isInternalAdCopy('Leave Nothing Behind'),false);
 assert.equal(isInternalAdCopy('Worth finishing.'),false);
});

test('sanitizeExportDesign blanks scene-prompt body',()=>{
 const {design,blocked}=sanitizeExportDesign({
  version:1,id:'d',brandId:'b',photoId:'p',photoConfirmed:true,concept:'editorial',size:'feed',
  name:'t',brandName:'No Crumbs Bakery',headline:'Leave Nothing Behind',
  body:'One mounded cracked cookie in warm window light with open space for Leave Nothing Behind.',
  cta:'Taste the real thing',website:'',background:'#14110f',accent:'#9a5528',textColor:'#fffaf0'
 });
 assert.equal(design.body,'');
 assert.ok(blocked.some(b=>/body/i.test(b)));
 assert.equal(design.headline,'Leave Nothing Behind');
});

test('campaignSVG does not burn QC badge text into the SVG',()=>{
 const design={
  version:1,id:'d',brandId:'b',photoId:'p',photoConfirmed:true,concept:'editorial',size:'feed',
  name:'t',brandName:'No Crumbs Bakery',headline:'Leave Nothing Behind',body:'Share the last bite.',
  cta:'Taste the real thing',website:'',background:'#14110f',accent:'#9a5528',textColor:'#fffaf0',
  campaign:{version:1,archetype:'food-editorial',presentation:'composite'}
 };
 // Force basic-draft via empty-ish body still OK but use layout that scores low if needed
 const laid=campaignSVG(design,{photo:tinyPng},1080,1350);
 assert.ok(!/Basic draft/i.test(laid.svg));
 assert.ok(!/not a finished premium/i.test(laid.svg));
 assert.ok(laid.quality);
 assert.ok(!/mounded cracked cookie in warm window/i.test(laid.svg));
});

test('assertExportableCampaignCopy rejects memory body',()=>{
 assert.throws(()=>assertExportableCampaignCopy({
  headline:'Leave Nothing Behind',
  body:'One mounded cracked cookie in warm window light with open space for Leave Nothing Behind.',
  cta:'Taste',brandName:'No Crumbs Bakery'
 }),/rejected at export/i);
});

test('consumerCampaignCopy never returns strategy.memory for No Crumbs',()=>{
 const brand=newBrand('No Crumbs Bakery');
 brand.dna.messaging='Leave Nothing Behind';
 brand.dna.description='No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.';
 brand.assets=[{id:'photo',assetId:'s',name:'x.png',role:'product',productId:'cookie'}];
 brand.products=[{id:'cookie',name:'Chocolate chip cookie',description:'Thick irregular chocolate chip cookie.',sellingPoints:'Made to share — leave nothing behind.',imageIds:['photo']}];
 brand.overrides=['name','description','tone','visualStyle','messaging'];
 const input={
  version:1,projectId:'t',brand,
  source:{id:'s',name:'x.png',kind:'original',sha256:'a'.repeat(64),originalSha256:'b'.repeat(64),width:1,height:1},
  facts:{description:'Thick cookie',count:1,arrangement:'One',texture:'Cracked',container:'None',confirmed:true},
  productType:'cookies',productId:'cookie',request:'Campaign',intent:'campaign',format:'feed',
  constraints:{exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',fidelity:'medium',creativity:'high'}
 };
 const ctx=creativeContext(input);
 const concept={id:'c1',title:'Leave Nothing Behind',idea:'x',composition:'x',camera:'x',environment:'x',lighting:'x',hierarchy:'x',layout:'editorial',copyId:'messaging',evidenceIds:['brand-name'],scores:{impact:3,relevance:3,accuracy:3,feasibility:3},rationale:'x',strategy:{memory:'One mounded cracked cookie in warm window light with open space for Leave Nothing Behind.',feeling:'Warm resolve.',focus:'cookie',objective:'consideration',audienceHypothesis:'a',tension:'t',businessFit:brand.dna.description,opening:'o',payoff:'p',proof:[{id:'brand-description',quote:brand.dna.description}]}};
 const copy=consumerCampaignCopy(input,concept,ctx);
 assert.equal(copy.headline,'Leave Nothing Behind');
 assert.notEqual(copy.body,concept.strategy.memory);
 assert.equal(isInternalAdCopy(copy.body),false);
 const review=reviewGeneratedCampaign({design:{...designStub(copy),campaign:{version:1,archetype:'food-editorial',presentation:'composite'}},ownerRejectedPrior:true});
 assert.equal(['NOT APPROVED','CONDITIONAL','APPROVED_PENDING_OWNER'].includes(review.verdict),true);
 assert.equal(review.approved,false);
});

function designStub(copy){
 return {
  version:1,id:'d',brandId:'b',photoId:'p',photoConfirmed:true,concept:'editorial',size:'feed',
  name:'t',brandName:'No Crumbs Bakery',headline:copy.headline,body:copy.body,cta:copy.cta,website:'',
  background:'#14110f',accent:'#9a5528',textColor:'#fffaf0'
 };
}


test('truthful customer product descriptions remain exportable despite style warnings',()=>{
 assert.doesNotThrow(()=>assertExportableCampaignCopy({headline:'Room for the whole team',body:'Morning Fold sells trays of nine cinnamon rolls for office teams to share during their morning break.',cta:'Discover Morning Fold',brandName:'Morning Fold'}));
});
