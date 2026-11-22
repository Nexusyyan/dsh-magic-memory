import React, { useState } from 'react'
import { MEMORY_CATEGORIES, type DoctorCheckResult, type MagicMemoryOverview } from '../../shared/types.js'
import type { MagicMemoryApi } from '../api.js'
import type { TranslateFn } from '../locales.js'
import { ActivityEmptyIcon, CategoryDot, getCategoryLabel } from './ui-helpers.js'

export interface TelemetryTabProps {
  api: MagicMemoryApi
  projectId: string
  sessionId?: string
  overview: MagicMemoryOverview
  t: TranslateFn
  onError: (msg: string) => void
  onNotice: (msg: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function TelemetryTab({
  api,
  projectId,
  sessionId,
  overview,
  t,
  onError,
  onNotice,
}: TelemetryTabProps): React.ReactElement {
  const [doctor, setDoctor] = useState<DoctorCheckResult | null>(null)
  const [runningDoctor, setRunningDoctor] = useState(false)
  const [exportPreview, setExportPreview] = useState<{ format: 'markdown' | 'json'; content: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const sess = overview.session
  const deferRatio = sess && sess.totalSteps > 0 ? Math.round((sess.deferSteps / sess.totalSteps) * 100) : 100

  const handleQueueSync = async () => {
    if (!sessionId) return
    try {
      await api.requestSync({ projectId, sessionId })
      onNotice(t('telemetry.syncQueued'))
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDoctor = async () => {
    setRunningDoctor(true)
    try {
      const res = await api.runDoctor()
      setDoctor(res)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunningDoctor(false)
    }
  }

  const handleExport = async (format: 'markdown' | 'json') => {
    try {
      const res = await api.exportSnapshot({ projectId, format })
      setExportPreview(res)
      setCopied(false)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleCopy = async () => {
    if (!exportPreview) return
    try {
      await navigator.clipboard.writeText(exportPreview.content)
      setCopied(true)
    } catch {
      onError('Clipboard access unavailable in this browser context')
    }
  }

  const handleDownload = () => {
    if (!exportPreview) return
    const ext = exportPreview.format === 'json' ? 'json' : 'md'
    const mime = exportPreview.format === 'json' ? 'application/json' : 'text/markdown'
    const blob = new Blob([exportPreview.content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `magic-memory-${overview.project?.displayName ?? 'export'}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="dmm-stack">
      <div className="dmm-section-head">
        <h3 className="dmm-section-title">{t('telemetry.cacheTitle')}</h3>
        {sessionId && (
          <button type="button" className="dmm-btn" onClick={() => void handleQueueSync()}>
            {t('telemetry.queueSync')}
          </button>
        )}
      </div>

      {sess ? (
        <>
          <div className="dmm-stat-card">
            <div className="dmm-row-between">
              <span className="dmm-stat-label">{t('telemetry.deferRatio')}</span>
              <span className="dmm-badge dmm-badge-ok">{deferRatio}%</span>
            </div>
            <div className="dmm-progress" aria-label={t('telemetry.deferRatio')}>
              <div className="dmm-progress-fill" style={{ width: `${deferRatio}%` }} />
            </div>
          </div>

          <div className="dmm-stat-grid">
            <div className="dmm-stat-card">
              <div className="dmm-stat-label">{t('telemetry.totalSteps')}</div>
              <div className="dmm-stat-value">
                {sess.totalSteps} / {sess.deferSteps}
              </div>
            </div>
            <div className="dmm-stat-card">
              <div className="dmm-stat-label">{t('telemetry.reanchors')}</div>
              <div className="dmm-stat-value">{sess.reanchorCount}</div>
            </div>
            <div className="dmm-stat-card">
              <div className="dmm-stat-label">{t('telemetry.autoSearch')}</div>
              <div className="dmm-stat-value">{sess.autoSearchHits}</div>
            </div>
            <div className="dmm-stat-card">
              <div className="dmm-stat-label">{t('telemetry.injectedIds')}</div>
              <div className="dmm-stat-value">{sess.injectedMemoryIds.length}</div>
            </div>
          </div>
        </>
      ) : (
        <div className="dmm-empty">
          <div className="dmm-empty-icon">
            <ActivityEmptyIcon size={18} />
          </div>
          <p className="dmm-empty-desc">{t('telemetry.noSessionState')}</p>
        </div>
      )}

      <div className="dmm-section-head" style={{ marginTop: 4 }}>
        <h3 className="dmm-section-title">{t('telemetry.storageTitle')}</h3>
      </div>

      <div className="dmm-stat-grid">
        <div className="dmm-stat-card">
          <div className="dmm-stat-label">{t('telemetry.dbSize')}</div>
          <div className="dmm-stat-value">{formatBytes(overview.dbSizeBytes)}</div>
        </div>
        <div className="dmm-stat-card">
          <div className="dmm-stat-label">{t('telemetry.schemaVersion')}</div>
          <div className="dmm-stat-value">v{overview.schemaVersion}</div>
        </div>
        <div className="dmm-stat-card">
          <div className="dmm-stat-label">{t('telemetry.embeddingMode')}</div>
          <div className="dmm-stat-value" style={{ fontSize: 13.5, wordBreak: 'break-word' }}>
            {overview.embeddingProvider}
          </div>
        </div>
        <div className="dmm-stat-card">
          <div className="dmm-stat-label">{t('telemetry.embeddingCoverage')}</div>
          <div className="dmm-stat-value">
            {overview.embeddedMemoryCount} / {overview.activeMemoryCount}
          </div>
        </div>
      </div>

      <div className="dmm-section-head" style={{ marginTop: 4 }}>
        <h3 className="dmm-section-title">{t('telemetry.categoriesTitle')}</h3>
      </div>

      <div className="dmm-card">
        <div className="dmm-dist-grid">
          {MEMORY_CATEGORIES.map(cat => (
            <div key={cat} className="dmm-dist-item" title={cat}>
              <span className="dmm-row" style={{ gap: 6 }}>
                <CategoryDot category={cat} />
                <span>{getCategoryLabel(t, cat)}</span>
              </span>
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{overview.countsByCategory[cat] ?? 0}</strong>
            </div>
          ))}
        </div>
        <div className="dmm-meta" style={{ wordBreak: 'break-all' }}>
          <span className="dmm-meta-files">{overview.dbPath}</span>
        </div>
      </div>

      <div className="dmm-section-head" style={{ marginTop: 4 }}>
        <h3 className="dmm-section-title">{t('telemetry.toolsTitle')}</h3>
      </div>

      <div className="dmm-row">
        <button type="button" className="dmm-btn" disabled={runningDoctor} onClick={() => void handleDoctor()}>
          {t('telemetry.doctor')}
        </button>
        <button type="button" className="dmm-btn" onClick={() => void handleExport('markdown')}>
          {t('telemetry.exportMd')}
        </button>
        <button type="button" className="dmm-btn" onClick={() => void handleExport('json')}>
          {t('telemetry.exportJson')}
        </button>
      </div>

      {doctor && (
        <div className="dmm-card">
          <div className="dmm-row-between">
            <span className="dmm-card-title">{doctor.ok ? t('telemetry.doctorOk') : t('telemetry.doctorWarn')}</span>
            <span className={doctor.ok ? 'dmm-badge dmm-badge-ok' : 'dmm-badge dmm-badge-warn'}>
              {doctor.journalMode.toUpperCase()}
            </span>
          </div>
          <div className="dmm-meta">
            <span>FTS5: {doctor.ftsConsistent ? 'OK' : 'Rebuilt'}</span>
            <span>Active leases: {doctor.activeLeases}</span>
            <span>Stale cleaned: {doctor.staleLeasesCleaned}</span>
          </div>
          {doctor.warnings.length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: 16, color: 'var(--dmm-warn)', fontSize: 12 }}>
              {doctor.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {exportPreview && (
        <div className="dmm-card">
          <div className="dmm-row-between">
            <span className="dmm-card-title">Export ({exportPreview.format})</span>
            <div className="dmm-row">
              <button type="button" className="dmm-btn dmm-btn-sm" onClick={() => void handleCopy()}>
                {copied ? t('telemetry.copied') : t('telemetry.copy')}
              </button>
              <button type="button" className="dmm-btn dmm-btn-sm" onClick={handleDownload}>
                {t('telemetry.download')}
              </button>
              <button type="button" className="dmm-btn dmm-btn-ghost" onClick={() => setExportPreview(null)}>
                {t('telemetry.close')}
              </button>
            </div>
          </div>
          <pre className="dmm-pre">{exportPreview.content}</pre>
        </div>
      )}
    </div>
  )
}
