import {assertConsumerCopy} from './consumer-copy.ts';
import {campaignSVG} from './campaign-ad.ts';
import {brandContext,advertisingColors,type BrandProfile} from './brand.ts';
import {createHistory,validHistory,type HistoryTree} from './edit-history-tree.ts';
import {validateGraphicDirection,type GraphicDirection,type PhotoLayoutHints} from './graphic-art-director.ts';
import {isDataImage} from './data-image.ts';
export const staticConcepts=[{id:'spotlight',name:'Product spotlight',description:'A generous product frame, clear headline and quiet brand details.'},{id:'editorial',name:'Editorial split',description:'Bold copy beside a tall product photograph.'},{id:'poster',name:'Brand poster',description:'A strong brand masthead, framed photograph and direct invitation.'}] as const;
export type StaticConcept=typeof staticConcepts[number]['id'];
export const staticSizes={feed:{width:1080,height:1350,label:'Feed · 4:5'},story:{width:1080,height:1920,label:'Story · 9:16'},square:{width:1080,height:1080,label:'Square · 1:1'}};
export type StaticDesign={copyInternalTexts?:string[];copyEvidence?:string[];campaign?:{version:1;archetype:import('./ad-scene.ts').CampaignArchetype;presentation?:import('./ad-scene.ts').CampaignSurfacePresentation;graphic?:GraphicDirection};version:1;id:string;name:string;brandId:string;brandRevision:number;brandReviewed:boolean;productId?:string;photoId:string;photoConfirmed:boolean;logoId?:string;supportId?:string;supportGeneration?:{model:string;prompt:string;seed:number};concept:StaticConcept;size:keyof typeof staticSizes;brandName:string;productLine?:string;headline:string;body:string;cta:string;website:string;background:string;accent:string;textColor:string};
export type StaticDraft={design:StaticDesign;history:HistoryTree<StaticDesign>};
export type StaticExport={id:string;assetId:string;url:string;created:number;design:StaticDesign;sha256:string;sources:Record<string,string>};
export type StaticWorkspace={version:1;activeId?:string;drafts:StaticDraft[];exports:StaticExport[]};
export const emptyStaticAds=():StaticWorkspace=>({version:1,drafts:[],exports:[]});
export function luminance(color:string){const a=color.slice(1).match(/../g)!.map(s=>parseInt(s,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722;}
export const ink=(background:string)=>luminance(background)>.35?'#100b08':'#fffaf0';
export function contrast(a:string,b:string){const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);}
function mix(a:string,b:string,t:number){const parse=(c:string)=>c.slice(1).match(/../g)!.map(s=>parseInt(s,16));const A=parse(a),B=parse(b);return '#'+[0,1,2].map(i=>Math.round(A[i]+(B[i]-A[i])*t).toString(16).padStart(2,'0')).join('');}
export function newStaticDesign(brand:BrandProfile,productId?:string,concept:StaticConcept='spotlight'):StaticDraft{
 const context=brandContext(brand,productId?[productId]:[]),product=brand.products.find(p=>p.id===productId),photo=brand.assets.find(a=>product?.imageIds.includes(a.id))||brand.assets.find(a=>a.role==='product')||brand.assets.find(a=>a.role==='reference');
 const colors=advertisingColors(brand);
 const background=concept==='spotlight'?(colors.find(c=>luminance(c)>.55)||(brand.palette?colors[0]:undefined)||'#f3ebe1'):concept==='editorial'?(colors.find(c=>luminance(c)<.12)||(brand.palette?colors[0]:undefined)||'#12100e'):(colors.find(c=>luminance(c)>.12&&luminance(c)<.45)||(brand.palette?(colors[1]||colors[0]):undefined)||'#7a3f1d');
 const design:StaticDesign={version:1,id:crypto.randomUUID(),name:staticConcepts.find(c=>c.id===concept)!.name,brandId:brand.id,brandRevision:context.revision,brandReviewed:context.reviewed,productId:product?.id,photoId:photo?.assetId||'',photoConfirmed:!product||Boolean(photo&&product.imageIds.includes(photo.id)),logoId:brand.assets.find(a=>a.role==='logo')?.assetId,concept,size:'feed',brandName:brand.dna.name.slice(0,60),headline:product?.name.slice(0,80)||'Explore the collection',body:'',cta:'Discover more',website:brand.website?new URL(brand.website).hostname.replace(/^www\./,''):'',background,accent:colors.find(c=>luminance(c)>.08&&luminance(c)<.55)||(brand.palette?(colors[1]||colors[0]):undefined)||'#9a5528',textColor:(brand.palette?colors.find(c=>contrast(c,background)>=4.5):undefined)||ink(background)};
 return {design,history:createHistory(design)};
}
export function validateStaticDesign(value:unknown):StaticDesign{const d=value as StaticDesign,fail=()=>{throw Error('Invalid static ad. Your previous concepts and exports were kept.');};if(!d||d.version!==1||typeof d.id!=='string'||!d.id||typeof d.brandId!=='string'||typeof d.photoId!=='string'||typeof d.photoConfirmed!=='boolean'||!staticConcepts.some(c=>c.id===d.concept)||!Object.hasOwn(staticSizes,d.size))return fail();for(const [key,max]of [['name',80],['brandName',60],['headline',80],['body',180],['cta',48],['website',80]] as const)if(typeof d[key]!=='string'||d[key].length>max)return fail();if(d.productLine!==undefined&&(typeof d.productLine!=='string'||d.productLine.length>60))return fail();for(const color of [d.background,d.accent,d.textColor])if(!/^#[a-f0-9]{6}$/i.test(color))return fail();for(const key of ['logoId','supportId','productId'] as const)if(d[key]!==undefined&&typeof d[key]!=='string')return fail();if(d.copyInternalTexts!==undefined&&(!Array.isArray(d.copyInternalTexts)||d.copyInternalTexts.length>20||d.copyInternalTexts.some(v=>typeof v!=='string'||v.length>2000)))return fail();if(d.copyEvidence!==undefined&&(!Array.isArray(d.copyEvidence)||d.copyEvidence.length>30||d.copyEvidence.some(v=>typeof v!=='string'||v.length>1500)))return fail();if(d.campaign&& (d.campaign.version!==1||!['food-editorial','beauty-sensory','graphic-energy','material-study'].includes(d.campaign.archetype)||(d.campaign.presentation!==undefined&&!['composite','editorial-original'].includes(d.campaign.presentation))))return fail();
 if(d.campaign?.graphic!==undefined){try{d.campaign.graphic=validateGraphicDirection(d.campaign.graphic);}catch{return fail();}}
 return d;}
export function validateStaticWorkspace(value:unknown):StaticWorkspace{const w=value as StaticWorkspace;if(!w||w.version!==1||!Array.isArray(w.drafts)||w.drafts.length>100||!Array.isArray(w.exports)||w.exports.length>300)throw Error('Invalid saved static-ad workspace. Existing projects were not overwritten.');const ids=new Set<string>();for(const draft of w.drafts){validateStaticDesign(draft.design);if(ids.has(draft.design.id)||!validHistory(draft.history))throw Error('Invalid static ad history.');ids.add(draft.design.id);for(const node of draft.history.nodes)validateStaticDesign(node.state);}if(w.activeId&&!ids.has(w.activeId))throw Error('Missing active ad concept.');for(const e of w.exports){if(!e||!/^\/outputs\/[a-f0-9]{16}\.png$/.test(e.url)||typeof e.assetId!=='string'||! /^[a-f0-9]{64}$/.test(e.sha256))throw Error('Invalid static export history.');validateStaticDesign(e.design);}return w;}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const estimate=(s:string,size:number)=>Array.from(s).reduce((n,c)=>n+((c.codePointAt(0)||0)>0x2fff?1.05:/[MW@%]/.test(c)?1:/[mw]/.test(c)?.86:/[ilI.,'!| ]/.test(c)?.3:/[\p{Lu}0-9]/u.test(c)?.79:/[frt]/.test(c)?.4:.6)*size,0);
function wrapped(value:string,width:number,size:number){const lines:string[]=[];let line='';for(const word of value.trim().split(/\s+/)){if(!word)continue;if(estimate(line+(line?' ':'')+word,size)<=width)line+=(line?' ':'')+word;else{if(line)lines.push(line);line='';for(const c of Array.from(word)){if(estimate(line+c,size)>width&&line){lines.push(line);line='';}line+=c;}}}if(line)lines.push(line);return lines;}
export type StaticImages={photo:string;logo?:string;support?:string};
export function staticSVG(d:StaticDesign,images:StaticImages,layoutHints?:PhotoLayoutHints){
 validateStaticDesign(d);assertConsumerCopy(d,{approvedClaims:d.copyEvidence,internalTexts:d.copyInternalTexts});const {width:w,height:h}=staticSizes[d.size];if(d.campaign)return campaignSVG(d,images,w,h,layoutHints);const parts:string[]=[],textBounds:{text:string;x:number;y:number;width:number;height:number;fontSize:number}[]=[],warnings:string[]=[];
 const soft=mix(d.background,d.textColor,luminance(d.background)>.4?.08:.18),panel=mix(d.background,ink(d.background)==='#100b08'?'#ffffff':'#000000',luminance(d.background)>.4?.55:.22);
 const rect=(x:number,y:number,width:number,height:number,fill:string,extra='')=>parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${extra}/>`);
 const image=(data:string|undefined,x:number,y:number,width:number,height:number,fit='xMidYMid meet')=>{if(data){if(!isDataImage(data))throw Error('Only embedded local raster images are supported.');parts.push(`<image href="${data}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${fit}"/>`);}};
 const text=(value:string,x:number,y:number,width:number,height:number,initial:number,color=d.textColor,weight=400)=>{if(!value.trim())return;let size=initial,lines=wrapped(value,width,size);while((lines.length*size*1.18>height||lines.some(l=>estimate(l,size)>width))&&size>18){size-=2;lines=wrapped(value,width,size);}if(lines.length*size*1.18>height)throw Error('Text is too long for this layout. Shorten it or choose another concept.');if(size<initial*.72)warnings.push('Some text was reduced to fit. Check legibility at phone size.');textBounds.push({text:value,x,y,width,height:lines.length*size*1.18,fontSize:size});parts.push(`<text fill="${color}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="${weight>=700?-0.4:0}">${lines.map((line,i)=>`<tspan x="${x}" y="${y+size*.82+i*size*1.18}">${escape(line)}</tspan>`).join('')}</text>`);};
 const button=(x:number,y:number,width:number)=>{rect(x,y,width,72,d.accent);text(d.cta,x+28,y+16,width-56,42,30,ink(d.accent),700);};
 // Full-bleed atmosphere: soft vertical wash, never a flat debug fill.
 parts.push(`<defs><linearGradient id="osh-wash" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${escape(mix(d.background,d.accent,.12))}"/><stop offset="55%" stop-color="${escape(d.background)}"/><stop offset="100%" stop-color="${escape(soft)}"/></linearGradient></defs>`);
 rect(0,0,w,h,'url(#osh-wash)');if(images.support){image(images.support,0,0,w,h,'xMidYMid slice');rect(0,0,w,h,d.background,d.supportGeneration?'opacity="0.22"':'opacity="0.82"');}
 let photoBox:{x:number;y:number;width:number;height:number};const m=72,square=h===1080,story=h===1920;
 if(d.concept==='spotlight'){
  // Premium editorial spotlight: brand lockup, dominant photo stage, grounded CTA.
  rect(0,0,w,10,d.accent);
  parts.push(`<circle cx="${w-140}" cy="120" r="220" fill="${escape(mix(d.accent,d.background,.55))}" opacity="0.28"/>`);
  text(d.brandName.toUpperCase(),m,52,w-280,36,20,mix(d.textColor,d.background,.2),700);
  image(images.logo,w-188,36,116,110);
  text(d.headline,m,story?148:124,w-2*m,story?210:176,story?66:60,d.textColor,700);
  photoBox={x:m,y:square?292:story?372:328,width:w-2*m,height:h-(square?508:story?688:588)};
  rect(photoBox.x+18,photoBox.y+22,photoBox.width,photoBox.height,mix(d.background,'#000000',.12),'opacity="0.35"');
  rect(photoBox.x,photoBox.y,photoBox.width,photoBox.height,panel);
  rect(photoBox.x+4,photoBox.y+4,photoBox.width-8,photoBox.height-8,mix(d.background,'#ffffff',luminance(d.background)>.4?.42:.1));
  image(images.photo,photoBox.x+32,photoBox.y+32,photoBox.width-64,photoBox.height-64,'xMidYMid slice');
  text(d.body,m,h-(story?228:204),w-2*m,56,24);if(d.cta)button(m,h-124,Math.min(520,Math.max(280,estimate(d.cta,30)+72)));
  text(d.website,w-380,h-100,300,40,22,mix(d.textColor,d.background,.35),500);
 }else if(d.concept==='editorial'){
  // Bold split: copy column + tall photograph, strong accent rule.
  rect(0,0,22,h,d.accent);
  parts.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="${escape(mix(d.background,d.accent,.06))}" opacity="${images.support&&d.supportGeneration?.model==='klein-background'?0.55:1}"/>`);
  image(images.logo,m,44,148,140);text(d.brandName.toUpperCase(),248,86,700,40,18,mix(d.textColor,d.background,.18),700);
  const top=232,bottom=h-208;photoBox={x:500,y:top,width:w-500-m,height:bottom-top};
  rect(photoBox.x+12,photoBox.y+16,photoBox.width,photoBox.height,mix(d.background,'#000000',.2),'opacity="0.4"');
  rect(photoBox.x,photoBox.y,photoBox.width,photoBox.height,mix(d.background,d.accent,.1));
  image(images.photo,photoBox.x+20,photoBox.y+20,photoBox.width-40,photoBox.height-40,'xMidYMid slice');
  text(d.headline,m,top+12,392,square?250:348,square?46:54,d.textColor,700);
  text(d.body,m,top+(square?292:392),392,Math.max(64,bottom-top-(square?292:392)),26);
  rect(m,h-176,Math.min(420,w/2),4,d.accent);if(d.cta)button(m,h-128,Math.min(560,Math.max(280,estimate(d.cta,30)+72)));
  text(d.website,w-360,h-96,280,36,22,mix(d.textColor,d.background,.35),500);
 }else{
  // Brand poster: photographic stage with masthead band and invitation footing.
  photoBox={x:0,y:square?150:story?180:160,width:w,height:h-(square?430:story?540:480)};
  image(images.photo,photoBox.x,photoBox.y,photoBox.width,photoBox.height,'xMidYMid slice');
  parts.push(`<defs><linearGradient id="osh-poster-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${escape(mix(d.background,d.accent,.28))}" stop-opacity="0.96"/><stop offset="100%" stop-color="${escape(d.background)}" stop-opacity="0"/></linearGradient><linearGradient id="osh-poster-bot" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${escape(d.background)}" stop-opacity="0"/><stop offset="55%" stop-color="${escape(mix(d.background,'#000000',luminance(d.background)>.4?.08:.35))}" stop-opacity="0.88"/><stop offset="100%" stop-color="${escape(mix(d.background,'#000000',luminance(d.background)>.4?.12:.45))}" stop-opacity="0.96"/></linearGradient></defs>`);
  rect(0,0,w,square?180:story?210:190,'url(#osh-poster-top)');
  rect(0,h-(square?360:story?460:400),w,square?360:story?460:400,'url(#osh-poster-bot)');
  image(images.logo,m,36,132,120);text(d.brandName.toUpperCase(),220,58,w-300,80,28,d.textColor,700);
  text(d.headline,m,h-(square?250:story?310:290),w-2*m,square?100:140,square?44:54,d.textColor,700);
  text(d.body,m,h-176,w-2*m,48,24);if(d.cta)button(m,h-116,Math.min(500,Math.max(260,estimate(d.cta,30)+72)));
  text(d.website,w-360,h-90,280,36,22,mix(d.textColor,d.background,.28),500);
 }
 if(contrast(d.background,d.textColor)<4.5)warnings.push('Text/background contrast is below 4.5:1. Adjust colors before publishing.');
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`,width:w,height:h,photoBox,textBounds,warnings};
}
