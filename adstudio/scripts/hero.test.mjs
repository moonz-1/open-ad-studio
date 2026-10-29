import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Resvg} from '@resvg/resvg-js';
import {heroDefaults,heroCrop,heroAdSVG,validateHeroSettings,validateHeroWorkspace} from '../../shared/lib/hero-ad.ts';
import {newProject,migrateProject,Projects,memoryDriver} from '../src/projects.ts';
const s=heroDefaults().settings;
for(const [width,height]of [[1200,1600],[1600,900],[1024,1024]])for(const zoom of [1,1.5])for(const x of [0,1])for(const y of [0,1]){const crop=heroCrop(width,height,{zoom,x,y});assert.ok(crop.x>=0&&crop.y>=0&&crop.x+crop.width<=width&&crop.y+crop.height<=height);assert.ok(Math.abs(crop.width/crop.height-.8)<.002);}
for(const bad of [{...s,strength:1},{...s,zoom:0},{...s,seed:.1},{...s,x:NaN},{...s,direction:'custom filter'}])assert.throws(()=>validateHeroSettings(bad));
const png='data:image/png;base64,AAAA',svg=heroAdSVG(png,png,{headline:'Leave nothing\nbehind.',productName:'Signature cinnamon rolls',website:'example.com'});assert.match(svg,/1080/);assert.ok(svg.includes('preserveAspectRatio="xMidYMid meet"'));assert.throws(()=>heroAdSVG('file:///private.png','',{headline:'Hello',productName:'',website:''}));assert.throws(()=>heroAdSVG(png,'',{headline:'A'.repeat(26),productName:'',website:''}));assert.match(heroAdSVG(png,'',{headline:'<script>',productName:'&',website:'x'}),/&lt;script&gt;/);
for(const version of [1,2,3]){const p={...newProject(),version};delete p.hero;if(version===1){p.outputs=[];delete p.takes;}const migrated=migrateProject(p);assert.deepEqual(migrated.hero,heroDefaults());assert.equal(migrated.staticAds.drafts.length,0);assert.equal(migrated.composition.shots.length,0);}
const repo=new Projects(memoryDriver()),a=newProject('Brand A'),b=newProject('Brand B'),original=new Blob(['UNCHANGED ORIGINAL'],{type:'image/png'});a.hero.settings.sourceId='source';a.hero.settings.headline='Changed copy';await repo.save(a,{id:'source',name:'source',original,normalized:original,width:1,height:1,created:1});await repo.save(b);const restored=await repo.list();assert.equal(restored.find(p=>p.id===a.id).hero.settings.headline,'Changed copy');assert.equal(restored.find(p=>p.id===b.id).hero.settings.headline,s.headline);assert.equal(await(await repo.asset('source')).original.text(),'UNCHANGED ORIGINAL');assert.throws(()=>validateHeroWorkspace({...a.hero,version:2}));assert.throws(()=>migrateProject({...a,hero:{...a.hero,activeId:'lost'}}));
const graph=JSON.parse(await readFile('shared/workflows/hero_zimage_experimental.json','utf8')),fallback=JSON.parse(await readFile('shared/workflows/keyframe_zimage.json','utf8'));assert.equal(graph['7'].class_type,'VAEEncode');assert.equal(graph['7'].inputs.pixels[0],'12');assert.equal(graph['12'].inputs.image[0],'11');assert.equal(graph['11'].class_type,'LoadImage');assert.equal(graph['8'].inputs.latent_image[0],'7');assert.equal(fallback['7'].class_type,'EmptySD3LatentImage');
console.log('PASS hero domain: bounded uniform crops, copy safety, identity review/history validation, v1/2/3 migration, project isolation, original Blob preservation and separate source-conditioned experimental graph. GPU/browser acceptance separate.');
// Real raster regression: transparent logo corners must reveal the photograph,
// never an exporter-invented black square. These are synthetic CPU fixtures.
const data=svg=>'data:image/png;base64,'+new Resvg(svg).render().asPng().toString('base64');
const flat=data('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#eadbc3"/></svg>');
const seal=data('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="26" fill="#000" stroke="#c99055" stroke-width="2"/></svg>');
const copy={headline:'Real product',productName:'',website:''};
const without=new Resvg(heroAdSVG(flat,undefined,copy)).render().pixels,withLogo=new Resvg(heroAdSVG(flat,seal,copy)).render().pixels;
const pixel=(bytes,x,y)=>Array.from(bytes.subarray((y*1080+x)*4,(y*1080+x)*4+4));
assert.deepEqual(pixel(withLogo,850,42),pixel(without,850,42));
assert.notDeepEqual(pixel(withLogo,936,128),pixel(without,936,128));
console.log('PASS real PNG logo-alpha regression: circular seal visible; transparent corners show the photo without black backing.');
