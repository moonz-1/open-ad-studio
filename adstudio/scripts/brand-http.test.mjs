// Live public website + local API test. No AI/model downloads or paid services.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {validateResearch} from '../../shared/lib/brand.ts';
const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8300';
const post=async(route,body)=>{const r=await fetch(base+'/api/brand/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
const provider=await(await fetch(base+'/api/brand/status')).json();assert.equal(typeof provider.available,'boolean');
for(const website of ['', 'file:///etc/passwd','http://127.0.0.1','http://169.254.169.254/latest/meta-data','https://example.com:8080','https://user:password@example.com'])assert.equal((await post('research',{website})).status,400,website);
assert.equal((await post('image',{url:'http://127.0.0.1/secret'})).status,400);
const research=await post('research',{website:'https://www.nocrumbsbakery.store/'});assert.equal(research.status,200,JSON.stringify(research.data));const r=validateResearch(research.data);assert.ok(r.sources.length);assert.ok(r.observations.some(o=>o.field==='name'&&o.kind==='source'));assert.ok(r.products.length);assert.ok(r.images.length);if(!provider.available){assert.equal(r.aiCompleted,false);assert.ok(!r.observations.some(o=>o.kind==='inference'));}
const candidate=r.images.find(i=>/\.(png|jpe?g|webp)(\?|$)/i.test(i.url));assert.ok(candidate);const image=await post('image',{url:candidate.url});assert.equal(image.status,200,JSON.stringify(image.data));assert.match(image.data.image,/^data:image\/(png|jpeg|webp);base64,/);assert.match(image.data.sha256,/^[a-f0-9]{64}$/);
assert.equal((await post('research',{website:candidate.url})).status,422,'non-HTML website input must fail gracefully');
assert.equal((await fetch(base+'/api/brand/status')).status,200,'failed collection must leave the API available');
await mkdir('outputs/brand-demo',{recursive:true});await writeFile('outputs/brand-demo/research.json',JSON.stringify(r,null,2));await writeFile('outputs/brand-demo/http-evidence.json',JSON.stringify({passed:true,testedAt:new Date().toISOString(),provider,sourceHashes:r.sources.map(s=>({url:s.url,sha256:s.sha256})),products:r.products.length,images:r.images.length,colors:r.colors.length,downloadedCandidate:{url:candidate.url,sha256:image.data.sha256},browser:'NOT RUN'},null,2));
console.log('PASS real brand HTTP: actual No Crumbs pages/products/images/colors, public raster collection, private-network/credential/port rejection, honest AI readiness.');
