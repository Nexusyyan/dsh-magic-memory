/**
 * Model-facing DSH tools registered on `ctx.tools` using `defineTool`:
 * - `ctx_memory` — write / update / archive / restore / merge / get / list durable memories
 * - `ctx_search` — unified hybrid search across memories, episodes, notes, and session highlights
 * - `ctx_note`   — add / list / read / dismiss lightweight session or project notes
 *
 * Tool schemas remain static across turns to keep provider tool-catalog KV cache intact.
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolCallView, ToolResultView } from '@deepseek-ai/dsh-tools'
import { resolveAgentCwd } from '../hooks/context-injector.js'
import type { MagicMemoryService } from '../service/memory-service.js'
import {
  MEMORY_CATEGORIES,
  type MemoryCategory,
  type SearchSource,
} from '../shared/types.js'

const VALID_CATEGORIES = new Set<string>(MEMORY_CATEGORIES)

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue
}

async function resolveToolProjectContext(
  ctx: Context,
  service: MagicMemoryService,
  exec: { agent?: Parameters<typeof resolveAgentCwd>[1]; signal: AbortSignal },
): Promise<{ projectId: string; sessionId: string | undefined; isSubagent: boolean }> {
  const cwd = exec.agent ? await resolveAgentCwd(ctx, exec.agent, exec.signal) : process.cwd()
  const resolved = await service.resolveAndRegisterProject(cwd)
  const sessionId = exec.agent ? String(exec.agent.session.id) : undefined
  const isSubagent = exec.agent?.session.header.origin === 'subagent'
  return { projectId: resolved.projectId, sessionId, isSubagent }
}

export function registerMagicMemoryTools(ctx: Context, service: MagicMemoryService): void {
  // ── 1. ctx_memory ───────────────────────────────────────────────────────────
  ctx.tools.register(
    defineTool({
      name: 'ctx_memory',
      description: [
        'Manage durable cross-session project memories and global user profile.',
        'Actions: write, update, archive, restore, merge, get, list.',
        'Categories: PROJECT_RULES, ARCHITECTURE, CONSTRAINTS, CONFIG_VALUES, NAMING, USER_PROFILE.',
        'Store only durable, high-signal facts (never secrets or temporary debug output).',
      ].join(' '),
      parameters: {
        action: {
          type: 'string',
          required: true,
          enum: ['write', 'update', 'archive', 'restore', 'merge', 'get', 'list'] as const,
          description: 'Operation to perform on the memory store.',
        },
        id: {
          type: 'integer',
          description: 'Memory id (for get, update, archive, restore, or merge target).',
        },
        source_ids: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Source memory ids to fold into `id` when action is "merge".',
        },
        category: {
          type: 'string',
          enum: [...MEMORY_CATEGORIES],
          description: 'Memory category (required for write; optional filter for list or update).',
        },
        content: {
          type: 'string',
          description: 'Concise factual memory statement (required for write and merge; optional for update).',
        },
        scope: {
          type: 'string',
          enum: ['project', 'global', 'all'] as const,
          description: 'Scope: "project" (default), "global" (user profile), or "all" (for list).',
        },
        importance: {
          type: 'integer',
          description: 'Importance score 1-100 (default 55). Higher scores survive tight budgets.',
        },
        pinned: {
          type: 'boolean',
          description: 'Pin high-priority memory so it is prioritized in baseline injection and protected from auto-archive.',
        },
        reason: {
          type: 'string',
          description: 'Optional reason when archiving a memory.',
        },
        limit: {
          type: 'integer',
          description: 'Maximum rows to return for action "list" (default 30).',
        },
      },
      output: {
        schema: { type: 'json' },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      isConcurrencySafe: (args) => {
        const a = (args as { action?: string } | undefined)?.action
        return a === 'get' || a === 'list'
      },
      presentCall: (args): ToolCallView => {
        const a = args as { action?: string; category?: string; id?: number }
        const detail = a.id !== undefined ? ` #${a.id}` : a.category ? ` [${a.category}]` : ''
        return {
          card: 'generic',
          title: `Memory: ${a.action ?? 'op'}${detail}`,
          kind: a.action === 'get' || a.action === 'list' ? 'read' : 'edit',
        }
      },
      presentResult: (args, result): ToolResultView => {
        const a = args as { action?: string }
        return {
          card: 'generic',
          title: result.isError ? `Memory ${a.action ?? ''} failed` : `Memory ${a.action ?? ''} completed`,
          content: result.content,
        }
      },
      async execute(args, exec): Promise<JsonValue> {
        const cfg = service.getConfig()
        if (!cfg.enabled) {
          return toJsonValue({ ok: false, error: 'Magic Memory is currently disabled in plugin configuration.' })
        }
        const { projectId, sessionId, isSubagent } = await resolveToolProjectContext(ctx, service, exec)
        if (isSubagent && cfg.includeSubagents === 'off') {
          return toJsonValue({ ok: false, error: 'Magic Memory is disabled for subagents.' })
        }
        const isMutating = args.action !== 'get' && args.action !== 'list'
        if (isSubagent && isMutating && cfg.includeSubagents === 'search-only') {
          return toJsonValue({ ok: false, error: 'Subagents have read-only Magic Memory access in search-only mode.' })
        }

        switch (args.action) {
          case 'write': {
            const cat = (args.category ?? (args.scope === 'global' ? 'USER_PROFILE' : 'PROJECT_RULES')) as MemoryCategory
            if (!VALID_CATEGORIES.has(cat)) throw new Error(`Invalid memory category: ${String(cat)}`)
            if (!args.content || args.content.trim().length === 0) {
              throw new Error('`content` is required for action "write"')
            }
            const res = service.writeMemory({
              projectId,
              category: cat,
              content: args.content,
              importance: args.importance,
              scope: args.scope === 'global' || cat === 'USER_PROFILE' ? 'global' : 'project',
              sourceKind: 'agent',
              sourceSessionId: sessionId ?? null,
              pinned: args.pinned,
            })
            return toJsonValue({
              ok: true,
              action: res.action,
              memory: res.memory,
              nearDuplicates: res.nearDuplicates,
            })
          }
          case 'update': {
            if (args.id === undefined) throw new Error('`id` is required for action "update"')
            const updated = service.updateMemory({
              id: args.id,
              projectId,
              content: args.content,
              category: args.category as MemoryCategory | undefined,
              importance: args.importance,
              pinned: args.pinned,
              allowGlobalMutation: args.scope === 'global',
            })
            return toJsonValue({ ok: true, memory: updated })
          }
          case 'archive': {
            if (args.id === undefined) throw new Error('`id` is required for action "archive"')
            const archived = service.archiveMemory(
              args.id,
              projectId,
              args.reason ?? 'archived by agent',
              args.scope === 'global',
            )
            return toJsonValue({ ok: true, memory: archived })
          }
          case 'restore': {
            if (args.id === undefined) throw new Error('`id` is required for action "restore"')
            const restored = service.restoreMemory(args.id, projectId, args.scope === 'global')
            return toJsonValue({ ok: true, memory: restored })
          }
          case 'merge': {
            if (args.id === undefined || !args.source_ids || args.source_ids.length === 0 || !args.content) {
              throw new Error('`id`, `source_ids`, and `content` are required for action "merge"')
            }
            const merged = service.mergeMemories({
              projectId,
              targetId: args.id,
              sourceIds: args.source_ids,
              mergedContent: args.content,
              importance: args.importance,
              allowGlobalMutation: args.scope === 'global',
            })
            return toJsonValue({ ok: true, memory: merged })
          }
          case 'get': {
            if (args.id === undefined) throw new Error('`id` is required for action "get"')
            const mem = service.getMemory(args.id)
            return toJsonValue(mem ? { ok: true, memory: mem } : { ok: false, error: `Memory #${args.id} not found` })
          }
          case 'list': {
            const memories = service.listMemories({
              projectId,
              scope: (args.scope as 'project' | 'global' | 'all' | undefined) ?? 'all',
              status: 'active',
              category: args.category as MemoryCategory | undefined,
              limit: args.limit ?? 30,
            })
            return toJsonValue({ ok: true, count: memories.length, memories })
          }
        }
      },
    }),
  )

  // ── 2. ctx_search ───────────────────────────────────────────────────────────
  ctx.tools.register(
    defineTool({
      name: 'ctx_search',
      description: [
        'Unified CJK-aware hybrid search across cross-session project memories, shared workspace constraints,',
        'global user profile, extracted session episodes, notes, and prior session highlights.',
        'By default suppresses memories already visible in your current baseline context (set include_visible=true to show all).',
      ].join(' '),
      parameters: {
        query: {
          type: 'string',
          required: true,
          description: 'Search query (supports Chinese, English, code identifiers, file paths, or concepts).',
        },
        sources: {
          type: 'array',
          items: { type: 'string', enum: ['memory', 'episode', 'note', 'session'] as const },
          description: 'Optional subset of sources to query (default: all).',
        },
        categories: {
          type: 'array',
          items: { type: 'string', enum: [...MEMORY_CATEGORIES] },
          description: 'Optional memory category filter.',
        },
        from: {
          type: 'string',
          description: 'Optional inclusive lower date bound (YYYY-MM-DD or ISO timestamp).',
        },
        to: {
          type: 'string',
          description: 'Optional inclusive upper date bound (YYYY-MM-DD or ISO timestamp).',
        },
        limit: {
          type: 'integer',
          description: 'Maximum results to return (1-50, default 10).',
        },
        include_visible: {
          type: 'boolean',
          description: 'If true, include memories already present in the active session baseline.',
        },
      },
      output: {
        schema: { type: 'json' },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      isConcurrencySafe: () => true,
      presentCall: (args): ToolCallView => ({
        card: 'generic',
        title: `Search memory: ${(args as { query?: string }).query?.slice(0, 60) ?? ''}`,
        kind: 'search',
      }),
      async execute(args, exec): Promise<JsonValue> {
        const cfg = service.getConfig()
        if (!cfg.enabled) {
          return toJsonValue({ ok: false, error: 'Magic Memory is currently disabled.' })
        }
        const { projectId, sessionId, isSubagent } = await resolveToolProjectContext(ctx, service, exec)
        if (isSubagent && cfg.includeSubagents === 'off') {
          return toJsonValue({ ok: false, error: 'Magic Memory is disabled for subagents.' })
        }

        const res = await service.search(
          {
            query: args.query,
            projectId,
            sessionId,
            sources: args.sources as SearchSource[] | undefined,
            categories: args.categories as MemoryCategory[] | undefined,
            from: args.from,
            to: args.to,
            limit: args.limit ?? 10,
            includeVisible: args.include_visible === true,
            recordRetrieval: true,
          },
          exec.signal,
        )

        return toJsonValue({
          ok: true,
          suppressedCount: res.suppressedCount,
          usedVectorSearch: res.usedVectorSearch,
          hits: res.hits,
        })
      },
    }),
  )

  // ── 3. ctx_note ─────────────────────────────────────────────────────────────
  ctx.tools.register(
    defineTool({
      name: 'ctx_note',
      description: 'Store, list, read, or dismiss lightweight working notes for the current project or session.',
      parameters: {
        action: {
          type: 'string',
          required: true,
          enum: ['add', 'list', 'read', 'dismiss'] as const,
          description: 'Note action.',
        },
        id: {
          type: 'integer',
          description: 'Note id (for read or dismiss).',
        },
        title: {
          type: 'string',
          description: 'Short note title (required for add).',
        },
        content: {
          type: 'string',
          description: 'Note body (required for add).',
        },
        session_only: {
          type: 'boolean',
          description: 'Bind note to this session id instead of project-wide.',
        },
      },
      output: {
        schema: { type: 'json' },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      isConcurrencySafe: (args) => {
        const a = (args as { action?: string } | undefined)?.action
        return a === 'list' || a === 'read'
      },
      presentCall: (args): ToolCallView => ({
        card: 'generic',
        title: `Note: ${(args as { action?: string }).action ?? 'op'}`,
        kind: (args as { action?: string }).action === 'list' || (args as { action?: string }).action === 'read' ? 'read' : 'edit',
      }),
      async execute(args, exec): Promise<JsonValue> {
        const { projectId, sessionId } = await resolveToolProjectContext(ctx, service, exec)
        switch (args.action) {
          case 'add': {
            if (!args.title || !args.content) {
              throw new Error('`title` and `content` are required for action "add"')
            }
            const note = service.addNote({
              projectId,
              sessionId: args.session_only ? (sessionId ?? null) : null,
              title: args.title,
              content: args.content,
            })
            return toJsonValue({ ok: true, note })
          }
          case 'list': {
            const notes = service.listNotes(projectId, false)
            return toJsonValue({
              ok: true,
              count: notes.length,
              notes: notes.map(n => ({ id: n.id, title: n.title, status: n.status, updatedAt: n.updatedAt })),
            })
          }
          case 'read': {
            if (args.id === undefined) throw new Error('`id` is required for action "read"')
            const note = service.getNote(args.id)
            return toJsonValue(note ? { ok: true, note } : { ok: false, error: `Note #${args.id} not found` })
          }
          case 'dismiss': {
            if (args.id === undefined) throw new Error('`id` is required for action "dismiss"')
            const dismissed = service.dismissNote(args.id, projectId)
            return toJsonValue({ ok: true, note: dismissed })
          }
        }
      },
    }),
  )
}
