/**
 * Auxiliary one-shot LLM caller over DSH's `ctx.llm.stream()` seam.
 * Mirrors `dsh-compaction-basic`'s pattern: non-loop request, BlockAssembler
 * collection, explicit timeout & cancellation, fail-closed error classification.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { BlockAssembler, createSystemMessage, type GenerateOptions, type RequestMessage } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'
import type { DreamFailureClass } from '../shared/types.js'

export interface AuxiliaryRoute {
  readonly provider: string
  readonly model: string
}

export interface AuxiliaryLlmResult {
  readonly ok: true
  readonly text: string
  readonly route: AuxiliaryRoute
}

export interface AuxiliaryLlmFailure {
  readonly ok: false
  readonly failureClass: DreamFailureClass
  readonly message: string
  readonly route: AuxiliaryRoute | null
}

export type AuxiliaryLlmOutcome = AuxiliaryLlmResult | AuxiliaryLlmFailure

function validRoute(provider?: string, model?: string): AuxiliaryRoute | null {
  const p = provider?.trim() ?? ''
  const m = model?.trim() ?? ''
  if (p.length === 0 || m.length === 0) return null
  return { provider: p, model: m }
}

/**
 * Resolve the model route for background extraction or Dreamer tasks.
 * Priority: explicit config override -> session's latest answered assistant ->
 * session's latest request header -> agent options -> first live agent/adapter model.
 */
export function resolveAuxiliaryRoute(
  ctx: Context,
  override: { provider?: string; model?: string },
  session?: Session,
  agent?: Agent,
): AuxiliaryRoute | null {
  const explicit = validRoute(override.provider, override.model)
  if (explicit) return explicit

  if (session) {
    // Prefer the route that most recently answered in this session
    try {
      const nodes = session.surface.nodes
      for (let i = nodes.length - 1; i >= 0; i--) {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const ev = session.eventAt(nodes[i]!)
        if (ev?.type === 'assistant/message') {
          const src = ev.data.message.source
          const r = validRoute(src.provider, src.model)
          if (r) return r
        }
      }
    } catch {
      // Ignore if session inspection is unavailable
    }

    const headerCfg = typeof session.requestHeader === 'function' ? session.requestHeader()?.config : undefined
    const fromHeader = validRoute(headerCfg?.provider, headerCfg?.model)
    if (fromHeader) return fromHeader
  }

  if (agent) {
    const fromAgentModel = agent.model?.current?.()
    const fromModelSel = validRoute(fromAgentModel?.provider, fromAgentModel?.model)
    if (fromModelSel) return fromModelSel

    const fromOptions = validRoute(agent.options?.provider, agent.options?.model)
    if (fromOptions) return fromOptions
  }

  // Fallback to any active live agent in the registry
  const agentsRegistry = ctx.get('agents') as
    | { list?: () => readonly Agent[] }
    | undefined
  if (agentsRegistry?.list) {
    for (const liveAgent of agentsRegistry.list()) {
      const fromLive = resolveAuxiliaryRoute(ctx, {}, liveAgent.session, liveAgent)
      if (fromLive) return fromLive
    }
  }

  // Final fallback: first registered adapter model from ctx.llm
  const llm = ctx.get('llm') as
    | { listModels?: () => readonly { provider?: string; id?: string; model?: string }[] }
    | undefined
  if (llm?.listModels) {
    for (const m of llm.listModels()) {
      const r = validRoute(m.provider, m.id ?? m.model)
      if (r) return r
    }
  }

  return null
}

/**
 * Execute a single tool-free auxiliary completion through `ctx.llm.stream()`.
 * Fails closed on empty completions, max-tokens truncation, timeouts, or errors.
 */
export async function runAuxiliaryCompletion(
  ctx: Context,
  params: {
    readonly route: AuxiliaryRoute | null
    readonly systemPrompt: string
    readonly userPrompt: string
    readonly maxTokens: number
    readonly timeoutMs: number
    readonly purpose: string
    readonly sessionId?: Session['id']
    readonly signal?: AbortSignal
  },
): Promise<AuxiliaryLlmOutcome> {
  if (!params.route) {
    return {
      ok: false,
      failureClass: 'no_models',
      message: 'No provider/model route available for auxiliary Magic Memory task',
      route: null,
    }
  }

  const llm = ctx.get('llm') as
    | { stream?: (opts: GenerateOptions) => AsyncIterable<unknown> }
    | undefined
  if (!llm?.stream) {
    return {
      ok: false,
      failureClass: 'no_models',
      message: 'ctx.llm service is unavailable',
      route: params.route,
    }
  }

  const timeoutController = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    timeoutController.abort(new Error(`auxiliary LLM call timed out after ${params.timeoutMs}ms`))
  }, params.timeoutMs)

  const combinedSignal = params.signal
    ? AbortSignal.any([params.signal, timeoutController.signal])
    : timeoutController.signal

  const messages: RequestMessage[] = [
    createSystemMessage(params.systemPrompt),
    { role: 'user', content: [{ type: 'text', text: params.userPrompt }] },
  ]

  const options: GenerateOptions<string> = {
    provider: params.route.provider,
    model: params.route.model,
    messages,
    maxTokens: params.maxTokens,
    purpose: params.purpose,
    ...(params.sessionId ? { sessionId: params.sessionId } : {}),
    signal: combinedSignal,
  }

  try {
    const assembler = new BlockAssembler()
    for await (const chunk of llm.stream(options as GenerateOptions) as AsyncIterable<Parameters<BlockAssembler['push']>[0]>) {
      assembler.push(chunk)
    }

    const finish = assembler.finish
    if (finish.kind === 'aborted') {
      return {
        ok: false,
        failureClass: timedOut ? 'provider_timeout' : 'aborted',
        message: timedOut ? `Timed out after ${params.timeoutMs}ms` : 'Auxiliary completion aborted',
        route: params.route,
      }
    }
    if (finish.kind === 'error') {
      return {
        ok: false,
        failureClass: 'provider_error',
        message: finish.failure?.message ?? 'Provider stream error',
        route: params.route,
      }
    }
    if (finish.kind === 'max-tokens') {
      return {
        ok: false,
        failureClass: 'parse_failed',
        message: 'Auxiliary completion truncated at maxTokens cap',
        route: params.route,
      }
    }

    const text = assembler
      .blocks()
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()

    if (text.length === 0) {
      return {
        ok: false,
        failureClass: 'empty_completion',
        message: 'Provider returned an empty completion',
        route: params.route,
      }
    }

    return { ok: true, text, route: params.route }
  } catch (err: unknown) {
    if (timedOut) {
      return {
        ok: false,
        failureClass: 'provider_timeout',
        message: `Timed out after ${params.timeoutMs}ms`,
        route: params.route,
      }
    }
    if (params.signal?.aborted) {
      return {
        ok: false,
        failureClass: 'aborted',
        message: 'Auxiliary completion cancelled by caller',
        route: params.route,
      }
    }
    return {
      ok: false,
      failureClass: 'provider_error',
      message: err instanceof Error ? err.message : String(err),
      route: params.route,
    }
  } finally {
    clearTimeout(timer)
  }
}
