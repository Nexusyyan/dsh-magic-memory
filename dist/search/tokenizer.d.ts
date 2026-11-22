/**
 * Zero-dependency CJK + Latin/Code dual tokenizer, n-gram similarity scorer,
 * token estimator, and fail-closed secret detector.
 */
/**
 * Normalize text for exact-deduplication hashing (collapses whitespace, trims,
 * lowercases ASCII while keeping CJK verbatim).
 */
export declare function normalizeForHash(text: string): string;
export declare function computeContentHash(text: string): string;
/**
 * Tokenize mixed Chinese/Japanese/Korean + English + code identifiers into a
 * space-delimited FTS5 token stream.
 *
 * - CJK runs emit bigrams + unigrams so both multi-char phrases ("数据库连接池")
 *   and single-char concepts ("锁", "端") match reliably in SQLite FTS5 `unicode61`.
 * - Code identifiers emit both full token and split sub-tokens (`camelCase`,
 *   `snake_case`, `kebab-case`, file path segments).
 */
export declare function tokenizeForSearch(input: string): string;
/**
 * Build a safe FTS5 MATCH expression from an arbitrary user/agent query.
 * Uses quoted literals joined by OR (with higher priority on multi-char terms
 * when the query is long) so punctuation or FTS operators can never throw syntax errors.
 */
export declare function buildSafeFtsQuery(query: string): string | null;
/** Extract normalized character bigrams/trigrams for language-agnostic lexical reranking & near-dedupe. */
export declare function extractCharNgrams(text: string): Set<string>;
/** Jaccard similarity over character n-grams in [0, 1]. */
export declare function ngramJaccardSimilarity(a: string, b: string): number;
/**
 * Overlap ratio of query n-grams found in candidate text, in [0, 1].
 * Better than symmetric Jaccard for short queries against longer memories.
 */
export declare function queryLexicalOverlap(query: string, candidate: string): number;
/**
 * Fast, deterministic token count estimator aware of CJK vs ASCII density.
 * CJK characters average ~1.5 tokens/char across modern BPE tokenizers;
 * ASCII averages ~4 chars/token.
 */
export declare function estimateTokens(text: string): number;
/** Fail-closed check for credential-like substrings (used by Dreamer shareability classifier). */
export declare function containsSecretPattern(text: string): boolean;
/** Extract plain text from DSH ContentBlock arrays or strings without coupling to adapter internals. */
export declare function extractTextContent(content: readonly {
    readonly type?: string;
    readonly text?: string;
}[] | string | null | undefined): string;
//# sourceMappingURL=tokenizer.d.ts.map