/**
 * Multi-process SQLite lease manager for Dreamer conflict domains and session extraction.
 * Uses `BEGIN IMMEDIATE` transactions, PID liveness checks, and heartbeat renewal so
 * multiple DSH profiles/processes sharing one `memory.db` never race each other.
 */

import { randomUUID } from 'node:crypto'
import type { MemoryDatabase } from './database.js'

export const DEFAULT_LEASE_TTL_MS = 120_000
export const DEFAULT_LEASE_HEARTBEAT_MS = 60_000

export interface LeaseHandle {
  readonly leaseKey: string
  readonly ownerId: string
  readonly ownerPid: number
  renew(ttlMs?: number): boolean
  isHeld(): boolean
  release(): void
}

/** Check whether a local process PID is provably dead (`ESRCH`). */
export function isPidDefinitelyDead(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return true
  if (pid === process.pid) return false
  try {
    process.kill(pid, 0)
    return false
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code
    // ESRCH means process does not exist; EPERM means it exists under another user
    return code === 'ESRCH'
  }
}

export class LeaseManager {
  constructor(private readonly storage: MemoryDatabase) {}

  acquire(
    leaseKey: string,
    ttlMs: number = DEFAULT_LEASE_TTL_MS,
    ownerId: string = randomUUID(),
    ownerPid: number = process.pid,
  ): LeaseHandle | null {
    const now = Date.now()
    const expiresAt = now + ttlMs

    const acquired = this.storage.transaction(() => {
      const existing = this.storage.db
        .prepare('SELECT owner_id, owner_pid, expires_at FROM leases WHERE lease_key = ?')
        .get(leaseKey) as { owner_id: string; owner_pid: number; expires_at: number } | undefined

      if (existing) {
        const expired = existing.expires_at <= now
        const dead = isPidDefinitelyDead(existing.owner_pid)
        if (!expired && !dead) {
          return false
        }
        this.storage.db.prepare('DELETE FROM leases WHERE lease_key = ?').run(leaseKey)
      }

      this.storage.db
        .prepare(
          'INSERT INTO leases (lease_key, owner_id, owner_pid, expires_at, heartbeat_at) VALUES (?, ?, ?, ?, ?)',
        )
        .run(leaseKey, ownerId, ownerPid, expiresAt, now)
      return true
    })

    if (!acquired) return null

    return {
      leaseKey,
      ownerId,
      ownerPid,
      renew: (nextTtl = ttlMs) => this.renew(leaseKey, ownerId, nextTtl),
      isHeld: () => this.isHeld(leaseKey, ownerId),
      release: () => this.release(leaseKey, ownerId),
    }
  }

  renew(leaseKey: string, ownerId: string, ttlMs: number = DEFAULT_LEASE_TTL_MS): boolean {
    const now = Date.now()
    const res = this.storage.transaction(() =>
      this.storage.db
        .prepare('UPDATE leases SET expires_at = ?, heartbeat_at = ? WHERE lease_key = ? AND owner_id = ?')
        .run(now + ttlMs, now, leaseKey, ownerId),
    )
    return Number(res.changes) > 0
  }

  isHeld(leaseKey: string, ownerId: string): boolean {
    const now = Date.now()
    const row = this.storage.db
      .prepare('SELECT owner_id, expires_at FROM leases WHERE lease_key = ?')
      .get(leaseKey) as { owner_id: string; expires_at: number } | undefined
    return row !== undefined && row.owner_id === ownerId && row.expires_at > now
  }

  release(leaseKey: string, ownerId: string): void {
    try {
      this.storage.transaction(() => {
        this.storage.db
          .prepare('DELETE FROM leases WHERE lease_key = ? AND owner_id = ?')
          .run(leaseKey, ownerId)
      })
    } catch {
      // Best-effort release on shutdown
    }
  }

  /**
   * Execute a write transaction ONLY if this caller still owns the lease.
   * Returns `{ ok: true, value }` or `{ ok: false, reason: 'lease_lost' }`.
   */
  runLeaseGuardedWrite<T>(
    lease: LeaseHandle,
    writeFn: () => T,
  ): { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: 'lease_lost' } {
    return this.storage.transaction(() => {
      if (!this.isHeld(lease.leaseKey, lease.ownerId)) {
        return { ok: false as const, reason: 'lease_lost' as const }
      }
      const value = writeFn()
      return { ok: true as const, value }
    })
  }

  /** Clean expired or dead-PID leases (used by `/ctx-memory doctor`). */
  cleanupStaleLeases(): { active: number; cleaned: number } {
    const now = Date.now()
    return this.storage.transaction(() => {
      const rows = this.storage.db
        .prepare('SELECT lease_key, owner_pid, expires_at FROM leases')
        .all() as { lease_key: string; owner_pid: number; expires_at: number }[]
      let cleaned = 0
      for (const row of rows) {
        if (row.expires_at <= now || isPidDefinitelyDead(row.owner_pid)) {
          this.storage.db.prepare('DELETE FROM leases WHERE lease_key = ?').run(row.lease_key)
          cleaned += 1
        }
      }
      return { active: rows.length - cleaned, cleaned }
    })
  }
}
