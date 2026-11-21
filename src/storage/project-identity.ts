/**
 * Cross-platform project identity resolution (`git:<root_sha>` or `dir:<path_hash>`).
 * Stable across git worktrees, macOS/Linux/Windows path conventions, and transient git errors.
 */

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface ResolvedProjectIdentity {
  readonly projectId: string
  readonly displayName: string
  readonly canonicalRoot: string
  readonly isGitRepo: boolean
}

interface IdentityCacheEntry {
  readonly identity: ResolvedProjectIdentity
  readonly expiresAt: number
}

const GIT_SUCCESS_TTL_MS = 10 * 60_000
const GIT_ERROR_COOLDOWN_MS = 5 * 60_000
const GIT_TIMEOUT_MS = 2000

/**
 * Normalize a filesystem path into a cross-platform canonical POSIX-like key:
 * - resolves symlinks when the path exists on disk
 * - converts Windows backslashes to `/`
 * - lowercases Windows drive letters (`C:/Foo` -> `c:/Foo`)
 * - strips trailing slashes (except root `/`)
 */
export function normalizeCanonicalPath(inputPath: string): string {
  let target = inputPath.trim()
  if (target.length === 0) return ''

  // Handle Windows-style paths even when tested on POSIX
  const isWindowsStyle = /^[A-Za-z]:[\\/]/.test(target)
  if (!isWindowsStyle) {
    target = resolve(target)
    try {
      target = realpathSync(target)
    } catch {
      // Path may not exist yet or be remote/synthetic
    }
  }

  let normalized = target.replace(/\\/g, '/')
  if (/^[A-Za-z]:\//.test(normalized)) {
    normalized = normalized[0]!.toLowerCase() + normalized.slice(1)
  }
  while (normalized.length > 1 && normalized.endsWith('/') && !/^[a-z]:\/$/.test(normalized)) {
    normalized = normalized.slice(0, -1)
  }
  return normalized
}

export function deriveDirectoryProjectId(canonicalPath: string): string {
  const hash = createHash('sha256').update(canonicalPath).digest('hex').slice(0, 16)
  return `dir:${hash}`
}

export function deriveGitProjectId(rootCommitSha: string): string {
  const hash = createHash('sha256').update(rootCommitSha.trim().toLowerCase()).digest('hex').slice(0, 16)
  return `git:${hash}`
}

export class ProjectIdentityResolver {
  private readonly cache = new Map<string, IdentityCacheEntry>()
  private readonly gitCooldownUntil = new Map<string, number>()

  async resolve(cwd: string): Promise<ResolvedProjectIdentity> {
    const canonical = normalizeCanonicalPath(cwd || process.cwd())
    const now = Date.now()
    const cached = this.cache.get(canonical)
    if (cached && cached.expiresAt > now) {
      return cached.identity
    }

    const cooldownUntil = this.gitCooldownUntil.get(canonical) ?? 0
    if (cooldownUntil <= now) {
      const gitInfo = await this.probeGit(cwd)
      if (gitInfo !== null) {
        const identity: ResolvedProjectIdentity = {
          projectId: deriveGitProjectId(gitInfo.rootCommit),
          displayName: basename(gitInfo.topLevel) || 'git-project',
          canonicalRoot: normalizeCanonicalPath(gitInfo.topLevel),
          isGitRepo: true,
        }
        this.cache.set(canonical, { identity, expiresAt: now + GIT_SUCCESS_TTL_MS })
        return identity
      }
      // Transient error or non-git repo: park on cooldown so we don't spawn git on every step
      this.gitCooldownUntil.set(canonical, now + GIT_ERROR_COOLDOWN_MS)
    }

    const dirName = basename(canonical.replace(/^[a-z]:\//, '/')) || 'workspace'
    const fallback: ResolvedProjectIdentity = {
      projectId: deriveDirectoryProjectId(canonical),
      displayName: dirName,
      canonicalRoot: canonical,
      isGitRepo: false,
    }
    this.cache.set(canonical, { identity: fallback, expiresAt: now + GIT_ERROR_COOLDOWN_MS })
    return fallback
  }

  /** Synchronous deterministic fallback (uses cached identity if present, else `dir:<hash>`). */
  resolveSync(cwd: string): ResolvedProjectIdentity {
    const canonical = normalizeCanonicalPath(cwd || process.cwd())
    const cached = this.cache.get(canonical)
    if (cached) return cached.identity
    const dirName = basename(canonical.replace(/^[a-z]:\//, '/')) || 'workspace'
    return {
      projectId: deriveDirectoryProjectId(canonical),
      displayName: dirName,
      canonicalRoot: canonical,
      isGitRepo: false,
    }
  }

  clearCache(): void {
    this.cache.clear()
    this.gitCooldownUntil.clear()
  }

  private async probeGit(cwd: string): Promise<{ rootCommit: string; topLevel: string } | null> {
    try {
      const opts = { cwd, timeout: GIT_TIMEOUT_MS, windowsHide: true }
      const [rootRes, topRes] = await Promise.all([
        execFileAsync('git', ['rev-list', '--max-parents=0', 'HEAD'], opts),
        execFileAsync('git', ['rev-parse', '--show-toplevel'], opts),
      ])
      // Take the lexicographically smallest root commit for deterministic multi-root repos
      const roots = rootRes.stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => /^[0-9a-f]{40}$/i.test(line))
        .sort()
      const rootCommit = roots[0]
      const topLevel = topRes.stdout.trim()
      if (!rootCommit || !topLevel) return null
      return { rootCommit, topLevel }
    } catch {
      return null
    }
  }
}
