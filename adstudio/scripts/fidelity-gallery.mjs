// Build a private, self-contained evidence viewer. Never publishes customer media.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
const [creativePath,fidelityPath]=process.argv.slice(2);
const creative=JSON.parse(await readFile(creativePath,'utf8'));
const fidelity=JSON.parse(await readFile(fidelityPath,'utf8'));
const folder=dirname(fidelityPath);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const embed=async(path,mime)=>`data:${mime};base64,${(await readFile(path)).toString('base64')}`;
let cards='';
for(const original of creative.runs) {
 const ratio=original.ratio,name=ratio.replace(':','x');
 cards+=`<h2>${esc(ratio)}</h2><article><h3>Creative · LTX · ${original.result.seconds}s</h3><p>First / middle / final frames. Shape/lettering can be regenerated.</p><img alt="Creative frame samples" src="${await embed(join(dirname(creativePath),name+'-contact.png'),'image/png')}"></article>`;
 for(const run of fidelity.runs.filter(r=>r.ratio===ratio)) {
  cards+=`<article><h3>${esc(run.name)} · ${run.result.seconds}s processing + ${run.export.seconds}s MP4 export</h3><p>${run.mode==='locked'?`Protected core: ${run.uniqueDecodedCoreFrames} unique decoded frames; source MAE ${run.resizedSourceError.mae}. MP4 is lossy.`:'Repeated renders: decoded frames identical. Camera motion is a transform of the photograph.'}</p><img alt="First middle final frame samples" src="${await embed(join(folder,run.name+'-contact.png'),'image/png')}"><video controls preload="none" src="${await embed(join(folder,run.name+'.mp4'),'video/mp4')}"></video></article>`;
 }
}
await writeFile(join(folder,'gallery.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><title>Ad Studio fidelity evidence</title><style>body{font:15px/1.5 system-ui;background:#16171b;color:#eee;max-width:1200px;margin:30px auto;padding:0 20px}article{border:1px solid #444;padding:16px;margin:16px 0}img{display:block;width:100%;height:auto}video{display:block;max-width:400px;max-height:400px;margin-top:12px}code{overflow-wrap:anywhere}</style><h1>Source-preservation comparison</h1><p>Private local evidence. Browser acceptance and full-clip aesthetic review remain separate. Each image shows first / middle / final frames. MP4 videos below are lossy exports; no general strict-fidelity claim.</p><p>Source SHA-256: <code>${esc(fidelity.sourceSha256)}</code></p><p>Creative model: LTX-Video 2B 0.9.8 distilled; T5-XXL FP8 scaled; 8 steps, 24 fps, seed ${creative.manifest.seed}. Exact prompt: ${esc(creative.manifest.prompt)}</p>${cards}</html>`);
console.log(join(folder,'gallery.html'));
