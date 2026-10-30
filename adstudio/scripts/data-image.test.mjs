import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Resvg} from '@resvg/resvg-js';
import {dataImageParts,isDataImage,isBase64} from '../../shared/lib/data-image.ts';
import {staticSVG} from '../../shared/lib/static-ad.ts';
import {inputFixture} from './creative-fixtures.mjs';
import {detailedPng} from './image-fixture.mjs';
test('linear parser validates complete large decodable PNG and SVG composition',()=>{
 const bytes=detailedPng(),url='data:image/png;base64,'+bytes.toString('base64');assert.ok(url.length>4*1024*1024);assert.equal(dataImageParts(url).bytes,bytes.length);assert.equal(isDataImage(url),true);
 const design=inputFixture();const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><image href="${url}" width="32" height="32"/></svg>`;assert.equal(new Resvg(svg).render().width,32);
});
test('strict canonical base64, MIME and bounded decoded sizes',()=>{
 for(const x of ['','A','AA','AAA','A===','AA=A','AAAA=','AA==AAAA','AB==','AAB=','AAAA\n','AAAA ','AAAA%','===='])assert.equal(isBase64(x),false,x);
 for(const x of ['AA==','AAA=','AAAA','aGVsbG8='])assert.equal(isBase64(x),true,x);
 for(const type of ['svg+xml','gif','html'])assert.equal(isDataImage('data:image/'+type+';base64,AAAA'),false);
 assert.equal(isDataImage('data:image/png;base64,AAAA',2),false);assert.equal(isDataImage('data:image/png;base64,AAAA',3),true);
 assert.equal(isDataImage('data:image/png;base64,'+'A'.repeat(4*1024*1024),1024),false);
 assert.equal(isDataImage(null),false);assert.equal(isDataImage({}),false);
});
