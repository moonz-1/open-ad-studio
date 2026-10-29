/** CLI and first-boot UI share the same resumable, validated model downloader. */
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { downloadModels, type ModelFile } from './model-download.ts';
const {values}=parseArgs({options:{'models-dir':{type:'string'},only:{type:'string'},'dry-run':{type:'boolean'}}});
if(!values['models-dir']){console.error('usage: npm run models -- --models-dir "<ComfyUI>/models" [--only shot_ltxv] [--dry-run]');process.exit(1)}
const manifest=JSON.parse(await readFile(new URL('./models.json',import.meta.url),'utf8')).models as ModelFile[];
const models=manifest.filter(m=>!values.only||m.used_by===values.only);if(!models.length)throw new Error('Unknown model pack.');
for(const model of models)console.log(`${model.file} · ${model.size_gb} GB · ${model.license}`);
if(!values['dry-run']){console.log('One-time model setup — this is not generation. Complete existing models are reused.');await downloadModels(values['models-dir'],models,{onProgress:p=>process.stdout.write(`\rDownloading ${p.index}/${p.count} · ${p.file} · ${(p.received/1e9).toFixed(2)}${p.total?' / '+(p.total/1e9).toFixed(2):''} GB          `)});console.log('\nModels ready.')}
