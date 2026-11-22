/**
 * Single-source-of-truth Cordis Service (`ctx.magicMemory`) implementing all
 * memory, episode, note, workspace, session telemetry, export, and doctor operations.
 *
 * Follows DSH's "One operation, two callers" rule: Agent tools, Slash commands,
 * Background Extractor/Dreamer, and the Web/Desktop Sidebar RPC bridge all invoke
 * the exact same methods here.
 */

import { Context, Service } from '@deepseek-ai/cordis'
import {
  DEFAULT_AUTO_SEARCH,
  DEFAULT_DREAMER,
  DEFAULT_DREAMER_INTERVALS,
  DEFAULT_EMBEDDING,
  DEFAULT_EXTRACTOR,
  getDreamTaskIntervalMinutes,
  readConfigSnapshot,
  type AutoSearchConfig,
  type DreamerConfig,
  type EmbeddingConfig,
  type ExtractorConfig,
  type MagicMemoryConfig,
  type ResolvedConfig,
} from '../config.js'
import {
  listAvailableLlmModels,
  resolveAuxiliaryRouteAsync,
  runAuxiliaryCompletion,
} from '../background/llm-helper.js'
import {
  EmbeddingService,
  providerModelKey,
  resolveEmbeddingApiKey,
  type FetchLike,
} from '../search/embedding.js'
import {
  computeContentHash,
  containsSecretPattern,
  ngramJaccardSimilarity,
  normalizeForHash,
  tokenizeForSearch,
} from '../search/tokenizer.js'
import { UnifiedSearchEngine } from '../search/unified-search.js'
import {
  CATEGORY_PRIORITY,
  DREAM_TASK_NAMES,
  GLOBAL_PROJECT_ID,
  MEMORY_CATEGORIES,
  type DoctorCheckResult,
  type DreamRunRecord,
  type DreamTaskName,
  type DreamTaskScheduleState,
  type ExtractRunResult,
  type MagicMemoryOverview,
  type MagicMemorySettingsPatch,
  type MagicMemorySettingsPayload,
  type MappingOrigin,
  type MemoryCategory,
  type MemoryMutationOp,
  type MemoryMutationRecord,
  type MemoryRecord,
  type MemoryScope,
  type MemorySourceKind,
  type MemoryStatus,
  type MergeMemoriesInput,
  type NoteRecord,
  type ProjectMemoryCategory,
  type ProjectRecord,
  type SessionEpisodeRecord,
  type SessionTelemetryState,
  type SettingsGetResponse,
  type SettingsReindexEmbeddingsResponse,
  type SettingsTestEmbeddingResponse,
  type SettingsTestLlmResponse,
  type UnifiedSearchRequest,
  type UnifiedSearchResponse,
  type UpdateMemoryInput,
  type UserObservationRecord,
  type VerificationState,
  type WorkspaceRecord,
  type WriteMemoryInput,
  type WriteMemoryResult,
} from '../shared/types.js'
import { MemoryDatabase } from '../storage/database.js'
import { LeaseManager } from '../storage/leases.js'
import { ProjectIdentityResolver, type ResolvedProjectIdentity } from '../storage/project-identity.js'

declare module '@deepseek-ai/cordis' {
  interface Context {
    magicMemory: MagicMemoryService
  }
}

export interface MagicMemoryServiceDeps {
  readonly fetchImpl?: FetchLike
}

interface StoredSettingsOverride {
  enabled?: boolean
  injectOnStart?: boolean
  reanchorAfterCompaction?: boolean
  includeSubagents?: 'search-only' | 'full' | 'off'
  baselineBudgetTokens?: number
  userProfileBudgetTokens?: number
  deltaBudgetTokens?: number
  maxMemoryChars?: number
  autoSearch?: Partial<AutoSearchConfig>
  embedding?: Partial<EmbeddingConfig>
  extractor?: Partial<ExtractorConfig>
  dreamer?: Partial<Omit<DreamerConfig, 'taskIntervalsMinutes'>> & {
    taskIntervalsMinutes?: Partial<Record<DreamTaskName, number>>
  }
}

const RUNTIME_SETTINGS_KEY = 'runtime_override'

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

function clampFloat(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function maskSecret(raw: string | undefined): { hasApiKey: boolean; apiKeyPreview: string } {
  const trimmed = (raw ?? '').trim()
  if (trimmed.length === 0) return { hasApiKey: false, apiKeyPreview: '' }
  if (trimmed.length <= 8) return { hasApiKey: true, apiKeyPreview: '••••' }
  return {
    hasApiKey: true,
    apiKeyPreview: `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`,
  }
}

export type ExtractCallback = (sessionId: string, signal?: AbortSignal) => Promise<ExtractRunResult>
export type DreamCallback = (
  projectId: string,
  taskName?: DreamTaskName,
  signal?: AbortSignal,
) => Promise<DreamRunRecord[]>

export class MagicMemoryService extends Service {
  readonly storage: MemoryDatabase
  readonly leases: LeaseManager
  readonly embeddings: EmbeddingService
  readonly searchEngine: UnifiedSearchEngine
  readonly projectResolver: ProjectIdentityResolver

  private readonly rawConfig: Partial<MagicMemoryConfig>
  private readonly lifecycleAbort = new AbortController()
  private readonly pendingEmbedTasks = new Set<Promise<void>>()
  private readonly configListeners = new Set<() => void>()
  private settingsOverride: StoredSettingsOverride = {}
  private extractHandler?: ExtractCallback
  private dreamHandler?: DreamCallback

  constructor(
    ctx: Context,
    config: Partial<MagicMemoryConfig> = {},
    deps: MagicMemoryServiceDeps = {},
  ) {
    super(ctx, 'magicMemory')
    this.rawConfig = config
    const snap = readConfigSnapshot(config)
    this.storage = new MemoryDatabase(snap.dbPath)
    this.leases = new LeaseManager(this.storage)
    this.embeddings = new EmbeddingService(this.storage, deps.fetchImpl)
    this.searchEngine = new UnifiedSearchEngine(this.storage, this.embeddings)
    this.projectResolver = new ProjectIdentityResolver()
    this.settingsOverride = this.loadSettingsOverride()

    ctx.effect(() => () => {
      this.lifecycleAbort.abort(new Error('dsh-magic-memory disposed'))
      this.storage.close()
    })
  }

  getConfig(): ResolvedConfig {
    const base = readConfigSnapshot(this.rawConfig)
    const ov = this.settingsOverride
    return {
      dbPath: base.dbPath,
      enabled: ov.enabled ?? base.enabled,
      injectOnStart: ov.injectOnStart ?? base.injectOnStart,
      reanchorAfterCompaction: ov.reanchorAfterCompaction ?? base.reanchorAfterCompaction,
      includeSubagents: ov.includeSubagents ?? base.includeSubagents,
      baselineBudgetTokens: ov.baselineBudgetTokens ?? base.baselineBudgetTokens,
      userProfileBudgetTokens: ov.userProfileBudgetTokens ?? base.userProfileBudgetTokens,
      deltaBudgetTokens: ov.deltaBudgetTokens ?? base.deltaBudgetTokens,
      maxMemoryChars: ov.maxMemoryChars ?? base.maxMemoryChars,
      autoSearch: { ...DEFAULT_AUTO_SEARCH, ...base.autoSearch, ...(ov.autoSearch ?? {}) },
      embedding: { ...DEFAULT_EMBEDDING, ...base.embedding, ...(ov.embedding ?? {}) },
      extractor: { ...DEFAULT_EXTRACTOR, ...base.extractor, ...(ov.extractor ?? {}) },
      dreamer: {
        ...DEFAULT_DREAMER,
        ...base.dreamer,
        ...(ov.dreamer ?? {}),
        taskIntervalsMinutes: {
          ...DEFAULT_DREAMER_INTERVALS,
          ...base.dreamer.taskIntervalsMinutes,
          ...(ov.dreamer?.taskIntervalsMinutes ?? {}),
        },
      },
    }
  }

  onConfigChange(listener: () => void): () => void {
    this.configListeners.add(listener)
    return () => {
      this.configListeners.delete(listener)
    }
  }

  getLifecycleSignal(): AbortSignal {
    return this.lifecycleAbort.signal
  }

  registerBackgroundHandlers(handlers: {
    extract?: ExtractCallback
    dream?: DreamCallback
  }): void {
    if (handlers.extract) this.extractHandler = handlers.extract
    if (handlers.dream) this.dreamHandler = handlers.dream
  }

  // ── Runtime Settings & Diagnostics ──────────────────────────────────────────

  getPublicSettings(): MagicMemorySettingsPayload {
    const cfg = this.getConfig()
    const masked = maskSecret(cfg.embedding.apiKey)
    return {
      enabled: cfg.enabled,
      injectOnStart: cfg.injectOnStart,
      reanchorAfterCompaction: cfg.reanchorAfterCompaction,
      includeSubagents: cfg.includeSubagents,
      baselineBudgetTokens: cfg.baselineBudgetTokens,
      userProfileBudgetTokens: cfg.userProfileBudgetTokens,
      deltaBudgetTokens: cfg.deltaBudgetTokens,
      maxMemoryChars: cfg.maxMemoryChars,
      autoSearch: { ...cfg.autoSearch },
      extractor: { ...cfg.extractor },
      dreamer: {
        ...cfg.dreamer,
        separateModel:
          cfg.dreamer.separateModel === true ||
          cfg.dreamer.provider.trim() !== cfg.extractor.provider.trim() ||
          cfg.dreamer.model.trim() !== cfg.extractor.model.trim(),
        taskIntervalsMinutes: { ...cfg.dreamer.taskIntervalsMinutes },
      },
      embedding: {
        provider: cfg.embedding.provider,
        endpoint: cfg.embedding.endpoint,
        model: cfg.embedding.model,
        hasApiKey: masked.hasApiKey,
        apiKeyPreview: masked.apiKeyPreview,
        apiKeyEnv: cfg.embedding.apiKeyEnv,
        timeoutMs: cfg.embedding.timeoutMs,
      },
    }
  }

  async getSettingsState(): Promise<SettingsGetResponse> {
    const cfg = this.getConfig()
    const [availableModels, resolvedExtractorRoute, resolvedDreamerRoute] = await Promise.all([
      listAvailableLlmModels(this.ctx),
      resolveAuxiliaryRouteAsync(this.ctx, {
        provider: cfg.extractor.provider,
        model: cfg.extractor.model,
      }),
      resolveAuxiliaryRouteAsync(this.ctx, {
        provider: cfg.dreamer.provider,
        model: cfg.dreamer.model,
      }),
    ])
    const envVar = cfg.embedding.apiKeyEnv.trim()
    const hasEnvEmbeddingKey = envVar.length > 0 && (process.env[envVar] ?? '').trim().length > 0
    return {
      settings: this.getPublicSettings(),
      availableModels,
      resolvedExtractorRoute,
      resolvedDreamerRoute,
      hasEnvEmbeddingKey,
      dbPath: this.storage.path,
    }
  }

  async updateSettings(patch: MagicMemorySettingsPatch): Promise<SettingsGetResponse> {
    const current = this.getConfig()
    const next: StoredSettingsOverride = {
      ...this.settingsOverride,
    }

    if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled
    if (typeof patch.injectOnStart === 'boolean') next.injectOnStart = patch.injectOnStart
    if (typeof patch.reanchorAfterCompaction === 'boolean') {
      next.reanchorAfterCompaction = patch.reanchorAfterCompaction
    }
    if (patch.includeSubagents === 'search-only' || patch.includeSubagents === 'full' || patch.includeSubagents === 'off') {
      next.includeSubagents = patch.includeSubagents
    }
    if (patch.baselineBudgetTokens !== undefined) {
      next.baselineBudgetTokens = clampInt(patch.baselineBudgetTokens, 200, 32_000, current.baselineBudgetTokens)
    }
    if (patch.userProfileBudgetTokens !== undefined) {
      next.userProfileBudgetTokens = clampInt(patch.userProfileBudgetTokens, 100, 8_000, current.userProfileBudgetTokens)
    }
    if (patch.deltaBudgetTokens !== undefined) {
      next.deltaBudgetTokens = clampInt(patch.deltaBudgetTokens, 100, 8_000, current.deltaBudgetTokens)
    }
    if (patch.maxMemoryChars !== undefined) {
      next.maxMemoryChars = clampInt(patch.maxMemoryChars, 200, 10_000, current.maxMemoryChars)
    }

    if (patch.autoSearch) {
      next.autoSearch = {
        ...current.autoSearch,
        ...(typeof patch.autoSearch.enabled === 'boolean' ? { enabled: patch.autoSearch.enabled } : {}),
        ...(patch.autoSearch.scoreThreshold !== undefined
          ? { scoreThreshold: clampFloat(patch.autoSearch.scoreThreshold, 0.05, 1, current.autoSearch.scoreThreshold) }
          : {}),
        ...(patch.autoSearch.maxHints !== undefined
          ? { maxHints: clampInt(patch.autoSearch.maxHints, 1, 10, current.autoSearch.maxHints) }
          : {}),
        ...(patch.autoSearch.minPromptChars !== undefined
          ? { minPromptChars: clampInt(patch.autoSearch.minPromptChars, 4, 200, current.autoSearch.minPromptChars) }
          : {}),
      }
    }

    if (patch.extractor) {
      next.extractor = {
        ...current.extractor,
        ...(typeof patch.extractor.enabled === 'boolean' ? { enabled: patch.extractor.enabled } : {}),
        ...(typeof patch.extractor.onCompaction === 'boolean' ? { onCompaction: patch.extractor.onCompaction } : {}),
        ...(typeof patch.extractor.autoPromote === 'boolean' ? { autoPromote: patch.extractor.autoPromote } : {}),
        ...(typeof patch.extractor.provider === 'string' ? { provider: patch.extractor.provider.trim() } : {}),
        ...(typeof patch.extractor.model === 'string' ? { model: patch.extractor.model.trim() } : {}),
        ...(patch.extractor.triggerTokens !== undefined
          ? { triggerTokens: clampInt(patch.extractor.triggerTokens, 1000, 200_000, current.extractor.triggerTokens) }
          : {}),
        ...(patch.extractor.cooldownSeconds !== undefined
          ? { cooldownSeconds: clampInt(patch.extractor.cooldownSeconds, 0, 3600, current.extractor.cooldownSeconds) }
          : {}),
        ...(patch.extractor.maxOutputTokens !== undefined
          ? { maxOutputTokens: clampInt(patch.extractor.maxOutputTokens, 256, 16_384, current.extractor.maxOutputTokens) }
          : {}),
      }
    }

    if (patch.dreamer) {
      const mergedIntervals = { ...current.dreamer.taskIntervalsMinutes }
      if (patch.dreamer.taskIntervalsMinutes) {
        for (const taskName of DREAM_TASK_NAMES) {
          const v = patch.dreamer.taskIntervalsMinutes[taskName]
          if (v !== undefined) {
            mergedIntervals[taskName] = clampInt(v, 0, 43_200, mergedIntervals[taskName])
          }
        }
      }
      next.dreamer = {
        ...current.dreamer,
        ...(typeof patch.dreamer.enabled === 'boolean' ? { enabled: patch.dreamer.enabled } : {}),
        ...(typeof patch.dreamer.separateModel === 'boolean' ? { separateModel: patch.dreamer.separateModel } : {}),
        ...(typeof patch.dreamer.userMemoriesEnabled === 'boolean'
          ? { userMemoriesEnabled: patch.dreamer.userMemoriesEnabled }
          : {}),
        ...(typeof patch.dreamer.provider === 'string' ? { provider: patch.dreamer.provider.trim() } : {}),
        ...(typeof patch.dreamer.model === 'string' ? { model: patch.dreamer.model.trim() } : {}),
        ...(patch.dreamer.tickIntervalMinutes !== undefined
          ? { tickIntervalMinutes: clampInt(patch.dreamer.tickIntervalMinutes, 1, 1440, current.dreamer.tickIntervalMinutes) }
          : {}),
        ...(patch.dreamer.maxOutputTokens !== undefined
          ? { maxOutputTokens: clampInt(patch.dreamer.maxOutputTokens, 512, 16_384, current.dreamer.maxOutputTokens) }
          : {}),
        ...(patch.dreamer.timeoutMs !== undefined
          ? { timeoutMs: clampInt(patch.dreamer.timeoutMs, 5000, 300_000, current.dreamer.timeoutMs) }
          : {}),
        ...(patch.dreamer.recencyDays !== undefined
          ? { recencyDays: clampInt(patch.dreamer.recencyDays, 1, 365, current.dreamer.recencyDays) }
          : {}),
        ...(patch.dreamer.userPromoteThreshold !== undefined
          ? { userPromoteThreshold: clampInt(patch.dreamer.userPromoteThreshold, 2, 20, current.dreamer.userPromoteThreshold) }
          : {}),
        taskIntervalsMinutes: mergedIntervals,
      }
    }

    if (patch.embedding) {
      const nextEmb: EmbeddingConfig = {
        ...current.embedding,
        ...(patch.embedding.provider === 'off' || patch.embedding.provider === 'openai-compatible'
          ? { provider: patch.embedding.provider }
          : {}),
        ...(typeof patch.embedding.endpoint === 'string' ? { endpoint: patch.embedding.endpoint.trim() } : {}),
        ...(typeof patch.embedding.model === 'string' ? { model: patch.embedding.model.trim() } : {}),
        ...(typeof patch.embedding.apiKeyEnv === 'string' ? { apiKeyEnv: patch.embedding.apiKeyEnv.trim() } : {}),
        ...(patch.embedding.timeoutMs !== undefined
          ? { timeoutMs: clampInt(patch.embedding.timeoutMs, 1000, 120_000, current.embedding.timeoutMs) }
          : {}),
      }
      if (patch.embedding.clearApiKey === true) {
        nextEmb.apiKey = ''
      } else if (typeof patch.embedding.apiKey === 'string' && patch.embedding.apiKey.trim().length > 0) {
        nextEmb.apiKey = patch.embedding.apiKey.trim()
      }
      next.embedding = nextEmb
    }

    this.settingsOverride = next
    this.saveSettingsOverride(next)
    for (const listener of this.configListeners) {
      try {
        listener()
      } catch {
        // Ignore individual listener errors
      }
    }
    return this.getSettingsState()
  }

  async testLlmRoute(
    override: { provider?: string; model?: string },
    signal?: AbortSignal,
  ): Promise<SettingsTestLlmResponse> {
    const startedAt = Date.now()
    const route = await resolveAuxiliaryRouteAsync(this.ctx, override)
    if (!route) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        route: null,
        message: 'No active LLM provider/model found in DSH. Configure a provider or select a model explicitly.',
      }
    }
    const outcome = await runAuxiliaryCompletion(this.ctx, {
      route,
      systemPrompt: 'You are a connectivity test endpoint. Reply with exactly: OK',
      userPrompt: 'Ping',
      maxTokens: 16,
      timeoutMs: 25_000,
      purpose: 'magic-memory-settings-test',
      signal,
    })
    const latencyMs = Date.now() - startedAt
    if (outcome.ok) {
      return {
        ok: true,
        latencyMs,
        route: outcome.route,
        message: `Connected to ${outcome.route.provider}/${outcome.route.model} (${latencyMs}ms)`,
      }
    }
    return {
      ok: false,
      latencyMs,
      route: outcome.route,
      message: outcome.message,
    }
  }

  async testEmbeddingSettings(
    draft: Partial<EmbeddingConfig> & { clearApiKey?: boolean } = {},
    signal?: AbortSignal,
  ): Promise<SettingsTestEmbeddingResponse> {
    const current = this.getConfig().embedding
    const effective: EmbeddingConfig = {
      ...current,
      ...(draft.provider === 'off' || draft.provider === 'openai-compatible' ? { provider: draft.provider } : {}),
      ...(typeof draft.endpoint === 'string' ? { endpoint: draft.endpoint.trim() } : {}),
      ...(typeof draft.model === 'string' ? { model: draft.model.trim() } : {}),
      ...(typeof draft.apiKeyEnv === 'string' ? { apiKeyEnv: draft.apiKeyEnv.trim() } : {}),
      ...(draft.timeoutMs !== undefined ? { timeoutMs: clampInt(draft.timeoutMs, 1000, 120_000, current.timeoutMs) } : {}),
    }
    if (draft.clearApiKey === true) {
      effective.apiKey = ''
    } else if (typeof draft.apiKey === 'string' && draft.apiKey.trim().length > 0) {
      effective.apiKey = draft.apiKey.trim()
    }
    // Check env availability hint if no key at all
    const res = await this.embeddings.testConnectivity(effective, signal)
    const hasKey = resolveEmbeddingApiKey(effective).length > 0
    if (!res.ok && !hasKey && res.message.includes('401')) {
      return {
        ...res,
        message: `${res.message} (no API key configured and env ${effective.apiKeyEnv || 'unset'} is empty)`,
      }
    }
    return res
  }

  async reindexProjectEmbeddings(
    projectId: string,
    signal?: AbortSignal,
  ): Promise<SettingsReindexEmbeddingsResponse> {
    const cfg = this.getConfig().embedding
    if (!this.embeddings.isConfigured(cfg)) {
      return {
        total: 0,
        embedded: 0,
        skipped: 0,
        failed: 0,
        message: 'Embedding provider is disabled or missing endpoint/model.',
      }
    }

    const modelKey = providerModelKey(cfg)
    const rows = this.storage.db
      .prepare(
        `SELECT m.id, m.content, m.content_hash, e.provider_model AS emb_model, e.content_hash AS emb_hash
         FROM memories m
         LEFT JOIN memory_embeddings e
           ON e.target_kind = 'memory' AND e.target_id = m.id
         WHERE m.status = 'active'
           AND (m.project_id = ? OR m.scope = 'global')
         ORDER BY m.id ASC`,
      )
      .all(projectId) as {
      id: number
      content: string
      content_hash: string
      emb_model: string | null
      emb_hash: string | null
    }[]

    const stale = rows.filter(r => r.emb_model !== modelKey || r.emb_hash !== r.content_hash)
    const skipped = rows.length - stale.length
    let embedded = 0
    let failed = 0

    const BATCH_SIZE = 16
    for (let i = 0; i < stale.length; i += BATCH_SIZE) {
      if (signal?.aborted || this.lifecycleAbort.signal.aborted) break
      const batch = stale.slice(i, i + BATCH_SIZE)
      const vectors = await this.embeddings.embedTexts(
        batch.map(b => b.content),
        cfg,
        signal,
      )
      if (!vectors || vectors.length !== batch.length) {
        failed += batch.length
        continue
      }
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j]!
        const vec = vectors[j]!
        if (this.embeddings.saveEmbeddingIfHashMatches('memory', item.id, item.content_hash, cfg, vec)) {
          embedded++
        }
      }
    }

    return {
      total: rows.length,
      embedded,
      skipped,
      failed,
      message:
        failed > 0
          ? `Indexed ${embedded}/${rows.length} (${skipped} up-to-date, ${failed} failed)`
          : `Indexed ${embedded} new embeddings (${skipped} already up-to-date, total ${rows.length})`,
    }
  }

  private loadSettingsOverride(): StoredSettingsOverride {
    try {
      const row = this.storage.db
        .prepare('SELECT value_json FROM plugin_settings WHERE key = ?')
        .get(RUNTIME_SETTINGS_KEY) as { value_json?: string } | undefined
      if (!row?.value_json) return {}
      const parsed = JSON.parse(row.value_json) as unknown
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as StoredSettingsOverride
      }
    } catch {
      // Ignore malformed settings row
    }
    return {}
  }

  private saveSettingsOverride(override: StoredSettingsOverride): void {
    const now = Date.now()
    const payload = JSON.stringify(override)
    this.storage.transaction(() => {
      this.storage.db
        .prepare(
          `INSERT INTO plugin_settings (key, value_json, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET
             value_json = excluded.value_json,
             updated_at = excluded.updated_at`,
        )
        .run(RUNTIME_SETTINGS_KEY, payload, now)
    })
  }

  // ── Project & Workspace Operations ──────────────────────────────────────────

  async resolveAndRegisterProject(cwd: string): Promise<ResolvedProjectIdentity> {
    const resolved = await this.projectResolver.resolve(cwd)
    this.upsertProject(resolved.projectId, resolved.displayName, resolved.canonicalRoot)
    return resolved
  }

  upsertProject(projectId: string, displayName: string, canonicalRoot: string): ProjectRecord {
    const now = Date.now()
    return this.storage.transaction(() => {
      this.storage.db
        .prepare(
          `INSERT INTO projects (project_id, display_name, canonical_root, memory_epoch, last_active_at, created_at)
           VALUES (?, ?, ?, 1, ?, ?)
           ON CONFLICT(project_id) DO UPDATE SET
             display_name = CASE WHEN excluded.display_name != '' THEN excluded.display_name ELSE projects.display_name END,
             canonical_root = CASE WHEN excluded.canonical_root != '' THEN excluded.canonical_root ELSE projects.canonical_root END,
             last_active_at = excluded.last_active_at`,
        )
        .run(projectId, displayName, canonicalRoot, now, now)
      return this.getProject(projectId)!
    })
  }

  getProject(projectId: string): ProjectRecord | null {
    const row = this.storage.db
      .prepare('SELECT * FROM projects WHERE project_id = ?')
      .get(projectId) as ProjectRow | undefined
    return row ? mapProjectRow(row) : null
  }

  listProjects(): ProjectRecord[] {
    const rows = this.storage.db
      .prepare('SELECT * FROM projects WHERE project_id != ? ORDER BY last_active_at DESC')
      .all(GLOBAL_PROJECT_ID) as unknown as ProjectRow[]
    return rows.map(mapProjectRow)
  }

  upsertWorkspace(
    id: string,
    name: string,
    memberProjectIds: readonly string[],
    shareCategories: readonly ProjectMemoryCategory[] = ['CONSTRAINTS'],
  ): WorkspaceRecord {
    const now = Date.now()
    return this.storage.transaction(() => {
      this.storage.db
        .prepare(
          `INSERT INTO workspaces (id, name, share_categories_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             share_categories_json = excluded.share_categories_json,
             updated_at = excluded.updated_at`,
        )
        .run(id, name, JSON.stringify(shareCategories), now, now)

      this.storage.db.prepare('DELETE FROM workspace_members WHERE workspace_id = ?').run(id)
      const insertMember = this.storage.db.prepare(
        'INSERT OR IGNORE INTO workspace_members (workspace_id, project_id, added_at) VALUES (?, ?, ?)',
      )
      for (const pid of memberProjectIds) {
        if (!this.getProject(pid)) {
          this.upsertProject(pid, pid, '')
        }
        insertMember.run(id, pid, now)
      }
      return {
        id,
        name,
        shareCategories: [...shareCategories],
        memberProjectIds: [...memberProjectIds],
        createdAt: now,
        updatedAt: now,
      }
    })
  }

  // ── Memory CRUD & Deduplication ─────────────────────────────────────────────

  writeMemory(input: WriteMemoryInput): WriteMemoryResult {
    const cfg = this.getConfig()
    const content = input.content.trim()
    if (content.length === 0) {
      throw new Error('Memory content cannot be empty')
    }
    if (content.length > cfg.maxMemoryChars) {
      throw new Error(`Memory content exceeds maxMemoryChars (${content.length} > ${cfg.maxMemoryChars})`)
    }

    const scope: MemoryScope = input.scope ?? (input.category === 'USER_PROFILE' ? 'global' : 'project')
    const targetProjectId = scope === 'global' ? GLOBAL_PROJECT_ID : input.projectId
    const category: MemoryCategory = scope === 'global' ? 'USER_PROFILE' : input.category
    const importance = Math.max(1, Math.min(100, Math.round(input.importance ?? 55)))
    const contentHash = computeContentHash(content)
    const searchTokens = tokenizeForSearch(content)
    const shareable = containsSecretPattern(content) ? 0 : 1
    const now = Date.now()

    const result = this.storage.transaction(() => {
      // Exact duplicate check within (project_id, category, content_hash)
      const existing = this.storage.db
        .prepare(
          `SELECT * FROM memories
           WHERE project_id = ? AND category = ? AND content_hash = ? AND status = 'active'
           LIMIT 1`,
        )
        .get(targetProjectId, category, contentHash) as MemoryRow | undefined

      if (existing) {
        // Bump importance/updated_at gently if caller gave higher importance
        const nextImportance = Math.max(existing.importance, importance)
        const nextPinned = input.pinned === true ? 1 : existing.pinned
        this.storage.db
          .prepare('UPDATE memories SET importance = ?, pinned = ?, updated_at = ? WHERE id = ?')
          .run(nextImportance, nextPinned, now, existing.id)
        const updated = this.getMemory(existing.id)!
        return {
          action: 'deduplicated' as const,
          memory: updated,
          nearDuplicates: [],
        }
      }

      // Near-duplicate check inside same project + category (informational warning, never drops distinct facts silently)
      const peers = this.storage.db
        .prepare(
          `SELECT id, content FROM memories
           WHERE project_id = ? AND category = ? AND status = 'active'
           ORDER BY updated_at DESC LIMIT 80`,
        )
        .all(targetProjectId, category) as { id: number; content: string }[]

      const nearDuplicates: { id: number; similarity: number; preview: string }[] = []
      for (const peer of peers) {
        const sim = ngramJaccardSimilarity(content, peer.content)
        if (sim >= 0.78) {
          nearDuplicates.push({
            id: peer.id,
            similarity: Number(sim.toFixed(3)),
            preview: peer.content.slice(0, 100),
          })
        }
      }
      nearDuplicates.sort((a, b) => b.similarity - a.similarity)

      const backingFilesJson = JSON.stringify(input.backingFiles ?? [])
      const mappingOrigin: MappingOrigin = input.backingFiles && input.backingFiles.length > 0 ? 'dreamer' : 'unmapped'

      const insertRes = this.storage.db
        .prepare(
          `INSERT INTO memories (
             project_id, category, content, content_hash, search_tokens,
             importance, scope, status, source_kind, source_session_id,
             backing_files_json, mapping_origin, verification_state, last_verified_at,
             retrieval_count, pinned, shareable, expires_at, superseded_by_id,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 'unverified', NULL, 0, ?, ?, ?, NULL, ?, ?)`,
        )
        .run(
          targetProjectId,
          category,
          content,
          contentHash,
          searchTokens,
          importance,
          scope,
          input.sourceKind ?? 'agent',
          input.sourceSessionId ?? null,
          backingFilesJson,
          mappingOrigin,
          input.pinned ? 1 : 0,
          shareable,
          input.expiresAt ?? null,
          now,
          now,
        )

      const memoryId = Number(insertRes.lastInsertRowid)
      this.syncMemoryFts(memoryId, targetProjectId, category, searchTokens, 'active')
      this.bumpProjectEpoch(targetProjectId, now)

      return {
        action: 'created' as const,
        memory: this.getMemory(memoryId)!,
        nearDuplicates: nearDuplicates.slice(0, 3),
      }
    })

    if (result.action === 'created') {
      this.scheduleEmbedding('memory', result.memory.id, result.memory.content, result.memory.contentHash)
    }
    return result
  }

  getMemory(id: number): MemoryRecord | null {
    const row = this.storage.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow | undefined
    return row ? mapMemoryRow(row) : null
  }

  listMemories(options: {
    projectId: string
    scope?: 'project' | 'global' | 'all'
    status?: MemoryStatus | 'all'
    category?: MemoryCategory
    limit?: number
  }): MemoryRecord[] {
    const scope = options.scope ?? 'project'
    const status = options.status ?? 'active'
    const limit = Math.max(1, Math.min(500, options.limit ?? 200))
    const where: string[] = []
    const params: (string | number)[] = []

    if (scope === 'global') {
      where.push('project_id = ?')
      params.push(GLOBAL_PROJECT_ID)
    } else if (scope === 'project') {
      where.push('project_id = ?')
      params.push(options.projectId)
    } else {
      where.push('(project_id = ? OR project_id = ?)')
      params.push(options.projectId, GLOBAL_PROJECT_ID)
    }

    if (status !== 'all') {
      where.push('status = ?')
      params.push(status)
    }
    if (options.category) {
      where.push('category = ?')
      params.push(options.category)
    }

    const sql = `SELECT * FROM memories WHERE ${where.join(' AND ')} ORDER BY pinned DESC, importance DESC, id ASC LIMIT ?`
    const rows = this.storage.db.prepare(sql).all(...params, limit) as unknown as MemoryRow[]
    return rows.map(mapMemoryRow)
  }

  /**
   * Retrieve memories visible for baseline prompt rendering: deterministic order
   * `(category priority ASC, pinned DESC, importance DESC, id ASC)` so prefixes are byte-stable.
   */
  getBaselineMemories(projectId: string): {
    userProfile: MemoryRecord[]
    projectMemories: MemoryRecord[]
    workspaceMemories: MemoryRecord[]
    maxMemoryId: number
    maxMutationId: number
    profileVersion: number
  } {
    const now = Date.now()
    const profileRows = this.storage.db
      .prepare(
        `SELECT * FROM memories
         WHERE project_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY pinned DESC, importance DESC, id ASC`,
      )
      .all(GLOBAL_PROJECT_ID, now) as unknown as MemoryRow[]

    const projectRows = this.storage.db
      .prepare(
        `SELECT * FROM memories
         WHERE project_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?)`,
      )
      .all(projectId, now) as unknown as MemoryRow[]

    const projectMemories = projectRows.map(mapMemoryRow).sort(compareBaselineOrder)

    // Read-only shared workspace memories from sibling projects
    const siblingRows = this.storage.db
      .prepare(
        `SELECT m.*, p.display_name AS ws_label, w.share_categories_json
         FROM workspace_members wm1
         JOIN workspaces w ON w.id = wm1.workspace_id
         JOIN workspace_members wm2 ON wm2.workspace_id = w.id
         JOIN projects p ON p.project_id = wm2.project_id
         JOIN memories m ON m.project_id = wm2.project_id
         WHERE wm1.project_id = ?
           AND wm2.project_id != ?
           AND m.status = 'active'
           AND m.shareable = 1
           AND (m.expires_at IS NULL OR m.expires_at > ?)`,
      )
      .all(projectId, projectId, now) as unknown as (MemoryRow & { ws_label: string; share_categories_json: string })[]

    const workspaceMemories: MemoryRecord[] = []
    for (const row of siblingRows) {
      let allowed: string[] = ['CONSTRAINTS']
      try {
        const parsed = JSON.parse(row.share_categories_json) as unknown
        if (Array.isArray(parsed)) allowed = parsed.filter((x): x is string => typeof x === 'string')
      } catch {
        // Default
      }
      if (!allowed.includes(row.category)) continue
      workspaceMemories.push({ ...mapMemoryRow(row), workspaceLabel: row.ws_label })
    }
    workspaceMemories.sort(compareBaselineOrder)

    const maxMemRow = this.storage.db
      .prepare('SELECT COALESCE(MAX(id), 0) AS max_id FROM memories WHERE project_id IN (?, ?)')
      .get(projectId, GLOBAL_PROJECT_ID) as { max_id: number }
    const maxMutRow = this.storage.db
      .prepare('SELECT COALESCE(MAX(id), 0) AS max_id FROM memory_mutation_log WHERE project_id IN (?, ?)')
      .get(projectId, GLOBAL_PROJECT_ID) as { max_id: number }
    const globalProj = this.getProject(GLOBAL_PROJECT_ID)

    return {
      userProfile: profileRows.map(mapMemoryRow),
      projectMemories,
      workspaceMemories,
      maxMemoryId: Number(maxMemRow?.max_id ?? 0),
      maxMutationId: Number(maxMutRow?.max_id ?? 0),
      profileVersion: globalProj?.memoryEpoch ?? 1,
    }
  }

  getDeltaSinceWatermark(
    projectId: string,
    afterMemoryId: number,
    afterMutationId: number,
  ): {
    newMemories: MemoryRecord[]
    mutations: MemoryMutationRecord[]
    maxMemoryId: number
    maxMutationId: number
  } {
    const now = Date.now()
    const newMemRows = this.storage.db
      .prepare(
        `SELECT * FROM memories
         WHERE project_id IN (?, ?) AND status = 'active' AND id > ?
           AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY id ASC`,
      )
      .all(projectId, GLOBAL_PROJECT_ID, afterMemoryId, now) as unknown as MemoryRow[]

    const mutRows = this.storage.db
      .prepare(
        `SELECT * FROM memory_mutation_log
         WHERE project_id IN (?, ?) AND id > ?
         ORDER BY id ASC`,
      )
      .all(projectId, GLOBAL_PROJECT_ID, afterMutationId) as unknown as MutationRow[]

    const newMemories = newMemRows.map(mapMemoryRow)
    const mutations = mutRows.map(mapMutationRow)
    const maxMemoryId = newMemories.length > 0 ? newMemories[newMemories.length - 1]!.id : afterMemoryId
    const maxMutationId = mutations.length > 0 ? mutations[mutations.length - 1]!.id : afterMutationId

    return { newMemories, mutations, maxMemoryId, maxMutationId }
  }

  updateMemory(input: UpdateMemoryInput): MemoryRecord {
    const cfg = this.getConfig()
    const now = Date.now()
    let updatedContentChanged = false

    const updated = this.storage.transaction(() => {
      const existing = this.getMemory(input.id)
      if (!existing) {
        throw new Error(`Memory #${input.id} not found`)
      }
      this.assertMutationScope(existing, input.projectId, input.allowGlobalMutation === true)

      const nextContent = input.content !== undefined ? input.content.trim() : existing.content
      if (nextContent.length === 0) throw new Error('Updated memory content cannot be empty')
      if (nextContent.length > cfg.maxMemoryChars) {
        throw new Error(`Updated memory content exceeds maxMemoryChars (${nextContent.length} > ${cfg.maxMemoryChars})`)
      }

      const nextCategory = existing.scope === 'global' ? 'USER_PROFILE' : (input.category ?? existing.category)
      const nextImportance = input.importance !== undefined
        ? Math.max(1, Math.min(100, Math.round(input.importance)))
        : existing.importance
      const nextPinned = input.pinned !== undefined ? input.pinned : existing.pinned
      const nextExpiresAt = input.expiresAt !== undefined ? input.expiresAt : existing.expiresAt
      const nextHash = computeContentHash(nextContent)
      const nextTokens = tokenizeForSearch(nextContent)
      const nextShareable = containsSecretPattern(nextContent) ? 0 : (existing.shareable ? 1 : 0)

      // Duplicate check on (project_id, category, content_hash) excluding self
      const dup = this.storage.db
        .prepare(
          `SELECT id FROM memories
           WHERE project_id = ? AND category = ? AND content_hash = ? AND status = 'active' AND id != ?`,
        )
        .get(existing.projectId, nextCategory, nextHash, existing.id) as { id?: number } | undefined
      if (dup?.id !== undefined) {
        throw new Error(`Duplicate active memory #${dup.id} already exists with identical content in ${nextCategory}`)
      }

      updatedContentChanged = nextHash !== existing.contentHash

      this.storage.db
        .prepare(
          `UPDATE memories
           SET category = ?, content = ?, content_hash = ?, search_tokens = ?,
               importance = ?, pinned = ?, shareable = ?, expires_at = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          nextCategory,
          nextContent,
          nextHash,
          nextTokens,
          nextImportance,
          nextPinned ? 1 : 0,
          nextShareable,
          nextExpiresAt,
          now,
          existing.id,
        )

      this.syncMemoryFts(existing.id, existing.projectId, nextCategory, nextTokens, existing.status)
      this.appendMutationLog(
        existing.projectId,
        existing.id,
        'update',
        `Updated #${existing.id} [${nextCategory}]: ${nextContent.slice(0, 120)}`,
        now,
      )
      this.bumpProjectEpoch(existing.projectId, now)
      return this.getMemory(existing.id)!
    })

    if (updatedContentChanged) {
      this.scheduleEmbedding('memory', updated.id, updated.content, updated.contentHash)
    }
    return updated
  }

  archiveMemory(id: number, projectId: string, reason = 'archived', allowGlobalMutation = false): MemoryRecord {
    const now = Date.now()
    return this.storage.transaction(() => {
      const existing = this.getMemory(id)
      if (!existing) throw new Error(`Memory #${id} not found`)
      this.assertMutationScope(existing, projectId, allowGlobalMutation)

      this.storage.db
        .prepare("UPDATE memories SET status = 'archived', updated_at = ? WHERE id = ?")
        .run(now, id)
      this.syncMemoryFts(id, existing.projectId, existing.category, '', 'archived')
      this.appendMutationLog(existing.projectId, id, 'archive', `Archived #${id} (${reason})`, now)
      this.bumpProjectEpoch(existing.projectId, now)
      return this.getMemory(id)!
    })
  }

  restoreMemory(id: number, projectId: string, allowGlobalMutation = false): MemoryRecord {
    const now = Date.now()
    const restored = this.storage.transaction(() => {
      const existing = this.getMemory(id)
      if (!existing) throw new Error(`Memory #${id} not found`)
      this.assertMutationScope(existing, projectId, allowGlobalMutation)

      const tokens = tokenizeForSearch(existing.content)
      this.storage.db
        .prepare("UPDATE memories SET status = 'active', search_tokens = ?, updated_at = ? WHERE id = ?")
        .run(tokens, now, id)
      this.syncMemoryFts(id, existing.projectId, existing.category, tokens, 'active')
      this.appendMutationLog(existing.projectId, id, 'restore', `Restored #${id}`, now)
      this.bumpProjectEpoch(existing.projectId, now)
      return this.getMemory(id)!
    })
    this.scheduleEmbedding('memory', restored.id, restored.content, restored.contentHash)
    return restored
  }

  mergeMemories(input: MergeMemoriesInput): MemoryRecord {
    const cfg = this.getConfig()
    const mergedText = input.mergedContent.trim()
    if (mergedText.length === 0) throw new Error('Merged content cannot be empty')
    if (mergedText.length > cfg.maxMemoryChars) {
      throw new Error(`Merged content exceeds maxMemoryChars (${mergedText.length} > ${cfg.maxMemoryChars})`)
    }
    const now = Date.now()

    const merged = this.storage.transaction(() => {
      const target = this.getMemory(input.targetId)
      if (!target) throw new Error(`Target memory #${input.targetId} not found`)
      this.assertMutationScope(target, input.projectId, input.allowGlobalMutation === true)

      const uniqueSources = Array.from(new Set(input.sourceIds)).filter(sid => sid !== target.id)
      if (uniqueSources.length === 0) {
        throw new Error('mergeMemories requires at least one distinct source memory id')
      }

      const combinedFiles = new Set<string>(target.backingFiles)
      let maxImportance = input.importance ?? target.importance

      for (const sid of uniqueSources) {
        const src = this.getMemory(sid)
        if (!src) throw new Error(`Source memory #${sid} not found`)
        this.assertMutationScope(src, input.projectId, input.allowGlobalMutation === true)
        if (src.category !== target.category) {
          throw new Error(`Cross-category merge refused: #${sid} (${src.category}) != #${target.id} (${target.category})`)
        }
        for (const f of src.backingFiles) combinedFiles.add(f)
        maxImportance = Math.max(maxImportance, src.importance)
        this.storage.db
          .prepare("UPDATE memories SET status = 'superseded', superseded_by_id = ?, updated_at = ? WHERE id = ?")
          .run(target.id, now, sid)
        this.syncMemoryFts(sid, src.projectId, src.category, '', 'superseded')
      }

      const nextHash = computeContentHash(mergedText)
      const nextTokens = tokenizeForSearch(mergedText)
      const nextShareable = containsSecretPattern(mergedText) ? 0 : (target.shareable ? 1 : 0)

      this.storage.db
        .prepare(
          `UPDATE memories
           SET content = ?, content_hash = ?, search_tokens = ?, importance = ?,
               backing_files_json = ?, shareable = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          mergedText,
          nextHash,
          nextTokens,
          Math.max(1, Math.min(100, Math.round(maxImportance))),
          JSON.stringify(Array.from(combinedFiles)),
          nextShareable,
          now,
          target.id,
        )
      this.syncMemoryFts(target.id, target.projectId, target.category, nextTokens, target.status)
      this.appendMutationLog(
        target.projectId,
        target.id,
        'merge',
        `Merged [${uniqueSources.map(s => `#${s}`).join(', ')}] into #${target.id}: ${mergedText.slice(0, 100)}`,
        now,
      )
      this.bumpProjectEpoch(target.projectId, now)
      return this.getMemory(target.id)!
    })

    this.scheduleEmbedding('memory', merged.id, merged.content, merged.contentHash)
    return merged
  }

  /** Internal column-only update used by Dreamer tasks (mapping, verification, classification). */
  updateMemoryMetadata(
    id: number,
    patch: {
      backingFiles?: readonly string[]
      mappingOrigin?: MappingOrigin
      verificationState?: VerificationState
      lastVerifiedAt?: number
      importance?: number
      shareable?: boolean
    },
  ): MemoryRecord | null {
    return this.storage.transaction(() => {
      const existing = this.getMemory(id)
      if (!existing) return null
      const sets: string[] = []
      const params: (string | number | null)[] = []

      if (patch.backingFiles !== undefined) {
        sets.push('backing_files_json = ?')
        params.push(JSON.stringify(patch.backingFiles))
      }
      if (patch.mappingOrigin !== undefined) {
        sets.push('mapping_origin = ?')
        params.push(patch.mappingOrigin)
      }
      if (patch.verificationState !== undefined) {
        sets.push('verification_state = ?')
        params.push(patch.verificationState)
      }
      if (patch.lastVerifiedAt !== undefined) {
        sets.push('last_verified_at = ?')
        params.push(patch.lastVerifiedAt)
      }
      if (patch.importance !== undefined) {
        sets.push('importance = ?')
        params.push(Math.max(1, Math.min(100, Math.round(patch.importance))))
      }
      if (patch.shareable !== undefined) {
        const safeShareable = patch.shareable && !containsSecretPattern(existing.content)
        sets.push('shareable = ?')
        params.push(safeShareable ? 1 : 0)
      }
      if (sets.length === 0) return existing
      params.push(id)
      this.storage.db.prepare(`UPDATE memories SET ${sets.join(', ')} WHERE id = ?`).run(...params)
      return this.getMemory(id)
    })
  }

  // ── Unified Search ──────────────────────────────────────────────────────────

  async search(req: UnifiedSearchRequest, signal?: AbortSignal): Promise<UnifiedSearchResponse> {
    const cfg = this.getConfig()
    const injected = req.sessionId
      ? new Set(this.getSessionState(req.sessionId)?.injectedMemoryIds ?? [])
      : new Set<number>()
    return this.searchEngine.search(req, cfg, injected, signal)
  }

  // ── Episodes, Notes, Highlights & User Observations ─────────────────────────

  recordEpisode(input: {
    sessionId: string
    projectId: string
    startSeq: number
    endSeq: number
    episodeType?: string
    importance?: number
    title: string
    summary: string
    keyDecisions?: readonly string[]
  }): SessionEpisodeRecord {
    const now = Date.now()
    const title = input.title.trim()
    const summary = input.summary.trim()
    const decisions = input.keyDecisions ?? []
    const tokens = tokenizeForSearch(`${title}\n${summary}\n${decisions.join('\n')}`)

    const episode = this.storage.transaction(() => {
      const res = this.storage.db
        .prepare(
          `INSERT INTO session_episodes
             (session_id, project_id, start_seq, end_seq, episode_type, importance, title, summary, key_decisions_json, search_tokens, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.sessionId,
          input.projectId,
          input.startSeq,
          input.endSeq,
          input.episodeType ?? 'work',
          Math.max(1, Math.min(100, Math.round(input.importance ?? 55))),
          title,
          summary,
          JSON.stringify(decisions),
          tokens,
          now,
        )
      const id = Number(res.lastInsertRowid)
      this.storage.db
        .prepare('INSERT INTO episode_fts (rowid, search_tokens, project_id) VALUES (?, ?, ?)')
        .run(id, tokens, input.projectId)

      return {
        id,
        sessionId: input.sessionId,
        projectId: input.projectId,
        startSeq: input.startSeq,
        endSeq: input.endSeq,
        episodeType: input.episodeType ?? 'work',
        importance: Math.max(1, Math.min(100, Math.round(input.importance ?? 55))),
        title,
        summary,
        keyDecisions: [...decisions],
        createdAt: now,
      }
    })

    this.scheduleEmbedding('episode', episode.id, `${episode.title}\n${episode.summary}`, computeContentHash(episode.summary))
    return episode
  }

  listEpisodes(projectId: string, limit = 40): SessionEpisodeRecord[] {
    const rows = this.storage.db
      .prepare('SELECT * FROM session_episodes WHERE project_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(projectId, Math.max(1, Math.min(200, limit))) as unknown as EpisodeRow[]
    return rows.map(mapEpisodeRow)
  }

  addNote(input: {
    projectId: string
    sessionId?: string | null
    title: string
    content: string
    conditionExpr?: string | null
  }): NoteRecord {
    const title = input.title.trim()
    const content = input.content.trim()
    if (!title || !content) throw new Error('Note title and content are required')
    const now = Date.now()
    const tokens = tokenizeForSearch(`${title}\n${content}`)

    const note = this.storage.transaction(() => {
      const res = this.storage.db
        .prepare(
          `INSERT INTO notes (project_id, session_id, title, content, condition_expr, status, search_tokens, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        )
        .run(
          input.projectId,
          input.sessionId ?? null,
          title,
          content,
          input.conditionExpr ?? null,
          tokens,
          now,
          now,
        )
      const id = Number(res.lastInsertRowid)
      this.storage.db
        .prepare('INSERT INTO note_fts (rowid, search_tokens, project_id) VALUES (?, ?, ?)')
        .run(id, tokens, input.projectId)
      return this.getNote(id)!
    })

    this.scheduleEmbedding('note', note.id, `${note.title}\n${note.content}`, computeContentHash(note.content))
    return note
  }

  getNote(id: number): NoteRecord | null {
    const row = this.storage.db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow | undefined
    return row ? mapNoteRow(row) : null
  }

  listNotes(projectId: string, includeDismissed = false): NoteRecord[] {
    const sql = includeDismissed
      ? 'SELECT * FROM notes WHERE project_id = ? ORDER BY updated_at DESC LIMIT 100'
      : "SELECT * FROM notes WHERE project_id = ? AND status != 'dismissed' ORDER BY updated_at DESC LIMIT 100"
    const rows = this.storage.db.prepare(sql).all(projectId) as unknown as NoteRow[]
    return rows.map(mapNoteRow)
  }

  dismissNote(id: number, projectId: string): NoteRecord {
    const now = Date.now()
    return this.storage.transaction(() => {
      const note = this.getNote(id)
      if (!note) throw new Error(`Note #${id} not found`)
      if (note.projectId !== projectId) throw new Error(`Note #${id} does not belong to current project`)
      this.storage.db
        .prepare("UPDATE notes SET status = 'dismissed', updated_at = ? WHERE id = ?")
        .run(now, id)
      this.storage.db.prepare('DELETE FROM note_fts WHERE rowid = ?').run(id)
      return this.getNote(id)!
    })
  }

  recordSessionHighlight(
    sessionId: string,
    projectId: string,
    seq: number,
    role: 'user' | 'assistant',
    content: string,
  ): void {
    const trimmed = content.trim()
    if (trimmed.length < 8) return
    const clipped = trimmed.slice(0, 2000)
    const tokens = tokenizeForSearch(clipped)
    if (tokens.length === 0) return
    const now = Date.now()

    this.storage.transaction(() => {
      const res = this.storage.db
        .prepare(
          `INSERT OR IGNORE INTO session_highlights (session_id, project_id, seq, role, content, search_tokens, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(sessionId, projectId, seq, role, clipped, tokens, now)
      if (Number(res.changes) > 0) {
        const id = Number(res.lastInsertRowid)
        this.storage.db
          .prepare('INSERT INTO session_highlights_fts (rowid, search_tokens, project_id) VALUES (?, ?, ?)')
          .run(id, tokens, projectId)
      }
    })
  }

  recordUserObservation(observation: string, sessionId: string): UserObservationRecord {
    const text = observation.trim()
    const key = computeContentHash(normalizeForHash(text)).slice(0, 24)
    const now = Date.now()

    return this.storage.transaction(() => {
      const existing = this.storage.db
        .prepare('SELECT * FROM user_observations WHERE normalized_key = ?')
        .get(key) as UserObservationRow | undefined
      if (existing) {
        const sessions = safeParseStringArray(existing.evidence_sessions_json)
        if (!sessions.includes(sessionId)) {
          sessions.push(sessionId)
        }
        this.storage.db
          .prepare(
            `UPDATE user_observations
             SET evidence_sessions_json = ?, seen_count = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(JSON.stringify(sessions), sessions.length, now, existing.id)
        const updated = this.storage.db
          .prepare('SELECT * FROM user_observations WHERE id = ?')
          .get(existing.id) as unknown as UserObservationRow
        return mapObservationRow(updated)
      }

      const res = this.storage.db
        .prepare(
          `INSERT INTO user_observations (normalized_key, observation, evidence_sessions_json, seen_count, promoted_memory_id, created_at, updated_at)
           VALUES (?, ?, ?, 1, NULL, ?, ?)`,
        )
        .run(key, text, JSON.stringify([sessionId]), now, now)
      const inserted = this.storage.db
        .prepare('SELECT * FROM user_observations WHERE id = ?')
        .get(Number(res.lastInsertRowid)) as unknown as UserObservationRow
      return mapObservationRow(inserted)
    })
  }

  listPendingUserObservations(): UserObservationRecord[] {
    const rows = this.storage.db
      .prepare('SELECT * FROM user_observations WHERE promoted_memory_id IS NULL ORDER BY seen_count DESC, updated_at DESC')
      .all() as unknown as UserObservationRow[]
    return rows.map(mapObservationRow)
  }

  // ── Session Telemetry State ─────────────────────────────────────────────────

  getSessionState(sessionId: string): SessionTelemetryState | null {
    const row = this.storage.db
      .prepare('SELECT * FROM session_memory_state WHERE session_id = ?')
      .get(sessionId) as SessionStateRow | undefined
    return row ? mapSessionStateRow(row) : null
  }

  ensureSessionState(sessionId: string, projectId: string, isSubagent: boolean): SessionTelemetryState {
    const now = Date.now()
    return this.storage.transaction(() => {
      this.storage.db
        .prepare(
          `INSERT OR IGNORE INTO session_memory_state
             (session_id, project_id, is_subagent, updated_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(sessionId, projectId, isSubagent ? 1 : 0, now)
      return this.getSessionState(sessionId)!
    })
  }

  updateSessionState(
    sessionId: string,
    projectId: string,
    isSubagent: boolean,
    patch: {
      baselineInjectedAt?: number
      baselineMaxMemoryId?: number
      baselineMaxMutationId?: number
      baselineProfileVersion?: number
      injectedMemoryIds?: readonly number[]
      lastCompactionSeq?: number
      lastExtractedSeq?: number
      pendingSyncRequested?: boolean
      incTotalSteps?: number
      incDeferSteps?: number
      incReanchorCount?: number
      incAutoSearchHits?: number
    },
  ): SessionTelemetryState {
    const now = Date.now()
    return this.storage.transaction(() => {
      const current = this.ensureSessionState(sessionId, projectId, isSubagent)
      const nextBaselineAt = patch.baselineInjectedAt ?? current.baselineInjectedAt
      const nextMaxMem = patch.baselineMaxMemoryId ?? current.baselineMaxMemoryId
      const nextMaxMut = patch.baselineMaxMutationId ?? current.baselineMaxMutationId
      const nextProfVer = patch.baselineProfileVersion ?? current.baselineProfileVersion
      const nextInjected = patch.injectedMemoryIds ?? current.injectedMemoryIds
      const nextCompSeq = patch.lastCompactionSeq ?? current.lastCompactionSeq
      const nextExtSeq = patch.lastExtractedSeq ?? current.lastExtractedSeq
      const nextPendingSync = patch.pendingSyncRequested ?? current.pendingSyncRequested

      this.storage.db
        .prepare(
          `UPDATE session_memory_state
           SET project_id = ?,
               baseline_injected_at = ?,
               baseline_max_memory_id = ?,
               baseline_max_mutation_id = ?,
               baseline_profile_version = ?,
               injected_memory_ids_json = ?,
               last_compaction_seq = ?,
               last_extracted_seq = ?,
               pending_sync_requested = ?,
               total_steps = total_steps + ?,
               defer_steps = defer_steps + ?,
               reanchor_count = reanchor_count + ?,
               auto_search_hits = auto_search_hits + ?,
               updated_at = ?
           WHERE session_id = ?`,
        )
        .run(
          projectId,
          nextBaselineAt,
          nextMaxMem,
          nextMaxMut,
          nextProfVer,
          JSON.stringify(nextInjected),
          nextCompSeq,
          nextExtSeq,
          nextPendingSync ? 1 : 0,
          patch.incTotalSteps ?? 0,
          patch.incDeferSteps ?? 0,
          patch.incReanchorCount ?? 0,
          patch.incAutoSearchHits ?? 0,
          now,
          sessionId,
        )
      return this.getSessionState(sessionId)!
    })
  }

  requestManualSync(sessionId: string, projectId: string): void {
    this.updateSessionState(sessionId, projectId, false, { pendingSyncRequested: true })
  }

  // ── Background Trigger Proxies ──────────────────────────────────────────────

  async triggerExtract(sessionId: string, signal?: AbortSignal): Promise<ExtractRunResult> {
    if (!this.extractHandler) {
      return {
        status: 'skipped',
        reason: 'Background extractor is not initialized in this runtime',
        factsPromoted: 0,
        factsDeduplicated: 0,
        observationsRecorded: 0,
      }
    }
    return this.extractHandler(sessionId, signal)
  }

  async triggerDream(
    projectId: string,
    taskName?: DreamTaskName,
    signal?: AbortSignal,
  ): Promise<DreamRunRecord[]> {
    if (!this.dreamHandler) return []
    return this.dreamHandler(projectId, taskName, signal)
  }

  // ── Overview, Dreamer Status, Export & Doctor ───────────────────────────────

  getDreamTaskStatuses(projectId: string): DreamTaskScheduleState[] {
    const cfg = this.getConfig()
    const schedRows = this.storage.db
      .prepare('SELECT * FROM dream_task_schedule WHERE project_id IN (?, ?)')
      .all(projectId, GLOBAL_PROJECT_ID) as unknown as DreamScheduleRow[]
    const byKey = new Map(schedRows.map(r => [`${r.project_id}:${r.task_name}`, r]))

    return DREAM_TASK_NAMES.map(taskName => {
      const targetProj = taskName === 'review-user-memories' ? GLOBAL_PROJECT_ID : projectId
      const row = byKey.get(`${targetProj}:${taskName}`)
      const intervalMinutes = getDreamTaskIntervalMinutes(cfg, taskName)
      const enabled = cfg.dreamer.enabled
        && intervalMinutes > 0
        && (taskName !== 'review-user-memories' || cfg.dreamer.userMemoriesEnabled)

      return {
        projectId: targetProj,
        taskName,
        enabled,
        intervalMinutes,
        backlogCount: this.computeTaskBacklog(targetProj, taskName, cfg),
        lastRunAt: row?.last_run_at ?? null,
        nextDueAt: row?.next_due_at ?? null,
        consecutiveFailures: row?.consecutive_failures ?? 0,
        lastStatus: (row?.last_status as DreamTaskScheduleState['lastStatus']) ?? 'never',
        lastError: row?.last_error ?? null,
      }
    })
  }

  computeTaskBacklog(projectId: string, taskName: DreamTaskName, cfg: ResolvedConfig = this.getConfig()): number {
    switch (taskName) {
      case 'map-memories': {
        const r = this.storage.db
          .prepare(
            "SELECT COUNT(*) AS cnt FROM memories WHERE project_id = ? AND status = 'active' AND mapping_origin = 'unmapped'",
          )
          .get(projectId) as { cnt: number }
        return Number(r?.cnt ?? 0)
      }
      case 'verify': {
        const r = this.storage.db
          .prepare(
            "SELECT COUNT(*) AS cnt FROM memories WHERE project_id = ? AND status = 'active' AND mapping_origin = 'dreamer'",
          )
          .get(projectId) as { cnt: number }
        return Number(r?.cnt ?? 0)
      }
      case 'curate': {
        const now = Date.now()
        const r = this.storage.db
          .prepare(
            `SELECT COUNT(*) AS cnt FROM memories
             WHERE project_id = ? AND status = 'active' AND (expires_at IS NOT NULL AND expires_at <= ? OR id > 0)`,
          )
          .get(projectId, now) as { cnt: number }
        return Number(r?.cnt ?? 0) >= 6 ? Number(r.cnt) : 0
      }
      case 'classify-memories': {
        const r = this.storage.db
          .prepare("SELECT COUNT(*) AS cnt FROM memories WHERE project_id = ? AND status = 'active'")
          .get(projectId) as { cnt: number }
        return Number(r?.cnt ?? 0) >= 5 ? Number(r.cnt) : 0
      }
      case 'retrospective': {
        const cutoff = Date.now() - cfg.dreamer.recencyDays * 86_400_000
        const r = this.storage.db
          .prepare(
            "SELECT COUNT(*) AS cnt FROM session_highlights WHERE project_id = ? AND role = 'user' AND created_at >= ?",
          )
          .get(projectId, cutoff) as { cnt: number }
        return Number(r?.cnt ?? 0)
      }
      case 'review-user-memories': {
        const r = this.storage.db
          .prepare('SELECT COUNT(*) AS cnt FROM user_observations WHERE promoted_memory_id IS NULL AND seen_count >= ?')
          .get(cfg.dreamer.userPromoteThreshold) as { cnt: number }
        return Number(r?.cnt ?? 0)
      }
    }
  }

  listRecentDreamRuns(projectId: string, limit = 20): DreamRunRecord[] {
    const rows = this.storage.db
      .prepare(
        `SELECT * FROM dream_runs
         WHERE project_id IN (?, ?)
         ORDER BY started_at DESC
         LIMIT ?`,
      )
      .all(projectId, GLOBAL_PROJECT_ID, Math.max(1, Math.min(100, limit))) as unknown as DreamRunRow[]
    return rows.map(mapDreamRunRow)
  }

  getOverview(projectId: string, sessionId?: string): MagicMemoryOverview {
    const cfg = this.getConfig()
    const countsByCategory: Record<MemoryCategory, number> = {
      PROJECT_RULES: 0,
      ARCHITECTURE: 0,
      CONSTRAINTS: 0,
      CONFIG_VALUES: 0,
      NAMING: 0,
      USER_PROFILE: 0,
    }

    const activeRows = this.storage.db
      .prepare(
        `SELECT category, COUNT(*) AS cnt FROM memories
         WHERE project_id = ? AND status = 'active'
         GROUP BY category`,
      )
      .all(projectId) as { category: string; cnt: number }[]

    let activeMemoryCount = 0
    for (const r of activeRows) {
      if (r.category in countsByCategory) {
        countsByCategory[r.category as MemoryCategory] = Number(r.cnt)
        activeMemoryCount += Number(r.cnt)
      }
    }

    const globalCountRow = this.storage.db
      .prepare("SELECT COUNT(*) AS cnt FROM memories WHERE project_id = ? AND status = 'active'")
      .get(GLOBAL_PROJECT_ID) as { cnt: number }
    const globalProfileCount = Number(globalCountRow?.cnt ?? 0)
    countsByCategory.USER_PROFILE = globalProfileCount

    const archivedRow = this.storage.db
      .prepare("SELECT COUNT(*) AS cnt FROM memories WHERE project_id = ? AND status != 'active'")
      .get(projectId) as { cnt: number }
    const episodeRow = this.storage.db
      .prepare('SELECT COUNT(*) AS cnt FROM session_episodes WHERE project_id = ?')
      .get(projectId) as { cnt: number }
    const noteRow = this.storage.db
      .prepare("SELECT COUNT(*) AS cnt FROM notes WHERE project_id = ? AND status != 'dismissed'")
      .get(projectId) as { cnt: number }
    const obsRow = this.storage.db
      .prepare('SELECT COUNT(*) AS cnt FROM user_observations WHERE promoted_memory_id IS NULL')
      .get() as { cnt: number }

    return {
      project: this.getProject(projectId),
      countsByCategory,
      activeMemoryCount,
      archivedMemoryCount: Number(archivedRow?.cnt ?? 0),
      globalProfileCount,
      episodeCount: Number(episodeRow?.cnt ?? 0),
      activeNoteCount: Number(noteRow?.cnt ?? 0),
      pendingObservationCount: Number(obsRow?.cnt ?? 0),
      embeddingProvider: cfg.embedding.provider,
      embeddedMemoryCount: this.embeddings.countEmbeddedMemories(projectId),
      dbPath: this.storage.path,
      dbSizeBytes: this.storage.getFileSizeBytes(),
      schemaVersion: this.storage.schemaVersion,
      session: sessionId ? this.getSessionState(sessionId) : null,
      dreamerEnabled: cfg.dreamer.enabled,
      dreamerTasks: this.getDreamTaskStatuses(projectId),
      recentDreamRuns: this.listRecentDreamRuns(projectId, 15),
    }
  }

  exportSnapshot(projectId: string, format: 'json' | 'markdown' = 'markdown'): string {
    const project = this.getProject(projectId)
    const memories = this.listMemories({ projectId, scope: 'all', status: 'active', limit: 500 })
    const episodes = this.listEpisodes(projectId, 50)
    const notes = this.listNotes(projectId, false)

    if (format === 'json') {
      return JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          schemaVersion: this.storage.schemaVersion,
          project,
          memories,
          episodes,
          notes,
        },
        null,
        2,
      )
    }

    const lines: string[] = [
      `# Magic Memory Export — ${project?.displayName ?? projectId}`,
      '',
      `- Project ID: \`${projectId}\``,
      `- Exported At: ${new Date().toISOString()}`,
      `- Active Memories: ${memories.length} | Episodes: ${episodes.length} | Notes: ${notes.length}`,
      '',
    ]

    for (const cat of MEMORY_CATEGORIES) {
      const group = memories.filter(m => m.category === cat)
      if (group.length === 0) continue
      lines.push(`## ${cat}`, '')
      for (const m of group) {
        const pin = m.pinned ? ' [PINNED]' : ''
        lines.push(`- **#${m.id}** (imp=${m.importance}, ${m.verificationState}${pin}): ${m.content}`)
      }
      lines.push('')
    }

    if (episodes.length > 0) {
      lines.push('## Recent Session Episodes', '')
      for (const ep of episodes) {
        lines.push(`- **${ep.title}** (session \`${ep.sessionId.slice(0, 8)}\`, imp=${ep.importance}): ${ep.summary}`)
      }
      lines.push('')
    }

    if (notes.length > 0) {
      lines.push('## Active Notes', '')
      for (const n of notes) {
        lines.push(`- **#${n.id} ${n.title}**: ${n.content}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  runDoctor(): DoctorCheckResult {
    const warnings: string[] = []
    const { active, cleaned } = this.leases.cleanupStaleLeases()

    const activeMemCount = Number(
      (this.storage.db.prepare("SELECT COUNT(*) AS cnt FROM memories WHERE status = 'active'").get() as { cnt: number })
        ?.cnt ?? 0,
    )
    const ftsCount = Number(
      (this.storage.db.prepare('SELECT COUNT(*) AS cnt FROM memory_fts').get() as { cnt: number })?.cnt ?? 0,
    )

    let ftsConsistent = activeMemCount === ftsCount
    if (!ftsConsistent) {
      // Self-heal FTS5 table atomically
      this.rebuildMemoryFts()
      warnings.push(`Rebuilt memory_fts index (was ${ftsCount} rows, expected ${activeMemCount}).`)
      ftsConsistent = true
    }

    const cfg = this.getConfig()
    if (cfg.embedding.provider === 'openai-compatible' && !this.embeddings.isConfigured(cfg.embedding)) {
      warnings.push('Embedding provider is set to openai-compatible but endpoint or model is empty.')
    }

    return {
      ok: warnings.length === 0,
      schemaVersion: this.storage.getCurrentSchemaVersion(),
      journalMode: this.storage.getJournalMode(),
      dbPath: this.storage.path,
      dbSizeBytes: this.storage.getFileSizeBytes(),
      activeLeases: active,
      staleLeasesCleaned: cleaned,
      ftsConsistent,
      warnings,
    }
  }

  rebuildMemoryFts(): void {
    this.storage.transaction(() => {
      this.storage.db.prepare('DELETE FROM memory_fts').run()
      const rows = this.storage.db
        .prepare("SELECT id, project_id, category, content FROM memories WHERE status = 'active'")
        .all() as { id: number; project_id: string; category: string; content: string }[]
      const ins = this.storage.db.prepare(
        'INSERT INTO memory_fts (rowid, search_tokens, category, project_id) VALUES (?, ?, ?, ?)',
      )
      const upd = this.storage.db.prepare('UPDATE memories SET search_tokens = ? WHERE id = ?')
      for (const row of rows) {
        const tokens = tokenizeForSearch(row.content)
        upd.run(tokens, row.id)
        ins.run(row.id, tokens, row.category, row.project_id)
      }
    })
  }

  async flushPendingEmbeddings(): Promise<void> {
    if (this.pendingEmbedTasks.size === 0) return
    await Promise.allSettled(Array.from(this.pendingEmbedTasks))
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  private assertMutationScope(memory: MemoryRecord, callerProjectId: string, allowGlobal: boolean): void {
    if (memory.scope === 'global') {
      if (!allowGlobal) {
        throw new Error('Global user profile memories cannot be mutated without explicit global scope permission')
      }
      return
    }
    if (memory.projectId !== callerProjectId) {
      throw new Error(
        `Cannot mutate memory #${memory.id} owned by another project (${memory.projectId} != ${callerProjectId})`,
      )
    }
  }

  private syncMemoryFts(
    id: number,
    projectId: string,
    category: string,
    searchTokens: string,
    status: MemoryStatus,
  ): void {
    this.storage.db.prepare('DELETE FROM memory_fts WHERE rowid = ?').run(id)
    if (status === 'active') {
      this.storage.db
        .prepare('INSERT INTO memory_fts (rowid, search_tokens, category, project_id) VALUES (?, ?, ?, ?)')
        .run(id, searchTokens, category, projectId)
    }
  }

  private appendMutationLog(
    projectId: string,
    memoryId: number,
    op: MemoryMutationOp,
    summary: string,
    now: number,
  ): void {
    this.storage.db
      .prepare(
        'INSERT INTO memory_mutation_log (project_id, memory_id, op, summary, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(projectId, memoryId, op, summary, now)
  }

  private bumpProjectEpoch(projectId: string, now: number): void {
    this.storage.db
      .prepare('UPDATE projects SET memory_epoch = memory_epoch + 1, last_active_at = ? WHERE project_id = ?')
      .run(now, projectId)
  }

  private scheduleEmbedding(
    kind: 'memory' | 'episode' | 'note',
    id: number,
    text: string,
    contentHash: string,
  ): void {
    const cfg = this.getConfig()
    if (!this.embeddings.isConfigured(cfg.embedding)) return

    const task = (async () => {
      try {
        const vectors = await this.embeddings.embedTexts([text], cfg.embedding, this.lifecycleAbort.signal)
        const vec = vectors?.[0]
        if (vec && !this.storage.isClosed()) {
          this.embeddings.saveEmbeddingIfHashMatches(kind, id, contentHash, cfg.embedding, vec)
        }
      } catch {
        // Best-effort background embedding
      }
    })()

    this.pendingEmbedTasks.add(task)
    void task.finally(() => this.pendingEmbedTasks.delete(task))
  }
}

function compareBaselineOrder(a: MemoryRecord, b: MemoryRecord): number {
  const catDiff = (CATEGORY_PRIORITY[a.category] ?? 99) - (CATEGORY_PRIORITY[b.category] ?? 99)
  if (catDiff !== 0) return catDiff
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  if (a.importance !== b.importance) return b.importance - a.importance
  return a.id - b.id
}

function safeParseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function safeParseNumberArray(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is number => typeof x === 'number') : []
  } catch {
    return []
  }
}

interface ProjectRow {
  project_id: string
  display_name: string
  canonical_root: string
  memory_epoch: number
  last_active_at: number
  created_at: number
}

interface MemoryRow {
  id: number
  project_id: string
  category: string
  content: string
  content_hash: string
  importance: number
  scope: string
  status: string
  source_kind: string
  source_session_id: string | null
  backing_files_json: string
  mapping_origin: string
  verification_state: string
  last_verified_at: number | null
  retrieval_count: number
  pinned: number
  shareable: number
  expires_at: number | null
  superseded_by_id: number | null
  created_at: number
  updated_at: number
}

interface MutationRow {
  id: number
  project_id: string
  memory_id: number
  op: string
  summary: string
  created_at: number
}

interface EpisodeRow {
  id: number
  session_id: string
  project_id: string
  start_seq: number
  end_seq: number
  episode_type: string
  importance: number
  title: string
  summary: string
  key_decisions_json: string
  created_at: number
}

interface NoteRow {
  id: number
  project_id: string
  session_id: string | null
  title: string
  content: string
  condition_expr: string | null
  status: string
  created_at: number
  updated_at: number
}

interface UserObservationRow {
  id: number
  normalized_key: string
  observation: string
  evidence_sessions_json: string
  seen_count: number
  promoted_memory_id: number | null
  created_at: number
  updated_at: number
}

interface SessionStateRow {
  session_id: string
  project_id: string
  is_subagent: number
  baseline_injected_at: number | null
  baseline_max_memory_id: number
  baseline_max_mutation_id: number
  baseline_profile_version: number
  injected_memory_ids_json: string
  last_compaction_seq: number
  last_extracted_seq: number
  pending_sync_requested: number
  total_steps: number
  defer_steps: number
  reanchor_count: number
  auto_search_hits: number
  updated_at: number
}

interface DreamScheduleRow {
  project_id: string
  task_name: string
  last_run_at: number | null
  next_due_at: number | null
  consecutive_failures: number
  last_status: string
  last_error: string | null
}

interface DreamRunRow {
  id: number
  project_id: string
  task_name: string
  status: string
  trigger: string
  summary: string
  items_processed: number
  mutations_applied: number
  model_used: string | null
  failure_class: string | null
  error_message: string | null
  duration_ms: number
  started_at: number
  finished_at: number
}

function mapProjectRow(row: ProjectRow): ProjectRecord {
  return {
    projectId: row.project_id,
    displayName: row.display_name,
    canonicalRoot: row.canonical_root,
    memoryEpoch: row.memory_epoch,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
  }
}

function mapMemoryRow(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    category: row.category as MemoryCategory,
    content: row.content,
    contentHash: row.content_hash,
    importance: row.importance,
    scope: row.scope as MemoryScope,
    status: row.status as MemoryStatus,
    sourceKind: row.source_kind as MemorySourceKind,
    sourceSessionId: row.source_session_id,
    backingFiles: safeParseStringArray(row.backing_files_json),
    mappingOrigin: row.mapping_origin as MappingOrigin,
    verificationState: row.verification_state as VerificationState,
    lastVerifiedAt: row.last_verified_at,
    retrievalCount: row.retrieval_count,
    pinned: row.pinned === 1,
    shareable: row.shareable === 1,
    expiresAt: row.expires_at,
    supersededById: row.superseded_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMutationRow(row: MutationRow): MemoryMutationRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    memoryId: row.memory_id,
    op: row.op as MemoryMutationOp,
    summary: row.summary,
    createdAt: row.created_at,
  }
}

function mapEpisodeRow(row: EpisodeRow): SessionEpisodeRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    projectId: row.project_id,
    startSeq: row.start_seq,
    endSeq: row.end_seq,
    episodeType: row.episode_type,
    importance: row.importance,
    title: row.title,
    summary: row.summary,
    keyDecisions: safeParseStringArray(row.key_decisions_json),
    createdAt: row.created_at,
  }
}

function mapNoteRow(row: NoteRow): NoteRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id,
    title: row.title,
    content: row.content,
    conditionExpr: row.condition_expr,
    status: row.status as NoteRecord['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapObservationRow(row: UserObservationRow): UserObservationRecord {
  return {
    id: row.id,
    normalizedKey: row.normalized_key,
    observation: row.observation,
    evidenceSessions: safeParseStringArray(row.evidence_sessions_json),
    seenCount: row.seen_count,
    promotedMemoryId: row.promoted_memory_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSessionStateRow(row: SessionStateRow): SessionTelemetryState {
  return {
    sessionId: row.session_id,
    projectId: row.project_id,
    isSubagent: row.is_subagent === 1,
    baselineInjectedAt: row.baseline_injected_at,
    baselineMaxMemoryId: row.baseline_max_memory_id,
    baselineMaxMutationId: row.baseline_max_mutation_id,
    baselineProfileVersion: row.baseline_profile_version,
    injectedMemoryIds: safeParseNumberArray(row.injected_memory_ids_json),
    lastCompactionSeq: row.last_compaction_seq,
    lastExtractedSeq: row.last_extracted_seq,
    pendingSyncRequested: row.pending_sync_requested === 1,
    totalSteps: row.total_steps,
    deferSteps: row.defer_steps,
    reanchorCount: row.reanchor_count,
    autoSearchHits: row.auto_search_hits,
    updatedAt: row.updated_at,
  }
}

function mapDreamRunRow(row: DreamRunRow): DreamRunRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    taskName: row.task_name as DreamTaskName,
    status: row.status as DreamRunRecord['status'],
    trigger: row.trigger as DreamRunRecord['trigger'],
    summary: row.summary,
    itemsProcessed: row.items_processed,
    mutationsApplied: row.mutations_applied,
    modelUsed: row.model_used,
    failureClass: row.failure_class as DreamRunRecord['failureClass'],
    errorMessage: row.error_message,
    durationMs: row.duration_ms,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}
