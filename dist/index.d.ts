/**
 * Main Host-side Cordis plugin entry for `dsh-magic-memory`.
 *
 * Mounts on the Host plane so all DSH runtimes (Web, Desktop with all presets,
 * Headless CLI, ACP, SDK) share the exact same durable memory closed loop.
 * Optional services (`commands`, `connection`, `workingDirectory`, `systemPrompt`)
 * are injected conditionally so minimal profiles stay healthy without them.
 */
import type { Context } from '@deepseek-ai/cordis';
import { Config, type MagicMemoryConfig } from './config.js';
export declare const name = "dsh-magic-memory";
export declare const inject: readonly ["tools", "sessions"];
export { Config };
export type { MagicMemoryConfig };
export { MagicMemoryService } from './service/memory-service.js';
export { SessionExtractor, parseExtractionManifest } from './background/extractor.js';
export { DreamerScheduler } from './background/dreamer.js';
export { evaluateClaimSafety } from './background/dreamer-tasks.js';
export { dispatchMagicMemoryRpc, createMagicMemoryFetchHandler, MAGIC_MEMORY_API_PATH } from './rpc/bridge.js';
export * from './shared/types.js';
export declare function apply(ctx: Context, config?: Partial<MagicMemoryConfig>): void;
//# sourceMappingURL=index.d.ts.map