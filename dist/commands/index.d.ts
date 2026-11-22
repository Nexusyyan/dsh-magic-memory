/**
 * Human slash commands registered optionally via `ctx.commands`:
 * - `/ctx-status`  — project identity, memory counts, cache preservation ratio, Dreamer health
 * - `/ctx-extract` — manually extract episode & durable facts from the current session
 * - `/ctx-dream`   — manually run due or specific Dreamer maintenance task(s)
 * - `/ctx-sync`    — queue an incremental `<memory-updates>` delta for the next step
 * - `/ctx-memory`  — quick search / export / doctor diagnostics
 */
import type { Context } from '@deepseek-ai/cordis';
import type { MagicMemoryService } from '../service/memory-service.js';
export declare function registerMagicMemoryCommands(ctx: Context, service: MagicMemoryService): void;
//# sourceMappingURL=index.d.ts.map