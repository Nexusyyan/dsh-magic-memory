/**
 * Cross-platform SQLite connection wrapper over Node.js built-in `node:sqlite`.
 * Works identically on macOS (arm64/x64), Windows (x64), and Linux (x64/arm64)
 * with zero native addon compilation.
 */
import { DatabaseSync } from 'node:sqlite';
import { LATEST_SUPPORTED_VERSION } from './migrations.js';
export declare function resolveDefaultDbPath(): string;
export declare class MemoryDatabase {
    readonly path: string;
    readonly db: DatabaseSync;
    readonly schemaVersion: number;
    private txDepth;
    private closed;
    constructor(dbPath?: string);
    /**
     * Run a synchronous operation inside an immediate SQLite transaction.
     * Supports nested calls transparently via named SAVEPOINTs.
     */
    transaction<T>(fn: () => T): T;
    getJournalMode(): string;
    getCurrentSchemaVersion(): number;
    getFileSizeBytes(): number;
    isClosed(): boolean;
    close(): void;
    private assertOpen;
}
export { LATEST_SUPPORTED_VERSION };
//# sourceMappingURL=database.d.ts.map