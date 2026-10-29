import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
type Env = Record<string, string | undefined>;

async function up(url: string): Promise<boolean> {
  try { return (await fetch(url, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; }
}

/** Start comfy-api-proxy (pip tool) in front of ComfyUI if it isn't running. Shared by the dev server and the CLI installer. */
export async function startComfyProxy(root: string, env: Env, options: { detached?: boolean } = {}): Promise<void> {
  const base = env.COMFY_BASE_URL || "http://127.0.0.1:8189";
  if (await up(base + "/api/v2/health")) return;
  const win = process.platform === "win32";
  const candidates = [env.COMFY_API_PROXY, join(root, ".venv", win ? "Scripts/comfy-api-proxy.exe" : "bin/comfy-api-proxy"), "comfy-api-proxy"];
  const exe = candidates.find((c) => c && (c === "comfy-api-proxy" || existsSync(c)))!;
  const port = new URL(base).port || "8189";
  const comfyui = env.COMFYUI_URL || "http://127.0.0.1:8188";
  console.log(`[api] starting comfy-api-proxy on 127.0.0.1:${port} -> ${comfyui}`);
  const p = spawn(exe, ["run", "--comfyui", comfyui, "--host", "127.0.0.1", "--port", port], { stdio: "ignore", windowsHide: true, detached: options.detached });
  p.on("error", (e) => console.warn(`[api] could not start comfy-api-proxy (${e.message}). Install it: pip install comfy-api-proxy`));
  if (options.detached) p.unref();
  for (let i = 0; i < 30 && !(await up(base + "/api/v2/health")); i++) await new Promise((r) => setTimeout(r, 500));
}
