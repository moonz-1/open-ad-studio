// Real GPU smoke test. Usage: node adstudio/scripts/render-smoke.mjs <photo.png> [16:9|9:16|1:1]
// Requires the local Vite API, ComfyUI, proxy and shot_ltxv models.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const [file, ratio = '16:9'] = process.argv.slice(2);
const base = process.env.OSH_TEST_URL || 'http://127.0.0.1:8288';
const sizes = { '16:9': {width:512,height:288}, '9:16': {width:288,height:512}, '1:1': {width:384,height:384} };
if (!file || !sizes[ratio]) throw new Error('Usage: node adstudio/scripts/render-smoke.mjs <photo.png> [16:9|9:16|1:1]');
const post = async (route, body) => {
  const r = await fetch(base + '/api/' + route, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data = await r.json();
  assert.ok(r.ok, JSON.stringify(data));
  return data;
};
const health = await (await fetch(base + '/api/health')).json();
assert.ok(health.comfyui && health.proxy, 'ComfyUI and proxy must be online');
const upload = await post('upload', {image:'data:image/png;base64,'+(await readFile(file)).toString('base64')});
console.log('Uploaded:', upload);
const result = await post('shot', {keys:[{image:upload.url,t:0}],prompt:'A premium orange bottle standing on a light neutral studio background. Slow smooth camera push in, subtle lighting changes, preserve the bottle shape and label, commercial product shot.',duration:2,seed:1,...sizes[ratio]});
assert.equal(result.frames, 49);
const video = await fetch(base + result.url);
assert.ok(video.ok);
assert.equal(video.headers.get('content-type'), 'video/webm');
const bytes = Buffer.from(await video.arrayBuffer());
assert.ok(bytes.length > 1000);
assert.equal(bytes.subarray(0,4).toString('hex'),'1a45dfa3','Expected WebM/EBML');
await mkdir('outputs',{recursive:true});
await writeFile(`outputs/render-smoke-${ratio.replace(':','x')}.json`,JSON.stringify({input:file,ratio,...result,bytes:bytes.length},null,2));
console.log('PASS real upload → SDK → proxy → ComfyUI → WebM:', result, 'bytes:',bytes.length);
