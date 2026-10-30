/** CPU heuristic: detect unwanted scene lettering outside the product packaging zone.
 * Not OCR — high edge energy + high-frequency contrast in the planned open field
 * strongly correlates with FLUX gibberish text / poster lettering. */
import {decodePngRgba} from './png-luma.ts';

export type LetteringScan={
 version:1;
 verdict:'PASS'|'FAIL'|'WARN';
 publishable:boolean;
 openFieldEdgeEnergy:number;
 productEdgeEnergy:number;
 ratio:number;
 findings:Array<{code:string;severity:'block'|'warn';message:string}>;
 method:string;
};

function regionEdgeEnergy(img:{width:number;height:number;data:Uint8Array|Buffer},box:{x:number;y:number;width:number;height:number}){
 const x0=Math.max(0,Math.floor(box.x*img.width));
 const y0=Math.max(0,Math.floor(box.y*img.height));
 const x1=Math.min(img.width-2,Math.ceil((box.x+box.width)*img.width));
 const y1=Math.min(img.height-2,Math.ceil((box.y+box.height)*img.height));
 let sum=0,n=0;
 const luma=(i:number)=>0.2126*img.data[i]+0.7152*img.data[i+1]+0.0722*img.data[i+2];
 for(let y=y0;y<y1;y++){
  for(let x=x0;x<x1;x++){
   const i=(y*img.width+x)*4;
   const dx=Math.abs(luma(i)-luma(i+4));
   const dy=Math.abs(luma(i)-luma(i+img.width*4));
   sum+=dx+dy;n++;
  }
 }
 return n?sum/n:0;
}

/** Text-like tiles outside the measured product: dense high-frequency contrast in both directions,
 * arranged in horizontal runs like lines of type. Wood grain and stone are directional or isolated. */
export function sceneTextSignature(img:{width:number;height:number;data:Uint8Array|Buffer},product:{x:number;y:number;width:number;height:number}){
 const {width:W,height:H,data}=img,tile=Math.max(8,Math.round(W/32)),cols=Math.floor(W/tile),rows=Math.floor(H/tile);
 const L=(x:number,y:number)=>{const i=(y*W+x)*4;return 0.2126*data[i]+0.7152*data[i+1]+0.0722*data[i+2];};
 let tiles=0,runs=0,runTiles=0;
 for(let ty=0;ty<rows;ty++){let run=0;for(let tx=0;tx<=cols;tx++){
  let hit=false;
  if(tx<cols){const cx=(tx+0.5)/cols,cy=(ty+0.5)/rows;
   if(!(cx>product.x-0.02&&cx<product.x+product.width+0.02&&cy>product.y-0.02&&cy<product.y+product.height+0.02)){
    let ex=0,ey=0,n=0;for(let y=ty*tile;y<(ty+1)*tile-1;y++)for(let x=tx*tile;x<(tx+1)*tile-1;x++){ex+=Math.abs(L(x,y)-L(x+1,y));ey+=Math.abs(L(x,y)-L(x,y+1));n++;}
    ex/=n;ey/=n;hit=ex+ey>18&&Math.min(ex,ey)/Math.max(ex,ey,1e-6)>0.45;}}
  if(hit){tiles++;run++;}else{if(run>=3){runs++;runTiles+=run;}run=0;}
 }}
 return {tiles,runs,runTiles,runFraction:runTiles/Math.max(1,rows*cols)};
}

export async function scanPhotographLettering(
 bytes:Buffer,
 opts:{openField:{x:number;y:number;width:number;height:number};productSafe?:{x:number;y:number;width:number;height:number};measuredProduct?:{x:number;y:number;width:number;height:number}}
):Promise<LetteringScan>{
 const findings:LetteringScan['findings']=[];
 const img=decodePngRgba(bytes);
 if(!img)return {version:1,verdict:'WARN',publishable:false,openFieldEdgeEnergy:0,productEdgeEnergy:0,ratio:0,findings:[{code:'LETTER_SCAN_UNAVAILABLE',severity:'warn',message:'PNG decode failed for lettering scan.'}],method:'unavailable'};
 const openE=regionEdgeEnergy(img,opts.openField);
 const prodE=opts.productSafe?regionEdgeEnergy(img,opts.productSafe):Math.max(openE*0.5,1);
 const topBand=regionEdgeEnergy(img,{x:0.05,y:0.02,width:0.9,height:0.18});
 const ratio=prodE>1e-3?openE/prodE:openE;
 const topRatio=prodE>1e-3?topBand/prodE:topBand;
 // Soft materials / bokeh stay low-frequency. Painted gibberish spikes open-field edges,
 // often far above the product zone (Abel prior dual-ad: ~26 edge, ratio ~4).
 if((openE>22&&ratio>1.4)||(openE>26&&ratio>0.75)||(topBand>24&&topRatio>1.2)){
  findings.push({code:'OPEN_FIELD_LETTERING_SUSPECT',severity:'block',message:`Open/top field shows high-frequency structure (open edge ${openE.toFixed(1)} ratio ${ratio.toFixed(2)}; top ${topBand.toFixed(1)}) — likely unwanted scene lettering. Reject before GAD typography.`});
 }else if(opts.measuredProduct&&(()=>{const t=sceneTextSignature(img,opts.measuredProduct);return t.runFraction>0.03;})()){
  findings.push({code:'SCENE_LETTERING_SUSPECT',severity:'block',message:'Lines of text-like marks appear outside the product — likely invented lettering in the photograph. Reject before GAD typography.'});
 }else if(openE>18&&ratio>0.65){
  findings.push({code:'OPEN_FIELD_BUSY',severity:'warn',message:`Open field is busier than expected (edge ${openE.toFixed(1)}). Inspect for gibberish text before export.`});
 }
 const blocked=findings.some(f=>f.severity==='block');
 return {
  version:1,
  verdict:blocked?'FAIL':findings.length?'WARN':'PASS',
  publishable:!blocked,
  openFieldEdgeEnergy:openE,
  productEdgeEnergy:prodE,
  ratio,
  findings,
  method:'Open-field edge-energy heuristic vs product-safe zone; not OCR.',
 };
}
