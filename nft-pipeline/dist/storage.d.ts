/**
 * SQLite Storage Layer using sql.js (pure JavaScript, no native modules)
 * Schema for raw data sync + derived analytics
 */
export interface RawTransaction {
    id: number;
    hash: string;
    level: number;
    timestamp: string;
    sender: string;
    target: string;
    amount: number;
    entrypoint: string | null;
    parameters: string | null;
    status: string;
    has_internals: boolean;
}
export interface RawTokenTransfer {
    id: number;
    level: number;
    timestamp: string;
    token_contract: string;
    token_id: string;
    token_standard: string;
    from_address: string | null;
    to_address: string | null;
    amount: string;
    transaction_id: number | null;
}
export interface BuyerRow {
    address: string;
}
export interface BuyerBalanceRow {
    address: string;
    balance_mutez: number | null;
    ts: string;
}
export interface PurchaseRow {
    id?: number;
    op_hash: string;
    ts: string;
    buyer: string;
    seller: string | null;
    marketplace: string;
    token_contract: string;
    token_id: string;
    qty: number;
    spend_mutez: number | null;
    kind: 'listing_purchase' | 'offer_accept_purchase' | 'open_edition';
}
export interface CreatorRow {
    address: string;
}
export interface MintRow {
    id?: number;
    op_hash: string;
    ts: string;
    creator: string;
    token_contract: string;
    token_id: string;
    qty: number;
}
export interface ListingRow {
    id?: number;
    op_hash: string;
    ts: string;
    creator: string;
    marketplace: string;
    token_contract: string;
    token_id: string;
    qty: number;
    list_price_mutez: number | null;
}
export interface OfferAcceptRow {
    id?: number;
    op_hash: string;
    ts: string;
    creator_seller: string;
    buyer_offer: string | null;
    marketplace: string;
    token_contract: string;
    token_id: string;
    qty: number;
    accepted_price_mutez: number | null;
    reference_list_price_mutez: number | null;
    under_list: boolean | null;
}
export interface ResaleRow {
    id?: number;
    op_hash: string;
    ts: string;
    seller_collector: string;
    buyer: string | null;
    marketplace: string;
    token_contract: string;
    token_id: string;
    qty: number;
    proceeds_mutez: number | null;
}
export interface RawXtzTransfer {
    id: number;
    hash: string;
    timestamp: string;
    sender: string;
    target: string;
    amount: number;
    is_from_cex: boolean;
    is_to_cex: boolean;
}
export interface DailyMetricsRow {
    date: string;
    total_volume_mutez: number;
    avg_sale_price_mutez: number | null;
    sale_count: number;
    unique_buyers: number;
    unique_sellers: number;
}
export interface MarketplaceStatsRow {
    marketplace: string;
    sale_count: number;
    volume_mutez: number;
    volume_percent: number | null;
    estimated_fees_mutez: number;
}
export interface DailyMarketplaceFeesRow {
    date: string;
    marketplace: string;
    volume_mutez: number;
    fees_mutez: number;
    sale_count: number;
}
export interface BuyerCexFlowRow {
    address: string;
    has_cex_funding: boolean;
    cex_funding_mutez: number;
    is_sales_only: boolean;
    total_received_mutez: number;
    total_from_sales_mutez: number;
}
export interface CreatorFundFlowRow {
    address: string;
    total_sales_mutez: number;
    sent_to_cex_mutez: number;
    spent_on_nfts_mutez: number;
    cashed_out: boolean;
    bought_nfts: boolean;
}
export interface ContractMetadataRow {
    address: string;
    is_fungible: boolean;
    token_type: string | null;
    alias: string | null;
    checked_at: string;
}
export interface AddressRegistryRow {
    address: string;
    address_type: 'wallet' | 'contract' | 'cex' | 'marketplace' | 'bridge';
    alias: string | null;
    tezos_domain: string | null;
    owned_domains: string | null;
    category: string | null;
    tx_count: number;
    metadata: string | null;
    resolved_at: string | null;
}
export interface AllTransactionRow {
    id: number;
    hash: string;
    level: number;
    timestamp: string;
    sender: string;
    target: string | null;
    amount: number;
    entrypoint: string | null;
    parameters: string | null;
    status: string;
    tx_category: string | null;
    is_internal: boolean;
}
export interface XtzFlowRow {
    id: number;
    hash: string;
    timestamp: string;
    sender: string;
    target: string;
    amount_mutez: number;
    flow_type: string | null;
}
export interface WalletXtzSummaryRow {
    address: string;
    balance_start_mutez: number | null;
    balance_end_mutez: number | null;
    total_received_mutez: number;
    total_sent_mutez: number;
    received_from_sales_mutez: number;
    spent_on_nfts_mutez: number;
    sent_to_cex_mutez: number;
    received_from_cex_mutez: number;
    sent_to_l2_mutez: number;
    received_from_l2_mutez: number;
}
export interface SyncProgressRow {
    week_id: string;
    start_date: string;
    end_date: string;
    status: 'pending' | 'in_progress' | 'complete' | 'error';
    all_tx_count: number;
    xtz_flow_count: number;
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
}
/**
 * Storage class for managing SQLite database
 */
export declare class Storage {
    private db;
    private dbPath;
    private constructor();
    /**
     * Create/open a storage instance (async factory)
     */
    static create(dbPath: string): Promise<Storage>;
    /**
     * Initialize database schema
     */
    private initSchema;
    /**
     * Save database to disk
     */
    save(): void;
    /**
     * Close database
     */
    close(): void;
    query<T>(sql: string, params?: any[]): T[];
    private run;
    getValue<T>(sql: string, params?: any[]): T | null;
    insertRawTransaction(tx: RawTransaction): void;
    insertRawTransactionsBatch(txs: RawTransaction[]): void;
    getRawTransactionCount(): number;
    getMaxRawTransactionId(): number | null;
    getRawTransactionsByTarget(targets: string[], entrypoints: string[]): RawTransaction[];
    getRawTransactionsBySender(sender: string, targets: string[], entrypoints: string[]): RawTransaction[];
    getEntrypointCounts(targets: string[]): Array<{
        entrypoint: string;
        count: number;
        target: string;
    }>;
    insertRawTokenTransfer(transfer: RawTokenTransfer): void;
    insertRawTokenTransfersBatch(transfers: RawTokenTransfer[]): void;
    getRawTokenTransferCount(): number;
    getMaxRawTokenTransferId(): number | null;
    getRawTransfersByTransactionId(txId: number): RawTokenTransfer[];
    getAllRawTokenTransfers(): RawTokenTransfer[];
    getRawMintTransfers(): RawTokenTransfer[];
    getRawTransfersFromAddress(address: string): RawTokenTransfer[];
    insertRawBalance(address: string, balanceMutez: number | null, snapshotTs: string): void;
    getRawBalance(address: string): {
        balance_mutez: number | null;
        snapshot_ts: string;
    } | null;
    getAddressesWithoutBalance(): string[];
    getRawBalanceCount(): number;
    setSyncMetadata(key: string, value: string): void;
    getSyncMetadata(key: string): string | null;
    upsertBuyer(address: string): void;
    getAllBuyers(): string[];
    getBuyerCount(): number;
    upsertBuyerBalance(address: string, balanceMutez: number | null, ts: string): void;
    getBuyerBalance(address: string): BuyerBalanceRow | null;
    insertPurchase(purchase: Omit<PurchaseRow, 'id'>): void;
    getAllPurchases(): PurchaseRow[];
    getPurchasesByBuyer(buyer: string): PurchaseRow[];
    getPurchaseCount(): number;
    getTotalSpendMutez(): number;
    upsertCreator(address: string): void;
    getAllCreators(): string[];
    getCreatorCount(): number;
    insertMint(mint: Omit<MintRow, 'id'>): void;
    getAllMints(): MintRow[];
    getMintsByCreator(creator: string): MintRow[];
    getMintCount(): number;
    getTotalMintedQty(): number;
    insertListing(listing: Omit<ListingRow, 'id'>): void;
    getAllListings(): ListingRow[];
    getListingsByCreator(creator: string): ListingRow[];
    getListingCount(): number;
    getTotalEditionsListed(): number;
    getDistinctTokensListed(): number;
    getLatestListingPrice(seller: string, tokenContract: string, tokenId: string, beforeTs: string): number | null;
    insertOfferAccept(offerAccept: Omit<OfferAcceptRow, 'id'>): void;
    getAllOfferAccepts(): OfferAcceptRow[];
    getOfferAcceptsBySeller(seller: string): OfferAcceptRow[];
    getOfferAcceptCount(): number;
    getUnderListCount(): number;
    getOfferAcceptsWithBothPrices(): number;
    insertResale(resale: Omit<ResaleRow, 'id'>): void;
    getAllResales(): ResaleRow[];
    getResalesBySeller(seller: string): ResaleRow[];
    getResaleCount(): number;
    getTotalResaleProceeds(): number;
    setMetadata(key: string, value: string): void;
    getMetadata(key: string): string | null;
    getBuyerCreatorOverlap(): string[];
    insertRawXtzTransfer(transfer: RawXtzTransfer): void;
    insertRawXtzTransfersBatch(transfers: RawXtzTransfer[]): void;
    getRawXtzTransferCount(): number;
    getMaxRawXtzTransferId(): number | null;
    getXtzTransfersToAddress(address: string): RawXtzTransfer[];
    getXtzTransfersFromAddress(address: string): RawXtzTransfer[];
    getCexFundingForAddress(address: string): number;
    getCexCashoutFromAddress(address: string): number;
    insertDailyMetrics(metrics: DailyMetricsRow): void;
    getAllDailyMetrics(): DailyMetricsRow[];
    getDailyMetricsCount(): number;
    insertMarketplaceStats(stats: MarketplaceStatsRow): void;
    getAllMarketplaceStats(): MarketplaceStatsRow[];
    getMarketplaceStats(marketplace: string): MarketplaceStatsRow | null;
    getTotalMarketplaceFees(): number;
    getObjktTotalFees(): number;
    getObjktMarketShare(): number;
    insertDailyMarketplaceFees(row: DailyMarketplaceFeesRow): void;
    getAllDailyMarketplaceFees(): DailyMarketplaceFeesRow[];
    getDailyMarketplaceFeesByMarketplace(marketplace: string): DailyMarketplaceFeesRow[];
    insertBuyerCexFlow(row: BuyerCexFlowRow): void;
    getAllBuyerCexFlow(): BuyerCexFlowRow[];
    getBuyersWithCexFundingCount(): number;
    getSalesOnlyBuyersCount(): number;
    getTotalCexFunding(): number;
    insertCreatorFundFlow(row: CreatorFundFlowRow): void;
    getAllCreatorFundFlow(): CreatorFundFlowRow[];
    getCreatorsWhoCashedOutCount(): number;
    getCreatorsWhoBoughtNftsCount(): number;
    getTotalSentToCex(): number;
    insertContractMetadata(row: ContractMetadataRow): void;
    getContractMetadata(address: string): ContractMetadataRow | null;
    isContractFungible(address: string): boolean | null;
    getAllCachedFungibleContracts(): string[];
    getUncachedContracts(contracts: string[]): string[];
    insertAddressRegistry(row: AddressRegistryRow): void;
    getAddressRegistry(address: string): AddressRegistryRow | null;
    getAllAddressRegistry(): AddressRegistryRow[];
    getTopContracts(limit?: number): Array<{
        address: string;
        tx_count: number;
    }>;
    getTopWallets(limit?: number): Array<{
        address: string;
        tx_count: number;
    }>;
    getUnresolvedAddresses(limit?: number): string[];
    updateAddressResolution(address: string, alias: string | null, tezosDomain: string | null, ownedDomains: string[] | null): void;
    getAddressRegistryCount(): number;
    getResolvedAddressCount(): number;
    insertAllTransaction(row: AllTransactionRow): void;
    getAllTransactionsCount(): number;
    getMaxAllTransactionId(): number;
    getAllTransactionsByCategory(category: string): AllTransactionRow[];
    updateTransactionCategory(id: number, category: string): void;
    insertXtzFlow(row: XtzFlowRow): void;
    getXtzFlowsCount(): number;
    getMaxXtzFlowId(): number;
    getXtzFlowsByType(flowType: string): XtzFlowRow[];
    getXtzFlowsForAddress(address: string): XtzFlowRow[];
    upsertWalletXtzSummary(row: WalletXtzSummaryRow): void;
    getWalletXtzSummary(address: string): WalletXtzSummaryRow | null;
    getAllWalletXtzSummaries(): WalletXtzSummaryRow[];
    initializeSyncWeeks(weeks: Array<{
        id: string;
        start: string;
        end: string;
    }>): void;
    getSyncProgress(weekId: string): SyncProgressRow | null;
    getAllSyncProgress(): SyncProgressRow[];
    updateSyncProgress(weekId: string, status: 'pending' | 'in_progress' | 'complete' | 'error', txCount?: number, flowCount?: number, errorMessage?: string): void;
    getIncompleteWeeks(): SyncProgressRow[];
    getSyncSummary(): {
        total: number;
        complete: number;
        pending: number;
        inProgress: number;
    };
    clearDerived(): void;
    clearAll(): void;
}
//# sourceMappingURL=storage.d.ts.map