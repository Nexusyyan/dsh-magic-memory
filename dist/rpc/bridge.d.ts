/**
 * Optional Host <-> Client API bridge over DSH's authenticated exact Fetch route
 * (`ctx.connection.fetch.register({ path: '/api/dsh-magic-memory', ... })`).
 *
 * IMPORTANT: Never call `ctx.connection.rpc.intercept('/api', ...)` — that single
 * slot belongs exclusively to DSH's core API Gateway. Using `connection.fetch.register`
 * with an exact plugin-owned path works seamlessly on BOTH Web Browser (HTTP POST
 * `./api/dsh-magic-memory`) and Electron Desktop (`dsh-app://` carrier IPC) with
 * automatic Host/Origin CSRF checks and owner-Peer authentication, while staying
 * dormant in Headless / ACP / SDK profiles.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ConnectionRpcHandlerResult } from '@deepseek-ai/dsh-client-connection';
import type { MagicMemoryService } from '../service/memory-service.js';
export declare const MAGIC_MEMORY_API_PATH = "/api/dsh-magic-memory";
export declare function dispatchMagicMemoryRpc(ctx: Context, service: MagicMemoryService, endpoint: string, payload: unknown, signal: AbortSignal): Promise<ConnectionRpcHandlerResult>;
export declare function createMagicMemoryFetchHandler(ctx: Context, service: MagicMemoryService): (request: Request) => Promise<Response>;
export declare function registerRpcBridge(ctx: Context, service: MagicMemoryService): void;
//# sourceMappingURL=bridge.d.ts.map