import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

// Produces a reviewable patch only. Never merges, starts inference, reads .env or pushes.
const [cloudPath,revision]=process.argv.slice(2);
if(!cloudPath||!/^[a-f0-9]{40}$/.test(revision||''))throw Error('Usage: node scripts/prepare-cloud-release.mjs <Cloud checkout> <exact 40-character committed SHA>');
const cloud=resolve(cloudPath),root=resolve(import.meta.dirname,'..');
const base='78b42e3fade76f1123f578e63883c6eea0e048c4';
const git=(cwd,...args)=>execFileSync('git',['-c','safe.directory='+cwd,'-C',cwd,...args],{windowsHide:true,stdio:['ignore','pipe','pipe'],maxBuffer:32*1024*1024});
if(git(cloud,'rev-parse',revision+'^{commit}').toString().trim()!==revision)throw Error('Exact committed revision not found.');
git(cloud,'merge-base','--is-ancestor',base,revision);
const paths=git(cloud,'diff','--name-only',base,revision).toString().trim().split('\n').filter(Boolean);
const included=[],excluded=[],unknown=[];
for(const path of paths){
 if(/^notes\//.test(path)||/^scripts\//.test(path)||(/^adstudio\/scripts\//.test(path)&&!path.endsWith('.test.mjs'))){excluded.push({path,reason:'Private notes or development utility; review separately, never copy by default.'});continue;}
 if(['.env.example','package.json','package-lock.json','docs/COMFY_CLOUD_FLUX.md','adstudio/fonts/Outfit-SemiBold.ttf','shared/fonts/Outfit-SemiBold.ttf'].includes(path)||/^adstudio\/src\/.*\.(ts|tsx)$/.test(path)||/^shared\/(lib|runtime)\/.*\.ts$/.test(path)||/^adstudio\/scripts\/[^/]+\.test\.mjs$/.test(path)){included.push(path);continue;}
 unknown.push(path);
}
if(unknown.length)throw Error('Unreviewed path scope: '+unknown.join(', '));
const dir=resolve(root,'outputs/submission-audit');await mkdir(dir,{recursive:true});
const patch=git(cloud,'diff','--binary','--full-index',base,revision,'--',...included);
const filename='cloud-'+revision.slice(0,12)+'.patch';await writeFile(resolve(dir,filename),patch);
let applyCheck;try{git(root,'apply','--check','--3way',resolve(dir,filename));applyCheck='passes';}catch{applyCheck='requires conflict review against clean staged branch';}
const report={schema:'cloud-release-review-v1',base,revision,verification:'NOT live acceptance; exact committed diff inventory only',included,excluded,patch:filename,sha256:createHash('sha256').update(patch).digest('hex'),applyCheck,remoteWrites:false};
await writeFile(resolve(dir,'cloud-review.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({revision,included:included.length,excluded:excluded.length,patch:filename,applyCheck,warning:report.verification},null,2));
