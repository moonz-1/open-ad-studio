import type {ImagePalette,WebsiteColor} from './brand.ts';
const neutral=(hex:string)=>{const rgb=hex.slice(1).match(/../g)!.map(c=>parseInt(c,16));return Math.max(...rgb)-Math.min(...rgb)<18&&(Math.max(...rgb)<45||Math.min(...rgb)>225);};
// Declaration/context counts, not a rendered-page or official-brand-color claim.
export function websitePalette(css:string,theme=''):WebsiteColor[]{
 const records=new Map<string,WebsiteColor>();
 const add=(hex:string,context:string)=>{const c=records.get(hex)||{hex,count:0,contexts:[],neutral:neutral(hex)};c.count++;if(!c.contexts.includes(context))c.contexts.push(context);records.set(hex,c);};
 for(const m of css.matchAll(/(?:^|[;{}])\s*([\w-]+)\s*:\s*([^;{}]+)/g)){
  const property=m[1];if(!/^--|color|background|border|fill|stroke|shadow/i.test(property))continue;
  for(const color of m[2].matchAll(/#([a-f0-9]{6}|[a-f0-9]{3})(?![a-f0-9\w-])|rgba?\(\s*(\d{1,3})[, ]+\s*(\d{1,3})[, ]+\s*(\d{1,3})(?:\s*[,/]\s*[\d.]+)?\s*\)/gi)){
   const raw=color[1];if(!raw&&[color[2],color[3],color[4]].some(c=>+c>255))continue;
   const hex='#'+(raw?(raw.length===3?raw.split('').map(c=>c+c).join(''):raw).toLowerCase():[color[2],color[3],color[4]].map(c=>(+c).toString(16).padStart(2,'0')).join(''));add(hex,property.slice(0,80));
  }
 }
 if(/^#(?:[a-f0-9]{6}|[a-f0-9]{3})$/i.test(theme)){const hex=theme.length===4?'#'+theme.slice(1).split('').map(c=>c+c).join(''):theme;add(hex.toLowerCase(),'metadata theme-color');}
 return [...records.values()].sort((a,b)=>Number(a.neutral)-Number(b.neutral)||b.count-a.count||a.hex.localeCompare(b.hex)).slice(0,12);
}
// Quantized local raster statistics. No vision, product mask or segmentation.
export function imagePalette(pixels:Uint8ClampedArray|Uint8Array):ImagePalette{
 if(pixels.length%4)throw Error('Invalid RGBA pixel buffer.');const bins=new Map<string,{n:number;r:number;g:number;b:number}>();let sampledPixels=0;
 const step=Math.max(1,Math.ceil(pixels.length/4/65536));
 for(let i=0;i<pixels.length;i+=4*step){if(pixels[i+3]<128)continue;sampledPixels++;const [r,g,b]=[pixels[i],pixels[i+1],pixels[i+2]],key=[r,g,b].map(v=>v>>5).join(',');const bin=bins.get(key)||{n:0,r:0,g:0,b:0};bin.n++;bin.r+=r;bin.g+=g;bin.b+=b;bins.set(key,bin);}
 const colors=[...bins.values()].sort((a,b)=>b.n-a.n).slice(0,6).map(c=>'#'+[c.r,c.g,c.b].map(v=>Math.round(v/c.n).toString(16).padStart(2,'0')).join(''));
 return {kind:'overall-image',method:'local-rgb-histogram-v1',colors,sampledPixels};
}
