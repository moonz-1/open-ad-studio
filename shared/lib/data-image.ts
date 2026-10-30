/** Bounded linear-time validation of embedded raster images. Never regex-match a full image. */
const PREFIXES=[['png','data:image/png;base64,'],['jpeg','data:image/jpeg;base64,'],['webp','data:image/webp;base64,']] as const;
export const MAX_DATA_IMAGE_BYTES=10*1024*1024;
const sextet=(c:number)=>c>=65&&c<=90?c-65:c>=97&&c<=122?c-71:c>=48&&c<=57?c+4:c===43?62:c===47?63:-1;
/** Canonical padded base64: complete quartets, terminal padding and zero unused bits. */
export function isBase64(s:string,maxBytes=MAX_DATA_IMAGE_BYTES){
 if(typeof s!=='string'||!s.length||s.length%4||s.length>4*Math.ceil(maxBytes/3))return false;
 const pad=s.endsWith('==')?2:s.endsWith('=')?1:0,end=s.length-pad;
 if(s.length/4*3-pad>maxBytes)return false;
 for(let i=0;i<end;i++)if(sextet(s.charCodeAt(i))<0)return false;
 if(pad===2&&(sextet(s.charCodeAt(end-1))&15)!==0)return false;
 if(pad===1&&(sextet(s.charCodeAt(end-1))&3)!==0)return false;
 return end>0;
}
export function dataImageParts(s:unknown,maxBytes=MAX_DATA_IMAGE_BYTES){
 if(typeof s!=='string')return;
 for(const [type,prefix] of PREFIXES){
  if(!s.startsWith(prefix))continue;
  if(s.length-prefix.length>4*Math.ceil(maxBytes/3))return;
  const encoded=s.slice(prefix.length);
  if(!isBase64(encoded,maxBytes))return;
  return {type,encoded,bytes:encoded.length/4*3-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0)};
 }
}
export const isDataImage=(s:unknown,maxBytes=MAX_DATA_IMAGE_BYTES)=>!!dataImageParts(s,maxBytes);
