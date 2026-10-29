import {Resvg} from '@resvg/resvg-js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {staticSVG,validateStaticDesign,staticSizes,type StaticImages} from '../lib/static-ad.ts';
import {assertExportableCampaignCopy,sanitizeExportDesign} from '../lib/ad-quality.ts';
import {hintsFromPngBytes} from '../lib/png-luma.ts';
import {resvgFontOptions,adFontFiles} from '../lib/ad-fonts.ts';
export class StaticAdError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
let busy=false;
export async function exportStaticAd(body:any,outputs:string){
 let design;try{design=validateStaticDesign(body?.design);}catch(e){throw new StaticAdError(400,(e as Error).message);}
 if(!design.photoConfirmed)throw new StaticAdError(400,'Confirm that this photo depicts the selected product, or choose Photo only.');
 try{assertExportableCampaignCopy(design);}catch(e){throw new StaticAdError(422,(e as Error).message);}
 // Renderer sanitation remains defense in depth; invalid copy cannot be silently exported.
 const sanitized=sanitizeExportDesign(design);
 design=sanitized.design;
 try{assertExportableCampaignCopy(design);}catch(e){throw new StaticAdError(422,(e as Error).message);}
 const sources:Record<string,string>={},images={} as StaticImages;
 let photoBytes:Buffer|undefined;
 for(const key of ['photo','logo','support'] as const){const url=body[key];if(!url&&key!=='photo')continue;if(typeof url!=='string'||!/^\/outputs\/[a-f0-9]{16}\.png$/.test(url))throw new StaticAdError(400,'Choose an API-owned PNG source.');let bytes;try{bytes=await readFile(join(outputs,url.slice(9)));}catch{throw new StaticAdError(404,'A source image is missing. Restore it from the saved original and retry.');}if(bytes.length<24||bytes.length>8*1024*1024||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(16)<1||bytes.readUInt32BE(20)<1||bytes.readUInt32BE(16)>2048||bytes.readUInt32BE(20)>2048)throw new StaticAdError(400,'Invalid PNG source or dimensions.');sources[key]=sha(bytes);images[key]='data:image/png;base64,'+bytes.toString('base64');if(key==='photo')photoBytes=bytes;}
 for(const data of Object.values(images)){try{const decoded=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><image width="32" height="32" href="${data}"/></svg>`,{font:{loadSystemFonts:false}});if(!decoded.getBBox()||!decoded.render().pixels.some((v,i)=>i%4===3&&v>0))throw Error('Missing image');}catch{throw new StaticAdError(422,'A PNG source is empty or could not be decoded. Re-upload a valid image; originals are unchanged.');}}
 const layoutHints=photoBytes&&design.campaign?hintsFromPngBytes(photoBytes,design.campaign.presentation==='editorial-original'?undefined:design.campaign.graphic?.geometry,staticSizes[design.size]):undefined;
 let layout;try{layout=staticSVG(design,images,layoutHints);}catch(e){throw new StaticAdError(400,(e as Error).message);}
 if(busy)throw new StaticAdError(409,'Another static ad is exporting. Please retry.');busy=true;
 try{let png:Buffer;try{const font=resvgFontOptions();const renderer=new Resvg(layout.svg,{font:{...font,loadSystemFonts:true},fitTo:{mode:'original'}});png=renderer.render().asPng();}catch{throw new StaticAdError(422,'The PNG sources could not be rendered. Re-upload valid images; originals are unchanged.');}await mkdir(outputs,{recursive:true});const name=randomBytes(8).toString('hex')+'.png';await writeFile(join(outputs,name),png,{flag:'wx'});const ofl=adFontFiles().length;return {url:'/outputs/'+name,width:layout.width,height:layout.height,sha256:sha(png),sources,recipeSha256:sha(JSON.stringify(design)),renderer:'resvg-2.6.2',font:ofl?`OFL bundled (${ofl} faces) + system fallback`:'system font fallback',graphicPlan:'graphicPlan' in layout?layout.graphicPlan:undefined,photoBox:layout.photoBox,textBounds:layout.textBounds,warnings:[...sanitized.warnings,...(layout.warnings||[])],quality:'quality' in layout?layout.quality:undefined};}finally{busy=false;}
}
