/**
 * Unified hybrid search across project memories, workspace shared memories,
 * global user profile, extracted session episodes, notes, and session highlights.
 *
 * Offline default: CJK-aware SQLite FTS5 BM25 + character n-gram overlap + recency/importance.
 * Optional enhancement: OpenAI-compatible vector cosine similarity fused with FTS5.
 */
import type { ResolvedConfig } from '../config.js';
import { type UnifiedSearchRequest, type UnifiedSearchResponse } from '../shared/types.js';
import type { MemoryDatabase } from '../storage/database.js';
import { type EmbeddingService } from './embedding.js';
export declare function parseDateBound(raw: string | undefined, endOfDay: boolean): number | null;
export declare class UnifiedSearchEngine {
    private readonly storage;
    private readonly embeddings;
    constructor(storage: MemoryDatabase, embeddings: EmbeddingService);
    search(req: UnifiedSearchRequest, config: ResolvedConfig, injectedMemoryIds?: ReadonlySet<number>, signal?: AbortSignal): Promise<UnifiedSearchResponse>;
    private getWorkspaceSiblings;
    private searchMemories;
    private searchEpisodes;
    private searchNotes;
    private searchSessionHighlights;
}
//# sourceMappingURL=unified-search.d.ts.map