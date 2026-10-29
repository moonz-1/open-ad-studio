/** Deterministic customer-facing typography for film end cards (canvas, not LTX).
 * Modified for standalone release: fit all supplied copy; keep sound status in the UI.
 */
export type CampaignFilmCopy={brand:string;headline:string;cta?:string;silent?:boolean;colors?:string[]};

/** Wrap long words as well as sentences, then shrink to fit without dropping copy. */
export function fitText(ctx:CanvasRenderingContext2D,text:string,size:number,width:number,height:number,maxLines:number,weight:number,face:string){
 const words=text.replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
 for(let fontSize=size;fontSize>=6;fontSize--){
  ctx.font=`${weight} ${fontSize}px ${face}`;
  const lines:string[]=[];
  for(const word of words){
   const last=lines.length-1;
   if(last>=0&&ctx.measureText(lines[last]+' '+word).width<=width){lines[last]+=' '+word;continue;}
   let part='';
   for(const char of Array.from(word)){
    if(part&&ctx.measureText(part+char).width>width){lines.push(part);part=char;}else part+=char;
   }
   if(part)lines.push(part);
  }
  const lineHeight=Math.ceil(fontSize*1.25);
  if(lines.length<=maxLines&&lines.length*lineHeight<=height&&lines.every(line=>ctx.measureText(line).width<=width))return {lines,fontSize,lineHeight};
 }
 throw Error('End-card copy exceeds its safe text area. Shorten the copy and try again.');
}

export function campaignFilmEndCard(copy:CampaignFilmCopy,width=720,height=1280){
 const el=document.createElement('canvas');el.width=width;el.height=height;
 const ctx=el.getContext('2d');if(!ctx)throw Error('Canvas is unavailable for the brand end card.');
 const g=ctx.createLinearGradient(0,0,0,height);
 g.addColorStop(0,'#111311');g.addColorStop(1,'#1a1d18');
 ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
 const m=Math.round(width*0.1),maxWidth=width-m*2;
 ctx.fillStyle='#c5d4a8';ctx.fillRect(m,Math.round(height*0.22),Math.round(width*0.14),3);
 ctx.textBaseline='top';
 const draw=(text:string,size:number,y:number,areaHeight:number,maxLines:number,weight:number,face:string,color:string)=>{
  const fitted=fitText(ctx,text,size,maxWidth,areaHeight,maxLines,weight,face);
  ctx.font=`${weight} ${fitted.fontSize}px ${face}`;ctx.fillStyle=color;
  fitted.lines.forEach((line,i)=>ctx.fillText(line,m,y+i*fitted.lineHeight));
 };
 draw((copy.brand||'Brand').toUpperCase(),Math.round(width*0.038),Math.round(height*0.26),height*0.12,3,600,'Inter,system-ui,sans-serif','#f0ede4');
 draw(copy.headline||'',Math.round(width*0.068),Math.round(height*0.42),height*0.24,4,500,'"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif','#f0ede4');
 if(copy.cta)draw(copy.cta,Math.round(width*0.034),Math.round(height*0.72),height*0.12,3,500,'Inter,system-ui,sans-serif','#c5d4a8');
 // Silence, provenance, warnings and internal diagnostics belong in controls/metadata.
 return el.toDataURL('image/png');
}


/** Prefer a legible pair from the saved brand palette; never sacrifice copy contrast. */
export function filmColors(colors:string[]=[]){
 const luminance=(hex:string)=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
 const palette=colors.filter(c=>/^#[a-f0-9]{6}$/i.test(c)).sort((a,b)=>luminance(a)-luminance(b));
 const ink=palette[0]||'#322019',paper=palette.at(-1)||'#f3e8d6';
 return (luminance(paper)+.05)/(luminance(ink)+.05)>=7?{ink,paper}:{ink:'#322019',paper:'#f3e8d6'};
}

/** Source photograph + separate lettering: camera motion never deforms type or product geometry. */
export async function campaignFilmPlate(image:string,copy:CampaignFilmCopy,beat:'hook'|'payoff',width=720,height=1280){
 const photo=new Image();photo.src=image;await photo.decode();
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d')!;
 const overlay=document.createElement('canvas');overlay.width=width;overlay.height=height;
 const ink=overlay.getContext('2d')!;
 const palette=filmColors(copy.colors),dark=beat==='payoff',paper=dark?palette.ink:palette.paper,color=dark?palette.paper:palette.ink;
 ctx.fillStyle=paper;ctx.fillRect(0,0,width,height);
 // Both boxes fit the ENTIRE original photograph. Even at 1.12x zoom every source edge stays inside frame.
 const box=dark?{x:.18,y:.09,w:.64,h:.49}:{x:.10,y:.36,w:.80,h:.53};
 const scale=Math.min(width*box.w/photo.naturalWidth,height*box.h/photo.naturalHeight);
 const w=photo.naturalWidth*scale,h=photo.naturalHeight*scale;
 ctx.drawImage(photo,width*(box.x+box.w/2)-w/2,height*(box.y+box.h/2)-h/2,w,h);
 ink.fillStyle=color;ink.textBaseline='top';
 const draw=(text:string,size:number,y:number,area:number,lines:number,serif=false)=>{
  const face=serif?'Georgia,serif':'Inter,Arial,sans-serif';
  const fitted=fitText(ink,text,size,width*.8,height*area,lines,serif?400:600,face);
  ink.font=`${serif?400:600} ${fitted.fontSize}px ${face}`;
  fitted.lines.forEach((line,i)=>ink.fillText(line,width*.1,height*y+i*fitted.lineHeight));
 };
 if(!dark){
  draw(copy.brand.toUpperCase(),Math.round(width*.025),.075,.045,2);
  draw(copy.headline,Math.round(width*.097),.145,.19,3,true);
 }else{
  draw(copy.cta||copy.headline,Math.round(width*.075),.65,.18,3,true);
  draw(copy.brand.toUpperCase(),Math.round(width*.025),.845,.07,2);
 }
 return {source:canvas.toDataURL('image/png'),overlay:overlay.toDataURL('image/png')};
}

/** Brand signature gets a readable three-second beat; no diagnostics in customer-facing pixels. */
export function campaignFilmSignature(copy:CampaignFilmCopy,width=720,height=1280){
 const el=document.createElement('canvas');el.width=width;el.height=height;const ctx=el.getContext('2d')!;
 const palette=filmColors(copy.colors);ctx.fillStyle=palette.paper;ctx.fillRect(0,0,width,height);ctx.fillStyle=palette.ink;ctx.textBaseline='top';
 const draw=(text:string,size:number,y:number,area:number,lines:number,serif:boolean)=>{
  const face=serif?'Georgia,serif':'Inter,Arial,sans-serif';const f=fitText(ctx,text,size,width*.8,height*area,lines,400,face);
  ctx.font=`400 ${f.fontSize}px ${face}`;f.lines.forEach((line,i)=>ctx.fillText(line,width*.1,height*y+i*f.lineHeight));
 };
 ctx.fillRect(width*.1,height*.25,width*.18,3);
 draw(copy.brand,Math.round(width*.12),.31,.27,3,true);
 draw(copy.cta||copy.headline,Math.round(width*.038),.68,.14,3,false);
 return el.toDataURL('image/png');
}

/** Approved full photograph stays visible through the branded payoff; no blank title card. */
export async function campaignFilmPayoff(image:string,copy:CampaignFilmCopy,width=720,height=1280){
 const photo=new Image();photo.src=image;await photo.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d')!;const palette=filmColors(copy.colors);ctx.fillStyle=palette.ink;ctx.fillRect(0,0,width,height);
 const scale=Math.min(width*.9/photo.naturalWidth,height*.68/photo.naturalHeight),w=photo.naturalWidth*scale,h=photo.naturalHeight*scale;
 ctx.drawImage(photo,(width-w)/2,height*.04+(height*.68-h)/2,w,h);
 ctx.fillStyle=palette.paper;ctx.textBaseline='top';
 for(const [text,size,y,area,lines]of [[copy.brand.toUpperCase(),width*.032,.755,.065,2],[copy.headline,width*.057,.825,.1,2],[copy.cta||'',width*.025,.947,.04,1]] as const){
  if(!text)continue;const face='Inter,Arial,sans-serif',f=fitText(ctx,text,Math.round(size),width*.84,height*area,lines,500,face);
  ctx.font='500 '+f.fontSize+'px '+face;f.lines.forEach((line,i)=>ctx.fillText(line,width*.08,height*y+i*f.lineHeight));
 }
 return canvas.toDataURL('image/png');
}
