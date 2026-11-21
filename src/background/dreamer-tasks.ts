/**
 * Dreamer task implementations & host-side claim-safety guardrails.
 *
 * Implements all 6 self-maintenance tasks inspired by Magic-context's Dreamer:
 * 1. `map-memories`          — bind memories to backing workspace files (or file-independent)
 * 2. `verify`                — verify mapped memories whose backing files changed since last check
 * 3. `curate`                — expire old memories + tighten/consolidate within one category
 * 4. `classify-memories`     — score importance & shareability (fail-closed on secrets)
 * 5. `retrospective`         — learn project rules & user habits from recent user friction
 * 6. `review-user-memories`  — promote recurring user observations (>= threshold) to USER_PROFILE
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { ResolvedConfig } from '../config.js'
import { containsSecretPattern } from '../search/tokenizer.js'
import type { MagicMemoryService } from '../service/memory-service.js'
import {
  GLOBAL_PROJECT_ID,
  PROJECT_MEMORY_CATEGORIES,
  type DreamFailureClass,
  type DreamTaskName,
  type MemoryRecord,
  type ProjectMemoryCategory,
} from '../shared/types.js'
import type { LeaseHandle } from '../storage/leases.js'
import { resolveAuxiliaryRoute, runAuxiliaryCompletion } from './llm-helper.js'

export interface DreamTaskOutcome {
  readonly status: 'success' | 'skipped' | 'failed'
  readonly summary: string
  readonly itemsProcessed: number
  readonly mutationsApplied: number
  readonly modelUsed: string | null
  readonly failureClass: DreamFailureClass | null
  readonly errorMessage: string | null
}

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage', '.venv', 'target'])

/**
 * Host-side claim-safety guardrail (inspired by Magic-context `memory-claim-safety.ts`):
 * - Refuses auto-archiving `PROJECT_RULES` (human/explicit governance only).
 * - Refuses updates that shrink text by >50% unless explicitly marked `consolidation: true`.
 */
export function evaluateClaimSafety(
  memory: MemoryRecord,
  verdict: { readonly action: 'verified' | 'update' | 'archive'; readonly newContent?: string; readonly consolidation?: boolean },
): { readonly allowed: true } | { readonly allowed: false; readonly reason: string } {
  if (verdict.action === 'verified') return { allowed: true }
  if (verdict.action === 'archive') {
    if (memory.category === 'PROJECT_RULES' || memory.pinned) {
      return {
        allowed: false,
        reason: `Refused to auto-archive ${memory.pinned ? 'pinned' : 'PROJECT_RULES'} memory #${memory.id}`,
      }
    }
    return { allowed: true }
  }

  const next = verdict.newContent?.trim() ?? ''
  if (next.length === 0) {
    return { allowed: false, reason: `Refused empty update for memory #${memory.id}` }
  }
  if (!verdict.consolidation && next.length < Math.floor(memory.content.length * 0.5)) {
    return {
      allowed: false,
      reason: `Refused >50% shrink without consolidation flag on memory #${memory.id} (${memory.content.length} -> ${next.length} chars)`,
    }
  }
  return { allowed: true }
}

function unescapeXml(raw: string): string {
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

function readAttr(attrs: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
  const m = re.exec(attrs)
  return m ? (m[1] ?? m[2]) : undefined
}

function listWorkspaceFilesBounded(rootDir: string, maxFiles = 200, maxDepth = 4): string[] {
  if (!rootDir || !existsSync(rootDir)) return []
  const files: string[] = []
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth || files.length >= maxFiles) return
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (files.length >= maxFiles) break
      if (entry.name.startsWith('.') && entry.name !== '.github') continue
      if (IGNORED_DIRS.has(entry.name)) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full, depth + 1)
      } else if (entry.isFile()) {
        files.push(relative(rootDir, full).replace(/\\/g, '/'))
      }
    }
  }
  walk(rootDir, 0)
  return files
}

function validateRelativeWorkspaceFile(rootDir: string, relPath: string): string | null {
  if (!rootDir || !relPath || isAbsolute(relPath)) return null
  const normalized = relPath.trim().replace(/\\/g, '/').replace(/^\.\//, '')
  if (normalized.length === 0 || normalized.includes('..')) return null
  const full = resolve(rootDir, normalized)
  const rel = relative(resolve(rootDir), full).replace(/\\/g, '/')
  if (rel.startsWith('..') || isAbsolute(rel)) return null
  try {
    return statSync(full).isFile() ? rel : null
  } catch {
    return null
  }
}

export async function executeDreamTask(params: {
  readonly ctx: Context
  readonly service: MagicMemoryService
  readonly config: ResolvedConfig
  readonly projectId: string
  readonly taskName: DreamTaskName
  readonly lease: LeaseHandle
  readonly signal?: AbortSignal
}): Promise<DreamTaskOutcome> {
  const { taskName } = params
  switch (taskName) {
    case 'map-memories':
      return runMapMemoriesTask(params)
    case 'verify':
      return runVerifyTask(params)
    case 'curate':
      return runCurateTask(params)
    case 'classify-memories':
      return runClassifyTask(params)
    case 'retrospective':
      return runRetrospectiveTask(params)
    case 'review-user-memories':
      return runReviewUserMemoriesTask(params)
  }
}

// ── 1. map-memories ───────────────────────────────────────────────────────────

async function runMapMemoriesTask(params: {
  readonly ctx: Context
  readonly service: MagicMemoryService
  readonly config: ResolvedConfig
  readonly projectId: string
  readonly lease: LeaseHandle
  readonly signal?: AbortSignal
}): Promise<DreamTaskOutcome> {
  const { ctx, service, config, projectId, lease, signal } = params
  const unmapped = service
    .listMemories({ projectId, scope: 'project', status: 'active', limit: 40 })
    .filter(m => m.mappingOrigin === 'unmapped')

  if (unmapped.length === 0) {
    return skipped('No unmapped memories')
  }

  const project = service.getProject(projectId)
  const rootDir = project?.canonicalRoot ?? ''
  const workspaceFiles = listWorkspaceFilesBounded(rootDir)

  // If project root has no inspectable local files, converge immediately as file_independent
  if (workspaceFiles.length === 0) {
    const guarded = service.leases.runLeaseGuardedWrite(lease, () => {
      let updated = 0
      for (const m of unmapped) {
        service.updateMemoryMetadata(m.id, { backingFiles: [], mappingOrigin: 'file_independent' })
        updated += 1
      }
      return updated
    })
    if (!guarded.ok) return leaseLost()
    return {
      status: 'success',
      summary: `Marked ${guarded.value} memories file-independent (no local workspace files indexed)`,
      itemsProcessed: unmapped.length,
      mutationsApplied: guarded.value,
      modelUsed: null,
      failureClass: null,
      errorMessage: null,
    }
  }

  const route = resolveAuxiliaryRoute(ctx, { provider: config.dreamer.provider, model: config.dreamer.model })
  const outcome = await runAuxiliaryCompletion(ctx, {
    route,
    systemPrompt: [
      'Map each project memory to the workspace files that back or verify it, or mark it independent="true" for process/style rules.',
      'Return ONLY valid XML: <map><item id="123" files="src/a.ts,src/b.ts" independent="false"/></map>',
    ].join('\n'),
    userPrompt: [
      '<workspace_files>',
      workspaceFiles.join('\n'),
      '</workspace_files>',
      '',
      '<memories>',
      unmapped.map(m => `<memory id="${m.id}" category="${m.category}">${m.content}</memory>`).join('\n'),
      '</memories>',
    ].join('\n'),
    maxTokens: config.dreamer.maxOutputTokens,
    timeoutMs: config.dreamer.timeoutMs,
    purpose: 'magic-memory-dream-map',
    signal,
  })

  if (!outcome.ok) return failedFromLlm(outcome)

  const rootMatch = /<map\b[^>]*>([\s\S]*?)<\/map>/i.exec(outcome.text)
  if (!rootMatch) return parseFailed(outcome.route)

  const byId = new Map(unmapped.map(m => [m.id, m]))
  const parsedItems: { id: number; files: string[]; independent: boolean }[] = []
  for (const m of (rootMatch[1] ?? '').matchAll(/<item\b([^>]*?)\/?>/gi)) {
    const attrs = m[1] ?? ''
    const id = Number(readAttr(attrs, 'id'))
    if (!byId.has(id)) continue
    const independent = readAttr(attrs, 'independent')?.toLowerCase() === 'true'
    const filesRaw = (readAttr(attrs, 'files') ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    parsedItems.push({ id, files: filesRaw, independent })
  }

  const guarded = service.leases.runLeaseGuardedWrite(lease, () => {
    let applied = 0
    for (const item of parsedItems) {
      const mem = byId.get(item.id)!
      if (mem.category === 'PROJECT_RULES' || item.independent) {
        service.updateMemoryMetadata(item.id, { backingFiles: [], mappingOrigin: 'file_independent' })
        applied += 1
        continue
      }
      const validFiles = item.files
        .map(f => validateRelativeWorkspaceFile(rootDir, f))
        .filter((f): f is string => f !== null)
      if (validFiles.length > 0) {
        service.updateMemoryMetadata(item.id, { backingFiles: validFiles, mappingOrigin: 'dreamer' })
      } else {
        service.updateMemoryMetadata(item.id, { backingFiles: [], mappingOrigin: 'host_rejected_fallback' })
      }
      applied += 1
    }
    return applied
  })

  if (!guarded.ok) return leaseLost()
  return {
    status: 'success',
    summary: `Mapped ${guarded.value}/${unmapped.length} memories`,
    itemsProcessed: unmapped.length,
    mutationsApplied: guarded.value,
    modelUsed: `${outcome.route.provider}/${outcome.route.model}`,
    failureClass: null,
    errorMessage: null,
  }
}

// ── 2. verify ─────────────────────────────────────────────────────────────────

async function runVerifyTask(params: {
  readonly ctx: Context
  readonly service: MagicMemoryService
  readonly config: ResolvedConfig
  readonly projectId: string
  readonly lease: LeaseHandle
  readonly signal?: AbortSignal
}): Promise<DreamTaskOutcome> {
  const { ctx, service, config, projectId, lease, signal } = params
  const project = service.getProject(projectId)
  const rootDir = project?.canonicalRoot ?? ''
  if (!rootDir || !existsSync(rootDir)) {
    return skipped('Project root not locally accessible for file verification')
  }

  const mapped = service
    .listMemories({ projectId, scope: 'project', status: 'active', limit: 60 })
    .filter(m => m.mappingOrigin === 'dreamer' && m.backingFiles.length > 0)

  const staleCandidates: { memory: MemoryRecord; snippets: { file: string; snippet: string }[] }[] = []
  for (const m of mapped) {
    const baselineTs = m.lastVerifiedAt ?? m.createdAt
    let changed = false
    const snippets: { file: string; snippet: string }[] = []

    for (const rel of m.backingFiles.slice(0, 3)) {
      const validRel = validateRelativeWorkspaceFile(rootDir, rel)
      if (!validRel) {
        changed = true
        snippets.push({ file: rel, snippet: '[FILE REMOVED OR MISSING]' })
        continue
      }
      try {
        const full = resolve(rootDir, validRel)
        const st = statSync(full)
        if (st.mtimeMs > baselineTs || m.lastVerifiedAt === null) {
          changed = true
        }
        const content = readFileSync(full, 'utf8').slice(0, 3000)
        snippets.push({ file: validRel, snippet: content })
      } catch {
        changed = true
        snippets.push({ file: rel, snippet: '[UNREADABLE]' })
      }
    }

    if (changed) {
      staleCandidates.push({ memory: m, snippets })
    }
  }

  if (staleCandidates.length === 0) {
    return skipped('No backing files changed since last verification')
  }

  const batch = staleCandidates.slice(0, 12)
  const route = resolveAuxiliaryRoute(ctx, { provider: config.dreamer.provider, model: config.dreamer.model })
  const outcome = await runAuxiliaryCompletion(ctx, {
    route,
    systemPrompt: [
      'Verify each project memory against the current backing file snippets.',
      'Return ONLY valid XML:',
      '<verify>',
      '  <verdict id="123" action="verified|update|archive" consolidation="false">Updated text when action=update, or short reason</verdict>',
      '</verify>',
    ].join('\n'),
    userPrompt: batch
      .map(
        item =>
          `<check id="${item.memory.id}" category="${item.memory.category}">\n<memory>${item.memory.content}</memory>\n`
          + item.snippets.map(s => `<file path="${s.file}">\n${s.snippet}\n</file>`).join('\n')
          + '\n</check>',
      )
      .join('\n\n'),
    maxTokens: config.dreamer.maxOutputTokens,
    timeoutMs: config.dreamer.timeoutMs,
    purpose: 'magic-memory-dream-verify',
    signal,
  })

  if (!outcome.ok) return failedFromLlm(outcome)

  const rootMatch = /<verify\b[^>]*>([\s\S]*?)<\/verify>/i.exec(outcome.text)
  if (!rootMatch) return parseFailed(outcome.route)

  const byId = new Map(batch.map(b => [b.memory.id, b.memory]))
  const verdicts: Array<{ id: number; action: 'verified' | 'update' | 'archive'; consolidation: boolean; text: string }> = []
  for (const m of (rootMatch[1] ?? '').matchAll(/<verdict\b([^>]*)>([\s\S]*?)<\/verdict>/gi)) {
    const attrs = m[1] ?? ''
    const id = Number(readAttr(attrs, 'id'))
    if (!byId.has(id)) continue
    const action = (readAttr(attrs, 'action') ?? '').trim().toLowerCase()
    if (action !== 'verified' && action !== 'update' && action !== 'archive') continue
    const consolidation = readAttr(attrs, 'consolidation')?.toLowerCase() === 'true'
    verdicts.push({ id, action, consolidation, text: unescapeXml(m[2] ?? '') })
  }

  const now = Date.now()
  let refusedCount = 0
  const guarded = service.leases.runLeaseGuardedWrite(lease, () => {
    let applied = 0
    for (const v of verdicts) {
      const mem = byId.get(v.id)!
      const safety = evaluateClaimSafety(mem, {
        action: v.action,
        newContent: v.action === 'update' ? v.text : undefined,
        consolidation: v.consolidation,
      })
      if (!safety.allowed) {
        refusedCount += 1
        service.updateMemoryMetadata(v.id, { verificationState: 'conflict', lastVerifiedAt: now })
        continue
      }

      if (v.action === 'verified') {
        service.updateMemoryMetadata(v.id, { verificationState: 'verified', lastVerifiedAt: now })
        applied += 1
      } else if (v.action === 'update') {
        try {
          service.updateMemory({ id: v.id, projectId, content: v.text, consolidation: v.consolidation })
          service.updateMemoryMetadata(v.id, { verificationState: 'verified', lastVerifiedAt: now })
          applied += 1
        } catch {
          refusedCount += 1
        }
      } else if (v.action === 'archive') {
        service.archiveMemory(v.id, projectId, v.text || 'verified stale by dreamer')
        applied += 1
      }
    }
    return applied
  })

  if (!guarded.ok) return leaseLost()
  return {
    status: 'success',
    summary: `Verified ${batch.length} memories (${guarded.value} applied, ${refusedCount} safety-refused)`,
    itemsProcessed: batch.length,
    mutationsApplied: guarded.value,
    modelUsed: `${outcome.route.provider}/${outcome.route.model}`,
    failureClass: null,
    errorMessage: null,
  }
}

// ── 3. curate ─────────────────────────────────────────────────────────────────

async function runCurateTask(params: {
  readonly ctx: Context
  readonly service: MagicMemoryService
  readonly config: ResolvedConfig
  readonly projectId: string
  readonly lease: LeaseHandle
  readonly signal?: AbortSignal
}): Promise<DreamTaskOutcome> {
  const { ctx, service, config, projectId, lease, signal } = params
  const now = Date.now()

  // Phase A: deterministic expiry archive (model-free)
  const expiredRows = service
    .listMemories({ projectId, scope: 'project', status: 'active', limit: 200 })
    .filter(m => m.expiresAt !== null && m.expiresAt <= now)

  let expiredArchived = 0
  if (expiredRows.length > 0) {
    const guarded = service.leases.runLeaseGuardedWrite(lease, () => {
      let count = 0
      for (const m of expiredRows) {
        if (!m.pinned && m.category !== 'PROJECT_RULES') {
          service.archiveMemory(m.id, projectId, 'expired')
          count += 1
        }
      }
      return count
    })
    if (!guarded.ok) return leaseLost()
    expiredArchived = guarded.value
  }

  // Phase B: pick largest project category (>= 4 items) for single-category curation
  let targetCategory: ProjectMemoryCategory | null = null
  let targetItems: MemoryRecord[] = []
  for (const cat of PROJECT_MEMORY_CATEGORIES) {
    const items = service.listMemories({ projectId, scope: 'project', status: 'active', category: cat, limit: 60 })
    if (items.length > targetItems.length) {
      targetItems = items
      targetCategory = cat
    }
  }

  if (!targetCategory || targetItems.length < 4) {
    return expiredArchived > 0
      ? {
          status: 'success',
          summary: `Archived ${expiredArchived} expired memories (pool below curation threshold)`,
          itemsProcessed: expiredArchived,
          mutationsApplied: expiredArchived,
          modelUsed: null,
          failureClass: null,
          errorMessage: null,
        }
      : skipped('Memory pool too small for curation')
  }

  const route = resolveAuxiliaryRoute(ctx, { provider: config.dreamer.provider, model: config.dreamer.model })
  const outcome = await runAuxiliaryCompletion(ctx, {
    route,
    systemPrompt: [
      `Curate project memories strictly within category ${targetCategory}.`,
      'Consolidate duplicate/overlapping memories, tighten verbose entries, or archive obsolete ones.',
      'Never cross categories. Never archive critical rules.',
      'Return ONLY valid XML:',
      '<curate>',
      '  <merge target="10" sources="11,12">Consolidated content</merge>',
      '  <update id="15" consolidation="false">Tightened content</update>',
      '  <archive id="18">Reason</archive>',
      '</curate>',
    ].join('\n'),
    userPrompt: targetItems.map(m => `<memory id="${m.id}" imp="${m.importance}">${m.content}</memory>`).join('\n'),
    maxTokens: config.dreamer.maxOutputTokens,
    timeoutMs: config.dreamer.timeoutMs,
    purpose: 'magic-memory-dream-curate',
    signal,
  })

  if (!outcome.ok) return failedFromLlm(outcome)

  const rootMatch = /<curate\b[^>]*>([\s\S]*?)<\/curate>/i.exec(outcome.text)
  if (!rootMatch) return parseFailed(outcome.route)
  const body = rootMatch[1] ?? ''
  const byId = new Map(targetItems.map(m => [m.id, m]))

  const guarded = service.leases.runLeaseGuardedWrite(lease, () => {
    let applied = expiredArchived
    const consumed = new Set<number>()

    for (const m of body.matchAll(/<merge\b([^>]*)>([\s\S]*?)<\/merge>/gi)) {
      const attrs = m[1] ?? ''
      const targetId = Number(readAttr(attrs, 'target'))
      const sourceIds = (readAttr(attrs, 'sources') ?? '')
        .split(',')
        .map(s => Number(s.trim()))
        .filter(id => byId.has(id) && id !== targetId && !consumed.has(id))
      const mergedContent = unescapeXml(m[2] ?? '')
      if (!byId.has(targetId) || sourceIds.length === 0 || mergedContent.length === 0) continue
      try {
        service.mergeMemories({ projectId, targetId, sourceIds, mergedContent })
        for (const sid of sourceIds) consumed.add(sid)
        applied += 1
      } catch {
        // Guarded refusal (e.g. cross-category or duplicate)
      }
    }

    for (const m of body.matchAll(/<update\b([^>]*)>([\s\S]*?)<\/update>/gi)) {
      const attrs = m[1] ?? ''
      const id = Number(readAttr(attrs, 'id'))
      const mem = byId.get(id)
      if (!mem || consumed.has(id)) continue
      const newContent = unescapeXml(m[2] ?? '')
      const consolidation = readAttr(attrs, 'consolidation')?.toLowerCase() === 'true'
      const safety = evaluateClaimSafety(mem, { action: 'update', newContent, consolidation })
      if (!safety.allowed) continue
      try {
        service.updateMemory({ id, projectId, content: newContent, consolidation })
        applied += 1
      } catch {
        // Skip invalid update
      }
    }

    for (const m of body.matchAll(/<archive\b([^>]*)>([\s\S]*?)<\/archive>/gi)) {
      const attrs = m[1] ?? ''
      const id = Number(readAttr(attrs, 'id'))
      const mem = byId.get(id)
      if (!mem || consumed.has(id)) continue
      const safety = evaluateClaimSafety(mem, { action: 'archive' })
      if (!safety.allowed) continue
      const reason = unescapeXml(m[2] ?? '') || 'curated by dreamer'
      service.archiveMemory(id, projectId, reason)
      applied += 1
    }

    return applied
  })

  if (!guarded.ok) return leaseLost()
  return {
    status: 'success',
    summary: `Curated ${targetCategory} (${targetItems.length} scanned, ${guarded.value} mutations applied)`,
    itemsProcessed: targetItems.length,
    mutationsApplied: guarded.value,
    modelUsed: `${outcome.route.provider}/${outcome.route.model}`,
    failureClass: null,
    errorMessage: null,
  }
}

// ── 4. classify-memories ──────────────────────────────────────────────────────

async function runClassifyTask(params: {
  readonly ctx: Context
  readonly service: MagicMemoryService
  readonly config: ResolvedConfig
  readonly projectId: string
  readonly lease: LeaseHandle
  readonly signal?: AbortSignal
}): Promise<DreamTaskOutcome> {
  const { ctx, service, config, projectId, lease, signal } = params
  const memories = service.listMemories({ projectId, scope: 'project', status: 'active', limit: 100 })
  if (memories.length < 5) {
    return skipped('Active pool under 5 memories; classification deferred')
  }

  const route = resolveAuxiliaryRoute(ctx, { provider: config.dreamer.provider, model: config.dreamer.model })
  const outcome = await runAuxiliaryCompletion(ctx, {
    route,
    systemPrompt: [
      'Score each project memory for importance (1-100) and workspace shareability (true/false).',
      'Set shareable="false" for anything containing secrets, hostnames, internal tokens, or private paths.',
      'Return ONLY valid XML: <classify><item id="1" importance="75" shareable="true"/></classify>',
    ].join('\n'),
    userPrompt: memories.map(m => `<memory id="${m.id}" category="${m.category}">${m.content}</memory>`).join('\n'),
    maxTokens: config.dreamer.maxOutputTokens,
    timeoutMs: config.dreamer.timeoutMs,
    purpose: 'magic-memory-dream-classify',
    signal,
  })

  if (!outcome.ok) return failedFromLlm(outcome)

  const rootMatch = /<classify\b[^>]*>([\s\S]*?)<\/classify>/i.exec(outcome.text)
  if (!rootMatch) return parseFailed(outcome.route)

  const byId = new Map(memories.map(m => [m.id, m]))
  const items: { id: number; importance: number; shareable: boolean }[] = []
  for (const m of (rootMatch[1] ?? '').matchAll(/<item\b([^>]*?)\/?>/gi)) {
    const attrs = m[1] ?? ''
    const id = Number(readAttr(attrs, 'id'))
    if (!byId.has(id)) continue
    const imp = Number(readAttr(attrs, 'importance'))
    if (!Number.isFinite(imp)) continue
    const shareable = readAttr(attrs, 'shareable')?.toLowerCase() === 'true'
    items.push({ id, importance: Math.max(1, Math.min(100, Math.round(imp))), shareable })
  }

  const guarded = service.leases.runLeaseGuardedWrite(lease, () => {
    let applied = 0
    for (const item of items) {
      const mem = byId.get(item.id)!
      // Fail-closed secret check overrides model shareability
      const safeShareable = item.shareable && !containsSecretPattern(mem.content)
      service.updateMemoryMetadata(item.id, {
        importance: item.importance,
        shareable: safeShareable,
      })
      applied += 1
    }
    return applied
  })

  if (!guarded.ok) return leaseLost()
  return {
    status: 'success',
    summary: `Classified ${guarded.value}/${memories.length} memories`,
    itemsProcessed: memories.length,
    mutationsApplied: guarded.value,
    modelUsed: `${outcome.route.provider}/${outcome.route.model}`,
    failureClass: null,
    errorMessage: null,
  }
}

// ── 5. retrospective ──────────────────────────────────────────────────────────

async function runRetrospectiveTask(params: {
  readonly ctx: Context
  readonly service: MagicMemoryService
  readonly config: ResolvedConfig
  readonly projectId: string
  readonly lease: LeaseHandle
  readonly signal?: AbortSignal
}): Promise<DreamTaskOutcome> {
  const { ctx, service, config, projectId, lease, signal } = params
  const cutoff = Date.now() - config.dreamer.recencyDays * 86_400_000
  const userMsgs = service.storage.db
    .prepare(
      `SELECT session_id, content, created_at
       FROM session_highlights
       WHERE project_id = ? AND role = 'user' AND created_at >= ?
       ORDER BY created_at DESC
       LIMIT 60`,
    )
    .all(projectId, cutoff) as { session_id: string; content: string; created_at: number }[]

  if (userMsgs.length < 3) {
    return skipped('Not enough recent user messages for retrospective')
  }

  const route = resolveAuxiliaryRoute(ctx, { provider: config.dreamer.provider, model: config.dreamer.model })
  const outcome = await runAuxiliaryCompletion(ctx, {
    route,
    systemPrompt: [
      'Analyze recent user messages for explicit corrections, repeated friction, or persistent workflow preferences.',
      'Only emit durable learnings; emit <retrospective></retrospective> if no clear friction exists.',
      'Return ONLY valid XML:',
      '<retrospective>',
      '  <learning scope="project|user" category="PROJECT_RULES|CONSTRAINTS|ARCHITECTURE|CONFIG_VALUES|NAMING" importance="65">Concise rule or habit</learning>',
      '</retrospective>',
    ].join('\n'),
    userPrompt: userMsgs
      .map(m => `<msg session="${m.session_id.slice(0, 8)}">${m.content.slice(0, 500)}</msg>`)
      .join('\n'),
    maxTokens: config.dreamer.maxOutputTokens,
    timeoutMs: config.dreamer.timeoutMs,
    purpose: 'magic-memory-dream-retrospective',
    signal,
  })

  if (!outcome.ok) return failedFromLlm(outcome)

  const rootMatch = /<retrospective\b[^>]*>([\s\S]*?)<\/retrospective>/i.exec(outcome.text)
  if (!rootMatch) return parseFailed(outcome.route)

  const validCats = new Set<string>(PROJECT_MEMORY_CATEGORIES)
  const learnings: Array<{
    scope: 'project' | 'user'
    category: ProjectMemoryCategory
    importance: number
    content: string
  }> = []

  for (const m of (rootMatch[1] ?? '').matchAll(/<learning\b([^>]*)>([\s\S]*?)<\/learning>/gi)) {
    const attrs = m[1] ?? ''
    const scope = readAttr(attrs, 'scope')?.toLowerCase() === 'user' ? 'user' : 'project'
    const rawCat = (readAttr(attrs, 'category') ?? 'PROJECT_RULES').trim().toUpperCase()
    const category = (validCats.has(rawCat) ? rawCat : 'PROJECT_RULES') as ProjectMemoryCategory
    const imp = Number(readAttr(attrs, 'importance') ?? 65)
    const content = unescapeXml(m[2] ?? '')
    if (content.length >= 8) {
      learnings.push({
        scope,
        category,
        importance: Number.isFinite(imp) ? Math.max(1, Math.min(100, Math.round(imp))) : 65,
        content,
      })
    }
  }

  const guarded = service.leases.runLeaseGuardedWrite(lease, () => {
    let applied = 0
    for (const item of learnings) {
      if (item.scope === 'user') {
        if (config.dreamer.userMemoriesEnabled) {
          service.recordUserObservation(item.content, `retrospective:${projectId}`)
          applied += 1
        }
      } else {
        const res = service.writeMemory({
          projectId,
          category: item.category,
          content: item.content,
          importance: item.importance,
          scope: 'project',
          sourceKind: 'dreamer',
        })
        if (res.action === 'created') applied += 1
      }
    }
    return applied
  })

  if (!guarded.ok) return leaseLost()
  return {
    status: 'success',
    summary: `Scanned ${userMsgs.length} recent user messages; recorded ${guarded.value} retrospective learnings`,
    itemsProcessed: userMsgs.length,
    mutationsApplied: guarded.value,
    modelUsed: `${outcome.route.provider}/${outcome.route.model}`,
    failureClass: null,
    errorMessage: null,
  }
}

// ── 6. review-user-memories ───────────────────────────────────────────────────

async function runReviewUserMemoriesTask(params: {
  readonly ctx: Context
  readonly service: MagicMemoryService
  readonly config: ResolvedConfig
  readonly lease: LeaseHandle
  readonly signal?: AbortSignal
}): Promise<DreamTaskOutcome> {
  const { ctx, service, config, lease, signal } = params
  if (!config.dreamer.userMemoriesEnabled) {
    return skipped('User memory promotion is disabled')
  }

  const candidates = service
    .listPendingUserObservations()
    .filter(o => o.seenCount >= config.dreamer.userPromoteThreshold)

  if (candidates.length === 0) {
    return skipped('No recurring user observations met promotion threshold')
  }

  const existingProfile = service.listMemories({
    projectId: GLOBAL_PROJECT_ID,
    scope: 'global',
    status: 'active',
    limit: 50,
  })

  const route = resolveAuxiliaryRoute(ctx, { provider: config.dreamer.provider, model: config.dreamer.model })

  // If no LLM route is configured, promote clean observations directly so the loop never stalls
  if (!route) {
    const guarded = service.leases.runLeaseGuardedWrite(lease, () => {
      let promoted = 0
      const now = Date.now()
      for (const obs of candidates) {
        const res = service.writeMemory({
          projectId: GLOBAL_PROJECT_ID,
          category: 'USER_PROFILE',
          content: obs.observation,
          importance: 75,
          scope: 'global',
          sourceKind: 'dreamer',
        })
        service.storage.db
          .prepare('UPDATE user_observations SET promoted_memory_id = ?, updated_at = ? WHERE id = ?')
          .run(res.memory.id, now, obs.id)
        promoted += 1
      }
      return promoted
    })
    if (!guarded.ok) return leaseLost()
    return {
      status: 'success',
      summary: `Promoted ${guarded.value} recurring user observations directly to global USER_PROFILE`,
      itemsProcessed: candidates.length,
      mutationsApplied: guarded.value,
      modelUsed: null,
      failureClass: null,
      errorMessage: null,
    }
  }

  const outcome = await runAuxiliaryCompletion(ctx, {
    route,
    systemPrompt: [
      'Review recurring cross-session user observations and promote durable preferences to the global user profile.',
      'Skip transient or project-specific items. Deduplicate against <existing_profile>.',
      'Return ONLY valid XML:',
      '<user_profile_review>',
      '  <promote obs_id="1" importance="75">Clean durable user preference sentence</promote>',
      '</user_profile_review>',
    ].join('\n'),
    userPrompt: [
      '<existing_profile>',
      existingProfile.length === 0 ? '(none)' : existingProfile.map(m => `- ${m.content}`).join('\n'),
      '</existing_profile>',
      '',
      '<candidates>',
      candidates.map(c => `<obs id="${c.id}" seen="${c.seenCount}">${c.observation}</obs>`).join('\n'),
      '</candidates>',
    ].join('\n'),
    maxTokens: config.dreamer.maxOutputTokens,
    timeoutMs: config.dreamer.timeoutMs,
    purpose: 'magic-memory-dream-user-profile',
    signal,
  })

  if (!outcome.ok) return failedFromLlm(outcome)

  const rootMatch = /<user_profile_review\b[^>]*>([\s\S]*?)<\/user_profile_review>/i.exec(outcome.text)
  if (!rootMatch) return parseFailed(outcome.route)

  const byId = new Map(candidates.map(c => [c.id, c]))
  const promotions: { obsId: number; importance: number; text: string }[] = []
  for (const m of (rootMatch[1] ?? '').matchAll(/<promote\b([^>]*)>([\s\S]*?)<\/promote>/gi)) {
    const attrs = m[1] ?? ''
    const obsId = Number(readAttr(attrs, 'obs_id'))
    if (!byId.has(obsId)) continue
    const imp = Number(readAttr(attrs, 'importance') ?? 75)
    const text = unescapeXml(m[2] ?? '')
    if (text.length >= 6) {
      promotions.push({
        obsId,
        importance: Number.isFinite(imp) ? Math.max(1, Math.min(100, Math.round(imp))) : 75,
        text,
      })
    }
  }

  const guarded = service.leases.runLeaseGuardedWrite(lease, () => {
    let applied = 0
    const now = Date.now()
    for (const p of promotions) {
      const res = service.writeMemory({
        projectId: GLOBAL_PROJECT_ID,
        category: 'USER_PROFILE',
        content: p.text,
        importance: p.importance,
        scope: 'global',
        sourceKind: 'dreamer',
      })
      service.storage.db
        .prepare('UPDATE user_observations SET promoted_memory_id = ?, updated_at = ? WHERE id = ?')
        .run(res.memory.id, now, p.obsId)
      applied += 1
    }
    return applied
  })

  if (!guarded.ok) return leaseLost()
  return {
    status: 'success',
    summary: `Reviewed ${candidates.length} user observations; promoted ${guarded.value} to USER_PROFILE`,
    itemsProcessed: candidates.length,
    mutationsApplied: guarded.value,
    modelUsed: `${outcome.route.provider}/${outcome.route.model}`,
    failureClass: null,
    errorMessage: null,
  }
}

// ── Shared Outcome Builders ───────────────────────────────────────────────────

function skipped(summary: string): DreamTaskOutcome {
  return {
    status: 'skipped',
    summary,
    itemsProcessed: 0,
    mutationsApplied: 0,
    modelUsed: null,
    failureClass: null,
    errorMessage: null,
  }
}

function leaseLost(): DreamTaskOutcome {
  return {
    status: 'failed',
    summary: 'Lease lost before write commit',
    itemsProcessed: 0,
    mutationsApplied: 0,
    modelUsed: null,
    failureClass: 'lease_lost',
    errorMessage: 'Dreamer task lost conflict-domain lease mid-run',
  }
}

function parseFailed(route: { provider: string; model: string }): DreamTaskOutcome {
  return {
    status: 'failed',
    summary: 'Manifest parse failed (missing required root XML element)',
    itemsProcessed: 0,
    mutationsApplied: 0,
    modelUsed: `${route.provider}/${route.model}`,
    failureClass: 'parse_failed',
    errorMessage: 'Model response missing required root XML manifest element',
  }
}

function failedFromLlm(outcome: {
  failureClass: DreamFailureClass
  message: string
  route: { provider: string; model: string } | null
}): DreamTaskOutcome {
  return {
    status: 'failed',
    summary: `${outcome.failureClass}: ${outcome.message}`,
    itemsProcessed: 0,
    mutationsApplied: 0,
    modelUsed: outcome.route ? `${outcome.route.provider}/${outcome.route.model}` : null,
    failureClass: outcome.failureClass,
    errorMessage: outcome.message,
  }
}
