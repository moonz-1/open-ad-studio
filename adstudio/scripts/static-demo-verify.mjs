import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Projects,memoryDriver,migrateProject} from '../src/projects.ts';
import {validateBrand} from '../../shared/lib/brand.ts';
import {staticSizes} from '../../shared/lib/static-ad.ts';
const root='outputs/static-ads-demo',demo=JSON.parse(await readFile(root+'/demo.json','utf8')),evidence=JSON.parse(await readFile(root+'/verification.json','utf8')),project=migrateProject(demo.project),brand=validateBrand(demo.brand),repo=new Projects(memoryDriver()),sha=b=>createHash('sha256').update(b).digest('hex');
const assets=demo.files.map(f=>{const original=new Blob([Buffer.from(f.original.split(',')[1],'base64')]),normalized=f.normalized?new Blob([Buffer.from(f.normalized.split(',')[1],'base64')]):original;return{id:f.assetId,name:f.name,original,normalized,width:f.width,height:f.height,created:1};});
await repo.saveBrand(brand,assets);await repo.save(project,assets);const restored=(await repo.list())[0];assert.equal(restored.staticAds.drafts.length,3);assert.equal(restored.staticAds.exports.length,3);
const photo=brand.assets.find(a=>a.role==='product'),logo=brand.assets.find(a=>a.role==='logo');assert.equal(sha(Buffer.from(await(await repo.asset(photo.assetId)).original.arrayBuffer())),evidence.originalHashes.photo);assert.equal(sha(Buffer.from(await(await repo.asset(logo.assetId)).original.arrayBuffer())),evidence.originalHashes.logo);
for(const e of restored.staticAds.exports){const bytes=Buffer.from(await(await repo.asset(e.assetId)).original.arrayBuffer());assert.equal(sha(bytes),e.sha256);assert.equal(bytes.readUInt32BE(20),staticSizes[e.design.size].height);}
const original=structuredClone(restored.staticAds.exports);restored.staticAds.drafts[0].design.headline='A test revision';await repo.save(restored);assert.deepEqual((await repo.list())[0].staticAds.exports,original,'old export recipes must stay unchanged');
const old=migrateProject(JSON.parse(await readFile('outputs/composer-demo/project.json','utf8')));await repo.save(old);assert.equal((await repo.list()).find(p=>p.id===old.id).composition.exports.length,old.composition.exports.length);
await writeFile(root+'/storage-evidence.json',JSON.stringify({passed:true,originalHashes:evidence.originalHashes,concepts:3,exports:3,oldComposerPreserved:true,driver:'memory domain, not browser IndexedDB',browser:'NOT RUN'},null,2));
console.log('PASS authentic static demo: 3 editable concepts/PNG histories, actual original photo/logo hashes, edits keep prior exports and old Composer project; actual browser persistence NOT RUN.');
