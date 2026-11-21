/**
 * Human slash commands registered optionally via `ctx.commands`:
 * - `/ctx-status`  — project identity, memory counts, cache preservation ratio, Dreamer health
 * - `/ctx-extract` — manually extract episode & durable facts from the current session
 * - `/ctx-dream`   — manually run due or specific Dreamer maintenance task(s)
 * - `/ctx-sync`    — queue an incremental `<memory-updates>` delta for the next step
 * - `/ctx-memory`  — quick search / export / doctor diagnostics
 */

import type { Context } from '@deepseek-ai/cordis'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import { resolveAgentCwd } from '../hooks/context-injector.js'
import type { MagicMemoryService } from '../service/memory-service.js'
import { DREAM_TASK_NAMES, MEMORY_CATEGORIES, type DreamTaskName } from '../shared/types.js'

const VALID_DREAM_TASKS = new Set<string>(DREAM_TASK_NAMES)

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

async function resolveCommandScope(
  ctx: Context,
  service: MagicMemoryService,
  inv: CommandInvocation,
): Promise<{ projectId: string; displayName: string; sessionId: string }> {
  const cwd = await resolveAgentCwd(ctx, inv.agent, inv.signal)
  const resolved = await service.resolveAndRegisterProject(cwd)
  return {
    projectId: resolved.projectId,
    displayName: resolved.displayName,
    sessionId: String(inv.agent.session.id),
  }
}

export function registerMagicMemoryCommands(ctx: Context, service: MagicMemoryService): void {
  ctx.inject(['commands'], (cmdCtx: Context) => {
    const commands = cmdCtx.commands
    const disposers: (() => void)[] = []
    const reg = (def: Parameters<typeof commands.register>[0]): void => {
      const dispose = commands.register(def)
      if (typeof dispose === 'function') disposers.push(dispose)
    }
    cmdCtx.effect(() => () => {
      for (const d of disposers.splice(0)) d()
    })

    reg({
      name: 'ctx-status',
      description: 'Show Magic Memory status, cache-stability metrics, and Dreamer health.',
      async handler(inv): Promise<CommandResult> {
        const { projectId, displayName, sessionId } = await resolveCommandScope(ctx, service, inv)
        const ov = service.getOverview(projectId, sessionId)
        const deferRate = ov.session && ov.session.totalSteps > 0
          ? `${Math.round((ov.session.deferSteps / ov.session.totalSteps) * 100)}% (${ov.session.deferSteps}/${ov.session.totalSteps})`
          : 'n/a'

        const catSummary = MEMORY_CATEGORIES
          .map(c => `${c}: ${ov.countsByCategory[c]}`)
          .join(' | ')

        const lines = [
          `### Magic Memory — ${displayName} (\`${projectId}\`)`,
          `- **Memories**: ${ov.activeMemoryCount} active project, ${ov.globalProfileCount} global profile, ${ov.archivedMemoryCount} archived`,
          `- **Breakdown**: ${catSummary}`,
          `- **Episodes / Notes / Pending Observations**: ${ov.episodeCount} / ${ov.activeNoteCount} / ${ov.pendingObservationCount}`,
          `- **Search Engine**: CJK FTS5 + BM25 | Embedding: \`${ov.embeddingProvider}\` (${ov.embeddedMemoryCount} embedded)`,
          `- **Storage**: \`${ov.dbPath}\` (${formatBytes(ov.dbSizeBytes)}, schema v${ov.schemaVersion})`,
          `- **Session Cache Stability**: Defer ratio ${deferRate} | Re-anchors: ${ov.session?.reanchorCount ?? 0} | Auto-search hits: ${ov.session?.autoSearchHits ?? 0}`,
          `- **Dreamer**: ${ov.dreamerEnabled ? 'enabled' : 'disabled'}`,
          ...ov.dreamerTasks.map(
            t =>
              `  - \`${t.taskName}\`: ${t.enabled ? 'on' : 'off'} | backlog=${t.backlogCount} | last=${t.lastStatus}${t.lastError ? ` (${t.lastError})` : ''}`,
          ),
        ]

        return { kind: 'success', text: lines.join('\n') }
      },
    })

    reg({
      name: 'ctx-extract',
      description: 'Extract durable facts, episode summary, and user observations from the current session.',
      async handler(inv): Promise<CommandResult> {
        const { sessionId } = await resolveCommandScope(ctx, service, inv)
        const res = await service.triggerExtract(sessionId, inv.signal)
        if (res.status === 'failed') {
          return { kind: 'error', text: `Extraction failed: ${res.reason ?? 'unknown error'}` }
        }
        if (res.status === 'skipped' || res.status === 'busy') {
          return { kind: 'success', text: `Extraction ${res.status}: ${res.reason ?? ''}`.trim() }
        }
        return {
          kind: 'success',
          text: [
            `Extracted session slice [${res.range?.startSeq ?? '?'}..${res.range?.endSeq ?? '?'}]:`,
            `- Episode: ${res.episode ? `**${res.episode.title}**` : '(none)'}`,
            `- Facts promoted: ${res.factsPromoted} (deduplicated: ${res.factsDeduplicated})`,
            `- User observations recorded: ${res.observationsRecorded}`,
          ].join('\n'),
        }
      },
    })

    reg({
      name: 'ctx-dream',
      description: 'Run Dreamer background maintenance now (optional task name: map-memories | verify | curate | classify-memories | retrospective | review-user-memories).',
      input: { hint: '[task-name]' },
      async handler(inv): Promise<CommandResult> {
        const { projectId } = await resolveCommandScope(ctx, service, inv)
        const arg = inv.rawInput.trim()
        let taskName: DreamTaskName | undefined
        if (arg.length > 0) {
          if (!VALID_DREAM_TASKS.has(arg)) {
            return {
              kind: 'error',
              text: `Unknown Dreamer task "${arg}". Valid tasks: ${DREAM_TASK_NAMES.join(', ')}`,
            }
          }
          taskName = arg as DreamTaskName
        }

        const runs = await service.triggerDream(projectId, taskName, inv.signal)
        if (runs.length === 0) {
          return { kind: 'success', text: 'No Dreamer tasks ran (lease busy or scheduler unavailable).' }
        }
        const lines = runs.map(
          r =>
            `- **${r.taskName}** [${r.status}] (${r.durationMs}ms): ${r.summary}${r.failureClass ? ` (${r.failureClass})` : ''}`,
        )
        return { kind: 'success', text: `### Dreamer Run Results\n${lines.join('\n')}` }
      },
    })

    reg({
      name: 'ctx-sync',
      description: 'Queue newly added or updated memories for injection on the next agent step.',
      async handler(inv): Promise<CommandResult> {
        const { projectId, sessionId } = await resolveCommandScope(ctx, service, inv)
        service.requestManualSync(sessionId, projectId)
        return {
          kind: 'success',
          text: 'Queued incremental `<memory-updates>` sync for the next model step.',
        }
      },
    })

    reg({
      name: 'ctx-memory',
      description: 'Inspect Magic Memory: `search <query>`, `export [json|markdown]`, or `doctor`.',
      input: { hint: 'search <query> | export [json|markdown] | doctor' },
      async handler(inv): Promise<CommandResult> {
        const { projectId, sessionId } = await resolveCommandScope(ctx, service, inv)
        const raw = inv.rawInput.trim()
        const [sub = 'doctor', ...rest] = raw.split(/\s+/)
        const arg = rest.join(' ').trim()

        if (sub === 'doctor') {
          const doc = service.runDoctor()
          return {
            kind: 'success',
            text: [
              `### Magic Memory Doctor (${doc.ok ? 'HEALTHY' : 'WARNINGS'})`,
              `- DB: \`${doc.dbPath}\` (${formatBytes(doc.dbSizeBytes)}, mode=\`${doc.journalMode}\`, schema=v${doc.schemaVersion})`,
              `- FTS5 Consistent: ${doc.ftsConsistent ? 'yes' : 'no'}`,
              `- Leases: ${doc.activeLeases} active, ${doc.staleLeasesCleaned} stale cleaned`,
              ...(doc.warnings.length > 0 ? doc.warnings.map(w => `- Warning: ${w}`) : ['- No issues detected.']),
            ].join('\n'),
          }
        }

        if (sub === 'export') {
          const fmt = arg.toLowerCase() === 'json' ? 'json' : 'markdown'
          return { kind: 'success', text: service.exportSnapshot(projectId, fmt) }
        }

        if (sub === 'search') {
          if (arg.length === 0) {
            return { kind: 'error', text: 'Usage: `/ctx-memory search <query>`' }
          }
          const res = await service.search(
            {
              query: arg,
              projectId,
              sessionId,
              limit: 8,
              includeVisible: true,
              recordRetrieval: false,
            },
            inv.signal,
          )
          if (res.hits.length === 0) {
            return { kind: 'success', text: `No Magic Memory matches for "${arg}".` }
          }
          const lines = res.hits.map(
            h => `- **${h.title}** (${h.source}, score=${h.score.toFixed(2)}): ${h.content.slice(0, 200)}`,
          )
          return { kind: 'success', text: lines.join('\n') }
        }

        return {
          kind: 'error',
          text: `Unknown subcommand "${sub}". Use: \`search <query>\`, \`export [json|markdown]\`, or \`doctor\`.`,
        }
      },
    })
  })
}
