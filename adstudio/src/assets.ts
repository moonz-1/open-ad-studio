import type {ProductAsset} from './projects';
import {imagePalette} from '../../shared/lib/brand-colors.ts';
export const blobDataURL=(blob:Blob)=>new Promise<string>((ok,fail)=>{const reader=new FileReader();reader.onload=()=>ok(String(reader.result));reader.onerror=()=>fail(new Error('Could not read the saved product photo.'));reader.readAsDataURL(blob);});
export async function rasterPalette(blob:Blob){const bitmap=await createImageBitmap(blob);try{const c=document.createElement('canvas');c.width=Math.min(192,bitmap.width);c.height=Math.max(1,Math.round(bitmap.height*c.width/bitmap.width));const ctx=c.getContext('2d')!;ctx.drawImage(bitmap,0,0,c.width,c.height);return imagePalette(ctx.getImageData(0,0,c.width,c.height).data);}finally{bitmap.close();}}
export async function normalizeProduct(file:File):Promise<ProductAsset> {
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('Choose a PNG, JPEG or WebP under 10 MB.');
 const bitmap=await createImageBitmap(file);
 try {
  const scale=Math.min(1,1536/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  // Preserve alpha for PNG/WebP packshots so product-safe plates are not forced onto a white studio field.
  // JPEG has no alpha — keep an opaque white plate so compression artifacts do not become transparency.
  const ctx=canvas.getContext('2d',{alpha:true})!;
  if(file.type==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}
  else{ctx.clearRect(0,0,canvas.width,canvas.height);}
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const normalized=await new Promise<Blob>((ok,fail)=>canvas.toBlob(b=>b?ok(b):fail(new Error('Could not prepare this photo.')),'image/png'));
  if(normalized.size>5*1024*1024)throw new Error('Photo is too complex; choose a smaller image.');
  const sample=document.createElement('canvas');sample.width=Math.min(192,canvas.width);sample.height=Math.max(1,Math.round(canvas.height*sample.width/canvas.width));const sampleCtx=sample.getContext('2d')!;sampleCtx.drawImage(bitmap,0,0,sample.width,sample.height);
  return {id:crypto.randomUUID(),name:file.name,original:file,originalWidth:bitmap.width,originalHeight:bitmap.height,normalized,width:canvas.width,height:canvas.height,created:Date.now(),palette:imagePalette(sampleCtx.getImageData(0,0,sample.width,sample.height).data)};
 } finally {bitmap.close();}
}
