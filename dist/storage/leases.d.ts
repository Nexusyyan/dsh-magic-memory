/**
 * Multi-process SQLite lease manager for Dreamer conflict domains and session extraction.
 * Uses `BEGIN IMMEDIATE` transactions, PID liveness checks, and heartbeat renewal so
 * multiple DSH profiles/processes sharing one `memory.db` never race each other.
 */
import type { MemoryDatabase } from './database.js';
export declare const DEFAULT_LEASE_TTL_MS = 120000;
export declare const DEFAULT_LEASE_HEARTBEAT_MS = 60000;
export interface LeaseHandle {
    readonly leaseKey: string;
    readonly ownerId: string;
    readonly ownerPid: number;
    renew(ttlMs?: number): boolean;
    isHeld(): boolean;
    release(): void;
}
/** Check whether a local process PID is provably dead (`ESRCH`). */
export declare function isPidDefinitelyDead(pid: number): boolean;
export declare class LeaseManager {
    private readonly storage;
    constructor(storage: MemoryDatabase);
    acquire(leaseKey: string, ttlMs?: number, ownerId?: string, ownerPid?: number): LeaseHandle | null;
    renew(leaseKey: string, ownerId: string, ttlMs?: number): boolean;
    isHeld(leaseKey: string, ownerId: string): boolean;
    release(leaseKey: string, ownerId: string): void;
    /**
     * Execute a write transaction ONLY if this caller still owns the lease.
     * Returns `{ ok: true, value }` or `{ ok: false, reason: 'lease_lost' }`.
     */
    runLeaseGuardedWrite<T>(lease: LeaseHandle, writeFn: () => T): {
        readonly ok: true;
        readonly value: T;
    } | {
        readonly ok: false;
        readonly reason: 'lease_lost';
    };
    /** Clean expired or dead-PID leases (used by `/ctx-memory doctor`). */
    cleanupStaleLeases(): {
        active: number;
        cleaned: number;
    };
}
//# sourceMappingURL=leases.d.ts.map