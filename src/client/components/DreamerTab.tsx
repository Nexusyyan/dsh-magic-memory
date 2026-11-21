import React, { useState } from 'react'
import type { DreamRunRecord, DreamTaskName, DreamTaskScheduleState } from '../../shared/types.js'
import type { MagicMemoryApi } from '../api.js'
import type { MagicMemoryLocaleKey, TranslateFn } from '../locales.js'

export interface DreamerTabProps {
  api: MagicMemoryApi
  projectId: string
  enabled: boolean
  tasks: readonly DreamTaskScheduleState[]
  recentRuns: readonly DreamRunRecord[]
  t: TranslateFn
  onMutated: () => void
  onError: (msg: string) => void
  onNotice: (msg: string) => void
}

function statusClass(status: string): string {
  if (status === 'success') return 'dmm-badge dmm-badge-ok'
  if (status === 'failed') return 'dmm-badge dmm-badge-danger'
  if (status === 'skipped') return 'dmm-badge dmm-badge-warn'
  return 'dmm-badge'
}

function formatTime(ts: number | null, neverLabel: string): string {
  if (ts === null) return neverLabel
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(ts)
  }
}

export function DreamerTab({
  api,
  projectId,
  enabled,
  tasks,
  recentRuns,
  t,
  onMutated,
  onError,
  onNotice,
}: DreamerTabProps): React.ReactElement {
  const [runningTask, setRunningTask] = useState<string | null>(null)

  const runDream = async (taskName?: DreamTaskName) => {
    const label = taskName ?? 'ALL'
    setRunningTask(label)
    try {
      const res = await api.runDreamer({ projectId, taskName })
      const okCount = res.runs.filter(r => r.status === 'success').length
      const failCount = res.runs.filter(r => r.status === 'failed').length
      onNotice(
        `Dreamer (${label}) finished: ${okCount} succeeded, ${res.runs.length - okCount - failCount} skipped, ${failCount} failed.`,
      )
      onMutated()
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunningTask(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="dmm-row-between">
        <div className="dmm-row">
          <span className="dmm-section-title">{t('dreamer.title')}</span>
          <span className={enabled ? 'dmm-badge dmm-badge-ok' : 'dmm-badge dmm-badge-warn'}>
            {enabled ? t('dreamer.enabled') : t('dreamer.disabled')}
          </span>
        </div>
        <button
          type="button"
          className="dmm-btn dmm-btn-primary"
          disabled={runningTask !== null}
          onClick={() => void runDream()}
        >
          {runningTask === 'ALL' ? t('dreamer.running') : t('dreamer.runAll')}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tasks.map(task => {
          const labelKey = `dreamer.task.${task.taskName}` as MagicMemoryLocaleKey
          return (
            <div key={task.taskName} className="dmm-card">
              <div className="dmm-row-between">
                <div>
                  <strong>{t(labelKey)}</strong>{' '}
                  <span className="dmm-badge">{task.taskName}</span>
                </div>
                <button
                  type="button"
                  className="dmm-btn"
                  disabled={runningTask !== null}
                  onClick={() => void runDream(task.taskName)}
                >
                  {runningTask === task.taskName ? t('dreamer.running') : t('dreamer.runOne')}
                </button>
              </div>
              <div className="dmm-meta">
                <span>{t('dreamer.backlog', { count: task.backlogCount })}</span>
                <span>·</span>
                <span>
                  {task.intervalMinutes > 0
                    ? t('dreamer.interval', { minutes: task.intervalMinutes })
                    : t('dreamer.intervalOff')}
                </span>
                <span>·</span>
                <span>{t('dreamer.lastRun', { time: formatTime(task.lastRunAt, t('dreamer.never')) })}</span>
                <span className={statusClass(task.lastStatus)}>{task.lastStatus}</span>
                {task.consecutiveFailures > 0 && (
                  <span className="dmm-badge dmm-badge-danger">
                    {t('dreamer.failures', { count: task.consecutiveFailures })}
                  </span>
                )}
              </div>
              {task.lastError && (
                <div style={{ fontSize: 11.5, color: 'var(--dmm-danger)' }}>{task.lastError}</div>
              )}
            </div>
          )
        })}
      </div>

      <span className="dmm-section-title">{t('dreamer.recentRuns')}</span>

      {recentRuns.length === 0 ? (
        <div className="dmm-empty">{t('dreamer.noRuns')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {recentRuns.map(run => (
            <div key={run.id} className="dmm-card">
              <div className="dmm-row-between">
                <div className="dmm-row">
                  <span className="dmm-badge">{run.taskName}</span>
                  <span className={statusClass(run.status)}>{run.status}</span>
                  <span className="dmm-badge">{run.trigger}</span>
                </div>
                <span className="dmm-meta">{run.durationMs}ms</span>
              </div>
              <div className="dmm-card-content">{run.errorMessage ?? run.summary}</div>
              <div className="dmm-meta">
                <span>processed: {run.itemsProcessed}</span>
                <span>·</span>
                <span>mutations: {run.mutationsApplied}</span>
                {run.modelUsed && (
                  <>
                    <span>·</span>
                    <span>model: {run.modelUsed}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
