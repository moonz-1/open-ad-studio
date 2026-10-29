/**
 * One-step installer: `npm run setup`.
 *
 * 1. Installs npm dependencies if needed.
 * 2. Finds a running or installed ComfyUI and connects to it, or installs a private copy under .runtime/.
 * 3. Looks through every ComfyUI models folder it can find and reuses models you already have.
 * 4. Downloads only what's missing: the best model packs your GPU can run.
 *
 * Only Node built-ins are imported here, so this runs before `npm install`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, statfsSync, writeFileSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { homedir, totalmem } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { RuntimeSetup } from './setup.ts';
import { existingComfyLaunch } from './comfy-launch.ts';
import { startComfyProxy } from './proxy.ts';
import { downloadModels, validModel, type ModelFile, type ModelPack } from './model-download.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const HELP = `Usage: npm run setup [-- options]

  --quality          Download the best models even if your GPU looks too small for them
  --fast             Use the small, fast development models instead
  --no-audio         Skip the audio model
  --models-dir DIR   Download new models into this ComfyUI models folder
  --comfy-url URL    Connect to ComfyUI at this address (default: detect)
  --yes              Don't ask questions; accept the plan
  --dry-run          Show the plan without installing or downloading anything
`;
const { values: args } = parseArgs({ options: {
  quality: { type: 'boolean' }, fast: { type: 'boolean' }, 'no-audio': { type: 'boolean' }, yes: { type: 'boolean' }, 'dry-run': { type: 'boolean' },
  'models-dir': { type: 'string' }, 'comfy-url': { type: 'string' }, help: { type: 'boolean', short: 'h' },
} });
if (args.help) { console.log(HELP); process.exit(0); }

const tty = process.stdin.isTTY && !args.yes;
const say = (text = '') => console.log(text);
const step = (text: string) => say(`\n▸ ${text}`);
const fail = (text: string): never => { console.error(`\n✗ ${text}`); process.exit(1); };
async function ask(question: string, fallback = ''): Promise<string> {
  if (!tty) return fallback;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(question)).trim() || fallback; } finally { rl.close(); }
}
const yes = async (question: string, fallback = true) => tty ? /^y/i.test(await ask(`${question} ${fallback ? '[Y/n]' : '[y/N]'} `, fallback ? 'y' : 'n')) : fallback;

// ---------- 1. Node and npm dependencies ----------
const [major, minor] = process.versions.node.split('.').map(Number);
if (major! < 22 || (major === 22 && minor! < 18)) fail(`Node.js 22.18 or newer is required (you have ${process.versions.node}). Get it from https://nodejs.org/`);

const env: Record<string, string | undefined> = { ...process.env };
try {
  for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && env[match[1]!] === undefined) env[match[1]!] = match[2]!.replace(/^(['"])(.*)\1$/, '$2');
  }
} catch { /* .env is optional */ }

say('Open Ad Studio setup');
if (!existsSync(join(ROOT, 'node_modules/@comfyorg/sdk'))) {
  step('Installing app dependencies (npm install)…');
  if (!args['dry-run']) {
    const win = process.platform === 'win32';
    const result = spawnSync(win ? 'npm.cmd' : 'npm', ['install'], { cwd: ROOT, stdio: 'inherit', shell: win });
    if (result.status !== 0) fail('npm install failed. Check the messages above, then run setup again.');
  }
} else step('App dependencies are installed.');

// ---------- 2. ComfyUI ----------
const setup = new RuntimeSetup(ROOT, env, e => startComfyProxy(ROOT, e, { detached: true }), () => {});
async function runTask(start: () => unknown) {
  start();
  let last = '';
  while (setup.task.busy) {
    const t = setup.task;
    const line = `  ${t.message}`;
    if (line !== last) { process.stdout.write(`\r${line.slice(0, 110).padEnd(110)}`); last = line; }
    await new Promise(r => setTimeout(r, 400));
  }
  process.stdout.write('\n');
  if (setup.task.phase !== 'ready') fail(`${setup.task.error || setup.task.message}\n  Recent output:\n    ${setup.task.log.slice(-6).join('\n    ')}`);
}
async function reachable(url: string) {
  try { const r = await fetch(url + '/system_stats', { signal: AbortSignal.timeout(2500) }); return r.ok ? await r.json() : null; } catch { return null; }
}
function openUrl(url: string) {
  if (!tty) return;
  const [cmd, a] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(cmd as string, a as string[], { stdio: 'ignore', detached: true }).unref(); } catch { /* no browser */ }
}
function detectGpu(): 'nvidia' | 'apple' | 'cpu' {
  if (process.platform === 'darwin' && process.arch === 'arm64') return 'apple';
  try { if (spawnSync('nvidia-smi', ['-L'], { encoding: 'utf8' }).status === 0) return 'nvidia'; } catch { /* no NVIDIA driver */ }
  return 'cpu';
}

step('Looking for ComfyUI…');
const launcher = existingComfyLaunch(ROOT, env, setup.config?.launchDirectory);
let comfyUrl = args['comfy-url'] || setup.config?.url || '';
if (!comfyUrl) for (const candidate of ['http://127.0.0.1:8188', 'http://127.0.0.1:8000']) if (await reachable(candidate)) { comfyUrl = candidate; break; }

if (args['dry-run']) {
  say(comfyUrl ? `  Would use ComfyUI at ${comfyUrl}.` : launcher ? `  Would start your ComfyUI in ${launcher.directory}.` : `  Would install ComfyUI into .runtime/ComfyUI (${detectGpu()}).`);
} else if (setup.config && !args['comfy-url']) {
  say(`  Using your saved setup (${setup.config.mode === 'managed' ? 'ComfyUI installed by this app' : setup.config.url}).`);
  await runTask(() => setup.start());
} else if (comfyUrl && await reachable(comfyUrl)) {
  say(`  Found ComfyUI running at ${comfyUrl}.`);
  await runTask(() => setup.connect({ url: comfyUrl }));
} else if (launcher) {
  say(`  Found ComfyUI installed at ${launcher.directory}. Starting it…`);
  await runTask(() => setup.start());
} else {
  const gpu = detectGpu();
  say(`  No ComfyUI found. Installing a private copy into .runtime/ComfyUI (${gpu === 'nvidia' ? 'NVIDIA GPU' : gpu === 'apple' ? 'Apple Silicon' : 'CPU only'}).`);
  say('  This downloads a few GB of software.');
  if (!await yes('  Continue?')) fail('Stopped. If you already have ComfyUI, start it and run setup again.');
  await prerequisites();
  await runTask(() => setup.install({ gpu }));
}
comfyUrl = setup.config?.url || comfyUrl;

async function prerequisites() {
  const works = (exe: string, a: string[]) => { try { return spawnSync(exe, a, { stdio: 'ignore' }).status === 0; } catch { return false; } };
  const python = process.platform === 'win32' ? works('py', ['-3.12', '--version']) || works('py', ['-3.13', '--version']) : works('python3', ['-c', 'import sys; assert (3,12)<=sys.version_info[:2]<(3,14)']);
  const git = works('git', ['--version']);
  const missing = [!python && 'Python 3.12', !git && 'Git'].filter(Boolean) as string[];
  if (!missing.length) return;
  const manager = process.platform === 'win32' && works('winget', ['--version']) ? 'winget' : process.platform === 'darwin' && works('brew', ['--version']) ? 'brew' : '';
  if (!manager) fail(`Please install ${missing.join(' and ')} first (python.org and git-scm.com), then run setup again.`);
  if (!await yes(`  ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} needed. Install with ${manager}?`)) fail(`Install ${missing.join(' and ')}, then run setup again.`);
  const ids = manager === 'winget' ? { 'Python 3.12': 'Python.Python.3.12', Git: 'Git.Git' } : { 'Python 3.12': 'python@3.12', Git: 'git' };
  for (const name of missing) {
    const id = ids[name as keyof typeof ids];
    const result = manager === 'winget'
      ? spawnSync('winget', ['install', '--id', id, '-e', '--accept-package-agreements', '--accept-source-agreements'], { stdio: 'inherit' })
      : spawnSync('brew', ['install', id], { stdio: 'inherit' });
    if (result.status !== 0) fail(`Installing ${name} failed. Install it yourself, then run setup again.`);
  }
  say('  Installed. If setup does not find them yet, close this window and start again so the new PATH is picked up.');
}

// ---------- 3. Find models you already have ----------
step('Looking for models you already have…');
const roots = new Set<string>();
const addRoot = (path: string | undefined) => { if (path && existsSync(path)) roots.add(resolve(path)); };
addRoot(args['models-dir']); addRoot(setup.config?.modelsDir); addRoot(env.COMFYUI_MODELS_DIR);
const comfyDir = setup.config?.launchDirectory || launcher?.directory || (setup.config?.mode === 'managed' ? join(ROOT, '.runtime/ComfyUI') : undefined);
if (comfyDir) addRoot(join(comfyDir, 'models'));
// ComfyUI's extra_model_paths.yaml (and Desktop's copies) point at shared model folders.
const yamls = [...(launcher?.modelPaths || []), ...(comfyDir ? [join(comfyDir, 'extra_model_paths.yaml')] : [])];
const desktopYamls = join(homedir(), 'AppData/Roaming/Comfy Desktop/instance-model-paths');
if (existsSync(desktopYamls)) for (const name of readdirSync(desktopYamls)) if (/\.ya?ml$/i.test(name)) yamls.push(join(desktopYamls, name));
for (const yaml of yamls) {
  try {
    for (const match of readFileSync(yaml, 'utf8').matchAll(/^\s*base_path:\s*['"]?(.+?)['"]?\s*$/gm)) { addRoot(match[1]); addRoot(join(match[1]!, 'models')); }
  } catch { /* unreadable yaml */ }
}
addRoot(join(homedir(), 'AppData/Local/Comfy-Desktop/ComfyUI-Shared/models'));

const have = new Map<string, string>();
function scan(dir: string, depth: number) {
  let entries; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && depth > 0 && !entry.name.startsWith('.')) scan(path, depth - 1);
    else if (entry.isFile() && /\.(safetensors|sft|ckpt|gguf)$/i.test(entry.name) && !have.has(entry.name)) have.set(entry.name, path);
  }
}
for (const root of roots) scan(root, 3);
// Anything ComfyUI itself can see (covers folders we couldn't find on disk).
if (comfyUrl && await reachable(comfyUrl)) {
  try {
    const categories = await fetch(comfyUrl + '/models').then(r => r.json()) as string[];
    for (const category of categories) for (const file of await fetch(comfyUrl + '/models/' + category).then(r => r.json()) as string[]) {
      const name = basename(file.replaceAll('\\', '/')); if (!have.has(name)) have.set(name, `${category}/${file}`);
    }
  } catch { /* older ComfyUI */ }
}
say(`  Checked ${roots.size} folder${roots.size === 1 ? '' : 's'}; found ${have.size} model file${have.size === 1 ? '' : 's'}.`);

// ---------- 4. Pick the best packs for this machine ----------
const manifest = JSON.parse(readFileSync(join(ROOT, 'shared/runtime/models.json'), 'utf8')) as { packs: ModelPack[]; models: ModelFile[] };
const filesOf = (pack: ModelPack) => manifest.models.filter(m => m.used_by === pack.id);
const present = (file: ModelFile) => [basename(file.file), ...(file.alternates || [])].some(name => have.has(name));
const installed = (pack: ModelPack) => filesOf(pack).every(present);

async function vramGB(): Promise<{ gb: number; name: string }> {
  const stats = comfyUrl ? await reachable(comfyUrl) : null;
  const device = stats?.devices?.find((d: any) => d.type !== 'cpu');
  if (device?.vram_total) return { gb: device.vram_total / 2 ** 30, name: String(device.name || 'GPU').replace(/^cuda:\d+\s*/, '') };
  if (process.platform === 'darwin' && process.arch === 'arm64') return { gb: (totalmem() / 2 ** 30) * 0.75, name: 'Apple Silicon (shared memory)' };
  try {
    const out = spawnSync('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'], { encoding: 'utf8' });
    const [name, mb] = out.stdout.split('\n')[0]!.split(',');
    if (Number(mb)) return { gb: Number(mb) / 1024, name: name!.trim() };
  } catch { /* no NVIDIA driver */ }
  return { gb: 0, name: 'no GPU detected' };
}
const gpu = await vramGB();
step(`Your GPU: ${gpu.name}${gpu.gb ? ` · ${gpu.gb.toFixed(0)} GB` : ''}`);

const tierRank = { best: 0, balanced: 1, fast: 2 } as const;
let token = env.HF_TOKEN || env.HUGGING_FACE_HUB_TOKEN || '';
type Plan = { pack: ModelPack; reuse: boolean; missing: ModelFile[] };
const plan: Plan[] = [];
for (const capability of ['video', 'image', 'audio'] as const) {
  if (capability === 'audio' && args['no-audio']) continue;
  const options = manifest.packs.filter(p => p.capability === capability && !p.optIn).sort((a, b) => tierRank[a.tier] - tierRank[b.tier]);
  let target = args.fast ? options.find(p => p.tier === 'fast') || options.at(-1)!
    : args.quality ? options[0]!
    : options.find(p => p.tier !== 'fast' && p.minVramGB <= gpu.gb + 0.5) || options.filter(p => p.tier !== 'fast').at(-1) || options[0]!;
  if (!args.fast && !args.quality && target !== options[0] && !options.some(p => installed(p) && p.tier === 'best')
    && await yes(`  Your GPU is small for ${options[0]!.label}. Download it anyway? It will be slow.`, false)) target = options[0]!;
  // Reuse anything already installed that's at least as good as the target.
  const owned = options.find(p => installed(p) && tierRank[p.tier] <= tierRank[target.tier]);
  if (owned) { plan.push({ pack: owned, reuse: true, missing: [] }); continue; }
  if (target.gated && !token && !args['dry-run']) {
    say(`\n  ${target.label} is the best fit, but it's gated on Hugging Face.`);
    say('  Opening the license page in your browser: sign in, accept it, then create a read token.');
    openUrl('https://huggingface.co/Lightricks/LTX-2.5'); openUrl('https://huggingface.co/settings/tokens/new?tokenType=read');
    token = await ask('  Paste your token (or press Enter to use a smaller model instead): ');
    if (token) {
      const answer = await yes('  Save it to .env so you are not asked again?');
      if (answer) { const path = join(ROOT, '.env'); const text = existsSync(path) ? readFileSync(path, 'utf8') : ''; writeFileSync(path, `${text}${text && !text.endsWith('\n') ? '\n' : ''}HF_TOKEN=${token}\n`); }
    } else target = options.find(p => !p.gated && tierRank[p.tier] >= tierRank[target.tier]) || target;
  }
  plan.push({ pack: target, reuse: false, missing: filesOf(target).filter(f => !present(f)) });
}

// A file can appear in two packs (shared text encoders); download it once.
const downloads = [...new Map(plan.flatMap(p => p.missing).map(f => [f.file, f])).values()];
const neededGB = downloads.reduce((n, f) => n + f.size_gb, 0);
step('Plan');
for (const item of plan) say(`  ${item.reuse ? '✓ reuse   ' : '↓ download'}  ${item.pack.label}${item.reuse ? '' : ` · ${item.missing.reduce((n, f) => n + f.size_gb, 0).toFixed(1)} GB`}`);
for (const item of plan) if (!item.reuse && item.pack.note) say(`  Note: ${item.pack.note}`);

if (!downloads.length) { await extras(); finish(); }
else {
  // Default to the folder that already holds most of your models.
  const busiest = [...roots].map(r => ({ r, n: [...have.values()].filter(p => resolve(p).startsWith(r)).length })).sort((a, b) => b.n - a.n)[0]?.r;
  let target = args['models-dir'] || setup.config?.modelsDir || busiest || '';
  if (!target) target = await ask('  Where should models go? Enter your ComfyUI "models" folder: ');
  if (!target) fail('No models folder chosen. Run setup again with --models-dir "<ComfyUI>/models".');
  target = resolve(target);
  say(`\n  New models go into: ${target}`);
  try { const fs = statfsSync(existsSync(target) ? target : dirname(target)); const freeGB = (fs.bavail * fs.bsize) / 1e9;
    say(`  Needed: ${neededGB.toFixed(1)} GB · free: ${freeGB.toFixed(0)} GB`);
    if (freeGB < neededGB + 2) fail('Not enough free disk space. Free some space, or choose another folder with --models-dir.');
  } catch { /* statfs not available */ }
  for (const file of downloads) say(`    ${file.file} · ${file.size_gb} GB · ${file.license}`);
  if (args['dry-run']) { say('\nDry run: nothing was downloaded.'); process.exit(0); }
  if (!await yes('\n  Start downloading? Interrupted downloads resume when you run setup again.')) fail('Stopped before downloading.');

  if (downloads.some(f => f.gated)) {
    const probe = await fetch(downloads.find(f => f.gated)!.url, { method: 'HEAD', headers: { Authorization: `Bearer ${token}` }, redirect: 'manual' });
    if (probe.status === 401 || probe.status === 403) fail('Hugging Face refused the token. Accept the license at https://huggingface.co/Lightricks/LTX-2.5 with the same account, then run setup again.');
  }
  const started = Date.now();
  await downloadModels(target, downloads, { token, onProgress: p => {
    const pct = p.total ? ` ${(100 * p.received / p.total).toFixed(0)}%` : '';
    const rate = (p.received / 1e6) / Math.max(1, (Date.now() - started) / 1000);
    process.stdout.write(`\r  ${p.index}/${p.count} ${basename(p.file)} · ${(p.received / 1e9).toFixed(2)}${p.total ? '/' + (p.total / 1e9).toFixed(2) : ''} GB${pct} · ${rate.toFixed(0)} MB/s`.padEnd(110));
  } }).catch(error => fail(String(error.message || error)));
  process.stdout.write('\n');
  for (const file of downloads) if (!await validModel(join(target, file.file),file.sha256)) fail(`${file.file} did not download correctly. Run setup again to resume.`);
  // Remember the folder so the app's Local setup panel uses it too.
  const configPath = join(ROOT, 'outputs/runtime-config.json');
  if (existsSync(configPath)) { const config = JSON.parse(readFileSync(configPath, 'utf8')); if (!config.modelsDir) { config.modelsDir = target; writeFileSync(configPath, JSON.stringify(config, null, 2)); } }
  if (!roots.has(target) && !yamls.length) say(`  If ComfyUI doesn't see the new models, add ${target} to its extra_model_paths.yaml.`);
  await extras();
  finish();
}

/** Optional features, each one a yes/no question. Nothing to copy or edit by hand. */
async function extras() {
  if (args['dry-run']) return;
  const dir = setup.config?.launchDirectory || (setup.config?.mode === 'managed' ? join(ROOT, '.runtime/ComfyUI') : launcher?.directory);
  const python = setup.config?.mode === 'managed'
    ? join(ROOT, process.platform === 'win32' ? '.runtime/comfy-python/Scripts/python.exe' : '.runtime/comfy-python/bin/python')
    : existingComfyLaunch(ROOT, env, dir)?.python;
  step('Optional extras');
  if (dir && python && existsSync(python)) {
    const has = (node: string) => existsSync(join(dir, 'custom_nodes', node));
    let addedExtra = false;
    if (!has('osh_captions') && await yes('  Add automatic captions (speech to text, runs on your CPU)?')) {
      addedExtra = true;
      const model = totalmem() >= 16 * 2 ** 30 ? 'large-v3' : 'small';
      if (spawnSync(python, [join(ROOT, 'shared/runtime/setup-captions.py'), '--comfy-root', dir, '--model', model], { stdio: 'inherit' }).status !== 0) say('  Captions setup failed; everything else still works.');
    }
    if (!has('osh_semantic') && await yes('  Add smart search for your Elements library?')) {
      addedExtra = true;
      if (spawnSync(python, [join(ROOT, 'shared/runtime/setup-search.py'), '--comfy-root', dir], { stdio: 'inherit' }).status !== 0) say('  Search setup failed; everything else still works.');
    }
    if (!has('osh_training') && await yes('  Add LoRA training for images, video and geometry? (no downloads)')) {
      addedExtra = true;
      if (spawnSync(python, [join(ROOT, 'shared/runtime/setup-training.py'), '--comfy-root', dir], { stdio: 'inherit' }).status !== 0) say('  Training setup failed; everything else still works.');
    }
    if (addedExtra) say('  Restart ComfyUI (or this app) to load new extras.');
  } else say('  Captions, search and training need a ComfyUI this app can find on disk; skipped.');

  const envPath = join(ROOT, '.env'), text = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  if (!/^OSH_TOKEN=/m.test(text) && await yes('  Let other devices on your network use the app? (password-protected)', false)) {
    const { randomBytes } = await import('node:crypto');
    const { hostname, networkInterfaces } = await import('node:os');
    const token = randomBytes(18).toString('base64url');
    const ip = Object.values(networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address;
    const hosts = [hostname(), `${hostname()}.local`, ip].filter(Boolean).join(',');
    writeFileSync(envPath, `${text}${text && !text.endsWith('\n') ? '\n' : ''}OSH_HOST=0.0.0.0\nOSH_ALLOWED_HOSTS=${hosts}\nOSH_TOKEN=${token}\n`);
    say(`  Done. Share this link: http://${ip || hostname()}:${env.OSH_PORT || 8310}/adstudio/?token=${token}`);
  }
}

function finish(): never {
  say('\n✓ Setup complete.\n');
  if (!env.OSH_FROM_START) say('  Start the app any time: double-click start (or run npm start).\n');
  process.exit(0);
}
