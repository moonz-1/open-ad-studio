/** SSH local-forward to private ComfyUI. Never opens public HTTP. */
import {spawn, execFile, type ChildProcess} from 'node:child_process';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {access} from 'node:fs/promises';
import {promisify} from 'node:util';

export type TunnelHandle = {
  localPort: number;
  remotePort: number;
  process: ChildProcess;
  stop: () => Promise<void>;
};

export async function sshKeyPaths(env: Record<string, string | undefined> = process.env) {
  const key = env.ADSTUDIO_RUNPOD_SSH_KEY || join(homedir(), '.ssh', 'runpod_ltx25');
  await access(key);
  return {privateKey: key, publicKey: key + '.pub'};
}

export async function startComfyTunnel(opts: {
  host: string;
  sshPort: number;
  localPort: number;
  remotePort: number;
  privateKey: string;
  knownHostsFile?: string;
}): Promise<TunnelHandle> {
  if(!/^[a-zA-Z0-9.:-]+$/.test(opts.host)||!Number.isInteger(opts.sshPort)||opts.sshPort<1||opts.sshPort>65535)throw new Error('Invalid direct SSH endpoint.');
  const args = [
    '-i', opts.privateKey,
    '-o', 'IdentitiesOnly=yes',
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'GatewayPorts=no',
    '-N',
    '-L', `127.0.0.1:${opts.localPort}:127.0.0.1:${opts.remotePort}`,
    '-p', String(opts.sshPort),
    `root@${opts.host}`,
  ];
  if (opts.knownHostsFile) args.splice(args.indexOf('-N'), 0, '-o', 'UserKnownHostsFile=' + opts.knownHostsFile);
  const child = spawn('ssh', args, {stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true});
  let stderr = '';
  child.stderr?.on('data', (chunk) => { stderr += String(chunk); if (stderr.length > 4000) stderr = stderr.slice(-4000); });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => resolve(), 2500);
    child.once('error', (e) => { clearTimeout(timer); reject(e); });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`SSH tunnel exited early (${code}): ${stderr.slice(0, 240)}`)); });
  });
  if (child.exitCode != null) throw new Error(`SSH tunnel failed: ${stderr.slice(0, 240)}`);
  return {
    localPort: opts.localPort,
    remotePort: opts.remotePort,
    process: child,
    stop: async () => {
      if (child.exitCode != null) return;
      child.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} resolve(); }, 3000);
        child.once('exit', () => { clearTimeout(t); resolve(); });
      });
    },
  };
}

export async function waitLoopbackComfy(baseUrl: string, timeoutMs = 180000, fetchImpl: typeof fetch = fetch, signal:AbortSignal=AbortSignal.timeout(timeoutMs)) {
  const started = Date.now();
  let last = '';
  while (Date.now() - started < timeoutMs) {
    signal.throwIfAborted();
    try {
      const r = await fetchImpl(baseUrl.replace(/\/$/, '') + '/system_stats', {redirect:'error',signal: AbortSignal.any([signal,AbortSignal.timeout(4000)])});
      if (r.ok) return await r.json();
      last = `HTTP ${r.status}`;
    } catch (e) { last = e instanceof Error ? e.message : String(e); }
    await new Promise(r => setTimeout(r, 2500));
  }
  throw new Error(`ComfyUI did not become ready on ${baseUrl}: ${last}`);
}

/** Read existing files and listen sockets through SSH; never downloads or installs weights. */
export async function verifyRemoteFluxFiles(opts:{host:string;port:number;privateKey:string;knownHostsFile:string;modelsDir:string;files:{file:string;bytes:number|null;sha256?:string|null}[];remotePort:number;signal:AbortSignal}){
 if(!/^[a-zA-Z0-9.:-]+$/.test(opts.host)||!Number.isInteger(opts.port))throw Error('Invalid SSH endpoint.');
 const data=Buffer.from(JSON.stringify({root:opts.modelsDir,files:opts.files,port:opts.remotePort})).toString('base64');
 const script=`import base64,json,pathlib,hashlib
p=json.loads(base64.b64decode('${data}'))
root=pathlib.Path(p['root']).resolve()
for f in p['files']:
 q=(root/f['file']).resolve()
 assert q.is_relative_to(root) and q.is_file() and f['bytes'] is not None and q.stat().st_size==f['bytes'], 'FLUX weight file missing or wrong size'
 if f.get('sha256'):
  with q.open('rb') as stream: assert hashlib.file_digest(stream,'sha256').hexdigest()==f['sha256'], 'FLUX digest mismatch'
listeners=[]
for table in ['/proc/net/tcp','/proc/net/tcp6']:
 for row in pathlib.Path(table).read_text().splitlines()[1:]:
  cols=row.split()
  if cols[3]=='0A' and int(cols[1].split(':')[1],16)==p['port']: listeners.append(cols[1].split(':')[0])
assert listeners and all(x in ['0100007F','00000000000000000000000001000000'] for x in listeners), 'Comfy must listen on loopback only'
print('Existing FLUX files and private listener verified')`;
 const encoded=Buffer.from(script).toString('base64'),command=`python3 -c "import base64;exec(base64.b64decode('${encoded}'))"`;
 try{await promisify(execFile)('ssh',['-i',opts.privateKey,'-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new','-o','UserKnownHostsFile='+opts.knownHostsFile,'-o','ConnectTimeout=15','-p',String(opts.port),'root@'+opts.host,command],{windowsHide:true,timeout:60000,maxBuffer:8192,signal:opts.signal});}
 catch{throw Error('Remote FLUX file/private-listener verification failed. Check prepared worker paths, licensed file sizes and loopback startup; no downloads were attempted.');}
}
