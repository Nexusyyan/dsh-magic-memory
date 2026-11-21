/**
 * Process-wide Dreamer scheduler with conflict-domain leases, cheap backlog gates,
 * hot retries (up to 3x on failure), heartbeat renewal, and structured failure records.
 */

import type { Context } from '@deepseek-ai/cordis'
import { getDreamTaskIntervalMinutes } from '../config.js'
import type { MagicMemoryService } from '../service/memory-service.js'
import {
  DREAM_TASK_NAMES,
  GLOBAL_PROJECT_ID,
  type DreamRunRecord,
  type DreamTaskName,
} from '../shared/types.js'
import { DEFAULT_LEASE_HEARTBEAT_MS, DEFAULT_LEASE_TTL_MS } from '../storage/leases.js'
import { executeDreamTask } from './dreamer-tasks.js'

const MAX_TASK_RETRIES = 3

export function leaseKeyForDreamTask(projectId: string, taskName: DreamTaskName): string {
  if (taskName === 'review-user-memories') return 'dream:user-memories'
  return `dream:memory:${projectId}`
}

export class DreamerScheduler {
  private ticking = false
  private stopTimer: (() => void) | null = null

  constructor(
    private readonly ctx: Context,
    private readonly service: MagicMemoryService,
  ) {}

  /** Register the periodic timer as a reversible Cordis effect. */
  start(): void {
    this.ctx.effect(() => {
      const cfg = this.service.getConfig()
      const intervalMs = Math.max(60_000, cfg.dreamer.tickIntervalMinutes * 60_000)
      const timer = setInterval(() => {
        void this.tick().catch(err => {
          this.ctx.logger?.warn?.('[dsh-magic-memory] dreamer tick failed: %o', err)
        })
      }, intervalMs)
      // Do not keep Headless CLI processes alive waiting for background Dreamer ticks
      timer.unref?.()
      const cleanup = () => {
        clearInterval(timer)
        if (this.stopTimer === cleanup) this.stopTimer = null
      }
      this.stopTimer = cleanup
      return cleanup
    })
  }

  /** Stop the periodic timer explicitly if started. */
  stop(): void {
    this.stopTimer?.()
  }

  /** Run all due tasks across recently active projects whose cheap backlog gates pass. */
  async tick(signal?: AbortSignal): Promise<DreamRunRecord[]> {
    const cfg = this.service.getConfig()
    if (!cfg.enabled || !cfg.dreamer.enabled || this.ticking || this.service.storage.isClosed()) {
      return []
    }
    this.ticking = true
    const runs: DreamRunRecord[] = []
    try {
      const projects = this.service.listProjects().slice(0, 10)
      for (const proj of projects) {
        if (signal?.aborted || this.service.getLifecycleSignal().aborted) break
        const dueTasks = this.findDueTasks(proj.projectId)
        for (const taskName of dueTasks) {
          if (signal?.aborted || this.service.getLifecycleSignal().aborted) break
          const rec = await this.runSingleTask(proj.projectId, taskName, 'scheduled', signal)
          if (rec) runs.push(rec)
        }
      }

      // Global user-memories review
      if (!signal?.aborted && !this.service.getLifecycleSignal().aborted) {
        if (this.isTaskDue(GLOBAL_PROJECT_ID, 'review-user-memories')) {
          const rec = await this.runSingleTask(GLOBAL_PROJECT_ID, 'review-user-memories', 'scheduled', signal)
          if (rec) runs.push(rec)
        }
      }
      return runs
    } finally {
      this.ticking = false
    }
  }

  /** Manual execution (`/ctx-dream [task]` or Sidebar UI button). */
  async runManual(
    projectId: string,
    taskName?: DreamTaskName,
    signal?: AbortSignal,
  ): Promise<DreamRunRecord[]> {
    const tasks: readonly DreamTaskName[] = taskName ? [taskName] : DREAM_TASK_NAMES
    const results: DreamRunRecord[] = []
    for (const t of tasks) {
      if (signal?.aborted) break
      const targetProject = t === 'review-user-memories' ? GLOBAL_PROJECT_ID : projectId
      const rec = await this.runSingleTask(targetProject, t, 'manual', signal)
      if (rec) results.push(rec)
    }
    return results
  }

  private findDueTasks(projectId: string): DreamTaskName[] {
    const projectTasks: DreamTaskName[] = [
      'map-memories',
      'verify',
      'curate',
      'classify-memories',
      'retrospective',
    ]
    return projectTasks.filter(t => this.isTaskDue(projectId, t))
  }

  private isTaskDue(projectId: string, taskName: DreamTaskName): boolean {
    const cfg = this.service.getConfig()
    const intervalMinutes = getDreamTaskIntervalMinutes(cfg, taskName)
    if (intervalMinutes <= 0) return false
    if (taskName === 'review-user-memories' && !cfg.dreamer.userMemoriesEnabled) return false

    const backlog = this.service.computeTaskBacklog(projectId, taskName, cfg)
    if (backlog <= 0) return false

    const now = Date.now()
    const row = this.service.storage.db
      .prepare('SELECT next_due_at, consecutive_failures FROM dream_task_schedule WHERE project_id = ? AND task_name = ?')
      .get(projectId, taskName) as { next_due_at: number | null; consecutive_failures: number } | undefined

    if (!row) return true
    if (row.consecutive_failures > 0 && row.consecutive_failures < MAX_TASK_RETRIES) {
      return true
    }
    return row.next_due_at === null || row.next_due_at <= now
  }

  private async runSingleTask(
    projectId: string,
    taskName: DreamTaskName,
    trigger: 'scheduled' | 'manual',
    signal?: AbortSignal,
  ): Promise<DreamRunRecord | null> {
    const cfg = this.service.getConfig()
    const leaseKey = leaseKeyForDreamTask(projectId, taskName)

    // Scheduled ticks never wait on busy leases; manual runs briefly poll up to 10s
    let lease = this.service.leases.acquire(leaseKey, DEFAULT_LEASE_TTL_MS)
    if (!lease && trigger === 'manual') {
      const deadline = Date.now() + 10_000
      while (!lease && Date.now() < deadline && !signal?.aborted) {
        await new Promise(resolve => setTimeout(resolve, 250))
        lease = this.service.leases.acquire(leaseKey, DEFAULT_LEASE_TTL_MS)
      }
    }
    if (!lease) return null

    const startedAt = Date.now()
    const heartbeat = setInterval(() => {
      lease.renew(DEFAULT_LEASE_TTL_MS)
    }, DEFAULT_LEASE_HEARTBEAT_MS)
    heartbeat.unref?.()

    try {
      const combinedSignal = signal
        ? AbortSignal.any([signal, this.service.getLifecycleSignal()])
        : this.service.getLifecycleSignal()

      const outcome = await executeDreamTask({
        ctx: this.ctx,
        service: this.service,
        config: cfg,
        projectId,
        taskName,
        lease,
        signal: combinedSignal,
      })

      const finishedAt = Date.now()
      const durationMs = Math.max(0, finishedAt - startedAt)
      const intervalMs = Math.max(60_000, getDreamTaskIntervalMinutes(cfg, taskName) * 60_000)

      return this.recordRunAndSchedule({
        projectId,
        taskName,
        trigger,
        startedAt,
        finishedAt,
        durationMs,
        intervalMs,
        outcome,
      })
    } finally {
      clearInterval(heartbeat)
      lease.release()
    }
  }

  private recordRunAndSchedule(input: {
    readonly projectId: string
    readonly taskName: DreamTaskName
    readonly trigger: 'scheduled' | 'manual'
    readonly startedAt: number
    readonly finishedAt: number
    readonly durationMs: number
    readonly intervalMs: number
    readonly outcome: Awaited<ReturnType<typeof executeDreamTask>>
  }): DreamRunRecord {
    const { projectId, taskName, trigger, startedAt, finishedAt, durationMs, intervalMs, outcome } = input
    return this.service.storage.transaction(() => {
      const res = this.service.storage.db
        .prepare(
          `INSERT INTO dream_runs
             (project_id, task_name, status, trigger, summary, items_processed, mutations_applied,
              model_used, failure_class, error_message, duration_ms, started_at, finished_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          projectId,
          taskName,
          outcome.status,
          trigger,
          outcome.summary,
          outcome.itemsProcessed,
          outcome.mutationsApplied,
          outcome.modelUsed,
          outcome.failureClass,
          outcome.errorMessage,
          durationMs,
          startedAt,
          finishedAt,
        )

      const existing = this.service.storage.db
        .prepare('SELECT last_run_at, consecutive_failures FROM dream_task_schedule WHERE project_id = ? AND task_name = ?')
        .get(projectId, taskName) as { last_run_at: number | null; consecutive_failures: number } | undefined

      const prevFailures = existing?.consecutive_failures ?? 0
      const nextFailures = outcome.status === 'failed' ? prevFailures + 1 : 0
      // Stamp last_run_at from startedAt on success/skip so concurrent changes aren't skipped; never advance on failure
      const nextLastRunAt = outcome.status === 'failed' ? (existing?.last_run_at ?? null) : startedAt
      const nextDueAt = outcome.status === 'failed' && nextFailures < MAX_TASK_RETRIES
        ? finishedAt + 60_000
        : startedAt + intervalMs

      this.service.storage.db
        .prepare(
          `INSERT INTO dream_task_schedule
             (project_id, task_name, last_run_at, next_due_at, consecutive_failures, last_status, last_error, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(project_id, task_name) DO UPDATE SET
             last_run_at = excluded.last_run_at,
             next_due_at = excluded.next_due_at,
             consecutive_failures = excluded.consecutive_failures,
             last_status = excluded.last_status,
             last_error = excluded.last_error,
             updated_at = excluded.updated_at`,
        )
        .run(
          projectId,
          taskName,
          nextLastRunAt,
          nextDueAt,
          nextFailures,
          outcome.status,
          outcome.errorMessage,
          finishedAt,
        )

      return {
        id: Number(res.lastInsertRowid),
        projectId,
        taskName,
        status: outcome.status,
        trigger,
        summary: outcome.summary,
        itemsProcessed: outcome.itemsProcessed,
        mutationsApplied: outcome.mutationsApplied,
        modelUsed: outcome.modelUsed,
        failureClass: outcome.failureClass,
        errorMessage: outcome.errorMessage,
        durationMs,
        startedAt,
        finishedAt,
      }
    })
  }
}
