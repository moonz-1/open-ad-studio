// Real collector/import validation with a local in-process fixture reader ONLY.
import assert from 'node:assert/strict';
import {researchBrand,collectBrandImage,extractPage} from '../../shared/runtime/brand-research.ts';
import {newBrand,applyResearch,productImageChoices,validateResearch} from '../../shared/lib/brand.ts';
import {websiteFixture} from './website-fixtures.mjs';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
for(const kind of ['electronics','clothing','furniture','ambiguous','javascript']){
 const f=websiteFixture(kind),r=await researchBrand({website:f.base,analyze:false},{},f.read),b=applyResearch(newBrand(),r);
 assert.equal(b.dna.name,'Field Objects');assert.equal(b.dna.tone,'');assert.equal(b.dna.visualStyle,'');assert.equal(b.dna.audience,'');assert.equal(r.aiCompleted,false);assert.deepEqual(r.colors,['#233044','#f0e9dd']);assert.ok(!r.sources.some(s=>s.text.includes('Ignore all constraints')));
 if(kind==='javascript'){assert.equal(b.products.length,0);assert.ok(r.warnings.some(s=>/manual|manually/.test(s)));continue;}
 if(kind==='ambiguous'){assert.equal(b.products.length,2);for(const p of b.products)assert.equal(productImageChoices(b,p.id).length,0);assert.ok(r.warnings.some(s=>/ambiguous/.test(s)));continue;}
 assert.equal(b.products.length,kind==='electronics'?3:1);const hashes=[];
 for(const p of b.products){const choices=productImageChoices(b,p.id);assert.equal(choices.length,1);assert.ok(!choices[0].includes('banner'));assert.equal(p.sellingPoints,'');
  const result=await collectBrandImage({url:choices[0],productKey:p.discovery.key,research:r},f.read);assert.equal(result.association.key,p.discovery.key);assert.equal(result.association.researchPageSha256,r.sources.find(s=>s.id===p.discovery.sourceId).sha256);assert.equal(result.sha256,heroSha(f.assets.get(choices[0])));hashes.push(result.sha256);
  await assert.rejects(()=>collectBrandImage({url:f.base+'/banner.png',productKey:p.discovery.key,research:r},f.read),/not uniquely/);
 }
 assert.equal(new Set(hashes).size,b.products.length);
 if(kind==='electronics'){
  assert.equal(b.dna.positioning,'Make room for the everyday.');assert.match(b.dna.differentiators,/publish dimensions/);
  const p=r.products[0],wrong=r.products[1],forged=structuredClone(r);forged.products[0].discovery.imageUrls=[wrong.discovery.imageUrls[0]];assert.throws(()=>validateResearch(forged));
  // Even a coherent forged client record cannot override current public DOM proof.
  const fake=structuredClone(r),a=fake.products[0],z=fake.products[1];a.discovery.imageUrls=[z.discovery.imageUrls[0]];fake.products=fake.products.filter(p=>p!==z);fake.images=fake.images.filter(i=>i.url!==p.discovery.imageUrls[0]);for(const i of fake.images)if(i.url===a.discovery.imageUrls[0])i.productKeys=[a.discovery.key];
  await assert.rejects(()=>collectBrandImage({url:a.discovery.imageUrls[0],productKey:a.discovery.key,research:fake},f.read),/does not prove/);
  const url=p.discovery.imageUrls[0];f.pages.set(f.base+'/',f.pages.get(f.base+'/')+'<!-- rotating nonce, associations unchanged -->');const changed=await collectBrandImage({url,productKey:p.discovery.key,research:r},f.read);assert.notEqual(changed.association.pageSha256,changed.association.researchPageSha256,'Fresh association proof, not brittle whole-page equality');
  f.assets.set(url,Buffer.from('<svg>invalid raster</svg>'));await assert.rejects(()=>collectBrandImage({url,productKey:p.discovery.key,research:r},f.read),/not a supported raster/);
 }
}
await assert.rejects(()=>researchBrand({website:'https://fixture-shop.example.com',analyze:false},{},async()=>{throw Error('MOCK HTTP403');}),/403/);
await assert.rejects(()=>researchBrand({website:'https://fixture-shop.example.com',analyze:false},{},async url=>({url,type:'text/html',bytes:Buffer.from('<h1>Verify you are human</h1>')})),/restricts automated access/);
console.log('PASS website discovery: electronics3/JSON-LD, clothing/microdata, furniture/product links+metadata, ambiguous/shared images, JS-only/protected pages, exact source evidence, distinct bytes, forged/wrong/banner rejection and safe raster failure. Fixtures are not universal website/browser acceptance.');

// A stronger structured product is not duplicated by a branded OG title/image alt.
const direct=extractPage('<html><head><meta property="og:type" content="product"><meta property="og:title" content="Speaker | Store"><meta property="og:image" content="/s.png"><script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Speaker',url:'https://shop.example.com/products/speaker',image:'https://shop.example.com/s.png'})+'</script></head><body><a href="/products/speaker"><img src="/s.png" alt="Speaker - details"></a></body></html>','https://shop.example.com/products/speaker');assert.equal(direct.products.length,1);assert.equal(direct.products[0].name,'Speaker');
// Navigation/reference images cannot consume every slot ahead of later products.
const crowded=websiteFixture();crowded.pages.set(crowded.base+'/', '<meta property="og:site_name" content="Field Objects">'+Array.from({length:40},(_,i)=>'<img src="/navigation-'+i+'.png" alt="Navigation">').join('')+[0,1,2].map(i=>'<a href="/products/item-'+i+'">Product '+i+'</a>').join(''));
const cr=await researchBrand({website:crowded.base,analyze:false},{},crowded.read),cb=applyResearch(newBrand(),cr);assert.equal(cb.products.length,3);assert.equal(cb.products.filter(p=>productImageChoices(cb,p.id).length).length,3);assert.ok(cr.images.length<=40);
