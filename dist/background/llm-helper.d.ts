/**
 * Auxiliary one-shot LLM caller over DSH's `ctx.llm.stream()` seam.
 * Mirrors `dsh-compaction-basic`'s pattern: non-loop request, BlockAssembler
 * collection, explicit timeout & cancellation, fail-closed error classification.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { Session } from '@deepseek-ai/dsh-session';
import type { AvailableModelInfo, DreamFailureClass } from '../shared/types.js';
export interface AuxiliaryRoute {
    readonly provider: string;
    readonly model: string;
}
export interface AuxiliaryLlmResult {
    readonly ok: true;
    readonly text: string;
    readonly route: AuxiliaryRoute;
}
export interface AuxiliaryLlmFailure {
    readonly ok: false;
    readonly failureClass: DreamFailureClass;
    readonly message: string;
    readonly route: AuxiliaryRoute | null;
}
export type AuxiliaryLlmOutcome = AuxiliaryLlmResult | AuxiliaryLlmFailure;
/**
 * Resolve the model route for background extraction or Dreamer tasks.
 * Priority: explicit config override -> session's latest answered assistant ->
 * session's latest request header -> agent options -> first live agent/adapter model.
 */
export declare function resolveAuxiliaryRoute(ctx: Context, override: {
    provider?: string;
    model?: string;
}, session?: Session, agent?: Agent): AuxiliaryRoute | null;
/**
 * Enumerate all currently registered DSH LLM providers and their advertised models.
 * Supports DSH's real `listProviders()` + `await listModels(provider)` runtime API
 * as well as zero-arg sync mocks used in tests.
 */
export declare function listAvailableLlmModels(ctx: Context): Promise<AvailableModelInfo[]>;
/**
 * Async version of `resolveAuxiliaryRoute` that also consults `ctx.llm.listProviders()`
 * + `await ctx.llm.listModels(provider)` when no active session/explicit override exists.
 */
export declare function resolveAuxiliaryRouteAsync(ctx: Context, override: {
    provider?: string;
    model?: string;
}, session?: Session, agent?: Agent): Promise<AuxiliaryRoute | null>;
/**
 * Execute a single tool-free auxiliary completion through `ctx.llm.stream()`.
 * Fails closed on empty completions, max-tokens truncation, timeouts, or errors.
 */
export declare function runAuxiliaryCompletion(ctx: Context, params: {
    readonly route: AuxiliaryRoute | null;
    readonly systemPrompt: string;
    readonly userPrompt: string;
    readonly maxTokens: number;
    readonly timeoutMs: number;
    readonly purpose: string;
    readonly sessionId?: Session['id'];
    readonly signal?: AbortSignal;
}): Promise<AuxiliaryLlmOutcome>;
//# sourceMappingURL=llm-helper.d.ts.map