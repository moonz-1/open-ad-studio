import type {Settings,Ratio} from './projects';
export const templates=[
 {id:'portrait-push',name:'Portrait push',description:'Vertical photo animation · eased 4% push in',ratio:'9:16',motion:'push'},
 {id:'landscape-pan',name:'Landscape pan',description:'Wide photo animation · camera pans right',ratio:'16:9',motion:'pan-right'},
 {id:'square-pan',name:'Square pan',description:'Square photo animation · camera pans left',ratio:'1:1',motion:'pan-left'},
] as const;
export function templateSettings(id:string,current:Settings):Settings {
 const template=templates.find(t=>t.id===id);if(!template)throw new Error('Unknown template');
 return {...current,template:id,mode:'camera',motion:template.motion,ratios:[template.ratio as Ratio],duration:3,framing:'fit'};
}
export function resizeDimensions(width:number,height:number,requested:number){
 if(![width,height,requested].every(n=>Number.isFinite(n)&&n>0))throw new Error('Choose valid output dimensions.');
 function gcd(a:number,b:number):number{return b?gcd(b,a%b):a;}
 const divisor=gcd(width,height),step=2*width/divisor,unit=Math.max(1,Math.round(requested/step));
 const w=step*unit,h=2*height/divisor*unit;
 if(w<16||h<16||w>4096||h>4096||w*h>4096*2160)throw new Error('Choose an output between 16px and 4096px, up to 4096×2160 total pixels.');
 return {width:w,height:h,step};
}
