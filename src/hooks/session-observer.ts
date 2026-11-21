/**
 * Session event observer that drives the closed-loop background memory pipeline:
 * 1. Indexes genuine user/assistant highlights into `session_highlights` for cross-session `ctx_search`.
 * 2. Detects native DSH `compaction/summary` events to trigger pre-loss fact rescue extraction
 *    and mark the session for Post-Compaction Re-Anchoring.
 * 3. Triggers asynchronous incremental extraction at `turn/end` once token threshold is reached.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-compaction'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import { extractTextContent } from '../search/tokenizer.js'
import type { SessionExtractor } from '../background/extractor.js'
import type { MagicMemoryService } from '../service/memory-service.js'

export function registerSessionObserver(
  ctx: Context,
  service: MagicMemoryService,
  extractor: SessionExtractor,
): void {
  const inflight = new Set<Promise<void>>()

  const scheduleAsync = (fn: () => Promise<void>): void => {
    const task = fn().catch(err => {
      ctx.logger?.warn?.('[dsh-magic-memory] background observer task failed: %o', err)
    })
    inflight.add(task)
    void task.finally(() => inflight.delete(task))
  }

  const findLiveAgent = (session: Session): Agent | undefined => {
    const agents = ctx.get('agents') as { get?: (id: Session['id']) => Agent | undefined } | undefined
    return agents?.get?.(session.id)
  }

  const resolveProjectIdForSession = async (session: Session): Promise<string> => {
    const existing = service.getSessionState(String(session.id))
    if (existing?.projectId) return existing.projectId
    const cwd = session.header.cwd ?? process.cwd()
    const resolved = await service.resolveAndRegisterProject(cwd)
    return resolved.projectId
  }

  ctx.on('session/event', (session: Session, event: SessionEvent) => {
    const cfg = service.getConfig()
    if (!cfg.enabled || service.storage.isClosed()) return
    if (session.header.origin === 'subagent') return

    const sessionId = String(session.id)

    // 1. Lightweight highlight indexing for cross-session search & retrospective
    if (event.type === 'user/message') {
      const kind = (event.data.source as { kind?: string } | undefined)?.kind
      if (kind === 'user') {
        const text = extractTextContent(event.data.content)
        if (text.trim().length >= 8) {
          const syncIdentity = service.projectResolver.resolveSync(session.header.cwd ?? process.cwd())
          const syncProj = service.getSessionState(sessionId)?.projectId ?? syncIdentity.projectId
          if (!service.getProject(syncProj)) {
            service.upsertProject(syncProj, syncIdentity.displayName, syncIdentity.canonicalRoot)
          }
          service.recordSessionHighlight(sessionId, syncProj, event.seq, 'user', text)
        }
      }
      return
    }

    if (event.type === 'assistant/message') {
      const text = extractTextContent(event.data.message.content)
      if (text.trim().length >= 16) {
        const syncProj = service.getSessionState(sessionId)?.projectId
          ?? service.projectResolver.resolveSync(session.header.cwd ?? process.cwd()).projectId
        service.recordSessionHighlight(sessionId, syncProj, event.seq, 'assistant', text)
      }
      return
    }

    // 2. Native DSH compaction observed: rescue facts from shadowed range before details fade
    if (event.type === 'compaction/summary') {
      if (!cfg.extractor.enabled || !cfg.extractor.onCompaction) return
      const range = (event.data as { shadowedRange?: { start: number; end: number } }).shadowedRange
      scheduleAsync(async () => {
        const projectId = await resolveProjectIdForSession(session)
        const agent = findLiveAgent(session)
        await extractor.extractSession({
          session,
          agent,
          projectId,
          explicitRange: range
            ? { startSeq: Math.min(range.start, range.end), endSeq: Math.max(range.start, range.end) }
            : undefined,
          force: true,
          signal: service.getLifecycleSignal(),
        })
      })
      return
    }

    // 3. Natural turn completion: check incremental token trigger asynchronously
    if (event.type === 'turn/end') {
      if (!cfg.extractor.enabled) return
      scheduleAsync(async () => {
        const projectId = await resolveProjectIdForSession(session)
        const agent = findLiveAgent(session)
        await extractor.extractSession({
          session,
          agent,
          projectId,
          force: false,
          signal: service.getLifecycleSignal(),
        })
      })
    }
  })
}
