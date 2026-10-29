export type ErrorEntry={id:string;at:number;source:string;message:string;details:string;requestId?:string;status?:number};
export function errorText(value:unknown,max=6000):string{
 return String(value??'').replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,'Bearer [redacted]').replace(/\x1b\[[0-9;]*[A-Za-z]/g,'').replace(/data:[^;\s]+;base64,[A-Za-z0-9+/=]+/g,'[media omitted]').replace(/((?:authorization|bearer|password|secret|api[_ -]?key|token)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi,'$1[redacted]').replace(/\b(?:hf_|sk-)[A-Za-z0-9_-]{8,}/g,'[redacted]').replace(/https?:\/\/[^\s"'<>]+/g,value=>{try{const url=new URL(value);return url.origin+url.pathname}catch{return '[url]'}}).replace(/(^|\n)(\s*(?:prompt|audio|image)\s*[:=]).*/gi,'$1$2 [omitted]').slice(0,max);
}
