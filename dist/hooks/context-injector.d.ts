/**
 * Cache-stable context injection & tail-only Auto-Search vague recall hint.
 *
 * Strictly preserves DSH's prompt KV cache:
 * - Static system-prompt guidance (zero dynamic timestamps or mutable text).
 * - Step 1 baseline snapshot (`form: 'snapshot'`) spliced before/beside first prompt.
 * - Steady-state turns touch ZERO prefix nodes (100% cache-hit Defer passes).
 * - Post-compaction re-anchoring re-injects fresh baseline right after DSH compaction
 *   (when the provider prefix has already rebuilt).
 * - Tail-only Auto-Search hint (`form: 'recall'`) appends only alongside the NEW user
 *   message when a non-visible memory/episode scores above threshold.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { UserMessage } from '@deepseek-ai/dsh-session';
import type { MagicMemoryService } from '../service/memory-service.js';
import { type MemoryMutationRecord, type MemoryRecord, type NoteRecord } from '../shared/types.js';
declare module '@deepseek-ai/dsh-llm/message' {
    interface MessageSourceMap {
        'magic-memory': {
            readonly kind: 'magic-memory';
            readonly slot: 'baseline' | 'delta' | 'auto-search';
            readonly projectId: string;
            readonly form: 'snapshot' | 'recall';
            readonly sections?: readonly ContextSnapshotSection[];
        };
    }
}
export declare const STATIC_MEMORY_SYSTEM_PROMPT: string;
export declare function buildBaselineMessage(params: {
    readonly projectId: string;
    readonly displayName: string;
    readonly userProfile: readonly MemoryRecord[];
    readonly projectMemories: readonly MemoryRecord[];
    readonly workspaceMemories: readonly MemoryRecord[];
    readonly activeNotes: readonly NoteRecord[];
    readonly userProfileBudgetTokens: number;
    readonly baselineBudgetTokens: number;
}): {
    message: UserMessage;
    includedIds: number[];
} | null;
export declare function buildDeltaMessage(params: {
    readonly projectId: string;
    readonly newMemories: readonly MemoryRecord[];
    readonly mutations: readonly MemoryMutationRecord[];
    readonly budgetTokens: number;
}): {
    message: UserMessage;
    includedIds: number[];
} | null;
export declare function resolveAgentCwd(ctx: Context, agent: Agent, signal?: AbortSignal): Promise<string>;
export declare function registerContextInjector(ctx: Context, service: MagicMemoryService): void;
//# sourceMappingURL=context-injector.d.ts.map