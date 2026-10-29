// Local-only integrity check; no upload, remote access or model download.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve,join,dirname} from 'node:path';
import {loadEnv} from 'vite';
import {benchmarkGraph} from './graph.mjs';
const exec=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex');
const env={...loadEnv('development',process.cwd(),''),...process.env};
const ffmpeg=env.FFMPEG_PATH||'ffmpeg',ffprobe=env.FFPROBE_PATH||(process.platform==='win32'?join(dirname(ffmpeg),'ffprobe.exe'):'ffprobe');
const root=resolve('adstudio/benchmark'),pins=JSON.parse(await readFile(join(root,'pins.json'),'utf8'));
assert.equal(sha(await readFile(join(root,'requirements.lock'))),pins.requirementsSha256);
assert.equal(sha(await readFile(join(root,'workflow_api.json'))),pins.apiWorkflowSha256);
assert.equal(pins.weights.length,5);assert.equal(pins.weights.reduce((n,w)=>n+w.bytes,0),71114917404);
assert.ok(pins.weights.every(w=>/^[a-f0-9]{64}$/.test(w.sha256)));
assert.equal(pins.budget.gpuHours,2.5);
const manifest=JSON.parse(await readFile('outputs/ltx25-benchmark/inputs/manifest.json','utf8'));
assert.equal(manifest.private,true);assert.equal(manifest.uploaded,false);
assert.deepEqual(manifest.inputs.map(i=>i.id),['cookie','printed-label']);
const cases=[];
for(const input of manifest.inputs){
 assert.equal(sha(await readFile(input.source)),input.sourceSha256,'Original source changed');
 assert.equal(sha(await readFile(input.original)),input.sourceSha256,'Private original copy changed');
 assert.equal(sha(await readFile(input.guide)),input.guideSha256,'Prepared guide changed');
 const meta=JSON.parse((await exec(ffprobe,['-v','error','-show_streams','-of','json',input.guide],{windowsHide:true})).stdout);
 assert.equal(meta.streams[0].width,1088);assert.equal(meta.streams[0].height,1920);
 cases.push({case:input.id,seed:1,sourceUnchanged:true,guideHashVerified:true,width:1088,height:1920});
}
let attempts=[];try{attempts=JSON.parse(await readFile('outputs/ltx25-benchmark/attempts.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
assert.equal(attempts.length,0,'Prior attempts exist; reconcile before first paid session');
const graph=benchmarkGraph({prompt:'prepared integrity check',seed:1});
assert.equal(graph[3059].inputs.length,73);assert.equal(graph[3980].inputs.frame_rate,24);
const report={checked:new Date().toISOString(),cases,attempts:0,pinsSha256:sha(await readFile(join(root,'pins.json'))),modelRevision:pins.modelRevision,weightBytes:pins.weightBytes,weightFilesDownloadedOrHashed:false,privateUpload:false};
await mkdir('outputs/benchmark-readiness',{recursive:true});
await writeFile('outputs/benchmark-readiness/prepared.json',JSON.stringify(report,null,2));
console.log('PASS: both seed1 cases, original/copy/guide hashes, 1088x1920 guides, empty attempt ledger, five model metadata pins and local lock/graph hashes. No uploads/downloads.');
