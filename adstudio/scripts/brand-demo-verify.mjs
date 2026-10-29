// Real local assets and Composer project through the storage domain, NOT browser acceptance.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateBrand,brandContext} from '../../shared/lib/brand.ts';
import {Projects,memoryDriver,migrateProject} from '../src/projects.ts';
const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8300',res=await fetch(base+'/api/brand/demo');assert.equal(res.status,200);const demo=await res.json(),brand=structuredClone(validateBrand(demo.brand)),provenance=JSON.parse(await readFile('outputs/brand-demo/provenance.json','utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex'),assets=[];
for(const [index,file]of demo.files.entries()){const bytes=Buffer.from(file.original.split(',')[1],'base64');assert.equal(hash(bytes),provenance.assets[index].sha256);const blob=new Blob([bytes]);assets.push({id:file.assetId,name:file.name,original:blob,normalized:blob,width:1,height:1,created:1});}
const driver=memoryDriver(),store=new Projects(driver),project=migrateProject(JSON.parse(await readFile('outputs/composer-demo/project.json','utf8'))),before=structuredClone(project);
await store.save(project);brand.dna.tone='Test-only user correction';brand.overrides.push('tone');brand.products[0].imageIds=[brand.assets.find(a=>a.role==='product').id];brand.reviewedAt=Date.now();await store.saveBrand(brand,assets);
const refreshed=new Projects(driver),restored=(await refreshed.brands())[0];assert.equal(restored.dna.tone,'Test-only user correction');assert.equal(restored.products[0].imageIds.length,1);assert.equal(brandContext(restored).reviewed,true);
for(const [index,asset]of assets.entries())assert.equal(hash(Buffer.from(await(await refreshed.asset(asset.id)).original.arrayBuffer())),provenance.assets[index].sha256);
const saved=(await refreshed.list())[0];delete saved.updated;delete before.updated;assert.deepEqual(saved,before);
assert.equal(demo.brand.reviewedAt,undefined,'real demo must remain review-required');
await writeFile('outputs/brand-demo/storage-evidence.json',JSON.stringify({passed:true,driver:'memory domain, not actual browser IndexedDB',at:new Date().toISOString(),brandEditRestored:true,photoAssociationRestored:true,originalHashesMatch:true,existingComposerProjectPreserved:true,browser:'NOT RUN',aiInference:'NOT RUN'},null,2));
console.log('PASS authentic local demo: editable brand/photo associations restored, original logo/cookie hashes exact, existing real Composer project/history preserved. Browser refresh remains NOT RUN.');
