// Public web reader. Never executes scripts, sends cookies or follows unvalidated DNS/redirects.
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {request as httpsRequest} from 'node:https';
import {request as httpRequest} from 'node:http';
import {robotsAllows} from './brand-robots.ts';
export class BrandError extends Error{status:number;upstreamStatus?:number;constructor(status:number,message:string,upstreamStatus?:number){super(message);this.status=status;this.upstreamStatus=upstreamStatus;}}
export function safeURL(value:unknown){
 if(typeof value!=='string'||value.length>2048)throw new BrandError(400,'Enter a public website URL.');
 let url:URL;try{url=new URL(value.includes('://')?value:'https://'+value);}catch{throw new BrandError(400,'Enter a valid website URL.');}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port||!url.hostname.includes('.')||/\.(local|localhost|internal|test|invalid)$/i.test(url.hostname))throw new BrandError(400,'Use a public HTTP(S) website on its standard port, without credentials.');
 url.hash='';return url;
}
export function publicAddress(address:string):boolean{
 if(isIP(address)===4){const [a,b,c]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===198&&(b===18||b===19||b===51&&c===100))||(a===203&&b===0&&c===113));}
 // Only global-unicast IPv6; excludes mapped IPv4, local/link/multicast and documentation ranges.
 if(isIP(address)!==6||! /^[23][0-9a-f]{3}:/i.test(address))return false;
 const [first,second]=address.split(':').map(x=>parseInt(x||'0',16));return !(first===0x2001&&(second<0x200||second===0xdb8)||first===0x2002||first===0x3fff);
}
export type WebRead={url:string;type:string;bytes:Buffer};
const robotCache=new Map<string,{until:number;body:Promise<string>}>();
async function checkRobots(url:URL){let policy=robotCache.get(url.origin);if(!policy||policy.until<Date.now()){
 const body=readPublic(new URL('/robots.txt',url).href,64000,'robots').then(r=>{const text=r.bytes.toString('utf8');if(/checking your browser|verify you are human|access denied/i.test(text))throw new BrandError(422,'Website robots policy could not be verified. Continue manually.');return r.type==='text/html'&&!/^user-agent\s*:/im.test(text)?'':text;}).catch(e=>{if(e instanceof BrandError&&[404,410].includes(e.upstreamStatus||0))return '';throw e;});
 policy={until:Date.now()+3600000,body};robotCache.set(url.origin,policy);if(robotCache.size>64)robotCache.delete(robotCache.keys().next().value!);
 }if(!robotsAllows(await policy.body,url.href))throw new BrandError(403,'This public path is restricted by the website robots policy. No bypass was attempted.');}
export async function readPublic(value:string,limit=3*1024*1024,kind:'page'|'asset'|'robots'='page',redirects=0):Promise<WebRead>{
 const url=safeURL(value);let entries;try{entries=await lookup(url.hostname,{all:true,verbatim:true});}catch{throw new BrandError(422,'The website could not be resolved. You can continue manually.');}
 if(!entries.length||entries.some(e=>!publicAddress(e.address)))throw new BrandError(400,'Private, reserved or mixed public/private network addresses are blocked.');
 if(kind!=='robots')await checkRobots(url);
 const pinned=entries.find(e=>e.family===4)||entries[0];
 return new Promise((ok,fail)=>{
  let settled=false;const reject=(e:unknown)=>{if(!settled){settled=true;fail(e instanceof BrandError?e:new BrandError(422,'The website did not respond securely. You can continue manually.'));}};
  const req=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{method:'GET',agent:false,headers:{'User-Agent':'OpenAdStudio-BrandResearch/1.0','Accept':kind==='robots'?'text/plain':kind==='page'?'text/html,text/css,application/ld+json':'image/png,image/jpeg,image/webp','Accept-Encoding':'identity'},lookup:((_host:any,options:any,callback:any)=>options?.all?callback(null,[pinned]):callback(null,pinned.address,pinned.family)) as any},res=>{
   const status=res.statusCode||0;
   if([301,302,303,307,308].includes(status)){res.resume();if(redirects>=3||!res.headers.location)return reject(new BrandError(422,'Too many website redirects.'));let target:string;try{target=new URL(res.headers.location,url).href;}catch{return reject(new BrandError(422,'Invalid website redirect.'));}readPublic(target,limit,kind,redirects+1).then(v=>{if(!settled){settled=true;ok(v);}},reject);return;}
   if(status<200||status>=300){res.resume();return reject(new BrandError(422,`Website returned HTTP ${status}. Continue manually or try another public page.`,status));}
   const type=String(res.headers['content-type']||'').split(';')[0].toLowerCase();
   if(!(kind==='robots'?['text/plain','text/html']:kind==='page'?['text/html','application/xhtml+xml','text/css','application/ld+json']:['image/png','image/jpeg','image/webp']).includes(type)){res.resume();return reject(new BrandError(422,'Unsupported website content. Only robots, HTML/CSS and PNG/JPEG/WebP assets are collected.'));}
   if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.resume();return reject(new BrandError(422,'Website compression could not be read. Continue manually.'));}
   const chunks:Buffer[]=[];let size=0;
   res.on('data',(b:Buffer)=>{size+=b.length;if(size>limit){reject(new BrandError(413,'Website response exceeds the safe research limit.'));res.destroy();}else chunks.push(b);});
   res.on('error',reject);res.on('aborted',()=>reject(new BrandError(422,'Website response was interrupted.')));res.on('end',()=>{if(!settled){settled=true;ok({url:url.href,type,bytes:Buffer.concat(chunks)});}});
  });
  const timer=setTimeout(()=>{reject(new BrandError(504,'Website request timed out. Continue manually.'));req.destroy();},10000);
  req.on('error',reject);req.on('close',()=>clearTimeout(timer));req.end();
 });
}
