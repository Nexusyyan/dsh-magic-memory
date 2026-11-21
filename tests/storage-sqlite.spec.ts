import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryDatabase } from '../src/storage/database.js'
import { LeaseManager, isPidDefinitelyDead } from '../src/storage/leases.js'
import { LATEST_SUPPORTED_VERSION, SchemaFenceError } from '../src/storage/migrations.js'
import { ProjectIdentityResolver, normalizeCanonicalPath } from '../src/storage/project-identity.js'

const tempDirs: string[] = []

function makeTempDir(prefix = 'dmm-storage-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('MemoryDatabase (node:sqlite WAL, migrations, savepoints, schema fence)', () => {
  it('opens file-backed SQLite in WAL mode with V1 schema & FTS5 tables', () => {
    const dir = makeTempDir()
    const dbPath = join(dir, 'nested', 'memory.db')
    const storage = new MemoryDatabase(dbPath)
    try {
      expect(storage.schemaVersion).toBe(LATEST_SUPPORTED_VERSION)
      expect(storage.getCurrentSchemaVersion()).toBe(LATEST_SUPPORTED_VERSION)
      expect(storage.getJournalMode().toLowerCase()).toBe('wal')
      expect(storage.getFileSizeBytes()).toBeGreaterThan(0)

      const tables = storage.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all()
        .map(r => String(r['name']))
      expect(tables).toEqual(
        expect.arrayContaining([
          'schema_meta',
          'projects',
          'workspaces',
          'workspace_members',
          'memories',
          'memory_fts',
          'memory_embeddings',
          'memory_mutation_log',
          'session_episodes',
          'episode_fts',
          'notes',
          'note_fts',
          'session_highlights',
          'session_highlights_fts',
          'user_observations',
          'session_memory_state',
          'dream_runs',
          'dream_task_schedule',
          'leases',
        ]),
      )
    } finally {
      storage.close()
      expect(storage.isClosed()).toBe(true)
    }
  })

  it('throws SchemaFenceError when opening a database created by a newer plugin version', () => {
    const dir = makeTempDir()
    const dbPath = join(dir, 'future.db')
    const raw = new DatabaseSync(dbPath)
    raw.exec(`
      CREATE TABLE schema_meta (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        version INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO schema_meta (singleton, version, updated_at) VALUES (1, 999, 0);
    `)
    raw.close()

    expect(() => new MemoryDatabase(dbPath)).toThrowError(SchemaFenceError)
  })

  it('supports nested transactions via SAVEPOINT with independent inner rollback', () => {
    const storage = new MemoryDatabase(':memory:')
    try {
      const now = Date.now()
      storage.transaction(() => {
        storage.db
          .prepare(
            'INSERT INTO projects (project_id, display_name, canonical_root, memory_epoch, last_active_at, created_at) VALUES (?, ?, ?, 1, ?, ?)',
          )
          .run('proj-outer', 'Outer', '/outer', now, now)

        expect(() =>
          storage.transaction(() => {
            storage.db
              .prepare(
                'INSERT INTO projects (project_id, display_name, canonical_root, memory_epoch, last_active_at, created_at) VALUES (?, ?, ?, 1, ?, ?)',
              )
              .run('proj-inner', 'Inner', '/inner', now, now)
            throw new Error('inner rollback')
          }),
        ).toThrow('inner rollback')
      })

      const outer = storage.db.prepare('SELECT project_id FROM projects WHERE project_id = ?').get('proj-outer')
      const inner = storage.db.prepare('SELECT project_id FROM projects WHERE project_id = ?').get('proj-inner')
      expect(outer?.['project_id']).toBe('proj-outer')
      expect(inner).toBeUndefined()
    } finally {
      storage.close()
    }
  })
})

describe('ProjectIdentityResolver (cross-platform paths & Git worktrees)', () => {
  it('normalizes Windows drive-letter, backslashes, and trailing slashes identically', async () => {
    const normA = normalizeCanonicalPath('C:\\Users\\Dev\\MyRepo\\')
    const normB = normalizeCanonicalPath('c:/Users/Dev/MyRepo')
    expect(normA).toBe('c:/Users/Dev/MyRepo')
    expect(normB).toBe('c:/Users/Dev/MyRepo')

    const resolver = new ProjectIdentityResolver()
    const dir = makeTempDir()
    const res1 = await resolver.resolve(dir)
    const res2 = await resolver.resolve(join(dir, '/'))
    expect(res1.isGitRepo).toBe(false)
    expect(res1.projectId).toMatch(/^dir:[a-f0-9]{16}$/)
    expect(res1.projectId).toBe(res2.projectId)
  })

  it('resolves main Git repo, nested subdir, and Git worktree to the exact same git:<hash> identity', async () => {
    const root = makeTempDir('dmm-git-')
    const repoDir = join(root, 'main-repo')
    const subDir = join(repoDir, 'packages', 'core')
    const worktreeDir = join(root, 'feature-wt')
    mkdirSync(subDir, { recursive: true })

    execFileSync('git', ['init', '-b', 'main'], { cwd: repoDir, stdio: 'ignore' })
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir, stdio: 'ignore' })
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoDir, stdio: 'ignore' })
    writeFileSync(join(repoDir, 'README.md'), '# hello\n')
    execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', 'init'], { cwd: repoDir, stdio: 'ignore' })
    execFileSync('git', ['worktree', 'add', '-b', 'feat-branch', worktreeDir], { cwd: repoDir, stdio: 'ignore' })

    const resolver = new ProjectIdentityResolver()
    const idMain = await resolver.resolve(repoDir)
    const idSub = await resolver.resolve(subDir)
    const idWt = await resolver.resolve(worktreeDir)

    expect(idMain.isGitRepo).toBe(true)
    expect(idMain.projectId).toMatch(/^git:[a-f0-9]{16}$/)
    expect(idSub.projectId).toBe(idMain.projectId)
    expect(idWt.projectId).toBe(idMain.projectId)
    expect(realpathSync(idMain.canonicalRoot)).toBe(realpathSync(repoDir))
  })
})

describe('LeaseManager (multi-process contention, dead-PID takeover, guarded writes)', () => {
  it('enforces exclusive domain leases, allows renew/release, and takes over dead PIDs', () => {
    const storage = new MemoryDatabase(':memory:')
    try {
      const lm = new LeaseManager(storage)

      const leaseA = lm.acquire('dream:curate:p1', 30_000, 'owner-A')
      expect(leaseA).not.toBeNull()
      expect(lm.acquire('dream:curate:p1', 30_000, 'owner-B')).toBeNull()
      expect(leaseA!.isHeld()).toBe(true)
      expect(leaseA!.renew(60_000)).toBe(true)

      // Guarded write succeeds while held
      const guardedOk = lm.runLeaseGuardedWrite(leaseA!, () => 42)
      expect(guardedOk).toEqual({ ok: true, value: 42 })

      // Release allows owner-B to acquire, and stale handle A fails guarded write
      leaseA!.release()
      const leaseB = lm.acquire('dream:curate:p1', 30_000, 'owner-B')
      expect(leaseB).not.toBeNull()

      const guardedLost = lm.runLeaseGuardedWrite(leaseA!, () => 99)
      expect(guardedLost).toEqual({ ok: false, reason: 'lease_lost' })

      // Simulate a crashed process lease with definitely-dead PID (999999)
      const now = Date.now()
      storage.db
        .prepare(
          `INSERT INTO leases (lease_key, owner_id, owner_pid, expires_at, heartbeat_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run('dream:dead-test', 'dead-owner', 999999, now + 600_000, now)

      if (isPidDefinitelyDead(999999)) {
        const taken = lm.acquire('dream:dead-test', 30_000, 'owner-A')
        expect(taken).not.toBeNull()
        expect(taken!.isHeld()).toBe(true)
      }

      // Expired leases are cleaned up by cleanupStaleLeases
      storage.db
        .prepare(
          `INSERT INTO leases (lease_key, owner_id, owner_pid, expires_at, heartbeat_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run('dream:expired', 'old-owner', process.pid, now - 1, now - 10_000)
      const cleaned = lm.cleanupStaleLeases()
      expect(cleaned.cleaned).toBeGreaterThanOrEqual(1)
    } finally {
      storage.close()
    }
  })
})
