// One local benchmark composition. No inference, cloud, photo retouch or UI.
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
const root='outputs/creative-quality-sprint',session=join(root,'session');
const index=process.argv.indexOf('--case'),selected=index<0?null:process.argv[index+1];
if(!process.argv.includes('--write')){console.log('DRY RUN: choose --case and --write after verified cleanup; no export.');process.exit();}
if(selected!=='campaign')throw Error('This composition was placed against the campaign image only; another source needs its own visual layout review');
const sha=b=>createHash('sha256').update(b).digest('hex'),xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const execution=JSON.parse(await readFile(join(session,'execution.json'),'utf8'));
if(execution.status!=='three-images-collected'||execution.termination!=='VERIFIED_404'||!execution.rawFilesVerified)throw Error('Collect all three candidates and terminate the Pod first');
const plan=JSON.parse(await readFile(join(root,'campaign.json'),'utf8'));
let source,record;
for(const id of ['authenticity','intimate','campaign']){
 const folder=join(session,'candidates',id),r=JSON.parse(await readFile(join(folder,'render.json'),'utf8')),raw=await readFile(join(folder,'raw.png'));
 if(r.status!=='complete'||sha(raw)!==r.rawSha256||r.podId!==execution.podId)throw Error('Unverified generated source');
 if(id===selected){source=raw;record=r;}
}
const logo=await readFile(plan.logo.output);
if(sha(logo)!==plan.logo.sha256||sha(await readFile(plan.logo.source))!==plan.logo.sourceSha256)throw Error('Original/derived logo changed');
const fontFiles=['C:/Windows/Fonts/georgia.ttf','C:/Windows/Fonts/arial.ttf'];
for(const f of fontFiles)await stat(f);
const width=1080,height=1350,out=join(root,'ad');await mkdir(out,{recursive:true});
// Hand-placed against the campaign image's actual empty upper area. Uniform
// cover keeps every visible pastry; only the bottom background shadow is cut.
// The raw photograph is retained separately without these graphics or crop.
const headline=plan.copy.headline;
if(headline!=='Leave nothing behind.'||plan.copy.productName!=='Cinnamon rolls')throw Error('Re-review changed copy before composing');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="1080" height="1350" fill="#17130f"/>
<image href="data:image/png;base64,${source.toString('base64')}" width="1080" height="1350" preserveAspectRatio="xMidYMin slice"/>
<text x="64" y="70" font-family="Arial" font-size="20" letter-spacing="3.5" fill="#f7ead7">${xml(plan.copy.productName.toUpperCase())}</text>
<text x="58" y="169" font-family="Georgia" font-size="94" fill="#fff3e2">Leave nothing</text>
<text x="58" y="267" font-family="Georgia" font-size="94" fill="#fff3e2">behind.</text>
<image href="data:image/png;base64,${logo.toString('base64')}" x="850" y="44" width="172" height="172" preserveAspectRatio="xMidYMid meet"/>
<text x="1016" y="1290" text-anchor="end" font-family="Arial" font-size="22" letter-spacing="1.4" fill="#fff3e2">${xml(plan.copy.website)}</text>
</svg>`;
const renderer=new Resvg(svg,{font:{loadSystemFonts:false,fontFiles,defaultFontFamily:'Arial'}}),png=renderer.render().asPng();
if(png.readUInt32BE(16)!==width||png.readUInt32BE(20)!==height)throw Error('Incorrect export dimensions');
const recipe={version:1,ownerApproved:false,status:'PROVISIONAL_OWNER_REVIEW_REQUIRED',selectedForDevelopment:selected,
 method:'Actual Qwen raw photograph + genuine alpha-treated logo + deterministic SVG typography. No photo finishing or new generation.',
 sourceSha256:record.rawSha256,sourceFile:join(session,'candidates',selected,'raw.png'),logo:plan.logo,copy:plan.copy,
 width,height,photoFit:'xMidYMin slice; uniform scaling, bottom background crop only, visually reviewed',
 fontFiles,adSha256:sha(png),renderer:'@resvg/resvg-js 2.6.2',
 caveat:'Candidate selection is an editorial development choice, not owner approval or proof of product fidelity. See raw images and visual review.'};
await writeFile(join(out,'provisional-ad.svg'),svg,{flag:'wx'});
await writeFile(join(out,'no-crumbs-provisional-ad.png'),png,{flag:'wx'});
await writeFile(join(out,'recipe.json'),JSON.stringify(recipe,null,2),{flag:'wx'});
console.log('LOCAL PROVISIONAL AD EXPORTED:',join(out,'no-crumbs-provisional-ad.png'),sha(png),'Owner approval false.');
