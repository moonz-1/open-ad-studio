/** Node-only PNG luminance sampling for Graphic Art Director placement. */
import {inflateSync} from 'node:zlib';
import type {NormRect,PhotoLayoutHints} from './graphic-art-director.ts';
import {photoLayoutHints} from './photo-layout.ts';

export function decodePngRgba(bytes:Uint8Array|Buffer):{width:number;height:number;data:Uint8Array}|null{
 try{
  const buf=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
  if(buf.length<33||!buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return null;
  const width=buf.readUInt32BE(16),height=buf.readUInt32BE(20);
  const bitDepth=buf[24],colorType=buf[25];
  if(bitDepth!==8||width<1||height<1||width>4096||height>4096)return null;
  if(![2,6].includes(colorType))return null;
  const parts:Buffer[]=[];
  let offset=8;
  while(offset+12<=buf.length){
   const len=buf.readUInt32BE(offset);const type=buf.toString('ascii',offset+4,offset+8);
   if(len>buf.length-offset-12)return null;
   const data=buf.subarray(offset+8,offset+8+len);
   if(type==='IDAT')parts.push(Buffer.from(data));
   if(type==='IEND')break;
   offset+=12+len;
  }
  if(!parts.length)return null;
  const bpp=colorType===6?4:3;
  const stride=width*bpp;
  const expected=(stride+1)*height;
  const inflated=inflateSync(Buffer.concat(parts),{maxOutputLength:expected});
  if(inflated.length!==expected)return null;
  const rgba=new Uint8Array(width*height*4);
  let src=0,dst=0;
  const row=new Uint8Array(stride);
  const prev=new Uint8Array(stride);
  for(let y=0;y<height;y++){
   const filter=inflated[src++];if(filter>4)return null;
   for(let i=0;i<stride;i++){
    const x=inflated[src++];
    const left=i>=bpp?row[i-bpp]:0;
    const up=prev[i];
    const upLeft=i>=bpp?prev[i-bpp]:0;
    let val=x;
    if(filter===1)val=(x+left)&255;
    else if(filter===2)val=(x+up)&255;
    else if(filter===3)val=(x+((left+up)>>1))&255;
    else if(filter===4){
     const p=left+up-upLeft;
     const pa=Math.abs(p-left),pb=Math.abs(p-up),pc=Math.abs(p-upLeft);
     const pr=pa<=pb&&pa<=pc?left:pb<=pc?up:upLeft;
     val=(x+pr)&255;
    }
    row[i]=val;
   }
   for(let x=0;x<width;x++){
    const i=x*bpp;
    rgba[dst++]=row[i];rgba[dst++]=row[i+1];rgba[dst++]=row[i+2];rgba[dst++]=bpp===4?row[i+3]:255;
   }
   prev.set(row);
  }
  return {width,height,data:rgba};
 }catch{return null;}
}

export function analyzePhotoZones(bytes:Uint8Array|Buffer,anchors?:{id:string;box:NormRect}[]):NonNullable<PhotoLayoutHints['zones']>|undefined{
 const img=decodePngRgba(bytes);if(!img)return;
 const list=anchors||[
  {id:'upper-left',box:{x:0.06,y:0.06,width:0.42,height:0.28}},
  {id:'upper-right',box:{x:0.52,y:0.06,width:0.42,height:0.28}},
  {id:'center-left',box:{x:0.06,y:0.28,width:0.4,height:0.32}},
  {id:'lower-left',box:{x:0.06,y:0.62,width:0.4,height:0.24}},
  {id:'lower-right',box:{x:0.52,y:0.62,width:0.4,height:0.24}},
 ];
 return list.map(({id,box})=>{
  const x0=Math.floor(box.x*img.width),y0=Math.floor(box.y*img.height);
  const x1=Math.min(img.width,Math.ceil((box.x+box.width)*img.width));
  const y1=Math.min(img.height,Math.ceil((box.y+box.height)*img.height));
  let sum=0,sum2=0,n=0;
  const step=Math.max(1,Math.floor(Math.min(x1-x0,y1-y0)/48));
  for(let y=y0;y<y1;y+=step)for(let x=x0;x<x1;x+=step){
   const i=(y*img.width+x)*4;
   const y601=(0.2126*img.data[i]+0.7152*img.data[i+1]+0.0722*img.data[i+2])/255;
   sum+=y601;sum2+=y601*y601;n++;
  }
  const mean=n?sum/n:0.5;
  const variance=n?Math.max(0,sum2/n-mean*mean):0.25;
  return {id,box,meanLuma:mean,variance};
 });
}

export function hintsFromPngBytes(
 bytes:Uint8Array|Buffer,
 geometry?:{productBox?:NormRect;copySafe?:NormRect},
 target?:{width:number;height:number}
):PhotoLayoutHints{
 const image=target?decodePngRgba(bytes):null;
 if(image&&target)return photoLayoutHints(image.width,image.height,image.data,target,geometry);
 return {
  ...(geometry?.productBox?{productBox:geometry.productBox}:{}),
  ...(geometry?.copySafe?{copySafe:geometry.copySafe}:{}),
  zones:analyzePhotoZones(bytes),
 };
}
