import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { buildSafeFtsQuery, computeContentHash, containsSecretPattern, tokenizeForSearch } from '../src/search/tokenizer.js'
import { MagicMemoryService } from '../src/service/memory-service.js'
import type { FetchLike } from '../src/search/embedding.js'

const contexts: Context[] = []

function createTestService(
  config: Record<string, unknown> = {},
  fetchImpl?: FetchLike,
): { ctx: Context; service: MagicMemoryService } {
  const ctx = new Context()
  contexts.push(ctx)
  const service = new MagicMemoryService(
    ctx,
    { dbPath: ':memory:', ...config },
    { fetchImpl },
  )
  return { ctx, service }
}

afterEach(() => {
  while (contexts.length > 0) {
    const ctx = contexts.pop()!
    ctx.fiber.dispose()
  }
})

describe('CJK + Code Tokenizer & FTS5 query safety', () => {
  it('tokenizes Chinese bigrams/unigrams and splits camelCase / snake_case identifiers', () => {
    const tokens = tokenizeForSearch('数据库读写分离配置 useAuthTokenRefresh max_pool_size')
    expect(tokens).toContain('数据')
    expect(tokens).toContain('据库')
    expect(tokens).toContain('读写')
    expect(tokens).toContain('分离')
    expect(tokens).toContain('useauthtokenrefresh')
    expect(tokens).toContain('auth')
    expect(tokens).toContain('token')
    expect(tokens).toContain('refresh')
    expect(tokens).toContain('pool')
  })

  it('escapes FTS5 operators & punctuation safely without throwing syntax errors', () => {
    const expr = buildSafeFtsQuery('foo:bar (baz) * -AND NOT OR "quoted" [a/b]')
    expect(expr).toBeTruthy()
    expect(expr).not.toContain(':*')
  })

  it('detects secret patterns fail-closed', () => {
    expect(containsSecretPattern('API_KEY=sk-1234567890abcdefghij')).toBe(true)
    expect(containsSecretPattern('Use pnpm test --run to execute Vitest')).toBe(false)
  })
})

describe('UnifiedSearchEngine (offline CJK FTS5, optional embeddings, workspaces, suppression)', () => {
  it('ranks Chinese, English, and code-identifier queries accurately offline', async () => {
    const { service } = createTestService()
    const pid = 'proj-cjk'
    service.upsertProject(pid, 'Demo', '/demo')

    const m1 = service.writeMemory({
      projectId: pid,
      category: 'ARCHITECTURE',
      content: '订单服务采用数据库读写分离配置，主库负责写入，只读副本承担报表查询。',
      importance: 85,
    }).memory
    service.writeMemory({
      projectId: pid,
      category: 'CONFIG_VALUES',
      content: 'Frontend Vite dev server listens on port 5173 with strictPort enabled.',
      importance: 70,
    })
    const m3 = service.writeMemory({
      projectId: pid,
      category: 'NAMING',
      content: 'Auth hook must be named useAuthTokenRefresh and export a typed refreshPromise.',
      importance: 80,
    }).memory

    const zhRes = await service.search({
      query: '读写分离',
      projectId: pid,
      sources: ['memory'],
    })
    expect(zhRes.usedVectorSearch).toBe(false)
    expect(zhRes.hits[0]?.id).toBe(m1.id)

    const codeRes = await service.search({
      query: 'AuthTokenRefresh',
      projectId: pid,
      sources: ['memory'],
    })
    expect(codeRes.hits[0]?.id).toBe(m3.id)

    // Special FTS characters never throw
    const safeRes = await service.search({
      query: 'NOT (port:5173) * "foo"',
      projectId: pid,
      sources: ['memory'],
    })
    expect(Array.isArray(safeRes.hits)).toBe(true)
  })

  it('fuses optional OpenAI-compatible embeddings and protects against stale content hashes', async () => {
    // Deterministic 3D unit vectors:
    // "canary deployment" & "progressive traffic rollout" share vector [1, 0, 0] with zero shared words!
    const mockFetch: FetchLike = async (_url, init) => {
      const body = JSON.parse(init.body) as { input: string[] }
      const data = body.input.map((text, index) => {
        const lower = text.toLowerCase()
        let vec = [0, 0, 1]
        if (lower.includes('canary') || lower.includes('progressive traffic')) {
          vec = [1, 0, 0]
        } else if (lower.includes('database')) {
          vec = [0, 1, 0]
        }
        return { index, embedding: vec }
      })
      return {
        ok: true,
        status: 200,
        json: async () => ({ data }),
        text: async () => JSON.stringify({ data }),
      }
    }

    const { service } = createTestService(
      {
        embedding: {
          provider: 'openai-compatible',
          endpoint: 'https://mock.embed/v1/embeddings',
          apiKey: 'test-key',
          model: 'mock-embed-3d',
          dimensions: 3,
          timeoutMs: 3000,
        },
      },
      mockFetch,
    )

    const pid = 'proj-vec'
    service.upsertProject(pid, 'Vec', '/vec')
    const rolloutMem = service.writeMemory({
      projectId: pid,
      category: 'PROJECT_RULES',
      content: 'Always use progressive traffic shifting starting at 5 percent for production releases.',
      importance: 90,
    }).memory
    service.writeMemory({
      projectId: pid,
      category: 'CONFIG_VALUES',
      content: 'Local database port is 5432.',
      importance: 60,
    })

    await service.flushPendingEmbeddings()

    // Query with ZERO lexical overlap ("canary") recalls rolloutMem via cosine similarity!
    const res = await service.search({
      query: 'canary',
      projectId: pid,
      sources: ['memory'],
    })
    expect(res.usedVectorSearch).toBe(true)
    expect(res.hits[0]?.id).toBe(rolloutMem.id)
    expect(res.hits[0]?.vectorScore).toBeCloseTo(1.0, 4)

    // Stale hash race guard: attempt to save an embedding for an outdated content hash
    const staleSaved = service.embeddings.saveEmbeddingIfHashMatches(
      'memory',
      rolloutMem.id,
      computeContentHash('completely different stale text'),
      service.getConfig().embedding,
      new Float32Array([0, 0, 1]),
    )
    expect(staleSaved).toBe(false)
  })

  it('enforces read-only workspace category sharing and blocks secret-containing sibling memories', async () => {
    const { service } = createTestService()
    service.upsertProject('repo-api', 'API Service', '/repo-api')
    service.upsertProject('repo-web', 'Web App', '/repo-web')
    service.upsertWorkspace('ws-prod', 'Monorepo Suite', ['repo-api', 'repo-web'], ['CONSTRAINTS'])

    const sharedConstraint = service.writeMemory({
      projectId: 'repo-api',
      category: 'CONSTRAINTS',
      content: 'All public REST endpoints require X-Tenant-Id header in UUIDv4 format.',
      importance: 90,
    }).memory

    // Not in share_categories (`PROJECT_RULES`)
    service.writeMemory({
      projectId: 'repo-api',
      category: 'PROJECT_RULES',
      content: 'Internal API service lint rule: disable default exports.',
      importance: 80,
    })

    // In `CONSTRAINTS` but contains a secret -> auto-marked shareable=0!
    const secretMem = service.writeMemory({
      projectId: 'repo-api',
      category: 'CONSTRAINTS',
      content: 'Staging token header uses sk-prodsecret1234567890abcdef for smoke tests.',
      importance: 95,
    }).memory
    expect(secretMem.shareable).toBe(false)

    const baseline = service.getBaselineMemories('repo-web')
    expect(baseline.workspaceMemories.map(m => m.id)).toEqual([sharedConstraint.id])
    expect(baseline.workspaceMemories[0]?.workspaceLabel).toBe('API Service')

    const search = await service.search({
      query: 'Tenant-Id header',
      projectId: 'repo-web',
      sources: ['memory'],
    })
    expect(search.hits.some(h => h.id === sharedConstraint.id && h.workspaceLabel === 'API Service')).toBe(true)

    const secretSearch = await service.search({
      query: 'smoke tests token',
      projectId: 'repo-web',
      sources: ['memory'],
    })
    expect(secretSearch.hits.some(h => h.id === secretMem.id)).toBe(false)
  })

  it('suppresses context-visible memories by default and increments retrieval_count only when recordRetrieval=true', async () => {
    const { service } = createTestService()
    const pid = 'proj-suppress'
    const sid = 'sess-1'
    service.upsertProject(pid, 'Suppress', '/suppress')

    const m = service.writeMemory({
      projectId: pid,
      category: 'CONSTRAINTS',
      content: 'Never run database migrations automatically during Docker container startup.',
      importance: 85,
    }).memory

    // Mark m.id as already injected in sess-1 baseline
    service.updateSessionState(sid, pid, false, { injectedMemoryIds: [m.id] })

    // Default search suppresses already-visible memory
    const suppressed = await service.search({
      query: 'Docker container migrations',
      projectId: pid,
      sessionId: sid,
      sources: ['memory'],
    })
    expect(suppressed.hits.length).toBe(0)
    expect(suppressed.suppressedCount).toBe(1)

    // includeVisible: true without recordRetrieval does NOT bump retrieval_count
    const uiBrowse = await service.search({
      query: 'Docker container migrations',
      projectId: pid,
      sessionId: sid,
      sources: ['memory'],
      includeVisible: true,
      recordRetrieval: false,
    })
    expect(uiBrowse.hits[0]?.id).toBe(m.id)
    expect(service.getMemory(m.id)?.retrievalCount).toBe(0)

    // Explicit tool search with recordRetrieval: true DOES bump retrieval_count
    const toolSearch = await service.search({
      query: 'Docker container migrations',
      projectId: pid,
      sessionId: sid,
      sources: ['memory'],
      includeVisible: true,
      recordRetrieval: true,
    })
    expect(toolSearch.hits[0]?.id).toBe(m.id)
    expect(service.getMemory(m.id)?.retrievalCount).toBe(1)
  })
})
