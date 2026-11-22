/**
 * Plugin configuration schema (Schemastery) with live `.volatile()` fields so
 * DSH's Plugins Settings page renders an editable form automatically.
 */
import type { Volatile } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { DreamTaskName } from './shared/types.js';
export type SubagentMemoryMode = 'search-only' | 'full' | 'off';
export type EmbeddingProviderMode = 'off' | 'openai-compatible';
export interface AutoSearchConfig {
    enabled: boolean;
    scoreThreshold: number;
    maxHints: number;
    minPromptChars: number;
}
export interface EmbeddingConfig {
    provider: EmbeddingProviderMode;
    endpoint: string;
    model: string;
    apiKey?: string;
    apiKeyEnv: string;
    timeoutMs: number;
}
export interface ExtractorConfig {
    enabled: boolean;
    triggerTokens: number;
    onCompaction: boolean;
    cooldownSeconds: number;
    provider: string;
    model: string;
    maxOutputTokens: number;
    autoPromote: boolean;
}
export interface DreamerTaskIntervals {
    'map-memories': number;
    verify: number;
    curate: number;
    'classify-memories': number;
    retrospective: number;
    'review-user-memories': number;
}
export interface DreamerConfig {
    enabled: boolean;
    tickIntervalMinutes: number;
    separateModel?: boolean;
    provider: string;
    model: string;
    maxOutputTokens: number;
    timeoutMs: number;
    recencyDays: number;
    userMemoriesEnabled: boolean;
    userPromoteThreshold: number;
    taskIntervalsMinutes: DreamerTaskIntervals;
}
export interface MagicMemoryConfig {
    dbPath: string;
    enabled: Volatile<boolean> | boolean;
    injectOnStart: Volatile<boolean> | boolean;
    reanchorAfterCompaction: Volatile<boolean> | boolean;
    includeSubagents: Volatile<SubagentMemoryMode> | SubagentMemoryMode;
    baselineBudgetTokens: Volatile<number> | number;
    userProfileBudgetTokens: Volatile<number> | number;
    deltaBudgetTokens: Volatile<number> | number;
    maxMemoryChars: Volatile<number> | number;
    autoSearch: Volatile<AutoSearchConfig> | AutoSearchConfig;
    embedding: Volatile<EmbeddingConfig> | EmbeddingConfig;
    extractor: Volatile<ExtractorConfig> | ExtractorConfig;
    dreamer: Volatile<DreamerConfig> | DreamerConfig;
}
export interface ResolvedConfig {
    readonly dbPath: string;
    readonly enabled: boolean;
    readonly injectOnStart: boolean;
    readonly reanchorAfterCompaction: boolean;
    readonly includeSubagents: SubagentMemoryMode;
    readonly baselineBudgetTokens: number;
    readonly userProfileBudgetTokens: number;
    readonly deltaBudgetTokens: number;
    readonly maxMemoryChars: number;
    readonly autoSearch: Readonly<AutoSearchConfig>;
    readonly embedding: Readonly<EmbeddingConfig>;
    readonly extractor: Readonly<ExtractorConfig>;
    readonly dreamer: Readonly<DreamerConfig>;
}
export declare const DEFAULT_AUTO_SEARCH: AutoSearchConfig;
export declare const DEFAULT_EMBEDDING: EmbeddingConfig;
export declare const DEFAULT_EXTRACTOR: ExtractorConfig;
export declare const DEFAULT_DREAMER_INTERVALS: DreamerTaskIntervals;
export declare const DEFAULT_DREAMER: DreamerConfig;
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    dbPath: z<string, string, "defined">;
    enabled: z<boolean, boolean, "volatile-defined">;
    injectOnStart: z<boolean, boolean, "volatile-defined">;
    reanchorAfterCompaction: z<boolean, boolean, "volatile-defined">;
    includeSubagents: z<"off" | "search-only" | "full", "off" | "search-only" | "full", "volatile-defined">;
    baselineBudgetTokens: z<number, number, "volatile-defined">;
    userProfileBudgetTokens: z<number, number, "volatile-defined">;
    deltaBudgetTokens: z<number, number, "volatile-defined">;
    maxMemoryChars: z<number, number, "volatile-defined">;
    autoSearch: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        scoreThreshold: z<number, number, "defined">;
        maxHints: z<number, number, "defined">;
        minPromptChars: z<number, number, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        scoreThreshold: z<number, number, "defined">;
        maxHints: z<number, number, "defined">;
        minPromptChars: z<number, number, "defined">;
    }>>>, "volatile-defined">;
    embedding: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        provider: z<"off" | "openai-compatible", "off" | "openai-compatible", "defined">;
        endpoint: z<string, string, "defined">;
        model: z<string, string, "defined">;
        apiKey: z<string, string, "defined">;
        apiKeyEnv: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        provider: z<"off" | "openai-compatible", "off" | "openai-compatible", "defined">;
        endpoint: z<string, string, "defined">;
        model: z<string, string, "defined">;
        apiKey: z<string, string, "defined">;
        apiKeyEnv: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
    }>>>, "volatile-defined">;
    extractor: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        triggerTokens: z<number, number, "defined">;
        onCompaction: z<boolean, boolean, "defined">;
        cooldownSeconds: z<number, number, "defined">;
        provider: z<string, string, "defined">;
        model: z<string, string, "defined">;
        maxOutputTokens: z<number, number, "defined">;
        autoPromote: z<boolean, boolean, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        triggerTokens: z<number, number, "defined">;
        onCompaction: z<boolean, boolean, "defined">;
        cooldownSeconds: z<number, number, "defined">;
        provider: z<string, string, "defined">;
        model: z<string, string, "defined">;
        maxOutputTokens: z<number, number, "defined">;
        autoPromote: z<boolean, boolean, "defined">;
    }>>>, "volatile-defined">;
    dreamer: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        tickIntervalMinutes: z<number, number, "defined">;
        provider: z<string, string, "defined">;
        model: z<string, string, "defined">;
        maxOutputTokens: z<number, number, "defined">;
        timeoutMs: z<number, number, "defined">;
        recencyDays: z<number, number, "defined">;
        userMemoriesEnabled: z<boolean, boolean, "defined">;
        userPromoteThreshold: z<number, number, "defined">;
        taskIntervalsMinutes: z<Schemastery.ObjectS<NoInfer<{
            'map-memories': z<number, number, "defined">;
            verify: z<number, number, "defined">;
            curate: z<number, number, "defined">;
            'classify-memories': z<number, number, "defined">;
            retrospective: z<number, number, "defined">;
            'review-user-memories': z<number, number, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            'map-memories': z<number, number, "defined">;
            verify: z<number, number, "defined">;
            curate: z<number, number, "defined">;
            'classify-memories': z<number, number, "defined">;
            retrospective: z<number, number, "defined">;
            'review-user-memories': z<number, number, "defined">;
        }>>, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        tickIntervalMinutes: z<number, number, "defined">;
        provider: z<string, string, "defined">;
        model: z<string, string, "defined">;
        maxOutputTokens: z<number, number, "defined">;
        timeoutMs: z<number, number, "defined">;
        recencyDays: z<number, number, "defined">;
        userMemoriesEnabled: z<boolean, boolean, "defined">;
        userPromoteThreshold: z<number, number, "defined">;
        taskIntervalsMinutes: z<Schemastery.ObjectS<NoInfer<{
            'map-memories': z<number, number, "defined">;
            verify: z<number, number, "defined">;
            curate: z<number, number, "defined">;
            'classify-memories': z<number, number, "defined">;
            retrospective: z<number, number, "defined">;
            'review-user-memories': z<number, number, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            'map-memories': z<number, number, "defined">;
            verify: z<number, number, "defined">;
            curate: z<number, number, "defined">;
            'classify-memories': z<number, number, "defined">;
            retrospective: z<number, number, "defined">;
            'review-user-memories': z<number, number, "defined">;
        }>>, "defined">;
    }>>>, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    dbPath: z<string, string, "defined">;
    enabled: z<boolean, boolean, "volatile-defined">;
    injectOnStart: z<boolean, boolean, "volatile-defined">;
    reanchorAfterCompaction: z<boolean, boolean, "volatile-defined">;
    includeSubagents: z<"off" | "search-only" | "full", "off" | "search-only" | "full", "volatile-defined">;
    baselineBudgetTokens: z<number, number, "volatile-defined">;
    userProfileBudgetTokens: z<number, number, "volatile-defined">;
    deltaBudgetTokens: z<number, number, "volatile-defined">;
    maxMemoryChars: z<number, number, "volatile-defined">;
    autoSearch: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        scoreThreshold: z<number, number, "defined">;
        maxHints: z<number, number, "defined">;
        minPromptChars: z<number, number, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        scoreThreshold: z<number, number, "defined">;
        maxHints: z<number, number, "defined">;
        minPromptChars: z<number, number, "defined">;
    }>>>, "volatile-defined">;
    embedding: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        provider: z<"off" | "openai-compatible", "off" | "openai-compatible", "defined">;
        endpoint: z<string, string, "defined">;
        model: z<string, string, "defined">;
        apiKey: z<string, string, "defined">;
        apiKeyEnv: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        provider: z<"off" | "openai-compatible", "off" | "openai-compatible", "defined">;
        endpoint: z<string, string, "defined">;
        model: z<string, string, "defined">;
        apiKey: z<string, string, "defined">;
        apiKeyEnv: z<string, string, "defined">;
        timeoutMs: z<number, number, "defined">;
    }>>>, "volatile-defined">;
    extractor: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        triggerTokens: z<number, number, "defined">;
        onCompaction: z<boolean, boolean, "defined">;
        cooldownSeconds: z<number, number, "defined">;
        provider: z<string, string, "defined">;
        model: z<string, string, "defined">;
        maxOutputTokens: z<number, number, "defined">;
        autoPromote: z<boolean, boolean, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        triggerTokens: z<number, number, "defined">;
        onCompaction: z<boolean, boolean, "defined">;
        cooldownSeconds: z<number, number, "defined">;
        provider: z<string, string, "defined">;
        model: z<string, string, "defined">;
        maxOutputTokens: z<number, number, "defined">;
        autoPromote: z<boolean, boolean, "defined">;
    }>>>, "volatile-defined">;
    dreamer: z<NoInfer<Schemastery.ObjectS<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        tickIntervalMinutes: z<number, number, "defined">;
        provider: z<string, string, "defined">;
        model: z<string, string, "defined">;
        maxOutputTokens: z<number, number, "defined">;
        timeoutMs: z<number, number, "defined">;
        recencyDays: z<number, number, "defined">;
        userMemoriesEnabled: z<boolean, boolean, "defined">;
        userPromoteThreshold: z<number, number, "defined">;
        taskIntervalsMinutes: z<Schemastery.ObjectS<NoInfer<{
            'map-memories': z<number, number, "defined">;
            verify: z<number, number, "defined">;
            curate: z<number, number, "defined">;
            'classify-memories': z<number, number, "defined">;
            retrospective: z<number, number, "defined">;
            'review-user-memories': z<number, number, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            'map-memories': z<number, number, "defined">;
            verify: z<number, number, "defined">;
            curate: z<number, number, "defined">;
            'classify-memories': z<number, number, "defined">;
            retrospective: z<number, number, "defined">;
            'review-user-memories': z<number, number, "defined">;
        }>>, "defined">;
    }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
        enabled: z<boolean, boolean, "defined">;
        tickIntervalMinutes: z<number, number, "defined">;
        provider: z<string, string, "defined">;
        model: z<string, string, "defined">;
        maxOutputTokens: z<number, number, "defined">;
        timeoutMs: z<number, number, "defined">;
        recencyDays: z<number, number, "defined">;
        userMemoriesEnabled: z<boolean, boolean, "defined">;
        userPromoteThreshold: z<number, number, "defined">;
        taskIntervalsMinutes: z<Schemastery.ObjectS<NoInfer<{
            'map-memories': z<number, number, "defined">;
            verify: z<number, number, "defined">;
            curate: z<number, number, "defined">;
            'classify-memories': z<number, number, "defined">;
            retrospective: z<number, number, "defined">;
            'review-user-memories': z<number, number, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            'map-memories': z<number, number, "defined">;
            verify: z<number, number, "defined">;
            curate: z<number, number, "defined">;
            'classify-memories': z<number, number, "defined">;
            retrospective: z<number, number, "defined">;
            'review-user-memories': z<number, number, "defined">;
        }>>, "defined">;
    }>>>, "volatile-defined">;
}>>, "plain">;
/** Unwrap either a Cordis `Volatile<T>` box or a plain runtime value. */
export declare function unwrapVolatile<T>(value: T | Volatile<T> | undefined, fallback: T): T;
/** Snapshot all live volatile configuration fields into an immutable resolved object. */
export declare function readConfigSnapshot(raw?: Partial<MagicMemoryConfig>): ResolvedConfig;
export declare function getDreamTaskIntervalMinutes(config: ResolvedConfig, task: DreamTaskName): number;
//# sourceMappingURL=config.d.ts.map