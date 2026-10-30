/** Bounds one local Qwen text execution (inference and output delivery), measured from job submission. Never retried. */
export const creativeTextDeadlineMs=150_000;
export const creativeTextDeadlineSeconds=Math.round(creativeTextDeadlineMs/1000);
/** Browser bound for one plan request: admission (bounded by the same deadline), execution, then compile/save. */
export const creativePlanRequestMs=2*creativeTextDeadlineMs+30_000;
