// Run with Vite running: node adstudio/scripts/smoke.mjs
// Does not submit GPU jobs; generated upload is written to gitignored outputs/.
import assert from 'node:assert/strict';
import http from 'node:http';
const base = process.env.OSH_TEST_URL || 'http://127.0.0.1:8288';
const post = (route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
console.log('Health:', await (await fetch(base + '/api/health')).json());
const page = await fetch(base + '/adstudio/');
assert.equal(page.status, 200);
assert.match(await page.text(), /src\/main.ts/);
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const upload = await post('/api/upload', { image });
assert.equal(upload.status, 200);
const result = await upload.json();
assert.equal(result.width, 1);
assert.equal(result.height, 1);
assert.match(result.url, /^\/outputs\/[a-f0-9]{16}\.png$/);
const output = await fetch(base + result.url);
assert.equal(output.headers.get('content-type'), 'image/png');
assert.deepEqual(Buffer.from(await output.arrayBuffer()), Buffer.from(image.split(',')[1], 'base64'));
for (const image of ['data:image/jpeg;base64,AAAA', 'data:image/png;base64,AAAA', 'data:image/png;base64,!!!!']) {
  assert.equal((await post('/api/upload', { image })).status, 400);
}
assert.equal((await post('/api/upload', { image: 'x'.repeat(8 * 1024 * 1024) })).status, 413);
assert.equal((await post('/api/shot', { keys: [{ image: '/outputs/../../secret', t: 0 }], duration: 2 })).status, 400);
// Empty guides are valid text-to-video; malformed guide containers still fail.
assert.equal((await post('/api/shot', { keys: null, duration: 2 })).status, 400);
for (const frames of [0,10,122,73.5]) assert.equal((await post('/api/shot', { frames })).status,400);
for (const fps of [0,121,'invalid']) assert.equal((await post('/api/shot', { fps })).status,400);
assert.equal((await post('/api/keyframe', { prompt: '' })).status, 400);
assert.equal((await post('/api/export', { video: '/outputs/../../secret' })).status, 400);
assert.equal((await post('/api/export', { video: result.url })).status, 400);
assert.equal((await post('/api/shot', { keys: [{ image: '/outputs/aaaaaaaaaaaaaaaa.mp4', t: 0 }], duration: 2 })).status, 400);
const remoteStatus = await new Promise((resolve, reject) => {
  http.get(base + '/api/health', { headers: { host: 'untrusted.example' } }, response => {
    response.resume(); resolve(response.statusCode);
  }).on('error', reject);
});
assert.ok(remoteStatus === 401 || remoteStatus === 403);
console.log('PASS: page, upload roundtrip, malformed/oversized inputs, keyframe/export path validation, remote-host denial. GPU rendering not tested.');
