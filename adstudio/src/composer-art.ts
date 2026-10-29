import type {Composition} from './composition';
export function compositionArt(c:Composition){
 const width=c.width,height=width*16/9,scale=width/1080;
 function canvas(){const el=document.createElement('canvas');el.width=width;el.height=height;return {el,ctx:el.getContext('2d')!};}
 function text(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,size:number,max:number,lines:number,weight=600){
  ctx.font=`${weight} ${size*scale}px Inter, system-ui, sans-serif`;ctx.textBaseline='top';
  const result=[''];for(const char of Array.from(value.replace(/\s+/g,' ').trim())){const i=result.length-1;if(result[i]&&ctx.measureText(result[i]+char).width>max)result.push(char.trimStart());else result[i]+=char;}
  result.slice(0,lines).forEach((line,i)=>ctx.fillText(line,x,y+i*size*scale*1.2,max));
 }
 const body=canvas();const margin=72*scale;
 if(c.brand){body.ctx.fillStyle='rgba(10,12,17,.72)';body.ctx.fillRect(48*scale,48*scale,width-96*scale,110*scale);body.ctx.fillStyle='#fff';text(body.ctx,c.brand,margin,80*scale,34,width-margin*2,1);}
 if(c.headline){const g=body.ctx.createLinearGradient(0,height-440*scale,0,height);g.addColorStop(0,'rgba(10,12,17,0)');g.addColorStop(1,'rgba(10,12,17,.92)');body.ctx.fillStyle=g;body.ctx.fillRect(0,height-440*scale,width,440*scale);body.ctx.fillStyle='#fff';text(body.ctx,c.headline,margin,height-250*scale,52,width-margin*2,3);}
 const end=canvas();end.ctx.fillStyle='#141519';end.ctx.fillRect(0,0,width,height);end.ctx.fillStyle='#a5b5ff';end.ctx.fillRect(margin,260*scale,120*scale,6*scale);
 end.ctx.fillStyle='#fff';text(end.ctx,c.brand,margin,330*scale,42,width-margin*2,2);
 text(end.ctx,c.headline,margin,680*scale,76,width-margin*2,4,500);
 end.ctx.strokeStyle='#a5b5ff';end.ctx.lineWidth=2*scale;end.ctx.strokeRect(margin,height-420*scale,width-margin*2,230*scale);end.ctx.fillStyle='#dce2ff';text(end.ctx,c.cta,margin+36*scale,height-365*scale,42,width-margin*2-72*scale,3);
 return {overlay:body.el.toDataURL('image/png'),closing:end.el.toDataURL('image/png')};
}
