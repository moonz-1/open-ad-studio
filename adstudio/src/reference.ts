export type Framing = 'fit' | 'crop';

/** Prepare a guide at the output ratio; the shared workflow remains unchanged. */
export async function prepareReference(image: string, width: number, height: number, framing: Framing): Promise<string> {
  const source = new Image();
  source.src = image;
  await source.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (framing === 'crop') {
    // Subject-preserving cover: fill the target ratio, center-crop overflow. No letterbox bars.
    const scale = Math.max(width / source.naturalWidth, height / source.naturalHeight);
    const w = Math.round(source.naturalWidth * scale), h = Math.round(source.naturalHeight * scale);
    ctx.drawImage(source, Math.floor((width - w) / 2), Math.floor((height - h) / 2), w, h);
    return canvas.toDataURL('image/png');
  }
  ctx.fillStyle = '#16171b';
  ctx.fillRect(0, 0, width, height);
  const scale = Math.min(width / source.naturalWidth, height / source.naturalHeight);
  const w = Math.round(source.naturalWidth * scale), h = Math.round(source.naturalHeight * scale);
  ctx.drawImage(source, Math.floor((width - w) / 2), Math.floor((height - h) / 2), w, h);
  return canvas.toDataURL('image/png');
}

/** Controlled alternate guide: existing approved pixels only, no generated geometry. */
export async function prepareCampaignKeyframe(image:string,width:number,height:number,framing:'detail'|'full'){
 if(framing==='full')return prepareReference(image,width,height,'fit');
 const source=new Image();source.src=image;await source.decode();
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d')!;
 const scale=Math.max(width/source.naturalWidth,height/source.naturalHeight)*1.24;
 const w=source.naturalWidth*scale,h=source.naturalHeight*scale;
 ctx.drawImage(source,(width-w)/2,(height-h)/2,w,h);
 return canvas.toDataURL('image/png');
}
