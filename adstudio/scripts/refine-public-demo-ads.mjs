/** Cleaner No Crumbs tray ads for the public demo package — no inference. */
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {campaignDesign} from '../../shared/lib/ad-scene.ts';
import {hintsFromPngBytes} from '../../shared/lib/png-luma.ts';
import {resvgFontOptions} from '../../shared/lib/ad-fonts.ts';

const pack=process.argv[2]||'C:<home>/open-ad-studio-demo-output/public-demo/2026-10-29T20-21-57';
const tray=await readFile('outputs/creative-acceptance/2026-10-28-readiness/previous-cookie-source.png');
const closeup=await readFile('outputs/creative-acceptance/2026-10-28-readiness/cookie-product-reference.png');
const font=resvgFontOptions();

async function one(photoBytes,file,graphic,opts){
  const d=campaignDesign({
    version:1,id:'nc',name:'nc',brandId:'b',brandRevision:1,brandReviewed:true,photoId:'scene',photoConfirmed:true,
    concept:'editorial',size:'feed',brandName:'No Crumbs Bakery',headline:opts.headline||'Leave Nothing Behind',
    body:opts.body||'',cta:opts.cta||'',website:'',background:'#1a1410',accent:'#c4783a',textColor:'#fffaf0'
  },'food-editorial','scene','composite',graphic);
  const hints=hintsFromPngBytes(photoBytes,graphic.geometry);
  const photo='data:image/png;base64,'+photoBytes.toString('base64');
  const laid=campaignSVG(d,{photo},1080,1350,hints);
  const png=Buffer.from(new Resvg(laid.svg,{font}).render().asPng());
  await writeFile(join(pack,'01-public-ads',file),png);
  console.log(JSON.stringify({file,strategy:laid.graphicPlan.strategy,cta:laid.graphicPlan.ctaStyle,brandY:laid.graphicPlan.placement.brand.y,headY:laid.graphicPlan.placement.headline.y,bodyY:laid.graphicPlan.placement.body?.y,ctaY:laid.graphicPlan.placement.cta?.y}));
}

const trayGeo={productBox:{x:0.2,y:0.2,width:0.6,height:0.68},copySafe:{x:0.05,y:0.02,width:0.9,height:0.17}};
await one(tray,'AD-nocrumbs-tray-refined-product.png',{
  strategy:'refined-product',showCta:true,showBody:true,showBrand:true,placement:'upper-left',geometry:trayGeo
},{body:'Meant to be finished.',cta:'Taste the real thing'});
await one(tray,'AD-nocrumbs-tray-headline-only.png',{
  strategy:'refined-product',showCta:false,showBody:false,showBrand:true,placement:'upper-left',geometry:trayGeo
},{body:'',cta:''});
await one(tray,'AD-nocrumbs-tray-playful.png',{
  strategy:'playful-expressive',showCta:true,showBody:false,showBrand:true,placement:'upper-left',geometry:trayGeo
},{body:'',cta:'Get yours'});
await one(closeup,'AD-nocrumbs-closeup-refined-product.png',{
  strategy:'refined-product',showCta:true,showBody:true,showBrand:true,placement:'upper-left',
  geometry:{productBox:{x:0.08,y:0.12,width:0.84,height:0.78},copySafe:{x:0.04,y:0.03,width:0.55,height:0.2}}
},{body:'Share the last bite.',cta:'Taste the real thing'});
console.log('refined',pack);
