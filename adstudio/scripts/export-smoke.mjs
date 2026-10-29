// Real FFmpeg export check. Usage: node adstudio/scripts/export-smoke.mjs /outputs/<hex>.webm [overlay.png]
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const [video, overlayFile] = process.argv.slice(2);
const base = process.env.OSH_TEST_URL || 'http://127.0.0.1:8288';
if (!video) throw new Error('Provide an API-owned WebM URL, and optionally a local PNG overlay.');
const invalidOverlay = await fetch(base + '/api/export', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({video,overlay:'/outputs/../../secret'})});
assert.equal(invalidOverlay.status,400);
const post = async (route, body) => {
 const r = await fetch(base + '/api/' + route, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data = await r.json(); assert.ok(r.ok, JSON.stringify(data)); return data;
};
let overlay;
if (overlayFile) overlay = (await post('upload',{image:'data:image/png;base64,'+(await readFile(overlayFile)).toString('base64')})).url;
const result = await post('export', {video,overlay});
assert.match(result.url,/^\/outputs\/[a-f0-9]{16}\.mp4$/);
const download = await fetch(base + result.url);
assert.equal(download.status,200);
assert.equal(download.headers.get('content-type'),'video/mp4');
const bytes = Buffer.from(await download.arrayBuffer());
assert.equal(bytes.subarray(4,8).toString(),'ftyp');
await writeFile('outputs/export-smoke-latest.json',JSON.stringify({video,overlay,...result,bytes:bytes.length},null,2));
console.log('PASS real MP4 export:',result,'bytes:',bytes.length);
