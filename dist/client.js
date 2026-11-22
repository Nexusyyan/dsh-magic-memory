/* dsh-magic-memory@0.1.0 — DSH browser client bundle */
window.__ModuleLoader__.load({
  id: "dsh-magic-memory",
  factory: function(require) {
    var module = { exports: {} };
    var exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf, __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: !0 });
}, __copyProps = (to, from, except, desc) => {
  if (from && typeof from == "object" || typeof from == "function")
    for (let key of __getOwnPropNames(from))
      !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: !0 }) : target,
  mod
)), __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: !0 }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  EN_DICT: () => EN_DICT,
  MAGIC_MEMORY_NS: () => MAGIC_MEMORY_NS,
  MagicMemoryApi: () => MagicMemoryApi,
  MagicMemoryIcon: () => MagicMemoryIcon,
  MemoryPanel: () => MemoryPanel,
  TAB_ID: () => TAB_ID,
  TAB_KIND: () => TAB_KIND,
  ZH_DICT: () => ZH_DICT,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react9 = __toESM(require("react"), 1);

// src/client/api.ts
var MAGIC_MEMORY_CLIENT_ROUTE = "./api/dsh-magic-memory";
function createFetchTransport(fetchImpl = (input, init) => fetch(input, init), route = MAGIC_MEMORY_CLIENT_ROUTE) {
  return async (op, payload, signal) => {
    let response = await fetchImpl(route, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op, payload }),
      signal
    });
    if (!response.ok)
      return {
        ok: !1,
        error: {
          code: `http/${response.status}`,
          message: `Magic Memory API request "${op}" failed with HTTP ${response.status}`
        }
      };
    let json = await response.json();
    return typeof json != "object" || json === null || typeof json.ok != "boolean" ? {
      ok: !1,
      error: {
        code: "magic-memory/invalid-response",
        message: `Magic Memory API returned an unexpected response for "${op}"`
      }
    } : json;
  };
}
var MagicMemoryApi = class {
  transport;
  constructor(transport = createFetchTransport()) {
    this.transport = transport;
  }
  async invoke(op, payload, signal) {
    let res = await this.transport(op, payload, signal);
    if (!res.ok)
      throw new Error(res.error?.message || `RPC ${op} failed (${res.error?.code ?? "error"})`);
    return res.value;
  }
  getOverview(params, signal) {
    return this.invoke("overview", params, signal);
  }
  listMemories(params, signal) {
    return this.invoke("memories.list", params, signal);
  }
  searchMemories(params, signal) {
    return this.invoke("memories.search", params, signal);
  }
  createMemory(params, signal) {
    return this.invoke("memories.create", params, signal);
  }
  updateMemory(params, signal) {
    return this.invoke("memories.update", params, signal);
  }
  archiveMemory(params, signal) {
    return this.invoke("memories.archive", params, signal);
  }
  restoreMemory(params, signal) {
    return this.invoke("memories.restore", params, signal);
  }
  listEpisodes(params, signal) {
    return this.invoke("episodes.list", params, signal);
  }
  listNotes(params, signal) {
    return this.invoke("notes.list", params, signal);
  }
  createNote(params, signal) {
    return this.invoke("notes.create", params, signal);
  }
  dismissNote(params, signal) {
    return this.invoke("notes.dismiss", params, signal);
  }
  extractNow(params, signal) {
    return this.invoke("extract.now", params, signal);
  }
  getDreamerStatus(params, signal) {
    return this.invoke("dreamer.status", params, signal);
  }
  runDreamer(params, signal) {
    return this.invoke("dreamer.run", params, signal);
  }
  requestSync(params, signal) {
    return this.invoke("sync.request", params, signal);
  }
  runDoctor(signal) {
    return this.invoke("doctor", {}, signal);
  }
  exportSnapshot(params, signal) {
    return this.invoke("export", params, signal);
  }
  getSettings(signal) {
    return this.invoke("settings.get", {}, signal);
  }
  updateSettings(patch, signal) {
    return this.invoke("settings.update", { patch }, signal);
  }
  testLlm(params, signal) {
    return this.invoke("settings.testLlm", params, signal);
  }
  testEmbedding(params, signal) {
    return this.invoke("settings.testEmbedding", { embedding: params }, signal);
  }
  reindexEmbeddings(params, signal) {
    return this.invoke("settings.reindexEmbeddings", params, signal);
  }
};

// src/client/components/MemoryPanel.tsx
var import_react8 = __toESM(require("react"), 1);

// src/client/locales.ts
var MAGIC_MEMORY_NS = "magicMemory", EN_DICT = {
  "tab.title": "Magic Memory",
  "nav.panelLabel": "Magic Memory",
  "header.subtitle": "Cross-session project memories, extracted episodes, Dreamer maintenance, and KV-cache telemetry.",
  "header.openSidebar": "Open Magic Memory panel",
  "guide.title": "Magic Memory",
  "guide.description": "Inspect project memories, session episodes, Dreamer tasks, and KV-cache telemetry.",
  "header.project": "Project",
  "header.refresh": "Refresh",
  "header.loading": "Loading\u2026",
  "nav.memories": "Memories",
  "nav.episodesNotes": "Episodes & Notes",
  "nav.dreamer": "Dreamer",
  "nav.telemetry": "Telemetry",
  "nav.settings": "Settings",
  "cat.PROJECT_RULES": "Project Rules",
  "cat.ARCHITECTURE": "Architecture",
  "cat.CONSTRAINTS": "Constraints",
  "cat.CONFIG_VALUES": "Config Values",
  "cat.NAMING": "Naming",
  "cat.USER_PROFILE": "User Profile",
  "verify.verified": "Verified",
  "verify.stale": "Stale",
  "verify.unverified": "Unverified",
  "verify.conflict": "Conflict",
  "source.manual": "Manual",
  "source.auto_extracted": "Auto-extracted",
  "source.dreamer_promoted": "Dreamer",
  "source.tool": "Agent Tool",
  "source.imported": "Imported",
  "memories.searchPlaceholder": "Search memories, episodes, notes (CJK / English / code)\u2026",
  "memories.search": "Search",
  "memories.clear": "Clear",
  "memories.add": "New Memory",
  "memories.scopeAll": "All Scopes",
  "memories.scopeProject": "Project",
  "memories.scopeGlobal": "Global Profile",
  "memories.statusActive": "Active",
  "memories.statusArchived": "Archived",
  "memories.allCategories": "All Categories",
  "memories.emptyTitle": "No memories here yet",
  "memories.empty": "Durable rules, architectural decisions, constraints, and config values learned across chats will appear here automatically\u2014or add one manually.",
  "memories.emptyFiltered": "No memories match the current filter.",
  "memories.resetFilters": "Reset filters",
  "memories.searchResults": "Search Results ({count})",
  "memories.vectorActive": "Hybrid (FTS5 + Vector)",
  "memories.ftsOnly": "Offline FTS5 + N-gram",
  "memories.edit": "Edit",
  "memories.pin": "Pin",
  "memories.unpin": "Unpin",
  "memories.archive": "Archive",
  "memories.restore": "Restore",
  "memories.pinnedBadge": "Pinned",
  "memories.importance": "Weight {value}",
  "memories.retrievals": "{count} hits",
  "modal.createTitle": "Create Memory",
  "modal.editTitle": "Edit Memory #{id}",
  "modal.scope": "Scope",
  "modal.category": "Category",
  "modal.importance": "Importance (1\u2013100)",
  "modal.pinLabel": "Pin to baseline context (always loaded at session start)",
  "modal.content": "Content",
  "modal.contentPlaceholder": "Write a concise, durable factual statement (no secrets)\u2026",
  "modal.cancel": "Cancel",
  "modal.save": "Save",
  "episodes.title": "Extracted Session Episodes",
  "episodes.extractNow": "Extract Current Session",
  "episodes.extracting": "Extracting\u2026",
  "episodes.empty": "No session episodes extracted yet for this project.",
  "episodes.emptyHint": "Episodes are generated automatically after substantive conversations or before context compaction.",
  "episodes.noSession": "Open an active chat session to run extraction.",
  "episodes.decisions": "Key Decisions",
  "notes.title": "Active Working Notes",
  "notes.add": "Add Note",
  "notes.titlePlaceholder": "Note title\u2026",
  "notes.contentPlaceholder": "Short working note or reminder\u2026",
  "notes.sessionOnly": "Bind to current session only",
  "notes.save": "Save Note",
  "notes.dismiss": "Dismiss",
  "notes.empty": "No active notes for this project.",
  "dreamer.title": "Dreamer Maintenance",
  "dreamer.subtitle": "Background self-maintenance tasks verify memories against code, deduplicate entries, and promote recurring user habits.",
  "dreamer.enabled": "Scheduler Active",
  "dreamer.disabled": "Scheduler Paused",
  "dreamer.runAll": "Run All Tasks",
  "dreamer.running": "Running\u2026",
  "dreamer.runOne": "Run",
  "dreamer.backlog": "Backlog: {count}",
  "dreamer.interval": "Every {minutes}m",
  "dreamer.intervalOff": "Manual only",
  "dreamer.lastRun": "Last: {time}",
  "dreamer.never": "Never",
  "dreamer.failures": "{count} failures",
  "dreamer.recentRuns": "Recent Runs",
  "dreamer.noRuns": "No Dreamer runs recorded yet.",
  "dreamer.task.map-memories": "Map Memories",
  "dreamer.task.verify": "Verify Against Repo",
  "dreamer.task.curate": "Curate & Dedupe",
  "dreamer.task.classify-memories": "Classify Shareability",
  "dreamer.task.retrospective": "Retrospective Mining",
  "dreamer.task.review-user-memories": "Promote User Profile",
  "telemetry.cacheTitle": "KV Cache & Context Loop",
  "telemetry.deferRatio": "Cache Defer Ratio",
  "telemetry.totalSteps": "Steps / Defers",
  "telemetry.reanchors": "Post-Compaction Re-Anchors",
  "telemetry.autoSearch": "Tail Auto-Search Hits",
  "telemetry.injectedIds": "Baseline Injected",
  "telemetry.queueSync": "Queue Delta Sync (/ctx-sync)",
  "telemetry.syncQueued": "Delta sync queued for the next agent turn.",
  "telemetry.noSessionState": "No active session telemetry yet. Open Magic Memory from a chat header to inspect live cache metrics.",
  "telemetry.storageTitle": "Storage & Hybrid Search Index",
  "telemetry.dbSize": "SQLite Size",
  "telemetry.schemaVersion": "Schema Version",
  "telemetry.embeddingMode": "Embedding Engine",
  "telemetry.embeddingCoverage": "Embedded Coverage",
  "telemetry.categoriesTitle": "Active Memory Distribution",
  "telemetry.toolsTitle": "Diagnostics & Export",
  "telemetry.doctor": "Run Doctor",
  "telemetry.exportMd": "Export Markdown",
  "telemetry.exportJson": "Export JSON",
  "telemetry.copy": "Copy",
  "telemetry.copied": "Copied",
  "telemetry.download": "Download",
  "telemetry.close": "Close",
  "telemetry.doctorOk": "Database healthy (WAL + FTS5 verified)",
  "telemetry.doctorWarn": "Doctor completed with warnings",
  "settings.title": "Magic Memory Settings",
  "settings.subtitle": "Configure the background LLM used for memory extraction & Dreamer maintenance, plus the optional Embedding model for hybrid semantic search.",
  "settings.save": "Save Settings",
  "settings.saving": "Saving\u2026",
  "settings.reset": "Discard Changes",
  "settings.savedNotice": "Magic Memory settings saved and applied immediately.",
  "settings.unsaved": "You have unsaved changes",
  "settings.llmSection": "Magic Memory Model (Extraction & Dreamer)",
  "settings.llmDesc": "Used out-of-band to distill session episodes, extract durable facts, verify memories against code, and deduplicate entries.",
  "settings.activeRoute": "Effective route: {route}",
  "settings.routeAuto": "Follow active session model (Auto)",
  "settings.routeCustom": "Custom provider / model\u2026",
  "settings.routeUnresolved": "Auto (resolves from active chat)",
  "settings.sharedModelLabel": "Background LLM Model",
  "settings.separateDreamerLabel": "Use a separate model for Dreamer maintenance",
  "settings.extractorModelLabel": "Session Extractor Model",
  "settings.dreamerModelLabel": "Dreamer Maintenance Model",
  "settings.providerPlaceholder": "Provider id (e.g. deepseek, openai)",
  "settings.modelPlaceholder": "Model id (e.g. deepseek-chat)",
  "settings.testLlm": "Test Model",
  "settings.testDreamerLlm": "Test Dreamer Model",
  "settings.testing": "Testing\u2026",
  "settings.enabledLabel": "Enable Magic Memory",
  "settings.enabledHint": "Master switch for context injection, background extraction, and Dreamer maintenance.",
  "settings.extractorEnabledLabel": "Auto-extract session episodes & facts",
  "settings.extractorEnabledHint": "Trigger extraction after substantive turns or right before compaction.",
  "settings.triggerTokensLabel": "Extraction Trigger (tokens)",
  "settings.dreamerEnabledLabel": "Dreamer scheduled maintenance",
  "settings.dreamerEnabledHint": "Periodically verify, map backing files, and deduplicate memories in the background.",
  "settings.tickIntervalLabel": "Scheduler Tick (minutes)",
  "settings.embeddingSection": "Embedding Model (Hybrid Semantic Search)",
  "settings.embeddingDesc": "Optional OpenAI-compatible embeddings endpoint for vector + FTS5 hybrid reranking. Works fully offline via FTS5 + N-gram when turned off.",
  "settings.embModeOff": "Off (Offline FTS5)",
  "settings.embModeOpenai": "OpenAI-Compatible API",
  "settings.embPresets": "Quick presets",
  "settings.embEndpointLabel": "API Base URL / Endpoint",
  "settings.embEndpointPlaceholder": "https://api.openai.com/v1",
  "settings.embModelLabel": "Embedding Model",
  "settings.embModelPlaceholder": "text-embedding-3-small",
  "settings.embApiKeyLabel": "API Key",
  "settings.embApiKeyPlaceholder": "sk-\u2026 (leave empty to use env var)",
  "settings.embApiKeySavedPlaceholder": "Saved ({preview}) \u2014 enter new key to replace",
  "settings.embClearKey": "Clear saved key",
  "settings.embApiKeyEnvLabel": "Fallback Env Variable",
  "settings.embEnvDetected": "Env detected",
  "settings.embTest": "Test Embedding",
  "settings.embReindex": "Reindex Project Memories",
  "settings.embReindexing": "Indexing\u2026",
  "settings.loopSection": "Context Loop & Token Budgets",
  "settings.loopDesc": "Cache-friendly injection behavior designed to preserve KV-cache prefix stability.",
  "settings.injectOnStartLabel": "Inject baseline memories at session start",
  "settings.reanchorLabel": "Re-anchor baseline after compaction",
  "settings.autoSearchLabel": "Tail-only auto-search recall hints",
  "settings.baselineBudgetLabel": "Baseline Budget (tokens)",
  "settings.profileBudgetLabel": "User Profile Budget (tokens)",
  "settings.deltaBudgetLabel": "Delta Sync Budget (tokens)"
}, ZH_DICT = {
  "tab.title": "Magic Memory",
  "nav.panelLabel": "Magic Memory",
  "header.subtitle": "\u8DE8\u4F1A\u8BDD\u9879\u76EE\u8BB0\u5FC6\u5E93\u3001\u60C5\u666F\u6458\u8981\u3001Dreamer \u81EA\u7EF4\u62A4\u4E0E KV Cache \u95ED\u73AF\u89C2\u6D4B\u3002",
  "header.openSidebar": "\u6253\u5F00 Magic Memory \u8BB0\u5FC6\u9762\u677F",
  "guide.title": "Magic Memory \u8BB0\u5FC6\u7CFB\u7EDF",
  "guide.description": "\u7BA1\u7406\u8DE8\u4F1A\u8BDD\u9879\u76EE\u8BB0\u5FC6\u3001\u4F1A\u8BDD\u6458\u8981\u3001Dreamer \u81EA\u7EF4\u62A4\u4EFB\u52A1\u4E0E KV Cache \u89C2\u6D4B\u6307\u6807\u3002",
  "header.project": "\u5F53\u524D\u9879\u76EE",
  "header.refresh": "\u5237\u65B0",
  "header.loading": "\u52A0\u8F7D\u4E2D\u2026",
  "nav.memories": "\u8BB0\u5FC6\u5E93",
  "nav.episodesNotes": "\u6458\u8981\u4E0E\u7B14\u8BB0",
  "nav.dreamer": "Dreamer",
  "nav.telemetry": "\u89C2\u6D4B\u6307\u6807",
  "nav.settings": "\u8BBE\u7F6E",
  "cat.PROJECT_RULES": "\u9879\u76EE\u89C4\u8303",
  "cat.ARCHITECTURE": "\u67B6\u6784\u8BBE\u8BA1",
  "cat.CONSTRAINTS": "\u786C\u6027\u7EA6\u675F",
  "cat.CONFIG_VALUES": "\u914D\u7F6E\u53C2\u6570",
  "cat.NAMING": "\u547D\u540D\u7EA6\u5B9A",
  "cat.USER_PROFILE": "\u5168\u5C40\u504F\u597D",
  "verify.verified": "\u5DF2\u6821\u9A8C",
  "verify.stale": "\u5F85\u66F4\u65B0",
  "verify.unverified": "\u672A\u6821\u9A8C",
  "verify.conflict": "\u51B2\u7A81",
  "source.manual": "\u624B\u52A8\u521B\u5EFA",
  "source.auto_extracted": "\u81EA\u52A8\u63D0\u53D6",
  "source.dreamer_promoted": "Dreamer \u664B\u5347",
  "source.tool": "Agent \u5199\u5165",
  "source.imported": "\u5BFC\u5165",
  "memories.searchPlaceholder": "\u641C\u7D22\u8BB0\u5FC6\u3001\u4F1A\u8BDD\u6458\u8981\u6216\u7B14\u8BB0\uFF08\u652F\u6301\u4E2D\u82F1\u6587\u4E0E\u4EE3\u7801\u6807\u8BC6\u7B26\uFF09\u2026",
  "memories.search": "\u641C\u7D22",
  "memories.clear": "\u6E05\u9664",
  "memories.add": "\u65B0\u5EFA\u8BB0\u5FC6",
  "memories.scopeAll": "\u5168\u90E8\u8303\u56F4",
  "memories.scopeProject": "\u5F53\u524D\u9879\u76EE",
  "memories.scopeGlobal": "\u5168\u5C40\u504F\u597D",
  "memories.statusActive": "\u6D3B\u8DC3",
  "memories.statusArchived": "\u5DF2\u5F52\u6863",
  "memories.allCategories": "\u5168\u90E8\u5206\u7C7B",
  "memories.emptyTitle": "\u5F53\u524D\u9879\u76EE\u8FD8\u6CA1\u6709\u8BB0\u5FC6\u6761\u76EE",
  "memories.empty": "\u5BF9\u8BDD\u4E2D\u6C89\u6DC0\u7684\u9879\u76EE\u89C4\u8303\u3001\u67B6\u6784\u51B3\u7B56\u3001\u786C\u6027\u7EA6\u675F\u548C\u914D\u7F6E\u53C2\u6570\u4F1A\u81EA\u52A8\u8BB0\u5F55\u5230\u8FD9\u91CC\uFF0C\u4F60\u4E5F\u53EF\u4EE5\u624B\u52A8\u521B\u5EFA\u7B2C\u4E00\u6761\u957F\u671F\u8BB0\u5FC6\u3002",
  "memories.emptyFiltered": "\u5F53\u524D\u7B5B\u9009\u6761\u4EF6\u4E0B\u6CA1\u6709\u5339\u914D\u7684\u8BB0\u5FC6\u6761\u76EE\u3002",
  "memories.resetFilters": "\u91CD\u7F6E\u7B5B\u9009",
  "memories.searchResults": "\u68C0\u7D22\u7ED3\u679C\uFF08{count}\uFF09",
  "memories.vectorActive": "\u6DF7\u5408\u68C0\u7D22 \xB7 FTS5 + \u5411\u91CF",
  "memories.ftsOnly": "\u79BB\u7EBF\u68C0\u7D22 \xB7 FTS5 + N-gram",
  "memories.edit": "\u7F16\u8F91",
  "memories.pin": "\u7F6E\u9876",
  "memories.unpin": "\u53D6\u6D88\u7F6E\u9876",
  "memories.archive": "\u5F52\u6863",
  "memories.restore": "\u6062\u590D",
  "memories.pinnedBadge": "\u5DF2\u7F6E\u9876",
  "memories.importance": "\u6743\u91CD {value}",
  "memories.retrievals": "\u53EC\u56DE {count} \u6B21",
  "modal.createTitle": "\u65B0\u5EFA\u957F\u671F\u8BB0\u5FC6",
  "modal.editTitle": "\u7F16\u8F91\u8BB0\u5FC6 #{id}",
  "modal.scope": "\u4F5C\u7528\u57DF",
  "modal.category": "\u8BB0\u5FC6\u5206\u7C7B",
  "modal.importance": "\u91CD\u8981\u5EA6\u6743\u91CD\uFF081\u2013100\uFF09",
  "modal.pinLabel": "\u7F6E\u9876\u5230\u4F1A\u8BDD\u57FA\u7EBF\u4E0A\u4E0B\u6587\uFF08\u6BCF\u6B21\u65B0\u4F1A\u8BDD\u4F18\u5148\u6CE8\u5165\uFF09",
  "modal.content": "\u8BB0\u5FC6\u5185\u5BB9",
  "modal.contentPlaceholder": "\u5199\u4E0B\u7B80\u6D01\u3001\u957F\u671F\u6709\u6548\u7684\u9879\u76EE\u4E8B\u5B9E\u6216\u7EA6\u5B9A\uFF08\u8BF7\u52FF\u586B\u5199\u5BC6\u94A5\uFF09\u2026",
  "modal.cancel": "\u53D6\u6D88",
  "modal.save": "\u4FDD\u5B58",
  "episodes.title": "\u8DE8\u4F1A\u8BDD\u60C5\u666F\u6458\u8981",
  "episodes.extractNow": "\u7ACB\u5373\u63D0\u53D6\u5F53\u524D\u4F1A\u8BDD",
  "episodes.extracting": "\u63D0\u53D6\u4E2D\u2026",
  "episodes.empty": "\u5F53\u524D\u9879\u76EE\u5C1A\u672A\u751F\u6210\u4F1A\u8BDD\u6458\u8981\u3002",
  "episodes.emptyHint": "\u5B8C\u6210\u591A\u8F6E\u6709\u6548\u5BF9\u8BDD\u6216\u5728\u4E0A\u4E0B\u6587\u538B\u7F29\u524D\uFF0C\u540E\u53F0\u63D0\u53D6\u5668\u4F1A\u81EA\u52A8\u6C89\u6DC0\u4F1A\u8BDD\u6458\u8981\u4E0E\u5173\u952E\u51B3\u7B56\u3002",
  "episodes.noSession": "\u8BF7\u5728\u5177\u4F53\u5BF9\u8BDD\u9875\u9876\u680F\u6253\u5F00\u9762\u677F\u4EE5\u89E6\u53D1\u4F1A\u8BDD\u63D0\u53D6\u3002",
  "episodes.decisions": "\u5173\u952E\u51B3\u7B56",
  "notes.title": "\u6D3B\u8DC3\u5DE5\u4F5C\u7B14\u8BB0",
  "notes.add": "\u65B0\u5EFA\u7B14\u8BB0",
  "notes.titlePlaceholder": "\u7B14\u8BB0\u6807\u9898\u2026",
  "notes.contentPlaceholder": "\u8BB0\u5F55\u4E34\u65F6\u5907\u5FD8\u3001\u5F85\u529E\u7EBF\u7D22\u6216\u77ED\u671F\u7EA6\u675F\u2026",
  "notes.sessionOnly": "\u4EC5\u7ED1\u5B9A\u5F53\u524D\u4F1A\u8BDD",
  "notes.save": "\u4FDD\u5B58\u7B14\u8BB0",
  "notes.dismiss": "\u5F52\u6863\u5173\u95ED",
  "notes.empty": "\u5F53\u524D\u9879\u76EE\u6CA1\u6709\u6D3B\u8DC3\u7684\u5DE5\u4F5C\u7B14\u8BB0\u3002",
  "dreamer.title": "Dreamer \u540E\u53F0\u81EA\u7EF4\u62A4",
  "dreamer.subtitle": "\u6309\u8BA1\u5212\u5728\u540E\u53F0\u6821\u9A8C\u8BB0\u5FC6\u4E0E\u4EE3\u7801\u4ED3\u5E93\u4E00\u81F4\u6027\u3001\u81EA\u52A8\u53BB\u91CD\u5408\u5E76\uFF0C\u5E76\u5C06\u8DE8\u4F1A\u8BDD\u91CD\u590D\u504F\u597D\u664B\u5347\u4E3A\u5168\u5C40\u753B\u50CF\u3002",
  "dreamer.enabled": "\u81EA\u52A8\u8C03\u5EA6\u8FD0\u884C\u4E2D",
  "dreamer.disabled": "\u8C03\u5EA6\u5DF2\u6682\u505C",
  "dreamer.runAll": "\u8FD0\u884C\u5168\u90E8\u4EFB\u52A1",
  "dreamer.running": "\u8FD0\u884C\u4E2D\u2026",
  "dreamer.runOne": "\u8FD0\u884C",
  "dreamer.backlog": "\u5F85\u5904\u7406 {count}",
  "dreamer.interval": "\u6BCF {minutes} \u5206\u949F",
  "dreamer.intervalOff": "\u4EC5\u624B\u52A8\u89E6\u53D1",
  "dreamer.lastRun": "\u4E0A\u6B21 {time}",
  "dreamer.never": "\u4ECE\u672A\u8FD0\u884C",
  "dreamer.failures": "\u8FDE\u7EED\u5931\u8D25 {count} \u6B21",
  "dreamer.recentRuns": "\u8FD1\u671F\u6267\u884C\u65E5\u5FD7",
  "dreamer.noRuns": "\u6682\u65E0 Dreamer \u6267\u884C\u8BB0\u5F55\u3002",
  "dreamer.task.map-memories": "\u6587\u4EF6\u5173\u8054\u6620\u5C04",
  "dreamer.task.verify": "\u4EE3\u7801\u5E93\u771F\u5B9E\u6027\u6821\u9A8C",
  "dreamer.task.curate": "\u53BB\u91CD\u5408\u5E76\u4E0E\u6DD8\u6C70",
  "dreamer.task.classify-memories": "\u8DE8\u4ED3\u5171\u4EAB\u4E0E\u8131\u654F\u5BA1\u67E5",
  "dreamer.task.retrospective": "\u5386\u53F2\u4F1A\u8BDD\u590D\u76D8\u6316\u6398",
  "dreamer.task.review-user-memories": "\u5168\u5C40\u504F\u597D\u664B\u5347\u5BA1\u67E5",
  "telemetry.cacheTitle": "KV Cache \u4E0E\u8BB0\u5FC6\u95ED\u73AF\u5065\u5EB7\u5EA6",
  "telemetry.deferRatio": "\u7F13\u5B58 Defer \u547D\u4E2D\u7387",
  "telemetry.totalSteps": "\u603B\u6B65\u6570 / Defer \u6B65\u6570",
  "telemetry.reanchors": "\u538B\u7F29\u540E\u91CD\u951A\u5B9A",
  "telemetry.autoSearch": "\u5C3E\u90E8\u81EA\u52A8\u53EC\u56DE",
  "telemetry.injectedIds": "\u57FA\u7EBF\u5DF2\u6CE8\u5165\u6761\u76EE",
  "telemetry.queueSync": "\u6392\u961F\u589E\u91CF\u540C\u6B65 (/ctx-sync)",
  "telemetry.syncQueued": "\u5DF2\u52A0\u5165\u961F\u5217\uFF0C\u5C06\u5728\u4E0B\u4E00\u8F6E Agent \u6267\u884C\u524D\u8FFD\u52A0\u589E\u91CF\u540C\u6B65\u3002",
  "telemetry.noSessionState": "\u5F53\u524D\u672A\u7ED1\u5B9A\u6D3B\u8DC3\u4F1A\u8BDD\u3002\u4ECE\u5BF9\u8BDD\u9876\u680F\u6253\u5F00\u53F3\u4FA7\u9762\u677F\u5373\u53EF\u67E5\u770B\u5B9E\u65F6\u4F1A\u8BDD\u7684\u7F13\u5B58\u547D\u4E2D\u7387\u3002",
  "telemetry.storageTitle": "SQLite \u5B58\u50A8\u4E0E\u6DF7\u5408\u68C0\u7D22\u7D22\u5F15",
  "telemetry.dbSize": "\u6570\u636E\u5E93\u4F53\u79EF",
  "telemetry.schemaVersion": "Schema \u7248\u672C",
  "telemetry.embeddingMode": "\u5411\u91CF\u68C0\u7D22\u5F15\u64CE",
  "telemetry.embeddingCoverage": "\u5411\u91CF\u7D22\u5F15\u8986\u76D6",
  "telemetry.categoriesTitle": "\u6D3B\u8DC3\u8BB0\u5FC6\u5206\u7C7B\u5206\u5E03",
  "telemetry.toolsTitle": "\u5065\u5EB7\u81EA\u68C0\u4E0E\u6570\u636E\u5BFC\u51FA",
  "telemetry.doctor": "\u8FD0\u884C\u81EA\u68C0",
  "telemetry.exportMd": "\u5BFC\u51FA Markdown",
  "telemetry.exportJson": "\u5BFC\u51FA JSON",
  "telemetry.copy": "\u590D\u5236\u5185\u5BB9",
  "telemetry.copied": "\u5DF2\u590D\u5236",
  "telemetry.download": "\u4E0B\u8F7D\u6587\u4EF6",
  "telemetry.close": "\u6536\u8D77",
  "telemetry.doctorOk": "\u6570\u636E\u5E93\u5065\u5EB7\uFF08WAL \u6A21\u5F0F + FTS5 \u7D22\u5F15\u5B8C\u6574\uFF09",
  "telemetry.doctorWarn": "\u81EA\u68C0\u5B8C\u6210\uFF0C\u53D1\u73B0\u9700\u5173\u6CE8\u9879",
  "settings.title": "Magic Memory \u6A21\u578B\u4E0E\u5F15\u64CE\u8BBE\u7F6E",
  "settings.subtitle": "\u914D\u7F6E\u7528\u4E8E\u8BB0\u5FC6\u63D0\u53D6\u4E0E Dreamer \u81EA\u7EF4\u62A4\u7684\u540E\u53F0\u5927\u6A21\u578B\uFF0C\u4EE5\u53CA\u7528\u4E8E\u6DF7\u5408\u8BED\u4E49\u68C0\u7D22\u7684 Embedding \u6A21\u578B\u3002",
  "settings.save": "\u4FDD\u5B58\u8BBE\u7F6E",
  "settings.saving": "\u4FDD\u5B58\u4E2D\u2026",
  "settings.reset": "\u8FD8\u539F\u66F4\u6539",
  "settings.savedNotice": "Magic Memory \u8BBE\u7F6E\u5DF2\u4FDD\u5B58\u5E76\u5373\u65F6\u751F\u6548\u3002",
  "settings.unsaved": "\u5B58\u5728\u672A\u4FDD\u5B58\u7684\u66F4\u6539",
  "settings.llmSection": "Magic Memory \u540E\u53F0\u6A21\u578B\uFF08\u63D0\u53D6\u4E0E\u81EA\u7EF4\u62A4\uFF09",
  "settings.llmDesc": "\u7528\u4E8E\u540E\u53F0\u63D0\u70BC\u4F1A\u8BDD\u6458\u8981\u3001\u62BD\u53D6\u957F\u671F\u4E8B\u5B9E\u3001\u4EE3\u7801\u4E00\u81F4\u6027\u6821\u9A8C\u4E0E\u8BB0\u5FC6\u53BB\u91CD\u5408\u5E76\uFF0C\u652F\u6301\u76F4\u63A5\u9009\u7528 DSH \u5DF2\u914D\u7F6E\u7684\u6A21\u578B\u3002",
  "settings.activeRoute": "\u5F53\u524D\u751F\u6548\uFF1A{route}",
  "settings.routeAuto": "\u8DDF\u968F\u5F53\u524D\u4F1A\u8BDD\u6A21\u578B\uFF08\u81EA\u52A8\uFF09",
  "settings.routeCustom": "\u81EA\u5B9A\u4E49 Provider / Model\u2026",
  "settings.routeUnresolved": "\u81EA\u52A8\uFF08\u8DDF\u968F\u6D3B\u8DC3\u5BF9\u8BDD\u6A21\u578B\uFF09",
  "settings.sharedModelLabel": "\u540E\u53F0\u5927\u6A21\u578B",
  "settings.separateDreamerLabel": "\u4E3A Dreamer \u81EA\u7EF4\u62A4\u5355\u72EC\u6307\u5B9A\u6A21\u578B",
  "settings.extractorModelLabel": "\u4F1A\u8BDD\u63D0\u53D6\u6A21\u578B\uFF08Extractor\uFF09",
  "settings.dreamerModelLabel": "\u540E\u53F0\u81EA\u7EF4\u62A4\u6A21\u578B\uFF08Dreamer\uFF09",
  "settings.providerPlaceholder": "Provider \u6807\u8BC6\uFF08\u5982 deepseek\u3001openai\uFF09",
  "settings.modelPlaceholder": "\u6A21\u578B\u540D\u79F0\uFF08\u5982 deepseek-chat\uFF09",
  "settings.testLlm": "\u6D4B\u8BD5\u6A21\u578B\u8FDE\u901A\u6027",
  "settings.testDreamerLlm": "\u6D4B\u8BD5 Dreamer \u6A21\u578B",
  "settings.testing": "\u6D4B\u8BD5\u4E2D\u2026",
  "settings.enabledLabel": "\u542F\u7528 Magic Memory",
  "settings.enabledHint": "\u63A7\u5236\u8BB0\u5FC6\u6CE8\u5165\u3001\u81EA\u52A8\u4F1A\u8BDD\u63D0\u53D6\u4E0E Dreamer \u81EA\u7EF4\u62A4\u7684\u603B\u5F00\u5173\u3002",
  "settings.extractorEnabledLabel": "\u81EA\u52A8\u63D0\u53D6\u4F1A\u8BDD\u6458\u8981\u4E0E\u8BB0\u5FC6",
  "settings.extractorEnabledHint": "\u8FBE\u5230\u5BF9\u8BDD Token \u9608\u503C\u6216\u5728\u4E0A\u4E0B\u6587\u538B\u7F29\u524D\u81EA\u52A8\u89E6\u53D1\u540E\u53F0\u63D0\u70BC\u3002",
  "settings.triggerTokensLabel": "\u89E6\u53D1\u63D0\u53D6\u9608\u503C\uFF08Tokens\uFF09",
  "settings.dreamerEnabledLabel": "\u542F\u7528 Dreamer \u5B9A\u65F6\u81EA\u7EF4\u62A4",
  "settings.dreamerEnabledHint": "\u6309\u5468\u671F\u5728\u540E\u53F0\u6821\u9A8C\u8BB0\u5FC6\u6709\u6548\u6027\u3001\u6620\u5C04\u5173\u8054\u6587\u4EF6\u5E76\u5408\u5E76\u5197\u4F59\u6761\u76EE\u3002",
  "settings.tickIntervalLabel": "\u8C03\u5EA6\u8F6E\u8BE2\u95F4\u9694\uFF08\u5206\u949F\uFF09",
  "settings.embeddingSection": "Embedding \u5411\u91CF\u68C0\u7D22\u6A21\u578B",
  "settings.embeddingDesc": "\u53EF\u9009\u914D\u7F6E OpenAI \u517C\u5BB9\u7684 Embedding \u63A5\u53E3\uFF0C\u5F00\u542F\u300CFTS5 + \u5411\u91CF\u300D\u6DF7\u5408\u8BED\u4E49\u53EC\u56DE\uFF1B\u5173\u95ED\u65F6\u4F7F\u7528\u7EAF\u79BB\u7EBF FTS5 + N-gram \u68C0\u7D22\u3002",
  "settings.embModeOff": "\u5173\u95ED\uFF08\u79BB\u7EBF FTS5\uFF09",
  "settings.embModeOpenai": "OpenAI \u517C\u5BB9\u63A5\u53E3",
  "settings.embPresets": "\u5FEB\u6377\u6A21\u677F",
  "settings.embEndpointLabel": "\u63A5\u53E3\u5730\u5740\uFF08Base URL / Endpoint\uFF09",
  "settings.embEndpointPlaceholder": "https://api.openai.com/v1",
  "settings.embModelLabel": "Embedding \u6A21\u578B\u540D\u79F0",
  "settings.embModelPlaceholder": "text-embedding-3-small",
  "settings.embApiKeyLabel": "API Key",
  "settings.embApiKeyPlaceholder": "sk-\u2026\uFF08\u7559\u7A7A\u5219\u8BFB\u53D6\u4E0B\u65B9\u73AF\u5883\u53D8\u91CF\uFF09",
  "settings.embApiKeySavedPlaceholder": "\u5DF2\u4FDD\u5B58\u5BC6\u94A5\uFF08{preview}\uFF09\uFF0C\u8F93\u5165\u65B0\u5BC6\u94A5\u53EF\u8986\u76D6",
  "settings.embClearKey": "\u6E05\u9664\u5DF2\u5B58\u5BC6\u94A5",
  "settings.embApiKeyEnvLabel": "\u73AF\u5883\u53D8\u91CF\u515C\u5E95\u540D\u79F0",
  "settings.embEnvDetected": "\u5DF2\u68C0\u6D4B\u5230\u73AF\u5883\u53D8\u91CF",
  "settings.embTest": "\u6D4B\u8BD5\u5411\u91CF\u63A5\u53E3",
  "settings.embReindex": "\u8865\u7B97\u5F53\u524D\u9879\u76EE\u5386\u53F2\u5411\u91CF",
  "settings.embReindexing": "\u8BA1\u7B97\u4E2D\u2026",
  "settings.loopSection": "\u4E0A\u4E0B\u6587\u95ED\u73AF\u4E0E Token \u9884\u7B97",
  "settings.loopDesc": "\u4FDD\u6301\u524D\u7F00\u51BB\u7ED3\u4EE5\u4FDD\u62A4 KV Cache \u547D\u4E2D\u7387\uFF0C\u52A8\u6001\u53EC\u56DE\u4EC5\u8FFD\u52A0\u5230\u6D88\u606F\u5C3E\u90E8\u3002",
  "settings.injectOnStartLabel": "\u65B0\u4F1A\u8BDD\u9996\u8F6E\u81EA\u52A8\u6CE8\u5165\u57FA\u7EBF\u8BB0\u5FC6",
  "settings.reanchorLabel": "\u4E0A\u4E0B\u6587\u538B\u7F29\u540E\u81EA\u52A8\u91CD\u951A\u5B9A\u57FA\u7EBF",
  "settings.autoSearchLabel": "\u5F00\u542F\u5C3E\u90E8\u81EA\u52A8\u8BED\u4E49\u53EC\u56DE\u63D0\u793A",
  "settings.baselineBudgetLabel": "\u57FA\u7EBF\u8BB0\u5FC6\u9884\u7B97\uFF08Tokens\uFF09",
  "settings.profileBudgetLabel": "\u5168\u5C40\u504F\u597D\u9884\u7B97\uFF08Tokens\uFF09",
  "settings.deltaBudgetLabel": "\u589E\u91CF\u540C\u6B65\u9884\u7B97\uFF08Tokens\uFF09"
};
function interpolate(template, params) {
  return params ? template.replace(
    /\{(\w+)\}/g,
    (_, k) => params[k] !== void 0 ? String(params[k]) : `{${k}}`
  ) : template;
}
function createFallbackTranslator(lang = "en") {
  let dict = lang === "zh" ? ZH_DICT : EN_DICT;
  return (key, params) => interpolate(dict[key] ?? EN_DICT[key] ?? key, params);
}

// src/client/styles.ts
var STYLE_ELEMENT_ID = "dsh-magic-memory-styles", MAGIC_MEMORY_CSS = `
.dmm-page,
.dmm-root {
  --dmm-bg: var(--dsw-alias-bg-base, #ffffff);
  --dmm-surface: var(--dsw-alias-card-fill, #f7f8fa);
  --dmm-surface-raised: var(--dsw-alias-bg-layer-1, #ffffff);
  --dmm-surface-hover: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, 0.06));
  --dmm-surface-active: var(--dsw-alias-interactive-bg-active, rgba(38, 49, 72, 0.1));
  --dmm-border-subtle: var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.06));
  --dmm-border: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  --dmm-border-strong: var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.18));
  --dmm-fg: var(--dsw-alias-label-primary, #0f1115);
  --dmm-fg-secondary: var(--dsw-alias-label-secondary, #4b5563);
  --dmm-fg-muted: var(--dsw-alias-label-tertiary, #6b7280);
  --dmm-primary-fill: var(--dsw-alias-button-primary-fill, #0f1115);
  --dmm-primary-hover: var(--dsw-alias-button-primary-hover, #2b303a);
  --dmm-primary-fg: var(--dsw-alias-label-primary-foreground, #ffffff);
  --dmm-accent: var(--dsw-alias-state-business-primary, #4176e6);
  --dmm-accent-soft: color-mix(in srgb, var(--dmm-accent) 12%, transparent);
  --dmm-accent-border: color-mix(in srgb, var(--dmm-accent) 34%, transparent);
  --dmm-ok: #15803d;
  --dmm-warn: var(--dsw-alias-state-warn-label, #d97706);
  --dmm-danger: var(--dsw-alias-state-error-primary, #dc2626);
  --dmm-focus: var(--dsw-focus-ring-color, rgba(65, 118, 230, 0.45));
  --dmm-card-shadow: 0 1px 2px rgba(15, 17, 21, 0.04);
  --dmm-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  color: var(--dmm-fg);
  background: var(--dmm-bg);
  color-scheme: light;
  font-size: 13px;
  line-height: 1.5;
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
}

body[data-ds-dark-theme] .dmm-page,
body[data-ds-dark-theme] .dmm-root {
  --dmm-ok: #4ade80;
  --dmm-warn: #fbbf24;
  --dmm-card-shadow: none;
  color-scheme: dark;
}

.dmm-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  width: 100%;
}

.dmm-root *,
.dmm-root *::before,
.dmm-root *::after {
  box-sizing: border-box;
}

.dmm-page {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dmm-page .dmm-root {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px 28px 0;
}

/* \u2500\u2500 Header \u2500\u2500 */
.dmm-header {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--dmm-border-subtle);
  flex-shrink: 0;
}

.dmm-page .dmm-header {
  padding: 0 0 16px;
  border-bottom: none;
}

.dmm-title-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dmm-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dmm-title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: var(--dmm-accent-soft);
  color: var(--dmm-accent);
  flex-shrink: 0;
}

.dmm-page .dmm-title-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
}

.dmm-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--dmm-fg);
  white-space: nowrap;
}

.dmm-page .dmm-title {
  font-size: 19px;
  letter-spacing: -0.02em;
}

.dmm-subtitle {
  font-size: 12.5px;
  color: var(--dmm-fg-muted);
  margin: 0;
}

.dmm-header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* \u2500\u2500 Form Controls & Buttons \u2500\u2500 */
.dmm-select,
.dmm-input,
.dmm-textarea {
  font: inherit;
  font-size: 13px;
  color: var(--dmm-fg);
  background: var(--dmm-surface-raised);
  border: 1px solid var(--dmm-border);
  border-radius: 8px;
  padding: 6px 10px;
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.dmm-select:hover,
.dmm-input:hover,
.dmm-textarea:hover {
  border-color: var(--dmm-border-strong);
}

.dmm-select:focus-visible,
.dmm-input:focus-visible,
.dmm-textarea:focus-visible {
  border-color: var(--dmm-accent);
  box-shadow: 0 0 0 2.5px var(--dmm-focus);
}

.dmm-select-compact {
  height: 32px;
  max-width: 190px;
  font-size: 12.5px;
  font-weight: 500;
  padding: 5px 10px;
  line-height: 1.4;
  background-color: var(--dmm-surface);
  cursor: pointer;
}

.dmm-select option {
  background: var(--dmm-surface-raised);
  color: var(--dmm-fg);
}

/* \u2500\u2500 Custom Accessible Dropdown Menu (replaces native OS <select>) \u2500\u2500 */
.dmm-dd {
  position: relative;
  width: 100%;
}

.dmm-dd-compact {
  width: auto;
}

.dmm-dd-trigger {
  width: 100%;
  height: 36px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font: inherit;
  font-size: 13px;
  color: var(--dmm-fg);
  background: var(--dmm-surface-raised);
  border: 1px solid var(--dmm-border);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  outline: none;
  transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
}

.dmm-dd-trigger:hover:not(:disabled) {
  border-color: var(--dmm-border-strong);
  background: var(--dmm-surface-hover);
}

.dmm-dd-trigger:focus-visible {
  border-color: var(--dmm-accent);
  box-shadow: 0 0 0 2.5px var(--dmm-focus);
}

.dmm-dd[data-open="true"] .dmm-dd-trigger {
  border-color: var(--dmm-border-strong);
  background: var(--dmm-surface-hover);
}

.dmm-dd-trigger:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.dmm-dd-trigger-compact {
  width: auto;
  min-width: 92px;
  max-width: 196px;
  height: 32px;
  padding: 0 10px;
  font-size: 12.5px;
  font-weight: 500;
  background: var(--dmm-surface-raised);
}

.dmm-dd-value {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}

.dmm-dd-leading {
  display: inline-flex;
  align-items: center;
  color: var(--dmm-fg-muted);
  flex-shrink: 0;
}

.dmm-dd-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmm-dd-chevron {
  color: var(--dmm-fg-muted);
  flex-shrink: 0;
  transition: transform 140ms ease, color 120ms ease;
}

.dmm-dd-chevron-open {
  transform: rotate(180deg);
  color: var(--dmm-fg);
}

.dmm-dd-menu {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  right: 0;
  min-width: 210px;
  max-height: 270px;
  overflow-y: auto;
  padding: 5px;
  border-radius: 11px;
  border: 1px solid var(--dmm-border-strong);
  background: var(--dmm-surface-raised);
  box-shadow: 0 10px 28px rgba(15, 17, 21, 0.14), 0 2px 6px rgba(15, 17, 21, 0.06);
  z-index: 120;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

body[data-ds-dark-theme] .dmm-dd-menu {
  background: var(--dsw-alias-bg-layer-2, #2c2c2e);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.48), 0 2px 8px rgba(0, 0, 0, 0.28);
}

.dmm-dd-menu-right {
  left: auto;
  right: 0;
  min-width: 224px;
  max-width: 300px;
}

.dmm-dd-section {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.dmm-dd-section + .dmm-dd-section .dmm-dd-group-label {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid var(--dmm-border-subtle);
}

.dmm-dd-group-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--dmm-fg-muted);
  padding: 4px 9px 3px;
  user-select: none;
}

.dmm-dd-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 9px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--dmm-fg);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background 100ms ease, color 100ms ease;
}

.dmm-dd-item[data-highlighted="true"],
.dmm-dd-item:hover {
  background: var(--dmm-surface-hover);
}

.dmm-dd-item[data-selected="true"] {
  background: var(--dmm-accent-soft);
  color: var(--dmm-fg);
  font-weight: 500;
}

.dmm-dd-item-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.dmm-dd-item-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.dmm-dd-item-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.35;
}

.dmm-dd-item-sub {
  font-family: var(--dmm-mono);
  font-size: 10.5px;
  color: var(--dmm-fg-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.dmm-dd-check {
  display: inline-flex;
  align-items: center;
  color: var(--dmm-accent);
  flex-shrink: 0;
}

.dmm-range {
  width: 100%;
  accent-color: var(--dmm-accent);
  cursor: pointer;
}

.dmm-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--dmm-fg-secondary);
  cursor: pointer;
  user-select: none;
}

.dmm-checkbox input[type="checkbox"] {
  accent-color: var(--dmm-accent);
  width: 14px;
  height: 14px;
  margin: 0;
  cursor: pointer;
}

.dmm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  border-radius: 8px;
  border: 1px solid var(--dmm-border);
  background: var(--dmm-surface-raised);
  color: var(--dmm-fg);
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease;
}

.dmm-btn:hover:not(:disabled) {
  background: var(--dmm-surface-hover);
  border-color: var(--dmm-border-strong);
}

.dmm-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2.5px var(--dmm-focus);
}

.dmm-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.dmm-btn-sm {
  height: 26px;
  padding: 0 9px;
  font-size: 12px;
  border-radius: 6px;
}

.dmm-btn-primary {
  background: var(--dmm-primary-fill);
  border-color: transparent;
  color: var(--dmm-primary-fg);
  font-weight: 500;
}

.dmm-btn-primary:hover:not(:disabled) {
  background: var(--dmm-primary-hover);
  border-color: transparent;
  color: var(--dmm-primary-fg);
}

.dmm-btn-primary:disabled {
  opacity: 0.34;
}

.dmm-btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--dmm-fg-secondary);
  height: 26px;
  padding: 0 8px;
  font-size: 12px;
  border-radius: 6px;
}

.dmm-btn-ghost:hover:not(:disabled) {
  background: var(--dmm-surface-hover);
  border-color: transparent;
  color: var(--dmm-fg);
}

.dmm-btn-danger {
  color: var(--dmm-danger);
}

.dmm-btn-danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dmm-danger) 10%, transparent);
  color: var(--dmm-danger);
}

/* \u2500\u2500 Navigation Tabs (Segmented Underline) \u2500\u2500 */
.dmm-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  border-bottom: 1px solid var(--dmm-border);
  flex-shrink: 0;
  overflow-x: auto;
}

.dmm-page .dmm-tabs {
  padding: 0;
  gap: 6px;
}

.dmm-root[data-variant="sidebar"] .dmm-tabs {
  padding: 0 6px;
  gap: 0;
}

.dmm-root[data-variant="sidebar"] .dmm-tab {
  padding: 8px 6px;
  font-size: 11.5px;
  gap: 3px;
}

.dmm-root[data-variant="sidebar"] .dmm-tab-count {
  min-width: 15px;
  line-height: 15px;
  font-size: 10px;
  padding: 0 4px;
}

.dmm-root[data-variant="sidebar"] .dmm-seg-btn {
  padding: 3px 6px;
  font-size: 11px;
}

.dmm-root[data-variant="sidebar"] .dmm-settings-form-grid,
.dmm-root[data-variant="sidebar"] .dmm-settings-grid-3 {
  grid-template-columns: minmax(0, 1fr);
}

.dmm-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 12px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--dmm-fg-muted);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 120ms ease, border-color 120ms ease;
}

.dmm-tab:hover {
  color: var(--dmm-fg);
}

.dmm-tab:focus-visible {
  outline: none;
  color: var(--dmm-fg);
}

.dmm-tab[aria-selected="true"] {
  color: var(--dmm-fg);
  font-weight: 600;
  border-bottom-color: var(--dmm-accent);
}

.dmm-tab-count {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  min-width: 18px;
  text-align: center;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--dmm-surface);
  border: 1px solid var(--dmm-border-subtle);
  color: var(--dmm-fg-muted);
}

.dmm-tab[aria-selected="true"] .dmm-tab-count {
  background: var(--dmm-accent-soft);
  border-color: var(--dmm-accent-border);
  color: var(--dmm-accent);
}

/* \u2500\u2500 Banners \u2500\u2500 */
.dmm-banner {
  margin: 12px 14px 0;
  padding: 9px 12px;
  border-radius: 9px;
  font-size: 12.5px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
}

.dmm-page .dmm-banner {
  margin: 14px 0 0;
}

.dmm-banner-error {
  background: color-mix(in srgb, var(--dmm-danger) 9%, var(--dmm-bg));
  border: 1px solid color-mix(in srgb, var(--dmm-danger) 28%, transparent);
  color: var(--dmm-danger);
}

.dmm-banner-info {
  background: color-mix(in srgb, var(--dmm-accent) 9%, var(--dmm-bg));
  border: 1px solid var(--dmm-accent-border);
  color: var(--dmm-fg);
}

/* \u2500\u2500 Scrollable Body \u2500\u2500 */
.dmm-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dmm-page .dmm-body {
  padding: 18px 10px 32px 0;
  margin-right: -10px;
  gap: 16px;
}

.dmm-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dmm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dmm-row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

/* \u2500\u2500 Filter Bar & Search (Clean Borderless Surface) \u2500\u2500 */
.dmm-filter-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dmm-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dmm-search-wrap {
  position: relative;
  flex: 1;
  min-width: 180px;
  display: flex;
  align-items: center;
}

.dmm-search-icon {
  position: absolute;
  left: 11px;
  color: var(--dmm-fg-muted);
  pointer-events: none;
  display: inline-flex;
}

.dmm-search-wrap .dmm-input {
  width: 100%;
  height: 36px;
  padding-left: 34px;
  padding-right: 68px;
  border-radius: 10px;
  background: var(--dmm-surface);
  border-color: var(--dmm-border-subtle);
}

.dmm-search-wrap .dmm-input:hover {
  border-color: var(--dmm-border);
}

.dmm-search-wrap .dmm-input:focus-visible {
  background: var(--dmm-bg);
  border-color: var(--dmm-accent);
}

.dmm-search-submit {
  position: absolute;
  right: 5px;
  height: 26px;
  padding: 0 10px;
  border-radius: 7px;
  border: none;
  background: var(--dmm-surface-hover);
  color: var(--dmm-fg-secondary);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.dmm-search-submit:hover:not(:disabled) {
  background: var(--dmm-surface-active);
  color: var(--dmm-fg);
}

.dmm-search-bar .dmm-btn-primary {
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
}

.dmm-filter-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding-bottom: 2px;
}

.dmm-segmented {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border-radius: 8px;
  background: var(--dmm-surface);
  border: 1px solid var(--dmm-border-subtle);
  gap: 2px;
}

.dmm-seg-btn {
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 3.5px 9px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--dmm-fg-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms ease, color 120ms ease;
}

.dmm-seg-btn:hover {
  color: var(--dmm-fg);
}

.dmm-seg-btn[data-active="true"] {
  background: var(--dmm-surface-raised);
  color: var(--dmm-fg);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.dmm-chips {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.dmm-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 9px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dmm-fg-secondary);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.dmm-chip:hover {
  background: var(--dmm-surface-hover);
  color: var(--dmm-fg);
}

.dmm-chip[data-active="true"] {
  background: var(--dmm-accent-soft);
  color: var(--dmm-accent);
  font-weight: 600;
}

.dmm-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  flex-shrink: 0;
}

/* \u2500\u2500 Card Eyebrow & Refined Actions \u2500\u2500 */
.dmm-cat-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--dmm-fg);
}

.dmm-id-tag {
  font-family: var(--dmm-mono);
  font-size: 11px;
  color: var(--dmm-fg-muted);
}

.dmm-status-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--dmm-ok);
}

.dmm-card-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  opacity: 0.72;
  transition: opacity 120ms ease;
}

.dmm-card:hover .dmm-card-actions,
.dmm-card:focus-within .dmm-card-actions {
  opacity: 1;
}

/* \u2500\u2500 Cards \u2500\u2500 */
.dmm-card {
  border: 1px solid var(--dmm-border);
  border-radius: 11px;
  padding: 13px 15px;
  background: var(--dmm-surface-raised);
  box-shadow: var(--dmm-card-shadow);
  display: flex;
  flex-direction: column;
  gap: 9px;
  transition: border-color 120ms ease, background 120ms ease;
}

.dmm-card:hover {
  border-color: var(--dmm-border-strong);
}

.dmm-card-muted {
  background: var(--dmm-surface);
  box-shadow: none;
}

.dmm-card-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--dmm-fg);
  line-height: 1.4;
}

.dmm-decisions {
  font-size: 12px;
  color: var(--dmm-fg-secondary);
  background: var(--dmm-surface);
  border: 1px solid var(--dmm-border-subtle);
  border-radius: 8px;
  padding: 8px 11px;
}

.dmm-decisions-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--dmm-fg-muted);
  margin-bottom: 4px;
}

.dmm-decisions ul {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dmm-card-content {
  font-size: 13.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--dmm-fg);
  max-width: 74ch;
}

.dmm-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: var(--dmm-fg-muted);
}

.dmm-meta-files {
  font-family: var(--dmm-mono);
  font-size: 11px;
  color: var(--dmm-fg-secondary);
  background: var(--dmm-surface);
  border: 1px solid var(--dmm-border-subtle);
  padding: 1px 6px;
  border-radius: 4px;
}

.dmm-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--dmm-border);
  background: var(--dmm-surface);
  color: var(--dmm-fg-secondary);
}

.dmm-badge-mono {
  font-family: var(--dmm-mono);
  font-size: 11px;
}

.dmm-badge-accent {
  background: var(--dmm-accent-soft);
  border-color: var(--dmm-accent-border);
  color: var(--dmm-accent);
}

.dmm-badge-ok {
  background: color-mix(in srgb, var(--dmm-ok) 11%, transparent);
  border-color: color-mix(in srgb, var(--dmm-ok) 30%, transparent);
  color: var(--dmm-ok);
}

.dmm-badge-warn {
  background: color-mix(in srgb, var(--dmm-warn) 12%, transparent);
  border-color: color-mix(in srgb, var(--dmm-warn) 32%, transparent);
  color: var(--dmm-warn);
}

.dmm-badge-danger {
  background: color-mix(in srgb, var(--dmm-danger) 11%, transparent);
  border-color: color-mix(in srgb, var(--dmm-danger) 30%, transparent);
  color: var(--dmm-danger);
}

/* \u2500\u2500 Section Heading \u2500\u2500 */
.dmm-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 2px;
}

.dmm-section-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--dmm-fg);
  margin: 0;
}

.dmm-section-desc {
  font-size: 12.5px;
  color: var(--dmm-fg-muted);
  margin: 2px 0 0;
}

/* \u2500\u2500 Empty State \u2500\u2500 */
.dmm-empty {
  padding: 36px 24px;
  text-align: center;
  border: 1px dashed var(--dmm-border-strong);
  border-radius: 12px;
  background: var(--dmm-surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.dmm-empty-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--dmm-surface-raised);
  border: 1px solid var(--dmm-border);
  color: var(--dmm-fg-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.dmm-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dmm-fg);
  margin: 0;
}

.dmm-empty-desc {
  font-size: 12.5px;
  color: var(--dmm-fg-muted);
  max-width: 44ch;
  margin: 0;
  line-height: 1.55;
}

/* \u2500\u2500 KPI Stats & Progress \u2500\u2500 */
.dmm-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.dmm-page .dmm-stat-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.dmm-stat-card {
  border: 1px solid var(--dmm-border);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--dmm-surface-raised);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dmm-stat-label {
  font-size: 12px;
  color: var(--dmm-fg-muted);
}

.dmm-stat-value {
  font-variant-numeric: tabular-nums;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--dmm-fg);
}

.dmm-progress {
  width: 100%;
  height: 7px;
  border-radius: 999px;
  background: var(--dmm-surface-active);
  overflow: hidden;
  margin-top: 6px;
}

.dmm-progress-fill {
  height: 100%;
  background: var(--dmm-accent);
  border-radius: 999px;
  transition: width 200ms ease;
}

.dmm-dist-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.dmm-page .dmm-dist-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.dmm-dist-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  background: var(--dmm-surface);
  border: 1px solid var(--dmm-border-subtle);
  font-size: 12px;
}

/* \u2500\u2500 Dreamer Grid \u2500\u2500 */
.dmm-dreamer-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}

.dmm-page .dmm-dreamer-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* \u2500\u2500 Modal \u2500\u2500 */
.dmm-modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--dsw-alias-bg-mask-2, rgba(15, 17, 21, 0.48));
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.dmm-modal {
  width: min(520px, 100%);
  max-height: 86vh;
  overflow-y: auto;
  background: var(--dmm-bg);
  color: var(--dmm-fg);
  border: 1px solid var(--dmm-border-strong);
  border-radius: 14px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.24);
}

.dmm-modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--dmm-fg);
}

.dmm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dmm-field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.dmm-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--dmm-fg-secondary);
}

.dmm-pre {
  font-family: var(--dmm-mono);
  font-size: 12px;
  line-height: 1.5;
  background: var(--dmm-surface);
  color: var(--dmm-fg);
  border: 1px solid var(--dmm-border);
  border-radius: 8px;
  padding: 12px;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

/* \u2500\u2500 Settings Page \u2500\u2500 */
.dmm-settings-card {
  border: 1px solid var(--dmm-border);
  border-radius: 12px;
  background: var(--dmm-surface-raised);
  box-shadow: var(--dmm-card-shadow);
  display: flex;
  flex-direction: column;
}

.dmm-settings-head {
  padding: 14px 16px 12px;
  border-radius: 11px 11px 0 0;
  border-bottom: 1px solid var(--dmm-border-subtle);
  background: var(--dmm-surface);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.dmm-settings-body {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dmm-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 0;
  border-top: 1px solid var(--dmm-border-subtle);
}

.dmm-settings-row:first-child {
  border-top: none;
  padding-top: 2px;
}

.dmm-settings-row-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dmm-settings-row-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--dmm-fg);
}

.dmm-settings-row-hint {
  font-size: 12px;
  color: var(--dmm-fg-muted);
  line-height: 1.45;
}

.dmm-settings-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.dmm-settings-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.dmm-switch {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid var(--dmm-border);
  background: var(--dmm-surface-active);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 140ms ease, border-color 140ms ease;
}

.dmm-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--dsw-alias-switch-thumb, #ffffff);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  transition: transform 140ms ease;
}

.dmm-switch[aria-checked="true"] {
  background: var(--dmm-accent);
  border-color: var(--dmm-accent);
}

.dmm-switch[aria-checked="true"]::after {
  transform: translateX(16px);
  background: #ffffff;
}

.dmm-switch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2.5px var(--dmm-focus);
}

.dmm-preset-btn {
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  padding: 3px 9px;
  border-radius: 6px;
  border: 1px solid var(--dmm-border);
  background: var(--dmm-surface);
  color: var(--dmm-fg-secondary);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}

.dmm-preset-btn:hover {
  background: var(--dmm-surface-hover);
  border-color: var(--dmm-border-strong);
  color: var(--dmm-fg);
}

.dmm-test-result {
  font-size: 12px;
  padding: 8px 11px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1.45;
  word-break: break-word;
}

.dmm-test-ok {
  background: color-mix(in srgb, var(--dmm-ok) 11%, transparent);
  border: 1px solid color-mix(in srgb, var(--dmm-ok) 28%, transparent);
  color: var(--dmm-ok);
}

.dmm-test-fail {
  background: color-mix(in srgb, var(--dmm-danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--dmm-danger) 28%, transparent);
  color: var(--dmm-danger);
}

.dmm-save-bar {
  margin-top: 4px;
  padding: 11px 14px;
  border-radius: 11px;
  border: 1px solid var(--dmm-border);
  background: var(--dmm-surface);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.dmm-save-bar[data-dirty="true"] {
  position: sticky;
  bottom: 8px;
  z-index: 10;
  border-color: var(--dmm-accent-border);
  background: var(--dmm-surface-raised);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
}

/* \u2500\u2500 Conversation Header Action Button \u2500\u2500 */
.dmm-header-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  padding: 0 9px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #5b6270);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms ease, color 120ms ease;
}

.dmm-header-action-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, 0.08));
  color: var(--dsw-alias-label-primary, #0f1115);
}

/* \u2500\u2500 Scrollbars & Motion \u2500\u2500 */
.dmm-body::-webkit-scrollbar,
.dmm-pre::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.dmm-body::-webkit-scrollbar-track,
.dmm-pre::-webkit-scrollbar-track {
  background: transparent;
}

.dmm-body::-webkit-scrollbar-thumb,
.dmm-pre::-webkit-scrollbar-thumb {
  background: var(--dsw-alias-scrollbar-bg-l1, rgba(128, 128, 128, 0.3));
  border-radius: 999px;
}

.dmm-body::-webkit-scrollbar-thumb:hover,
.dmm-pre::-webkit-scrollbar-thumb:hover {
  background: var(--dsw-alias-scrollbar-hover-l1, rgba(128, 128, 128, 0.5));
}

@keyframes dmm-spin {
  to {
    transform: rotate(360deg);
  }
}

.dmm-spin {
  animation: dmm-spin 0.9s linear infinite;
}

@media (max-width: 680px) {
  .dmm-page .dmm-root {
    padding: 12px 14px 0;
  }
  .dmm-page .dmm-stat-grid,
  .dmm-page .dmm-dist-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .dmm-page .dmm-dreamer-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .dmm-field-row,
  .dmm-settings-form-grid,
  .dmm-settings-grid-3 {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dmm-root *,
  .dmm-spin {
    transition: none !important;
    animation: none !important;
  }
}
`;
function ensureMagicMemoryStyles() {
  if (typeof document > "u" || !document.head) return;
  let existing = document.getElementById(STYLE_ELEMENT_ID);
  if (existing) {
    existing.textContent = MAGIC_MEMORY_CSS;
    return;
  }
  let style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID, style.setAttribute("data-plugin", "dsh-magic-memory"), style.textContent = MAGIC_MEMORY_CSS, document.head.appendChild(style);
}

// src/client/components/DreamerTab.tsx
var import_react2 = __toESM(require("react"), 1);

// src/client/components/ui-helpers.tsx
var import_react = __toESM(require("react"), 1), CATEGORY_COLORS = {
  PROJECT_RULES: "#4176e6",
  ARCHITECTURE: "#8b5cf6",
  CONSTRAINTS: "#f59e0b",
  CONFIG_VALUES: "#14b8a6",
  NAMING: "#ec4899",
  USER_PROFILE: "#22c55e"
};
function getCategoryLabel(t, category) {
  return t(`cat.${category}`);
}
function getVerificationLabel(t, state) {
  return state === "verified" ? t("verify.verified") : state === "stale" ? t("verify.stale") : state === "conflict" ? t("verify.conflict") : state === "unverified" ? t("verify.unverified") : state;
}
function getSourceKindLabel(t, sourceKind) {
  return sourceKind === "manual" ? t("source.manual") : sourceKind === "auto_extracted" ? t("source.auto_extracted") : sourceKind === "dreamer_promoted" ? t("source.dreamer_promoted") : sourceKind === "tool" ? t("source.tool") : sourceKind === "imported" ? t("source.imported") : sourceKind;
}
function CategoryDot({ category }) {
  return /* @__PURE__ */ import_react.default.createElement(
    "span",
    {
      className: "dmm-dot",
      style: { backgroundColor: CATEGORY_COLORS[category] ?? "#6b7280" },
      "aria-hidden": "true"
    }
  );
}
function RefreshIcon({ size = 14, spinning = !1 }) {
  return /* @__PURE__ */ import_react.default.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.85,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className: spinning ? "dmm-spin" : void 0,
      "aria-hidden": "true"
    },
    /* @__PURE__ */ import_react.default.createElement("path", { d: "M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }),
    /* @__PURE__ */ import_react.default.createElement("path", { d: "M3 3v5h5" }),
    /* @__PURE__ */ import_react.default.createElement("path", { d: "M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" }),
    /* @__PURE__ */ import_react.default.createElement("path", { d: "M16 16h5v5" })
  );
}
function SearchIcon({ size = 14 }) {
  return /* @__PURE__ */ import_react.default.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.85,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    /* @__PURE__ */ import_react.default.createElement("circle", { cx: "11", cy: "11", r: "7" }),
    /* @__PURE__ */ import_react.default.createElement("path", { d: "m20 20-3.5-3.5" })
  );
}
function LayersEmptyIcon({ size = 20 }) {
  return /* @__PURE__ */ import_react.default.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.65,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    /* @__PURE__ */ import_react.default.createElement("path", { d: "m12 3 9 4.5-9 4.5-9-4.5L12 3Z" }),
    /* @__PURE__ */ import_react.default.createElement("path", { d: "m3 12 9 4.5 9-4.5" }),
    /* @__PURE__ */ import_react.default.createElement("path", { d: "m3 16.5 9 4.5 9-4.5" })
  );
}
function NoteEmptyIcon({ size = 18 }) {
  return /* @__PURE__ */ import_react.default.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.65,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    /* @__PURE__ */ import_react.default.createElement("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" }),
    /* @__PURE__ */ import_react.default.createElement("path", { d: "M14 2v6h6" }),
    /* @__PURE__ */ import_react.default.createElement("path", { d: "M8 13h8M8 17h5" })
  );
}
function HistoryEmptyIcon({ size = 18 }) {
  return /* @__PURE__ */ import_react.default.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.65,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    /* @__PURE__ */ import_react.default.createElement("circle", { cx: "12", cy: "12", r: "9" }),
    /* @__PURE__ */ import_react.default.createElement("path", { d: "M12 7v5l3 2" })
  );
}
function ActivityEmptyIcon({ size = 18 }) {
  return /* @__PURE__ */ import_react.default.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.65,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    /* @__PURE__ */ import_react.default.createElement("path", { d: "M3 12h4l3-7 4 14 3-7h4" })
  );
}
function SettingsIcon({ size = 14 }) {
  return /* @__PURE__ */ import_react.default.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.8,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    /* @__PURE__ */ import_react.default.createElement("circle", { cx: "12", cy: "12", r: "3" }),
    /* @__PURE__ */ import_react.default.createElement("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" })
  );
}
function CheckMiniIcon({ size = 12 }) {
  return /* @__PURE__ */ import_react.default.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2.2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    /* @__PURE__ */ import_react.default.createElement("path", { d: "M20 6 9 17l-5-5" })
  );
}
function FolderMiniIcon({ size = 13 }) {
  return /* @__PURE__ */ import_react.default.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.8,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    /* @__PURE__ */ import_react.default.createElement("path", { d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" })
  );
}

// src/client/components/DreamerTab.tsx
function statusClass(status) {
  return status === "success" ? "dmm-badge dmm-badge-ok" : status === "failed" ? "dmm-badge dmm-badge-danger" : status === "skipped" ? "dmm-badge dmm-badge-warn" : "dmm-badge";
}
function formatTime(ts, neverLabel) {
  if (ts === null) return neverLabel;
  try {
    return new Date(ts).toLocaleTimeString(void 0, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(ts);
  }
}
function DreamerTab({
  api,
  projectId,
  enabled,
  tasks,
  recentRuns,
  t,
  onMutated,
  onError,
  onNotice
}) {
  let [runningTask, setRunningTask] = (0, import_react2.useState)(null), runDream = async (taskName) => {
    let label = taskName ?? "ALL";
    setRunningTask(label);
    try {
      let res = await api.runDreamer({ projectId, taskName }), okCount = res.runs.filter((r) => r.status === "success").length, failCount = res.runs.filter((r) => r.status === "failed").length;
      onNotice(
        `Dreamer (${label}) finished: ${okCount} succeeded, ${res.runs.length - okCount - failCount} skipped, ${failCount} failed.`
      ), onMutated();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningTask(null);
    }
  };
  return /* @__PURE__ */ import_react2.default.createElement("div", { className: "dmm-stack" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "dmm-section-head" }, /* @__PURE__ */ import_react2.default.createElement("div", null, /* @__PURE__ */ import_react2.default.createElement("div", { className: "dmm-row" }, /* @__PURE__ */ import_react2.default.createElement("h3", { className: "dmm-section-title" }, t("dreamer.title")), /* @__PURE__ */ import_react2.default.createElement("span", { className: enabled ? "dmm-badge dmm-badge-ok" : "dmm-badge dmm-badge-warn" }, t(enabled ? "dreamer.enabled" : "dreamer.disabled"))), /* @__PURE__ */ import_react2.default.createElement("p", { className: "dmm-section-desc" }, t("dreamer.subtitle"))), /* @__PURE__ */ import_react2.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-btn dmm-btn-primary",
      disabled: runningTask !== null,
      onClick: () => void runDream()
    },
    t(runningTask === "ALL" ? "dreamer.running" : "dreamer.runAll")
  )), /* @__PURE__ */ import_react2.default.createElement("div", { className: "dmm-dreamer-grid" }, tasks.map((task) => {
    let labelKey = `dreamer.task.${task.taskName}`;
    return /* @__PURE__ */ import_react2.default.createElement("div", { key: task.taskName, className: "dmm-card" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "dmm-row-between" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "dmm-row" }, /* @__PURE__ */ import_react2.default.createElement("span", { className: "dmm-card-title" }, t(labelKey)), /* @__PURE__ */ import_react2.default.createElement("span", { className: "dmm-badge dmm-badge-mono" }, task.taskName)), /* @__PURE__ */ import_react2.default.createElement(
      "button",
      {
        type: "button",
        className: "dmm-btn dmm-btn-sm",
        disabled: runningTask !== null,
        onClick: () => void runDream(task.taskName)
      },
      runningTask === task.taskName ? t("dreamer.running") : t("dreamer.runOne")
    )), /* @__PURE__ */ import_react2.default.createElement("div", { className: "dmm-meta" }, /* @__PURE__ */ import_react2.default.createElement("span", null, t("dreamer.backlog", { count: task.backlogCount })), /* @__PURE__ */ import_react2.default.createElement("span", null, task.intervalMinutes > 0 ? t("dreamer.interval", { minutes: task.intervalMinutes }) : t("dreamer.intervalOff")), /* @__PURE__ */ import_react2.default.createElement("span", null, t("dreamer.lastRun", { time: formatTime(task.lastRunAt, t("dreamer.never")) })), /* @__PURE__ */ import_react2.default.createElement("span", { className: statusClass(task.lastStatus) }, task.lastStatus), task.consecutiveFailures > 0 && /* @__PURE__ */ import_react2.default.createElement("span", { className: "dmm-badge dmm-badge-danger" }, t("dreamer.failures", { count: task.consecutiveFailures }))), task.lastError && /* @__PURE__ */ import_react2.default.createElement("div", { style: { fontSize: 12, color: "var(--dmm-danger)" } }, task.lastError));
  })), /* @__PURE__ */ import_react2.default.createElement("div", { className: "dmm-section-head", style: { marginTop: 4 } }, /* @__PURE__ */ import_react2.default.createElement("h3", { className: "dmm-section-title" }, t("dreamer.recentRuns"))), recentRuns.length === 0 ? /* @__PURE__ */ import_react2.default.createElement("div", { className: "dmm-empty" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "dmm-empty-icon" }, /* @__PURE__ */ import_react2.default.createElement(HistoryEmptyIcon, { size: 18 })), /* @__PURE__ */ import_react2.default.createElement("p", { className: "dmm-empty-desc" }, t("dreamer.noRuns"))) : /* @__PURE__ */ import_react2.default.createElement("div", { className: "dmm-stack" }, recentRuns.map((run) => /* @__PURE__ */ import_react2.default.createElement("div", { key: run.id, className: "dmm-card" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "dmm-row-between" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "dmm-row" }, /* @__PURE__ */ import_react2.default.createElement("span", { className: "dmm-badge dmm-badge-mono" }, run.taskName), /* @__PURE__ */ import_react2.default.createElement("span", { className: statusClass(run.status) }, run.status), /* @__PURE__ */ import_react2.default.createElement("span", { className: "dmm-badge" }, run.trigger)), /* @__PURE__ */ import_react2.default.createElement("span", { className: "dmm-meta" }, run.durationMs, "ms")), /* @__PURE__ */ import_react2.default.createElement("div", { className: "dmm-card-content" }, run.errorMessage ?? run.summary), /* @__PURE__ */ import_react2.default.createElement("div", { className: "dmm-meta" }, /* @__PURE__ */ import_react2.default.createElement("span", null, "processed: ", run.itemsProcessed), /* @__PURE__ */ import_react2.default.createElement("span", null, "mutations: ", run.mutationsApplied), run.modelUsed && /* @__PURE__ */ import_react2.default.createElement("span", { className: "dmm-meta-files" }, run.modelUsed))))));
}

// src/client/components/EpisodesNotesTab.tsx
var import_react3 = __toESM(require("react"), 1);
function formatShortTime(ts) {
  try {
    return new Date(ts).toLocaleString(void 0, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(ts);
  }
}
function EpisodesNotesTab({
  api,
  projectId,
  sessionId,
  t,
  refreshToken,
  onMutated,
  onError,
  onNotice
}) {
  let [episodes, setEpisodes] = (0, import_react3.useState)([]), [notes, setNotes] = (0, import_react3.useState)([]), [loading, setLoading] = (0, import_react3.useState)(!1), [extracting, setExtracting] = (0, import_react3.useState)(!1), [showAddNote, setShowAddNote] = (0, import_react3.useState)(!1), [noteTitle, setNoteTitle] = (0, import_react3.useState)(""), [noteContent, setNoteContent] = (0, import_react3.useState)(""), [noteSessionOnly, setNoteSessionOnly] = (0, import_react3.useState)(!1);
  (0, import_react3.useEffect)(() => {
    let controller = new AbortController();
    return setLoading(!0), Promise.all([
      api.listEpisodes({ projectId, limit: 40 }, controller.signal),
      api.listNotes({ projectId, includeDismissed: !1 }, controller.signal)
    ]).then(([epRes, noteRes]) => {
      controller.signal.aborted || (setEpisodes(epRes.episodes), setNotes(noteRes.notes));
    }).catch((err) => {
      controller.signal.aborted || onError(err instanceof Error ? err.message : String(err));
    }).finally(() => {
      controller.signal.aborted || setLoading(!1);
    }), () => controller.abort();
  }, [api, projectId, refreshToken, onError]);
  let handleExtract = async () => {
    if (!sessionId) {
      onNotice(t("episodes.noSession"));
      return;
    }
    setExtracting(!0);
    try {
      let res = await api.extractNow({ projectId, sessionId });
      res.status === "extracted" ? (onNotice(
        `Extracted episode "${res.episode?.title ?? ""}" (+${res.factsPromoted} facts, ${res.factsDeduplicated} deduped, ${res.observationsRecorded} observations)`
      ), onMutated()) : onNotice(res.reason ?? `Extraction ${res.status}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(!1);
    }
  }, handleCreateNote = async (e) => {
    if (e.preventDefault(), !(!noteTitle.trim() || !noteContent.trim()))
      try {
        await api.createNote({
          projectId,
          sessionId,
          title: noteTitle.trim(),
          content: noteContent.trim(),
          sessionOnly: noteSessionOnly
        }), setNoteTitle(""), setNoteContent(""), setNoteSessionOnly(!1), setShowAddNote(!1), onNotice("Note saved"), onMutated();
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      }
  }, handleDismissNote = async (id) => {
    try {
      await api.dismissNote({ projectId, id }), onMutated();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };
  return /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-stack" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-section-head" }, /* @__PURE__ */ import_react3.default.createElement("h3", { className: "dmm-section-title" }, t("notes.title")), /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-row" }, /* @__PURE__ */ import_react3.default.createElement("button", { type: "button", className: "dmm-btn", onClick: () => setShowAddNote((v) => !v) }, "+ ", t("notes.add")), /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-btn dmm-btn-primary",
      disabled: extracting || !sessionId,
      title: sessionId ? void 0 : t("episodes.noSession"),
      onClick: () => void handleExtract()
    },
    t(extracting ? "episodes.extracting" : "episodes.extractNow")
  ))), showAddNote && /* @__PURE__ */ import_react3.default.createElement("form", { className: "dmm-card dmm-card-muted", onSubmit: (e) => void handleCreateNote(e) }, /* @__PURE__ */ import_react3.default.createElement(
    "input",
    {
      type: "text",
      className: "dmm-input",
      required: !0,
      placeholder: t("notes.titlePlaceholder"),
      value: noteTitle,
      onChange: (e) => setNoteTitle(e.target.value)
    }
  ), /* @__PURE__ */ import_react3.default.createElement(
    "textarea",
    {
      className: "dmm-textarea",
      rows: 3,
      required: !0,
      placeholder: t("notes.contentPlaceholder"),
      value: noteContent,
      onChange: (e) => setNoteContent(e.target.value)
    }
  ), /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-row-between" }, /* @__PURE__ */ import_react3.default.createElement("label", { className: "dmm-checkbox" }, /* @__PURE__ */ import_react3.default.createElement(
    "input",
    {
      type: "checkbox",
      checked: noteSessionOnly,
      onChange: (e) => setNoteSessionOnly(e.target.checked)
    }
  ), /* @__PURE__ */ import_react3.default.createElement("span", null, t("notes.sessionOnly"))), /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-row" }, /* @__PURE__ */ import_react3.default.createElement("button", { type: "button", className: "dmm-btn", onClick: () => setShowAddNote(!1) }, t("modal.cancel")), /* @__PURE__ */ import_react3.default.createElement("button", { type: "submit", className: "dmm-btn dmm-btn-primary" }, t("notes.save"))))), notes.length === 0 ? /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-empty" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-empty-icon" }, /* @__PURE__ */ import_react3.default.createElement(NoteEmptyIcon, { size: 18 })), /* @__PURE__ */ import_react3.default.createElement("p", { className: "dmm-empty-desc" }, t(loading ? "header.loading" : "notes.empty"))) : /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-stack" }, notes.map((note) => /* @__PURE__ */ import_react3.default.createElement("article", { key: note.id, className: "dmm-card" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-row-between" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-row" }, /* @__PURE__ */ import_react3.default.createElement("span", { className: "dmm-badge dmm-badge-mono" }, "#", note.id), /* @__PURE__ */ import_react3.default.createElement("span", { className: "dmm-card-title" }, note.title)), /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-btn dmm-btn-ghost dmm-btn-danger",
      onClick: () => void handleDismissNote(note.id)
    },
    t("notes.dismiss")
  )), /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-card-content" }, note.content), /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-meta" }, /* @__PURE__ */ import_react3.default.createElement("span", null, formatShortTime(note.updatedAt)), note.sessionId && /* @__PURE__ */ import_react3.default.createElement("span", { className: "dmm-meta-files" }, "session ", note.sessionId.slice(0, 8)))))), /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-section-head", style: { marginTop: 6 } }, /* @__PURE__ */ import_react3.default.createElement("h3", { className: "dmm-section-title" }, t("episodes.title"))), episodes.length === 0 ? /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-empty" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-empty-icon" }, /* @__PURE__ */ import_react3.default.createElement(HistoryEmptyIcon, { size: 18 })), /* @__PURE__ */ import_react3.default.createElement("h4", { className: "dmm-empty-title" }, t(loading ? "header.loading" : "episodes.empty")), !loading && /* @__PURE__ */ import_react3.default.createElement("p", { className: "dmm-empty-desc" }, t("episodes.emptyHint"))) : /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-stack" }, episodes.map((ep) => /* @__PURE__ */ import_react3.default.createElement("article", { key: ep.id, className: "dmm-card" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-row-between" }, /* @__PURE__ */ import_react3.default.createElement("span", { className: "dmm-card-title" }, ep.title), /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-row" }, /* @__PURE__ */ import_react3.default.createElement("span", { className: "dmm-badge dmm-badge-accent" }, ep.episodeType), /* @__PURE__ */ import_react3.default.createElement("span", { className: "dmm-badge dmm-badge-mono" }, "imp ", ep.importance))), /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-card-content" }, ep.summary), ep.keyDecisions.length > 0 && /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-decisions" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-decisions-title" }, t("episodes.decisions")), /* @__PURE__ */ import_react3.default.createElement("ul", null, ep.keyDecisions.map((d, idx) => /* @__PURE__ */ import_react3.default.createElement("li", { key: idx }, d)))), /* @__PURE__ */ import_react3.default.createElement("div", { className: "dmm-meta" }, /* @__PURE__ */ import_react3.default.createElement("span", { className: "dmm-meta-files" }, "session ", ep.sessionId.slice(0, 8)), /* @__PURE__ */ import_react3.default.createElement("span", null, "seq ", ep.startSeq, "\u2013", ep.endSeq), /* @__PURE__ */ import_react3.default.createElement("span", null, formatShortTime(ep.createdAt)))))));
}

// src/client/components/MemoriesTab.tsx
var import_react5 = __toESM(require("react"), 1);

// src/shared/types.ts
var MEMORY_CATEGORIES = [
  "PROJECT_RULES",
  "ARCHITECTURE",
  "CONSTRAINTS",
  "CONFIG_VALUES",
  "NAMING",
  "USER_PROFILE"
], PROJECT_MEMORY_CATEGORIES = [
  "PROJECT_RULES",
  "ARCHITECTURE",
  "CONSTRAINTS",
  "CONFIG_VALUES",
  "NAMING"
];

// src/client/components/SelectMenu.tsx
var import_react4 = __toESM(require("react"), 1);
function ChevronDownIcon({ open }) {
  return /* @__PURE__ */ import_react4.default.createElement(
    "svg",
    {
      width: 13,
      height: 13,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className: `dmm-dd-chevron${open ? " dmm-dd-chevron-open" : ""}`,
      "aria-hidden": "true"
    },
    /* @__PURE__ */ import_react4.default.createElement("path", { d: "m6 9 6 6 6-6" })
  );
}
function SelectMenu({
  id,
  ariaLabel,
  value,
  options,
  onChange,
  compact = !1,
  align = "left",
  leadingIcon,
  placeholder = "",
  disabled = !1
}) {
  let [open, setOpen] = (0, import_react4.useState)(!1), [highlightedIndex, setHighlightedIndex] = (0, import_react4.useState)(-1), rootRef = (0, import_react4.useRef)(null), listboxId = (0, import_react4.useId)(), selectedIndex = options.findIndex((o) => o.value === value), selectedOption = selectedIndex >= 0 ? options[selectedIndex] : void 0;
  (0, import_react4.useEffect)(() => {
    if (!open) return;
    let handlePointerDown = (e) => {
      rootRef.current && !rootRef.current.contains(e.target) && setOpen(!1);
    }, handleKeyDown = (e) => {
      e.key === "Escape" && (e.stopPropagation(), setOpen(!1));
    };
    return document.addEventListener("mousedown", handlePointerDown), window.addEventListener("keydown", handleKeyDown, !0), () => {
      document.removeEventListener("mousedown", handlePointerDown), window.removeEventListener("keydown", handleKeyDown, !0);
    };
  }, [open]);
  let toggleOpen = () => {
    disabled || setOpen((prev) => {
      let next = !prev;
      return next && setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0), next;
    });
  }, commit = (nextValue) => {
    onChange(nextValue), setOpen(!1);
  }, handleTriggerKeyDown = (e) => {
    if (!disabled)
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (e.preventDefault(), !open) {
          setOpen(!0), setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
          return;
        }
        let delta = e.key === "ArrowDown" ? 1 : -1;
        setHighlightedIndex((idx) => options.length === 0 ? -1 : ((idx < 0 ? 0 : idx) + delta + options.length) % options.length);
      } else (e.key === "Enter" || e.key === " ") && open && highlightedIndex >= 0 && options[highlightedIndex] && (e.preventDefault(), commit(options[highlightedIndex].value));
  }, renderedSections = [], groupBuckets = /* @__PURE__ */ new Map();
  return options.forEach((opt, flatIndex) => {
    let gKey = opt.group ?? "__ungrouped__";
    if (!opt.group) {
      renderedSections.push({ items: [{ opt, flatIndex }] });
      return;
    }
    let bucket = groupBuckets.get(gKey);
    bucket || (bucket = { group: opt.group, items: [] }, groupBuckets.set(gKey, bucket), renderedSections.push(bucket)), bucket.items.push({ opt, flatIndex });
  }), /* @__PURE__ */ import_react4.default.createElement(
    "div",
    {
      ref: rootRef,
      className: `dmm-dd${compact ? " dmm-dd-compact" : ""}`,
      "data-open": open
    },
    /* @__PURE__ */ import_react4.default.createElement(
      "button",
      {
        id,
        type: "button",
        role: "combobox",
        "aria-label": ariaLabel,
        "aria-haspopup": "listbox",
        "aria-expanded": open,
        "aria-controls": listboxId,
        disabled,
        className: `dmm-dd-trigger${compact ? " dmm-dd-trigger-compact" : ""}`,
        onClick: toggleOpen,
        onKeyDown: handleTriggerKeyDown
      },
      /* @__PURE__ */ import_react4.default.createElement("span", { className: "dmm-dd-value" }, leadingIcon && /* @__PURE__ */ import_react4.default.createElement("span", { className: "dmm-dd-leading" }, leadingIcon), selectedOption?.dotColor && /* @__PURE__ */ import_react4.default.createElement("span", { className: "dmm-dot", style: { backgroundColor: selectedOption.dotColor }, "aria-hidden": "true" }), /* @__PURE__ */ import_react4.default.createElement("span", { className: "dmm-dd-label" }, selectedOption ? selectedOption.label : placeholder)),
      /* @__PURE__ */ import_react4.default.createElement(ChevronDownIcon, { open })
    ),
    open && /* @__PURE__ */ import_react4.default.createElement(
      "div",
      {
        id: listboxId,
        role: "listbox",
        "aria-label": ariaLabel,
        className: `dmm-dd-menu${align === "right" ? " dmm-dd-menu-right" : ""}`
      },
      renderedSections.map((section, sIdx) => /* @__PURE__ */ import_react4.default.createElement("div", { key: section.group ?? `s-${sIdx}`, className: "dmm-dd-section" }, section.group && /* @__PURE__ */ import_react4.default.createElement("div", { className: "dmm-dd-group-label" }, section.group), section.items.map(({ opt, flatIndex }) => {
        let isSelected = opt.value === value, isHighlighted = flatIndex === highlightedIndex;
        return /* @__PURE__ */ import_react4.default.createElement(
          "button",
          {
            key: opt.value,
            type: "button",
            role: "option",
            "aria-selected": isSelected,
            className: "dmm-dd-item",
            "data-selected": isSelected,
            "data-highlighted": isHighlighted,
            onMouseEnter: () => setHighlightedIndex(flatIndex),
            onClick: () => commit(opt.value)
          },
          /* @__PURE__ */ import_react4.default.createElement("span", { className: "dmm-dd-item-main" }, opt.dotColor && /* @__PURE__ */ import_react4.default.createElement("span", { className: "dmm-dot", style: { backgroundColor: opt.dotColor }, "aria-hidden": "true" }), /* @__PURE__ */ import_react4.default.createElement("span", { className: "dmm-dd-item-text" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "dmm-dd-item-label" }, opt.label), opt.sublabel && /* @__PURE__ */ import_react4.default.createElement("span", { className: "dmm-dd-item-sub" }, opt.sublabel))),
          isSelected && /* @__PURE__ */ import_react4.default.createElement("span", { className: "dmm-dd-check" }, /* @__PURE__ */ import_react4.default.createElement(CheckMiniIcon, { size: 13 }))
        );
      })))
    )
  );
}

// src/client/components/MemoriesTab.tsx
function renderVerificationStatus(state, t) {
  return state === "verified" ? /* @__PURE__ */ import_react5.default.createElement("span", { className: "dmm-status-inline" }, /* @__PURE__ */ import_react5.default.createElement(CheckMiniIcon, { size: 12 }), /* @__PURE__ */ import_react5.default.createElement("span", null, getVerificationLabel(t, state))) : state === "stale" ? /* @__PURE__ */ import_react5.default.createElement("span", { className: "dmm-badge dmm-badge-warn" }, getVerificationLabel(t, state)) : state === "conflict" ? /* @__PURE__ */ import_react5.default.createElement("span", { className: "dmm-badge dmm-badge-danger" }, getVerificationLabel(t, state)) : /* @__PURE__ */ import_react5.default.createElement("span", { className: "dmm-id-tag" }, getVerificationLabel(t, state));
}
function MemoriesTab({
  api,
  projectId,
  sessionId,
  t,
  refreshToken,
  onMutated,
  onError,
  onNotice
}) {
  let [scope, setScope] = (0, import_react5.useState)("all"), [status, setStatus] = (0, import_react5.useState)("active"), [category, setCategory] = (0, import_react5.useState)("ALL"), [memories, setMemories] = (0, import_react5.useState)([]), [loading, setLoading] = (0, import_react5.useState)(!1), [query, setQuery] = (0, import_react5.useState)(""), [searchHits, setSearchHits] = (0, import_react5.useState)(null), [searchUsedVector, setSearchUsedVector] = (0, import_react5.useState)(!1), [searching, setSearching] = (0, import_react5.useState)(!1), [editor, setEditor] = (0, import_react5.useState)(null), [saving, setSaving] = (0, import_react5.useState)(!1), hasActiveFilter = scope !== "all" || status !== "active" || category !== "ALL";
  (0, import_react5.useEffect)(() => {
    let controller = new AbortController();
    return setLoading(!0), api.listMemories(
      {
        projectId,
        scope,
        status,
        category: category === "ALL" ? void 0 : category,
        limit: 200
      },
      controller.signal
    ).then((res) => {
      controller.signal.aborted || setMemories(res.memories);
    }).catch((err) => {
      controller.signal.aborted || onError(err instanceof Error ? err.message : String(err));
    }).finally(() => {
      controller.signal.aborted || setLoading(!1);
    }), () => controller.abort();
  }, [api, projectId, scope, status, category, refreshToken, onError]), (0, import_react5.useEffect)(() => {
    if (!editor) return;
    let onKeyDown = (e) => {
      e.key === "Escape" && setEditor(null);
    };
    return window.addEventListener("keydown", onKeyDown), () => window.removeEventListener("keydown", onKeyDown);
  }, [editor]);
  let resetFilters = () => {
    setScope("all"), setStatus("active"), setCategory("ALL");
  }, runSearch = async (e) => {
    e && e.preventDefault();
    let trimmed = query.trim();
    if (!trimmed) {
      setSearchHits(null);
      return;
    }
    setSearching(!0);
    try {
      let res = await api.searchMemories({
        projectId,
        sessionId,
        query: trimmed,
        categories: category === "ALL" ? void 0 : [category],
        limit: 25
      });
      setSearchHits([...res.hits]), setSearchUsedVector(res.usedVectorSearch);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(!1);
    }
  }, openCreateModal = () => {
    setEditor({
      mode: "create",
      scope: scope === "global" ? "global" : "project",
      category: scope === "global" ? "USER_PROFILE" : category === "ALL" || category === "USER_PROFILE" ? "PROJECT_RULES" : category,
      importance: 65,
      pinned: !1,
      content: ""
    });
  }, openEditModal = (mem) => {
    setEditor({
      mode: "edit",
      id: mem.id,
      scope: mem.scope,
      category: mem.category,
      importance: mem.importance,
      pinned: mem.pinned,
      content: mem.content
    });
  }, handleSave = async (e) => {
    if (e.preventDefault(), !editor) return;
    let text = editor.content.trim();
    if (text) {
      setSaving(!0);
      try {
        if (editor.mode === "create") {
          let res = await api.createMemory({
            projectId,
            sessionId,
            scope: editor.scope,
            category: editor.scope === "global" ? "USER_PROFILE" : editor.category,
            importance: editor.importance,
            pinned: editor.pinned,
            content: text
          });
          onNotice(res.action === "deduplicated" ? `Merged with existing #${res.memory.id}` : `Saved memory #${res.memory.id}`);
        } else editor.id !== void 0 && (await api.updateMemory({
          projectId,
          id: editor.id,
          category: editor.scope === "global" ? "USER_PROFILE" : editor.category,
          importance: editor.importance,
          pinned: editor.pinned,
          content: text
        }), onNotice(`Updated memory #${editor.id}`));
        setEditor(null), onMutated();
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(!1);
      }
    }
  }, togglePin = async (mem) => {
    try {
      await api.updateMemory({ projectId, id: mem.id, pinned: !mem.pinned }), onMutated();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }, handleArchiveOrRestore = async (mem) => {
    try {
      mem.status === "active" ? (await api.archiveMemory({ projectId, id: mem.id }), onNotice(`Archived #${mem.id}`)) : (await api.restoreMemory({ projectId, id: mem.id }), onNotice(`Restored #${mem.id}`)), onMutated();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };
  return /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-stack" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-filter-bar" }, /* @__PURE__ */ import_react5.default.createElement("form", { className: "dmm-search-bar", onSubmit: runSearch }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-search-wrap" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "dmm-search-icon" }, /* @__PURE__ */ import_react5.default.createElement(SearchIcon, { size: 15 })), /* @__PURE__ */ import_react5.default.createElement(
    "input",
    {
      type: "search",
      className: "dmm-input",
      "aria-label": t("memories.search"),
      placeholder: t("memories.searchPlaceholder"),
      value: query,
      onChange: (e) => {
        setQuery(e.target.value), e.target.value.trim().length === 0 && setSearchHits(null);
      }
    }
  ), /* @__PURE__ */ import_react5.default.createElement("button", { type: "submit", className: "dmm-search-submit", disabled: searching }, t("memories.search"))), searchHits !== null && /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-btn dmm-btn-ghost",
      onClick: () => {
        setQuery(""), setSearchHits(null);
      }
    },
    t("memories.clear")
  ), /* @__PURE__ */ import_react5.default.createElement("button", { type: "button", className: "dmm-btn dmm-btn-primary", onClick: openCreateModal }, "+ ", t("memories.add"))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-filter-strip" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-chips", role: "group", "aria-label": "Category filter" }, /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-chip",
      "data-active": category === "ALL",
      onClick: () => setCategory("ALL")
    },
    t("memories.allCategories")
  ), MEMORY_CATEGORIES.map((cat) => /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      key: cat,
      type: "button",
      className: "dmm-chip",
      "data-active": category === cat,
      title: cat,
      onClick: () => setCategory(cat)
    },
    /* @__PURE__ */ import_react5.default.createElement(CategoryDot, { category: cat }),
    /* @__PURE__ */ import_react5.default.createElement("span", null, getCategoryLabel(t, cat))
  ))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-row", style: { gap: 6 } }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-segmented", role: "group", "aria-label": "Scope filter" }, ["all", "project", "global"].map((s) => /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      key: s,
      type: "button",
      className: "dmm-seg-btn",
      "data-active": scope === s,
      onClick: () => setScope(s)
    },
    t(s === "all" ? "memories.scopeAll" : s === "project" ? "memories.scopeProject" : "memories.scopeGlobal")
  ))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-segmented", role: "group", "aria-label": "Status filter" }, /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-seg-btn",
      "data-active": status === "active",
      onClick: () => setStatus("active")
    },
    t("memories.statusActive")
  ), /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-seg-btn",
      "data-active": status === "archived",
      onClick: () => setStatus("archived")
    },
    t("memories.statusArchived")
  ))))), searchHits !== null ? /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-stack" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-section-head" }, /* @__PURE__ */ import_react5.default.createElement("h3", { className: "dmm-section-title" }, t("memories.searchResults", { count: searchHits.length })), /* @__PURE__ */ import_react5.default.createElement("span", { className: "dmm-badge" }, t(searchUsedVector ? "memories.vectorActive" : "memories.ftsOnly"))), searchHits.length === 0 ? /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-empty" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-empty-icon" }, /* @__PURE__ */ import_react5.default.createElement(SearchIcon, { size: 18 })), /* @__PURE__ */ import_react5.default.createElement("p", { className: "dmm-empty-desc" }, t("memories.emptyFiltered"))) : searchHits.map((hit) => /* @__PURE__ */ import_react5.default.createElement("div", { key: `${hit.source}-${hit.id}`, className: "dmm-card" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-row-between" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-row" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "dmm-badge dmm-badge-accent" }, hit.source.toUpperCase()), hit.category && /* @__PURE__ */ import_react5.default.createElement("span", { className: "dmm-cat-tag", title: hit.category }, /* @__PURE__ */ import_react5.default.createElement(CategoryDot, { category: hit.category }), /* @__PURE__ */ import_react5.default.createElement("span", null, getCategoryLabel(t, hit.category))), hit.workspaceLabel && /* @__PURE__ */ import_react5.default.createElement("span", { className: "dmm-badge" }, "WS: ", hit.workspaceLabel)), /* @__PURE__ */ import_react5.default.createElement("span", { className: "dmm-id-tag" }, "score ", hit.score.toFixed(2))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-card-content" }, hit.content)))) : loading && memories.length === 0 ? /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-empty" }, /* @__PURE__ */ import_react5.default.createElement("p", { className: "dmm-empty-desc" }, t("header.loading"))) : memories.length === 0 ? /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-empty" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-empty-icon" }, /* @__PURE__ */ import_react5.default.createElement(LayersEmptyIcon, { size: 20 })), /* @__PURE__ */ import_react5.default.createElement("h3", { className: "dmm-empty-title" }, t(hasActiveFilter ? "memories.emptyFiltered" : "memories.emptyTitle")), !hasActiveFilter && /* @__PURE__ */ import_react5.default.createElement("p", { className: "dmm-empty-desc" }, t("memories.empty")), hasActiveFilter ? /* @__PURE__ */ import_react5.default.createElement("button", { type: "button", className: "dmm-btn", onClick: resetFilters }, t("memories.resetFilters")) : /* @__PURE__ */ import_react5.default.createElement("button", { type: "button", className: "dmm-btn", onClick: openCreateModal }, t("memories.add"))) : /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-stack" }, memories.map((mem) => /* @__PURE__ */ import_react5.default.createElement("article", { key: mem.id, className: "dmm-card", "data-memory-id": mem.id }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-row-between" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-row", style: { gap: 10 } }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "dmm-cat-tag", title: mem.category }, /* @__PURE__ */ import_react5.default.createElement(CategoryDot, { category: mem.category }), /* @__PURE__ */ import_react5.default.createElement("span", null, getCategoryLabel(t, mem.category))), /* @__PURE__ */ import_react5.default.createElement("span", { className: "dmm-id-tag" }, "#", mem.id), mem.pinned && /* @__PURE__ */ import_react5.default.createElement("span", { className: "dmm-badge dmm-badge-accent" }, t("memories.pinnedBadge")), renderVerificationStatus(mem.verificationState, t)), /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-card-actions" }, /* @__PURE__ */ import_react5.default.createElement("button", { type: "button", className: "dmm-btn dmm-btn-ghost", onClick: () => openEditModal(mem) }, t("memories.edit")), /* @__PURE__ */ import_react5.default.createElement("button", { type: "button", className: "dmm-btn dmm-btn-ghost", onClick: () => void togglePin(mem) }, mem.pinned ? t("memories.unpin") : t("memories.pin")), /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      className: `dmm-btn dmm-btn-ghost ${mem.status === "active" ? "dmm-btn-danger" : ""}`,
      onClick: () => void handleArchiveOrRestore(mem)
    },
    mem.status === "active" ? t("memories.archive") : t("memories.restore")
  ))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-card-content" }, mem.content), /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-meta" }, /* @__PURE__ */ import_react5.default.createElement("span", null, t("memories.importance", { value: mem.importance })), /* @__PURE__ */ import_react5.default.createElement("span", null, t("memories.retrievals", { count: mem.retrievalCount })), /* @__PURE__ */ import_react5.default.createElement("span", null, getSourceKindLabel(t, mem.sourceKind)), mem.backingFiles.slice(0, 4).map((file) => /* @__PURE__ */ import_react5.default.createElement("span", { key: file, className: "dmm-meta-files" }, file)))))), editor && /* @__PURE__ */ import_react5.default.createElement(
    "div",
    {
      className: "dmm-modal-backdrop",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": editor.mode === "create" ? t("modal.createTitle") : t("modal.editTitle", { id: editor.id }),
      onClick: (e) => {
        e.target === e.currentTarget && setEditor(null);
      }
    },
    /* @__PURE__ */ import_react5.default.createElement("form", { className: "dmm-modal", onSubmit: (e) => void handleSave(e) }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-row-between" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "dmm-modal-title" }, editor.mode === "create" ? t("modal.createTitle") : t("modal.editTitle", { id: editor.id })), /* @__PURE__ */ import_react5.default.createElement("button", { type: "button", className: "dmm-btn dmm-btn-ghost", onClick: () => setEditor(null), "aria-label": "Close" }, "\u2715")), /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-field-row" }, editor.mode === "create" && /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-field" }, /* @__PURE__ */ import_react5.default.createElement("label", { className: "dmm-label", htmlFor: "dmm-scope" }, t("modal.scope")), /* @__PURE__ */ import_react5.default.createElement(
      SelectMenu,
      {
        id: "dmm-scope",
        ariaLabel: t("modal.scope"),
        value: editor.scope,
        options: [
          { value: "project", label: t("memories.scopeProject") },
          { value: "global", label: t("memories.scopeGlobal") }
        ],
        onChange: (val) => {
          let nextScope = val;
          setEditor({
            ...editor,
            scope: nextScope,
            category: nextScope === "global" ? "USER_PROFILE" : "PROJECT_RULES"
          });
        }
      }
    )), editor.scope !== "global" && /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-field" }, /* @__PURE__ */ import_react5.default.createElement("label", { className: "dmm-label", htmlFor: "dmm-category" }, t("modal.category")), /* @__PURE__ */ import_react5.default.createElement(
      SelectMenu,
      {
        id: "dmm-category",
        ariaLabel: t("modal.category"),
        value: editor.category,
        options: PROJECT_MEMORY_CATEGORIES.map((cat) => ({
          value: cat,
          label: getCategoryLabel(t, cat),
          sublabel: cat,
          dotColor: CATEGORY_COLORS[cat]
        })),
        onChange: (val) => setEditor({ ...editor, category: val })
      }
    ))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-field" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-row-between" }, /* @__PURE__ */ import_react5.default.createElement("label", { className: "dmm-label", htmlFor: "dmm-importance" }, t("modal.importance")), /* @__PURE__ */ import_react5.default.createElement("span", { className: "dmm-badge dmm-badge-mono" }, editor.importance)), /* @__PURE__ */ import_react5.default.createElement(
      "input",
      {
        id: "dmm-importance",
        className: "dmm-range",
        type: "range",
        min: 1,
        max: 100,
        value: editor.importance,
        onChange: (e) => setEditor({ ...editor, importance: Number(e.target.value) })
      }
    )), /* @__PURE__ */ import_react5.default.createElement("label", { className: "dmm-checkbox" }, /* @__PURE__ */ import_react5.default.createElement(
      "input",
      {
        type: "checkbox",
        checked: editor.pinned,
        onChange: (e) => setEditor({ ...editor, pinned: e.target.checked })
      }
    ), /* @__PURE__ */ import_react5.default.createElement("span", null, t("modal.pinLabel"))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-field" }, /* @__PURE__ */ import_react5.default.createElement("label", { className: "dmm-label", htmlFor: "dmm-content" }, t("modal.content")), /* @__PURE__ */ import_react5.default.createElement(
      "textarea",
      {
        id: "dmm-content",
        className: "dmm-textarea",
        rows: 4,
        required: !0,
        placeholder: t("modal.contentPlaceholder"),
        value: editor.content,
        onChange: (e) => setEditor({ ...editor, content: e.target.value })
      }
    )), /* @__PURE__ */ import_react5.default.createElement("div", { className: "dmm-row", style: { justifyContent: "flex-end" } }, /* @__PURE__ */ import_react5.default.createElement("button", { type: "button", className: "dmm-btn", onClick: () => setEditor(null) }, t("modal.cancel")), /* @__PURE__ */ import_react5.default.createElement(
      "button",
      {
        type: "submit",
        className: "dmm-btn dmm-btn-primary",
        disabled: saving || editor.content.trim().length === 0
      },
      t("modal.save")
    )))
  ));
}

// src/client/components/SettingsTab.tsx
var import_react6 = __toESM(require("react"), 1);
var AUTO_VALUE = "__auto__", CUSTOM_VALUE = "__custom__";
function encodeModelKey(provider, model) {
  return `${provider}::${model}`;
}
function decodeModelKey(val) {
  let idx = val.indexOf("::");
  return idx < 0 ? { provider: "", model: "" } : { provider: val.slice(0, idx), model: val.slice(idx + 2) };
}
function isRouteInCatalog(provider, model, catalog) {
  return !provider && !model ? !1 : catalog.some((m) => m.provider === provider && m.id === model);
}
function buildDraft(settings, catalog) {
  let extP = settings.extractor.provider.trim(), extM = settings.extractor.model.trim(), drmP = settings.dreamer.provider.trim(), drmM = settings.dreamer.model.trim(), separate = settings.dreamer.separateModel === !0 || extP !== drmP || extM !== drmM;
  return {
    enabled: settings.enabled,
    injectOnStart: settings.injectOnStart,
    reanchorAfterCompaction: settings.reanchorAfterCompaction,
    autoSearchEnabled: settings.autoSearch.enabled,
    baselineBudgetTokens: settings.baselineBudgetTokens,
    userProfileBudgetTokens: settings.userProfileBudgetTokens,
    deltaBudgetTokens: settings.deltaBudgetTokens,
    extractorEnabled: settings.extractor.enabled,
    extractorTriggerTokens: settings.extractor.triggerTokens,
    extractorProvider: extP,
    extractorModel: extM,
    extractorCustomMode: (extP.length > 0 || extM.length > 0) && !isRouteInCatalog(extP, extM, catalog),
    separateDreamerModel: separate,
    dreamerEnabled: settings.dreamer.enabled,
    dreamerTickMinutes: settings.dreamer.tickIntervalMinutes,
    dreamerProvider: drmP,
    dreamerModel: drmM,
    dreamerCustomMode: (drmP.length > 0 || drmM.length > 0) && !isRouteInCatalog(drmP, drmM, catalog),
    embeddingProvider: settings.embedding.provider,
    embeddingEndpoint: settings.embedding.endpoint,
    embeddingModel: settings.embedding.model,
    embeddingApiKeyInput: "",
    embeddingClearApiKey: !1,
    embeddingApiKeyEnv: settings.embedding.apiKeyEnv,
    embeddingTimeoutMs: settings.embedding.timeoutMs
  };
}
function SwitchControl({
  checked,
  onChange,
  label
}) {
  return /* @__PURE__ */ import_react6.default.createElement(
    "button",
    {
      type: "button",
      role: "switch",
      "aria-checked": checked,
      "aria-label": label,
      className: "dmm-switch",
      onClick: () => onChange(!checked)
    }
  );
}
function ModelSelector({
  id,
  label,
  provider,
  model,
  customMode,
  catalog,
  t,
  onSelectAuto,
  onSelectCatalog,
  onSelectCustom,
  onChangeProvider,
  onChangeModel
}) {
  let selectOptions = (0, import_react6.useMemo)(() => {
    let list = [
      { value: AUTO_VALUE, label: t("settings.routeAuto") }
    ];
    for (let m of catalog)
      list.push({
        value: encodeModelKey(m.provider, m.id),
        label: (m.name.includes(m.id), m.name),
        sublabel: m.name.includes(m.id) ? m.provider : `${m.provider} \xB7 ${m.id}`,
        group: m.providerName || m.provider
      });
    return list.push({ value: CUSTOM_VALUE, label: t("settings.routeCustom") }), list;
  }, [catalog, t]), selectValue = customMode ? CUSTOM_VALUE : provider && model ? encodeModelKey(provider, model) : AUTO_VALUE;
  return /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-field" }, /* @__PURE__ */ import_react6.default.createElement("label", { className: "dmm-label", htmlFor: id }, label), /* @__PURE__ */ import_react6.default.createElement(
    SelectMenu,
    {
      id,
      ariaLabel: label,
      value: selectValue,
      options: selectOptions,
      onChange: (val) => {
        if (val === AUTO_VALUE)
          onSelectAuto();
        else if (val === CUSTOM_VALUE)
          onSelectCustom();
        else {
          let parsed = decodeModelKey(val);
          onSelectCatalog(parsed.provider, parsed.model);
        }
      }
    }
  ), customMode && /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-form-grid", style: { marginTop: 4 } }, /* @__PURE__ */ import_react6.default.createElement(
    "input",
    {
      type: "text",
      className: "dmm-input",
      placeholder: t("settings.providerPlaceholder"),
      value: provider,
      onChange: (e) => onChangeProvider(e.target.value)
    }
  ), /* @__PURE__ */ import_react6.default.createElement(
    "input",
    {
      type: "text",
      className: "dmm-input",
      placeholder: t("settings.modelPlaceholder"),
      value: model,
      onChange: (e) => onChangeModel(e.target.value)
    }
  )));
}
function SettingsTab({
  api,
  projectId,
  t,
  refreshToken,
  onMutated,
  onError,
  onNotice
}) {
  let [serverState, setServerState] = (0, import_react6.useState)(null), [draft, setDraft] = (0, import_react6.useState)(null), [baseline, setBaseline] = (0, import_react6.useState)(null), [loading, setLoading] = (0, import_react6.useState)(!1), [saving, setSaving] = (0, import_react6.useState)(!1), [testingLlm, setTestingLlm] = (0, import_react6.useState)(!1), [llmTestResult, setLlmTestResult] = (0, import_react6.useState)(null), [testingDreamerLlm, setTestingDreamerLlm] = (0, import_react6.useState)(!1), [dreamerTestResult, setDreamerTestResult] = (0, import_react6.useState)(null), [testingEmb, setTestingEmb] = (0, import_react6.useState)(!1), [embTestResult, setEmbTestResult] = (0, import_react6.useState)(null), [reindexing, setReindexing] = (0, import_react6.useState)(!1), [reindexResult, setReindexResult] = (0, import_react6.useState)(null);
  (0, import_react6.useEffect)(() => {
    let controller = new AbortController();
    return setLoading(!0), api.getSettings(controller.signal).then((res) => {
      if (controller.signal.aborted) return;
      setServerState(res);
      let nextDraft = buildDraft(res.settings, res.availableModels);
      setDraft(nextDraft), setBaseline(nextDraft);
    }).catch((err) => {
      controller.signal.aborted || onError(err instanceof Error ? err.message : String(err));
    }).finally(() => {
      controller.signal.aborted || setLoading(!1);
    }), () => controller.abort();
  }, [api, refreshToken, onError]);
  let isDirty = (0, import_react6.useMemo)(() => !draft || !baseline ? !1 : JSON.stringify(draft) !== JSON.stringify(baseline), [draft, baseline]);
  if (!draft || !serverState)
    return /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-empty" }, /* @__PURE__ */ import_react6.default.createElement("p", { className: "dmm-empty-desc" }, t(loading ? "header.loading" : "settings.subtitle")));
  let catalog = serverState.availableModels, effectiveDreamerProvider = draft.separateDreamerModel ? draft.dreamerProvider : draft.extractorProvider, effectiveDreamerModel = draft.separateDreamerModel ? draft.dreamerModel : draft.extractorModel, extRouteStr = serverState.resolvedExtractorRoute ? `${serverState.resolvedExtractorRoute.provider} / ${serverState.resolvedExtractorRoute.model}` : t("settings.routeUnresolved"), drmRouteStr = serverState.resolvedDreamerRoute ? `${serverState.resolvedDreamerRoute.provider} / ${serverState.resolvedDreamerRoute.model}` : t("settings.routeUnresolved"), activeRouteLabel = extRouteStr === drmRouteStr ? extRouteStr : `Extractor: ${extRouteStr} \xB7 Dreamer: ${drmRouteStr}`, handleSave = async () => {
    setSaving(!0);
    try {
      let patch = {
        enabled: draft.enabled,
        injectOnStart: draft.injectOnStart,
        reanchorAfterCompaction: draft.reanchorAfterCompaction,
        baselineBudgetTokens: draft.baselineBudgetTokens,
        userProfileBudgetTokens: draft.userProfileBudgetTokens,
        deltaBudgetTokens: draft.deltaBudgetTokens,
        autoSearch: { enabled: draft.autoSearchEnabled },
        extractor: {
          enabled: draft.extractorEnabled,
          triggerTokens: draft.extractorTriggerTokens,
          provider: draft.extractorProvider.trim(),
          model: draft.extractorModel.trim()
        },
        dreamer: {
          enabled: draft.dreamerEnabled,
          tickIntervalMinutes: draft.dreamerTickMinutes,
          separateModel: draft.separateDreamerModel,
          provider: effectiveDreamerProvider.trim(),
          model: effectiveDreamerModel.trim()
        },
        embedding: {
          provider: draft.embeddingProvider,
          endpoint: draft.embeddingEndpoint.trim(),
          model: draft.embeddingModel.trim(),
          apiKeyEnv: draft.embeddingApiKeyEnv.trim(),
          timeoutMs: draft.embeddingTimeoutMs,
          ...draft.embeddingClearApiKey ? { clearApiKey: !0 } : draft.embeddingApiKeyInput.trim().length > 0 ? { apiKey: draft.embeddingApiKeyInput.trim() } : {}
        }
      }, updated = await api.updateSettings(patch);
      setServerState(updated);
      let nextDraft = buildDraft(updated.settings, updated.availableModels);
      setDraft(nextDraft), setBaseline(nextDraft), onNotice(t("settings.savedNotice")), onMutated();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(!1);
    }
  }, handleTestLlm = async () => {
    setTestingLlm(!0), setLlmTestResult(null);
    try {
      let res = await api.testLlm({
        provider: draft.extractorProvider.trim(),
        model: draft.extractorModel.trim()
      });
      setLlmTestResult(res);
    } catch (err) {
      setLlmTestResult({
        ok: !1,
        latencyMs: 0,
        route: null,
        message: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setTestingLlm(!1);
    }
  }, handleTestDreamerLlm = async () => {
    setTestingDreamerLlm(!0), setDreamerTestResult(null);
    try {
      let res = await api.testLlm({
        provider: draft.dreamerProvider.trim(),
        model: draft.dreamerModel.trim()
      });
      setDreamerTestResult(res);
    } catch (err) {
      setDreamerTestResult({
        ok: !1,
        latencyMs: 0,
        route: null,
        message: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setTestingDreamerLlm(!1);
    }
  }, handleTestEmbedding = async () => {
    setTestingEmb(!0), setEmbTestResult(null);
    try {
      let res = await api.testEmbedding({
        provider: draft.embeddingProvider,
        endpoint: draft.embeddingEndpoint.trim(),
        model: draft.embeddingModel.trim(),
        apiKey: draft.embeddingApiKeyInput.trim() || void 0,
        clearApiKey: draft.embeddingClearApiKey,
        apiKeyEnv: draft.embeddingApiKeyEnv.trim(),
        timeoutMs: draft.embeddingTimeoutMs
      });
      setEmbTestResult(res);
    } catch (err) {
      setEmbTestResult({
        ok: !1,
        latencyMs: 0,
        message: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setTestingEmb(!1);
    }
  }, handleReindex = async () => {
    setReindexing(!0), setReindexResult(null);
    try {
      let res = await api.reindexEmbeddings({ projectId });
      setReindexResult(res), onMutated();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setReindexing(!1);
    }
  }, applyEmbeddingPreset = (endpoint, model, apiKeyEnv) => {
    setDraft(
      (d) => d && {
        ...d,
        embeddingProvider: "openai-compatible",
        embeddingEndpoint: endpoint,
        embeddingModel: model,
        embeddingApiKeyEnv: apiKeyEnv
      }
    );
  };
  return /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-stack", "data-testid": "magic-memory-settings" }, /* @__PURE__ */ import_react6.default.createElement("section", { className: "dmm-settings-card" }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-head" }, /* @__PURE__ */ import_react6.default.createElement("div", null, /* @__PURE__ */ import_react6.default.createElement("h3", { className: "dmm-section-title" }, t("settings.llmSection")), /* @__PURE__ */ import_react6.default.createElement("p", { className: "dmm-section-desc" }, t("settings.llmDesc"))), /* @__PURE__ */ import_react6.default.createElement("span", { className: "dmm-badge dmm-badge-mono" }, t("settings.activeRoute", { route: activeRouteLabel }))), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-body" }, /* @__PURE__ */ import_react6.default.createElement(
    ModelSelector,
    {
      id: "dmm-llm-extractor-model",
      label: draft.separateDreamerModel ? t("settings.extractorModelLabel") : t("settings.sharedModelLabel"),
      provider: draft.extractorProvider,
      model: draft.extractorModel,
      customMode: draft.extractorCustomMode,
      catalog,
      t,
      onSelectAuto: () => setDraft(
        (d) => d && {
          ...d,
          extractorProvider: "",
          extractorModel: "",
          extractorCustomMode: !1,
          ...d.separateDreamerModel ? {} : { dreamerProvider: "", dreamerModel: "", dreamerCustomMode: !1 }
        }
      ),
      onSelectCatalog: (p, m) => setDraft(
        (d) => d && {
          ...d,
          extractorProvider: p,
          extractorModel: m,
          extractorCustomMode: !1,
          ...d.separateDreamerModel ? {} : { dreamerProvider: p, dreamerModel: m, dreamerCustomMode: !1 }
        }
      ),
      onSelectCustom: () => setDraft((d) => d && { ...d, extractorCustomMode: !0 }),
      onChangeProvider: (p) => setDraft(
        (d) => d && {
          ...d,
          extractorProvider: p,
          ...d.separateDreamerModel ? {} : { dreamerProvider: p }
        }
      ),
      onChangeModel: (m) => setDraft(
        (d) => d && {
          ...d,
          extractorModel: m,
          ...d.separateDreamerModel ? {} : { dreamerModel: m }
        }
      )
    }
  ), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-row-between" }, /* @__PURE__ */ import_react6.default.createElement("label", { className: "dmm-checkbox" }, /* @__PURE__ */ import_react6.default.createElement(
    "input",
    {
      type: "checkbox",
      checked: draft.separateDreamerModel,
      onChange: (e) => {
        let sep = e.target.checked;
        setDraft(
          (d) => d && {
            ...d,
            separateDreamerModel: sep,
            ...sep ? {} : {
              dreamerProvider: d.extractorProvider,
              dreamerModel: d.extractorModel,
              dreamerCustomMode: d.extractorCustomMode
            }
          }
        );
      }
    }
  ), /* @__PURE__ */ import_react6.default.createElement("span", null, t("settings.separateDreamerLabel"))), /* @__PURE__ */ import_react6.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-btn dmm-btn-sm",
      disabled: testingLlm,
      onClick: () => void handleTestLlm()
    },
    t(testingLlm ? "settings.testing" : "settings.testLlm")
  )), draft.separateDreamerModel && /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-stack", style: { gap: 8 } }, /* @__PURE__ */ import_react6.default.createElement(
    ModelSelector,
    {
      id: "dmm-llm-dreamer-model",
      label: t("settings.dreamerModelLabel"),
      provider: draft.dreamerProvider,
      model: draft.dreamerModel,
      customMode: draft.dreamerCustomMode,
      catalog,
      t,
      onSelectAuto: () => setDraft((d) => d && { ...d, dreamerProvider: "", dreamerModel: "", dreamerCustomMode: !1 }),
      onSelectCatalog: (p, m) => setDraft((d) => d && { ...d, dreamerProvider: p, dreamerModel: m, dreamerCustomMode: !1 }),
      onSelectCustom: () => setDraft((d) => d && { ...d, dreamerCustomMode: !0 }),
      onChangeProvider: (p) => setDraft((d) => d && { ...d, dreamerProvider: p }),
      onChangeModel: (m) => setDraft((d) => d && { ...d, dreamerModel: m })
    }
  ), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-row", style: { justifyContent: "flex-end" } }, /* @__PURE__ */ import_react6.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-btn dmm-btn-sm",
      disabled: testingDreamerLlm,
      onClick: () => void handleTestDreamerLlm()
    },
    t(testingDreamerLlm ? "settings.testing" : "settings.testDreamerLlm")
  )), dreamerTestResult && /* @__PURE__ */ import_react6.default.createElement("div", { className: `dmm-test-result ${dreamerTestResult.ok ? "dmm-test-ok" : "dmm-test-fail"}` }, dreamerTestResult.ok && /* @__PURE__ */ import_react6.default.createElement(CheckMiniIcon, { size: 13 }), /* @__PURE__ */ import_react6.default.createElement("span", null, dreamerTestResult.message))), llmTestResult && /* @__PURE__ */ import_react6.default.createElement("div", { className: `dmm-test-result ${llmTestResult.ok ? "dmm-test-ok" : "dmm-test-fail"}` }, llmTestResult.ok && /* @__PURE__ */ import_react6.default.createElement(CheckMiniIcon, { size: 13 }), /* @__PURE__ */ import_react6.default.createElement("span", null, llmTestResult.message)), /* @__PURE__ */ import_react6.default.createElement("div", null, /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-row" }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-row-info" }, /* @__PURE__ */ import_react6.default.createElement("span", { className: "dmm-settings-row-title" }, t("settings.enabledLabel")), /* @__PURE__ */ import_react6.default.createElement("span", { className: "dmm-settings-row-hint" }, t("settings.enabledHint"))), /* @__PURE__ */ import_react6.default.createElement(
    SwitchControl,
    {
      checked: draft.enabled,
      label: t("settings.enabledLabel"),
      onChange: (enabled) => setDraft((d) => d && { ...d, enabled })
    }
  )), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-row" }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-row-info" }, /* @__PURE__ */ import_react6.default.createElement("span", { className: "dmm-settings-row-title" }, t("settings.extractorEnabledLabel")), /* @__PURE__ */ import_react6.default.createElement("span", { className: "dmm-settings-row-hint" }, t("settings.extractorEnabledHint"))), /* @__PURE__ */ import_react6.default.createElement(
    SwitchControl,
    {
      checked: draft.extractorEnabled,
      label: t("settings.extractorEnabledLabel"),
      onChange: (extractorEnabled) => setDraft((d) => d && { ...d, extractorEnabled })
    }
  )), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-row" }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-row-info" }, /* @__PURE__ */ import_react6.default.createElement("span", { className: "dmm-settings-row-title" }, t("settings.dreamerEnabledLabel")), /* @__PURE__ */ import_react6.default.createElement("span", { className: "dmm-settings-row-hint" }, t("settings.dreamerEnabledHint"))), /* @__PURE__ */ import_react6.default.createElement(
    SwitchControl,
    {
      checked: draft.dreamerEnabled,
      label: t("settings.dreamerEnabledLabel"),
      onChange: (dreamerEnabled) => setDraft((d) => d && { ...d, dreamerEnabled })
    }
  ))), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-form-grid" }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-field" }, /* @__PURE__ */ import_react6.default.createElement("label", { className: "dmm-label", htmlFor: "dmm-trigger-tokens" }, t("settings.triggerTokensLabel")), /* @__PURE__ */ import_react6.default.createElement(
    "input",
    {
      id: "dmm-trigger-tokens",
      type: "number",
      className: "dmm-input",
      min: 1e3,
      max: 2e5,
      step: 500,
      value: draft.extractorTriggerTokens,
      onChange: (e) => setDraft((d) => d && { ...d, extractorTriggerTokens: Number(e.target.value) || 12e3 })
    }
  )), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-field" }, /* @__PURE__ */ import_react6.default.createElement("label", { className: "dmm-label", htmlFor: "dmm-tick-interval" }, t("settings.tickIntervalLabel")), /* @__PURE__ */ import_react6.default.createElement(
    "input",
    {
      id: "dmm-tick-interval",
      type: "number",
      className: "dmm-input",
      min: 1,
      max: 1440,
      step: 1,
      value: draft.dreamerTickMinutes,
      onChange: (e) => setDraft((d) => d && { ...d, dreamerTickMinutes: Number(e.target.value) || 15 })
    }
  ))))), /* @__PURE__ */ import_react6.default.createElement("section", { className: "dmm-settings-card" }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-head" }, /* @__PURE__ */ import_react6.default.createElement("div", null, /* @__PURE__ */ import_react6.default.createElement("h3", { className: "dmm-section-title" }, t("settings.embeddingSection")), /* @__PURE__ */ import_react6.default.createElement("p", { className: "dmm-section-desc" }, t("settings.embeddingDesc"))), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-segmented", role: "group", "aria-label": t("settings.embeddingSection") }, /* @__PURE__ */ import_react6.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-seg-btn",
      "data-active": draft.embeddingProvider === "off",
      onClick: () => setDraft((d) => d && { ...d, embeddingProvider: "off" })
    },
    t("settings.embModeOff")
  ), /* @__PURE__ */ import_react6.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-seg-btn",
      "data-active": draft.embeddingProvider === "openai-compatible",
      onClick: () => setDraft((d) => d && { ...d, embeddingProvider: "openai-compatible" })
    },
    t("settings.embModeOpenai")
  ))), draft.embeddingProvider === "openai-compatible" && /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-body" }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-row" }, /* @__PURE__ */ import_react6.default.createElement("span", { className: "dmm-label" }, t("settings.embPresets"), ":"), /* @__PURE__ */ import_react6.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-preset-btn",
      onClick: () => applyEmbeddingPreset("https://api.openai.com/v1", "text-embedding-3-small", "OPENAI_API_KEY")
    },
    "OpenAI"
  ), /* @__PURE__ */ import_react6.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-preset-btn",
      onClick: () => applyEmbeddingPreset("https://api.siliconflow.cn/v1", "BAAI/bge-m3", "SILICONFLOW_API_KEY")
    },
    "SiliconFlow"
  ), /* @__PURE__ */ import_react6.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-preset-btn",
      onClick: () => applyEmbeddingPreset("http://localhost:11434/v1", "nomic-embed-text", "")
    },
    "Ollama (Local)"
  )), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-form-grid" }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-field" }, /* @__PURE__ */ import_react6.default.createElement("label", { className: "dmm-label", htmlFor: "dmm-emb-endpoint" }, t("settings.embEndpointLabel")), /* @__PURE__ */ import_react6.default.createElement(
    "input",
    {
      id: "dmm-emb-endpoint",
      type: "url",
      className: "dmm-input",
      placeholder: t("settings.embEndpointPlaceholder"),
      value: draft.embeddingEndpoint,
      onChange: (e) => setDraft((d) => d && { ...d, embeddingEndpoint: e.target.value })
    }
  )), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-field" }, /* @__PURE__ */ import_react6.default.createElement("label", { className: "dmm-label", htmlFor: "dmm-emb-model" }, t("settings.embModelLabel")), /* @__PURE__ */ import_react6.default.createElement(
    "input",
    {
      id: "dmm-emb-model",
      type: "text",
      className: "dmm-input",
      placeholder: t("settings.embModelPlaceholder"),
      value: draft.embeddingModel,
      onChange: (e) => setDraft((d) => d && { ...d, embeddingModel: e.target.value })
    }
  ))), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-form-grid" }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-field" }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-row-between" }, /* @__PURE__ */ import_react6.default.createElement("label", { className: "dmm-label", htmlFor: "dmm-emb-key" }, t("settings.embApiKeyLabel")), serverState.settings.embedding.hasApiKey && !draft.embeddingClearApiKey && /* @__PURE__ */ import_react6.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-btn dmm-btn-ghost dmm-btn-danger",
      style: { height: 20, fontSize: 11, padding: "0 6px" },
      onClick: () => setDraft((d) => d && { ...d, embeddingClearApiKey: !0, embeddingApiKeyInput: "" })
    },
    t("settings.embClearKey")
  )), /* @__PURE__ */ import_react6.default.createElement(
    "input",
    {
      id: "dmm-emb-key",
      type: "password",
      className: "dmm-input",
      autoComplete: "off",
      placeholder: serverState.settings.embedding.hasApiKey && !draft.embeddingClearApiKey ? t("settings.embApiKeySavedPlaceholder", {
        preview: serverState.settings.embedding.apiKeyPreview
      }) : t("settings.embApiKeyPlaceholder"),
      value: draft.embeddingApiKeyInput,
      onChange: (e) => setDraft(
        (d) => d && { ...d, embeddingApiKeyInput: e.target.value, embeddingClearApiKey: !1 }
      )
    }
  )), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-field" }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-row-between" }, /* @__PURE__ */ import_react6.default.createElement("label", { className: "dmm-label", htmlFor: "dmm-emb-env" }, t("settings.embApiKeyEnvLabel")), serverState.hasEnvEmbeddingKey && /* @__PURE__ */ import_react6.default.createElement("span", { className: "dmm-status-inline" }, /* @__PURE__ */ import_react6.default.createElement(CheckMiniIcon, { size: 11 }), /* @__PURE__ */ import_react6.default.createElement("span", null, t("settings.embEnvDetected")))), /* @__PURE__ */ import_react6.default.createElement(
    "input",
    {
      id: "dmm-emb-env",
      type: "text",
      className: "dmm-input",
      placeholder: "OPENAI_API_KEY",
      value: draft.embeddingApiKeyEnv,
      onChange: (e) => setDraft((d) => d && { ...d, embeddingApiKeyEnv: e.target.value })
    }
  ))), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-row" }, /* @__PURE__ */ import_react6.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-btn dmm-btn-sm",
      disabled: testingEmb,
      onClick: () => void handleTestEmbedding()
    },
    t(testingEmb ? "settings.testing" : "settings.embTest")
  ), /* @__PURE__ */ import_react6.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-btn dmm-btn-sm",
      disabled: reindexing || isDirty,
      onClick: () => void handleReindex()
    },
    t(reindexing ? "settings.embReindexing" : "settings.embReindex")
  )), embTestResult && /* @__PURE__ */ import_react6.default.createElement("div", { className: `dmm-test-result ${embTestResult.ok ? "dmm-test-ok" : "dmm-test-fail"}` }, embTestResult.ok && /* @__PURE__ */ import_react6.default.createElement(CheckMiniIcon, { size: 13 }), /* @__PURE__ */ import_react6.default.createElement("span", null, embTestResult.message)), reindexResult && /* @__PURE__ */ import_react6.default.createElement("div", { className: `dmm-test-result ${reindexResult.failed === 0 ? "dmm-test-ok" : "dmm-test-fail"}` }, reindexResult.failed === 0 && /* @__PURE__ */ import_react6.default.createElement(CheckMiniIcon, { size: 13 }), /* @__PURE__ */ import_react6.default.createElement("span", null, reindexResult.message)))), /* @__PURE__ */ import_react6.default.createElement("section", { className: "dmm-settings-card" }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-head" }, /* @__PURE__ */ import_react6.default.createElement("div", null, /* @__PURE__ */ import_react6.default.createElement("h3", { className: "dmm-section-title" }, t("settings.loopSection")), /* @__PURE__ */ import_react6.default.createElement("p", { className: "dmm-section-desc" }, t("settings.loopDesc")))), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-body" }, /* @__PURE__ */ import_react6.default.createElement("div", null, /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-row" }, /* @__PURE__ */ import_react6.default.createElement("span", { className: "dmm-settings-row-title" }, t("settings.injectOnStartLabel")), /* @__PURE__ */ import_react6.default.createElement(
    SwitchControl,
    {
      checked: draft.injectOnStart,
      label: t("settings.injectOnStartLabel"),
      onChange: (injectOnStart) => setDraft((d) => d && { ...d, injectOnStart })
    }
  )), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-row" }, /* @__PURE__ */ import_react6.default.createElement("span", { className: "dmm-settings-row-title" }, t("settings.reanchorLabel")), /* @__PURE__ */ import_react6.default.createElement(
    SwitchControl,
    {
      checked: draft.reanchorAfterCompaction,
      label: t("settings.reanchorLabel"),
      onChange: (reanchorAfterCompaction) => setDraft((d) => d && { ...d, reanchorAfterCompaction })
    }
  )), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-row" }, /* @__PURE__ */ import_react6.default.createElement("span", { className: "dmm-settings-row-title" }, t("settings.autoSearchLabel")), /* @__PURE__ */ import_react6.default.createElement(
    SwitchControl,
    {
      checked: draft.autoSearchEnabled,
      label: t("settings.autoSearchLabel"),
      onChange: (autoSearchEnabled) => setDraft((d) => d && { ...d, autoSearchEnabled })
    }
  ))), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-settings-grid-3" }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-field" }, /* @__PURE__ */ import_react6.default.createElement("label", { className: "dmm-label", htmlFor: "dmm-budget-base" }, t("settings.baselineBudgetLabel")), /* @__PURE__ */ import_react6.default.createElement(
    "input",
    {
      id: "dmm-budget-base",
      type: "number",
      className: "dmm-input",
      min: 200,
      max: 32e3,
      step: 100,
      value: draft.baselineBudgetTokens,
      onChange: (e) => setDraft((d) => d && { ...d, baselineBudgetTokens: Number(e.target.value) || 3200 })
    }
  )), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-field" }, /* @__PURE__ */ import_react6.default.createElement("label", { className: "dmm-label", htmlFor: "dmm-budget-profile" }, t("settings.profileBudgetLabel")), /* @__PURE__ */ import_react6.default.createElement(
    "input",
    {
      id: "dmm-budget-profile",
      type: "number",
      className: "dmm-input",
      min: 100,
      max: 8e3,
      step: 50,
      value: draft.userProfileBudgetTokens,
      onChange: (e) => setDraft((d) => d && { ...d, userProfileBudgetTokens: Number(e.target.value) || 600 })
    }
  )), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-field" }, /* @__PURE__ */ import_react6.default.createElement("label", { className: "dmm-label", htmlFor: "dmm-budget-delta" }, t("settings.deltaBudgetLabel")), /* @__PURE__ */ import_react6.default.createElement(
    "input",
    {
      id: "dmm-budget-delta",
      type: "number",
      className: "dmm-input",
      min: 100,
      max: 8e3,
      step: 50,
      value: draft.deltaBudgetTokens,
      onChange: (e) => setDraft((d) => d && { ...d, deltaBudgetTokens: Number(e.target.value) || 800 })
    }
  ))))), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-save-bar", "data-dirty": isDirty }, /* @__PURE__ */ import_react6.default.createElement("span", { className: "dmm-meta" }, isDirty ? t("settings.unsaved") : serverState.dbPath), /* @__PURE__ */ import_react6.default.createElement("div", { className: "dmm-row" }, /* @__PURE__ */ import_react6.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-btn",
      disabled: !isDirty || saving,
      onClick: () => baseline && setDraft({ ...baseline })
    },
    t("settings.reset")
  ), /* @__PURE__ */ import_react6.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-btn dmm-btn-primary",
      disabled: !isDirty || saving,
      onClick: () => void handleSave()
    },
    t(saving ? "settings.saving" : "settings.save")
  ))));
}

// src/client/components/TelemetryTab.tsx
var import_react7 = __toESM(require("react"), 1);
function formatBytes(bytes) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
function TelemetryTab({
  api,
  projectId,
  sessionId,
  overview,
  t,
  onError,
  onNotice
}) {
  let [doctor, setDoctor] = (0, import_react7.useState)(null), [runningDoctor, setRunningDoctor] = (0, import_react7.useState)(!1), [exportPreview, setExportPreview] = (0, import_react7.useState)(null), [copied, setCopied] = (0, import_react7.useState)(!1), sess = overview.session, deferRatio = sess && sess.totalSteps > 0 ? Math.round(sess.deferSteps / sess.totalSteps * 100) : 100, handleQueueSync = async () => {
    if (sessionId)
      try {
        await api.requestSync({ projectId, sessionId }), onNotice(t("telemetry.syncQueued"));
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      }
  }, handleDoctor = async () => {
    setRunningDoctor(!0);
    try {
      let res = await api.runDoctor();
      setDoctor(res);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningDoctor(!1);
    }
  }, handleExport = async (format) => {
    try {
      let res = await api.exportSnapshot({ projectId, format });
      setExportPreview(res), setCopied(!1);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }, handleCopy = async () => {
    if (exportPreview)
      try {
        await navigator.clipboard.writeText(exportPreview.content), setCopied(!0);
      } catch {
        onError("Clipboard access unavailable in this browser context");
      }
  }, handleDownload = () => {
    if (!exportPreview) return;
    let ext = exportPreview.format === "json" ? "json" : "md", mime = exportPreview.format === "json" ? "application/json" : "text/markdown", blob = new Blob([exportPreview.content], { type: mime }), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url, a.download = `magic-memory-${overview.project?.displayName ?? "export"}.${ext}`, a.click(), URL.revokeObjectURL(url);
  };
  return /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stack" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-section-head" }, /* @__PURE__ */ import_react7.default.createElement("h3", { className: "dmm-section-title" }, t("telemetry.cacheTitle")), sessionId && /* @__PURE__ */ import_react7.default.createElement("button", { type: "button", className: "dmm-btn", onClick: () => void handleQueueSync() }, t("telemetry.queueSync"))), sess ? /* @__PURE__ */ import_react7.default.createElement(import_react7.default.Fragment, null, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-card" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-row-between" }, /* @__PURE__ */ import_react7.default.createElement("span", { className: "dmm-stat-label" }, t("telemetry.deferRatio")), /* @__PURE__ */ import_react7.default.createElement("span", { className: "dmm-badge dmm-badge-ok" }, deferRatio, "%")), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-progress", "aria-label": t("telemetry.deferRatio") }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-progress-fill", style: { width: `${deferRatio}%` } }))), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-grid" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-card" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-label" }, t("telemetry.totalSteps")), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-value" }, sess.totalSteps, " / ", sess.deferSteps)), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-card" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-label" }, t("telemetry.reanchors")), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-value" }, sess.reanchorCount)), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-card" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-label" }, t("telemetry.autoSearch")), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-value" }, sess.autoSearchHits)), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-card" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-label" }, t("telemetry.injectedIds")), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-value" }, sess.injectedMemoryIds.length)))) : /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-empty" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-empty-icon" }, /* @__PURE__ */ import_react7.default.createElement(ActivityEmptyIcon, { size: 18 })), /* @__PURE__ */ import_react7.default.createElement("p", { className: "dmm-empty-desc" }, t("telemetry.noSessionState"))), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-section-head", style: { marginTop: 4 } }, /* @__PURE__ */ import_react7.default.createElement("h3", { className: "dmm-section-title" }, t("telemetry.storageTitle"))), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-grid" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-card" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-label" }, t("telemetry.dbSize")), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-value" }, formatBytes(overview.dbSizeBytes))), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-card" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-label" }, t("telemetry.schemaVersion")), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-value" }, "v", overview.schemaVersion)), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-card" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-label" }, t("telemetry.embeddingMode")), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-value", style: { fontSize: 13.5, wordBreak: "break-word" } }, overview.embeddingProvider)), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-card" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-label" }, t("telemetry.embeddingCoverage")), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-stat-value" }, overview.embeddedMemoryCount, " / ", overview.activeMemoryCount))), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-section-head", style: { marginTop: 4 } }, /* @__PURE__ */ import_react7.default.createElement("h3", { className: "dmm-section-title" }, t("telemetry.categoriesTitle"))), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-card" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-dist-grid" }, MEMORY_CATEGORIES.map((cat) => /* @__PURE__ */ import_react7.default.createElement("div", { key: cat, className: "dmm-dist-item", title: cat }, /* @__PURE__ */ import_react7.default.createElement("span", { className: "dmm-row", style: { gap: 6 } }, /* @__PURE__ */ import_react7.default.createElement(CategoryDot, { category: cat }), /* @__PURE__ */ import_react7.default.createElement("span", null, getCategoryLabel(t, cat))), /* @__PURE__ */ import_react7.default.createElement("strong", { style: { fontVariantNumeric: "tabular-nums" } }, overview.countsByCategory[cat] ?? 0)))), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-meta", style: { wordBreak: "break-all" } }, /* @__PURE__ */ import_react7.default.createElement("span", { className: "dmm-meta-files" }, overview.dbPath))), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-section-head", style: { marginTop: 4 } }, /* @__PURE__ */ import_react7.default.createElement("h3", { className: "dmm-section-title" }, t("telemetry.toolsTitle"))), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-row" }, /* @__PURE__ */ import_react7.default.createElement("button", { type: "button", className: "dmm-btn", disabled: runningDoctor, onClick: () => void handleDoctor() }, t("telemetry.doctor")), /* @__PURE__ */ import_react7.default.createElement("button", { type: "button", className: "dmm-btn", onClick: () => void handleExport("markdown") }, t("telemetry.exportMd")), /* @__PURE__ */ import_react7.default.createElement("button", { type: "button", className: "dmm-btn", onClick: () => void handleExport("json") }, t("telemetry.exportJson"))), doctor && /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-card" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-row-between" }, /* @__PURE__ */ import_react7.default.createElement("span", { className: "dmm-card-title" }, doctor.ok ? t("telemetry.doctorOk") : t("telemetry.doctorWarn")), /* @__PURE__ */ import_react7.default.createElement("span", { className: doctor.ok ? "dmm-badge dmm-badge-ok" : "dmm-badge dmm-badge-warn" }, doctor.journalMode.toUpperCase())), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-meta" }, /* @__PURE__ */ import_react7.default.createElement("span", null, "FTS5: ", doctor.ftsConsistent ? "OK" : "Rebuilt"), /* @__PURE__ */ import_react7.default.createElement("span", null, "Active leases: ", doctor.activeLeases), /* @__PURE__ */ import_react7.default.createElement("span", null, "Stale cleaned: ", doctor.staleLeasesCleaned)), doctor.warnings.length > 0 && /* @__PURE__ */ import_react7.default.createElement("ul", { style: { margin: "4px 0 0", paddingLeft: 16, color: "var(--dmm-warn)", fontSize: 12 } }, doctor.warnings.map((w, i) => /* @__PURE__ */ import_react7.default.createElement("li", { key: i }, w)))), exportPreview && /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-card" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-row-between" }, /* @__PURE__ */ import_react7.default.createElement("span", { className: "dmm-card-title" }, "Export (", exportPreview.format, ")"), /* @__PURE__ */ import_react7.default.createElement("div", { className: "dmm-row" }, /* @__PURE__ */ import_react7.default.createElement("button", { type: "button", className: "dmm-btn dmm-btn-sm", onClick: () => void handleCopy() }, t(copied ? "telemetry.copied" : "telemetry.copy")), /* @__PURE__ */ import_react7.default.createElement("button", { type: "button", className: "dmm-btn dmm-btn-sm", onClick: handleDownload }, t("telemetry.download")), /* @__PURE__ */ import_react7.default.createElement("button", { type: "button", className: "dmm-btn dmm-btn-ghost", onClick: () => setExportPreview(null) }, t("telemetry.close")))), /* @__PURE__ */ import_react7.default.createElement("pre", { className: "dmm-pre" }, exportPreview.content)));
}

// src/client/components/MemoryPanel.tsx
function MagicMemoryIcon({ size = 16, className }) {
  return /* @__PURE__ */ import_react8.default.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.75,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className,
      "aria-hidden": "true"
    },
    /* @__PURE__ */ import_react8.default.createElement("circle", { cx: "12", cy: "12", r: "9", opacity: "0.3" }),
    /* @__PURE__ */ import_react8.default.createElement("path", { d: "M12 3a9 9 0 0 1 8.5 6" }),
    /* @__PURE__ */ import_react8.default.createElement("path", { d: "M20.5 15A9 9 0 0 1 12 21a9 9 0 0 1-8.5-6" }),
    /* @__PURE__ */ import_react8.default.createElement("circle", { cx: "12", cy: "12", r: "3" }),
    /* @__PURE__ */ import_react8.default.createElement("path", { d: "M12 6v3M12 15v3M6 12h3M15 12h3" })
  );
}
var DEFAULT_T = createFallbackTranslator("en");
function MemoryPanel({
  api,
  sessionId,
  t = DEFAULT_T,
  variant = "sidebar",
  bindRefreshCommand
}) {
  let [activeTab, setActiveTab] = (0, import_react8.useState)("memories"), [selectedProjectId, setSelectedProjectId] = (0, import_react8.useState)(void 0), [projects, setProjects] = (0, import_react8.useState)([]), [overview, setOverview] = (0, import_react8.useState)(null), [loading, setLoading] = (0, import_react8.useState)(!1), [refreshToken, setRefreshToken] = (0, import_react8.useState)(0), [error, setError] = (0, import_react8.useState)(null), [notice, setNotice] = (0, import_react8.useState)(null);
  (0, import_react8.useEffect)(() => {
    ensureMagicMemoryStyles();
  }, []);
  let triggerRefresh = (0, import_react8.useCallback)(() => {
    setRefreshToken((n) => n + 1);
  }, []);
  (0, import_react8.useEffect)(() => {
    if (bindRefreshCommand)
      return bindRefreshCommand(triggerRefresh);
  }, [bindRefreshCommand, triggerRefresh]), (0, import_react8.useEffect)(() => {
    let controller = new AbortController();
    return setLoading(!0), api.getOverview({ projectId: selectedProjectId, sessionId }, controller.signal).then((res) => {
      controller.signal.aborted || (setOverview(res.overview), setProjects(res.projects), setError(null), !selectedProjectId && res.overview.project?.projectId && setSelectedProjectId(res.overview.project.projectId));
    }).catch((err) => {
      controller.signal.aborted || setError(err instanceof Error ? err.message : String(err));
    }).finally(() => {
      controller.signal.aborted || setLoading(!1);
    }), () => controller.abort();
  }, [api, selectedProjectId, sessionId, refreshToken]);
  let handleError = (0, import_react8.useCallback)((msg) => {
    setError(msg);
  }, []), handleNotice = (0, import_react8.useCallback)((msg) => {
    setNotice(msg), setError(null);
  }, []), activeProjectId = selectedProjectId ?? overview?.project?.projectId ?? "", panel = /* @__PURE__ */ import_react8.default.createElement("div", { className: "dmm-root", "data-testid": "magic-memory-panel", "data-variant": variant }, /* @__PURE__ */ import_react8.default.createElement("header", { className: "dmm-header" }, /* @__PURE__ */ import_react8.default.createElement("div", { className: "dmm-title-block" }, /* @__PURE__ */ import_react8.default.createElement("div", { className: "dmm-title-group" }, /* @__PURE__ */ import_react8.default.createElement("span", { className: "dmm-title-icon" }, /* @__PURE__ */ import_react8.default.createElement(MagicMemoryIcon, { size: variant === "page" ? 17 : 15 })), /* @__PURE__ */ import_react8.default.createElement("span", { className: "dmm-title" }, t("tab.title"))), variant === "page" && /* @__PURE__ */ import_react8.default.createElement("p", { className: "dmm-subtitle" }, t("header.subtitle"))), /* @__PURE__ */ import_react8.default.createElement("div", { className: "dmm-header-controls" }, projects.length > 0 && /* @__PURE__ */ import_react8.default.createElement(
    SelectMenu,
    {
      ariaLabel: t("header.project"),
      value: activeProjectId,
      compact: !0,
      align: "right",
      leadingIcon: /* @__PURE__ */ import_react8.default.createElement(FolderMiniIcon, { size: 13 }),
      options: projects.map((p) => ({
        value: p.projectId,
        label: p.displayName,
        sublabel: p.canonicalRoot || void 0
      })),
      onChange: (val) => setSelectedProjectId(val)
    }
  ), /* @__PURE__ */ import_react8.default.createElement(
    "button",
    {
      type: "button",
      className: "dmm-btn",
      disabled: loading,
      onClick: triggerRefresh
    },
    /* @__PURE__ */ import_react8.default.createElement(RefreshIcon, { size: 13, spinning: loading }),
    /* @__PURE__ */ import_react8.default.createElement("span", null, t(loading ? "header.loading" : "header.refresh"))
  ))), /* @__PURE__ */ import_react8.default.createElement("nav", { className: "dmm-tabs", role: "tablist", "aria-label": "Magic Memory sections" }, /* @__PURE__ */ import_react8.default.createElement(
    "button",
    {
      type: "button",
      role: "tab",
      className: "dmm-tab",
      "aria-selected": activeTab === "memories",
      onClick: () => setActiveTab("memories")
    },
    /* @__PURE__ */ import_react8.default.createElement("span", null, t("nav.memories")),
    overview && /* @__PURE__ */ import_react8.default.createElement("span", { className: "dmm-tab-count" }, overview.activeMemoryCount + overview.globalProfileCount)
  ), /* @__PURE__ */ import_react8.default.createElement(
    "button",
    {
      type: "button",
      role: "tab",
      className: "dmm-tab",
      "aria-selected": activeTab === "episodes",
      onClick: () => setActiveTab("episodes")
    },
    /* @__PURE__ */ import_react8.default.createElement("span", null, t("nav.episodesNotes")),
    overview && /* @__PURE__ */ import_react8.default.createElement("span", { className: "dmm-tab-count" }, overview.episodeCount + overview.activeNoteCount)
  ), /* @__PURE__ */ import_react8.default.createElement(
    "button",
    {
      type: "button",
      role: "tab",
      className: "dmm-tab",
      "aria-selected": activeTab === "dreamer",
      onClick: () => setActiveTab("dreamer")
    },
    /* @__PURE__ */ import_react8.default.createElement("span", null, t("nav.dreamer")),
    overview && /* @__PURE__ */ import_react8.default.createElement("span", { className: "dmm-tab-count" }, overview.dreamerTasks.reduce((acc, task) => acc + task.backlogCount, 0))
  ), /* @__PURE__ */ import_react8.default.createElement(
    "button",
    {
      type: "button",
      role: "tab",
      className: "dmm-tab",
      "aria-selected": activeTab === "telemetry",
      onClick: () => setActiveTab("telemetry")
    },
    /* @__PURE__ */ import_react8.default.createElement("span", null, t("nav.telemetry"))
  ), /* @__PURE__ */ import_react8.default.createElement(
    "button",
    {
      type: "button",
      role: "tab",
      className: "dmm-tab",
      "aria-selected": activeTab === "settings",
      onClick: () => setActiveTab("settings")
    },
    /* @__PURE__ */ import_react8.default.createElement(SettingsIcon, { size: 13 }),
    /* @__PURE__ */ import_react8.default.createElement("span", null, t("nav.settings"))
  )), error && /* @__PURE__ */ import_react8.default.createElement("div", { className: "dmm-banner dmm-banner-error", role: "alert" }, /* @__PURE__ */ import_react8.default.createElement("span", null, error), /* @__PURE__ */ import_react8.default.createElement("button", { type: "button", className: "dmm-btn dmm-btn-ghost", onClick: () => setError(null), "aria-label": "Dismiss error" }, "\u2715")), notice && !error && /* @__PURE__ */ import_react8.default.createElement("div", { className: "dmm-banner dmm-banner-info", role: "status" }, /* @__PURE__ */ import_react8.default.createElement("span", null, notice), /* @__PURE__ */ import_react8.default.createElement("button", { type: "button", className: "dmm-btn dmm-btn-ghost", onClick: () => setNotice(null), "aria-label": "Dismiss notice" }, "\u2715")), /* @__PURE__ */ import_react8.default.createElement("main", { className: "dmm-body" }, !overview && loading ? /* @__PURE__ */ import_react8.default.createElement("div", { className: "dmm-empty" }, /* @__PURE__ */ import_react8.default.createElement("p", { className: "dmm-empty-desc" }, t("header.loading"))) : activeTab === "memories" ? /* @__PURE__ */ import_react8.default.createElement(
    MemoriesTab,
    {
      api,
      projectId: activeProjectId,
      sessionId,
      t,
      refreshToken,
      onMutated: triggerRefresh,
      onError: handleError,
      onNotice: handleNotice
    }
  ) : activeTab === "episodes" ? /* @__PURE__ */ import_react8.default.createElement(
    EpisodesNotesTab,
    {
      api,
      projectId: activeProjectId,
      sessionId,
      t,
      refreshToken,
      onMutated: triggerRefresh,
      onError: handleError,
      onNotice: handleNotice
    }
  ) : activeTab === "dreamer" ? /* @__PURE__ */ import_react8.default.createElement(
    DreamerTab,
    {
      api,
      projectId: activeProjectId,
      enabled: overview?.dreamerEnabled ?? !1,
      tasks: overview?.dreamerTasks ?? [],
      recentRuns: overview?.recentDreamRuns ?? [],
      t,
      onMutated: triggerRefresh,
      onError: handleError,
      onNotice: handleNotice
    }
  ) : activeTab === "settings" ? /* @__PURE__ */ import_react8.default.createElement(
    SettingsTab,
    {
      api,
      projectId: activeProjectId,
      t,
      refreshToken,
      onMutated: triggerRefresh,
      onError: handleError,
      onNotice: handleNotice
    }
  ) : overview ? /* @__PURE__ */ import_react8.default.createElement(
    TelemetryTab,
    {
      api,
      projectId: activeProjectId,
      sessionId,
      overview,
      t,
      onError: handleError,
      onNotice: handleNotice
    }
  ) : /* @__PURE__ */ import_react8.default.createElement("div", { className: "dmm-empty" }, /* @__PURE__ */ import_react8.default.createElement("p", { className: "dmm-empty-desc" }, t("header.loading")))));
  return variant === "page" ? /* @__PURE__ */ import_react8.default.createElement("div", { className: "dmm-page" }, panel) : panel;
}

// src/client/index.tsx
var name = "dsh-magic-memory", inject = ["slots", "locale"], TAB_ID = "dsh-magic-memory", TAB_KIND = "magic-memory";
function registerIntoSlot(slots, slotName, registerFn) {
  return typeof slots.inject == "function" ? slots.inject(slotName, registerFn) : registerFn();
}
function apply(ctx) {
  ensureMagicMemoryStyles();
  let api = new MagicMemoryApi(createFetchTransport()), boundTranslate = createFallbackTranslator("en");
  if (ctx.locale) {
    ctx.effect(() => {
      try {
        return ctx.locale.register(MAGIC_MEMORY_NS, { en: { ...EN_DICT }, zh: { ...ZH_DICT } });
      } catch {
        let disposeEn = ctx.locale.register(MAGIC_MEMORY_NS, "en", { ...EN_DICT }), disposeZh = ctx.locale.register(MAGIC_MEMORY_NS, "zh", { ...ZH_DICT });
        return () => {
          disposeZh(), disposeEn();
        };
      }
    }, "dsh-magic-memory: locales");
    let rawBind = ctx.locale.bind(MAGIC_MEMORY_NS);
    boundTranslate = (key, params) => rawBind(key, params);
  }
  let SidebarNavIcon = ({ size = 16 }) => /* @__PURE__ */ import_react9.default.createElement(MagicMemoryIcon, { size }), MainDashboardPage = (props) => {
    let translate = props.t ? (key, params) => props.t(key, params) : boundTranslate;
    return /* @__PURE__ */ import_react9.default.createElement(
      MemoryPanel,
      {
        api: props.api ?? api,
        sessionId: props.sessionId,
        t: translate,
        variant: "page"
      }
    );
  };
  ctx.effect(() => {
    let disposeMain = registerIntoSlot(
      ctx.slots,
      "main",
      () => ctx.slots.register(
        {
          name: "main",
          key: TAB_ID,
          locale: MAGIC_MEMORY_NS,
          inject: () => ({ api })
        },
        MainDashboardPage
      )
    ), disposeNav = registerIntoSlot(
      ctx.slots,
      "sidebar.panellist",
      () => ctx.slots.register(
        {
          name: "sidebar.panellist",
          id: TAB_ID,
          order: 35,
          locale: MAGIC_MEMORY_NS,
          label: () => boundTranslate("nav.panelLabel")
        },
        SidebarNavIcon
      )
    );
    return () => {
      disposeNav(), disposeMain();
    };
  }, "dsh-magic-memory: left sidebar panel");
  let RightSidebarTabBody = (props) => {
    let readTabInfo = props.useTabInfo ?? props.hooks?.tabInfo, tabInfo = readTabInfo ? readTabInfo() : void 0, bindRefreshCommand = (0, import_react9.useCallback)(
      (refresh) => {
        let bind = tabInfo?.tab?.actions?.bindCommands;
        return bind ? bind({ refresh }) : () => {
        };
      },
      [tabInfo]
    ), translate = props.t ? (key, params) => props.t(key, params) : boundTranslate;
    return /* @__PURE__ */ import_react9.default.createElement(
      MemoryPanel,
      {
        api: props.api ?? api,
        sessionId: props.sessionId,
        t: translate,
        variant: "sidebar",
        bindRefreshCommand
      }
    );
  }, mountRightSidebar = (srCtx) => {
    srCtx.sidebarRightTabs && srCtx.effect(() => {
      let disposeType = srCtx.sidebarRightTabs.register({
        id: TAB_ID,
        kind: TAB_KIND,
        priority: "extension",
        keepMounted: !1,
        title: () => boundTranslate("tab.title"),
        guide: [
          {
            id: "magic-memory",
            order: 35,
            title: () => boundTranslate("guide.title"),
            description: () => boundTranslate("guide.description"),
            icon: MagicMemoryIcon
          }
        ]
      }), disposeBody = registerIntoSlot(
        srCtx.slots,
        "sidebar.right.pane.tab",
        () => srCtx.slots.register(
          {
            name: "sidebar.right.pane.tab",
            key: TAB_ID,
            locale: MAGIC_MEMORY_NS,
            inject: () => ({ api })
          },
          RightSidebarTabBody
        )
      );
      return () => {
        disposeBody(), disposeType();
      };
    }, "dsh-magic-memory: right sidebar tab");
  };
  typeof ctx.inject == "function" ? ctx.inject(["sidebarRightTabs"], mountRightSidebar) : ctx.sidebarRightTabs && mountRightSidebar(ctx);
  let mountHeaderAction = (hdrCtx) => {
    if (!hdrCtx.sidebarRight) return;
    let HeaderActionButton = (props) => {
      let translate = props.t ? (key, params) => props.t(key, params) : boundTranslate, label = translate("header.openSidebar");
      return /* @__PURE__ */ import_react9.default.createElement(
        "button",
        {
          type: "button",
          className: "dmm-header-action-btn",
          title: label,
          "aria-label": label,
          onClick: () => {
            hdrCtx.sidebarRight?.openTab(TAB_KIND);
          }
        },
        /* @__PURE__ */ import_react9.default.createElement(MagicMemoryIcon, { size: 15 }),
        /* @__PURE__ */ import_react9.default.createElement("span", null, translate("tab.title"))
      );
    };
    hdrCtx.effect(
      () => registerIntoSlot(
        hdrCtx.slots,
        "conversation.session.header.actions",
        () => hdrCtx.slots.register(
          {
            name: "conversation.session.header.actions",
            id: TAB_ID,
            order: 45,
            locale: MAGIC_MEMORY_NS
          },
          HeaderActionButton
        )
      ),
      "dsh-magic-memory: conversation header button"
    );
  };
  typeof ctx.inject == "function" ? ctx.inject(["sidebarRight"], mountHeaderAction) : ctx.sidebarRight && mountHeaderAction(ctx);
}

    return module.exports;
  }
});
