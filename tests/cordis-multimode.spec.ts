import { Context } from '@deepseek-ai/cordis'
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt'
import { ToolsService } from '@deepseek-ai/dsh-tools'
import { afterEach, describe, expect, it } from 'vitest'
import * as magicMemoryPlugin from '../src/index.js'

const contexts: Context[] = []

afterEach(() => {
  while (contexts.length > 0) {
    contexts.pop()!.fiber.dispose()
  }
})

describe('Cordis Multi-Mode Integration (Full Web/Desktop vs Minimal Headless/ACP/SDK + Disposal)', () => {
  it('mounts cleanly on real Cordis + real DSH Tools & SystemPrompt in Minimal Headless/ACP/SDK mode (no commands/connection/cwd)', async () => {
    const ctx = new Context()
    contexts.push(ctx)

    // Mount real DSH ToolsService and a minimal sessions stub (Headless/ACP/SDK minimal profile)
    ctx.plugin(SystemPrompt)
    ctx.plugin(ToolsService)
    ctx.provide('sessions' as never, {
      get: () => undefined,
    } as never)

    const fork = ctx.plugin(magicMemoryPlugin, {
      dbPath: ':memory:',
      dreamer: { enabled: false },
    })

    await new Promise(r => setTimeout(r, 20))

    // Verify MagicMemoryService is mounted on ctx.magicMemory
    expect(ctx.magicMemory).toBeDefined()
    expect(ctx.magicMemory.storage.isClosed()).toBe(false)

    // Verify all 3 model tools are registered in real DSH ToolsService and export valid ToolSchemas
    const registeredTools = ctx.tools.definitions()
    const toolNames = registeredTools.map(t => t.name)
    expect(toolNames).toEqual(expect.arrayContaining(['ctx_memory', 'ctx_search', 'ctx_note']))
    expect(ctx.tools.schemas().map(s => s.name)).toEqual(
      expect.arrayContaining(['ctx_memory', 'ctx_search', 'ctx_note']),
    )

    // Execute real `ctx_memory` write -> `ctx_search` -> `ctx_note` directly through tool definitions
    const memTool = ctx.tools.get('ctx_memory')!
    const searchTool = ctx.tools.get('ctx_search')!
    const noteTool = ctx.tools.get('ctx_note')!
    const execCtx = { signal: new AbortController().signal } as never

    const writeRes = (await memTool.execute(
      {
        action: 'write',
        category: 'ARCHITECTURE',
        content: 'Plugin uses zero-dependency node:sqlite across macOS, Windows, and Linux.',
        importance: 90,
      },
      execCtx,
    )) as { ok: boolean; action: string }
    expect(writeRes.ok).toBe(true)
    expect(writeRes.action).toBe('created')

    const searchRes = (await searchTool.execute(
      { query: 'zero-dependency sqlite', sources: ['memory'], include_visible: true },
      execCtx,
    )) as { ok: boolean; hits: unknown[] }
    expect(searchRes.ok).toBe(true)
    expect(searchRes.hits.length).toBeGreaterThanOrEqual(1)

    const noteRes = (await noteTool.execute(
      { action: 'add', title: 'Smoke Test Note', content: 'Check WAL cleanup on shutdown.' },
      execCtx,
    )) as { ok: boolean; note: { title: string } }
    expect(noteRes.ok).toBe(true)
    expect(noteRes.note.title).toBe('Smoke Test Note')

    // Clean disposal MUST close SQLite DB, abort lifecycle signal, and unregister all 3 tools
    const serviceRef = ctx.magicMemory
    fork.dispose()
    await new Promise(r => setTimeout(r, 15))
    expect(serviceRef.storage.isClosed()).toBe(true)
    expect(serviceRef.getLifecycleSignal().aborted).toBe(true)
    expect(ctx.tools.get('ctx_memory')).toBeUndefined()
    expect(ctx.tools.get('ctx_search')).toBeUndefined()
    expect(ctx.tools.get('ctx_note')).toBeUndefined()
  })

  it('registers all 5 slash commands and /api RPC interceptor when Full Web/Desktop services are present', async () => {
    const ctx = new Context()
    contexts.push(ctx)

    ctx.plugin(SystemPrompt)
    ctx.plugin(ToolsService)
    ctx.provide('sessions' as never, { get: () => undefined } as never)

    // Mock DSH commands registry & connection.rpc registry as present on Web/Desktop
    const registeredCommands = new Map<string, { handler: (inv: unknown) => Promise<unknown> }>()
    let commandsDisposed = 0
    ctx.provide('commands' as never, {
      register(def: { name: string; handler: (inv: unknown) => Promise<unknown> }) {
        registeredCommands.set(def.name, def)
        return () => {
          registeredCommands.delete(def.name)
          commandsDisposed += 1
        }
      },
    } as never)

    let fetchRoute: { path: string; methods: readonly string[]; requestBody: string; fetch: (req: Request) => Promise<Response> } | null = null
    let rpcDisposed = false
    let interceptCalled = false
    ctx.provide('connection' as never, {
      rpc: {
        intercept() {
          interceptCalled = true
          throw new Error('Plugins must NEVER call connection.rpc.intercept(/api)!')
        },
      },
      fetch: {
        register(route: { path: string; methods: readonly string[]; requestBody: string; fetch: (req: Request) => Promise<Response> }) {
          expect(route.path).toBe('/api/dsh-magic-memory')
          expect(route.methods).toEqual(['POST'])
          expect(route.requestBody).toBe('buffered')
          fetchRoute = route
          return async () => {
            rpcDisposed = true
            fetchRoute = null
          }
        },
      },
    } as never)

    const fork = ctx.plugin(magicMemoryPlugin, {
      dbPath: ':memory:',
      dreamer: { enabled: false },
    })

    await new Promise(r => setTimeout(r, 20))

    // Verify all 5 slash commands registered
    expect(Array.from(registeredCommands.keys())).toEqual(
      expect.arrayContaining(['ctx-status', 'ctx-extract', 'ctx-dream', 'ctx-sync', 'ctx-memory']),
    )

    // Write a memory via service and verify /ctx-status + /ctx-memory doctor + /api RPC overview
    const fakeAgent = {
      session: { id: 'cmd-sess-1', header: { id: 'cmd-sess-1', cwd: '/tmp/cmd-proj', origin: 'user' } },
    }
    const proj = await ctx.magicMemory.resolveAndRegisterProject('/tmp/cmd-proj')
    ctx.magicMemory.writeMemory({
      projectId: proj.projectId,
      category: 'PROJECT_RULES',
      content: 'Never commit .env files to git',
      importance: 90,
    })

    const statusCmdRes = (await registeredCommands.get('ctx-status')!.handler({
      agent: fakeAgent,
      rawInput: '',
      signal: new AbortController().signal,
    })) as { kind: string; text: string }
    expect(statusCmdRes.kind).toBe('success')
    expect(statusCmdRes.text).toContain('Magic Memory')

    const doctorCmdRes = (await registeredCommands.get('ctx-memory')!.handler({
      agent: fakeAgent,
      rawInput: 'doctor',
      signal: new AbortController().signal,
    })) as { kind: string; text: string }
    expect(doctorCmdRes.kind).toBe('success')
    expect(doctorCmdRes.text).toContain('HEALTHY')

    // Invoke /api/dsh-magic-memory Fetch route directly & confirm rpc.intercept was NEVER touched
    expect(interceptCalled).toBe(false)
    expect(fetchRoute).not.toBeNull()
    const httpRes = await fetchRoute!.fetch(
      new Request('http://localhost/api/dsh-magic-memory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'overview', payload: { projectId: proj.projectId, sessionId: 'cmd-sess-1' } }),
      }),
    )
    expect(httpRes.status).toBe(200)
    const rpcRes = (await httpRes.json()) as { ok: boolean; value: { overview: { activeMemoryCount: number } } }
    expect(rpcRes.ok).toBe(true)
    expect(rpcRes.value.overview.activeMemoryCount).toBe(1)

    // Dispose cleans up commands, RPC bridge, and SQLite DB
    fork.dispose()
    await new Promise(r => setTimeout(r, 15))
    expect(commandsDisposed).toBe(5)
    expect(rpcDisposed).toBe(true)
  })

  it('reacts immediately to Schemastery .volatile() live config updates via Cordis fork.update and in-place Volatile cells', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    ctx.plugin(SystemPrompt)
    ctx.plugin(ToolsService)
    ctx.provide('sessions' as never, { get: () => undefined } as never)

    const baseCfg = { dbPath: ':memory:', enabled: true, dreamer: { enabled: false } }
    const fork = ctx.plugin(magicMemoryPlugin, baseCfg)
    await new Promise(r => setTimeout(r, 20))

    // Cordis wraps .volatile() schema fields into Volatile boxes and readConfigSnapshot unwraps them
    expect(ctx.magicMemory.getConfig().enabled).toBe(true)

    await fork.update({ ...baseCfg, enabled: false })
    await new Promise(r => setTimeout(r, 20))
    expect(ctx.magicMemory.getConfig().enabled).toBe(false)

    // Tool immediately honors paused state
    const memTool = ctx.tools.get('ctx_memory')!
    const pausedRes = (await memTool.execute(
      { action: 'list' },
      { signal: new AbortController().signal } as never,
    )) as { ok: boolean; error?: string }
    expect(pausedRes.ok).toBe(false)
    expect(pausedRes.error).toMatch(/disabled/i)

    // Also verify in-place Volatile<T> cell mutation (DSH Settings hot-reload without restart)
    let liveAutoSearch = true
    const standaloneCtx = new Context()
    contexts.push(standaloneCtx)
    const liveService = new magicMemoryPlugin.MagicMemoryService(standaloneCtx, {
      dbPath: ':memory:',
      enabled: { get: () => liveAutoSearch } as never,
    })
    expect(liveService.getConfig().enabled).toBe(true)
    liveAutoSearch = false
    expect(liveService.getConfig().enabled).toBe(false)
  })
})
