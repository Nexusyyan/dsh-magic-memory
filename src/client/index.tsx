/**
 * Browser / Desktop Electron Client Plugin entry for `dsh-magic-memory`.
 *
 * Mounts three native DSH Desktop & Web UI surfaces:
 * 1. Left Sidebar Navigation entry (`sidebar.panellist`) + full-page Dashboard (`main`, key `dsh-magic-memory`)
 *    — always visible on the left navigation bar, works with or without an active session.
 * 2. Conversation Top Header quick-open button (`conversation.session.header.actions`)
 *    — always visible in every chat header; opens the Magic Memory Right-Sidebar tab beside the chat.
 * 3. Right-Sidebar Tab type + Guide capsule (`sidebarRightTabs` + `sidebar.right.pane.tab`)
 *    — docked or floating session-scoped dashboard with live refresh command binding.
 *
 * Built via `scripts/build.mjs` into `dist/client.js` with ONLY `require('react')`
 * externalized and zero runtime coupling to internal DSH client UI packages.
 */

import React, { useCallback } from 'react'
import { MagicMemoryApi, createFetchTransport } from './api.js'
import { MagicMemoryIcon, MemoryPanel } from './components/MemoryPanel.js'
import {
  EN_DICT,
  MAGIC_MEMORY_NS,
  ZH_DICT,
  createFallbackTranslator,
  type MagicMemoryLocaleKey,
  type TranslateFn,
} from './locales.js'
import { ensureMagicMemoryStyles } from './styles.js'

export const name = 'dsh-magic-memory'
export const inject = ['slots', 'locale'] as const

export const TAB_ID = 'dsh-magic-memory'
export const TAB_KIND = 'magic-memory'

interface ClientLocaleServiceLike {
  register(ns: string, dictsOrLocale: Record<string, Record<string, string>> | string, dict?: Record<string, string>): () => void
  bind(ns: string): (key: string, params?: Record<string, unknown>) => string
}

interface SidebarRightTabRegistryLike {
  register(definition: {
    readonly id: string
    readonly kind: string
    readonly priority?: 'extension' | 'builtin' | 'fallback'
    readonly keepMounted?: boolean
    readonly title: (address: string) => string
    readonly guide?: readonly {
      readonly id: string
      readonly order: number
      readonly title: () => string
      readonly description?: () => string
      readonly icon?: React.ComponentType<{ size?: number; className?: string }>
    }[]
  }): () => void
}

interface SidebarRightControllerLike {
  openTab(kind: string, options?: Record<string, unknown>): void
}

interface SlotsServiceLike {
  register(
    options: {
      name: string
      key?: string
      id?: string
      order?: number
      locale?: string
      label?: () => string
      inject?: (...args: unknown[]) => Record<string, unknown>
    },
    component: React.ComponentType<SlotComponentProps>,
  ): () => void
  inject?: (slotName: string, factory: () => () => void) => () => void
}

interface ClientContextLike {
  slots: SlotsServiceLike
  sidebarRightTabs?: SidebarRightTabRegistryLike
  sidebarRight?: SidebarRightControllerLike
  locale?: ClientLocaleServiceLike
  effect(fn: () => (() => void) | void, label?: string): void
  inject?: (deps: readonly string[], callback: (childCtx: ClientContextLike) => void) => void
}

interface TabInfoLike {
  tab?: {
    actions?: {
      bindCommands?: (commands: { refresh?: () => void }) => () => void
    }
  }
}

interface SlotComponentProps {
  sessionId?: string
  size?: number
  active?: boolean
  t?: (key: string, params?: Record<string, unknown>) => string
  api?: MagicMemoryApi
  /** Real DSH SlotRenderer binds slot `hooks.tabInfo` onto `props.useTabInfo`. */
  useTabInfo?: () => TabInfoLike
  /** Fallback for unit tests passing raw `hooks.tabInfo`. */
  hooks?: {
    tabInfo?: () => TabInfoLike
  }
}

function registerIntoSlot(
  slots: SlotsServiceLike,
  slotName: string,
  registerFn: () => () => void,
): () => void {
  if (typeof slots.inject === 'function') {
    return slots.inject(slotName, registerFn)
  }
  return registerFn()
}

export function apply(ctx: ClientContextLike): void {
  ensureMagicMemoryStyles()

  const api = new MagicMemoryApi(createFetchTransport())

  // Register bilingual dictionaries on DSH's client locale service
  let boundTranslate: TranslateFn = createFallbackTranslator('en')
  if (ctx.locale) {
    ctx.effect(() => {
      try {
        return ctx.locale!.register(MAGIC_MEMORY_NS, { en: { ...EN_DICT }, zh: { ...ZH_DICT } })
      } catch {
        // Fallback for older/custom mocks using 3-arg register(ns, locale, dict)
        const disposeEn = ctx.locale!.register(MAGIC_MEMORY_NS, 'en', { ...EN_DICT })
        const disposeZh = ctx.locale!.register(MAGIC_MEMORY_NS, 'zh', { ...ZH_DICT })
        return () => {
          disposeZh()
          disposeEn()
        }
      }
    }, 'dsh-magic-memory: locales')

    const rawBind = ctx.locale.bind(MAGIC_MEMORY_NS)
    boundTranslate = (key: MagicMemoryLocaleKey, params?: Record<string, unknown>) => rawBind(key, params)
  }

  // ── Surface 1: Left Navigation Sidebar (`sidebar.panellist`) + Full-Page Dashboard (`main`) ──
  const SidebarNavIcon: React.FC<SlotComponentProps> = ({ size = 16 }) => (
    <MagicMemoryIcon size={size} />
  )

  const MainDashboardPage: React.FC<SlotComponentProps> = (props) => {
    const translate: TranslateFn = props.t
      ? (key, params) => props.t!(key, params)
      : boundTranslate
    return (
      <MemoryPanel
        api={props.api ?? api}
        sessionId={props.sessionId}
        t={translate}
        variant="page"
      />
    )
  }

  ctx.effect(() => {
    const disposeMain = registerIntoSlot(ctx.slots, 'main', () =>
      ctx.slots.register(
        {
          name: 'main',
          key: TAB_ID,
          locale: MAGIC_MEMORY_NS,
          inject: () => ({ api }),
        },
        MainDashboardPage,
      ),
    )
    const disposeNav = registerIntoSlot(ctx.slots, 'sidebar.panellist', () =>
      ctx.slots.register(
        {
          name: 'sidebar.panellist',
          id: TAB_ID,
          order: 35,
          locale: MAGIC_MEMORY_NS,
          label: () => boundTranslate('nav.panelLabel'),
        },
        SidebarNavIcon,
      ),
    )
    return () => {
      disposeNav()
      disposeMain()
    }
  }, 'dsh-magic-memory: left sidebar panel')

  // ── Surface 2: Right-Sidebar Tab + Guide Capsule (`sidebarRightTabs` + `sidebar.right.pane.tab`) ──
  const RightSidebarTabBody: React.FC<SlotComponentProps> = (props) => {
    const readTabInfo = props.useTabInfo ?? props.hooks?.tabInfo
    const tabInfo = readTabInfo ? readTabInfo() : undefined
    const bindRefreshCommand = useCallback(
      (refresh: () => void) => {
        const bind = tabInfo?.tab?.actions?.bindCommands
        return bind ? bind({ refresh }) : () => {}
      },
      [tabInfo],
    )
    const translate: TranslateFn = props.t
      ? (key, params) => props.t!(key, params)
      : boundTranslate

    return (
      <MemoryPanel
        api={props.api ?? api}
        sessionId={props.sessionId}
        t={translate}
        variant="sidebar"
        bindRefreshCommand={bindRefreshCommand}
      />
    )
  }

  const mountRightSidebar = (srCtx: ClientContextLike): void => {
    if (!srCtx.sidebarRightTabs) return
    srCtx.effect(() => {
      const disposeType = srCtx.sidebarRightTabs!.register({
        id: TAB_ID,
        kind: TAB_KIND,
        priority: 'extension',
        keepMounted: false,
        title: () => boundTranslate('tab.title'),
        guide: [
          {
            id: 'magic-memory',
            order: 35,
            title: () => boundTranslate('guide.title'),
            description: () => boundTranslate('guide.description'),
            icon: MagicMemoryIcon,
          },
        ],
      })
      const disposeBody = registerIntoSlot(srCtx.slots, 'sidebar.right.pane.tab', () =>
        srCtx.slots.register(
          {
            name: 'sidebar.right.pane.tab',
            key: TAB_ID,
            locale: MAGIC_MEMORY_NS,
            inject: () => ({ api }),
          },
          RightSidebarTabBody,
        ),
      )
      return () => {
        disposeBody()
        disposeType()
      }
    }, 'dsh-magic-memory: right sidebar tab')
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['sidebarRightTabs'], mountRightSidebar)
  } else if (ctx.sidebarRightTabs) {
    mountRightSidebar(ctx)
  }

  // ── Surface 3: Conversation Top Header Quick-Open Button (`conversation.session.header.actions`) ──
  const mountHeaderAction = (hdrCtx: ClientContextLike): void => {
    if (!hdrCtx.sidebarRight) return
    const HeaderActionButton: React.FC<SlotComponentProps> = (props) => {
      const translate: TranslateFn = props.t
        ? (key, params) => props.t!(key, params)
        : boundTranslate
      const label = translate('header.openSidebar')
      return (
        <button
          type="button"
          className="dmm-header-action-btn"
          title={label}
          aria-label={label}
          onClick={() => {
            hdrCtx.sidebarRight?.openTab(TAB_KIND)
          }}
        >
          <MagicMemoryIcon size={15} />
          <span>{translate('tab.title')}</span>
        </button>
      )
    }

    hdrCtx.effect(() =>
      registerIntoSlot(hdrCtx.slots, 'conversation.session.header.actions', () =>
        hdrCtx.slots.register(
          {
            name: 'conversation.session.header.actions',
            id: TAB_ID,
            order: 45,
            locale: MAGIC_MEMORY_NS,
          },
          HeaderActionButton,
        ),
      ),
    'dsh-magic-memory: conversation header button')
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['sidebarRight'], mountHeaderAction)
  } else if (ctx.sidebarRight) {
    mountHeaderAction(ctx)
  }
}

export { MagicMemoryApi, MemoryPanel, MagicMemoryIcon, EN_DICT, ZH_DICT, MAGIC_MEMORY_NS }
