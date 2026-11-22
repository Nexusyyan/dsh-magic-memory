/**
 * Out-of-band Session Fact & Episode Extractor (Magic-context Historian's knowledge half).
 *
 * Runs asynchronously without mutating conversation history:
 * - Reads newly committed raw session events above `lastExtractedSeq` (or a specific
 *   shadowed range during DSH compaction rescue).
 * - Produces structured XML manifests (`<extract>`) parsed fail-closed.
 * - Atomically records a searchable `session_episode`, auto-promotes durable `<facts>`
 *   into the 5 Magic-context categories (deduplicated), and accumulates `<user_observations>`.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { Session } from '@deepseek-ai/dsh-session';
import type { MagicMemoryService } from '../service/memory-service.js';
import { type ExtractRunResult, type ProjectMemoryCategory } from '../shared/types.js';
export interface ParsedExtractionManifest {
    readonly episode: {
        readonly type: string;
        readonly importance: number;
        readonly title: string;
        readonly summary: string;
        readonly decisions: readonly string[];
    } | null;
    readonly facts: readonly {
        readonly category: ProjectMemoryCategory;
        readonly importance: number;
        readonly content: string;
    }[];
    readonly userObservations: readonly string[];
}
/**
 * Fail-closed XML parser for `<extract>...</extract>` manifests.
 * Returns `null` if the required root envelope is absent or truncated.
 */
export declare function parseExtractionManifest(rawOutput: string): ParsedExtractionManifest | null;
export declare class SessionExtractor {
    private readonly ctx;
    private readonly memoryService;
    private readonly lastRunAtBySession;
    constructor(ctx: Context, memoryService: MagicMemoryService);
    /**
     * Extract durable episode, facts, and user observations from an unextracted slice
     * of `session` (or an explicit sequence window during compaction rescue).
     */
    extractSession(params: {
        readonly session: Session;
        readonly agent?: Agent;
        readonly projectId: string;
        readonly explicitRange?: {
            readonly startSeq: number;
            readonly endSeq: number;
        };
        readonly force?: boolean;
        readonly signal?: AbortSignal;
    }): Promise<ExtractRunResult>;
}
//# sourceMappingURL=extractor.d.ts.map