// Render two real product-safe advertisements from authorized fixture photographs.
// Uses the live /api/static-ad path on the local Ad Studio server. No AI inference.
import {createHash} from 'node:crypto';
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {newBrand} from '../../shared/lib/brand.ts';
import {newStaticDesign} from '../../shared/lib/static-ad.ts';

const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8301';
const out=resolve('outputs/adstudio-acceptance-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const dataURL=async(path,type)=>'data:'+type+';base64,'+(await readFile(path)).toString('base64');
const post=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(route+' '+r.status+' '+JSON.stringify(data));return data;};

const products=[{
 name:'bakery-cookie-spotlight',
 photo:'outputs/ltx25-benchmark/inputs/cookie.png',
 logo:'outputs/website-logo.png',
 brand:'No Crumbs Bakery',
 colors:['#f3ebe1','#321a12','#9a5528'],
 concept:'spotlight',
 size:'feed',
 headline:'Fresh from the oven.',
 body:'Chocolate chip cookies, ready to share.',
 cta:'Order today',
 website:'nocrumbs.example',
},{
 name:'packaged-cookie-poster',
 photo:'outputs/ltx25-benchmark/inputs/printed-label.png',
 logo:'outputs/website-logo.png',
 brand:'No Crumbs Bakery',
 colors:['#1c1410','#f0e6d8','#c45c2a'],
 concept:'poster',
 size:'story',
 headline:'Wrapped. Ready. Yours.',
 body:'A single cookie, sealed for the road.',
 cta:'Get yours',
 website:'nocrumbs.example',
}];

const results=[];
for(const p of products){
 const photoBytes=await readFile(p.photo),logoBytes=await readFile(p.logo);
 if(photoBytes.length<200_000)throw Error(p.name+': photograph too small to be a real product fixture');
 const brand=newBrand(p.brand);brand.colors=p.colors;brand.website='https://'+p.website+'/';
 brand.assets=[{id:'photo',assetId:'photo-asset',name:'product.png',role:'product'},{id:'logo',assetId:'logo-asset',name:'logo.png',role:'logo'}];
 brand.products=[{id:'sku',name:p.brand+' product',description:p.body,sellingPoints:'',imageIds:['photo']}];
 const draft=newStaticDesign(brand,'sku',p.concept);
 Object.assign(draft.design,{headline:p.headline,body:p.body,cta:p.cta,website:p.website,size:p.size,photoConfirmed:true,brandReviewed:true,photoId:'photo-asset',logoId:'logo-asset'});
 const photo=(await post('upload',{image:await dataURL(p.photo,'image/png')})).url;
 const logo=(await post('upload',{image:await dataURL(p.logo,'image/png')})).url;
 const result=await post('static-ad',{design:draft.design,photo,logo});
 const dest=join(out,p.name+'.png');
 await copyFile(resolve('.'+result.url),dest);
 const exported=await readFile(dest);
 if(exported.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Not a PNG: '+dest);
 if(exported.length<80_000)throw Error('Export too small / likely fixture rectangle: '+dest);
 results.push({name:p.name,path:dest,width:result.width,height:result.height,bytes:exported.length,sha256:sha(exported),photoSha256:sha(photoBytes),concept:p.concept,engine:'product-safe',comfyRequired:false});
 console.log('PASS',p.name,result.width+'x'+result.height,exported.length+' bytes');
}

const page=await fetch(base+'/adstudio/');
const html=await page.text();
const moduleMatch=html.match(/src="([^"]*adstudio[^"]*\.tsx[^"]*)"/)||html.match(/src="(\/adstudio\/src\/[^"]+)"/);
let servedHasGenerate=false,servedHasEngine=false,buildStamp='';
if(moduleMatch){
 const mod=await fetch(new URL(moduleMatch[1],base));
 const src=await mod.text();
 servedHasGenerate=src.includes('Generate ad');
 servedHasEngine=src.includes('engine-select')||src.includes('Generation engine');
}
const stampProbe=await fetch(base+'/adstudio/src/react/app.tsx');
if(stampProbe.ok){const src=await stampProbe.text();servedHasGenerate||=src.includes('Generate ad');servedHasEngine||=src.includes('engine-select');buildStamp=(src.match(/compose-v2|__ADSTUDIO_BUILD__/)||[])[0]||'';}

await writeFile(join(out,'manifest.json'),JSON.stringify({
 createdAt:new Date().toISOString(),
 base,out,results,
 live:{status:page.status,servedHasGenerate,servedHasEngine,buildStamp},
 note:'Real product photographs composed with product-safe layouts. Not AI-generated photography. Not the 96x128 mock rectangle.',
},null,2));
await writeFile(join(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>Ad Studio acceptance ads</title>
<style>body{font:16px/1.5 system-ui;margin:32px;background:#111;color:#eee}img{max-width:360px;height:auto;border:1px solid #333}section{display:flex;gap:24px;flex-wrap:wrap}figure{margin:0}</style>
<h1>Product-safe advertisements · real photographs</h1>
<p>Engine: product-safe · Comfy not required · ${results.length} ads</p>
<section>${results.map(r=>`<figure><img src="${r.name}.png" alt="${r.name}"><figcaption>${r.name}<br>${r.width}×${r.height} · ${r.concept}</figcaption></figure>`).join('')}</section>`);
console.log('EVIDENCE',out);
if(!servedHasGenerate||!servedHasEngine){console.error('LIVE UI MISSING Generate ad / engine selector');process.exitCode=1;}
