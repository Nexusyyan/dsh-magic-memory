/**
 * Unified hybrid search across project memories, workspace shared memories,
 * global user profile, extracted session episodes, notes, and session highlights.
 *
 * Offline default: CJK-aware SQLite FTS5 BM25 + character n-gram overlap + recency/importance.
 * Optional enhancement: OpenAI-compatible vector cosine similarity fused with FTS5.
 */

import type { ResolvedConfig } from '../config.js'
import {
  GLOBAL_PROJECT_ID,
  type MemoryCategory,
  type MemoryScope,
  type ProjectMemoryCategory,
  type SearchSource,
  type UnifiedSearchHit,
  type UnifiedSearchRequest,
  type UnifiedSearchResponse,
  type VerificationState,
} from '../shared/types.js'
import type { MemoryDatabase } from '../storage/database.js'
import { cosineSimilarity, type EmbeddingService } from './embedding.js'
import { buildSafeFtsQuery, queryLexicalOverlap } from './tokenizer.js'

const ALL_SOURCES: readonly SearchSource[] = ['memory', 'episode', 'note', 'session']

export function parseDateBound(raw: string | undefined, endOfDay: boolean): number | null {
  if (!raw || raw.trim().length === 0) return null
  const trimmed = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'
    const ms = Date.parse(trimmed + suffix)
    return Number.isFinite(ms) ? ms : null
  }
  const ms = Date.parse(trimmed)
  return Number.isFinite(ms) ? ms : null
}

function normalizeBm25(rawRank: number): number {
  // SQLite FTS5 bm25() yields negative scores where more negative = stronger match
  const magnitude = rawRank < 0 ? -rawRank : 0
  return magnitude / (magnitude + 2.5)
}

function computeBoost(importance: number, updatedAt: number, now: number): number {
  const impNorm = Math.max(0, Math.min(1, importance / 100))
  const ageDays = Math.max(0, (now - updatedAt) / 86_400_000)
  const recency = 1 / (1 + ageDays / 45)
  return 0.65 * impNorm + 0.35 * recency
}

interface WorkspaceShareInfo {
  readonly projectId: string
  readonly displayName: string
  readonly categories: ReadonlySet<ProjectMemoryCategory>
}

export class UnifiedSearchEngine {
  constructor(
    private readonly storage: MemoryDatabase,
    private readonly embeddings: EmbeddingService,
  ) {}

  async search(
    req: UnifiedSearchRequest,
    config: ResolvedConfig,
    injectedMemoryIds: ReadonlySet<number> = new Set(),
    signal?: AbortSignal,
  ): Promise<UnifiedSearchResponse> {
    const now = Date.now()
    const sources = new Set<SearchSource>(req.sources && req.sources.length > 0 ? req.sources : ALL_SOURCES)
    const categoryFilter = req.categories && req.categories.length > 0 ? new Set<MemoryCategory>(req.categories) : null
    const fromMs = parseDateBound(req.from, false)
    const toMs = parseDateBound(req.to, true)
    const limit = Math.max(1, Math.min(50, req.limit ?? 10))
    const ftsExpr = buildSafeFtsQuery(req.query)

    // Optional query vector for hybrid semantic recall
    let queryVector: Float32Array | null = null
    if (req.query.trim().length > 0 && this.embeddings.isConfigured(config.embedding)) {
      const vecs = await this.embeddings.embedTexts([req.query], config.embedding, signal)
      queryVector = vecs?.[0] ?? null
    }
    const usedVectorSearch = queryVector !== null

    const candidates: UnifiedSearchHit[] = []
    let suppressedCount = 0

    if (sources.has('memory')) {
      const memRes = this.searchMemories(
        req,
        ftsExpr,
        queryVector,
        config,
        categoryFilter,
        fromMs,
        toMs,
        injectedMemoryIds,
        now,
      )
      candidates.push(...memRes.hits)
      suppressedCount += memRes.suppressed
    }

    if (sources.has('episode')) {
      candidates.push(...this.searchEpisodes(req, ftsExpr, queryVector, config, fromMs, toMs, now))
    }

    if (sources.has('note')) {
      candidates.push(...this.searchNotes(req, ftsExpr, queryVector, config, fromMs, toMs, now))
    }

    if (sources.has('session')) {
      candidates.push(...this.searchSessionHighlights(req, ftsExpr, fromMs, toMs, now))
    }

    candidates.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt || b.id - a.id)
    const topHits = candidates.slice(0, limit)

    if (req.recordRetrieval === true) {
      const hitMemoryIds = topHits.filter(h => h.source === 'memory').map(h => h.id)
      if (hitMemoryIds.length > 0) {
        this.storage.transaction(() => {
          const stmt = this.storage.db.prepare(
            'UPDATE memories SET retrieval_count = retrieval_count + 1 WHERE id = ?',
          )
          for (const id of hitMemoryIds) {
            stmt.run(id)
          }
        })
      }
    }

    return {
      hits: topHits,
      suppressedCount,
      usedVectorSearch,
      totalCandidates: candidates.length,
    }
  }

  private getWorkspaceSiblings(projectId: string): Map<string, WorkspaceShareInfo> {
    const map = new Map<string, WorkspaceShareInfo>()
    const rows = this.storage.db
      .prepare(
        `SELECT wm2.project_id, p.display_name, w.share_categories_json
         FROM workspace_members wm1
         JOIN workspaces w ON w.id = wm1.workspace_id
         JOIN workspace_members wm2 ON wm2.workspace_id = w.id
         JOIN projects p ON p.project_id = wm2.project_id
         WHERE wm1.project_id = ? AND wm2.project_id != ?`,
      )
      .all(projectId, projectId) as {
        project_id: string
        display_name: string
        share_categories_json: string
      }[]

    for (const row of rows) {
      let cats: ProjectMemoryCategory[] = ['CONSTRAINTS']
      try {
        const parsed = JSON.parse(row.share_categories_json) as unknown
        if (Array.isArray(parsed)) {
          cats = parsed.filter((x): x is ProjectMemoryCategory => typeof x === 'string')
        }
      } catch {
        // Use default share categories
      }
      map.set(row.project_id, {
        projectId: row.project_id,
        displayName: row.display_name,
        categories: new Set(cats),
      })
    }
    return map
  }

  private searchMemories(
    req: UnifiedSearchRequest,
    ftsExpr: string | null,
    queryVector: Float32Array | null,
    config: ResolvedConfig,
    categoryFilter: ReadonlySet<MemoryCategory> | null,
    fromMs: number | null,
    toMs: number | null,
    injectedMemoryIds: ReadonlySet<number>,
    now: number,
  ): { hits: UnifiedSearchHit[]; suppressed: number } {
    const siblings = this.getWorkspaceSiblings(req.projectId)
    const allowedProjects = new Set<string>([req.projectId, GLOBAL_PROJECT_ID, ...siblings.keys()])
    const bm25ById = new Map<number, number>()

    if (ftsExpr !== null) {
      const ftsRows = this.storage.db
        .prepare(
          `SELECT f.rowid AS id, bm25(memory_fts) AS rank
           FROM memory_fts f
           WHERE memory_fts MATCH ?
           ORDER BY rank ASC
           LIMIT 120`,
        )
        .all(ftsExpr) as { id: number; rank: number }[]
      for (const row of ftsRows) {
        bm25ById.set(row.id, normalizeBm25(row.rank))
      }
    }

    const vectorMap = queryVector ? this.embeddings.loadEmbeddingsForKind('memory', config.embedding) : null
    const vecScoreById = new Map<number, number>()
    if (queryVector && vectorMap) {
      for (const [id, vec] of vectorMap.entries()) {
        const sim = cosineSimilarity(queryVector, vec)
        if (sim >= 0.2) vecScoreById.set(id, sim)
      }
    }

    // Pull full active memory candidates matching allowed projects (and optionally filter by fts/vector hits when query non-empty)
    const candidateIds = new Set<number>([...bm25ById.keys(), ...vecScoreById.keys()])
    let rows: MemoryRowRaw[]

    if (req.query.trim().length === 0) {
      rows = this.storage.db
        .prepare(
          `SELECT id, project_id, category, content, importance, scope, verification_state, shareable, expires_at, created_at, updated_at
           FROM memories
           WHERE status = 'active' AND (expires_at IS NULL OR expires_at > ?)
           ORDER BY pinned DESC, importance DESC, updated_at DESC
           LIMIT 200`,
        )
        .all(now) as unknown as MemoryRowRaw[]
    } else if (candidateIds.size === 0) {
      // Fallback lexical scan on small active pool (catches single-char / unusual punctuation queries)
      rows = this.storage.db
        .prepare(
          `SELECT id, project_id, category, content, importance, scope, verification_state, shareable, expires_at, created_at, updated_at
           FROM memories
           WHERE status = 'active' AND (expires_at IS NULL OR expires_at > ?)
           ORDER BY importance DESC, updated_at DESC
           LIMIT 150`,
        )
        .all(now) as unknown as MemoryRowRaw[]
    } else {
      const ids = Array.from(candidateIds)
      const placeholders = ids.map(() => '?').join(', ')
      rows = this.storage.db
        .prepare(
          `SELECT id, project_id, category, content, importance, scope, verification_state, shareable, expires_at, created_at, updated_at
           FROM memories
           WHERE status = 'active' AND (expires_at IS NULL OR expires_at > ?) AND id IN (${placeholders})`,
        )
        .all(now, ...ids) as unknown as MemoryRowRaw[]
    }

    const hits: UnifiedSearchHit[] = []
    let suppressed = 0

    for (const row of rows) {
      if (!allowedProjects.has(row.project_id)) continue
      const sibling = siblings.get(row.project_id)
      if (sibling) {
        if (row.shareable !== 1) continue
        if (!sibling.categories.has(row.category as ProjectMemoryCategory)) continue
      }
      if (categoryFilter && !categoryFilter.has(row.category as MemoryCategory)) continue
      if (fromMs !== null && row.updated_at < fromMs) continue
      if (toMs !== null && row.updated_at > toMs) continue

      if (req.includeVisible !== true && injectedMemoryIds.has(row.id)) {
        suppressed += 1
        continue
      }

      const bm25Score = bm25ById.get(row.id) ?? 0
      const lexicalScore = req.query.trim().length > 0 ? queryLexicalOverlap(req.query, row.content) : 0.5
      const vectorScore = vecScoreById.has(row.id) ? vecScoreById.get(row.id)! : null
      const boost = computeBoost(row.importance, row.updated_at, now)

      if (req.query.trim().length > 0 && bm25Score === 0 && lexicalScore < 0.15 && (vectorScore ?? 0) < 0.25) {
        continue
      }

      const combined = vectorScore !== null
        ? 0.42 * bm25Score + 0.40 * vectorScore + 0.08 * lexicalScore + 0.10 * boost
        : 0.60 * bm25Score + 0.25 * lexicalScore + 0.15 * boost

      // Slight preference for own project over sibling workspace / global ties
      const projectBonus = row.project_id === req.projectId ? 0.03 : 0

      hits.push({
        source: 'memory',
        id: row.id,
        score: Math.min(1, combined + projectBonus),
        bm25Score,
        lexicalScore,
        vectorScore,
        title: `[${row.category}] #${row.id}`,
        content: row.content,
        category: row.category as MemoryCategory,
        scope: row.scope as MemoryScope,
        projectId: row.project_id,
        workspaceLabel: sibling?.displayName,
        verificationState: row.verification_state as VerificationState,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
    }

    return { hits, suppressed }
  }

  private searchEpisodes(
    req: UnifiedSearchRequest,
    ftsExpr: string | null,
    queryVector: Float32Array | null,
    config: ResolvedConfig,
    fromMs: number | null,
    toMs: number | null,
    now: number,
  ): UnifiedSearchHit[] {
    const bm25ById = new Map<number, number>()
    if (ftsExpr !== null) {
      const ftsRows = this.storage.db
        .prepare(
          `SELECT rowid AS id, bm25(episode_fts) AS rank
           FROM episode_fts
           WHERE episode_fts MATCH ? AND project_id = ?
           ORDER BY rank ASC
           LIMIT 60`,
        )
        .all(ftsExpr, req.projectId) as { id: number; rank: number }[]
      for (const row of ftsRows) bm25ById.set(row.id, normalizeBm25(row.rank))
    }

    const vecMap = queryVector ? this.embeddings.loadEmbeddingsForKind('episode', config.embedding) : null
    const vecScoreById = new Map<number, number>()
    if (queryVector && vecMap) {
      for (const [id, vec] of vecMap.entries()) {
        const sim = cosineSimilarity(queryVector, vec)
        if (sim >= 0.22) vecScoreById.set(id, sim)
      }
    }

    const candidateIds = new Set<number>([...bm25ById.keys(), ...vecScoreById.keys()])
    let rows: EpisodeRowRaw[]
    if (req.query.trim().length === 0 || candidateIds.size === 0) {
      rows = this.storage.db
        .prepare(
          `SELECT id, session_id, project_id, title, summary, importance, created_at
           FROM session_episodes
           WHERE project_id = ?
           ORDER BY created_at DESC
           LIMIT 50`,
        )
        .all(req.projectId) as unknown as EpisodeRowRaw[]
    } else {
      const ids = Array.from(candidateIds)
      const ph = ids.map(() => '?').join(', ')
      rows = this.storage.db
        .prepare(
          `SELECT id, session_id, project_id, title, summary, importance, created_at
           FROM session_episodes
           WHERE project_id = ? AND id IN (${ph})`,
        )
        .all(req.projectId, ...ids) as unknown as EpisodeRowRaw[]
    }

    const hits: UnifiedSearchHit[] = []
    for (const row of rows) {
      if (fromMs !== null && row.created_at < fromMs) continue
      if (toMs !== null && row.created_at > toMs) continue
      const fullText = `${row.title}\n${row.summary}`
      const bm25Score = bm25ById.get(row.id) ?? 0
      const lexicalScore = req.query.trim().length > 0 ? queryLexicalOverlap(req.query, fullText) : 0.45
      const vectorScore = vecScoreById.has(row.id) ? vecScoreById.get(row.id)! : null
      if (req.query.trim().length > 0 && bm25Score === 0 && lexicalScore < 0.15 && (vectorScore ?? 0) < 0.25) {
        continue
      }
      const boost = computeBoost(row.importance, row.created_at, now)
      const score = vectorScore !== null
        ? 0.42 * bm25Score + 0.40 * vectorScore + 0.08 * lexicalScore + 0.10 * boost
        : 0.60 * bm25Score + 0.25 * lexicalScore + 0.15 * boost

      hits.push({
        source: 'episode',
        id: row.id,
        score: Math.min(1, score),
        bm25Score,
        lexicalScore,
        vectorScore,
        title: row.title,
        content: row.summary,
        projectId: row.project_id,
        sessionId: row.session_id,
        createdAt: row.created_at,
        updatedAt: row.created_at,
      })
    }
    return hits
  }

  private searchNotes(
    req: UnifiedSearchRequest,
    ftsExpr: string | null,
    queryVector: Float32Array | null,
    config: ResolvedConfig,
    fromMs: number | null,
    toMs: number | null,
    now: number,
  ): UnifiedSearchHit[] {
    const bm25ById = new Map<number, number>()
    if (ftsExpr !== null) {
      const ftsRows = this.storage.db
        .prepare(
          `SELECT rowid AS id, bm25(note_fts) AS rank
           FROM note_fts
           WHERE note_fts MATCH ? AND project_id = ?
           ORDER BY rank ASC
           LIMIT 40`,
        )
        .all(ftsExpr, req.projectId) as { id: number; rank: number }[]
      for (const row of ftsRows) bm25ById.set(row.id, normalizeBm25(row.rank))
    }

    const vecMap = queryVector ? this.embeddings.loadEmbeddingsForKind('note', config.embedding) : null
    const vecScoreById = new Map<number, number>()
    if (queryVector && vecMap) {
      for (const [id, vec] of vecMap.entries()) {
        const sim = cosineSimilarity(queryVector, vec)
        if (sim >= 0.22) vecScoreById.set(id, sim)
      }
    }

    const rows = this.storage.db
      .prepare(
        `SELECT id, project_id, session_id, title, content, created_at, updated_at
         FROM notes
         WHERE project_id = ? AND status != 'dismissed'
         ORDER BY updated_at DESC
         LIMIT 60`,
      )
      .all(req.projectId) as unknown as NoteRowRaw[]

    const hits: UnifiedSearchHit[] = []
    for (const row of rows) {
      if (fromMs !== null && row.updated_at < fromMs) continue
      if (toMs !== null && row.updated_at > toMs) continue
      const fullText = `${row.title}\n${row.content}`
      const bm25Score = bm25ById.get(row.id) ?? 0
      const lexicalScore = req.query.trim().length > 0 ? queryLexicalOverlap(req.query, fullText) : 0.45
      const vectorScore = vecScoreById.has(row.id) ? vecScoreById.get(row.id)! : null
      if (req.query.trim().length > 0 && bm25Score === 0 && lexicalScore < 0.15 && (vectorScore ?? 0) < 0.25) {
        continue
      }
      const boost = computeBoost(60, row.updated_at, now)
      const score = vectorScore !== null
        ? 0.42 * bm25Score + 0.40 * vectorScore + 0.08 * lexicalScore + 0.10 * boost
        : 0.60 * bm25Score + 0.25 * lexicalScore + 0.15 * boost

      hits.push({
        source: 'note',
        id: row.id,
        score: Math.min(1, score),
        bm25Score,
        lexicalScore,
        vectorScore,
        title: row.title,
        content: row.content,
        projectId: row.project_id,
        sessionId: row.session_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
    }
    return hits
  }

  private searchSessionHighlights(
    req: UnifiedSearchRequest,
    ftsExpr: string | null,
    fromMs: number | null,
    toMs: number | null,
    now: number,
  ): UnifiedSearchHit[] {
    if (ftsExpr === null) return []
    const ftsRows = this.storage.db
      .prepare(
        `SELECT rowid AS id, bm25(session_highlights_fts) AS rank
         FROM session_highlights_fts
         WHERE session_highlights_fts MATCH ? AND project_id = ?
         ORDER BY rank ASC
         LIMIT 40`,
      )
      .all(ftsExpr, req.projectId) as { id: number; rank: number }[]
    if (ftsRows.length === 0) return []

    const bm25ById = new Map(ftsRows.map(r => [r.id, normalizeBm25(r.rank)]))
    const ids = ftsRows.map(r => r.id)
    const ph = ids.map(() => '?').join(', ')
    const rows = this.storage.db
      .prepare(
        `SELECT id, session_id, project_id, seq, role, content, created_at
         FROM session_highlights
         WHERE project_id = ? AND id IN (${ph})`,
      )
      .all(req.projectId, ...ids) as unknown as HighlightRowRaw[]

    const hits: UnifiedSearchHit[] = []
    for (const row of rows) {
      // Suppress highlights from the active session unless includeVisible is true
      if (req.includeVisible !== true && req.sessionId && row.session_id === req.sessionId) continue
      if (fromMs !== null && row.created_at < fromMs) continue
      if (toMs !== null && row.created_at > toMs) continue
      const bm25Score = bm25ById.get(row.id) ?? 0
      const lexicalScore = queryLexicalOverlap(req.query, row.content)
      const boost = computeBoost(45, row.created_at, now)
      const score = 0.62 * bm25Score + 0.25 * lexicalScore + 0.13 * boost

      hits.push({
        source: 'session',
        id: row.id,
        score: Math.min(1, score),
        bm25Score,
        lexicalScore,
        vectorScore: null,
        title: `Session ${row.session_id.slice(0, 8)} #${row.seq} (${row.role})`,
        content: row.content,
        projectId: row.project_id,
        sessionId: row.session_id,
        createdAt: row.created_at,
        updatedAt: row.created_at,
      })
    }
    return hits
  }
}

interface MemoryRowRaw {
  id: number
  project_id: string
  category: string
  content: string
  importance: number
  scope: string
  verification_state: string
  shareable: number
  expires_at: number | null
  created_at: number
  updated_at: number
}

interface EpisodeRowRaw {
  id: number
  session_id: string
  project_id: string
  title: string
  summary: string
  importance: number
  created_at: number
}

interface NoteRowRaw {
  id: number
  project_id: string
  session_id: string | null
  title: string
  content: string
  created_at: number
  updated_at: number
}

interface HighlightRowRaw {
  id: number
  session_id: string
  project_id: string
  seq: number
  role: string
  content: string
  created_at: number
}
