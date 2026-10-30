/**
 * Isolated Comfy Cloud client construction.
 * Never leave COMFY_BASE_URL pointing at Cloud after construction — local
 * Qwen/Klein clients must keep using the loopback proxy.
 */
import {Comfy, COMFY_CLOUD_BASE_URL, BASE_URL_ENV_VAR} from '@comfyorg/sdk';

export {COMFY_CLOUD_BASE_URL};

export type ComfyCloudClientOptions = {
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

/** Build a client that always targets Comfy Cloud, restoring any prior COMFY_BASE_URL. */
export function createComfyCloudClient(options: ComfyCloudClientOptions): Comfy {
  const prev = process.env[BASE_URL_ENV_VAR];
  try {
    // Unset → SDK defaults to https://cloud.comfy.org
    delete process.env[BASE_URL_ENV_VAR];
    return new Comfy({
      apiKey: options.apiKey,
      fetch: options.fetch,
      timeoutMs: options.timeoutMs,
    });
  } finally {
    if (prev === undefined) delete process.env[BASE_URL_ENV_VAR];
    else process.env[BASE_URL_ENV_VAR] = prev;
  }
}

export function loadComfyCloudApiKey(env: Record<string, string | undefined> = process.env): string | undefined {
  const key = (env.COMFY_API_KEY || env.ADSTUDIO_COMFY_CLOUD_API_KEY || '').trim();
  return key || undefined;
}

export function comfyCloudEnabled(env: Record<string, string | undefined> = process.env) {
  return env.ADSTUDIO_COMFY_CLOUD_ENABLED === '1';
}

export function comfyCloudSpendApproved(env: Record<string, string | undefined> = process.env) {
  return env.ADSTUDIO_COMFY_CLOUD_SPEND_APPROVED === '1';
}
