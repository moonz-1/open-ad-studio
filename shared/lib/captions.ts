export type CaptionSegment={start:number;end:number;text:string};
export function captionSegments(value:unknown,max=600):CaptionSegment[]{
 if(!Array.isArray(value))throw Error('The transcription did not return caption segments.');
 return value.slice(0,500).filter((s:any)=>Number.isFinite(s?.start)&&Number.isFinite(s?.end)&&s.end>s.start&&s.start>=0&&s.start<max&&typeof s.text==='string'&&s.text.trim()).map((s:any)=>({start:s.start,end:Math.min(max,s.end),text:s.text.trim().slice(0,500)}));
}
export function captionSrt(segments:CaptionSegment[]):string{
 const time=(seconds:number)=>{const ms=Math.round(seconds*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`};
 return segments.map((s,i)=>`${i+1}\n${time(s.start)} --> ${time(s.end)}\n${s.text.replaceAll('-->','→')}`).join('\n\n')+'\n';
}

/** Parse editable SRT cues without silently dropping malformed blocks. */
export function parseCaptionSrt(input:string):CaptionSegment[]{
 if(input.length>2_000_000)throw Error('This SRT is too large.');
 const blocks=input.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim().split(/\n[ \t]*\n/);if(blocks.length>500)throw Error('This SRT has more than 500 captions.');
 const time=(value:string)=>{const match=value.match(/^(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})$/);if(!match)throw Error('Use SRT timestamps: 00:00:00,000.');return +match[1]*3600 + +match[2]*60 + +match[3] + +match[4]/1000};
 return blocks.map((block,index)=>{const lines=block.split('\n');if(/^\d+$/.test(lines[0].trim()))lines.shift();const range=lines.shift()?.trim().match(/^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/);if(!range)throw Error(`Caption ${index+1} has an invalid time range.`);const start=time(range[1]),end=time(range[2]),text=lines.join('\n').trim();if(end<=start||end>86400||!text||text.length>500)throw Error(`Check the text and timing of caption ${index+1}.`);return {start,end,text}});
}
