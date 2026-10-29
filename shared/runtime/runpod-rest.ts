/** Server-side RunPod REST v2 + GraphQL helpers. Never log or return the API key. */
export type RunpodHttp = (path: string, init?: {method?: string; body?: unknown}) => Promise<{status: number; json: any}>;

export function loadRunpodApiKey(env: Record<string, string | undefined> = process.env): string | undefined {
  const key = (env.RUNPOD_API_KEY || env.ADSTUDIO_RUNPOD_API_KEY || '').trim();
  return key || undefined;
}

export function createRunpodHttp(apiKey: string, fetchImpl: typeof fetch = fetch): RunpodHttp {
  return async (path, init = {}) => {
    const method = init.method || (init.body !== undefined ? 'POST' : 'GET');
    const isGql = path === 'graphql' || path === '/graphql';
    if(!isGql&&!/^\/(?:pods(?:\/[-a-zA-Z0-9]+)?|catalog\/gpus\/[^?#]+|network-volumes(?:\/[-a-zA-Z0-9]+)?)(?:\?[^#]*)?$/.test(path))throw new Error('Unsupported RunPod resource path.');
    const url = isGql ? 'https://api.runpod.io/graphql' : 'https://api.runpod.io/v2' + (path.startsWith('/') ? path : '/' + path);
    const response = await fetchImpl(url, {
      method,
      redirect: 'error',
      headers: {Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json'},
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(25000),
    });
    const text = await response.text();
    let json: any = null;
    if (text) {
      try { json = JSON.parse(text); } catch { throw new Error(`RunPod ${method} ${path} returned non-JSON (HTTP ${response.status}).`); }
    }
    return {status: response.status, json};
  };
}

export async function runpodBalance(http: RunpodHttp) {
  const {status, json} = await http('graphql', {
    method: 'POST',
    body: {query: 'query { myself { clientBalance currentSpendPerHr isAutoPayEnabled } }'},
  });
  if (status !== 200 || !json?.data?.myself) throw new Error('Could not read RunPod account balance.');
  const me = json.data.myself;
  if(typeof me.clientBalance!=='number'||!Number.isFinite(me.clientBalance)||typeof me.currentSpendPerHr!=='number'||!Number.isFinite(me.currentSpendPerHr)||typeof me.isAutoPayEnabled!=='boolean')throw new Error('Invalid RunPod balance response.');
  return {
    clientBalance: Number(me.clientBalance),
    currentSpendPerHr: Number(me.currentSpendPerHr),
    isAutoPayEnabled: !!me.isAutoPayEnabled,
  };
}

export async function listPods(http: RunpodHttp) {
  const {status, json} = await http('/pods');
  if (status !== 200) throw new Error(`List pods failed (HTTP ${status}).`);
  if(!Array.isArray(json?.pods)||json.pagination?.hasNextPage)throw new Error('Incomplete RunPod pod inventory.');
  return json.pods as any[];
}

export async function getPod(http: RunpodHttp, podId: string) {
  const {status, json} = await http('/pods/' + encodeURIComponent(podId));
  if (status === 404) return null;
  if (status !== 200) throw new Error(`Get pod failed (HTTP ${status}).`);
  return json;
}

export async function createPod(http: RunpodHttp, body: Record<string, unknown>) {
  const {status, json} = await http('/pods', {method: 'POST', body});
  if (status >= 400) throw new Error(`Create pod failed (HTTP ${status}); inspect private deployment records.`);
  if(!json?.id||typeof json.id!=='string')throw new Error('Create pod response has no resource identity; reconcile saved intent before retrying.');
  return json;
}

export async function terminatePod(http: RunpodHttp, podId: string) {
  for (let i = 0; i < 8; i++) {
    const {status} = await http('/pods/' + encodeURIComponent(podId), {method: 'DELETE'});
    const again = await getPod(http, podId);
    if (!again || status === 404) return true;
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

export async function gpuOffer(http: RunpodHttp, gpuId: string) {
  const path = `/catalog/gpus/${encodeURIComponent(gpuId)}?include=AVAILABILITY&product=POD&cloud=SECURE&count=1&minCudaVersion=12.8`;
  const {status, json} = await http(path);
  if (status !== 200) throw new Error(`GPU catalog failed (HTTP ${status}).`);
  return json;
}
