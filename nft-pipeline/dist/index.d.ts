/**
 * Tezos NFT Market Pressure Pipeline
 *
 * Two-phase architecture:
 * 1. SYNC: Pull all raw data from TzKT API into local SQLite (run once or periodically)
 * 2. ANALYZE: Derive insights from local data (no API calls, instant re-runs)
 */
import { PipelineConfig } from './config';
/**
 * SYNC COMMAND: Pull all raw data from TzKT into local database
 */
declare function runSync(config?: PipelineConfig): Promise<void>;
/**
 * ANALYZE COMMAND: Derive insights from local data (no API calls)
 */
declare function runAnalyze(config?: PipelineConfig): Promise<void>;
/**
 * DISCOVER COMMAND: Analyze entrypoints from local data
 */
declare function runDiscover(config?: PipelineConfig): Promise<void>;
/**
 * RESOLVE COMMAND: Resolve wallet identities via TzKT and Tezos Domains
 */
declare function runResolve(config?: PipelineConfig): Promise<void>;
/**
 * CLASSIFY COMMAND: Classify all transactions by category
 */
declare function runClassify(config?: PipelineConfig): Promise<void>;
/**
 * NETWORK COMMAND: Generate D3.js network visualization
 */
declare function runNetwork(config?: PipelineConfig): Promise<void>;
/**
 * SYNC-XTZ COMMAND: Sync XTZ transfers for CEX flow analysis
 */
declare function runSyncXtz(config?: PipelineConfig): Promise<void>;
/**
 * SYNC-ALL COMMAND: Comprehensive sync of ALL transactions
 */
declare function runSyncAll(config?: PipelineConfig): Promise<void>;
/**
 * STATUS COMMAND: Show database status
 */
declare function runStatus(config?: PipelineConfig): Promise<void>;
/**
 * FULL COMMAND: Sync + Analyze in one go
 */
declare function runFull(config?: PipelineConfig): Promise<void>;
export { runSync, runSyncXtz, runSyncAll, runAnalyze, runFull, runDiscover, runResolve, runClassify, runNetwork, runStatus };
//# sourceMappingURL=index.d.ts.map