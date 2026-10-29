import {photoLayoutHints} from '../../shared/lib/photo-layout.ts';
import {staticSizes,type StaticDesign} from '../../shared/lib/static-ad.ts';
export async function previewGraphicHints(uri:string,design:StaticDesign){
 const image=new Image();image.src=uri;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return undefined;ctx.drawImage(image,0,0);return photoLayoutHints(canvas.width,canvas.height,ctx.getImageData(0,0,canvas.width,canvas.height).data,staticSizes[design.size],design.campaign?.presentation==='editorial-original'?undefined:design.campaign?.graphic?.geometry);
}
