# Magic Memory (`dsh-magic-memory`)

A closed-loop, cross-session memory plugin for **DeepSeek Harness (DSH)** inspired by `cortexkit/magic-context`, engineered for native multi-end DSH compatibility without modifying DSH's core compaction or session persistence schema.

## Core Architecture

1. **Zero-Native Cross-Platform SQLite Engine**: Uses Node.js ≥24.9 built-in `node:sqlite` + FTS5 in WAL mode (`$DSH_HOME/magic-memory/memory.db`) with schema version fencing, Git-root / worktree project identity resolution, and multi-process lease coordination (`pid` liveness takeover + write guards).
2. **KV-Cache-Stable Context Injection**:
   - **Static System Guidance**: Byte-identical across turns.
   - **Step 1 Baseline Snapshot (`form: 'snapshot'`)**: Injects global `USER_PROFILE`, 5 structured project categories (`PROJECT_RULES`, `ARCHITECTURE`, `CONSTRAINTS`, `CONFIG_VALUES`, `NAMING`), read-only workspace shared constraints, and active notes in deterministic order.
   - **Steady-State Defer**: Zero prefix mutations during ordinary turns — preserving provider prompt KV cache.
   - **Post-Compaction Re-Anchoring**: Automatically detects DSH `compaction/summary` events to rescue facts before loss and re-anchor a fresh baseline snapshot after compaction rebuilds the prefix.
   - **Tail-Only Auto-Search (`form: 'recall'`)**: Appends a compact vague recall hint strictly alongside the newest user message when a non-visible memory or episode scores above threshold.
3. **Out-of-Band Background Extractor**: Reads raw session events at `turn/end` and compaction boundaries, uses DSH's auxiliary LLM route to produce fail-closed XML manifests (`<extract>`), records searchable `session_episodes`, promotes durable `<facts>`, and accumulates `<user_observations>`.
4. **Dreamer 6-Task Self-Maintenance**: Conflict-domain leased background tasks (`map-memories`, `verify`, `curate`, `classify-memories`, `retrospective`, `review-user-memories`) with claim-safety guards (never auto-archives `PROJECT_RULES` or shrinks content >50% without consolidation; fail-closed secret detection before workspace sharing).
5. **Hybrid CJK + Optional Vector Search**: Offline default uses CJK bigram/unigram + camelCase/snake_case FTS5 BM25 fused with character n-gram overlap; optional OpenAI-compatible remote embeddings add cosine similarity with stale-hash write protection.
6. **Multi-End Native Integration**:
   - Works identically across **Web**, **Electron Desktop** (`standard` / `ptc` / `minimal` / `cordis`), **Headless CLI**, **ACP**, and **SDK**.
   - Includes a native Web/Desktop **Right-Sidebar Dashboard** (Memories CRUD & search, Episodes & Notes, Dreamer console, KV-Cache Telemetry & Doctor/Export) plus live hot-reloadable Settings via Schemastery `.volatile()`.
