/**
 * Cross-platform project identity resolution (`git:<root_sha>` or `dir:<path_hash>`).
 * Stable across git worktrees, macOS/Linux/Windows path conventions, and transient git errors.
 */
export interface ResolvedProjectIdentity {
    readonly projectId: string;
    readonly displayName: string;
    readonly canonicalRoot: string;
    readonly isGitRepo: boolean;
}
/**
 * Normalize a filesystem path into a cross-platform canonical POSIX-like key:
 * - resolves symlinks when the path exists on disk
 * - converts Windows backslashes to `/`
 * - lowercases Windows drive letters (`C:/Foo` -> `c:/Foo`)
 * - strips trailing slashes (except root `/`)
 */
export declare function normalizeCanonicalPath(inputPath: string): string;
export declare function deriveDirectoryProjectId(canonicalPath: string): string;
export declare function deriveGitProjectId(rootCommitSha: string): string;
export declare class ProjectIdentityResolver {
    private readonly cache;
    private readonly gitCooldownUntil;
    resolve(cwd: string): Promise<ResolvedProjectIdentity>;
    /** Synchronous deterministic fallback (uses cached identity if present, else `dir:<hash>`). */
    resolveSync(cwd: string): ResolvedProjectIdentity;
    clearCache(): void;
    private probeGit;
}
//# sourceMappingURL=project-identity.d.ts.map