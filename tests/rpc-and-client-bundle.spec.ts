// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { createMagicMemoryFetchHandler } from '../src/rpc/bridge.js'
import { MagicMemoryService } from '../src/service/memory-service.js'

const contexts: Context[] = []
const originalFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
  while (contexts.length > 0) {
    contexts.pop()!.fiber.dispose()
  }
})

describe('Host RPC Bridge & Compiled Browser Client Bundle (`dist/client.js`) End-to-End', () => {
  it('loads compiled dist/client.js via window.__ModuleLoader__, mounts Left-Sidebar, Header Button, and Right-Sidebar Tab, and drives live CRUD against SQLite', async () => {
    // 1. Stand up real Host MagicMemoryService backed by in-memory SQLite
    const hostCtx = new Context()
    contexts.push(hostCtx)
    const service = new MagicMemoryService(hostCtx, {
      dbPath: ':memory:',
      dreamer: { enabled: true },
    })
    const proj = service.upsertProject('proj-ui', 'UI Demo Repo', '/ui-demo')
    service.writeMemory({
      projectId: proj.projectId,
      category: 'ARCHITECTURE',
      content: 'Sidebar dashboard talks to Host exclusively through ctx.connection.rpc /api.',
      importance: 85,
    })
    service.recordEpisode({
      sessionId: 'sess-ui-1',
      projectId: proj.projectId,
      startSeq: 1,
      endSeq: 6,
      episodeType: 'feature',
      importance: 78,
      title: 'Added Right-Sidebar Memory Panel',
      summary: 'Implemented 4-tab React panel without internal UI primitive imports.',
      keyDecisions: ['Use --dsw-alias-* CSS variables'],
    })

    // 2. Execute the ACTUAL compiled dist/client.js bundle inside jsdom
    const bundlePath = resolve(process.cwd(), 'dist/client.js')
    const bundleCode = readFileSync(bundlePath, 'utf8')

    let loadedSpec: { id: string; factory: (req: (id: string) => unknown) => Record<string, unknown> } | null = null
    ;(window as unknown as Record<string, unknown>)['__ModuleLoader__'] = {
      load(spec: { id: string; factory: (req: (id: string) => unknown) => Record<string, unknown> }) {
        loadedSpec = spec
      },
    }

    new Function(bundleCode)()

    expect(loadedSpec).not.toBeNull()
    expect(loadedSpec!.id).toBe('dsh-magic-memory')

    // Verify factory ONLY calls require('react')
    const requiredModules: string[] = []
    const clientExports = loadedSpec!.factory((id: string) => {
      requiredModules.push(id)
      if (id === 'react') return React
      throw new Error(`Unexpected browser require: ${id}`)
    })
    expect(requiredModules.length).toBeGreaterThan(0)
    expect(Array.from(new Set(requiredModules))).toEqual(['react'])
    expect(clientExports['inject']).toEqual(['slots', 'locale'])
    expect(typeof clientExports['apply']).toBe('function')

    // 3. Wire global `fetch('./api/dsh-magic-memory')` directly to Host's real createMagicMemoryFetchHandler
    const hostFetchHandler = createMagicMemoryFetchHandler(hostCtx, service)
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      expect(url).toBe('./api/dsh-magic-memory')
      const req = new Request('http://dsh.local/api/dsh-magic-memory', {
        method: init?.method,
        headers: init?.headers,
        body: init?.body,
      })
      return hostFetchHandler(req)
    }) as typeof fetch

    // Wire mock DSH browser client Context (matching Desktop 0.2.2-rc.5)
    const registeredLocales: Record<string, Record<string, Record<string, string>>> = {}
    let registeredTabDef: { id: string; kind: string; priority?: string; guide?: unknown[] } | null = null
    const openedRightTabs: string[] = []
    const slotEntries = new Map<
      string,
      {
        options: {
          name: string
          key?: string
          id?: string
          label?: () => string
          locale?: string
          inject?: (...args: unknown[]) => Record<string, unknown>
        }
        component: React.ComponentType<Record<string, unknown>>
      }
    >()
    const disposers: (() => void)[] = []

    const mockClientCtx: Record<string, unknown> = {
      locale: {
        register(ns: string, dictsOrLocale: Record<string, Record<string, string>> | string, dict?: Record<string, string>) {
          registeredLocales[ns] ??= {}
          if (typeof dictsOrLocale === 'string' && dict) {
            registeredLocales[ns]![dictsOrLocale] = dict
          } else if (typeof dictsOrLocale === 'object') {
            Object.assign(registeredLocales[ns]!, dictsOrLocale)
          }
          return () => {}
        },
        bind(ns: string) {
          return (key: string, params?: Record<string, unknown>) => {
            const tpl = registeredLocales[ns]?.['en']?.[key] ?? key
            if (!params) return tpl
            return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`))
          }
        },
      },
      sidebarRightTabs: {
        register(def: { id: string; kind: string; priority?: string; guide?: unknown[] }) {
          registeredTabDef = def
          return () => {}
        },
      },
      sidebarRight: {
        openTab(kind: string) {
          openedRightTabs.push(kind)
        },
      },
      slots: {
        inject(_slotName: string, factory: () => () => void) {
          return factory()
        },
        register(
          options: {
            name: string
            key?: string
            id?: string
            label?: () => string
            locale?: string
            inject?: (...args: unknown[]) => Record<string, unknown>
          },
          component: React.ComponentType<Record<string, unknown>>,
        ) {
          slotEntries.set(options.name, { options, component })
          return () => {
            slotEntries.delete(options.name)
          }
        },
      },
      effect(fn: () => (() => void) | void) {
        const d = fn()
        if (typeof d === 'function') disposers.push(d)
      },
      inject(_deps: readonly string[], cb: (c: unknown) => void) {
        cb(mockClientCtx)
      },
    }

    ;(clientExports['apply'] as (ctx: unknown) => void)(mockClientCtx)

    // Verify HMR-clean <style data-plugin="dsh-magic-memory"> injected
    const styleEl = document.getElementById('dsh-magic-memory-styles')
    expect(styleEl?.getAttribute('data-plugin')).toBe('dsh-magic-memory')

    // Verify bilingual locales
    expect(registeredLocales['magicMemory']?.['en']?.['tab.title']).toBe('Magic Memory')
    expect(registeredLocales['magicMemory']?.['zh']?.['nav.memories']).toBe('记忆库')

    // Verify Surface 1: Left Navigation Sidebar (`sidebar.panellist` + `main`)
    const navEntry = slotEntries.get('sidebar.panellist')
    const mainEntry = slotEntries.get('main')
    expect(navEntry?.options.id).toBe('dsh-magic-memory')
    expect(navEntry?.options.label?.()).toBe('Magic Memory')
    expect(mainEntry?.options.key).toBe('dsh-magic-memory')

    // Verify Surface 2: Conversation Top Header quick-open button (`conversation.session.header.actions`)
    const headerEntry = slotEntries.get('conversation.session.header.actions')
    expect(headerEntry?.options.id).toBe('dsh-magic-memory')
    const HeaderBtn = headerEntry!.component
    const hdrRender = render(React.createElement(HeaderBtn, {}))
    fireEvent.click(screen.getByRole('button', { name: /Open Magic Memory panel/i }))
    expect(openedRightTabs).toEqual(['magic-memory'])
    hdrRender.unmount()

    // Verify Surface 3: Right-Sidebar Tab + Guide card (`sidebarRightTabs` + `sidebar.right.pane.tab`)
    expect(registeredTabDef?.id).toBe('dsh-magic-memory')
    expect(registeredTabDef?.kind).toBe('magic-memory')
    expect(registeredTabDef?.priority).toBe('extension')
    expect(registeredTabDef?.guide).toHaveLength(1)

    const rightTabEntry = slotEntries.get('sidebar.right.pane.tab')
    expect(rightTabEntry?.options.key).toBe('dsh-magic-memory')

    // Render full-page Main panel to verify variant="page"
    const MainPage = mainEntry!.component
    const mainInjected = mainEntry!.options.inject?.() ?? {}
    const mainView = render(React.createElement(MainPage, mainInjected))
    expect(screen.getByTestId('magic-memory-panel').getAttribute('data-variant')).toBe('page')
    await waitFor(() => {
      expect(screen.getByText(/ctx\.connection\.rpc \/api/)).toBeTruthy()
    })
    mainView.unmount()

    // Render Right-Sidebar TabBody with DSH's real `useTabInfo` prop & test all 4 tabs interactively
    let boundRefresh: (() => void) | undefined
    const TabBody = rightTabEntry!.component
    const tabInjected = rightTabEntry!.options.inject?.() ?? {}
    render(
      React.createElement(TabBody, {
        ...tabInjected,
        sessionId: 'sess-ui-1',
        useTabInfo: () => ({
          tab: {
            actions: {
              bindCommands: (cmds: { refresh?: () => void }) => {
                boundRefresh = cmds.refresh
                return () => {}
              },
            },
          },
        }),
      }),
    )

    expect(screen.getByTestId('magic-memory-panel').getAttribute('data-variant')).toBe('sidebar')
    expect(typeof boundRefresh).toBe('function')

    // Tab 1: Memories loads existing memory from SQLite & creates a new one
    await waitFor(() => {
      expect(screen.getByText(/ctx\.connection\.rpc \/api/)).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /\+ New Memory/i }))
    fireEvent.change(screen.getByLabelText('Content'), {
      target: { value: 'Always run pnpm run build before packaging.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Always run pnpm run build before packaging.')).toBeTruthy()
    })
    expect(service.listMemories({ projectId: proj.projectId })).toHaveLength(2)

    // Tab 2: Episodes & Notes
    fireEvent.click(screen.getByRole('tab', { name: /Episodes & Notes/i }))
    await waitFor(() => {
      expect(screen.getByText('Added Right-Sidebar Memory Panel')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Note/i }))
    fireEvent.change(screen.getByPlaceholderText('Note title…'), { target: { value: 'Release Checklist' } })
    fireEvent.change(screen.getByPlaceholderText('Short working note or reminder…'), {
      target: { value: 'Verify npm pack --dry-run output.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Note' }))
    await waitFor(() => {
      expect(screen.getByText(/Release Checklist/)).toBeTruthy()
    })
    expect(service.listNotes(proj.projectId)).toHaveLength(1)

    // Tab 3: Dreamer Console
    fireEvent.click(screen.getByRole('tab', { name: /Dreamer/i }))
    await waitFor(() => {
      expect(screen.getByText('map-memories')).toBeTruthy()
      expect(screen.getByText('review-user-memories')).toBeTruthy()
    })

    // Tab 4: Telemetry + Doctor + Export Markdown
    fireEvent.click(screen.getByRole('tab', { name: /Telemetry/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run Doctor' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Run Doctor' }))
    await waitFor(() => {
      expect(screen.getByText(/Database healthy/i)).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Export Markdown' }))
    await waitFor(() => {
      expect(screen.getByText(/# Magic Memory Export/)).toBeTruthy()
    })

    for (const d of disposers) d()
  })
})
