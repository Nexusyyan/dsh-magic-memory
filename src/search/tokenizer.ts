/**
 * Zero-dependency CJK + Latin/Code dual tokenizer, n-gram similarity scorer,
 * token estimator, and fail-closed secret detector.
 */

import { createHash } from 'node:crypto'

const CJK_RUN_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu
const LATIN_WORD_RE = /[A-Za-z0-9_./:-]+/g
const CAMEL_SPLIT_RE = /([a-z0-9])([A-Z])/g

/**
 * Normalize text for exact-deduplication hashing (collapses whitespace, trims,
 * lowercases ASCII while keeping CJK verbatim).
 */
export function normalizeForHash(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function computeContentHash(text: string): string {
  return createHash('sha256').update(normalizeForHash(text)).digest('hex')
}

/**
 * Tokenize mixed Chinese/Japanese/Korean + English + code identifiers into a
 * space-delimited FTS5 token stream.
 *
 * - CJK runs emit bigrams + unigrams so both multi-char phrases ("数据库连接池")
 *   and single-char concepts ("锁", "端") match reliably in SQLite FTS5 `unicode61`.
 * - Code identifiers emit both full token and split sub-tokens (`camelCase`,
 *   `snake_case`, `kebab-case`, file path segments).
 */
export function tokenizeForSearch(input: string): string {
  const normalized = input.normalize('NFKC')
  const tokens: string[] = []

  // 1. CJK runs: bigrams + unigrams (bounded per run for safety on huge blobs)
  for (const match of normalized.matchAll(CJK_RUN_RE)) {
    const run = match[0]
    const chars = Array.from(run)
    if (chars.length === 1) {
      tokens.push(chars[0]!)
      continue
    }
    for (let i = 0; i < chars.length; i++) {
      tokens.push(chars[i]!)
      if (i + 1 < chars.length) {
        tokens.push(chars[i]! + chars[i + 1]!)
      }
    }
  }

  // 2. Latin / code identifiers / paths / numbers
  for (const match of normalized.matchAll(LATIN_WORD_RE)) {
    const raw = match[0]
    const lower = raw.toLowerCase()
    if (lower.length >= 2) tokens.push(lower)

    // Split path/delimiter/camelCase sub-identifiers
    const parts = raw
      .replace(CAMEL_SPLIT_RE, '$1 $2')
      .split(/[^A-Za-z0-9]+/)
      .map(part => part.toLowerCase())
      .filter(part => part.length >= 2)

    for (const part of parts) {
      if (part !== lower) tokens.push(part)
    }
  }

  return tokens.join(' ')
}

/**
 * Build a safe FTS5 MATCH expression from an arbitrary user/agent query.
 * Uses quoted literals joined by OR (with higher priority on multi-char terms
 * when the query is long) so punctuation or FTS operators can never throw syntax errors.
 */
export function buildSafeFtsQuery(query: string): string | null {
  const normalized = query.normalize('NFKC').trim()
  if (normalized.length === 0) return null

  const terms = new Set<string>()

  // Prefer CJK bigrams; include unigrams only for single-char CJK runs
  for (const match of normalized.matchAll(CJK_RUN_RE)) {
    const chars = Array.from(match[0])
    if (chars.length === 1) {
      terms.add(chars[0]!)
    } else {
      for (let i = 0; i < chars.length - 1; i++) {
        terms.add(chars[i]! + chars[i + 1]!)
      }
      if (chars.length <= 3) {
        for (const c of chars) terms.add(c)
      }
    }
  }

  for (const match of normalized.matchAll(LATIN_WORD_RE)) {
    const raw = match[0]
    const lower = raw.toLowerCase()
    if (lower.length >= 2) terms.add(lower)
    const parts = raw
      .replace(CAMEL_SPLIT_RE, '$1 $2')
      .split(/[^A-Za-z0-9]+/)
      .map(p => p.toLowerCase())
      .filter(p => p.length >= 2)
    for (const part of parts) terms.add(part)
  }

  if (terms.size === 0) return null

  // Cap query width to stay well below SQLite's FTS5 expression depth limit
  const bounded = Array.from(terms).slice(0, 24)
  return bounded.map(term => `"${term.replaceAll('"', '""')}"`).join(' OR ')
}

/** Extract normalized character bigrams/trigrams for language-agnostic lexical reranking & near-dedupe. */
export function extractCharNgrams(text: string): Set<string> {
  const clean = normalizeForHash(text).replace(/\s+/g, ' ')
  const chars = Array.from(clean)
  const grams = new Set<string>()
  if (chars.length < 2) {
    if (chars.length === 1) grams.add(chars[0]!)
    return grams
  }
  for (let i = 0; i < chars.length - 1; i++) {
    const bi = chars[i]! + chars[i + 1]!
    if (bi.trim().length > 0) grams.add(bi)
    if (i + 2 < chars.length) {
      const tri = bi + chars[i + 2]!
      if (tri.trim().length > 0) grams.add(tri)
    }
  }
  return grams
}

/** Jaccard similarity over character n-grams in [0, 1]. */
export function ngramJaccardSimilarity(a: string, b: string): number {
  const setA = extractCharNgrams(a)
  const setB = extractCharNgrams(b)
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA]
  for (const gram of smaller) {
    if (larger.has(gram)) intersection += 1
  }
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Overlap ratio of query n-grams found in candidate text, in [0, 1].
 * Better than symmetric Jaccard for short queries against longer memories.
 */
export function queryLexicalOverlap(query: string, candidate: string): number {
  const qGrams = extractCharNgrams(query)
  if (qGrams.size === 0) return 0
  const cGrams = extractCharNgrams(candidate)
  if (cGrams.size === 0) return 0
  let hits = 0
  for (const g of qGrams) {
    if (cGrams.has(g)) hits += 1
  }
  return hits / qGrams.size
}

/**
 * Fast, deterministic token count estimator aware of CJK vs ASCII density.
 * CJK characters average ~1.5 tokens/char across modern BPE tokenizers;
 * ASCII averages ~4 chars/token.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0
  let cjkChars = 0
  for (const match of text.matchAll(CJK_RUN_RE)) {
    cjkChars += Array.from(match[0]).length
  }
  const nonCjkChars = Math.max(0, text.length - cjkChars)
  return Math.ceil(cjkChars * 1.5 + nonCjkChars / 4)
}

const SECRET_PATTERNS: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bsk-proj-[A-Za-z0-9_-]{16,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\b(?:api[_-]?key|access[_-]?token|secret[_-]?key|password|passwd|bearer)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{12,}['"]?/i,
]

/** Fail-closed check for credential-like substrings (used by Dreamer shareability classifier). */
export function containsSecretPattern(text: string): boolean {
  return SECRET_PATTERNS.some(re => re.test(text))
}

/** Extract plain text from DSH ContentBlock arrays or strings without coupling to adapter internals. */
export function extractTextContent(
  content: readonly { readonly type?: string; readonly text?: string }[] | string | null | undefined,
): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  const parts: string[] = []
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string' && block.text.length > 0) {
      parts.push(block.text)
    }
  }
  return parts.join('\n')
}
