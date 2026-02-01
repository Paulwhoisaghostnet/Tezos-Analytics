/**
 * Derive CEX Flow Module
 * Track CEX funding and cash-out patterns for buyers and creators
 */
import { PipelineConfig } from './config';
import { Storage } from './storage';
/**
 * Derive CEX flow analysis for buyers
 */
export declare function deriveBuyerCexFlow(config: PipelineConfig, storage: Storage): void;
/**
 * Quick CEX flow summary without XTZ transfers
 * Uses heuristics from balance data when XTZ transfers not available
 */
export declare function deriveBuyerCexFlowFromBalances(storage: Storage): void;
//# sourceMappingURL=derive_cex_flow.d.ts.map