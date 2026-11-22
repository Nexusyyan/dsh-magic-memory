/**
 * Plugin configuration schema (Schemastery) with live `.volatile()` fields so
 * DSH's Plugins Settings page renders an editable form automatically.
 */

import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { DreamTaskName } from './shared/types.js'

export type SubagentMemoryMode = 'search-only' | 'full' | 'off'
export type EmbeddingProviderMode = 'off' | 'openai-compatible'

export interface AutoSearchConfig {
  enabled: boolean
  scoreThreshold: number
  maxHints: number
  minPromptChars: number
}

export interface EmbeddingConfig {
  provider: EmbeddingProviderMode
  endpoint: string
  model: string
  apiKey?: string
  apiKeyEnv: string
  timeoutMs: number
}

export interface ExtractorConfig {
  enabled: boolean
  triggerTokens: number
  onCompaction: boolean
  cooldownSeconds: number
  provider: string
  model: string
  maxOutputTokens: number
  autoPromote: boolean
}

export interface DreamerTaskIntervals {
  'map-memories': number
  verify: number
  curate: number
  'classify-memories': number
  retrospective: number
  'review-user-memories': number
}

export interface DreamerConfig {
  enabled: boolean
  tickIntervalMinutes: number
  separateModel?: boolean
  provider: string
  model: string
  maxOutputTokens: number
  timeoutMs: number
  recencyDays: number
  userMemoriesEnabled: boolean
  userPromoteThreshold: number
  taskIntervalsMinutes: DreamerTaskIntervals
}

export interface MagicMemoryConfig {
  dbPath: string
  enabled: Volatile<boolean> | boolean
  injectOnStart: Volatile<boolean> | boolean
  reanchorAfterCompaction: Volatile<boolean> | boolean
  includeSubagents: Volatile<SubagentMemoryMode> | SubagentMemoryMode
  baselineBudgetTokens: Volatile<number> | number
  userProfileBudgetTokens: Volatile<number> | number
  deltaBudgetTokens: Volatile<number> | number
  maxMemoryChars: Volatile<number> | number
  autoSearch: Volatile<AutoSearchConfig> | AutoSearchConfig
  embedding: Volatile<EmbeddingConfig> | EmbeddingConfig
  extractor: Volatile<ExtractorConfig> | ExtractorConfig
  dreamer: Volatile<DreamerConfig> | DreamerConfig
}

export interface ResolvedConfig {
  readonly dbPath: string
  readonly enabled: boolean
  readonly injectOnStart: boolean
  readonly reanchorAfterCompaction: boolean
  readonly includeSubagents: SubagentMemoryMode
  readonly baselineBudgetTokens: number
  readonly userProfileBudgetTokens: number
  readonly deltaBudgetTokens: number
  readonly maxMemoryChars: number
  readonly autoSearch: Readonly<AutoSearchConfig>
  readonly embedding: Readonly<EmbeddingConfig>
  readonly extractor: Readonly<ExtractorConfig>
  readonly dreamer: Readonly<DreamerConfig>
}

export const DEFAULT_AUTO_SEARCH: AutoSearchConfig = {
  enabled: true,
  scoreThreshold: 0.42,
  maxHints: 3,
  minPromptChars: 10,
}

export const DEFAULT_EMBEDDING: EmbeddingConfig = {
  provider: 'off',
  endpoint: '',
  model: 'text-embedding-3-small',
  apiKey: '',
  apiKeyEnv: 'OPENAI_API_KEY',
  timeoutMs: 15_000,
}

export const DEFAULT_EXTRACTOR: ExtractorConfig = {
  enabled: true,
  triggerTokens: 12_000,
  onCompaction: true,
  cooldownSeconds: 180,
  provider: '',
  model: '',
  maxOutputTokens: 2048,
  autoPromote: true,
}

export const DEFAULT_DREAMER_INTERVALS: DreamerTaskIntervals = {
  'map-memories': 720,
  verify: 1440,
  curate: 10080,
  'classify-memories': 1440,
  retrospective: 1440,
  'review-user-memories': 1440,
}

export const DEFAULT_DREAMER: DreamerConfig = {
  enabled: true,
  tickIntervalMinutes: 15,
  separateModel: false,
  provider: '',
  model: '',
  maxOutputTokens: 3072,
  timeoutMs: 90_000,
  recencyDays: 30,
  userMemoriesEnabled: true,
  userPromoteThreshold: 3,
  taskIntervalsMinutes: { ...DEFAULT_DREAMER_INTERVALS },
}

export const Config = z.object({
  dbPath: z
    .string()
    .default('')
    .description('Absolute path to the SQLite WAL database (defaults to $DSH_HOME/magic-memory/memory.db via bundle patch).'),
  enabled: z
    .boolean()
    .default(true)
    .volatile()
    .description('Enable or pause Magic Memory injection, extraction, and maintenance.'),
  injectOnStart: z
    .boolean()
    .default(true)
    .volatile()
    .description('Inject deterministic baseline project memories and user profile on step 1.'),
  reanchorAfterCompaction: z
    .boolean()
    .default(true)
    .volatile()
    .description('Re-anchor baseline memories once after native DSH compaction finishes.'),
  includeSubagents: z
    .union(['search-only', 'full', 'off'] as const)
    .default('search-only')
    .volatile()
    .description('Memory access level for delegated subagent sessions.'),
  baselineBudgetTokens: z
    .number()
    .step(100)
    .min(200)
    .max(32_000)
    .default(3200)
    .volatile()
    .description('Approximate token budget for the frozen baseline project-memory snapshot.'),
  userProfileBudgetTokens: z
    .number()
    .step(50)
    .min(100)
    .max(8_000)
    .default(600)
    .volatile()
    .description('Approximate token budget for cross-project user profile memories.'),
  deltaBudgetTokens: z
    .number()
    .step(50)
    .min(100)
    .max(8_000)
    .default(800)
    .volatile()
    .description('Approximate token budget for manual /ctx-sync incremental memory deltas.'),
  maxMemoryChars: z
    .number()
    .step(100)
    .min(200)
    .max(10_000)
    .default(1500)
    .volatile()
    .description('Maximum characters per individual memory entry.'),
  autoSearch: z
    .object({
      enabled: z.boolean().default(DEFAULT_AUTO_SEARCH.enabled),
      scoreThreshold: z.number().min(0.05).max(1).default(DEFAULT_AUTO_SEARCH.scoreThreshold),
      maxHints: z.number().step(1).min(1).max(10).default(DEFAULT_AUTO_SEARCH.maxHints),
      minPromptChars: z.number().step(1).min(4).max(200).default(DEFAULT_AUTO_SEARCH.minPromptChars),
    })
    .default(DEFAULT_AUTO_SEARCH)
    .volatile()
    .description('Tail-only vague recall hint attached to new user messages (zero prefix cache bust).'),
  embedding: z
    .object({
      provider: z.union(['off', 'openai-compatible'] as const).default(DEFAULT_EMBEDDING.provider),
      endpoint: z.string().default(DEFAULT_EMBEDDING.endpoint),
      model: z.string().default(DEFAULT_EMBEDDING.model),
      apiKey: z.string().role('secret').default(''),
      apiKeyEnv: z.string().default(DEFAULT_EMBEDDING.apiKeyEnv),
      timeoutMs: z.number().step(500).min(1000).max(120_000).default(DEFAULT_EMBEDDING.timeoutMs),
    })
    .default(DEFAULT_EMBEDDING)
    .volatile()
    .description('Optional OpenAI-compatible remote embedding provider for hybrid semantic reranking.'),
  extractor: z
    .object({
      enabled: z.boolean().default(DEFAULT_EXTRACTOR.enabled),
      triggerTokens: z.number().step(500).min(1000).max(200_000).default(DEFAULT_EXTRACTOR.triggerTokens),
      onCompaction: z.boolean().default(DEFAULT_EXTRACTOR.onCompaction),
      cooldownSeconds: z.number().step(10).min(0).max(3600).default(DEFAULT_EXTRACTOR.cooldownSeconds),
      provider: z.string().default(DEFAULT_EXTRACTOR.provider),
      model: z.string().default(DEFAULT_EXTRACTOR.model),
      maxOutputTokens: z.number().step(128).min(256).max(16_384).default(DEFAULT_EXTRACTOR.maxOutputTokens),
      autoPromote: z.boolean().default(DEFAULT_EXTRACTOR.autoPromote),
    })
    .default(DEFAULT_EXTRACTOR)
    .volatile()
    .description('Out-of-band background session fact & episode extractor (Historian knowledge layer).'),
  dreamer: z
    .object({
      enabled: z.boolean().default(DEFAULT_DREAMER.enabled),
      tickIntervalMinutes: z.number().step(1).min(1).max(1440).default(DEFAULT_DREAMER.tickIntervalMinutes),
      provider: z.string().default(DEFAULT_DREAMER.provider),
      model: z.string().default(DEFAULT_DREAMER.model),
      maxOutputTokens: z.number().step(128).min(512).max(16_384).default(DEFAULT_DREAMER.maxOutputTokens),
      timeoutMs: z.number().step(1000).min(5000).max(300_000).default(DEFAULT_DREAMER.timeoutMs),
      recencyDays: z.number().step(1).min(1).max(365).default(DEFAULT_DREAMER.recencyDays),
      userMemoriesEnabled: z.boolean().default(DEFAULT_DREAMER.userMemoriesEnabled),
      userPromoteThreshold: z.number().step(1).min(2).max(20).default(DEFAULT_DREAMER.userPromoteThreshold),
      taskIntervalsMinutes: z
        .object({
          'map-memories': z.number().step(10).min(0).default(DEFAULT_DREAMER_INTERVALS['map-memories']),
          verify: z.number().step(10).min(0).default(DEFAULT_DREAMER_INTERVALS.verify),
          curate: z.number().step(10).min(0).default(DEFAULT_DREAMER_INTERVALS.curate),
          'classify-memories': z.number().step(10).min(0).default(DEFAULT_DREAMER_INTERVALS['classify-memories']),
          retrospective: z.number().step(10).min(0).default(DEFAULT_DREAMER_INTERVALS.retrospective),
          'review-user-memories': z.number().step(10).min(0).default(DEFAULT_DREAMER_INTERVALS['review-user-memories']),
        })
        .default(DEFAULT_DREAMER_INTERVALS),
    })
    .default(DEFAULT_DREAMER)
    .volatile()
    .description('Scheduled background Dreamer self-maintenance loop (set a task interval to 0 to disable it).'),
})

function isVolatile<T>(value: T | Volatile<T> | undefined): value is Volatile<T> {
  return typeof value === 'object' && value !== null && typeof (value as { get?: unknown }).get === 'function'
}

/** Unwrap either a Cordis `Volatile<T>` box or a plain runtime value. */
export function unwrapVolatile<T>(value: T | Volatile<T> | undefined, fallback: T): T {
  if (value === undefined) return fallback
  const unwrapped = isVolatile(value) ? value.get() : value
  return (unwrapped === undefined ? fallback : unwrapped) as T
}

/** Snapshot all live volatile configuration fields into an immutable resolved object. */
export function readConfigSnapshot(raw: Partial<MagicMemoryConfig> = {}): ResolvedConfig {
  const autoSearch = unwrapVolatile(raw.autoSearch, DEFAULT_AUTO_SEARCH)
  const embedding = unwrapVolatile(raw.embedding, DEFAULT_EMBEDDING)
  const extractor = unwrapVolatile(raw.extractor, DEFAULT_EXTRACTOR)
  const dreamer = unwrapVolatile(raw.dreamer, DEFAULT_DREAMER)
  const intervals = dreamer.taskIntervalsMinutes ?? DEFAULT_DREAMER_INTERVALS

  return {
    dbPath: raw.dbPath ?? '',
    enabled: unwrapVolatile(raw.enabled, true),
    injectOnStart: unwrapVolatile(raw.injectOnStart, true),
    reanchorAfterCompaction: unwrapVolatile(raw.reanchorAfterCompaction, true),
    includeSubagents: unwrapVolatile(raw.includeSubagents, 'search-only'),
    baselineBudgetTokens: unwrapVolatile(raw.baselineBudgetTokens, 3200),
    userProfileBudgetTokens: unwrapVolatile(raw.userProfileBudgetTokens, 600),
    deltaBudgetTokens: unwrapVolatile(raw.deltaBudgetTokens, 800),
    maxMemoryChars: unwrapVolatile(raw.maxMemoryChars, 1500),
    autoSearch: { ...DEFAULT_AUTO_SEARCH, ...autoSearch },
    embedding: { ...DEFAULT_EMBEDDING, ...embedding },
    extractor: { ...DEFAULT_EXTRACTOR, ...extractor },
    dreamer: {
      ...DEFAULT_DREAMER,
      ...dreamer,
      taskIntervalsMinutes: {
        ...DEFAULT_DREAMER_INTERVALS,
        ...intervals,
      },
    },
  }
}

export function getDreamTaskIntervalMinutes(config: ResolvedConfig, task: DreamTaskName): number {
  return config.dreamer.taskIntervalsMinutes[task] ?? 0
}
