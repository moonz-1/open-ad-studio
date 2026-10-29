import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
export type Hardware = { id: string; name: string; vramGB: number };
export type RenderSample = { hardware: string; model: string; width: number; height: number; frames: number; seconds: number; cold: boolean; at: number;jobId?:string };
export type ServerTiming = { hardware: Hardware | null; samples: RenderSample[]; activeModel: string | null; queued: number };
let activeModel: string | null = null;
let samples: RenderSample[] | null = null;
export function identifyHardware(stats: any): Hardware | null {
  const device = stats?.devices?.[0]; if (!device) return null;
  return { id: JSON.stringify([device.name,device.vram_total,stats.system?.pytorch_version,stats.system?.comfyui_version]), name: device.name, vramGB: +(device.vram_total/2**30).toFixed(1) };
}
export async function serverTiming(root: string, hardware: Hardware | null, queued: number): Promise<ServerTiming> {
  if (!samples) { try { samples = JSON.parse(await readFile(join(root,'render-timings.json'),'utf8')).filter((s:RenderSample)=>s.seconds>0&&(s.jobId||s.seconds>=1)); } catch { samples = []; } }
  return { hardware, samples: samples!.filter(s=>s.hardware===hardware?.id), activeModel, queued };
}
export async function recordRender(root: string, hardware: Hardware | null, run: Omit<RenderSample,'hardware'|'cold'|'at'>) {
  const cold = activeModel !== run.model; activeModel = run.model;
  if (!hardware) return;
  await serverTiming(root,hardware,0);
  samples = [...samples!,{...run,hardware:hardware.id,cold,at:Date.now()}].slice(-160);
  try { await mkdir(root,{recursive:true}); await writeFile(join(root,'render-timings.json'),JSON.stringify(samples)); } catch (e) { console.warn('[api] Could not persist timings:',e); }
}
