/**
 * Single-source-of-truth Cordis Service (`ctx.magicMemory`) implementing all
 * memory, episode, note, workspace, session telemetry, export, and doctor operations.
 *
 * Follows DSH's "One operation, two callers" rule: Agent tools, Slash commands,
 * Background Extractor/Dreamer, and the Web/Desktop Sidebar RPC bridge all invoke
 * the exact same methods here.
 */
import { Context, Service } from '@deepseek-ai/cordis';
import { type EmbeddingConfig, type MagicMemoryConfig, type ResolvedConfig } from '../config.js';
import { EmbeddingService, type FetchLike } from '../search/embedding.js';
import { UnifiedSearchEngine } from '../search/unified-search.js';
import { type DoctorCheckResult, type DreamRunRecord, type DreamTaskName, type DreamTaskScheduleState, type ExtractRunResult, type MagicMemoryOverview, type MagicMemorySettingsPatch, type MagicMemorySettingsPayload, type MappingOrigin, type MemoryCategory, type MemoryMutationRecord, type MemoryRecord, type MemoryStatus, type MergeMemoriesInput, type NoteRecord, type ProjectMemoryCategory, type ProjectRecord, type SessionEpisodeRecord, type SessionTelemetryState, type SettingsGetResponse, type SettingsReindexEmbeddingsResponse, type SettingsTestEmbeddingResponse, type SettingsTestLlmResponse, type UnifiedSearchRequest, type UnifiedSearchResponse, type UpdateMemoryInput, type UserObservationRecord, type VerificationState, type WorkspaceRecord, type WriteMemoryInput, type WriteMemoryResult } from '../shared/types.js';
import { MemoryDatabase } from '../storage/database.js';
import { LeaseManager } from '../storage/leases.js';
import { ProjectIdentityResolver, type ResolvedProjectIdentity } from '../storage/project-identity.js';
declare module '@deepseek-ai/cordis' {
    interface Context {
        magicMemory: MagicMemoryService;
    }
}
export interface MagicMemoryServiceDeps {
    readonly fetchImpl?: FetchLike;
}
export type ExtractCallback = (sessionId: string, signal?: AbortSignal) => Promise<ExtractRunResult>;
export type DreamCallback = (projectId: string, taskName?: DreamTaskName, signal?: AbortSignal) => Promise<DreamRunRecord[]>;
export declare class MagicMemoryService extends Service {
    readonly storage: MemoryDatabase;
    readonly leases: LeaseManager;
    readonly embeddings: EmbeddingService;
    readonly searchEngine: UnifiedSearchEngine;
    readonly projectResolver: ProjectIdentityResolver;
    private readonly rawConfig;
    private readonly lifecycleAbort;
    private readonly pendingEmbedTasks;
    private readonly configListeners;
    private settingsOverride;
    private extractHandler?;
    private dreamHandler?;
    constructor(ctx: Context, config?: Partial<MagicMemoryConfig>, deps?: MagicMemoryServiceDeps);
    getConfig(): ResolvedConfig;
    onConfigChange(listener: () => void): () => void;
    getLifecycleSignal(): AbortSignal;
    registerBackgroundHandlers(handlers: {
        extract?: ExtractCallback;
        dream?: DreamCallback;
    }): void;
    getPublicSettings(): MagicMemorySettingsPayload;
    getSettingsState(): Promise<SettingsGetResponse>;
    updateSettings(patch: MagicMemorySettingsPatch): Promise<SettingsGetResponse>;
    testLlmRoute(override: {
        provider?: string;
        model?: string;
    }, signal?: AbortSignal): Promise<SettingsTestLlmResponse>;
    testEmbeddingSettings(draft?: Partial<EmbeddingConfig> & {
        clearApiKey?: boolean;
    }, signal?: AbortSignal): Promise<SettingsTestEmbeddingResponse>;
    reindexProjectEmbeddings(projectId: string, signal?: AbortSignal): Promise<SettingsReindexEmbeddingsResponse>;
    private loadSettingsOverride;
    private saveSettingsOverride;
    resolveAndRegisterProject(cwd: string): Promise<ResolvedProjectIdentity>;
    upsertProject(projectId: string, displayName: string, canonicalRoot: string): ProjectRecord;
    getProject(projectId: string): ProjectRecord | null;
    listProjects(): ProjectRecord[];
    upsertWorkspace(id: string, name: string, memberProjectIds: readonly string[], shareCategories?: readonly ProjectMemoryCategory[]): WorkspaceRecord;
    writeMemory(input: WriteMemoryInput): WriteMemoryResult;
    getMemory(id: number): MemoryRecord | null;
    listMemories(options: {
        projectId: string;
        scope?: 'project' | 'global' | 'all';
        status?: MemoryStatus | 'all';
        category?: MemoryCategory;
        limit?: number;
    }): MemoryRecord[];
    /**
     * Retrieve memories visible for baseline prompt rendering: deterministic order
     * `(category priority ASC, pinned DESC, importance DESC, id ASC)` so prefixes are byte-stable.
     */
    getBaselineMemories(projectId: string): {
        userProfile: MemoryRecord[];
        projectMemories: MemoryRecord[];
        workspaceMemories: MemoryRecord[];
        maxMemoryId: number;
        maxMutationId: number;
        profileVersion: number;
    };
    getDeltaSinceWatermark(projectId: string, afterMemoryId: number, afterMutationId: number): {
        newMemories: MemoryRecord[];
        mutations: MemoryMutationRecord[];
        maxMemoryId: number;
        maxMutationId: number;
    };
    updateMemory(input: UpdateMemoryInput): MemoryRecord;
    archiveMemory(id: number, projectId: string, reason?: string, allowGlobalMutation?: boolean): MemoryRecord;
    restoreMemory(id: number, projectId: string, allowGlobalMutation?: boolean): MemoryRecord;
    mergeMemories(input: MergeMemoriesInput): MemoryRecord;
    /** Internal column-only update used by Dreamer tasks (mapping, verification, classification). */
    updateMemoryMetadata(id: number, patch: {
        backingFiles?: readonly string[];
        mappingOrigin?: MappingOrigin;
        verificationState?: VerificationState;
        lastVerifiedAt?: number;
        importance?: number;
        shareable?: boolean;
    }): MemoryRecord | null;
    search(req: UnifiedSearchRequest, signal?: AbortSignal): Promise<UnifiedSearchResponse>;
    recordEpisode(input: {
        sessionId: string;
        projectId: string;
        startSeq: number;
        endSeq: number;
        episodeType?: string;
        importance?: number;
        title: string;
        summary: string;
        keyDecisions?: readonly string[];
    }): SessionEpisodeRecord;
    listEpisodes(projectId: string, limit?: number): SessionEpisodeRecord[];
    addNote(input: {
        projectId: string;
        sessionId?: string | null;
        title: string;
        content: string;
        conditionExpr?: string | null;
    }): NoteRecord;
    getNote(id: number): NoteRecord | null;
    listNotes(projectId: string, includeDismissed?: boolean): NoteRecord[];
    dismissNote(id: number, projectId: string): NoteRecord;
    recordSessionHighlight(sessionId: string, projectId: string, seq: number, role: 'user' | 'assistant', content: string): void;
    recordUserObservation(observation: string, sessionId: string): UserObservationRecord;
    listPendingUserObservations(): UserObservationRecord[];
    getSessionState(sessionId: string): SessionTelemetryState | null;
    ensureSessionState(sessionId: string, projectId: string, isSubagent: boolean): SessionTelemetryState;
    updateSessionState(sessionId: string, projectId: string, isSubagent: boolean, patch: {
        baselineInjectedAt?: number;
        baselineMaxMemoryId?: number;
        baselineMaxMutationId?: number;
        baselineProfileVersion?: number;
        injectedMemoryIds?: readonly number[];
        lastCompactionSeq?: number;
        lastExtractedSeq?: number;
        pendingSyncRequested?: boolean;
        incTotalSteps?: number;
        incDeferSteps?: number;
        incReanchorCount?: number;
        incAutoSearchHits?: number;
    }): SessionTelemetryState;
    requestManualSync(sessionId: string, projectId: string): void;
    triggerExtract(sessionId: string, signal?: AbortSignal): Promise<ExtractRunResult>;
    triggerDream(projectId: string, taskName?: DreamTaskName, signal?: AbortSignal): Promise<DreamRunRecord[]>;
    getDreamTaskStatuses(projectId: string): DreamTaskScheduleState[];
    computeTaskBacklog(projectId: string, taskName: DreamTaskName, cfg?: ResolvedConfig): number;
    listRecentDreamRuns(projectId: string, limit?: number): DreamRunRecord[];
    getOverview(projectId: string, sessionId?: string): MagicMemoryOverview;
    exportSnapshot(projectId: string, format?: 'json' | 'markdown'): string;
    runDoctor(): DoctorCheckResult;
    rebuildMemoryFts(): void;
    flushPendingEmbeddings(): Promise<void>;
    private assertMutationScope;
    private syncMemoryFts;
    private appendMutationLog;
    private bumpProjectEpoch;
    private scheduleEmbedding;
}
//# sourceMappingURL=memory-service.d.ts.map