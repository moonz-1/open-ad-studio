import {execFileSync,spawnSync} from 'node:child_process';
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
 if(['adstudio/BRAND_INTELLIGENCE.md','adstudio/CREATIVE_ENGINE.md','docs/CREATIVE_DIRECTOR_2.md','docs/CREATIVE_PIPELINE_AUDIT.md'].includes(path)){excluded.push({path,reason:'Historical developer brief was not shipped in the public package; current judge/setup docs supersede it.'});continue;}
 if(path==='adstudio/scripts/fixtures-qwen-695a78fa-response.txt'){
  const bytes=git(cloud,'show',revision+':'+path);
  if(createHash('sha256').update(bytes).digest('hex')!=='69cde122d5e8080babd398737dd26ace65faae5f0bd66aedbdd05990a41b52e9')throw Error('Qwen negative-test fixture changed; review before publication.');
  included.push(path);continue;
 }
 if(/^adstudio\/scripts\/fixtures-/.test(path)){unknown.push(path);continue;}
 if(/^notes\//.test(path)||/^scripts\//.test(path)||(/^adstudio\/scripts\//.test(path)&&!path.endsWith('.test.mjs'))){excluded.push({path,reason:'Private notes or development utility; review separately, never copy by default.'});continue;}
 if(['.env.example','package.json','package-lock.json','docs/COMFY_CLOUD_FLUX.md','adstudio/BRAND_INTELLIGENCE.md','adstudio/CREATIVE_ENGINE.md','docs/CREATIVE_DIRECTOR_2.md','docs/CREATIVE_PIPELINE_AUDIT.md','shared/workflows/CONTRACT.md','adstudio/fonts/Outfit-SemiBold.ttf','shared/fonts/Outfit-SemiBold.ttf'].includes(path)||/^adstudio\/src\/.*\.(ts|tsx|css)$/.test(path)||/^shared\/(lib|runtime)\/.*\.ts$/.test(path)||/^adstudio\/scripts\/[^/]+\.test\.mjs$/.test(path)){included.push(path);continue;}
 unknown.push(path);
}
if(unknown.length)throw Error('Unreviewed path scope: '+unknown.join(', '));
const dir=resolve(root,'outputs/submission-audit');await mkdir(dir,{recursive:true});
// Reconcile the one known public-only test-directory fix without changing either checkout.
const testPath='adstudio/scripts/consolidated-rc.test.mjs',reconciled=[];
let patch=git(cloud,'diff','--binary','--full-index',base,revision,'--',...included.filter(path=>path!==testPath));
if(included.includes(testPath)){
 const baseText=git(cloud,'show',base+':'+testPath).toString(),ours=git(root,'show','HEAD:'+testPath).toString();
 const marker=" await writeFile('outputs/consolidated-checks/scene-api-proof.json'",directory=" await mkdir('outputs/consolidated-checks',{recursive:true});\n";
 if(ours!==baseText&&ours!==baseText.replace(marker,directory+marker))throw Error('Consolidated test has new independent edits; reconcile explicitly before making the patch.');
 let theirs=git(cloud,'show',revision+':'+testPath).toString();
 if(!theirs.includes(directory.trim())){
  if(theirs.split(marker).length!==2)throw Error('Incoming consolidated test evidence boundary changed; review required.');
  theirs=theirs.replace(marker,directory+marker);
 }
 const oldOid=git(root,'rev-parse','HEAD:'+testPath).toString().trim();
 const newOid=execFileSync('git',['-c','safe.directory='+root,'-C',root,'hash-object','-w','--stdin'],{input:theirs,encoding:'utf8',windowsHide:true}).trim();
 const resolved=git(root,'diff','--binary','--full-index',oldOid,newOid).toString().replaceAll('a/'+oldOid,'a/'+testPath).replaceAll('b/'+newOid,'b/'+testPath);
 patch=Buffer.concat([patch,Buffer.from(resolved)]);reconciled.push({path:testPath,rule:'Keep incoming assertions plus the independently verified recursive evidence-directory creation.'});
}
const filename='cloud-'+revision.slice(0,12)+'.patch';await writeFile(resolve(dir,filename),patch);
const check=spawnSync('git',['-c','safe.directory='+root,'-C',root,'apply','--check','--3way',resolve(dir,filename)],{encoding:'utf8',windowsHide:true});
const conflicts=(check.stderr||'').split('\n').filter(line=>/with conflicts|^error:/i.test(line));
const applyCheck=check.status===0&&!conflicts.length?'passes':'requires conflict review against clean staged branch';
const report={schema:'cloud-release-review-v1',base,revision,verification:'NOT live acceptance; exact committed diff inventory only',included,excluded,reconciled,conflicts,patch:filename,sha256:createHash('sha256').update(patch).digest('hex'),applyCheck,remoteWrites:false};
await writeFile(resolve(dir,'cloud-review.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({revision,included:included.length,excluded:excluded.length,patch:filename,applyCheck,warning:report.verification},null,2));
