import React, { useState } from 'react'
import { MEMORY_CATEGORIES, type DoctorCheckResult, type MagicMemoryOverview } from '../../shared/types.js'
import type { MagicMemoryApi } from '../api.js'
import type { TranslateFn } from '../locales.js'

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="dmm-row-between">
        <span className="dmm-section-title">{t('telemetry.cacheTitle')}</span>
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
        <div className="dmm-empty">{t('telemetry.noSessionState')}</div>
      )}

      <span className="dmm-section-title">{t('telemetry.storageTitle')}</span>
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
          <div className="dmm-stat-value" style={{ fontSize: 12.5 }}>
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

      <span className="dmm-section-title">{t('telemetry.categoriesTitle')}</span>
      <div className="dmm-card">
        <div className="dmm-row">
          {MEMORY_CATEGORIES.map(cat => (
            <span key={cat} className="dmm-badge">
              {cat}: {overview.countsByCategory[cat] ?? 0}
            </span>
          ))}
        </div>
        <div className="dmm-meta" style={{ wordBreak: 'break-all' }}>
          DB: {overview.dbPath}
        </div>
      </div>

      <span className="dmm-section-title">{t('telemetry.toolsTitle')}</span>
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
            <strong>{doctor.ok ? t('telemetry.doctorOk') : t('telemetry.doctorWarn')}</strong>
            <span className={doctor.ok ? 'dmm-badge dmm-badge-ok' : 'dmm-badge dmm-badge-warn'}>
              {doctor.journalMode.toUpperCase()}
            </span>
          </div>
          <div className="dmm-meta">
            <span>FTS5: {doctor.ftsConsistent ? 'OK' : 'Rebuilt'}</span>
            <span>·</span>
            <span>Active leases: {doctor.activeLeases}</span>
            <span>·</span>
            <span>Stale cleaned: {doctor.staleLeasesCleaned}</span>
          </div>
          {doctor.warnings.length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: 16, color: 'var(--dmm-warn)' }}>
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
            <strong>Export ({exportPreview.format})</strong>
            <div className="dmm-row">
              <button type="button" className="dmm-btn" onClick={() => void handleCopy()}>
                {copied ? t('telemetry.copied') : t('telemetry.copy')}
              </button>
              <button type="button" className="dmm-btn" onClick={handleDownload}>
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
