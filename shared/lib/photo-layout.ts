import type {NormRect,PhotoLayoutHints,GraphicDirection} from './graphic-art-director.ts';
const anchors=[{id:'upper-left',box:{x:.06,y:.06,width:.42,height:.28}},{id:'upper-right',box:{x:.52,y:.06,width:.42,height:.28}},{id:'center-left',box:{x:.06,y:.28,width:.4,height:.32}},{id:'lower-left',box:{x:.06,y:.62,width:.4,height:.24}},{id:'lower-right',box:{x:.52,y:.62,width:.4,height:.24}}];
/** Centre cover crop, shifted only as far as needed to keep the product box inside the target with margin. */
export function productAwareCover(width:number,height:number,target:{width:number;height:number},productBox?:NormRect){
 const scale=Math.max(target.width/width,target.height/height),sw=width*scale,sh=height*scale;
 let ox=(target.width-sw)/2,oy=(target.height-sh)/2;
 if(productBox&&productBox.width>0&&productBox.height>0){
  const fit=(offset:number,span:number,canvas:number,start:number,size:number)=>{
   if(span<=canvas)return offset;
   const min=canvas-span,p0=start*span,p1=(start+size)*span,margin=canvas*0.08;
   const o=p1-p0<=canvas-2*margin?Math.min(canvas-margin-p1,Math.max(margin-p0,offset)):canvas/2-(p0+p1)/2;
   return Math.max(min,Math.min(0,o));
  };
  ox=fit(ox,sw,target.width,productBox.x,productBox.width);
  oy=fit(oy,sh,target.height,productBox.y,productBox.height);
 }
 return {x:ox,y:oy,width:sw,height:sh,scale};
}
export function photoLayoutHints(width:number,height:number,pixels:Uint8Array|Uint8ClampedArray,target:{width:number;height:number},geometry?:GraphicDirection['geometry']):PhotoLayoutHints{
 const crop=productAwareCover(width,height,target,geometry?.productBox),scale=crop.scale,ox=crop.x,oy=crop.y;
 const project=(r:NormRect|undefined)=>{if(!r)return undefined;const x=Math.max(0,(r.x*width*scale+ox)/target.width),y=Math.max(0,(r.y*height*scale+oy)/target.height),right=Math.min(1,((r.x+r.width)*width*scale+ox)/target.width),bottom=Math.min(1,((r.y+r.height)*height*scale+oy)/target.height);return {x,y,width:Math.max(0,right-x),height:Math.max(0,bottom-y)};};
 const zones=anchors.map(({id,box})=>{const x0=Math.max(0,Math.floor((box.x*target.width-ox)/scale)),x1=Math.min(width,Math.ceil(((box.x+box.width)*target.width-ox)/scale)),y0=Math.max(0,Math.floor((box.y*target.height-oy)/scale)),y1=Math.min(height,Math.ceil(((box.y+box.height)*target.height-oy)/scale)),step=Math.max(1,Math.floor(Math.min(x1-x0,y1-y0)/48));let sum=0,sq=0,n=0;for(let y=y0;y<y1;y+=step)for(let x=x0;x<x1;x+=step){const i=(y*width+x)*4,l=(.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2])/255;sum+=l;sq+=l*l;n++;}const mean=n?sum/n:.5;return {id,box,meanLuma:mean,variance:n?Math.max(0,sq/n-mean*mean):.25};});
 const productBox=project(geometry?.productBox),copySafe=project(geometry?.copySafe);return {...(productBox&&productBox.width&&productBox.height?{productBox}:{}),...(copySafe&&copySafe.width&&copySafe.height?{copySafe}:{}),zones,crop:{x:Math.round(ox),y:Math.round(oy),width:Math.round(crop.width),height:Math.round(crop.height)}};
}
