/**
 * Data Sync Module
 * Pull all raw data from TzKT API into local SQLite database
 * This is the ONLY module that makes API calls
 */
import { PipelineConfig } from './config';
import { Storage } from './storage';
/**
 * Main sync function - pulls all data from TzKT
 */
export declare function syncAllData(config: PipelineConfig, storage: Storage, includeXtzTransfers?: boolean): Promise<{
    transactions: number;
    transfers: number;
    balances: number;
    xtzTransfers: number;
}>;
/**
 * Sync only XTZ transfers (requires analyze to be run first)
 */
export declare function syncXtzTransfersOnly(config: PipelineConfig, storage: Storage): Promise<number>;
/**
 * Comprehensive sync - pull ALL transactions and XTZ flows
 * This is for full chain analysis, not just NFT marketplace activity
 */
export declare function syncAllComprehensive(config: PipelineConfig, storage: Storage): Promise<{
    allTransactions: number;
    xtzFlows: number;
}>;
export declare const SYNC_WEEKS: {
    id: string;
    start: string;
    end: string;
    label: string;
}[];
/**
 * Initialize weekly sync progress tracking
 */
export declare function initializeWeeklySyncProgress(storage: Storage): void;
/**
 * Sync a specific week's comprehensive data
 */
export declare function syncWeek(config: PipelineConfig, storage: Storage, weekId: string): Promise<{
    allTransactions: number;
    xtzFlows: number;
}>;
/**
 * Print weekly sync status
 */
export declare function printWeeklySyncStatus(storage: Storage): void;
/**
 * Sync all incomplete weeks
 */
export declare function syncAllIncompleteWeeks(config: PipelineConfig, storage: Storage): Promise<void>;
/**
 * Check sync status
 */
export declare function getSyncStatus(storage: Storage): {
    lastSync: string | null;
    windowStart: string | null;
    windowEnd: string | null;
    transactions: number;
    transfers: number;
    balances: number;
    xtzTransfers: number;
};
//# sourceMappingURL=sync.d.ts.map