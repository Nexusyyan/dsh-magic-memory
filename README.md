# dsh-magic-memory

[![Node >=24.9](https://img.shields.io/badge/node-%3E%3D24.9.0-brightgreen)](https://nodejs.org/)
[![DSH >=0.2.0-rc.1](https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.1-4d6bfe)](https://github.com/deepseek-ai/deepseek-harness)
[![Zero Native Deps](https://img.shields.io/badge/native%20addons-0-success)](#multi-end-compatibility)

A closed-loop cross-session memory plugin for **DeepSeek Harness (DSH)** inspired by `cortexkit/magic-context`. Built on Node.js built-in `node:sqlite` + FTS5 with zero native compilation, strict prompt KV-cache preservation, out-of-band session extraction, 6-task Dreamer self-maintenance, and a native Web/Desktop Right-Sidebar UI.

---

## Features

- **Lightweight Memory Enhancement Mode**: Never rewrites, truncates, or conflicts with DSH's native compaction (`compaction-basic` / `tool-result-pruner`) or session event schema.
- **Structured Memory Model**:
  - 5 project categories: `PROJECT_RULES`, `ARCHITECTURE`, `CONSTRAINTS`, `CONFIG_VALUES`, `NAMING`
  - Global cross-project `USER_PROFILE` (automatically promoted after repeated observations across sessions)
  - Read-only **Workspaces** for sharing safe `CONSTRAINTS` across sibling repositories (fail-closed secret filter)
  - Searchable **Session Episodes**, **Working Notes**, and **Session Highlights**
- **KV-Cache-Stable Context Loop**:
  - Step 1 deterministic Baseline Snapshot (`form: 'snapshot'`)
  - Steady-state **Defer** (zero prefix modifications between turns)
  - **Post-Compaction Re-Anchor** immediately after DSH emits `compaction/summary`
  - Manual `/ctx-sync` delta append on demand
  - Tail-only **Auto-Search** vague recall hints (`form: 'recall'`)
- **CJK-Aware Offline-First Hybrid Search**:
  - Default offline mode: CJK bigram/unigram + Latin/camelCase/snake_case SQLite FTS5 BM25 + character n-gram overlap + importance/recency boost
  - Optional remote mode: OpenAI-compatible Embeddings API (`Float32Array` BLOB cosine similarity + stale-hash race guard)
- **Out-of-Band Background Loop**:
  - **Session Extractor**: Incremental `turn/end` extraction + pre-compaction fact rescue (fail-closed XML parser)
  - **Dreamer 6-Task Scheduler**: `map-memories`, `verify`, `curate`, `classify-memories`, `retrospective`, `review-user-memories` with SQLite leases, dead-PID takeover, and claim-safety guards
- **Native Web & Desktop UI (Light & Dark Theme Parity)**:
  - Mounted across 3 DSH surfaces: **Left Sidebar Main Page**, **Conversation Header Quick-Open Button**, and **Right Sidebar Tab**
  - 5 tabs: **Memories** (borderless category filters + hybrid search + CRUD modal + Pin/Archive/Restore), **Episodes & Notes** (+ manual Extract), **Dreamer** (6-task 2×3 schedule grid, backlog, run history, manual triggers), **Telemetry** (KV-cache Defer ratio, Re-Anchor count, Auto-Search hits, Doctor self-heal, Markdown/JSON export), and **Settings** (in-panel DSH LLM model picker, separate Dreamer model option, OpenAI-compatible Embedding config with presets, connectivity tests, and one-click historical memory vector reindexing)
  - Live settings persist to SQLite (`plugin_settings`) and take effect immediately without restarting DSH

---

## Installation in DSH

Pre-built `dist/` artifacts are included in every release tag, so installing directly from GitHub works out-of-the-box on **macOS, Windows, and Linux** with zero build step.

### Option 1: Install directly from GitHub (Recommended for macOS & Windows)

Add to your DSH profile `package.json` (or via DSH Plugins Manager):

```json
{
  "dependencies": {
    "dsh-magic-memory": "github:Nexusyyan/dsh-magic-memory#v0.1.0"
  }
}
```

Or via CLI:

```bash
dsh plugin add github:Nexusyyan/dsh-magic-memory#v0.1.0
```

> Use `github:Nexusyyan/dsh-magic-memory` (without `#v0.1.0`) to track `main`.

### Option 2: Install from a local checkout (Development)

```bash
git clone https://github.com/Nexusyyan/dsh-magic-memory.git
cd dsh-magic-memory
pnpm install
pnpm run build

# Link into your DSH installation
dsh plugin add /path/to/dsh-magic-memory
```

### Option 3: Custom Cordis / SDK host

```ts
import * as magicMemory from 'dsh-magic-memory'

ctx.plugin(magicMemory, {
  dbPath: '/path/to/memory.db',
})
```

---

## Multi-End Compatibility

| DSH Runtime / Profile | Host Engine (`tools`, `hooks`, `extractor`, `dreamer`) | Slash Commands | Right-Sidebar UI |
| --- | :---: | :---: | :---: |
| **Web (`dsh start`)** | Yes | Yes | Yes (HTTP `/api` RPC) |
| **Desktop Electron** (`standard` / `ptc` / `minimal` / `cordis`) | Yes | Yes | Yes (Desktop IPC `/api` RPC) |
| **Headless CLI** | Yes | Optional | Dormant (zero browser load) |
| **ACP Server** | Yes | Optional | Dormant |
| **Embedded SDK** | Yes | Optional | Dormant |

OS support: **macOS**, **Windows**, **Linux** (requires Node.js `>=24.9.0`, zero `node-gyp` or native SQLite binaries).

---

## Model Tools & Slash Commands

### Tools (`ctx.tools`)

- `ctx_memory`: `write` | `update` | `archive` | `restore` | `merge` | `get` | `list`
- `ctx_search`: Hybrid search across `memory`, `episode`, `note`, `session` (suppresses already-visible baseline memories by default; set `include_visible: true` to show all)
- `ctx_note`: `add` | `list` | `read` | `dismiss`

### Slash Commands (`ctx.commands`, when available)

- `/ctx-status`: Overview of project memories, KV-cache Defer ratio, Dreamer schedule, and DB stats
- `/ctx-extract`: Force immediate background extraction of the active session
- `/ctx-dream [task]`: Run one or all 6 Dreamer maintenance tasks
- `/ctx-sync`: Queue a delta sync for the next turn without invalidating prior prefix
- `/ctx-memory <list|search|write|doctor|export> ...`: Direct CLI/chat control over memories

---

## Configuration Reference

All runtime knobs (except `dbPath`) are `.volatile()` and take effect immediately when edited in DSH's Plugins Settings page:

| Option | Default | Description |
| --- | --- | --- |
| `dbPath` | `$DSH_HOME/magic-memory/memory.db` | SQLite database path (`:memory:` supported for tests) |
| `enabled` | `true` | Master switch for injection, tools, and background loops |
| `injectOnStart` | `true` | Inject deterministic baseline snapshot on step 1 |
| `reanchorAfterCompaction` | `true` | Re-anchor baseline snapshot after native DSH compaction |
| `baselineBudgetTokens` | `3200` | Max tokens for Step 1 / Post-Compaction baseline snapshot |
| `userProfileBudgetTokens` | `600` | Max tokens for cross-project `USER_PROFILE` section |
| `deltaBudgetTokens` | `800` | Max tokens for manual `/ctx-sync` incremental deltas |
| `maxMemoryChars` | `1500` | Max character length per durable memory entry |
| `autoSearch.enabled` | `true` | Enable tail-only Auto-Search vague recall hint |
| `autoSearch.scoreThreshold` | `0.42` | Minimum hybrid score to inject a recall hint |
| `autoSearch.maxHints` | `3` | Max recall hints appended to a user turn |
| `extractor.enabled` | `true` | Enable out-of-band `turn/end` & pre-compaction extraction |
| `extractor.triggerTokens` | `12000` | Minimum new tokens before automatic turn-end extraction |
| `extractor.onCompaction` | `true` | Rescue facts before DSH `compaction/summary` folds raw history |
| `dreamer.enabled` | `true` | Enable periodic Dreamer background maintenance |
| `dreamer.tickIntervalMinutes` | `15` | Background scheduler wake-up cadence |
| `dreamer.userMemoriesEnabled` | `true` | Allow automatic promotion of repeated user observations to global `USER_PROFILE` |
| `dreamer.userPromoteThreshold` | `3` | Distinct sessions required before promoting a user observation |
| `embedding.provider` | `'off'` | `'off'` (offline FTS5 + n-gram) or `'openai-compatible'` |
| `embedding.endpoint` | `''` | OpenAI-compatible `/v1/embeddings` endpoint URL |
| `embedding.apiKey` | `''` | API key (stored as `.role('secret')`; falls back to `embedding.apiKeyEnv`) |
| `embedding.model` | `'text-embedding-3-small'` | Embedding model identifier |
| `includeSubagents` | `'search-only'` | Subagent access policy: `'off'` \| `'search-only'` \| `'full'` |

---

## Development & Testing

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm test
pnpm run pack:check
```
