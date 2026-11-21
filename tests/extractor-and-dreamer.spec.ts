import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { createAssistantMessage, type StreamChunk } from '@deepseek-ai/dsh-llm'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import { afterEach, describe, expect, it } from 'vitest'
import { DreamerScheduler } from '../src/background/dreamer.js'
import { evaluateClaimSafety } from '../src/background/dreamer-tasks.js'
import { SessionExtractor, parseExtractionManifest } from '../src/background/extractor.js'
import { registerSessionObserver } from '../src/hooks/session-observer.js'
import { MagicMemoryService } from '../src/service/memory-service.js'
import type { MemoryRecord } from '../src/shared/types.js'

const contexts: Context[] = []
const tempDirs: string[] = []

function makeTempDir(prefix = 'dmm-bg-'): string {
  const d = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(d)
  return d
}

function makeMockLlm(responder: (systemPrompt: string, userPrompt: string) => string) {
  return {
    stream: async function* (req: {
      messages: { role: string; content: { type: string; text?: string }[] }[]
    }): AsyncGenerator<StreamChunk> {
      const sys = req.messages.find(m => m.role === 'system')?.content?.[0]?.text ?? ''
      const user = req.messages.find(m => m.role === 'user')?.content?.[0]?.text ?? ''
      const reply = responder(sys, user)
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: reply }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: reply } }
      yield { type: 'finish', reason: 'stop' }
    },
    listModels: () => [{ provider: 'mock', model: 'mock-aux' }],
  }
}

function createFakeSession(
  sessionId: string,
  cwd: string,
  turns: { role: 'user' | 'assistant'; text: string }[],
): Session {
  const events: SessionEvent[] = []
  let seq = 0
  for (const turn of turns) {
    seq += 1
    if (turn.role === 'user') {
      events.push({
        type: 'user/message',
        seq,
        timestamp: Date.now(),
        data: {
          content: [{ type: 'text', text: turn.text }],
          source: { kind: 'user' },
        },
      } as unknown as SessionEvent)
    } else {
      events.push({
        type: 'assistant/message',
        seq,
        timestamp: Date.now(),
        data: {
          message: createAssistantMessage({
            content: [{ type: 'text', text: turn.text }],
            source: { provider: 'mock', model: 'mock-main' },
          }),
        },
      } as unknown as SessionEvent)
    }
  }
  return {
    id: sessionId,
    header: { id: sessionId, cwd, origin: 'user', createdAt: Date.now() },
    snapshotEvents: () => [...events],
  } as unknown as Session
}

afterEach(() => {
  while (contexts.length > 0) contexts.pop()!.fiber.dispose()
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true })
})

describe('parseExtractionManifest (fail-closed XML parsing)', () => {
  it('parses well-formed <extract> manifest with episode, facts, and user_observations', () => {
    const xml = `
<extract>
  <episode type="architecture" importance="85">
    <title>Migrated auth to JWT &amp; Redis</title>
    <summary>Switched session cookies to short-lived JWTs with refresh tokens in Redis.</summary>
    <decision>Refresh TTL set to 14 days</decision>
    <decision>Access token TTL set to 15 minutes</decision>
  </episode>
  <facts>
    <fact category="ARCHITECTURE" importance="88">Authentication uses 15-minute JWTs with Redis refresh rotation.</fact>
    <fact category="CONFIG_VALUES" importance="75">JWT signing algorithm is EdDSA (Ed25519).</fact>
  </facts>
  <user_observations>
    <user_observation>User prefers explicit TypeScript return types on exported functions.</user_observation>
  </user_observations>
</extract>`
    const parsed = parseExtractionManifest(xml)
    expect(parsed).not.toBeNull()
    expect(parsed!.episode?.title).toBe('Migrated auth to JWT & Redis')
    expect(parsed!.episode?.decisions).toHaveLength(2)
    expect(parsed!.facts).toHaveLength(2)
    expect(parsed!.facts[0]?.category).toBe('ARCHITECTURE')
    expect(parsed!.userObservations).toEqual([
      'User prefers explicit TypeScript return types on exported functions.',
    ])
  })

  it('fails closed on truncated or malformed XML', () => {
    expect(parseExtractionManifest('<extract><episode><title>Truncated')).toBeNull()
    expect(parseExtractionManifest('Sure! Here are some notes without XML tags.')).toBeNull()
  })
})

describe('SessionExtractor (end-to-end fact promotion, deduplication, and compaction rescue)', () => {
  it('extracts episode, promotes facts, records observations, and advances lastExtractedSeq', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide(
      'llm' as never,
      makeMockLlm(() => `
<extract>
  <episode type="bugfix" importance="80">
    <title>Fixed SQLite busy lock retry</title>
    <summary>Added WAL mode and 5000ms busy_timeout so concurrent CLI processes do not hit SQLITE_BUSY.</summary>
    <decision>Enable WAL pragma at connection open</decision>
  </episode>
  <facts>
    <fact category="PROJECT_RULES" importance="90">Always configure SQLite with WAL mode and busy_timeout=5000.</fact>
    <fact category="CONSTRAINTS" importance="85">Zero native C++ SQLite addons allowed; rely exclusively on node:sqlite.</fact>
  </facts>
  <user_observations>
    <user_observation>User prefers running vitest with --run in CI scripts.</user_observation>
  </user_observations>
</extract>`) as never,
    )

    const service = new MagicMemoryService(ctx, {
      dbPath: ':memory:',
      extractor: { enabled: true, minTokensDelta: 10, extractOnCompaction: true },
    })
    const extractor = new SessionExtractor(ctx, service)
    const proj = service.upsertProject('proj-ext', 'Ext', '/ext')

    const session = createFakeSession('sess-ext-1', '/ext', [
      { role: 'user', text: 'We are hitting SQLITE_BUSY under parallel runs, please fix it without native modules.' },
      { role: 'assistant', text: 'I enabled WAL mode and PRAGMA busy_timeout = 5000 on node:sqlite.' },
    ])

    const res = await extractor.extractSession({
      session,
      projectId: proj.projectId,
      force: true,
    })

    expect(res.status).toBe('extracted')
    expect(res.episode?.title).toBe('Fixed SQLite busy lock retry')
    expect(res.factsPromoted).toBe(2)
    expect(res.factsDeduplicated).toBe(0)
    expect(res.observationsRecorded).toBe(1)

    // Verify DB state updated
    expect(service.listEpisodes(proj.projectId)).toHaveLength(1)
    expect(service.listMemories({ projectId: proj.projectId })).toHaveLength(2)
    expect(service.listPendingUserObservations()).toHaveLength(1)
    expect(service.getSessionState('sess-ext-1')?.lastExtractedSeq).toBe(2)

    // Running again on an explicit shadowed range (compaction rescue) deduplicates cleanly
    const res2 = await extractor.extractSession({
      session,
      projectId: proj.projectId,
      explicitRange: { startSeq: 1, endSeq: 2 },
      force: true,
    })
    expect(res2.status).toBe('extracted')
    expect(res2.factsPromoted).toBe(0)
    expect(res2.factsDeduplicated).toBe(2)
  })
})

describe('Dreamer 6-Task Self-Maintenance & Claim-Safety Guards', () => {
  it('enforces claim-safety guards directly (refuses PROJECT_RULES archive, pinned archive, and >50% shrink)', () => {
    const baseMem = (overrides: Partial<MemoryRecord>): MemoryRecord => ({
      id: 1,
      projectId: 'p1',
      category: 'ARCHITECTURE',
      content: 'This is a detailed architectural description explaining all five services and their strict boundaries.',
      contentHash: 'abc',
      importance: 70,
      scope: 'project',
      status: 'active',
      sourceKind: 'agent',
      sourceSessionId: null,
      backingFiles: [],
      mappingOrigin: 'unmapped',
      verificationState: 'unverified',
      lastVerifiedAt: null,
      retrievalCount: 0,
      pinned: false,
      shareable: true,
      expiresAt: null,
      supersededById: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    })

    // 1. Refuse auto-archive of PROJECT_RULES
    expect(evaluateClaimSafety(baseMem({ category: 'PROJECT_RULES' }), { action: 'archive' }).allowed).toBe(false)

    // 2. Refuse auto-archive of pinned memory
    expect(evaluateClaimSafety(baseMem({ pinned: true }), { action: 'archive' }).allowed).toBe(false)

    // 3. Refuse >50% shrink without consolidation flag
    expect(
      evaluateClaimSafety(baseMem({}), { action: 'update', newContent: 'Short summary.', consolidation: false }).allowed,
    ).toBe(false)

    // 4. Allow update when consolidation is explicit OR length preserved
    expect(
      evaluateClaimSafety(baseMem({}), { action: 'update', newContent: 'Short consolidated.', consolidation: true })
        .allowed,
    ).toBe(true)
    expect(
      evaluateClaimSafety(baseMem({}), {
        action: 'update',
        newContent: 'This is an updated detailed architectural description explaining all five services cleanly.',
      }).allowed,
    ).toBe(true)
  })

  it('executes all 6 Dreamer tasks safely end-to-end (including secret fail-closed & 3-session USER_PROFILE promotion)', async () => {
    const repoDir = makeTempDir('dmm-dream-repo-')
    mkdirSync(join(repoDir, 'src'), { recursive: true })
    writeFileSync(join(repoDir, 'src', 'db.ts'), 'export const DB_MODE = "WAL";\nexport const BUSY_MS = 5000;\n')
    writeFileSync(join(repoDir, 'src', 'auth.ts'), 'export const TOKEN_TTL = 900;\n')

    const ctx = new Context()
    contexts.push(ctx)

    // Mock LLM returning task-appropriate XML matching dreamer-tasks.ts contracts
    ctx.provide(
      'llm' as never,
      makeMockLlm((sys, user) => {
        if (sys.includes('<map>')) {
          const items = Array.from(user.matchAll(/<memory id="(\d+)" category="([^"]+)">/g))
          return `<map>${items
            .map(m =>
              m[2] === 'PROJECT_RULES'
                ? `<item id="${m[1]}" files="" independent="true"/>`
                : `<item id="${m[1]}" files="src/db.ts" independent="false"/>`,
            )
            .join('')}</map>`
        }
        if (sys.includes('<verify>')) {
          const ids = Array.from(user.matchAll(/<check id="(\d+)"/g)).map(m => m[1]!)
          return `<verify>${ids.map(id => `<verdict id="${id}" action="verified" consolidation="false">OK</verdict>`).join('')}</verify>`
        }
        if (sys.includes('<curate>')) {
          const ids = Array.from(user.matchAll(/<memory id="(\d+)"/g)).map(m => m[1]!)
          if (ids.length >= 2) {
            return `<curate><merge target="${ids[0]}" sources="${ids[1]}">SQLite uses WAL mode with 5000ms busy timeout and 900s JWT token TTL.</merge></curate>`
          }
          return '<curate></curate>'
        }
        if (sys.includes('<classify>')) {
          // Deliberately say shareable="true" for EVERY memory (including the one with a secret!)
          const ids = Array.from(user.matchAll(/<memory id="(\d+)"/g)).map(m => m[1]!)
          return `<classify>${ids.map(id => `<item id="${id}" importance="82" shareable="true"/>`).join('')}</classify>`
        }
        if (sys.includes('<retrospective>')) {
          return `<retrospective><learning scope="project" category="PROJECT_RULES" importance="84">Always run pnpm run typecheck before committing changes.</learning></retrospective>`
        }
        if (sys.includes('<user_profile_review>')) {
          const obsId = /<obs id="(\d+)"/.exec(user)?.[1] ?? '1'
          return `<user_profile_review><promote obs_id="${obsId}" importance="88">User prefers concise Chinese responses with clickable file links.</promote></user_profile_review>`
        }
        return ''
      }) as never,
    )

    const service = new MagicMemoryService(ctx, {
      dbPath: ':memory:',
      dreamer: {
        enabled: true,
        tickMinutes: 60,
        userMemoriesEnabled: true,
        userPromoteThreshold: 3,
      },
    })
    const dreamer = new DreamerScheduler(ctx, service)
    const proj = service.upsertProject('proj-dream', 'DreamRepo', repoDir)

    // Seed memories: 1 ARCHITECTURE (mapped & verified), 4 CONFIG_VALUES (triggers curate >= 4), 1 secret CONSTRAINTS, 1 expired NAMING
    const mArch = service.writeMemory({
      projectId: proj.projectId,
      category: 'ARCHITECTURE',
      content: 'Database opens in WAL mode with 5000ms busy timeout in src/db.ts.',
      importance: 90,
    }).memory
    const mCfg1 = service.writeMemory({
      projectId: proj.projectId,
      category: 'CONFIG_VALUES',
      content: 'SQLite uses WAL mode with 5000ms busy timeout.',
      importance: 75,
    }).memory
    const mCfg2 = service.writeMemory({
      projectId: proj.projectId,
      category: 'CONFIG_VALUES',
      content: 'JWT token TTL is configured to 900 seconds.',
      importance: 75,
    }).memory
    service.writeMemory({
      projectId: proj.projectId,
      category: 'CONFIG_VALUES',
      content: 'HTTP server listen port defaults to 3000.',
      importance: 60,
    })
    service.writeMemory({
      projectId: proj.projectId,
      category: 'CONFIG_VALUES',
      content: 'Max JSON payload size is 2MB.',
      importance: 60,
    })
    const mSecret = service.writeMemory({
      projectId: proj.projectId,
      category: 'CONSTRAINTS',
      content: 'Webhook signing uses secret token sk-live-supersecret9876543210abcdef.',
      importance: 70,
    }).memory
    const mExpired = service.writeMemory({
      projectId: proj.projectId,
      category: 'NAMING',
      content: 'Temporary migration branch prefix temp-v1.',
      importance: 40,
      expiresAt: Date.now() - 10_000,
    }).memory

    // Seed >=3 user highlights for retrospective
    service.recordSessionHighlight('s1', proj.projectId, 1, 'user', 'Remember to always run pnpm run typecheck first!')
    service.recordSessionHighlight('s2', proj.projectId, 1, 'user', 'Please do not forget pnpm run typecheck before finishing.')
    service.recordSessionHighlight('s3', proj.projectId, 1, 'user', 'Typecheck failed again, please run pnpm run typecheck every time.')

    // Seed repeated user observation across 3 distinct sessions
    service.recordUserObservation('User prefers concise Chinese responses', 'sess-a')
    service.recordUserObservation('User prefers concise Chinese responses', 'sess-b')
    service.recordUserObservation('User prefers concise Chinese responses', 'sess-c')

    const runs = await dreamer.runManual(proj.projectId)
    expect(runs).toHaveLength(6)
    expect(runs.map(r => `${r.taskName}:${r.status}`)).toEqual([
      'map-memories:success',
      'verify:success',
      'curate:success',
      'classify-memories:success',
      'retrospective:success',
      'review-user-memories:success',
    ])

    // 1. map-memories + verify verified mArch against src/db.ts
    const refreshedArch = service.getMemory(mArch.id)!
    expect(refreshedArch.backingFiles).toEqual(['src/db.ts'])
    expect(refreshedArch.verificationState).toBe('verified')

    // 2. curate merged mCfg2 into mCfg1 & archived expired mExpired
    expect(service.getMemory(mCfg2.id)?.status).toBe('superseded')
    expect(service.getMemory(mCfg2.id)?.supersededById).toBe(mCfg1.id)
    expect(service.getMemory(mExpired.id)?.status).toBe('archived')

    // 3. classify-memories MUST keep mSecret.shareable === false despite LLM claiming shareable="true"
    expect(service.getMemory(mSecret.id)?.shareable).toBe(false)

    // 4. retrospective mined the new PROJECT_RULES memory
    const allProjMems = service.listMemories({ projectId: proj.projectId, scope: 'project' })
    expect(allProjMems.some(m => m.content.includes('pnpm run typecheck'))).toBe(true)

    // 5. review-user-memories promoted the 3-session observation into global USER_PROFILE
    const globalProfile = service.listMemories({ projectId: proj.projectId, scope: 'global' })
    expect(globalProfile.some(m => m.category === 'USER_PROFILE' && m.content.includes('Chinese'))).toBe(true)
    expect(service.listPendingUserObservations()).toHaveLength(0)

    // 6. Schedule & dream_runs telemetry persisted
    expect(service.listRecentDreamRuns(proj.projectId).length).toBeGreaterThanOrEqual(6)
    const statuses = service.getDreamTaskStatuses(proj.projectId)
    expect(statuses.every(s => s.lastStatus === 'success')).toBe(true)

    dreamer.stop()
  })

  it('SessionObserver indexes human highlights, ignores magic-memory synthetic messages, and rescues facts on compaction/summary', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide(
      'llm' as never,
      makeMockLlm(() => `
<extract>
  <episode type="debugging" importance="82">
    <title>Rescued compaction decision</title>
    <summary>Preserved Redis cluster timeout constraint before compaction folded earlier turns.</summary>
  </episode>
  <facts>
    <fact category="CONSTRAINTS" importance="88">Redis cluster command timeout must stay <= 1500ms in production.</fact>
  </facts>
</extract>`) as never,
    )

    const service = new MagicMemoryService(ctx, {
      dbPath: ':memory:',
      extractor: { enabled: true, triggerTokens: 100_000, onCompaction: true, cooldownSeconds: 0 },
    })
    const extractor = new SessionExtractor(ctx, service)
    registerSessionObserver(ctx, service, extractor)

    const cwd = makeTempDir('dmm-obs-')
    const proj = await service.resolveAndRegisterProject(cwd)
    const sess = createFakeSession('sess-obs-1', cwd, [
      { role: 'user', text: 'Remember that Redis cluster command timeout must stay <= 1500ms in production.' },
      { role: 'assistant', text: 'Understood, I configured commandTimeout: 1500 in the cluster client.' },
    ])

    // 1. Emit genuine user message -> indexed
    ctx.emit('session/event' as never, sess, {
      type: 'user/message',
      seq: 1,
      timestamp: Date.now(),
      data: {
        content: [{ type: 'text', text: 'Remember that Redis cluster command timeout must stay <= 1500ms in production.' }],
        source: { kind: 'user' },
      },
    })
    // 2. Emit synthetic magic-memory message -> MUST NOT be indexed into session_highlights!
    ctx.emit('session/event' as never, sess, {
      type: 'user/message',
      seq: 2,
      timestamp: Date.now(),
      data: {
        content: [{ type: 'text', text: '<magic-memory-baseline>synthetic text should not loop</magic-memory-baseline>' }],
        source: { kind: 'magic-memory' },
      },
    })

    const searchSynth = await service.search({
      query: 'synthetic text should not loop',
      projectId: proj.projectId,
      sources: ['session'],
      includeVisible: true,
    })
    expect(searchSynth.hits).toHaveLength(0)

    const searchHuman = await service.search({
      query: 'Redis cluster command timeout',
      projectId: proj.projectId,
      sources: ['session'],
      includeVisible: true,
    })
    expect(searchHuman.hits).toHaveLength(1)

    // 3. Emit native DSH compaction/summary -> rescues facts asynchronously
    ctx.emit('session/event' as never, sess, {
      type: 'compaction/summary',
      seq: 3,
      timestamp: Date.now(),
      data: { shadowedRange: { start: 1, end: 2 } },
    })
    await new Promise(r => setTimeout(r, 40))

    const rescued = service.listMemories({ projectId: proj.projectId })
    expect(rescued.some(m => m.content.includes('1500ms'))).toBe(true)
    expect(service.listEpisodes(proj.projectId).some(e => e.title === 'Rescued compaction decision')).toBe(true)
  })
})
