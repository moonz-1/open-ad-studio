/** Configurable spending ceilings for one-click FLUX RunPod sessions. */
export type FluxBudgetConfig = {
  protectedReserveUSD: number;
  maxJobUSD: number;
  maxSessionUSD: number;
  maxLeaseSeconds: number;
  idleReleaseSeconds: number;
  gpuHourlyUSD: number;
  storageHourlyUSD: number;
};

export type FluxBudgetGate = {
  ok: boolean;
  reason: string;
  spendableUSD: number;
  estimatedJobUSD: number;
  balanceUSD: number;
};

export function fluxBudgetFromEnv(
  pins: {budgetDefaults: Record<string, number>; gpu: {hourlyUSD: number}; storage: {storageHourlyBoundUSD: number}},
  env: Record<string, string | undefined> = process.env,
): FluxBudgetConfig {
  const num = (key: string, fallback: number) => {
    const raw = env[key];
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid ${key}`);
    return n;
  };
  const budget = {
    protectedReserveUSD: num('ADSTUDIO_RUNPOD_PROTECTED_RESERVE_USD', pins.budgetDefaults.protectedReserveUSD),
    maxJobUSD: num('ADSTUDIO_RUNPOD_MAX_JOB_USD', pins.budgetDefaults.maxJobUSD),
    maxSessionUSD: num('ADSTUDIO_RUNPOD_MAX_SESSION_USD', pins.budgetDefaults.maxSessionUSD),
    maxLeaseSeconds: Math.floor(num('ADSTUDIO_RUNPOD_MAX_LEASE_SECONDS', pins.budgetDefaults.maxLeaseSeconds)),
    idleReleaseSeconds: Math.floor(num('ADSTUDIO_RUNPOD_IDLE_RELEASE_SECONDS', pins.budgetDefaults.idleReleaseSeconds)),
    gpuHourlyUSD: num('ADSTUDIO_RUNPOD_GPU_HOURLY_USD', pins.gpu.hourlyUSD),
    storageHourlyUSD: num('ADSTUDIO_RUNPOD_STORAGE_HOURLY_USD', pins.storage.storageHourlyBoundUSD),
  };
  if(budget.protectedReserveUSD<2.96||budget.maxJobUSD>0.50||budget.maxSessionUSD>0.50)throw new Error('Protected reserve must be at least $2.96 and job/session limits at most $0.50.');
  if(budget.maxLeaseSeconds<1||budget.maxLeaseSeconds>2400||budget.gpuHourlyUSD<pins.gpu.hourlyUSD||budget.storageHourlyUSD<pins.storage.storageHourlyBoundUSD)throw new Error('Invalid lease or hourly rate.');
  return budget;
}

/** Upper-bound estimate for a bounded job (startup + generation + short idle). */
export function estimateFluxJobUSD(budget: FluxBudgetConfig, leaseSeconds = budget.maxLeaseSeconds) {
  const hours = Math.min(leaseSeconds, budget.maxLeaseSeconds) / 3600;
  return hours * (budget.gpuHourlyUSD + budget.storageHourlyUSD);
}

export function gateFluxSpend(balanceUSD: number, currentSpendPerHr: number, autoPay: boolean, budget: FluxBudgetConfig): FluxBudgetGate {
  const spendable = balanceUSD - budget.protectedReserveUSD;
  const estimated = estimateFluxJobUSD(budget);
  if(!Number.isFinite(balanceUSD)||!Number.isFinite(currentSpendPerHr)||balanceUSD<0||currentSpendPerHr<0)return {ok:false,reason:'Verified finite account balance/spend is required.',spendableUSD:spendable,estimatedJobUSD:estimated,balanceUSD};
  if(estimated>Math.min(budget.maxJobUSD,budget.maxSessionUSD))return {ok:false,reason:'Maximum lease exceeds job/session spending ceiling. Shorten the lease.',spendableUSD:spendable,estimatedJobUSD:estimated,balanceUSD};
  if (autoPay) return {ok: false, reason: 'Auto-pay is enabled. Disable it before one-click RunPod jobs.', spendableUSD: spendable, estimatedJobUSD: estimated, balanceUSD};
  if (currentSpendPerHr > 0.001) return {ok: false, reason: `Account already spending $${currentSpendPerHr.toFixed(2)}/hr. Stop other resources first.`, spendableUSD: spendable, estimatedJobUSD: estimated, balanceUSD};
  if (spendable < Math.min(budget.maxJobUSD,budget.maxSessionUSD)) return {ok: false, reason: `Spendable $${spendable.toFixed(2)} (balance $${balanceUSD.toFixed(2)} − reserve $${budget.protectedReserveUSD.toFixed(2)}) cannot cover the full authorized job/session ceiling. Top up or lower ceilings — demo reserve stays protected.`, spendableUSD: spendable, estimatedJobUSD: estimated, balanceUSD};
  if (budget.maxJobUSD <= 0 || budget.maxSessionUSD <= 0) return {ok: false, reason: 'Job/session ceilings must be positive.', spendableUSD: spendable, estimatedJobUSD: estimated, balanceUSD};
  return {ok: true, reason: `Budget gate passed. Spendable $${spendable.toFixed(2)}; job ceiling $${budget.maxJobUSD.toFixed(2)}.`, spendableUSD: spendable, estimatedJobUSD: estimated, balanceUSD};
}

export function liveProvisionAuthorized(env: Record<string, string | undefined> = process.env) {
  return env.ADSTUDIO_RUNPOD_LIVE === '1' && env.ADSTUDIO_FLUX3_SPEND_APPROVED === '1';
}

export function autoprovEnabled(env: Record<string, string | undefined> = process.env) {
  return env.ADSTUDIO_FLUX3_AUTOPROVISION === '1';
}
