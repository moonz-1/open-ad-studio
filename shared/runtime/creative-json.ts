import {sceneFields} from '../lib/photographic-scene.ts';
// Strict JSON decoding with duplicate-key detection BEFORE JSON.parse can lose
// duplicate members. Normalization is surrounding whitespace on known schema keys and declared
// argument enum/ID values. No evidence quote, missing field or creative prose is repaired.
export type KeyNormalization={path:string;from:string;to:string};
const conceptKeys=['id','title','idea','composition','camera','environment','lighting','hierarchy','layout','copyId','evidenceIds','scores','rationale','strategy'];
const argumentKeys=[...sceneFields,'focusId','mechanismId','title','idea','objective','audienceHypothesis','tension','businessFit','feeling','memory','focus','opening','payoff','proofId','proofQuote','strategy'];
const strategyKeys=['version','objective','audienceHypothesis','tension','businessFit','feeling','memory','focus','opening','payoff','proof'];
function allowedKeys(path:string[]):string[]{
 const joined=path.join('.');
 if(path.length===0)return ['arguments','concepts','text','first','second','third'];
 if(joined==='concepts.*')return conceptKeys;
 if(joined==='arguments.*')return argumentKeys;
 if(['first','second','third'].includes(joined))return ['title','reason','tension','interpretation','support','backdrop','key','shadows','highlights','palette'];
 if(joined==='concepts.*.strategy'||joined==='arguments.*.strategy')return strategyKeys;
 if(joined==='concepts.*.strategy.proof.*'||joined==='arguments.*.strategy.proof.*')return ['id','quote'];
 if(joined==='concepts.*.scores')return ['impact','relevance','accuracy','feasibility'];
 return [];
}
export function parseCreativeResponse(raw:string):{value:unknown;normalizations:KeyNormalization[]}{
 if(Buffer.byteLength(raw,'utf8')>32000)throw Error('Local model response exceeds limit.');
 const normalizations:KeyNormalization[]=[];
 function decode(input:string):unknown{
  let s=input.replace(/^\uFEFF/,'').trim();
  if(s.startsWith('```')){if(!/^```(?:json)?\s[\s\S]*\s```$/i.test(s))throw Error('Incomplete JSON fence.');s=s.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');}
  let at=0;
  const ws=()=>{while(/[ \t\r\n]/.test(s[at]||''))at++;};
  function string():string{
   if(s[at]!=='"')throw Error('Expected a JSON string.');const start=at++;
   while(at<s.length){const c=s[at++];if(c==='\\'){at++;continue;}if(c==='"')return JSON.parse(s.slice(start,at));}
   throw Error('Incomplete JSON string.');
  }
  function value(path:string[],depth=0):unknown{
   if(depth>8)throw Error('Planning JSON is too deeply nested.');ws();
   if(s[at]==='"')return string();
   if(s[at]==='['){at++;const result:unknown[]=[];ws();if(s[at]===']'){at++;return result;}
    while(true){result.push(value([...path,'*'],depth+1));ws();const end=s[at++];if(end===']')return result;if(end!==',')throw Error('Invalid JSON array.');}
   }
   if(s[at]==='{'){
    at++;const result:Record<string,unknown>={},seen=new Set<string>();ws();if(s[at]==='}'){at++;return result;}
    const allowed=allowedKeys(path);
    while(true){ws();const original=string(),key=original.trim();
     if(!allowed.includes(key))throw Error('Unknown planning field: '+[...path,original].join('.'));
     if(seen.has(key))throw Error('Duplicate/colliding planning key: '+[...path,key].join('.'));seen.add(key);
     if(key!==original)normalizations.push({path:path.join('.')||'$root',from:original,to:key});
     ws();if(s[at++]!==':')throw Error('Expected JSON colon.');result[key]=value([...path,key],depth+1);
     if(path.join('.')==='arguments.*'&&['objective','focusId','mechanismId','proofId','sceneEvidenceId'].includes(key)&&typeof result[key]==='string'){
      const originalValue=result[key] as string,trimmed=originalValue.trim();if(trimmed!==originalValue){normalizations.push({path:[...path,key].join('.'),from:originalValue,to:trimmed});result[key]=trimmed;}
     }ws();const end=s[at++];if(end==='}')return result;if(end!==',')throw Error('Invalid JSON object.');
    }
   }
   const match=s.slice(at).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
   if(!match)throw Error('Invalid JSON value.');at+=match[0].length;return JSON.parse(match[0]);
  }
  const result=value([]);ws();if(at!==s.length)throw Error('Unexpected text after planning JSON.');return result;
 }
 let value=decode(raw);
 // Retain the two documented SaveText serialization forms; each layer is still
 // parsed strictly, including duplicate detection. Never scrape prose for braces.
 if(typeof value==='string')value=decode(value);
 else if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===1&&typeof (value as any).text==='string')value=decode((value as any).text);
 return {value,normalizations};
}
