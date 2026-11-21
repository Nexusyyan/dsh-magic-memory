import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { Session, SessionEvent, UserMessage } from '@deepseek-ai/dsh-session'
import { afterEach, describe, expect, it } from 'vitest'
import { STATIC_MEMORY_SYSTEM_PROMPT, registerContextInjector } from '../src/hooks/context-injector.js'
import { extractTextContent } from '../src/search/tokenizer.js'
import { MagicMemoryService } from '../src/service/memory-service.js'

const contexts: Context[] = []

interface FakeAgentHarness {
  session: Session
  agent: Agent
  events: SessionEvent[]
  pushCompactionSummary(): void
  runStep(ctx: Context, step: number, userText: string): Promise<PreStepDecision>
}

function createFakeAgent(sessionId: string, cwd: string, origin: 'user' | 'subagent' = 'user'): FakeAgentHarness {
  const events: SessionEvent[] = []

  const session = {
    id: sessionId,
    header: {
      id: sessionId,
      cwd,
      origin,
      createdAt: Date.now(),
    },
    snapshotEvents: () => [...events],
  } as unknown as Session

  const agent = {
    session,
    model: { provider: 'mock', model: 'mock-chat' },
  } as unknown as Agent

  return {
    session,
    agent,
    events,
    pushCompactionSummary() {
      const seq = events.length + 1
      events.push({
        type: 'compaction/summary',
        seq,
        timestamp: Date.now(),
        data: { summary: 'Compacted earlier turns', fromSeq: 1, toSeq: Math.max(1, seq - 1) },
      } as unknown as SessionEvent)
    },
    async runStep(ctx: Context, step: number, userText: string): Promise<PreStepDecision> {
      const userMsg = createUserMessage({
        content: [{ type: 'text', text: userText }],
        source: { kind: 'user' },
      }) as UserMessage
      const messages: UserMessage[] = [userMsg]
      const signal = new AbortController().signal
      return (
        ctx.waterfall as unknown as (
          event: string,
          payload: { agent: Agent; messages: readonly UserMessage[]; step: number; signal: AbortSignal },
          inner: () => Promise<PreStepDecision>,
        ) => Promise<PreStepDecision>
      )('agent/pre-step', { agent, messages, step, signal }, async () => ({
        kind: 'continue',
        messages,
      }))
    },
  }
}

afterEach(() => {
  while (contexts.length > 0) {
    contexts.pop()!.fiber.dispose()
  }
})

describe('Context Injector: KV-cache stability, Post-Compaction Re-Anchor, Delta Sync, Tail Auto-Search, Subagents', () => {
  it('registers byte-static system prompt guidance and preserves KV-cache prefix across steady-state turns', async () => {
    const ctx = new Context()
    contexts.push(ctx)

    // Register a lightweight systemPrompt mock matching DSH SystemPrompt.section()
    const promptSections: { name: string; text: string; interpolate?: boolean }[] = []
    ctx.provide('systemPrompt' as never, {
      section(sec: { name: string; text: string; interpolate?: boolean }) {
        promptSections.push(sec)
        return () => {}
      },
    } as never)

    const service = new MagicMemoryService(ctx, {
      dbPath: ':memory:',
      autoSearch: { enabled: true, scoreThreshold: 0.35, maxHints: 2, minPromptChars: 6 },
    })
    registerContextInjector(ctx, service)

    await Promise.resolve()
    expect(promptSections.length).toBe(1)
    expect(promptSections[0]?.text).toBe(STATIC_MEMORY_SYSTEM_PROMPT)
    expect(promptSections[0]?.interpolate).toBe(false)

    const cwd = '/tmp/dmm-injector-proj'
    const resolved = await service.resolveAndRegisterProject(cwd)
    const mRule = service.writeMemory({
      projectId: resolved.projectId,
      category: 'PROJECT_RULES',
      content: 'Always use strict TypeScript with noUncheckedIndexedAccess enabled.',
      importance: 95,
      pinned: true,
    }).memory
    service.writeMemory({
      projectId: resolved.projectId,
      category: 'USER_PROFILE',
      scope: 'global',
      content: 'User prefers concise Chinese technical explanations.',
      importance: 85,
    })

    const fake = createFakeAgent('sess-cache-1', cwd)

    // Step 1: baseline snapshot MUST be prepended before user prompt
    const dec1 = await fake.runStep(ctx, 1, 'Help me set up tsconfig for this repo.')
    expect(dec1.kind).toBe('continue')
    if (dec1.kind !== 'continue') throw new Error('expected continue')
    expect(dec1.messages.length).toBe(2)
    const baselineMsg = dec1.messages[0]!
    expect((baselineMsg.source as { kind?: string; slot?: string; form?: string }).kind).toBe('magic-memory')
    expect((baselineMsg.source as { slot?: string }).slot).toBe('baseline')
    expect((baselineMsg.source as { form?: string }).form).toBe('snapshot')
    expect(extractTextContent(baselineMsg.content)).toContain(`#${mRule.id}`)
    expect(extractTextContent(baselineMsg.content)).toContain('concise Chinese')

    // Write a NEW memory out-of-band during the session
    const mNew = service.writeMemory({
      projectId: resolved.projectId,
      category: 'CONFIG_VALUES',
      content: 'Redis sentinel cluster endpoint is redis-sentinel.internal:26379.',
      importance: 80,
    }).memory

    // Step 2: Unrelated steady-state turn MUST Defer (ZERO prefix mutation, ZERO new baseline!)
    const dec2 = await fake.runStep(ctx, 2, 'Thanks, now list the files in src.')
    expect(dec2.kind).toBe('continue')
    if (dec2.kind !== 'continue') throw new Error('expected continue')
    expect(dec2.messages.length).toBe(1) // Only the original user message!
    const stateAfterStep2 = service.getSessionState('sess-cache-1')!
    expect(stateAfterStep2.totalSteps).toBe(2)
    expect(stateAfterStep2.deferSteps).toBe(1)
    expect(stateAfterStep2.reanchorCount).toBe(0)

    // Step 3: Relevant user prompt triggers TAIL-ONLY Auto-Search recall hint for non-visible mNew
    const dec3 = await fake.runStep(ctx, 3, 'What is our Redis sentinel cluster endpoint?')
    expect(dec3.kind).toBe('continue')
    if (dec3.kind !== 'continue') throw new Error('expected continue')
    expect(dec3.messages.length).toBe(2)
    // User prompt stays FIRST; recall hint is strictly APPENDED at tail!
    expect(dec3.messages[0]!.source.kind).toBe('user')
    const recallMsg = dec3.messages[1]!
    expect((recallMsg.source as { slot?: string; form?: string }).slot).toBe('auto-search')
    expect((recallMsg.source as { form?: string }).form).toBe('recall')
    expect(extractTextContent(recallMsg.content)).toContain('redis-sentinel.internal:26379')
    // Auto-search must NOT artificially bump retrieval_count
    expect(service.getMemory(mNew.id)?.retrievalCount).toBe(0)

    // Step 4: Manual /ctx-sync appends delta snapshot containing new memory mNew
    service.requestManualSync('sess-cache-1', resolved.projectId)
    const dec4 = await fake.runStep(ctx, 4, 'Continue with next step.')
    expect(dec4.kind).toBe('continue')
    if (dec4.kind !== 'continue') throw new Error('expected continue')
    const deltaMsg = dec4.messages.find(m => (m.source as { slot?: string }).slot === 'delta')
    expect(deltaMsg).toBeDefined()
    expect(extractTextContent(deltaMsg!.content)).toContain(`#${mNew.id}`)
    expect(service.getSessionState('sess-cache-1')?.pendingSyncRequested).toBe(false)

    // Step 5: DSH emits compaction/summary -> next pre-step MUST Re-Anchor fresh baseline!
    fake.pushCompactionSummary()
    const dec5 = await fake.runStep(ctx, 5, 'Summarize where we are.')
    expect(dec5.kind).toBe('continue')
    if (dec5.kind !== 'continue') throw new Error('expected continue')
    const reanchorMsg = dec5.messages[0]!
    expect((reanchorMsg.source as { slot?: string; form?: string }).slot).toBe('baseline')
    expect((reanchorMsg.source as { form?: string }).form).toBe('snapshot')
    expect(extractTextContent(reanchorMsg.content)).toContain(`#${mNew.id}`)
    expect(service.getSessionState('sess-cache-1')?.reanchorCount).toBe(1)
  })

  it('respects subagent isolation modes (search-only & off skip baseline injection; full injects)', async () => {
    for (const mode of ['off', 'search-only', 'full'] as const) {
      const ctx = new Context()
      contexts.push(ctx)
      const service = new MagicMemoryService(ctx, {
        dbPath: ':memory:',
        includeSubagents: mode,
      })
      registerContextInjector(ctx, service)

      const cwd = `/tmp/dmm-subagent-${mode}`
      const proj = await service.resolveAndRegisterProject(cwd)
      service.writeMemory({
        projectId: proj.projectId,
        category: 'PROJECT_RULES',
        content: 'Subagent test rule.',
        importance: 90,
      })

      const sub = createFakeAgent(`sub-${mode}`, cwd, 'subagent')
      const dec = await sub.runStep(ctx, 1, 'Run subagent task.')
      expect(dec.kind).toBe('continue')
      if (dec.kind !== 'continue') throw new Error('expected continue')

      const injected = dec.messages.filter(m => (m.source as { kind?: string }).kind === 'magic-memory')
      if (mode === 'full') {
        expect(injected.length).toBe(1)
      } else {
        expect(injected.length).toBe(0)
      }
    }
  })
})
