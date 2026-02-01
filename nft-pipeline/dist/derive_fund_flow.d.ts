/**
 * Derive Fund Flow Module
 * Track where creator proceeds go (CEX cash-out vs buying NFTs)
 */
import { PipelineConfig } from './config';
import { Storage } from './storage';
/**
 * Derive fund flow for creators who made sales
 */
export declare function deriveCreatorFundFlow(config: PipelineConfig, storage: Storage): void;
/**
 * Calculate aggregate fund flow metrics
 */
export declare function calculateFundFlowSummary(storage: Storage): {
    total_xtz_from_cex: number;
    total_xtz_to_cex: number;
    net_ecosystem_flow: number;
    creators_who_bought_nfts: number;
    creators_who_bought_nfts_percent: number;
    creators_who_cashed_out: number;
    creators_who_cashed_out_percent: number;
};
//# sourceMappingURL=derive_fund_flow.d.ts.map