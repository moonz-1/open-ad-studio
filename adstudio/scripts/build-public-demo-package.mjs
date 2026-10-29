/**
 * Public competition demo package — No Crumbs first, Abel excluded.
 * No inference. No RunPod. Copies + GAD overlays on owner original photography.
 *
 * Output root (separate from RC): C:<home>/open-ad-studio-demo-output
 * Tracked handoff: docs/DEMO_VISUAL_PLAN.md + demo-package/README.md
 */
import {mkdir,readFile,writeFile,copyFile,access} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {Resvg} from '@resvg/resvg-js';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {campaignDesign} from '../../shared/lib/ad-scene.ts';
import {hintsFromPngBytes} from '../../shared/lib/png-luma.ts';
import {resvgFontOptions} from '../../shared/lib/ad-fonts.ts';
import {evaluateFramingQuality} from '../../shared/lib/framing-quality.ts';
import {buildProductIdentityProfile} from '../../shared/lib/product-identity-profile.ts';

const root=resolve('.');
const outRoot=resolve('C:<home>/open-ad-studio-demo-output');
const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const pack=join(outRoot,'public-demo',stamp);
const sha=b=>createHash('sha256').update(b).digest('hex');
const font=resvgFontOptions();
const exists=async p=>{try{await access(p);return true;}catch{return false;}};

const dirs={
  ads:join(pack,'01-public-ads'),
  sources:join(pack,'02-original-photography'),
  compare:join(pack,'03-source-vs-ad'),
  fluxDisclose:join(pack,'04-prior-flux-disclosed'),
  private:join(pack,'99-private-do-not-publish'),
  ui:join(pack,'05-ui-screenshots'),
  video:join(pack,'06-demo-sequence'),
  meta:join(pack,'meta')
};
for(const d of Object.values(dirs))await mkdir(d,{recursive:true});

const SOURCES={
  trayJpeg:join(root,'outputs/fixtures/ltx25-benchmark/inputs/cookie.source.jpeg'),
  trayPng:join(root,'outputs/creative-acceptance/2026-10-28-readiness/previous-cookie-source.png'),
  closeup:join(root,'outputs/creative-acceptance/2026-10-28-readiness/cookie-product-reference.png'),
  fluxCookie:join(root,'outputs/creative-acceptance/2026-10-29T13-34-04/flux3-mi2i-leave-nothing/flux3-mi2i-raw.png'),
  fluxCookieAd:join(root,'outputs/creative-acceptance/2026-10-29T17-18-26/commercial-visual-sprint/nocrumbs-flux-refined.png'),
  fluxCedar:join(root,'outputs/creative-acceptance/2026-10-29T13-57-37/flux3-green-cedar/flux3-mi2i-raw.png'),
  packshot:join(root,'outputs/fixtures/abel/green-cedar.png'),
};

async function pngFromAny(path){
  const buf=await readFile(path);
  if(/\.(jpe?g)$/i.test(path)){
    // Resvg/hints need PNG — re-encode via sharp if present, else keep JPEG for copy and use PNG ads from prior sprint paths
    try{
      const sharp=(await import('sharp')).default;
      return await sharp(buf).png().toBuffer();
    }catch{
      return buf; // may fail decodePng — caller handles
    }
  }
  return buf;
}

function design(base){
  return campaignDesign({
    version:1,id:base.id,name:base.id,brandId:'b',brandRevision:1,brandReviewed:true,
    photoId:'scene',photoConfirmed:true,concept:'editorial',size:'feed',
    brandName:base.brandName,headline:base.headline,body:base.body,cta:base.cta||'',
    website:'',background:base.background,accent:base.accent,textColor:base.textColor
  },base.archetype,'scene','composite',base.graphic);
}

async function renderAd({file,photoBytes,base,outDir}){
  const d=design(base);
  let hints;
  try{hints=hintsFromPngBytes(photoBytes,d.campaign?.graphic?.geometry);}
  catch{hints=d.campaign?.graphic?.geometry?{productBox:d.campaign.graphic.geometry.productBox,copySafe:d.campaign.graphic.geometry.copySafe}:undefined;}
  const photo='data:image/png;base64,'+photoBytes.toString('base64');
  const laid=campaignSVG(d,{photo},1080,1350,hints);
  const png=Buffer.from(new Resvg(laid.svg,{font}).render().asPng());
  await writeFile(join(outDir,file),png);
  let framing=null;
  try{framing=evaluateFramingQuality(photoBytes,{framingMode:'full-product'});}catch{framing={verdict:'UNSUPPORTED',note:String(arguments)};}
  return {
    file,sha256:sha(png),bytes:png.length,
    kind:'original-photography + graphic-art-director',
    notFlux:true,
    strategy:laid.graphicPlan?.strategy,
    framing:framing?.verdict,
    headline:base.headline,brand:base.brandName
  };
}

const manifest={stamp,pack,branchHint:'feat/product-image-realism',rcReadOnly:'http://127.0.0.1:8341 (open-ad-studio-rc-v2 — not modified)',public:[],disclosed:[],private:[],rejected:[]};

// --- Public original photography ---
const publicSources=[];
for(const [key,path,label] of [
  ['tray-foil-wood',SOURCES.trayPng,'Owner product photo — foil tray of cookies on wood (No Crumbs)'],
  ['closeup-texture',SOURCES.closeup,'Owner product photo — tight cookie texture close-up (No Crumbs)'],
]){
  if(!(await exists(path)))continue;
  const buf=await readFile(path);
  const dest=`SOURCE-${key}.png`;
  await copyFile(path,join(dirs.sources,dest));
  publicSources.push({key,dest,label,sha256:sha(buf),path});
  manifest.public.push({role:'original-photography',file:`02-original-photography/${dest}`,label,sha256:sha(buf)});
}
if(await exists(SOURCES.trayJpeg)){
  await copyFile(SOURCES.trayJpeg,join(dirs.sources,'SOURCE-tray-foil-wood.jpeg'));
  const buf=await readFile(SOURCES.trayJpeg);
  manifest.public.push({role:'original-photography',file:'02-original-photography/SOURCE-tray-foil-wood.jpeg',label:'Owner JPEG source (same tray scene)',sha256:sha(buf)});
}

// Prefer PNG for GAD (decode)
const trayBytes=await exists(SOURCES.trayPng)?await readFile(SOURCES.trayPng):null;
const closeBytes=await exists(SOURCES.closeup)?await readFile(SOURCES.closeup):null;

const ads=[];
if(trayBytes){
  const a=await renderAd({
    file:'AD-nocrumbs-tray-refined-product.png',
    photoBytes:trayBytes,
    outDir:dirs.ads,
    base:{
      id:'nc-tray',brandName:'No Crumbs Bakery',headline:'Leave Nothing Behind',
      body:'Thick, irregular cookies meant to be finished.',cta:'Taste the real thing',
      background:'#1a1410',accent:'#c4783a',textColor:'#fffaf0',
      archetype:'food-editorial',
      graphic:{
        strategy:'refined-product',showCta:true,showBody:true,showBrand:true,placement:'upper-left',
        geometry:{productBox:{x:0.22,y:0.12,width:0.56,height:0.76},copySafe:{x:0.06,y:0.04,width:0.55,height:0.22}}
      }
    }
  });
  ads.push(a);
  await copyFile(join(dirs.ads,a.file),join(dirs.compare,a.file));
  await copyFile(join(dirs.sources,'SOURCE-tray-foil-wood.png'),join(dirs.compare,'SOURCE-tray-foil-wood.png'));
  manifest.public.push({role:'final-advertisement',file:`01-public-ads/${a.file}`,...a,
    claim:'Original owner photography with Graphic Art Director typography. NOT a FLUX generation.'});
}

if(closeBytes){
  const a=await renderAd({
    file:'AD-nocrumbs-closeup-refined-product.png',
    photoBytes:closeBytes,
    outDir:dirs.ads,
    base:{
      id:'nc-close',brandName:'No Crumbs Bakery',headline:'Leave Nothing Behind',
      body:'Share the last bite.',cta:'Taste the real thing',
      background:'#14110f',accent:'#9a5528',textColor:'#fffaf0',
      archetype:'food-editorial',
      graphic:{
        strategy:'refined-product',showCta:true,showBody:true,showBrand:true,placement:'upper-left',
        geometry:{productBox:{x:0.08,y:0.1,width:0.84,height:0.8},copySafe:{x:0.05,y:0.04,width:0.5,height:0.24}}
      }
    }
  });
  ads.push(a);
  manifest.public.push({role:'final-advertisement',file:`01-public-ads/${a.file}`,...a,
    claim:'Original owner close-up with Graphic Art Director. NOT FLUX. Tight crop — framing gate may FAIL full-product mode by design.'});
}

// Playful variant on tray for brand-distinctiveness evidence
if(trayBytes){
  const a=await renderAd({
    file:'AD-nocrumbs-tray-playful.png',
    photoBytes:trayBytes,
    outDir:dirs.ads,
    base:{
      id:'nc-play',brandName:'No Crumbs Bakery',headline:'Leave Nothing Behind',
      body:'Made to be finished.',cta:'Get yours',
      background:'#1a1410',accent:'#e8a05c',textColor:'#fffaf0',
      archetype:'food-editorial',
      graphic:{
        strategy:'playful-expressive',showCta:true,showBody:true,showBrand:true,placement:'upper-left',
        geometry:{productBox:{x:0.22,y:0.12,width:0.56,height:0.76},copySafe:{x:0.06,y:0.04,width:0.55,height:0.22}}
      }
    }
  });
  ads.push(a);
  manifest.public.push({role:'final-advertisement-variant',file:`01-public-ads/${a.file}`,...a,
    claim:'Same original photo; playful strategy — shows brand-adaptive type (not luxury serif).'});
}

// --- Prior FLUX: disclosed only, not hero ---
if(await exists(SOURCES.fluxCookie)){
  await copyFile(SOURCES.fluxCookie,join(dirs.fluxDisclose,'PRIOR-FLUX-cookie-raw.png'));
  const raw=await readFile(SOURCES.fluxCookie);
  const framing=evaluateFramingQuality(raw,{framingMode:'full-product'});
  let identity='NOT_COMPARED';
  if(closeBytes){
    const {verifyProductIdentity}=await import('../../shared/lib/product-identity-verify.ts');
    const id=verifyProductIdentity({referenceBytes:closeBytes,generatedBytes:raw,categoryHint:'baked-good',foodIrregular:true,aspectTolerance:0.18});
    identity=id.verdict;
  }
  const note={
    file:'04-prior-flux-disclosed/PRIOR-FLUX-cookie-raw.png',
    kind:'prior-flux3-inference',
    liveInference:false,
    framing:framing.verdict,
    identityVsOwnerCloseup:identity,
    publishAsHero:false,
    reason:'Documented prior FLUX output for provenance. Identity and/or framing gates do not clear this as a product-accurate advertisement. Do not present as a new live generation.'
  };
  await writeFile(join(dirs.fluxDisclose,'README.txt'),[
    'PRIOR FLUX — DISCLOSURE ONLY',
    '============================',
    'These files are recorded prior FLUX.3 inference pixels.',
    'They are NOT a live generation for this demo package.',
    'Do NOT present them as the primary competition advertisement.',
    `Cookie raw framing: ${framing.verdict}`,
    `Cookie identity vs owner close-up: ${identity}`,
    'Hero ads are in 01-public-ads/ (original photography + Graphic Art Director).',
    ''
  ].join('\n'));
  manifest.disclosed.push(note);
  manifest.rejected.push({file:note.file,why:`framing=${framing.verdict}; identity=${identity} — rejected as primary public ad`});
}
if(await exists(SOURCES.fluxCookieAd)){
  await copyFile(SOURCES.fluxCookieAd,join(dirs.fluxDisclose,'PRIOR-FLUX-cookie-with-GAD-overlay.png'));
  manifest.disclosed.push({file:'04-prior-flux-disclosed/PRIOR-FLUX-cookie-with-GAD-overlay.png',note:'GAD overlay on prior FLUX raw — still inherits product-fidelity limits of the raw.'});
}

// --- Abel private ---
await writeFile(join(dirs.private,'README.txt'),[
  'PRIVATE — DO NOT PUBLISH',
  '========================',
  'Abel / Green Cedar packshot and FLUX outputs are third-party brand material',
  'used only for internal product-identity benchmarking unless the owner obtains',
  'explicit publication permission. Keep this folder out of the public submission,',
  'social posts, and demo video.',
  ''
].join('\n'));
if(await exists(SOURCES.packshot)){
  await copyFile(SOURCES.packshot,join(dirs.private,'abel-packshot-PRIVATE.png'));
  manifest.private.push({file:'99-private-do-not-publish/abel-packshot-PRIVATE.png',rights:'third-party; private benchmark only'});
}
if(await exists(SOURCES.fluxCedar)){
  await copyFile(SOURCES.fluxCedar,join(dirs.private,'abel-flux-raw-PRIVATE.png'));
  manifest.private.push({file:'99-private-do-not-publish/abel-flux-raw-PRIVATE.png',rights:'third-party; prior FLUX; private only'});
}

// --- Gallery HTML ---
const html=`<!doctype html><meta charset="utf-8"/><title>Open Ad Studio — public demo gallery</title>
<style>
:root{--bg:#111;--ink:#f3eee6;--mute:#9a948a;--acc:#c4783a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif}
header{padding:32px 28px 12px;max-width:1100px}h1{font-weight:600;font-size:28px;margin:0 0 8px;letter-spacing:-.02em}
.mute{color:var(--mute);max-width:62ch}.banner{margin:16px 28px;padding:12px 14px;background:#2a2118;border-left:3px solid var(--acc);max-width:1040px}
section{padding:8px 28px 28px}h2{font-size:18px;font-weight:600;margin:24px 0 12px}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
figure{margin:0;background:#1a1a1a}img{width:100%;display:block;background:#000}
figcaption{padding:10px 12px;font-size:12px;color:var(--mute)}.tag{display:inline-block;border:1px solid #444;padding:1px 6px;margin:0 4px 4px 0;font-size:10px;letter-spacing:.04em;text-transform:uppercase}
.reject{opacity:.55}
</style>
<header>
<h1>Open Ad Studio — public demo gallery</h1>
<p class="mute">Owner-authorized <strong>No Crumbs Bakery</strong> photography with Graphic Art Director typography. Abel assets are excluded from this public set.</p>
</header>
<div class="banner"><strong>Honest labels:</strong> Ads below are <em>original photography + layout</em>. They are <strong>not</strong> FLUX generations. Prior FLUX files (if present) live under <code>04-prior-flux-disclosed/</code> with gate failures documented — not heroes.</div>
<section>
<h2>1 · Final public advertisements</h2>
<div class="grid">
${ads.map(a=>`<figure><img src="../01-public-ads/${a.file}"/><figcaption><span class="tag">original photo + GAD</span><span class="tag">${a.strategy}</span><br/>${a.file}<br/>framing gate: ${a.framing}</figcaption></figure>`).join('')}
</div>
<h2>2 · Original photography</h2>
<div class="grid">
${publicSources.map(s=>`<figure><img src="../02-original-photography/${s.dest}"/><figcaption><span class="tag">owner photo</span>${s.label}</figcaption></figure>`).join('')}
</div>
<h2>3 · Prior FLUX (disclosed — not primary)</h2>
<p class="mute">See folder <code>04-prior-flux-disclosed/</code>. Do not stage these as live inference in the demo video.</p>
</section>`;
await writeFile(join(pack,'gallery.html'),html);

// Demo sequence storyboard (for video assembly / screen record)
const beats=[
  {t:'0:00–0:10',title:'Open Journey',action:'Show http://127.0.0.1:8341/adstudio/journey.html (RC read-only). Say: Open Ad Studio turns authorized product photos into reviewed ad concepts.'},
  {t:'0:10–0:25',title:'Brand + original photo',action:'Show No Crumbs brand / import owner tray photo. On-screen: ORIGINAL PHOTOGRAPHY.'},
  {t:'0:25–0:40',title:'Concept + planner label',action:'Show concept selection. Disclose actual planner (Qwen if live result; else deterministic). Never fake AI.'},
  {t:'0:40–0:55',title:'Graphic advertisement',action:`Cut to ${ads[0]?.file||'public ad'} — label ORIGINAL PHOTO + GRAPHIC ART DIRECTOR. Not FLUX.`},
  {t:'0:55–1:10',title:'Edit + export',action:'Edit headline/body in UI if available; Export PNG; show file.'},
  {t:'1:10–1:25',title:'Provenance + persistence',action:'Show project reopen / history. Optional: flash disclosed prior FLUX folder with text PRIOR RESULT — NOT LIVE.'},
  {t:'1:25–1:30',title:'Close',action:'One-liner: evidence → review → editable campaign → local export. Open weights / Comfy SDK.'}
];
await writeFile(join(dirs.video,'STORYBOARD.md'),['# 60–90s demo sequence (public-safe)', '',
  'Silent or owner-narrated. No Abel. No staged live FLUX.', '',
  ...beats.map(b=>`## ${b.t} — ${b.title}\n${b.action}\n`),
  '## Assembly options','1. Screen-record RC Journey following this board.','2. Or stitch stills in `01-public-ads` + `05-ui-screenshots` with captions.','3. Do not replay FLUX artifacts as if Generate just finished.',''
].join('\n'));

await writeFile(join(dirs.video,'CAPTIONS.txt'),[
  'ORIGINAL PHOTOGRAPHY',
  'GRAPHIC ART DIRECTOR LAYOUT',
  'NOT A FLUX GENERATION',
  'OWNER-AUTHORIZED · NO CRUMBS BAKERY',
  'PRIOR FLUX RESULTS · DISCLOSED SEPARATELY',
  'ABEL ASSETS · PRIVATE — NOT IN THIS DEMO'
].join('\n'));

await writeFile(join(dirs.meta,'manifest.json'),JSON.stringify(manifest,null,2));
await writeFile(join(dirs.meta,'PROVENANCE.md'),`# Provenance

Generated: ${stamp}
Builder: adstudio/scripts/build-public-demo-package.mjs
Image worktree tip: confirm with git rev-parse HEAD
RC (read-only reference): open-ad-studio-rc-v2 @ release/final-rc-20261029 — **not modified**

## Licensing / rights
- No Crumbs Bakery imagery: owner-controlled product photography — approved for public competition demo.
- Abel / Green Cedar: third-party — **private only** (folder 99).
- Typography: OFL fonts bundled in shared/fonts.
- Prior FLUX outputs: model inference artifacts from earlier authorized runs; not new spend in this package.

## What we claim
- App can compose reviewed advertisements from authorized originals + Graphic Art Director.
- Product identity and framing gates exist and can reject weak generative results.
- Live Qwen planning may be demonstrated on RC separately (Codex lane); this package does not invent that result.

## What we do NOT claim
- That public hero ads are FLUX photographs.
- That prior FLUX cookie outputs pass identity vs owner reference.
- Live FLUX photographic quality acceptance for submission.
- Abel publication rights.
`);

await writeFile(join(pack,'README.md'),`# Open Ad Studio — public demo package

**Stamp:** ${stamp}
**Root:** \`${pack}\`

## Use this for competition materials
1. Open \`gallery.html\`
2. Hero ads: \`01-public-ads/\`
3. Sources: \`02-original-photography/\`
4. UI captures: \`05-ui-screenshots/\` (filled by capture script)
5. Video board: \`06-demo-sequence/STORYBOARD.md\`
6. Do **not** publish \`99-private-do-not-publish/\`

## Quick claims check
| Asset | OK to show publicly? |
|-------|----------------------|
| No Crumbs original + GAD ads | Yes |
| Prior FLUX cookie | Only with disclosure; not as hero |
| Abel anything | No |
`);

// Convenience pointer at demo-output root
await writeFile(join(outRoot,'LATEST.txt'),pack+'\n');
await writeFile(join(outRoot,'README.md'),`# open-ad-studio-demo-output

Separate from Codex RC. Built by the image-realism worktree.

Latest package: see LATEST.txt

Do not put secrets, .env, Abel-public claims, or synthetic fixtures labeled as FLUX here.
`);

console.log(JSON.stringify({pack,ads:ads.map(a=>a.file),publicCount:manifest.public.length,rejected:manifest.rejected},null,2));
