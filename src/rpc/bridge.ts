/**
 * Optional Host <-> Client API bridge over DSH's authenticated exact Fetch route
 * (`ctx.connection.fetch.register({ path: '/api/dsh-magic-memory', ... })`).
 *
 * IMPORTANT: Never call `ctx.connection.rpc.intercept('/api', ...)` — that single
 * slot belongs exclusively to DSH's core API Gateway. Using `connection.fetch.register`
 * with an exact plugin-owned path works seamlessly on BOTH Web Browser (HTTP POST
 * `./api/dsh-magic-memory`) and Electron Desktop (`dsh-app://` carrier IPC) with
 * automatic Host/Origin CSRF checks and owner-Peer authentication, while staying
 * dormant in Headless / ACP / SDK profiles.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ConnectionRpcHandlerResult, HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import type { MagicMemoryService } from '../service/memory-service.js'
import {
  DREAM_TASK_NAMES,
  GLOBAL_PROJECT_ID,
  MEMORY_CATEGORIES,
  type DreamTaskName,
  type MemoryCategory,
  type MemoryStatus,
  type SearchSource,
} from '../shared/types.js'

export const MAGIC_MEMORY_API_PATH = '/api/dsh-magic-memory'

const VALID_CATEGORIES = new Set<string>(MEMORY_CATEGORIES)
const VALID_DREAM_TASKS = new Set<string>(DREAM_TASK_NAMES)

function ok(value: unknown): ConnectionRpcHandlerResult {
  return { ok: true, value }
}

function fail(code: string, message: string): ConnectionRpcHandlerResult {
  return { ok: false, error: { code, message, details: {} } }
}

function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {}
}

async function resolveProjectFromPayload(
  ctx: Context,
  service: MagicMemoryService,
  body: Record<string, unknown>,
): Promise<{ projectId: string; sessionId?: string }> {
  const sessionId = typeof body['sessionId'] === 'string' && body['sessionId'].trim().length > 0
    ? body['sessionId'].trim()
    : undefined

  if (typeof body['projectId'] === 'string' && body['projectId'].trim().length > 0) {
    return { projectId: body['projectId'].trim(), sessionId }
  }

  if (sessionId) {
    const state = service.getSessionState(sessionId)
    if (state?.projectId) {
      return { projectId: state.projectId, sessionId }
    }
    const agents = ctx.get('agents') as { get?: (id: string) => Agent | undefined } | undefined
    const liveAgent = agents?.get?.(sessionId)
    if (liveAgent?.session.header.cwd) {
      const resolved = await service.resolveAndRegisterProject(liveAgent.session.header.cwd)
      return { projectId: resolved.projectId, sessionId }
    }
  }

  const projects = service.listProjects()
  if (projects.length > 0) {
    return { projectId: projects[0]!.projectId, sessionId }
  }

  const fallback = await service.resolveAndRegisterProject(process.cwd())
  return { projectId: fallback.projectId, sessionId }
}

export async function dispatchMagicMemoryRpc(
  ctx: Context,
  service: MagicMemoryService,
  endpoint: string,
  payload: unknown,
  signal: AbortSignal,
): Promise<ConnectionRpcHandlerResult> {
  const body = asRecord(payload)
  const op = endpoint.startsWith('magic-memory/') ? endpoint.slice('magic-memory/'.length) : endpoint

  try {
    switch (op) {
      case 'overview': {
        const { projectId, sessionId } = await resolveProjectFromPayload(ctx, service, body)
        return ok({
          overview: service.getOverview(projectId, sessionId),
          projects: service.listProjects(),
        })
      }

      case 'memories.list': {
        const { projectId } = await resolveProjectFromPayload(ctx, service, body)
        const scope = (body['scope'] as 'project' | 'global' | 'all' | undefined) ?? 'all'
        const status = (body['status'] as MemoryStatus | 'all' | undefined) ?? 'active'
        const category = typeof body['category'] === 'string' && VALID_CATEGORIES.has(body['category'])
          ? (body['category'] as MemoryCategory)
          : undefined
        const limit = typeof body['limit'] === 'number' ? body['limit'] : 200
        return ok({
          projectId,
          memories: service.listMemories({ projectId, scope, status, category, limit }),
        })
      }

      case 'memories.search': {
        const { projectId, sessionId } = await resolveProjectFromPayload(ctx, service, body)
        const query = typeof body['query'] === 'string' ? body['query'] : ''
        const sources = Array.isArray(body['sources'])
          ? (body['sources'].filter((s): s is SearchSource => typeof s === 'string'))
          : undefined
        const categories = Array.isArray(body['categories'])
          ? (body['categories'].filter((c): c is MemoryCategory => typeof c === 'string' && VALID_CATEGORIES.has(c)))
          : undefined
        const limit = typeof body['limit'] === 'number' ? body['limit'] : 25
        const result = await service.search(
          {
            query,
            projectId,
            sessionId,
            sources,
            categories,
            limit,
            includeVisible: true,
            recordRetrieval: false,
          },
          signal,
        )
        return ok(result)
      }

      case 'memories.create': {
        const { projectId, sessionId } = await resolveProjectFromPayload(ctx, service, body)
        const content = typeof body['content'] === 'string' ? body['content'] : ''
        const scope = body['scope'] === 'global' ? 'global' : 'project'
        const rawCat = typeof body['category'] === 'string' ? body['category'] : (scope === 'global' ? 'USER_PROFILE' : 'PROJECT_RULES')
        if (!VALID_CATEGORIES.has(rawCat)) {
          return fail('magic-memory/invalid-category', `Invalid category: ${rawCat}`)
        }
        const importance = typeof body['importance'] === 'number' ? body['importance'] : 60
        const pinned = body['pinned'] === true
        const result = service.writeMemory({
          projectId: scope === 'global' ? GLOBAL_PROJECT_ID : projectId,
          category: rawCat as MemoryCategory,
          content,
          importance,
          scope,
          pinned,
          sourceKind: 'user',
          sourceSessionId: sessionId ?? null,
        })
        return ok(result)
      }

      case 'memories.update': {
        const { projectId } = await resolveProjectFromPayload(ctx, service, body)
        const id = Number(body['id'])
        if (!Number.isInteger(id) || id <= 0) {
          return fail('magic-memory/invalid-id', 'Valid memory id is required')
        }
        const updated = service.updateMemory({
          id,
          projectId,
          content: typeof body['content'] === 'string' ? body['content'] : undefined,
          category: typeof body['category'] === 'string' && VALID_CATEGORIES.has(body['category'])
            ? (body['category'] as MemoryCategory)
            : undefined,
          importance: typeof body['importance'] === 'number' ? body['importance'] : undefined,
          pinned: typeof body['pinned'] === 'boolean' ? body['pinned'] : undefined,
          allowGlobalMutation: true,
        })
        return ok({ memory: updated })
      }

      case 'memories.archive': {
        const { projectId } = await resolveProjectFromPayload(ctx, service, body)
        const id = Number(body['id'])
        if (!Number.isInteger(id) || id <= 0) {
          return fail('magic-memory/invalid-id', 'Valid memory id is required')
        }
        const reason = typeof body['reason'] === 'string' ? body['reason'] : 'archived from sidebar'
        const archived = service.archiveMemory(id, projectId, reason, true)
        return ok({ memory: archived })
      }

      case 'memories.restore': {
        const { projectId } = await resolveProjectFromPayload(ctx, service, body)
        const id = Number(body['id'])
        if (!Number.isInteger(id) || id <= 0) {
          return fail('magic-memory/invalid-id', 'Valid memory id is required')
        }
        const restored = service.restoreMemory(id, projectId, true)
        return ok({ memory: restored })
      }

      case 'episodes.list': {
        const { projectId } = await resolveProjectFromPayload(ctx, service, body)
        const limit = typeof body['limit'] === 'number' ? body['limit'] : 40
        return ok({ projectId, episodes: service.listEpisodes(projectId, limit) })
      }

      case 'notes.list': {
        const { projectId } = await resolveProjectFromPayload(ctx, service, body)
        const includeDismissed = body['includeDismissed'] === true
        return ok({ projectId, notes: service.listNotes(projectId, includeDismissed) })
      }

      case 'notes.create': {
        const { projectId, sessionId } = await resolveProjectFromPayload(ctx, service, body)
        const title = typeof body['title'] === 'string' ? body['title'] : ''
        const content = typeof body['content'] === 'string' ? body['content'] : ''
        const note = service.addNote({
          projectId,
          sessionId: body['sessionOnly'] === true ? (sessionId ?? null) : null,
          title,
          content,
        })
        return ok({ note })
      }

      case 'notes.dismiss': {
        const { projectId } = await resolveProjectFromPayload(ctx, service, body)
        const id = Number(body['id'])
        if (!Number.isInteger(id) || id <= 0) {
          return fail('magic-memory/invalid-id', 'Valid note id is required')
        }
        return ok({ note: service.dismissNote(id, projectId) })
      }

      case 'extract.now': {
        const { sessionId } = await resolveProjectFromPayload(ctx, service, body)
        if (!sessionId) {
          return fail('magic-memory/no-session', 'Active sessionId is required to run extraction')
        }
        const res = await service.triggerExtract(sessionId, signal)
        return ok(res)
      }

      case 'dreamer.status': {
        const { projectId } = await resolveProjectFromPayload(ctx, service, body)
        return ok({
          enabled: service.getConfig().dreamer.enabled,
          tasks: service.getDreamTaskStatuses(projectId),
          recentRuns: service.listRecentDreamRuns(projectId, 25),
        })
      }

      case 'dreamer.run': {
        const { projectId } = await resolveProjectFromPayload(ctx, service, body)
        let taskName: DreamTaskName | undefined
        if (typeof body['taskName'] === 'string' && body['taskName'].trim().length > 0) {
          const candidate = body['taskName'].trim()
          if (!VALID_DREAM_TASKS.has(candidate)) {
            return fail('magic-memory/invalid-task', `Unknown dreamer task: ${candidate}`)
          }
          taskName = candidate as DreamTaskName
        }
        const runs = await service.triggerDream(projectId, taskName, signal)
        return ok({ runs })
      }

      case 'sync.request': {
        const { projectId, sessionId } = await resolveProjectFromPayload(ctx, service, body)
        if (!sessionId) {
          return fail('magic-memory/no-session', 'Active sessionId is required to queue sync')
        }
        service.requestManualSync(sessionId, projectId)
        return ok({ queued: true })
      }

      case 'doctor': {
        return ok(service.runDoctor())
      }

      case 'export': {
        const { projectId } = await resolveProjectFromPayload(ctx, service, body)
        const format = body['format'] === 'json' ? 'json' : 'markdown'
        return ok({ format, content: service.exportSnapshot(projectId, format) })
      }

      default:
        return fail('magic-memory/unknown-endpoint', `Unknown Magic Memory RPC endpoint: ${endpoint}`)
    }
  } catch (err: unknown) {
    return fail('magic-memory/error', err instanceof Error ? err.message : String(err))
  }
}

export function createMagicMemoryFetchHandler(
  ctx: Context,
  service: MagicMemoryService,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return Response.json(fail('magic-memory/bad-json', 'Request body must be valid JSON'), { status: 400 })
    }
    const reqObj = asRecord(raw)
    const op = typeof reqObj['op'] === 'string' ? reqObj['op'].trim() : ''
    if (!op) {
      return Response.json(fail('magic-memory/missing-op', 'Request body must include string `op`'), { status: 400 })
    }
    const result = await dispatchMagicMemoryRpc(ctx, service, op, reqObj['payload'], request.signal)
    return Response.json(result, { status: 200 })
  }
}

export function registerRpcBridge(ctx: Context, service: MagicMemoryService): void {
  ctx.inject(['connection'], (connCtx: Context) => {
    const connection = connCtx.get('connection') as HostConnectionHandle | undefined
    if (!connection?.fetch?.register) return

    try {
      connCtx.effect(
        () =>
          connection.fetch.register({
            path: MAGIC_MEMORY_API_PATH,
            methods: ['POST'],
            requestBody: 'buffered',
            fetch: createMagicMemoryFetchHandler(ctx, service),
          }),
        'dsh-magic-memory /api/dsh-magic-memory route',
      )
    } catch (err) {
      ctx.logger?.warn?.('[dsh-magic-memory] failed to register API route %s: %o', MAGIC_MEMORY_API_PATH, err)
    }
  })
}
