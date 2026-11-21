/**
 * Typed client API caller talking to Host's authenticated exact Fetch route
 * (`./api/dsh-magic-memory`).
 *
 * Uses document-relative `./api/dsh-magic-memory`, which DSH automatically
 * routes over HTTP (Web) or the Electron shell carrier (Desktop) with built-in
 * authentication and CSRF protection.
 */

import type {
  DoctorCheckResult,
  DreamRunRecord,
  DreamTaskName,
  DreamTaskScheduleState,
  ExtractRunResult,
  MagicMemoryOverview,
  MemoryCategory,
  MemoryRecord,
  MemoryScope,
  MemoryStatus,
  NoteRecord,
  ProjectRecord,
  SearchSource,
  SessionEpisodeRecord,
  UnifiedSearchResponse,
  WriteMemoryResult,
} from '../shared/types.js'

export const MAGIC_MEMORY_CLIENT_ROUTE = './api/dsh-magic-memory'

export type ApiResponseEnvelope =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

export type MagicMemoryTransport = (
  op: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<ApiResponseEnvelope>

export function createFetchTransport(
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  route: string = MAGIC_MEMORY_CLIENT_ROUTE,
): MagicMemoryTransport {
  return async (op, payload, signal) => {
    const response = await fetchImpl(route, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op, payload }),
      signal,
    })
    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: `http/${response.status}`,
          message: `Magic Memory API request "${op}" failed with HTTP ${response.status}`,
        },
      }
    }
    const json = (await response.json()) as unknown
    if (typeof json !== 'object' || json === null || typeof (json as { ok?: unknown }).ok !== 'boolean') {
      return {
        ok: false,
        error: {
          code: 'magic-memory/invalid-response',
          message: `Magic Memory API returned an unexpected response for "${op}"`,
        },
      }
    }
    return json as ApiResponseEnvelope
  }
}

export class MagicMemoryApi {
  private readonly transport: MagicMemoryTransport

  constructor(transport: MagicMemoryTransport = createFetchTransport()) {
    this.transport = transport
  }

  private async invoke<T>(op: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    const res = await this.transport(op, payload, signal)
    if (!res.ok) {
      throw new Error(res.error?.message || `RPC ${op} failed (${res.error?.code ?? 'error'})`)
    }
    return res.value as T
  }

  getOverview(params: { projectId?: string; sessionId?: string }, signal?: AbortSignal): Promise<{
    overview: MagicMemoryOverview
    projects: ProjectRecord[]
  }> {
    return this.invoke('overview', params, signal)
  }

  listMemories(
    params: {
      projectId?: string
      scope?: 'project' | 'global' | 'all'
      status?: MemoryStatus | 'all'
      category?: MemoryCategory
      limit?: number
    },
    signal?: AbortSignal,
  ): Promise<{ projectId: string; memories: MemoryRecord[] }> {
    return this.invoke('memories.list', params, signal)
  }

  searchMemories(
    params: {
      projectId?: string
      sessionId?: string
      query: string
      sources?: SearchSource[]
      categories?: MemoryCategory[]
      limit?: number
    },
    signal?: AbortSignal,
  ): Promise<UnifiedSearchResponse> {
    return this.invoke('memories.search', params, signal)
  }

  createMemory(
    params: {
      projectId?: string
      sessionId?: string
      category: MemoryCategory
      scope: MemoryScope
      content: string
      importance: number
      pinned: boolean
    },
    signal?: AbortSignal,
  ): Promise<WriteMemoryResult> {
    return this.invoke('memories.create', params, signal)
  }

  updateMemory(
    params: {
      projectId?: string
      id: number
      category?: MemoryCategory
      content?: string
      importance?: number
      pinned?: boolean
    },
    signal?: AbortSignal,
  ): Promise<{ memory: MemoryRecord }> {
    return this.invoke('memories.update', params, signal)
  }

  archiveMemory(params: { projectId?: string; id: number; reason?: string }, signal?: AbortSignal): Promise<{ memory: MemoryRecord }> {
    return this.invoke('memories.archive', params, signal)
  }

  restoreMemory(params: { projectId?: string; id: number }, signal?: AbortSignal): Promise<{ memory: MemoryRecord }> {
    return this.invoke('memories.restore', params, signal)
  }

  listEpisodes(params: { projectId?: string; limit?: number }, signal?: AbortSignal): Promise<{
    projectId: string
    episodes: SessionEpisodeRecord[]
  }> {
    return this.invoke('episodes.list', params, signal)
  }

  listNotes(params: { projectId?: string; includeDismissed?: boolean }, signal?: AbortSignal): Promise<{
    projectId: string
    notes: NoteRecord[]
  }> {
    return this.invoke('notes.list', params, signal)
  }

  createNote(
    params: {
      projectId?: string
      sessionId?: string
      title: string
      content: string
      sessionOnly?: boolean
    },
    signal?: AbortSignal,
  ): Promise<{ note: NoteRecord }> {
    return this.invoke('notes.create', params, signal)
  }

  dismissNote(params: { projectId?: string; id: number }, signal?: AbortSignal): Promise<{ note: NoteRecord }> {
    return this.invoke('notes.dismiss', params, signal)
  }

  extractNow(params: { projectId?: string; sessionId: string }, signal?: AbortSignal): Promise<ExtractRunResult> {
    return this.invoke('extract.now', params, signal)
  }

  getDreamerStatus(params: { projectId?: string }, signal?: AbortSignal): Promise<{
    enabled: boolean
    tasks: DreamTaskScheduleState[]
    recentRuns: DreamRunRecord[]
  }> {
    return this.invoke('dreamer.status', params, signal)
  }

  runDreamer(params: { projectId?: string; taskName?: DreamTaskName }, signal?: AbortSignal): Promise<{
    runs: DreamRunRecord[]
  }> {
    return this.invoke('dreamer.run', params, signal)
  }

  requestSync(params: { projectId?: string; sessionId: string }, signal?: AbortSignal): Promise<{ queued: boolean }> {
    return this.invoke('sync.request', params, signal)
  }

  runDoctor(signal?: AbortSignal): Promise<DoctorCheckResult> {
    return this.invoke('doctor', {}, signal)
  }

  exportSnapshot(params: { projectId?: string; format: 'markdown' | 'json' }, signal?: AbortSignal): Promise<{
    format: 'markdown' | 'json'
    content: string
  }> {
    return this.invoke('export', params, signal)
  }
}
