/**
 * Derive Marketplace Fees Module
 * Calculate marketplace breakdown, fees, and market share
 */
import { PipelineConfig } from './config';
import { Storage } from './storage';
/**
 * Derive marketplace statistics and fees
 */
export declare function deriveMarketplaceFees(config: PipelineConfig, storage: Storage): void;
/**
 * Get marketplace breakdown summary for export
 */
export declare function getMarketplaceBreakdown(storage: Storage): Record<string, {
    sale_count: number;
    volume_xtz: number;
    volume_percent: number;
    estimated_fees_xtz: number;
}>;
//# sourceMappingURL=derive_marketplace_fees.d.ts.map