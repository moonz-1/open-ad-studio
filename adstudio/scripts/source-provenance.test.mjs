// Portable gate tests only. No actual ownership assertion or image inference.
import assert from 'node:assert/strict';
import {validateWebsiteSource} from '../../shared/lib/source-provenance.ts';
import {newGenerationDraft,reviewDraft,briefDefaults} from '../../shared/lib/product-brief.ts';
const p={kind:'website',requestedUrl:'https://shop.example.com/product.png',url:'https://cdn.example.com/product.png',pageUrl:'https://shop.example.com/product',pageSha256:'c'.repeat(64),researchPageSha256:'d'.repeat(64),discoveryKey:'abcd1234abcd1234',association:'json-ld',brandId:'brand-1',productId:'product-1',originalSha256:'a'.repeat(64),normalizedSha256:'b'.repeat(64),contentType:'image/png',downloadedAt:1,accuracyConfirmed:false,permissionConfirmed:false};
const expected={originalSha256:p.originalSha256,sha256:p.normalizedSha256,brandId:p.brandId,productId:p.productId};
validateWebsiteSource(p,expected);assert.throws(()=>validateWebsiteSource(p,expected,true),/permission/);
const accepted={...p,accuracyConfirmed:true,permissionConfirmed:true,confirmedAt:2};validateWebsiteSource(accepted,expected,true);
for(const mutate of [p=>p.originalSha256='e'.repeat(64),p=>p.normalizedSha256='e'.repeat(64),p=>p.brandId='other',p=>p.productId='other',p=>p.url='file:///etc/passwd',p=>p.pageSha256='invalid',p=>p.confirmedAt=undefined,p=>p.permissionConfirmed=false,p=>p.association='guessed']){const changed=structuredClone(accepted);mutate(changed);assert.throws(()=>validateWebsiteSource(changed,expected,true));}
const input={version:1,source:{id:'source-1',name:'Input.png',sha256:p.normalizedSha256,originalSha256:p.originalSha256,kind:'original',provenance:p},facts:{description:'Owner test observation.',arrangement:'',texture:'',container:'',confirmed:true},productType:'other',productName:'',notes:'',controls:{...briefDefaults('campaign'),exactCount:false,arrangement:'roughly'}};
assert.throws(()=>reviewDraft(newGenerationDraft(input)),/permission/);input.source.provenance=accepted;reviewDraft(newGenerationDraft(input));
console.log('PASS external-source integrity/association/rights/timestamp gates, original input separate from commercial rights, explicit consent and review blockers. Synthetic attestations only.');
