// CPU renderer regression for the real failure: editorial's full-frame opaque
// rectangle hid an otherwise valid AI support image. No diffusion in this test.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {newBrand} from '../../shared/lib/brand.ts';
import {newStaticDesign} from '../../shared/lib/static-ad.ts';
import {exportStaticAd} from '../../shared/runtime/static-ad.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
import {png} from './creative-fixtures.mjs';
const parent=resolve('outputs'),out=await mkdtemp(join(parent,'klein-compose-cpu-')),brand=newBrand('Authorized synthetic product');
try{
 const support=Buffer.from(new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="640"><rect width="512" height="640" fill="#b9d7df"/><path d="M0 200 L512 430 V640 H0 Z" fill="#927254"/></svg>').render().asPng());await writeFile(join(out,'aaaaaaaaaaaaaaaa.png'),png);await writeFile(join(out,'bbbbbbbbbbbbbbbb.png'),support);
 for(const concept of ['editorial','spotlight','poster'])for(const size of ['feed','story','square']){
  const design={...newStaticDesign(brand,undefined,concept).design,size,photoId:'synthetic-product',photoConfirmed:true,headline:'A quiet moment.',body:'',cta:''},base=await exportStaticAd({design,photo:'/outputs/aaaaaaaaaaaaaaaa.png'},out),ai=await exportStaticAd({design:{...design,supportId:'synthetic-background',supportGeneration:{model:'klein-background',prompt:'MOCK CPU plate',seed:42}},photo:'/outputs/aaaaaaaaaaaaaaaa.png',support:'/outputs/bbbbbbbbbbbbbbbb.png'},out);
  assert.notEqual(base.sha256,ai.sha256,concept+'/'+size+' must display support pixels');assert.equal(ai.sources.photo,heroSha(png));assert.equal(ai.sources.photo,base.sources.photo,'Foreground source unchanged');assert.equal(ai.sources.support,heroSha(support));assert.deepEqual(ai.photoBox,base.photoBox);
 }
 console.log('PASS actual PNG renderer: nine concept/ratio combinations include support pixels while retaining source bytes and framing; no GPU or model output mocked as real.');
}finally{if(!out.startsWith(parent+sep))throw Error('Unsafe cleanup');await rm(out,{recursive:true,force:true});}
