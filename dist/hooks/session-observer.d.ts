/**
 * Session event observer that drives the closed-loop background memory pipeline:
 * 1. Indexes genuine user/assistant highlights into `session_highlights` for cross-session `ctx_search`.
 * 2. Detects native DSH `compaction/summary` events to trigger pre-loss fact rescue extraction
 *    and mark the session for Post-Compaction Re-Anchoring.
 * 3. Triggers asynchronous incremental extraction at `turn/end` once token threshold is reached.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SessionExtractor } from '../background/extractor.js';
import type { MagicMemoryService } from '../service/memory-service.js';
export declare function registerSessionObserver(ctx: Context, service: MagicMemoryService, extractor: SessionExtractor): void;
//# sourceMappingURL=session-observer.d.ts.map