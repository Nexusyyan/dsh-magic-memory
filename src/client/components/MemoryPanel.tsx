import React, { useCallback, useEffect, useState } from 'react'
import type { MagicMemoryOverview, ProjectRecord } from '../../shared/types.js'
import type { MagicMemoryApi } from '../api.js'
import { createFallbackTranslator, type TranslateFn } from '../locales.js'
import { ensureMagicMemoryStyles } from '../styles.js'
import { DreamerTab } from './DreamerTab.js'
import { EpisodesNotesTab } from './EpisodesNotesTab.js'
import { MemoriesTab } from './MemoriesTab.js'
import { SelectMenu } from './SelectMenu.js'
import { SettingsTab } from './SettingsTab.js'
import { TelemetryTab } from './TelemetryTab.js'
import { FolderMiniIcon, RefreshIcon, SettingsIcon } from './ui-helpers.js'

export type PanelTabKey = 'memories' | 'episodes' | 'dreamer' | 'telemetry' | 'settings'

export interface MemoryPanelProps {
  api: MagicMemoryApi
  sessionId?: string
  t?: TranslateFn
  variant?: 'sidebar' | 'page'
  bindRefreshCommand?: (refresh: () => void) => () => void
}

export function MagicMemoryIcon({ size = 16, className }: { size?: number; className?: string }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" opacity="0.3" />
      <path d="M12 3a9 9 0 0 1 8.5 6" />
      <path d="M20.5 15A9 9 0 0 1 12 21a9 9 0 0 1-8.5-6" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 6v3M12 15v3M6 12h3M15 12h3" />
    </svg>
  )
}

const DEFAULT_T = createFallbackTranslator('en')

export function MemoryPanel({
  api,
  sessionId,
  t = DEFAULT_T,
  variant = 'sidebar',
  bindRefreshCommand,
}: MemoryPanelProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<PanelTabKey>('memories')
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined)
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [overview, setOverview] = useState<MagicMemoryOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    ensureMagicMemoryStyles()
  }, [])

  const triggerRefresh = useCallback(() => {
    setRefreshToken(n => n + 1)
  }, [])

  useEffect(() => {
    if (!bindRefreshCommand) return
    return bindRefreshCommand(triggerRefresh)
  }, [bindRefreshCommand, triggerRefresh])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    api
      .getOverview({ projectId: selectedProjectId, sessionId }, controller.signal)
      .then(res => {
        if (controller.signal.aborted) return
        setOverview(res.overview)
        setProjects(res.projects)
        setError(null)
        if (!selectedProjectId && res.overview.project?.projectId) {
          setSelectedProjectId(res.overview.project.projectId)
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [api, selectedProjectId, sessionId, refreshToken])

  const handleError = useCallback((msg: string) => {
    setError(msg)
  }, [])

  const handleNotice = useCallback((msg: string) => {
    setNotice(msg)
    setError(null)
  }, [])

  const activeProjectId = selectedProjectId ?? overview?.project?.projectId ?? ''

  const panel = (
    <div className="dmm-root" data-testid="magic-memory-panel" data-variant={variant}>
      <header className="dmm-header">
        <div className="dmm-title-block">
          <div className="dmm-title-group">
            <span className="dmm-title-icon">
              <MagicMemoryIcon size={variant === 'page' ? 17 : 15} />
            </span>
            <span className="dmm-title">{t('tab.title')}</span>
          </div>
          {variant === 'page' && <p className="dmm-subtitle">{t('header.subtitle')}</p>}
        </div>

        <div className="dmm-header-controls">
          {projects.length > 0 && (
            <SelectMenu
              ariaLabel={t('header.project')}
              value={activeProjectId}
              compact
              align="right"
              leadingIcon={<FolderMiniIcon size={13} />}
              options={projects.map(p => ({
                value: p.projectId,
                label: p.displayName,
                sublabel: p.canonicalRoot || undefined,
              }))}
              onChange={val => setSelectedProjectId(val)}
            />
          )}
          <button
            type="button"
            className="dmm-btn"
            disabled={loading}
            onClick={triggerRefresh}
          >
            <RefreshIcon size={13} spinning={loading} />
            <span>{loading ? t('header.loading') : t('header.refresh')}</span>
          </button>
        </div>
      </header>

      <nav className="dmm-tabs" role="tablist" aria-label="Magic Memory sections">
        <button
          type="button"
          role="tab"
          className="dmm-tab"
          aria-selected={activeTab === 'memories'}
          onClick={() => setActiveTab('memories')}
        >
          <span>{t('nav.memories')}</span>
          {overview && <span className="dmm-tab-count">{overview.activeMemoryCount + overview.globalProfileCount}</span>}
        </button>

        <button
          type="button"
          role="tab"
          className="dmm-tab"
          aria-selected={activeTab === 'episodes'}
          onClick={() => setActiveTab('episodes')}
        >
          <span>{t('nav.episodesNotes')}</span>
          {overview && <span className="dmm-tab-count">{overview.episodeCount + overview.activeNoteCount}</span>}
        </button>

        <button
          type="button"
          role="tab"
          className="dmm-tab"
          aria-selected={activeTab === 'dreamer'}
          onClick={() => setActiveTab('dreamer')}
        >
          <span>{t('nav.dreamer')}</span>
          {overview && (
            <span className="dmm-tab-count">
              {overview.dreamerTasks.reduce((acc, task) => acc + task.backlogCount, 0)}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          className="dmm-tab"
          aria-selected={activeTab === 'telemetry'}
          onClick={() => setActiveTab('telemetry')}
        >
          <span>{t('nav.telemetry')}</span>
        </button>

        <button
          type="button"
          role="tab"
          className="dmm-tab"
          aria-selected={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
        >
          <SettingsIcon size={13} />
          <span>{t('nav.settings')}</span>
        </button>
      </nav>

      {error && (
        <div className="dmm-banner dmm-banner-error" role="alert">
          <span>{error}</span>
          <button type="button" className="dmm-btn dmm-btn-ghost" onClick={() => setError(null)} aria-label="Dismiss error">
            ✕
          </button>
        </div>
      )}

      {notice && !error && (
        <div className="dmm-banner dmm-banner-info" role="status">
          <span>{notice}</span>
          <button type="button" className="dmm-btn dmm-btn-ghost" onClick={() => setNotice(null)} aria-label="Dismiss notice">
            ✕
          </button>
        </div>
      )}

      <main className="dmm-body">
        {!overview && loading ? (
          <div className="dmm-empty">
            <p className="dmm-empty-desc">{t('header.loading')}</p>
          </div>
        ) : activeTab === 'memories' ? (
          <MemoriesTab
            api={api}
            projectId={activeProjectId}
            sessionId={sessionId}
            t={t}
            refreshToken={refreshToken}
            onMutated={triggerRefresh}
            onError={handleError}
            onNotice={handleNotice}
          />
        ) : activeTab === 'episodes' ? (
          <EpisodesNotesTab
            api={api}
            projectId={activeProjectId}
            sessionId={sessionId}
            t={t}
            refreshToken={refreshToken}
            onMutated={triggerRefresh}
            onError={handleError}
            onNotice={handleNotice}
          />
        ) : activeTab === 'dreamer' ? (
          <DreamerTab
            api={api}
            projectId={activeProjectId}
            enabled={overview?.dreamerEnabled ?? false}
            tasks={overview?.dreamerTasks ?? []}
            recentRuns={overview?.recentDreamRuns ?? []}
            t={t}
            onMutated={triggerRefresh}
            onError={handleError}
            onNotice={handleNotice}
          />
        ) : activeTab === 'settings' ? (
          <SettingsTab
            api={api}
            projectId={activeProjectId}
            t={t}
            refreshToken={refreshToken}
            onMutated={triggerRefresh}
            onError={handleError}
            onNotice={handleNotice}
          />
        ) : overview ? (
          <TelemetryTab
            api={api}
            projectId={activeProjectId}
            sessionId={sessionId}
            overview={overview}
            t={t}
            onError={handleError}
            onNotice={handleNotice}
          />
        ) : (
          <div className="dmm-empty">
            <p className="dmm-empty-desc">{t('header.loading')}</p>
          </div>
        )}
      </main>
    </div>
  )

  return variant === 'page' ? <div className="dmm-page">{panel}</div> : panel
}
