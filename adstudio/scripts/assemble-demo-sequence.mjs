/**
 * Build an honest HTML demo reel + optional Playwright WebM capture.
 * No inference. Uses public demo package assets only.
 */
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile,copyFile,access} from 'node:fs/promises';
import {join} from 'node:path';

const pack=process.argv[2]||'C:<home>/open-ad-studio-demo-output/public-demo/2026-10-29T20-21-57';
const seq=join(pack,'06-demo-sequence');
await mkdir(seq,{recursive:true});
const exists=async p=>{try{await access(p);return true;}catch{return false;}};

const slides=[
  {file:'slide-01-title.png',dur:4,from:null,title:'Open Ad Studio',sub:'Authorized product photos → reviewed ad concepts → local export',caption:'PUBLIC DEMO · NO CRUMBS BAKERY'},
  {file:'slide-02-ui-create.png',dur:7,from:'05-ui-screenshots/01-journey-create.png',title:'Customer Journey',sub:'Real RC UI — Create step',caption:'SCREEN CAPTURE · NOT GENERATED'},
  {file:'slide-03-ui-introduce.png',dur:7,from:'05-ui-screenshots/03-journey-introduce.png',title:'Brand + photograph',sub:'Website or product photo · originals stay local',caption:'SCREEN CAPTURE'},
  {file:'slide-04-ui-workspace.png',dur:6,from:'05-ui-screenshots/04-classic-workspace.png',title:'Workspace',sub:'Discover brand · upload original · develop direction',caption:'SCREEN CAPTURE'},
  {file:'slide-05-source.png',dur:6,from:'02-original-photography/SOURCE-tray-foil-wood.png',title:'Original photography',sub:'Owner-authorized No Crumbs product photo',caption:'ORIGINAL PHOTO · NOT FLUX'},
  {file:'slide-06-ad-hero.png',dur:9,from:'01-public-ads/AD-nocrumbs-tray-headline-only.png',title:'Finished advertisement',sub:'Graphic Art Director typography on the original photo',caption:'ORIGINAL PHOTO + LAYOUT · NOT A FLUX GENERATION'},
  {file:'slide-07-ad-cta.png',dur:7,from:'01-public-ads/AD-nocrumbs-tray-refined-product.png',title:'Editable campaign copy',sub:'Brand · headline · quiet text-link CTA',caption:'SAME ORIGINAL PHOTO · GRAPHIC OVERLAY'},
  {file:'slide-08-compare.png',dur:7,from:null,title:'Source beside result',sub:'Left: original · Right: advertisement',caption:'HONEST COMPARISON'},
  {file:'slide-09-limits.png',dur:8,from:null,title:'What this demo does not claim',sub:'No live FLUX replay · Abel private · prior FLUX cookie fails identity/framing gates',caption:'LIMITATIONS'},
  {file:'slide-10-close.png',dur:5,from:null,title:'Evidence → review → export',sub:'Comfy SDK · open weights · project persistence',caption:'#OpenSourceHiggsfield'},
];

// Compose caption slides as simple HTML screenshots via Playwright
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});

async function titleCard(title,sub,caption,bg='#0e0e0e'){
  await page.setContent(`<!doctype html><style>
  html,body{margin:0;height:100%;background:${bg};color:#f3eee6;font-family:Georgia,"Times New Roman",serif}
  .wrap{display:flex;flex-direction:column;justify-content:center;height:100%;padding:64px 72px}
  .cap{font:600 12px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#c4783a;margin-bottom:28px}
  h1{font-weight:500;font-size:54px;line-height:1.1;margin:0 0 18px;max-width:16ch}
  p{font:400 22px/1.35 system-ui,sans-serif;color:#bdb6aa;margin:0;max-width:36ch}
  </style><div class="wrap"><div class="cap">${caption}</div><h1>${title}</h1><p>${sub}</p></div>`);
  return page.screenshot({type:'png'});
}

async function imageCard(imgPath,title,sub,caption){
  const b64=(await readFile(join(pack,imgPath))).toString('base64');
  const mime=/\.jpe?g$/i.test(imgPath)?'image/jpeg':'image/png';
  await page.setContent(`<!doctype html><style>
  html,body{margin:0;height:100%;background:#0a0a0a;color:#f3eee6;font-family:system-ui,sans-serif;display:grid;grid-template-columns:1.1fr .9fr}
  .img{background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}
  img{max-width:100%;max-height:100%;object-fit:contain}
  .copy{padding:56px 48px;display:flex;flex-direction:column;justify-content:center}
  .cap{font:600 11px/1.2 system-ui;letter-spacing:.14em;text-transform:uppercase;color:#c4783a;margin-bottom:22px}
  h1{font:500 36px/1.15 Georgia,serif;margin:0 0 14px}
  p{font:400 18px/1.4 system-ui;color:#bdb6aa;margin:0}
  </style><div class="img"><img src="data:${mime};base64,${b64}"/></div><div class="copy"><div class="cap">${caption}</div><h1>${title}</h1><p>${sub}</p></div>`);
  return page.screenshot({type:'png'});
}

async function compareCard(){
  const left=join(pack,'02-original-photography/SOURCE-tray-foil-wood.png');
  const right=join(pack,'01-public-ads/AD-nocrumbs-tray-headline-only.png');
  if(!(await exists(left))||!(await exists(right)))return titleCard('Source beside result','Missing compare assets','COMPARISON');
  const L=(await readFile(left)).toString('base64');
  const R=(await readFile(right)).toString('base64');
  await page.setContent(`<!doctype html><style>
  html,body{margin:0;height:100%;background:#0a0a0a;color:#f3eee6;font-family:system-ui,sans-serif}
  .top{padding:28px 40px 8px}.cap{font:600 11px/1;letter-spacing:.14em;text-transform:uppercase;color:#c4783a}
  h1{font:500 28px/1.2 Georgia,serif;margin:10px 0 0}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:18px 40px 40px;height:calc(100% - 110px)}
  figure{margin:0;background:#111;display:flex;flex-direction:column;min-height:0}
  img{width:100%;height:100%;object-fit:contain;background:#000;flex:1}
  figcaption{padding:10px 12px;font-size:12px;color:#9a948a}
  </style><div class="top"><div class="cap">HONEST COMPARISON</div><h1>Original photograph → advertisement</h1></div>
  <div class="grid">
  <figure><img src="data:image/png;base64,${L}"/><figcaption>ORIGINAL · owner product photo</figcaption></figure>
  <figure><img src="data:image/png;base64,${R}"/><figcaption>AD · original photo + Graphic Art Director · NOT FLUX</figcaption></figure>
  </div>`);
  return page.screenshot({type:'png'});
}

const timeline=[];
for(const s of slides){
  let buf;
  if(s.file.includes('compare'))buf=await compareCard();
  else if(s.file.includes('limits')||s.file.includes('title')||s.file.includes('close')||!s.from)buf=await titleCard(s.title,s.sub,s.caption);
  else if(await exists(join(pack,s.from)))buf=await imageCard(s.from,s.title,s.sub,s.caption);
  else buf=await titleCard(s.title,s.sub+ ' (asset missing)',s.caption);
  await writeFile(join(seq,s.file),buf);
  timeline.push({file:s.file,durationSec:s.dur,title:s.title,caption:s.caption});
  console.log('slide',s.file);
}

const total=timeline.reduce((a,s)=>a+s.durationSec,0);
const html=`<!doctype html><meta charset="utf-8"/><title>Open Ad Studio demo sequence (~${total}s)</title>
<style>html,body{margin:0;background:#000;height:100%;overflow:hidden}img{width:100%;height:100%;object-fit:contain;display:none}img.on{display:block}
.badge{position:fixed;left:16px;bottom:14px;color:#c4783a;font:600 11px/1 system-ui;letter-spacing:.12em;text-transform:uppercase;opacity:.85}</style>
${timeline.map((t,i)=>`<img ${i===0?'class="on"':''} src="${t.file}" data-dur="${t.durationSec}" alt="${t.title}"/>`).join('\n')}
<div class="badge">DRAFT DEMO SEQUENCE · NOT LIVE INFERENCE</div>
<script>
const imgs=[...document.querySelectorAll('img')];
let i=0;
function next(){imgs[i].classList.remove('on');i=(i+1)%imgs.length;imgs[i].classList.add('on');setTimeout(next, (+imgs[i].dataset.dur||5)*1000);}
setTimeout(next,(+imgs[0].dataset.dur||5)*1000);
</script>`;
await writeFile(join(seq,'index.html'),html);
await writeFile(join(seq,'timeline.json'),JSON.stringify({totalSec:total,target:'60-90s',slides:timeline,note:'Stills + RC UI captures. Open index.html and screen-record, or use Playwright WebM below.'},null,2));

// Record WebM of the autoplaying sequence
const videoDir=join(seq,'recording');
await mkdir(videoDir,{recursive:true});
const context=await browser.newContext({
  viewport:{width:1280,height:720},
  recordVideo:{dir:videoDir,size:{width:1280,height:720}}
});
const rec=await context.newPage();
await rec.goto('file:///'+join(seq,'index.html').replace(/\\/g,'/'),{waitUntil:'load'});
await rec.waitForTimeout((Math.min(total,88)+2)*1000);
await context.close();
// Playwright names video randomly — rename
const {readdir}=await import('node:fs/promises');
const vids=(await readdir(videoDir)).filter(f=>f.endsWith('.webm'));
if(vids[0]){
  const dest=join(seq,'open-ad-studio-demo-draft.webm');
  await copyFile(join(videoDir,vids[0]),dest);
  console.log('webm',dest);
}
await browser.close();
console.log(JSON.stringify({seq,totalSec:total,slides:timeline.length},null,2));
