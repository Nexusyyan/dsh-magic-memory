/**
 * SQLite schema & versioned migrations for dsh-magic-memory.
 * Uses Node.js built-in `node:sqlite` with FTS5 (`unicode61`) and zero native addons.
 */
import type { DatabaseSync } from 'node:sqlite';
export declare const LATEST_SUPPORTED_VERSION = 2;
export declare class SchemaFenceError extends Error {
    readonly code = "SCHEMA_FENCE_UNSUPPORTED";
    readonly dbVersion: number;
    readonly supportedVersion: number;
    constructor(dbVersion: number, supportedVersion: number);
}
export declare function readSchemaVersion(db: DatabaseSync): number;
/**
 * Validate schema fence and apply pending migrations atomically.
 * Opening an already-current database takes no write lock.
 */
export declare function ensureSchema(db: DatabaseSync): number;
//# sourceMappingURL=migrations.d.ts.map