// RFC-style longest matching path rule. Comments are data, never instructions.
export function robotsAllows(body:string,address:string,agent='OpenAdStudio-BrandResearch'){
 const groups:{agents:string[];rules:{path:string;allow:boolean}[]}[]=[];let group:typeof groups[number]|undefined,hasRules=false;
 for(const raw of body.split(/\r?\n/)){const line=raw.replace(/#.*$/,'').trim(),colon=line.indexOf(':');if(colon<0)continue;const key=line.slice(0,colon).trim().toLowerCase(),value=line.slice(colon+1).trim();
  if(key==='user-agent'){if(!group||hasRules){group={agents:[],rules:[]};groups.push(group);hasRules=false;}group.agents.push(value.toLowerCase());}
  else if(group&&(key==='allow'||key==='disallow')){hasRules=true;if(value.startsWith('/'))group.rules.push({path:value,allow:key==='allow'});}
 }
 const scores=groups.map(g=>Math.max(-1,...g.agents.map(a=>a==='*'?0:agent.toLowerCase().includes(a)?a.length:-1))),specificity=Math.max(-1,...scores);if(specificity<0)return true;
 const u=new URL(address),decode=(s:string)=>{try{return decodeURI(s);}catch{return s;}},path=decode(u.pathname+u.search);let best=-1,allowed=true;
 for(let i=0;i<groups.length;i++)if(scores[i]===specificity)for(const rule of groups[i].rules){const pattern=decode(rule.path),end=pattern.endsWith('$'),literal=end?pattern.slice(0,-1):pattern,regex='^'+literal.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+(end?'$':'');if(!new RegExp(regex).test(path))continue;const size=literal.replace(/\*/g,'').length;if(size>best||size===best&&rule.allow){best=size;allowed=rule.allow;}}
 return allowed;
}
