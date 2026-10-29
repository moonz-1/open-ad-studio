import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignFilmPlate,filmColors} from '../src/campaign-film-art.ts';
import {assembleCommercial} from '../../shared/runtime/reference-analyze.ts';

test('film palette follows usable brand colors and rejects low contrast or invalid colors',()=>{
 assert.deepEqual(filmColors(['#ffffff','#001020']),{paper:'#ffffff',ink:'#001020'});
 assert.deepEqual(filmColors(['red','url(secret)','#999999','#aaaaaa']),filmColors());
});
test('all original photo edges remain visible throughout motion for portrait, landscape and square inputs',async()=>{
 const previous={Image:globalThis.Image,document:globalThis.document};
 try{
  for(const [w,h] of [[1152,1536],[3000,1000],[1000,3000],[1000,1000]])for(const beat of ['hook','payoff']){
   const draws=[];globalThis.Image=class{naturalWidth=w;naturalHeight=h;async decode(){}};
   const ctx={font:'',fillRect(){},drawImage:(_image,...rect)=>draws.push(rect),measureText(text){return {width:text.length*Number(this.font.match(/(\d+)px/)?.[1]||12)*.55};},fillText(){}};
   globalThis.document={createElement:()=>({getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,test'})};
   await campaignFilmPlate('fixture',{brand:'Business',headline:'A moment to share.',cta:'Discover the collection'},beat);
   const [x,y,pw,ph]=draws[0];assert.ok(Math.abs(pw/ph-w/h)<1e-8,'No stretch');
   for(const zoom of [1,1.06,1.12]){
    const left=360+(x-360)*zoom,top=640+(y-640)*zoom,right=left+pw*zoom,bottom=top+ph*zoom;
    assert.ok(left>=0&&right<=720&&top>=0&&bottom<=1280,'Original remains inside canvas');
    if(beat==='hook')assert.ok(top>=1280*.335,'Photo does not collide with headline');
    else assert.ok(bottom<1280*.65,'Photo does not collide with invitation');
   }
  }
 }finally{Object.assign(globalThis,previous);}
});
test('film assembler rejects remote lettering, arbitrary motion, null shots and oversized duration before spawning',async()=>{
 for(const shot of [null,{kind:'still',motion:'arbitrary-filter'},{kind:'still',overlay:'https://example.test/text.png'},{kind:'still',duration:60}]){
  await assert.rejects(()=>assembleCommercial({shots:[shot]},'outputs',{}),e=>e.status===400);
 }
});
