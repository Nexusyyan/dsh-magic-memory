/**
 * Dreamer task implementations & host-side claim-safety guardrails.
 *
 * Implements all 6 self-maintenance tasks inspired by Magic-context's Dreamer:
 * 1. `map-memories`          — bind memories to backing workspace files (or file-independent)
 * 2. `verify`                — verify mapped memories whose backing files changed since last check
 * 3. `curate`                — expire old memories + tighten/consolidate within one category
 * 4. `classify-memories`     — score importance & shareability (fail-closed on secrets)
 * 5. `retrospective`         — learn project rules & user habits from recent user friction
 * 6. `review-user-memories`  — promote recurring user observations (>= threshold) to USER_PROFILE
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ResolvedConfig } from '../config.js';
import type { MagicMemoryService } from '../service/memory-service.js';
import { type DreamFailureClass, type DreamTaskName, type MemoryRecord } from '../shared/types.js';
import type { LeaseHandle } from '../storage/leases.js';
export interface DreamTaskOutcome {
    readonly status: 'success' | 'skipped' | 'failed';
    readonly summary: string;
    readonly itemsProcessed: number;
    readonly mutationsApplied: number;
    readonly modelUsed: string | null;
    readonly failureClass: DreamFailureClass | null;
    readonly errorMessage: string | null;
}
/**
 * Host-side claim-safety guardrail (inspired by Magic-context `memory-claim-safety.ts`):
 * - Refuses auto-archiving `PROJECT_RULES` (human/explicit governance only).
 * - Refuses updates that shrink text by >50% unless explicitly marked `consolidation: true`.
 */
export declare function evaluateClaimSafety(memory: MemoryRecord, verdict: {
    readonly action: 'verified' | 'update' | 'archive';
    readonly newContent?: string;
    readonly consolidation?: boolean;
}): {
    readonly allowed: true;
} | {
    readonly allowed: false;
    readonly reason: string;
};
export declare function executeDreamTask(params: {
    readonly ctx: Context;
    readonly service: MagicMemoryService;
    readonly config: ResolvedConfig;
    readonly projectId: string;
    readonly taskName: DreamTaskName;
    readonly lease: LeaseHandle;
    readonly signal?: AbortSignal;
}): Promise<DreamTaskOutcome>;
//# sourceMappingURL=dreamer-tasks.d.ts.map