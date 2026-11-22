/**
 * Model-facing DSH tools registered on `ctx.tools` using `defineTool`:
 * - `ctx_memory` — write / update / archive / restore / merge / get / list durable memories
 * - `ctx_search` — unified hybrid search across memories, episodes, notes, and session highlights
 * - `ctx_note`   — add / list / read / dismiss lightweight session or project notes
 *
 * Tool schemas remain static across turns to keep provider tool-catalog KV cache intact.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { MagicMemoryService } from '../service/memory-service.js';
export declare function registerMagicMemoryTools(ctx: Context, service: MagicMemoryService): void;
//# sourceMappingURL=index.d.ts.map