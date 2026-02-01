/**
 * Export Module
 * Generate CSV and JSON outputs from pipeline data
 */
import { Storage } from './storage';
import { PipelineConfig } from './config';
/**
 * Generate summary statistics
 */
export interface SummaryStats {
    windowStart: string;
    windowEnd: string;
    unique_buyers_count: number;
    total_purchases_count: number;
    total_spend_xtz: number;
    purchases_per_buyer: number;
    unique_creators_count: number;
    total_mints_count: number;
    total_minted_qty: number;
    total_listings_count: number;
    total_editions_listed: number;
    distinct_tokens_listed: number;
    total_offer_accepts_count: number;
    offer_accepts_with_both_prices: number;
    under_list_count: number;
    under_list_rate: number | null;
    total_resales_count: number;
    total_resale_proceeds_xtz: number;
    unique_resellers_count: number;
    overlap_count: number;
    overlap_rate_of_buyers: number;
    overlap_rate_of_creators: number;
    listings_per_buyer: number;
    editions_listed_per_buyer: number;
    creators_per_buyer: number;
    choice_overload_proxy: number;
    volume_trend: 'up' | 'down' | 'flat';
    volume_trend_percent: number;
    marketplace_breakdown: Record<string, {
        sale_count: number;
        volume_xtz: number;
        volume_percent: number;
        estimated_fees_xtz: number;
    }>;
    objkt_market_share_percent: number;
    objkt_total_fees_xtz: number;
    cex_flow: {
        total_xtz_from_cex: number;
        total_xtz_to_cex: number;
        net_ecosystem_flow: number;
        buyers_with_cex_funding: number;
        buyers_with_cex_funding_percent: number;
        sales_only_buyers: number;
        sales_only_buyers_percent: number;
        creators_who_bought_nfts: number;
        creators_who_bought_nfts_percent: number;
        creators_who_cashed_out: number;
        creators_who_cashed_out_percent: number;
    };
}
/**
 * Export all data to CSV and JSON files (synchronous - works from local data only)
 */
export declare function exportData(config: PipelineConfig, storage: Storage, startISO: string, endISO: string): void;
/**
 * Print summary to console
 */
export declare function printSummary(summary: SummaryStats): void;
//# sourceMappingURL=export.d.ts.map