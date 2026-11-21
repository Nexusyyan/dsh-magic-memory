/**
 * Cross-platform SQLite connection wrapper over Node.js built-in `node:sqlite`.
 * Works identically on macOS (arm64/x64), Windows (x64), and Linux (x64/arm64)
 * with zero native addon compilation.
 */

import { mkdirSync, statSync, chmodSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { ensureSchema, LATEST_SUPPORTED_VERSION, readSchemaVersion } from './migrations.js'

export function resolveDefaultDbPath(): string {
  const dshHome = process.env.DSH_HOME && process.env.DSH_HOME.trim().length > 0
    ? process.env.DSH_HOME.trim()
    : join(homedir(), '.dsh')
  return join(dshHome, 'magic-memory', 'memory.db')
}

export class MemoryDatabase {
  readonly path: string
  readonly db: DatabaseSync
  readonly schemaVersion: number
  private txDepth = 0
  private closed = false

  constructor(dbPath?: string) {
    const resolvedPath = dbPath && dbPath.trim().length > 0
      ? (dbPath.trim() === ':memory:' ? ':memory:' : resolve(dbPath.trim()))
      : resolveDefaultDbPath()
    this.path = resolvedPath

    if (resolvedPath !== ':memory:') {
      const parentDir = dirname(resolvedPath)
      mkdirSync(parentDir, { recursive: true })
      if (process.platform !== 'win32') {
        try {
          chmodSync(parentDir, 0o700)
        } catch {
          // Non-fatal on restricted filesystems
        }
      }
    }

    const db = new DatabaseSync(resolvedPath)
    try {
      // busy_timeout must precede any schema read so concurrent hosts don't fail immediately
      db.exec('PRAGMA busy_timeout = 5000')
      db.exec('PRAGMA foreign_keys = ON')
      if (resolvedPath !== ':memory:') {
        db.exec('PRAGMA journal_mode = WAL')
        db.exec('PRAGMA synchronous = NORMAL')
      }
      this.schemaVersion = ensureSchema(db)
      this.db = db
    } catch (err) {
      try {
        db.close()
      } catch {
        // Ignore close error on failed init
      }
      throw err
    }
  }

  /**
   * Run a synchronous operation inside an immediate SQLite transaction.
   * Supports nested calls transparently via named SAVEPOINTs.
   */
  transaction<T>(fn: () => T): T {
    this.assertOpen()
    if (this.txDepth > 0) {
      const sp = `dmm_sp_${this.txDepth}`
      this.txDepth += 1
      this.db.exec(`SAVEPOINT ${sp}`)
      try {
        const result = fn()
        this.db.exec(`RELEASE SAVEPOINT ${sp}`)
        return result
      } catch (err) {
        try {
          this.db.exec(`ROLLBACK TO SAVEPOINT ${sp}`)
          this.db.exec(`RELEASE SAVEPOINT ${sp}`)
        } catch {
          // Ignore nested rollback failure
        }
        throw err
      } finally {
        this.txDepth -= 1
      }
    }

    this.txDepth = 1
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = fn()
      this.db.exec('COMMIT')
      return result
    } catch (err) {
      try {
        this.db.exec('ROLLBACK')
      } catch {
        // Ignore rollback failure
      }
      throw err
    } finally {
      this.txDepth = 0
    }
  }

  getJournalMode(): string {
    this.assertOpen()
    const row = this.db.prepare('PRAGMA journal_mode').get() as { journal_mode?: string } | undefined
    return row?.journal_mode ?? 'unknown'
  }

  getCurrentSchemaVersion(): number {
    this.assertOpen()
    return readSchemaVersion(this.db)
  }

  getFileSizeBytes(): number {
    if (this.path === ':memory:') return 0
    try {
      return statSync(this.path).size
    } catch {
      return 0
    }
  }

  isClosed(): boolean {
    return this.closed
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    try {
      this.db.close()
    } catch {
      // Idempotent close
    }
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('dsh-magic-memory database handle is already closed')
    }
  }
}

export { LATEST_SUPPORTED_VERSION }
