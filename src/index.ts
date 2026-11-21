/**
 * Main Host-side Cordis plugin entry for `dsh-magic-memory`.
 *
 * Mounts on the Host plane so all DSH runtimes (Web, Desktop with all presets,
 * Headless CLI, ACP, SDK) share the exact same durable memory closed loop.
 * Optional services (`commands`, `connection`, `workingDirectory`, `systemPrompt`)
 * are injected conditionally so minimal profiles stay healthy without them.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Session } from '@deepseek-ai/dsh-session'
import { DreamerScheduler } from './background/dreamer.js'
import { SessionExtractor } from './background/extractor.js'
import { registerMagicMemoryCommands } from './commands/index.js'
import { Config, type MagicMemoryConfig } from './config.js'
import { registerContextInjector, resolveAgentCwd } from './hooks/context-injector.js'
import { registerSessionObserver } from './hooks/session-observer.js'
import { registerRpcBridge } from './rpc/bridge.js'
import { MagicMemoryService } from './service/memory-service.js'
import { registerMagicMemoryTools } from './tools/index.js'

export const name = 'dsh-magic-memory'
export const inject = ['tools', 'sessions'] as const
export { Config }
export type { MagicMemoryConfig }

export { MagicMemoryService } from './service/memory-service.js'
export { SessionExtractor, parseExtractionManifest } from './background/extractor.js'
export { DreamerScheduler } from './background/dreamer.js'
export { evaluateClaimSafety } from './background/dreamer-tasks.js'
export { dispatchMagicMemoryRpc, createMagicMemoryFetchHandler, MAGIC_MEMORY_API_PATH } from './rpc/bridge.js'
export * from './shared/types.js'

export function apply(ctx: Context, config: Partial<MagicMemoryConfig> = {}): void {
  const service = new MagicMemoryService(ctx, config)
  const extractor = new SessionExtractor(ctx, service)
  const dreamer = new DreamerScheduler(ctx, service)

  service.registerBackgroundHandlers({
    extract: async (sessionId, signal) => {
      const sessions = ctx.get('sessions') as
        | { get?: (id: string) => Session | undefined }
        | undefined
      const agents = ctx.get('agents') as
        | { get?: (id: string) => Agent | undefined }
        | undefined
      const agent = agents?.get?.(sessionId)
      const session = agent?.session ?? sessions?.get?.(sessionId)
      if (!session) {
        return {
          status: 'skipped',
          reason: `Session "${sessionId}" is not currently loaded in memory`,
          factsPromoted: 0,
          factsDeduplicated: 0,
          observationsRecorded: 0,
        }
      }
      const cwd = agent
        ? await resolveAgentCwd(ctx, agent, signal)
        : (session.header.cwd ?? process.cwd())
      const proj = await service.resolveAndRegisterProject(cwd)
      return extractor.extractSession({
        session,
        agent,
        projectId: proj.projectId,
        force: true,
        signal,
      })
    },
    dream: async (projectId, taskName, signal) => dreamer.runManual(projectId, taskName, signal),
  })

  // 1. Model-facing tools (`ctx_memory`, `ctx_search`, `ctx_note`)
  registerMagicMemoryTools(ctx, service)

  // 2. Cache-stable context injection + static system-prompt guidance + auto-search
  registerContextInjector(ctx, service)

  // 3. Session observer (highlights indexing, compaction rescue, turn-end extraction)
  registerSessionObserver(ctx, service, extractor)

  // 4. Optional human slash commands (`/ctx-status`, `/ctx-extract`, `/ctx-dream`, `/ctx-sync`, `/ctx-memory`)
  registerMagicMemoryCommands(ctx, service)

  // 5. Optional Host <-> Client authenticated RPC bridge for Web/Desktop React sidebar
  registerRpcBridge(ctx, service)

  // 6. Process-wide Dreamer background maintenance timer (unref'd so CLI exits cleanly)
  dreamer.start()
}
