// Live local API test; uses FFmpeg, no GPU jobs. Supply a decodable normalized PNG.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base=process.env.OSH_TEST_URL || 'http://127.0.0.1:8288';
const post=async(name,body)=>{const r=await fetch(base+'/api/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
const upload=await post('upload',{image:'data:image/png;base64,'+(await readFile(process.argv[2] || 'outputs/product-test.png')).toString('base64')});
assert.equal(upload.status,200);
const valid={image:upload.data.url,mode:'camera',ratio:'1:1',duration:2,motion:'push'};
for(const body of [null,{}, {...valid,mode:'shell'}, {...valid,ratio:'__proto__'}, {...valid,ratio:{toString:null}}, {...valid,motion:'push;movie=secret'}, {...valid,image:'/outputs/../../secret'}, {...valid,image:'/outputs/aaaaaaaaaaaaaaaa.png'}, {...valid,duration:99}, {...valid,mode:'locked'}, {...valid,mode:'locked',background:upload.data.url}]) {
 const r=await post('product-video',body);assert.equal(r.status,400,JSON.stringify(body));
}
// A PNG with a valid header but no image data must fail safely and leave the queue usable.
const broken=Buffer.alloc(33);Buffer.from('89504e470d0a1a0a','hex').copy(broken);broken.writeUInt32BE(13,8);broken.write('IHDR',12);broken.writeUInt32BE(32,16);broken.writeUInt32BE(32,20);
const corrupt=await post('upload',{image:'data:image/png;base64,'+broken.toString('base64')});assert.equal(corrupt.status,200);
assert.equal((await post('product-video',{...valid,image:corrupt.data.url})).status,500);
const camera=await post('product-video',valid);assert.equal(camera.status,200);assert.equal(camera.data.frames,49);assert.equal(camera.data.width,384);
const output=await fetch(base+camera.data.url);assert.equal(output.status,200);assert.equal(output.headers.get('content-type'),'video/webm');
const mp4=await post('export',{video:camera.data.url});assert.equal(mp4.status,200);
assert.equal((await fetch(base+mp4.data.url)).headers.get('content-type'),'video/mp4');
console.log('PASS: mode/ratio/motion/path/duration rejection; malformed decode fails safely; next render + existing MP4 export succeed.');
