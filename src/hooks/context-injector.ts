/**
 * Cache-stable context injection & tail-only Auto-Search vague recall hint.
 *
 * Strictly preserves DSH's prompt KV cache:
 * - Static system-prompt guidance (zero dynamic timestamps or mutable text).
 * - Step 1 baseline snapshot (`form: 'snapshot'`) spliced before/beside first prompt.
 * - Steady-state turns touch ZERO prefix nodes (100% cache-hit Defer passes).
 * - Post-compaction re-anchoring re-injects fresh baseline right after DSH compaction
 *   (when the provider prefix has already rebuilt).
 * - Tail-only Auto-Search hint (`form: 'recall'`) appends only alongside the NEW user
 *   message when a non-visible memory/episode scores above threshold.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-compaction'
import { createUserMessage, type ContextSnapshotSection } from '@deepseek-ai/dsh-llm'
import type { Session, UserMessage } from '@deepseek-ai/dsh-session'
import { estimateTokens, extractTextContent } from '../search/tokenizer.js'
import type { MagicMemoryService } from '../service/memory-service.js'
import {
  PROJECT_MEMORY_CATEGORIES,
  type MemoryMutationRecord,
  type MemoryRecord,
  type NoteRecord,
} from '../shared/types.js'

declare module '@deepseek-ai/dsh-llm/message' {
  interface MessageSourceMap {
    'magic-memory': {
      readonly kind: 'magic-memory'
      readonly slot: 'baseline' | 'delta' | 'auto-search'
      readonly projectId: string
      readonly form: 'snapshot' | 'recall'
      readonly sections?: readonly ContextSnapshotSection[]
    }
  }
}

export const STATIC_MEMORY_SYSTEM_PROMPT = [
  '## Cross-Session Magic Memory',
  'You have durable cross-session memory backed by `ctx_memory`, `ctx_search`, and `ctx_note`:',
  '- Baseline project memories and user preferences are injected automatically at session start (and re-anchored after compaction).',
  '- When you discover a durable project rule, architectural decision, hard constraint, exact config value, or naming convention — or when the user asks you to remember something — call `ctx_memory` (`action: "write"`).',
  '- When historical context, past decisions, or prior session episodes may help, call `ctx_search` (especially when a `<memory-recall-hint>` appears).',
  '- Use `ctx_note` for temporary working notes or reminders that should stay separate from permanent project rules.',
  '- Never store secrets, API keys, passwords, or transient debugging noise in `ctx_memory`.',
].join('\n')

function renderBudgetedMemories(
  memories: readonly MemoryRecord[],
  budgetTokens: number,
  includeCategoryHeader: boolean,
): { text: string; includedIds: number[] } {
  if (memories.length === 0 || budgetTokens <= 0) {
    return { text: '', includedIds: [] }
  }

  const includedIds: number[] = []
  const sections: string[] = []
  let usedTokens = 0

  if (!includeCategoryHeader) {
    const lines: string[] = []
    for (const m of memories) {
      const line = `- [#${m.id}] ${m.content}`
      const cost = estimateTokens(line)
      if (usedTokens + cost > budgetTokens && lines.length > 0) break
      lines.push(line)
      includedIds.push(m.id)
      usedTokens += cost
    }
    return { text: lines.join('\n'), includedIds }
  }

  for (const cat of PROJECT_MEMORY_CATEGORIES) {
    const group = memories.filter(m => m.category === cat)
    if (group.length === 0) continue
    const header = `### ${cat}`
    const headerCost = estimateTokens(header)
    const groupLines: string[] = []

    for (const m of group) {
      const prefix = m.workspaceLabel ? `[${m.workspaceLabel} #${m.id}]` : `[#${m.id}]`
      const line = `- ${prefix} ${m.content}`
      const cost = estimateTokens(line)
      if (usedTokens + headerCost + cost > budgetTokens && includedIds.length > 0) break
      groupLines.push(line)
      includedIds.push(m.id)
      usedTokens += cost
    }

    if (groupLines.length > 0) {
      usedTokens += headerCost
      sections.push(`${header}\n${groupLines.join('\n')}`)
    }
  }

  return { text: sections.join('\n\n'), includedIds }
}

function renderActiveNotes(notes: readonly NoteRecord[], budgetTokens: number): string {
  if (notes.length === 0 || budgetTokens <= 0) return ''
  const lines: string[] = []
  let used = 0
  for (const note of notes.slice(0, 10)) {
    const line = `- [Note #${note.id}] ${note.title}: ${note.content.slice(0, 240)}`
    const cost = estimateTokens(line)
    if (used + cost > budgetTokens && lines.length > 0) break
    lines.push(line)
    used += cost
  }
  return lines.join('\n')
}

export function buildBaselineMessage(params: {
  readonly projectId: string
  readonly displayName: string
  readonly userProfile: readonly MemoryRecord[]
  readonly projectMemories: readonly MemoryRecord[]
  readonly workspaceMemories: readonly MemoryRecord[]
  readonly activeNotes: readonly NoteRecord[]
  readonly userProfileBudgetTokens: number
  readonly baselineBudgetTokens: number
}): { message: UserMessage; includedIds: number[] } | null {
  const sections: ContextSnapshotSection[] = []
  const includedIds: number[] = []

  const profileRendered = renderBudgetedMemories(
    params.userProfile,
    params.userProfileBudgetTokens,
    false,
  )
  if (profileRendered.text.length > 0) {
    sections.push({
      name: 'user-profile',
      text: `<user-profile>\n${profileRendered.text}\n</user-profile>`,
    })
    includedIds.push(...profileRendered.includedIds)
  }

  const combinedProject = [...params.projectMemories, ...params.workspaceMemories]
  const projRendered = renderBudgetedMemories(
    combinedProject,
    params.baselineBudgetTokens,
    true,
  )
  if (projRendered.text.length > 0) {
    sections.push({
      name: 'project-memory',
      text: `<project-memory project="${params.displayName}">\n${projRendered.text}\n</project-memory>`,
    })
    includedIds.push(...projRendered.includedIds)
  }

  const notesText = renderActiveNotes(params.activeNotes, 400)
  if (notesText.length > 0) {
    sections.push({
      name: 'active-notes',
      text: `<active-notes>\n${notesText}\n</active-notes>`,
    })
  }

  if (sections.length === 0) return null

  const fullText = [
    '<magic-memory-baseline>',
    ...sections.map(s => s.text),
    '</magic-memory-baseline>',
  ].join('\n\n')

  const message = createUserMessage({
    content: [{ type: 'text', text: fullText }],
    source: {
      kind: 'magic-memory',
      slot: 'baseline',
      projectId: params.projectId,
      form: 'snapshot',
      sections,
    } as UserMessage['source'],
  })

  return { message, includedIds }
}

export function buildDeltaMessage(params: {
  readonly projectId: string
  readonly newMemories: readonly MemoryRecord[]
  readonly mutations: readonly MemoryMutationRecord[]
  readonly budgetTokens: number
}): { message: UserMessage; includedIds: number[] } | null {
  const lines: string[] = []
  const includedIds: number[] = []
  let used = 0

  for (const m of params.newMemories) {
    const line = `- [NEW ${m.category} #${m.id}] ${m.content}`
    const cost = estimateTokens(line)
    if (used + cost > params.budgetTokens && lines.length > 0) break
    lines.push(line)
    includedIds.push(m.id)
    used += cost
  }

  for (const mut of params.mutations) {
    const line = `- [${mut.op.toUpperCase()} #${mut.memoryId}] ${mut.summary}`
    const cost = estimateTokens(line)
    if (used + cost > params.budgetTokens && lines.length > 0) break
    lines.push(line)
    used += cost
  }

  if (lines.length === 0) return null
  const text = `<memory-updates>\n${lines.join('\n')}\n</memory-updates>`
  const message = createUserMessage({
    content: [{ type: 'text', text }],
    source: {
      kind: 'magic-memory',
      slot: 'delta',
      projectId: params.projectId,
      form: 'snapshot',
      sections: [{ name: 'memory-updates', text }],
    } as UserMessage['source'],
  })

  return { message, includedIds }
}

export async function resolveAgentCwd(ctx: Context, agent: Agent, signal?: AbortSignal): Promise<string> {
  const wd = ctx.get('workingDirectory') as
    | { ensure?: (a: Agent, s?: AbortSignal) => Promise<string> }
    | undefined
  if (wd?.ensure) {
    try {
      const dir = await wd.ensure(agent, signal)
      if (dir && dir.trim().length > 0) return dir
    } catch {
      // Fallback to header cwd
    }
  }
  return agent.session.header.cwd ?? process.cwd()
}

function findLatestCompactionSummarySeq(session: Session): number {
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const events = session.snapshotEvents()
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i]?.type === 'compaction/summary') {
        return events[i]!.seq
      }
    }
  } catch {
    // Fallback if log snapshot is unavailable
  }
  return -1
}

function extractHumanUserPrompt(messages: readonly UserMessage[]): string {
  const texts: string[] = []
  for (const msg of messages) {
    if (msg.source.kind !== 'user') continue
    const t = extractTextContent(msg.content).trim()
    if (t.length > 0) texts.push(t)
  }
  return texts.join('\n').trim()
}

export function registerContextInjector(ctx: Context, service: MagicMemoryService): void {
  // 1. Static cache-stable system prompt guidance
  ctx.inject(['systemPrompt'], (spCtx: Context) => {
    const sp = spCtx.systemPrompt
    sp.section({
      name: 'dsh-magic-memory:guidance',
      order: 650,
      interpolate: false,
      text: STATIC_MEMORY_SYSTEM_PROMPT,
    })
  })

  // 2. Cache-friendly agent/pre-step hook (baseline on step 1, post-compaction re-anchor, tail auto-search)
  ctx.on('agent/pre-step', async ({ agent, messages, step, signal }, next): Promise<PreStepDecision> => {
    const decision = await next()
    const cfg = service.getConfig()
    if (!cfg.enabled || decision.kind === 'reject') return decision
    if (step === 1 && decision.messages.length === 0) return decision

    const isSubagent = agent.session.header.origin === 'subagent'
    if (isSubagent && cfg.includeSubagents !== 'full') {
      return decision
    }

    const cwd = await resolveAgentCwd(ctx, agent, signal)
    const project = await service.resolveAndRegisterProject(cwd)
    const sessionId = String(agent.session.id)
    const state = service.ensureSessionState(sessionId, project.projectId, isSubagent)

    const latestCompactionSeq = findLatestCompactionSummarySeq(agent.session)
    const needsFirstBaseline = cfg.injectOnStart && state.baselineInjectedAt === null
    const needsPostCompactionReanchor =
      cfg.reanchorAfterCompaction
      && state.baselineInjectedAt !== null
      && latestCompactionSeq > state.lastCompactionSeq

    let workingMessages = [...decision.messages]
    let mutated = false

    // A. Baseline or Post-Compaction Re-Anchor
    if (needsFirstBaseline || needsPostCompactionReanchor) {
      const baseline = service.getBaselineMemories(project.projectId)
      const activeNotes = service.listNotes(project.projectId, false)
      const built = buildBaselineMessage({
        projectId: project.projectId,
        displayName: project.displayName,
        userProfile: baseline.userProfile,
        projectMemories: baseline.projectMemories,
        workspaceMemories: baseline.workspaceMemories,
        activeNotes,
        userProfileBudgetTokens: cfg.userProfileBudgetTokens,
        baselineBudgetTokens: cfg.baselineBudgetTokens,
      })

      if (built) {
        // Place baseline right before the first claimed message so it anchors cleanly
        workingMessages = [built.message, ...workingMessages]
        mutated = true
        service.updateSessionState(sessionId, project.projectId, isSubagent, {
          baselineInjectedAt: Date.now(),
          baselineMaxMemoryId: baseline.maxMemoryId,
          baselineMaxMutationId: baseline.maxMutationId,
          baselineProfileVersion: baseline.profileVersion,
          injectedMemoryIds: built.includedIds,
          lastCompactionSeq: Math.max(state.lastCompactionSeq, latestCompactionSeq),
          pendingSyncRequested: false,
          incTotalSteps: 1,
          incReanchorCount: needsPostCompactionReanchor ? 1 : 0,
        })
      } else {
        service.updateSessionState(sessionId, project.projectId, isSubagent, {
          baselineInjectedAt: Date.now(),
          baselineMaxMemoryId: baseline.maxMemoryId,
          baselineMaxMutationId: baseline.maxMutationId,
          baselineProfileVersion: baseline.profileVersion,
          lastCompactionSeq: Math.max(state.lastCompactionSeq, latestCompactionSeq),
          pendingSyncRequested: false,
          incTotalSteps: 1,
          incDeferSteps: 1,
        })
      }
    } else if (state.pendingSyncRequested) {
      // B. Explicit /ctx-sync incremental delta
      const delta = service.getDeltaSinceWatermark(
        project.projectId,
        state.baselineMaxMemoryId,
        state.baselineMaxMutationId,
      )
      const built = buildDeltaMessage({
        projectId: project.projectId,
        newMemories: delta.newMemories,
        mutations: delta.mutations,
        budgetTokens: cfg.deltaBudgetTokens,
      })
      if (built) {
        workingMessages = [...workingMessages, built.message]
        mutated = true
        const mergedIds = Array.from(new Set([...state.injectedMemoryIds, ...built.includedIds]))
        service.updateSessionState(sessionId, project.projectId, isSubagent, {
          baselineMaxMemoryId: delta.maxMemoryId,
          baselineMaxMutationId: delta.maxMutationId,
          injectedMemoryIds: mergedIds,
          pendingSyncRequested: false,
          incTotalSteps: 1,
        })
      } else {
        service.updateSessionState(sessionId, project.projectId, isSubagent, {
          pendingSyncRequested: false,
          incTotalSteps: 1,
          incDeferSteps: 1,
        })
      }
    } else {
      // C. Steady-state Defer pass: ZERO prefix mutation (100% KV cache preserved)
      service.updateSessionState(sessionId, project.projectId, isSubagent, {
        incTotalSteps: 1,
        incDeferSteps: 1,
      })
    }

    // D. Tail-only Auto-Search vague recall hint on genuine human prompts (never touches prefix)
    if (cfg.autoSearch.enabled && !isSubagent) {
      const humanPrompt = extractHumanUserPrompt(messages)
      if (humanPrompt.length >= cfg.autoSearch.minPromptChars) {
        try {
          const searchRes = await service.search(
            {
              query: humanPrompt,
              projectId: project.projectId,
              sessionId,
              sources: ['memory', 'episode', 'note'],
              limit: cfg.autoSearch.maxHints,
              includeVisible: false,
              recordRetrieval: false,
            },
            signal,
          )

          const qualified = searchRes.hits.filter(h => h.score >= cfg.autoSearch.scoreThreshold)
          if (qualified.length > 0) {
            const hintLines = qualified.map(h => {
              const snippet = h.content.replace(/\s+/g, ' ').slice(0, 120)
              return `- (${h.source} #${h.id}, score=${h.score.toFixed(2)}) ${h.title}: ${snippet}`
            })
            const hintText = [
              '<memory-recall-hint>',
              'Potentially relevant historical memories/episodes found (not yet in context). Call `ctx_search` if you need full details:',
              ...hintLines,
              '</memory-recall-hint>',
            ].join('\n')

            const recallMsg = createUserMessage({
              content: [{ type: 'text', text: hintText }],
              source: {
                kind: 'magic-memory',
                slot: 'auto-search',
                projectId: project.projectId,
                form: 'recall',
              } as UserMessage['source'],
            })
            workingMessages = [...workingMessages, recallMsg]
            mutated = true
            service.updateSessionState(sessionId, project.projectId, isSubagent, {
              incAutoSearchHits: 1,
            })
          }
        } catch {
          // Auto-search must fail open and never block a user turn
        }
      }
    }

    if (!mutated) return decision
    return {
      ...decision,
      messages: workingMessages,
    }
  })
}
