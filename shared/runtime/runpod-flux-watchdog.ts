/** Detached lease guard: only persisted exact owned creation identities may be removed. */
import {readFile} from 'node:fs/promises';
import {recoverFluxIntent} from './runpod-flux-controller.ts';
const path=process.argv[2];
if(path){
 try{const intent=JSON.parse(await readFile(path,'utf8'));const delay=Math.max(0,Number(intent.deadline)-Date.now());if(!Number.isFinite(delay)||delay>2400*1000)throw Error('Invalid lease deadline.');await new Promise(r=>setTimeout(r,delay));
  for(let i=0;i<12;i++){try{await recoverFluxIntent(process.env,undefined,path,intent.token);break;}catch{if(i===11)process.exitCode=1;else await new Promise(r=>setTimeout(r,5000));}}
 }catch{process.exitCode=1;}
}
