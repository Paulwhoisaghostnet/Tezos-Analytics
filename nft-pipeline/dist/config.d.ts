/**
 * Configuration for Tezos NFT Market Pressure Pipeline
 * Marketplace contracts, entrypoints, CEX addresses, and pipeline settings
 */
export interface MarketplaceEntrypoints {
    buy: string[];
    list: string[];
    acceptOffer: string[];
}
export interface MarketplaceConfig {
    name: string;
    address: string;
    entrypoints: MarketplaceEntrypoints;
    feeRate: number;
}
export interface PipelineConfig {
    windowDays: number;
    tzktBaseUrl: string;
    pageSize: number;
    maxConcurrency: number;
    retryAttempts: number;
    retryBaseDelayMs: number;
    marketplaces: MarketplaceConfig[];
    cexAddresses: string[];
    outputDir: string;
    dbPath: string;
}
export declare const KNOWN_CEX_ADDRESSES: string[];
export declare const ETHERLINK_BRIDGE_CONTRACTS: {
    bridge: string;
    exchanger: string;
};
export declare const KNOWN_BRIDGE_ADDRESSES: string[];
/**
 * Check if an address is a known bridge contract
 */
export declare function isBridgeAddress(address: string): boolean;
export declare const DEFAULT_MARKETPLACES: MarketplaceConfig[];
export declare const DEFAULT_CONFIG: PipelineConfig;
/**
 * Check if an address is a known CEX
 */
export declare function isCexAddress(config: PipelineConfig, address: string): boolean;
/**
 * Get marketplace fee rate by name
 */
export declare function getMarketplaceFeeRate(config: PipelineConfig, marketplaceName: string): number;
/**
 * Check if marketplace is objkt (any objkt contract)
 */
export declare function isObjktMarketplace(marketplaceName: string): boolean;
/**
 * Calculate window timestamps
 */
export declare function getTimeWindow(config: PipelineConfig): {
    start: Date;
    end: Date;
    startISO: string;
    endISO: string;
};
/**
 * Get all buy entrypoints across all marketplaces
 */
export declare function getAllBuyEntrypoints(config: PipelineConfig): string[];
/**
 * Get all list entrypoints across all marketplaces
 */
export declare function getAllListEntrypoints(config: PipelineConfig): string[];
/**
 * Get all accept offer entrypoints across all marketplaces
 */
export declare function getAllAcceptOfferEntrypoints(config: PipelineConfig): string[];
/**
 * Get all marketplace addresses
 */
export declare function getAllMarketplaceAddresses(config: PipelineConfig): string[];
/**
 * Find marketplace by address
 */
export declare function findMarketplace(config: PipelineConfig, address: string): MarketplaceConfig | undefined;
//# sourceMappingURL=config.d.ts.map