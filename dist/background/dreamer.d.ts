/**
 * Process-wide Dreamer scheduler with conflict-domain leases, cheap backlog gates,
 * hot retries (up to 3x on failure), heartbeat renewal, and structured failure records.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { MagicMemoryService } from '../service/memory-service.js';
import { type DreamRunRecord, type DreamTaskName } from '../shared/types.js';
export declare function leaseKeyForDreamTask(projectId: string, taskName: DreamTaskName): string;
export declare class DreamerScheduler {
    private readonly ctx;
    private readonly service;
    private ticking;
    private stopTimer;
    constructor(ctx: Context, service: MagicMemoryService);
    /** Register the periodic timer as a reversible Cordis effect (reschedules on config change). */
    start(): void;
    /** Stop the periodic timer explicitly if started. */
    stop(): void;
    /** Run all due tasks across recently active projects whose cheap backlog gates pass. */
    tick(signal?: AbortSignal): Promise<DreamRunRecord[]>;
    /** Manual execution (`/ctx-dream [task]` or Sidebar UI button). */
    runManual(projectId: string, taskName?: DreamTaskName, signal?: AbortSignal): Promise<DreamRunRecord[]>;
    private findDueTasks;
    private isTaskDue;
    private runSingleTask;
    private recordRunAndSchedule;
}
//# sourceMappingURL=dreamer.d.ts.map