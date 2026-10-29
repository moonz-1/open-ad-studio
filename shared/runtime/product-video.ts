// Local fidelity prototypes. Generation still belongs to the existing SDK shot route.
import { spawn } from 'node:child_process';

export const productFormats = { '16:9': [512, 288], '9:16': [288, 512], '1:1': [384, 384] } as const;
export type ProductRatio = keyof typeof productFormats;
export type CameraMotion = 'push' | 'pan-left' | 'pan-right';
export type ProductMode = 'locked' | 'camera';
export type Rect = { x: number; y: number; width: number; height: number };

export function productPlan(mode: ProductMode, ratio: ProductRatio, duration: number, motion: CameraMotion, sourceWidth: number, sourceHeight: number) {
  const [width, height] = productFormats[ratio];
  const frames = Math.round(duration * 24 / 8) * 8 + 1;
  // Leave room for the largest camera move without clipping the original photograph.
  const scale = Math.min(width * 0.82 / sourceWidth, height * 0.82 / sourceHeight);
  const fw = Math.max(2, Math.floor(sourceWidth * scale / 2) * 2);
  const fh = Math.max(2, Math.floor(sourceHeight * scale / 2) * 2);
  const rect: Rect = { x: Math.floor((width - fw) / 4) * 2, y: Math.floor((height - fh) / 4) * 2, width: fw, height: fh };
  let filter: string;
  if (mode === 'locked') {
    filter = `[0:v]scale=${width}:${height}:flags=lanczos,setsar=1,fps=24,tpad=stop_mode=clone:stop_duration=5,gblur=sigma=18:steps=2,eq=brightness=-0.15:saturation=0.6[bg];` +
      `[1:v]scale=${fw}:${fh}:flags=lanczos,format=rgb24[photo];` +
      `[bg][photo]overlay=${rect.x}:${rect.y}:format=rgb,format=yuv420p[out]`;
  } else {
    const t = `(on/${frames - 1})`;
    const progress = `(${t}*${t}*(3-2*${t}))`;
    const zoom = motion === 'push' ? `1+0.04*${progress}` : '1.04';
    const pan = motion === 'push' ? '' : `${motion === 'pan-right' ? '+' : '-'}(${progress}-0.5)*iw*0.024`;
    // Keep RGB and supersample the OUTPUT too: zoompan otherwise rounds its
    // crop/scale at final resolution, causing visible alternating frame steps.
    // Convert to subsampled YUV only after the final Lanczos downsample.
    filter = `[0:v]scale=${fw * 8}:${fh * 8}:flags=lanczos,format=gbrp,pad=${width * 8}:${height * 8}:${rect.x * 8}:${rect.y * 8}:color=0x16171b,` +
      `zoompan=z='${zoom}':x='iw/2-iw/zoom/2${pan}':y='ih/2-ih/zoom/2':d=${frames}:s=${width * 4}x${height * 4}:fps=24,scale=${width}:${height}:flags=lanczos,setsar=1,format=yuv420p[out]`;
  }
  return { width, height, frames, rect, filter, mode, motion: mode === 'camera' ? motion : 'static-protected-photo' };
}

export class ProductRenderError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function renderProduct(executable: string, args: string[]): Promise<void> {
  await new Promise<void>((ok, fail) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '', timedOut = false, spawnFailed = false;
    // Keep the queue occupied until the killed process actually exits.
    const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 90_000);
    child.stderr.on('data', (chunk: Buffer) => { error = (error + chunk.toString()).slice(-16000); });
    child.on('error', () => {
      spawnFailed = true;
      clearTimeout(timeout);
      fail(new ProductRenderError(503, 'FFmpeg unavailable: configure FFMPEG_PATH and restart Vite'));
    });
    child.on('close', code => {
      clearTimeout(timeout);
      if (spawnFailed) return;
      if (timedOut) return fail(new ProductRenderError(504, 'Product video timed out; source files are unchanged'));
      if (code === 0) return ok();
      console.error('[api] product video failed:', error);
      fail(new ProductRenderError(500, 'Product video failed; inspect server log. Source files are unchanged'));
    });
  });
}
