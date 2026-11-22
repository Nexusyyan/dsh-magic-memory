/**
 * Optional OpenAI-compatible remote embedding client + Float32Array SQLite BLOB codec.
 * Zero native dependencies: uses Node.js built-in `fetch` and in-memory Float32Array cosine math.
 */

import type { EmbeddingConfig } from '../config.js'
import type { MemoryDatabase } from '../storage/database.js'

export type FetchLike = typeof fetch

export type EmbeddingTargetKind = 'memory' | 'episode' | 'note'

export interface StoredEmbeddingRow {
  readonly targetKind: EmbeddingTargetKind
  readonly targetId: number
  readonly providerModel: string
  readonly contentHash: string
  readonly dims: number
  readonly vector: Float32Array
}

export function serializeVector(vector: Float32Array): Uint8Array {
  return new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength).slice()
}

export function deserializeVector(blob: Uint8Array): Float32Array {
  // Always copy into an aligned ArrayBuffer to avoid misaligned TypedArray views
  const copy = new Uint8Array(blob.byteLength)
  copy.set(blob)
  return new Float32Array(copy.buffer, 0, Math.floor(copy.byteLength / 4))
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length === 0 || a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const va = a[i]!
    const vb = b[i]!
    dot += va * vb
    normA += va * va
    normB += vb * vb
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0 || !Number.isFinite(denom)) return 0
  return Math.max(0, Math.min(1, dot / denom))
}

export function resolveEmbeddingApiKey(config: Readonly<EmbeddingConfig>): string {
  if (config.apiKey && config.apiKey.trim().length > 0) {
    return config.apiKey.trim()
  }
  if (config.apiKeyEnv && config.apiKeyEnv.trim().length > 0) {
    return (process.env[config.apiKeyEnv.trim()] ?? '').trim()
  }
  return ''
}

export function resolveEmbeddingEndpoint(rawEndpoint: string): string {
  const trimmed = rawEndpoint.trim().replace(/\/+$/, '')
  if (trimmed.length === 0) return ''
  if (trimmed.endsWith('/embeddings')) return trimmed
  return `${trimmed}/embeddings`
}

export function providerModelKey(config: Readonly<EmbeddingConfig>): string {
  return `${config.provider}:${config.model.trim()}`
}

export class EmbeddingService {
  private readonly fetchImpl: FetchLike

  constructor(
    private readonly storage: MemoryDatabase,
    fetchImpl: FetchLike = globalThis.fetch,
  ) {
    this.fetchImpl = fetchImpl
  }

  isConfigured(config: Readonly<EmbeddingConfig>): boolean {
    if (config.provider !== 'openai-compatible') return false
    return resolveEmbeddingEndpoint(config.endpoint).length > 0 && config.model.trim().length > 0
  }

  async testConnectivity(
    config: Readonly<EmbeddingConfig>,
    signal?: AbortSignal,
  ): Promise<{ ok: boolean; latencyMs: number; dims?: number; endpoint: string; model: string; message: string }> {
    const startedAt = Date.now()
    const endpoint = resolveEmbeddingEndpoint(config.endpoint)
    const model = config.model.trim()
    if (config.provider !== 'openai-compatible') {
      return {
        ok: false,
        latencyMs: 0,
        endpoint,
        model,
        message: 'Embedding provider is currently disabled (off).',
      }
    }
    if (!endpoint) {
      return {
        ok: false,
        latencyMs: 0,
        endpoint,
        model,
        message: 'Embedding endpoint URL is required.',
      }
    }
    if (!model) {
      return {
        ok: false,
        latencyMs: 0,
        endpoint,
        model,
        message: 'Embedding model name is required.',
      }
    }

    const apiKey = resolveEmbeddingApiKey(config)
    const timeoutController = new AbortController()
    const timer = setTimeout(
      () => timeoutController.abort(new Error(`Timed out after ${config.timeoutMs}ms`)),
      config.timeoutMs,
    )
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal

    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (apiKey.length > 0) headers['authorization'] = `Bearer ${apiKey}`
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, input: ['Magic Memory embedding connectivity check'] }),
        signal: combinedSignal,
      })
      const latencyMs = Date.now() - startedAt
      if (!response.ok) {
        let detail = ''
        try {
          const text = (await response.text()).slice(0, 220).trim()
          if (text) detail = `: ${text}`
        } catch {
          // Ignore body read error
        }
        return {
          ok: false,
          latencyMs,
          endpoint,
          model,
          message: `HTTP ${response.status} ${response.statusText}${detail}`,
        }
      }
      const json = (await response.json()) as { data?: Array<{ embedding?: unknown }> }
      const first = Array.isArray(json.data) ? json.data[0] : undefined
      if (!first || !Array.isArray(first.embedding) || first.embedding.length === 0) {
        return {
          ok: false,
          latencyMs,
          endpoint,
          model,
          message: 'Response missing valid data[0].embedding array.',
        }
      }
      return {
        ok: true,
        latencyMs,
        dims: first.embedding.length,
        endpoint,
        model,
        message: `Connected (${first.embedding.length} dims in ${latencyMs}ms)`,
      }
    } catch (err: unknown) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        endpoint,
        model,
        message: err instanceof Error ? err.message : String(err),
      }
    } finally {
      clearTimeout(timer)
    }
  }

  async embedTexts(
    texts: readonly string[],
    config: Readonly<EmbeddingConfig>,
    signal?: AbortSignal,
  ): Promise<Float32Array[] | null> {
    if (!this.isConfigured(config) || texts.length === 0) return null
    const url = resolveEmbeddingEndpoint(config.endpoint)
    const apiKey = resolveEmbeddingApiKey(config)

    const timeoutController = new AbortController()
    const timer = setTimeout(() => timeoutController.abort(new Error('embedding request timed out')), config.timeoutMs)
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      }
      if (apiKey.length > 0) {
        headers['authorization'] = `Bearer ${apiKey}`
      }
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model.trim(),
          input: texts,
        }),
        signal: combinedSignal,
      })
      if (!response.ok) {
        return null
      }
      const json = (await response.json()) as {
        data?: Array<{ index?: number; embedding?: unknown }>
      }
      if (!Array.isArray(json.data) || json.data.length !== texts.length) {
        return null
      }

      const ordered = [...json.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      const vectors: Float32Array[] = []
      let expectedDims = -1
      for (const item of ordered) {
        if (!Array.isArray(item.embedding) || item.embedding.length === 0) return null
        const vec = new Float32Array(item.embedding.length)
        for (let i = 0; i < item.embedding.length; i++) {
          const val = Number(item.embedding[i])
          if (!Number.isFinite(val)) return null
          vec[i] = val
        }
        if (expectedDims === -1) expectedDims = vec.length
        else if (vec.length !== expectedDims) return null
        vectors.push(vec)
      }
      return vectors
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Persist an embedding vector only if the target record's `content_hash` still
   * matches `expectedHash`, preventing stale async responses from overwriting newer text.
   */
  saveEmbeddingIfHashMatches(
    targetKind: EmbeddingTargetKind,
    targetId: number,
    expectedHash: string,
    config: Readonly<EmbeddingConfig>,
    vector: Float32Array,
  ): boolean {
    const modelKey = providerModelKey(config)
    const blob = serializeVector(vector)
    const now = Date.now()

    return this.storage.transaction(() => {
      if (targetKind === 'memory') {
        const row = this.storage.db
          .prepare('SELECT content_hash FROM memories WHERE id = ?')
          .get(targetId) as { content_hash?: string } | undefined
        if (!row || row.content_hash !== expectedHash) {
          return false
        }
      }
      this.storage.db
        .prepare(
          `INSERT INTO memory_embeddings (target_kind, target_id, provider_model, content_hash, dims, vector_blob, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(target_kind, target_id) DO UPDATE SET
             provider_model = excluded.provider_model,
             content_hash = excluded.content_hash,
             dims = excluded.dims,
             vector_blob = excluded.vector_blob,
             updated_at = excluded.updated_at`,
        )
        .run(targetKind, targetId, modelKey, expectedHash, vector.length, blob, now)
      return true
    })
  }

  loadEmbeddingsForKind(
    targetKind: EmbeddingTargetKind,
    config: Readonly<EmbeddingConfig>,
  ): Map<number, Float32Array> {
    const result = new Map<number, Float32Array>()
    if (!this.isConfigured(config)) return result
    const modelKey = providerModelKey(config)
    const rows = this.storage.db
      .prepare('SELECT target_id, vector_blob FROM memory_embeddings WHERE target_kind = ? AND provider_model = ?')
      .all(targetKind, modelKey) as { target_id: number; vector_blob: Uint8Array }[]
    for (const row of rows) {
      if (row.vector_blob && row.vector_blob.byteLength >= 4) {
        result.set(row.target_id, deserializeVector(row.vector_blob))
      }
    }
    return result
  }

  countEmbeddedMemories(projectId?: string): number {
    if (projectId) {
      const row = this.storage.db
        .prepare(
          `SELECT COUNT(*) AS cnt
           FROM memory_embeddings e
           JOIN memories m ON m.id = e.target_id
           WHERE e.target_kind = 'memory' AND m.status = 'active' AND m.project_id = ?`,
        )
        .get(projectId) as { cnt: number }
      return Number(row?.cnt ?? 0)
    }
    const row = this.storage.db
      .prepare("SELECT COUNT(*) AS cnt FROM memory_embeddings WHERE target_kind = 'memory'")
      .get() as { cnt: number }
    return Number(row?.cnt ?? 0)
  }
}
