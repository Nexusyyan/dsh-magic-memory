/**
 * Optional OpenAI-compatible remote embedding client + Float32Array SQLite BLOB codec.
 * Zero native dependencies: uses Node.js built-in `fetch` and in-memory Float32Array cosine math.
 */
import type { EmbeddingConfig } from '../config.js';
import type { MemoryDatabase } from '../storage/database.js';
export type FetchLike = typeof fetch;
export type EmbeddingTargetKind = 'memory' | 'episode' | 'note';
export interface StoredEmbeddingRow {
    readonly targetKind: EmbeddingTargetKind;
    readonly targetId: number;
    readonly providerModel: string;
    readonly contentHash: string;
    readonly dims: number;
    readonly vector: Float32Array;
}
export declare function serializeVector(vector: Float32Array): Uint8Array;
export declare function deserializeVector(blob: Uint8Array): Float32Array;
export declare function cosineSimilarity(a: Float32Array, b: Float32Array): number;
export declare function resolveEmbeddingApiKey(config: Readonly<EmbeddingConfig>): string;
export declare function resolveEmbeddingEndpoint(rawEndpoint: string): string;
export declare function providerModelKey(config: Readonly<EmbeddingConfig>): string;
export declare class EmbeddingService {
    private readonly storage;
    private readonly fetchImpl;
    constructor(storage: MemoryDatabase, fetchImpl?: FetchLike);
    isConfigured(config: Readonly<EmbeddingConfig>): boolean;
    testConnectivity(config: Readonly<EmbeddingConfig>, signal?: AbortSignal): Promise<{
        ok: boolean;
        latencyMs: number;
        dims?: number;
        endpoint: string;
        model: string;
        message: string;
    }>;
    embedTexts(texts: readonly string[], config: Readonly<EmbeddingConfig>, signal?: AbortSignal): Promise<Float32Array[] | null>;
    /**
     * Persist an embedding vector only if the target record's `content_hash` still
     * matches `expectedHash`, preventing stale async responses from overwriting newer text.
     */
    saveEmbeddingIfHashMatches(targetKind: EmbeddingTargetKind, targetId: number, expectedHash: string, config: Readonly<EmbeddingConfig>, vector: Float32Array): boolean;
    loadEmbeddingsForKind(targetKind: EmbeddingTargetKind, config: Readonly<EmbeddingConfig>): Map<number, Float32Array>;
    countEmbeddedMemories(projectId?: string): number;
}
//# sourceMappingURL=embedding.d.ts.map