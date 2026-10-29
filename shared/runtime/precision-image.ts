import {heroSource} from './hero-ad.ts';
import {Resvg} from '@resvg/resvg-js';
export async function precisionSources(root:string,body:any){
 if(typeof body?.prompt!=='string'||!body.prompt.trim()||body.prompt.length>2000)throw Object.assign(new Error('Describe the selected-area edit in up to 2,000 characters.'),{status:400});
 const image=await heroSource(root,body.image),mask=await heroSource(root,body.mask);
 if(image.width*image.height>768*768||mask.width!==image.width||mask.height!==image.height)throw Object.assign(new Error('Use matching image/mask dimensions, up to 768×768 total pixels.'),{status:400});
 const pixels=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${mask.width}" height="${mask.height}"><image href="${mask.data}" width="${mask.width}" height="${mask.height}"/></svg>`).render().pixels;
 if(!pixels.some((value,index)=>index%4===1&&value>0))throw Object.assign(new Error('Select an area before generating an edit.'),{status:400});
 return {image,mask};
}
