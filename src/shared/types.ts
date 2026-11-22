/**
 * Shared domain, search, Dreamer, telemetry, and RPC types for dsh-magic-memory.
 * Strictly browser-safe (zero `node:` imports) so both Host and Client bundles share one contract.
 */

export const MEMORY_CATEGORIES = [
  'PROJECT_RULES',
  'ARCHITECTURE',
  'CONSTRAINTS',
  'CONFIG_VALUES',
  'NAMING',
  'USER_PROFILE',
] as const

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number]

/** Project-level categories matching Magic-context's five canonical buckets. */
export const PROJECT_MEMORY_CATEGORIES = [
  'PROJECT_RULES',
  'ARCHITECTURE',
  'CONSTRAINTS',
  'CONFIG_VALUES',
  'NAMING',
] as const

export type ProjectMemoryCategory = (typeof PROJECT_MEMORY_CATEGORIES)[number]

export const CATEGORY_PRIORITY: Readonly<Record<MemoryCategory, number>> = {
  PROJECT_RULES: 1,
  CONSTRAINTS: 2,
  ARCHITECTURE: 3,
  CONFIG_VALUES: 4,
  NAMING: 5,
  USER_PROFILE: 0,
}

export const GLOBAL_PROJECT_ID = '__global__'

export type MemoryScope = 'project' | 'global'
export type MemoryStatus = 'active' | 'archived' | 'superseded'
export type MemorySourceKind = 'agent' | 'extractor' | 'dreamer' | 'user'
export type VerificationState = 'unverified' | 'verified' | 'stale' | 'conflict'
export type MappingOrigin = 'unmapped' | 'dreamer' | 'file_independent' | 'host_rejected_fallback'

export interface MemoryRecord {
  readonly id: number
  readonly projectId: string
  readonly category: MemoryCategory
  readonly content: string
  readonly contentHash: string
  readonly importance: number
  readonly scope: MemoryScope
  readonly status: MemoryStatus
  readonly sourceKind: MemorySourceKind
  readonly sourceSessionId: string | null
  readonly backingFiles: readonly string[]
  readonly mappingOrigin: MappingOrigin
  readonly verificationState: VerificationState
  readonly lastVerifiedAt: number | null
  readonly retrievalCount: number
  readonly pinned: boolean
  readonly shareable: boolean
  readonly expiresAt: number | null
  readonly supersededById: number | null
  readonly createdAt: number
  readonly updatedAt: number
  /** Populated when surfaced read-only from a sibling workspace repository. */
  readonly workspaceLabel?: string
}

export type MemoryMutationOp = 'update' | 'archive' | 'merge' | 'restore'

export interface MemoryMutationRecord {
  readonly id: number
  readonly projectId: string
  readonly memoryId: number
  readonly op: MemoryMutationOp
  readonly summary: string
  readonly createdAt: number
}

export interface SessionEpisodeRecord {
  readonly id: number
  readonly sessionId: string
  readonly projectId: string
  readonly startSeq: number
  readonly endSeq: number
  readonly episodeType: string
  readonly importance: number
  readonly title: string
  readonly summary: string
  readonly keyDecisions: readonly string[]
  readonly createdAt: number
}

export type NoteStatus = 'active' | 'triggered' | 'dismissed'

export interface NoteRecord {
  readonly id: number
  readonly projectId: string
  readonly sessionId: string | null
  readonly title: string
  readonly content: string
  readonly conditionExpr: string | null
  readonly status: NoteStatus
  readonly createdAt: number
  readonly updatedAt: number
}

export interface UserObservationRecord {
  readonly id: number
  readonly normalizedKey: string
  readonly observation: string
  readonly evidenceSessions: readonly string[]
  readonly seenCount: number
  readonly promotedMemoryId: number | null
  readonly createdAt: number
  readonly updatedAt: number
}

export interface ProjectRecord {
  readonly projectId: string
  readonly displayName: string
  readonly canonicalRoot: string
  readonly memoryEpoch: number
  readonly lastActiveAt: number
  readonly createdAt: number
}

export interface WorkspaceRecord {
  readonly id: string
  readonly name: string
  readonly shareCategories: readonly ProjectMemoryCategory[]
  readonly memberProjectIds: readonly string[]
  readonly createdAt: number
  readonly updatedAt: number
}

export const DREAM_TASK_NAMES = [
  'map-memories',
  'verify',
  'curate',
  'classify-memories',
  'retrospective',
  'review-user-memories',
] as const

export type DreamTaskName = (typeof DREAM_TASK_NAMES)[number]

export type DreamFailureClass =
  | 'provider_timeout'
  | 'provider_error'
  | 'empty_completion'
  | 'no_models'
  | 'aborted'
  | 'parse_failed'
  | 'lease_lost'
  | 'unknown'

export interface DreamRunRecord {
  readonly id: number
  readonly projectId: string
  readonly taskName: DreamTaskName
  readonly status: 'success' | 'skipped' | 'failed'
  readonly trigger: 'scheduled' | 'manual'
  readonly summary: string
  readonly itemsProcessed: number
  readonly mutationsApplied: number
  readonly modelUsed: string | null
  readonly failureClass: DreamFailureClass | null
  readonly errorMessage: string | null
  readonly durationMs: number
  readonly startedAt: number
  readonly finishedAt: number
}

export interface DreamTaskScheduleState {
  readonly projectId: string
  readonly taskName: DreamTaskName
  readonly enabled: boolean
  readonly intervalMinutes: number
  readonly backlogCount: number
  readonly lastRunAt: number | null
  readonly nextDueAt: number | null
  readonly consecutiveFailures: number
  readonly lastStatus: 'success' | 'skipped' | 'failed' | 'never'
  readonly lastError: string | null
}

export type SearchSource = 'memory' | 'episode' | 'note' | 'session'

export interface UnifiedSearchRequest {
  readonly query: string
  readonly projectId: string
  readonly sessionId?: string
  readonly sources?: readonly SearchSource[]
  readonly categories?: readonly MemoryCategory[]
  readonly from?: string
  readonly to?: string
  readonly limit?: number
  readonly includeVisible?: boolean
  readonly recordRetrieval?: boolean
}

export interface UnifiedSearchHit {
  readonly source: SearchSource
  readonly id: number
  readonly score: number
  readonly bm25Score: number
  readonly lexicalScore: number
  readonly vectorScore: number | null
  readonly title: string
  readonly content: string
  readonly category?: MemoryCategory
  readonly scope?: MemoryScope
  readonly projectId: string
  readonly workspaceLabel?: string
  readonly sessionId?: string | null
  readonly verificationState?: VerificationState
  readonly createdAt: number
  readonly updatedAt: number
}

export interface UnifiedSearchResponse {
  readonly hits: readonly UnifiedSearchHit[]
  readonly suppressedCount: number
  readonly usedVectorSearch: boolean
  readonly totalCandidates: number
}

export interface SessionTelemetryState {
  readonly sessionId: string
  readonly projectId: string
  readonly isSubagent: boolean
  readonly baselineInjectedAt: number | null
  readonly baselineMaxMemoryId: number
  readonly baselineMaxMutationId: number
  readonly baselineProfileVersion: number
  readonly injectedMemoryIds: readonly number[]
  readonly lastCompactionSeq: number
  readonly lastExtractedSeq: number
  readonly pendingSyncRequested: boolean
  readonly totalSteps: number
  readonly deferSteps: number
  readonly reanchorCount: number
  readonly autoSearchHits: number
  readonly updatedAt: number
}

export interface MagicMemoryOverview {
  readonly project: ProjectRecord | null
  readonly countsByCategory: Readonly<Record<MemoryCategory, number>>
  readonly activeMemoryCount: number
  readonly archivedMemoryCount: number
  readonly globalProfileCount: number
  readonly episodeCount: number
  readonly activeNoteCount: number
  readonly pendingObservationCount: number
  readonly embeddingProvider: 'off' | 'openai-compatible'
  readonly embeddedMemoryCount: number
  readonly dbPath: string
  readonly dbSizeBytes: number
  readonly schemaVersion: number
  readonly session: SessionTelemetryState | null
  readonly dreamerEnabled: boolean
  readonly dreamerTasks: readonly DreamTaskScheduleState[]
  readonly recentDreamRuns: readonly DreamRunRecord[]
}

export interface WriteMemoryInput {
  readonly projectId: string
  readonly category: MemoryCategory
  readonly content: string
  readonly importance?: number
  readonly scope?: MemoryScope
  readonly sourceKind?: MemorySourceKind
  readonly sourceSessionId?: string | null
  readonly backingFiles?: readonly string[]
  readonly pinned?: boolean
  readonly expiresAt?: number | null
}

export interface WriteMemoryResult {
  readonly action: 'created' | 'deduplicated'
  readonly memory: MemoryRecord
  readonly nearDuplicates: readonly { id: number; similarity: number; preview: string }[]
}

export interface UpdateMemoryInput {
  readonly id: number
  readonly projectId: string
  readonly content?: string
  readonly category?: MemoryCategory
  readonly importance?: number
  readonly pinned?: boolean
  readonly expiresAt?: number | null
  readonly allowGlobalMutation?: boolean
  readonly consolidation?: boolean
}

export interface MergeMemoriesInput {
  readonly projectId: string
  readonly targetId: number
  readonly sourceIds: readonly number[]
  readonly mergedContent: string
  readonly importance?: number
  readonly allowGlobalMutation?: boolean
}

export interface ExtractRunResult {
  readonly status: 'extracted' | 'skipped' | 'busy' | 'failed'
  readonly reason?: string
  readonly episode?: SessionEpisodeRecord
  readonly factsPromoted: number
  readonly factsDeduplicated: number
  readonly observationsRecorded: number
  readonly range?: { startSeq: number; endSeq: number }
}

export interface DoctorCheckResult {
  readonly ok: boolean
  readonly schemaVersion: number
  readonly journalMode: string
  readonly dbPath: string
  readonly dbSizeBytes: number
  readonly activeLeases: number
  readonly staleLeasesCleaned: number
  readonly ftsConsistent: boolean
  readonly warnings: readonly string[]
}

export interface AvailableModelInfo {
  readonly provider: string
  readonly providerName: string
  readonly id: string
  readonly name: string
  readonly description?: string
}

export interface PublicEmbeddingSettings {
  readonly provider: 'off' | 'openai-compatible'
  readonly endpoint: string
  readonly model: string
  readonly hasApiKey: boolean
  readonly apiKeyPreview: string
  readonly apiKeyEnv: string
  readonly timeoutMs: number
}

export interface MagicMemorySettingsPayload {
  readonly enabled: boolean
  readonly injectOnStart: boolean
  readonly reanchorAfterCompaction: boolean
  readonly includeSubagents: 'search-only' | 'full' | 'off'
  readonly baselineBudgetTokens: number
  readonly userProfileBudgetTokens: number
  readonly deltaBudgetTokens: number
  readonly maxMemoryChars: number
  readonly autoSearch: {
    readonly enabled: boolean
    readonly scoreThreshold: number
    readonly maxHints: number
    readonly minPromptChars: number
  }
  readonly extractor: {
    readonly enabled: boolean
    readonly triggerTokens: number
    readonly onCompaction: boolean
    readonly cooldownSeconds: number
    readonly provider: string
    readonly model: string
    readonly maxOutputTokens: number
    readonly autoPromote: boolean
  }
  readonly dreamer: {
    readonly enabled: boolean
    readonly tickIntervalMinutes: number
    readonly separateModel: boolean
    readonly provider: string
    readonly model: string
    readonly maxOutputTokens: number
    readonly timeoutMs: number
    readonly recencyDays: number
    readonly userMemoriesEnabled: boolean
    readonly userPromoteThreshold: number
    readonly taskIntervalsMinutes: Readonly<Record<DreamTaskName, number>>
  }
  readonly embedding: PublicEmbeddingSettings
}

export interface MagicMemorySettingsPatch {
  readonly enabled?: boolean
  readonly injectOnStart?: boolean
  readonly reanchorAfterCompaction?: boolean
  readonly includeSubagents?: 'search-only' | 'full' | 'off'
  readonly baselineBudgetTokens?: number
  readonly userProfileBudgetTokens?: number
  readonly deltaBudgetTokens?: number
  readonly maxMemoryChars?: number
  readonly autoSearch?: Partial<MagicMemorySettingsPayload['autoSearch']>
  readonly extractor?: Partial<MagicMemorySettingsPayload['extractor']>
  readonly dreamer?: Partial<Omit<MagicMemorySettingsPayload['dreamer'], 'taskIntervalsMinutes'>> & {
    readonly taskIntervalsMinutes?: Partial<Record<DreamTaskName, number>>
  }
  readonly embedding?: {
    readonly provider?: 'off' | 'openai-compatible'
    readonly endpoint?: string
    readonly model?: string
    readonly apiKey?: string
    readonly clearApiKey?: boolean
    readonly apiKeyEnv?: string
    readonly timeoutMs?: number
  }
}

export interface SettingsGetResponse {
  readonly settings: MagicMemorySettingsPayload
  readonly availableModels: readonly AvailableModelInfo[]
  readonly resolvedExtractorRoute: { readonly provider: string; readonly model: string } | null
  readonly resolvedDreamerRoute: { readonly provider: string; readonly model: string } | null
  readonly hasEnvEmbeddingKey: boolean
  readonly dbPath: string
}

export interface SettingsTestLlmResponse {
  readonly ok: boolean
  readonly latencyMs: number
  readonly route: { readonly provider: string; readonly model: string } | null
  readonly message: string
}

export interface SettingsTestEmbeddingResponse {
  readonly ok: boolean
  readonly latencyMs: number
  readonly dims?: number
  readonly endpoint?: string
  readonly model?: string
  readonly message: string
}

export interface SettingsReindexEmbeddingsResponse {
  readonly total: number
  readonly embedded: number
  readonly skipped: number
  readonly failed: number
  readonly message: string
}
