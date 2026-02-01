/**
 * TzKT API Client
 * HTTP client with pagination, retries, and rate limiting
 */
import { PipelineConfig } from './config';
export interface TzktTransaction {
    id: number;
    hash: string;
    level: number;
    timestamp: string;
    sender: {
        address: string;
        alias?: string;
    };
    target?: {
        address: string;
        alias?: string;
    };
    amount: number;
    parameter?: {
        entrypoint: string;
        value: any;
    };
    status: string;
    hasInternals: boolean;
    initiator?: {
        address: string;
    };
}
export interface TzktTokenTransfer {
    id: number;
    level: number;
    timestamp: string;
    token: {
        id: number;
        contract: {
            address: string;
            alias?: string;
        };
        tokenId: string;
        standard: string;
        metadata?: any;
    };
    from?: {
        address: string;
        alias?: string;
    };
    to?: {
        address: string;
        alias?: string;
    };
    amount: string;
    transactionId?: number;
}
export interface TzktBalanceHistory {
    level: number;
    timestamp: string;
    balance: number;
}
export interface TzktOperationGroup {
    hash: string;
    branch: string;
    transactions: TzktTransaction[];
}
/**
 * TzKT API Client class
 */
export declare class TzktClient {
    private config;
    private requestCount;
    private lastRequestTime;
    private minRequestInterval;
    constructor(config: PipelineConfig);
    /**
     * Make HTTP request with retry and rate limiting
     */
    private request;
    /**
     * Paginate through all results
     */
    paginate<T>(baseUrl: string, params: Record<string, string | number | boolean>): AsyncGenerator<T[], void, unknown>;
    /**
     * Get marketplace transactions within time window
     */
    getMarketplaceTransactions(marketplaceAddresses: string[], entrypoints: string[], startISO: string, endISO: string): AsyncGenerator<TzktTransaction[], void, unknown>;
    /**
     * Get all transactions to specific marketplace contracts in time window
     * (for entrypoint discovery)
     */
    getAllMarketplaceTransactions(marketplaceAddresses: string[], startISO: string, endISO: string): AsyncGenerator<TzktTransaction[], void, unknown>;
    /**
     * Get ALL transactions in time window (comprehensive sync)
     * This returns EVERY transaction on Tezos in the time window
     */
    getAllTransactions(startISO: string, endISO: string, afterId?: number): AsyncGenerator<TzktTransaction[], void, unknown>;
    /**
     * Get ALL XTZ transfers (simple transfers with amount > 0)
     */
    getAllXtzTransfers(startISO: string, endISO: string, afterId?: number): AsyncGenerator<TzktTransaction[], void, unknown>;
    /**
     * Get token transfers within time window (for detecting mints and sales)
     */
    getTokenTransfers(startISO: string, endISO: string, additionalParams?: Record<string, string>): AsyncGenerator<TzktTokenTransfer[], void, unknown>;
    /**
     * Get token transfers by transaction ID
     */
    getTokenTransfersByTransactionId(transactionId: number): Promise<TzktTokenTransfer[]>;
    /**
     * Get token transfers by operation hash
     */
    getTokenTransfersByHash(hash: string): Promise<TzktTokenTransfer[]>;
    /**
     * Get operations by hash (full operation group)
     */
    getOperationsByHash(hash: string): Promise<TzktTransaction[]>;
    /**
     * Generic GET request (public wrapper for request)
     */
    get<T>(url: string): Promise<T>;
    /**
     * Get account balance at historical timestamp
     */
    getBalanceAtTime(address: string, timestampISO: string): Promise<number | null>;
    /**
     * Get mint transactions (entrypoint = mint) within time window
     */
    getMintTransactions(startISO: string, endISO: string): AsyncGenerator<TzktTransaction[], void, unknown>;
    /**
     * Get transactions from specific sender (for finding seller transactions)
     */
    getTransactionsFromSender(senderAddress: string, marketplaceAddresses: string[], entrypoints: string[], startISO: string, endISO: string): AsyncGenerator<TzktTransaction[], void, unknown>;
    /**
     * Get request statistics
     */
    getStats(): {
        requestCount: number;
    };
}
//# sourceMappingURL=tzkt.d.ts.map