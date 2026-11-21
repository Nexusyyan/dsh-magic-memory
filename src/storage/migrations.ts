/**
 * SQLite schema & versioned migrations for dsh-magic-memory.
 * Uses Node.js built-in `node:sqlite` with FTS5 (`unicode61`) and zero native addons.
 */

import type { DatabaseSync } from 'node:sqlite'
import { GLOBAL_PROJECT_ID } from '../shared/types.js'

export const LATEST_SUPPORTED_VERSION = 1

export class SchemaFenceError extends Error {
  readonly code = 'SCHEMA_FENCE_UNSUPPORTED'
  readonly dbVersion: number
  readonly supportedVersion: number

  constructor(dbVersion: number, supportedVersion: number) {
    super(
      `dsh-magic-memory database schema version ${dbVersion} is newer than this build supports (${supportedVersion}). `
      + 'Upgrade dsh-magic-memory before opening this database.',
    )
    this.name = 'SchemaFenceError'
    this.dbVersion = dbVersion
    this.supportedVersion = supportedVersion
  }
}

const V1_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_meta (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  canonical_root TEXT NOT NULL,
  memory_epoch INTEGER NOT NULL DEFAULT 1,
  last_active_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  share_categories_json TEXT NOT NULL DEFAULT '["CONSTRAINTS"]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, project_id)
);

CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  search_tokens TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 50,
  scope TEXT NOT NULL DEFAULT 'project',
  status TEXT NOT NULL DEFAULT 'active',
  source_kind TEXT NOT NULL DEFAULT 'agent',
  source_session_id TEXT,
  backing_files_json TEXT NOT NULL DEFAULT '[]',
  mapping_origin TEXT NOT NULL DEFAULT 'unmapped',
  verification_state TEXT NOT NULL DEFAULT 'unverified',
  last_verified_at INTEGER,
  retrieval_count INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0,
  shareable INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER,
  superseded_by_id INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_project_status ON memories(project_id, status, category);
CREATE INDEX IF NOT EXISTS idx_memories_hash ON memories(project_id, category, content_hash);
CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope, status);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
  search_tokens,
  category UNINDEXED,
  project_id UNINDEXED,
  tokenize = 'unicode61'
);

CREATE TABLE IF NOT EXISTS memory_embeddings (
  target_kind TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  provider_model TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  dims INTEGER NOT NULL,
  vector_blob BLOB NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (target_kind, target_id)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_model ON memory_embeddings(provider_model);

CREATE TABLE IF NOT EXISTS memory_mutation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  memory_id INTEGER NOT NULL,
  op TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mutation_project_id ON memory_mutation_log(project_id, id);

CREATE TABLE IF NOT EXISTS session_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  start_seq INTEGER NOT NULL,
  end_seq INTEGER NOT NULL,
  episode_type TEXT NOT NULL DEFAULT 'work',
  importance INTEGER NOT NULL DEFAULT 50,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_decisions_json TEXT NOT NULL DEFAULT '[]',
  search_tokens TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_episodes_project ON session_episodes(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_session ON session_episodes(session_id, end_seq DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS episode_fts USING fts5(
  search_tokens,
  project_id UNINDEXED,
  tokenize = 'unicode61'
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  session_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  condition_expr TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  search_tokens TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_project_status ON notes(project_id, status);

CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(
  search_tokens,
  project_id UNINDEXED,
  tokenize = 'unicode61'
);

CREATE TABLE IF NOT EXISTS session_highlights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  search_tokens TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(session_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_highlights_project_time ON session_highlights(project_id, created_at DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS session_highlights_fts USING fts5(
  search_tokens,
  project_id UNINDEXED,
  tokenize = 'unicode61'
);

CREATE TABLE IF NOT EXISTS user_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  normalized_key TEXT NOT NULL UNIQUE,
  observation TEXT NOT NULL,
  evidence_sessions_json TEXT NOT NULL DEFAULT '[]',
  seen_count INTEGER NOT NULL DEFAULT 1,
  promoted_memory_id INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session_memory_state (
  session_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  is_subagent INTEGER NOT NULL DEFAULT 0,
  baseline_injected_at INTEGER,
  baseline_max_memory_id INTEGER NOT NULL DEFAULT 0,
  baseline_max_mutation_id INTEGER NOT NULL DEFAULT 0,
  baseline_profile_version INTEGER NOT NULL DEFAULT 0,
  injected_memory_ids_json TEXT NOT NULL DEFAULT '[]',
  last_compaction_seq INTEGER NOT NULL DEFAULT -1,
  last_extracted_seq INTEGER NOT NULL DEFAULT -1,
  pending_sync_requested INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0,
  defer_steps INTEGER NOT NULL DEFAULT 0,
  reanchor_count INTEGER NOT NULL DEFAULT 0,
  auto_search_hits INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dream_task_schedule (
  project_id TEXT NOT NULL,
  task_name TEXT NOT NULL,
  last_run_at INTEGER,
  next_due_at INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_status TEXT NOT NULL DEFAULT 'never',
  last_error TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, task_name)
);

CREATE TABLE IF NOT EXISTS dream_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  task_name TEXT NOT NULL,
  status TEXT NOT NULL,
  trigger TEXT NOT NULL,
  summary TEXT NOT NULL,
  items_processed INTEGER NOT NULL DEFAULT 0,
  mutations_applied INTEGER NOT NULL DEFAULT 0,
  model_used TEXT,
  failure_class TEXT,
  error_message TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dream_runs_project_time ON dream_runs(project_id, started_at DESC);

CREATE TABLE IF NOT EXISTS leases (
  lease_key TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  owner_pid INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  heartbeat_at INTEGER NOT NULL
);
`

export function readSchemaVersion(db: DatabaseSync): number {
  const tableRow = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_meta'")
    .get() as { name?: string } | undefined
  if (!tableRow?.name) return 0
  const row = db
    .prepare('SELECT version FROM schema_meta WHERE singleton = 1')
    .get() as { version?: number } | undefined
  return typeof row?.version === 'number' ? row.version : 0
}

/**
 * Validate schema fence and apply pending migrations atomically.
 * Opening an already-current database takes no write lock.
 */
export function ensureSchema(db: DatabaseSync): number {
  const current = readSchemaVersion(db)
  if (current > LATEST_SUPPORTED_VERSION) {
    throw new SchemaFenceError(current, LATEST_SUPPORTED_VERSION)
  }
  if (current === LATEST_SUPPORTED_VERSION) {
    return current
  }

  db.exec('BEGIN IMMEDIATE')
  try {
    const rechecked = readSchemaVersion(db)
    if (rechecked > LATEST_SUPPORTED_VERSION) {
      throw new SchemaFenceError(rechecked, LATEST_SUPPORTED_VERSION)
    }
    if (rechecked === 0) {
      db.exec(V1_SCHEMA_SQL)
      const now = Date.now()
      db.prepare('INSERT INTO schema_meta (singleton, version, updated_at) VALUES (1, ?, ?)').run(
        LATEST_SUPPORTED_VERSION,
        now,
      )
      // Ensure the global user-profile pseudo-project row always exists
      db.prepare(
        `INSERT OR IGNORE INTO projects (project_id, display_name, canonical_root, memory_epoch, last_active_at, created_at)
         VALUES (?, ?, ?, 1, ?, ?)`,
      ).run(GLOBAL_PROJECT_ID, 'Global User Profile', '', now, now)
    }
    db.exec('COMMIT')
    return LATEST_SUPPORTED_VERSION
  } catch (err) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // Ignore rollback errors if connection already rolled back
    }
    throw err
  }
}
