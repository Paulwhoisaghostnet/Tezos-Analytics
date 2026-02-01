"use strict";
/**
 * TzKT API Client
 * HTTP client with pagination, retries, and rate limiting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TzktClient = void 0;
/**
 * Sleep helper for rate limiting
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * TzKT API Client class
 */
class TzktClient {
    config;
    requestCount = 0;
    lastRequestTime = 0;
    minRequestInterval = 100; // ms between requests
    constructor(config) {
        this.config = config;
    }
    /**
     * Make HTTP request with retry and rate limiting
     */
    async request(url, attempt = 1) {
        // Rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
            await sleep(this.minRequestInterval - timeSinceLastRequest);
        }
        this.lastRequestTime = Date.now();
        this.requestCount++;
        try {
            const response = await fetch(url);
            if (response.status === 429) {
                // Rate limited - exponential backoff
                const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt);
                console.warn(`Rate limited (429), waiting ${delay}ms before retry ${attempt}/${this.config.retryAttempts}`);
                await sleep(delay);
                if (attempt < this.config.retryAttempts) {
                    return this.request(url, attempt + 1);
                }
                throw new Error(`Rate limit exceeded after ${this.config.retryAttempts} retries`);
            }
            if (response.status >= 500) {
                // Server error - exponential backoff
                const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt);
                console.warn(`Server error (${response.status}), waiting ${delay}ms before retry ${attempt}/${this.config.retryAttempts}`);
                await sleep(delay);
                if (attempt < this.config.retryAttempts) {
                    return this.request(url, attempt + 1);
                }
                throw new Error(`Server error ${response.status} after ${this.config.retryAttempts} retries`);
            }
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
            return await response.json();
        }
        catch (error) {
            if (attempt < this.config.retryAttempts && error.code === 'ECONNRESET') {
                const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt);
                console.warn(`Connection reset, waiting ${delay}ms before retry ${attempt}/${this.config.retryAttempts}`);
                await sleep(delay);
                return this.request(url, attempt + 1);
            }
            throw error;
        }
    }
    /**
     * Paginate through all results
     */
    async *paginate(baseUrl, params) {
        let offset = 0;
        const limit = this.config.pageSize;
        while (true) {
            const queryParams = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
                queryParams.set(key, String(value));
            }
            queryParams.set('limit', String(limit));
            queryParams.set('offset', String(offset));
            const url = `${baseUrl}?${queryParams.toString()}`;
            const results = await this.request(url);
            if (results.length === 0) {
                break;
            }
            yield results;
            if (results.length < limit) {
                break;
            }
            offset += limit;
        }
    }
    /**
     * Get marketplace transactions within time window
     */
    async *getMarketplaceTransactions(marketplaceAddresses, entrypoints, startISO, endISO) {
        const baseUrl = `${this.config.tzktBaseUrl}/operations/transactions`;
        // TzKT supports filtering by multiple targets with comma separation
        const params = {
            'timestamp.ge': startISO,
            'timestamp.lt': endISO,
            'status': 'applied',
            'target.in': marketplaceAddresses.join(','),
            'entrypoint.in': entrypoints.join(','),
            'sort.asc': 'id'
        };
        yield* this.paginate(baseUrl, params);
    }
    /**
     * Get all transactions to specific marketplace contracts in time window
     * (for entrypoint discovery)
     */
    async *getAllMarketplaceTransactions(marketplaceAddresses, startISO, endISO) {
        const baseUrl = `${this.config.tzktBaseUrl}/operations/transactions`;
        const params = {
            'timestamp.ge': startISO,
            'timestamp.lt': endISO,
            'status': 'applied',
            'target.in': marketplaceAddresses.join(','),
            'sort.asc': 'id'
        };
        yield* this.paginate(baseUrl, params);
    }
    /**
     * Get ALL transactions in time window (comprehensive sync)
     * This returns EVERY transaction on Tezos in the time window
     */
    async *getAllTransactions(startISO, endISO, afterId = 0) {
        const baseUrl = `${this.config.tzktBaseUrl}/operations/transactions`;
        const params = {
            'timestamp.ge': startISO,
            'timestamp.lt': endISO,
            'status': 'applied',
            'sort.asc': 'id'
        };
        if (afterId > 0) {
            params['id.gt'] = afterId;
        }
        yield* this.paginate(baseUrl, params);
    }
    /**
     * Get ALL XTZ transfers (simple transfers with amount > 0)
     */
    async *getAllXtzTransfers(startISO, endISO, afterId = 0) {
        const baseUrl = `${this.config.tzktBaseUrl}/operations/transactions`;
        const params = {
            'timestamp.ge': startISO,
            'timestamp.lt': endISO,
            'status': 'applied',
            'amount.gt': 0,
            'sort.asc': 'id'
        };
        if (afterId > 0) {
            params['id.gt'] = afterId;
        }
        yield* this.paginate(baseUrl, params);
    }
    /**
     * Get token transfers within time window (for detecting mints and sales)
     */
    async *getTokenTransfers(startISO, endISO, additionalParams = {}) {
        const baseUrl = `${this.config.tzktBaseUrl}/tokens/transfers`;
        const params = {
            'timestamp.ge': startISO,
            'timestamp.lt': endISO,
            'token.standard': 'fa2',
            'sort.asc': 'id',
            ...additionalParams
        };
        yield* this.paginate(baseUrl, params);
    }
    /**
     * Get token transfers by transaction ID
     */
    async getTokenTransfersByTransactionId(transactionId) {
        const url = `${this.config.tzktBaseUrl}/tokens/transfers?transactionId=${transactionId}`;
        return this.request(url);
    }
    /**
     * Get token transfers by operation hash
     */
    async getTokenTransfersByHash(hash) {
        // Get operation details first to find transaction IDs
        const ops = await this.getOperationsByHash(hash);
        const transfers = [];
        for (const op of ops) {
            if ('id' in op) {
                const txTransfers = await this.getTokenTransfersByTransactionId(op.id);
                transfers.push(...txTransfers);
            }
        }
        return transfers;
    }
    /**
     * Get operations by hash (full operation group)
     */
    async getOperationsByHash(hash) {
        const url = `${this.config.tzktBaseUrl}/operations/${hash}`;
        return this.request(url);
    }
    /**
     * Generic GET request (public wrapper for request)
     */
    async get(url) {
        return this.request(url);
    }
    /**
     * Get account balance at historical timestamp
     */
    async getBalanceAtTime(address, timestampISO) {
        try {
            const url = `${this.config.tzktBaseUrl}/accounts/${address}/balance_history?timestamp.le=${timestampISO}&limit=1&sort.desc=level`;
            const results = await this.request(url);
            if (results.length > 0) {
                return results[0].balance;
            }
            // If no history before timestamp, try to get earliest balance
            const earliestUrl = `${this.config.tzktBaseUrl}/accounts/${address}/balance_history?limit=1&sort.asc=level`;
            const earliest = await this.request(earliestUrl);
            if (earliest.length > 0) {
                // Return 0 if account was created after our start date
                return 0;
            }
            return null;
        }
        catch (error) {
            console.warn(`Failed to get balance for ${address}: ${error}`);
            return null;
        }
    }
    /**
     * Get mint transactions (entrypoint = mint) within time window
     */
    async *getMintTransactions(startISO, endISO) {
        const baseUrl = `${this.config.tzktBaseUrl}/operations/transactions`;
        const params = {
            'timestamp.ge': startISO,
            'timestamp.lt': endISO,
            'status': 'applied',
            'entrypoint': 'mint',
            'sort.asc': 'id'
        };
        yield* this.paginate(baseUrl, params);
    }
    /**
     * Get transactions from specific sender (for finding seller transactions)
     */
    async *getTransactionsFromSender(senderAddress, marketplaceAddresses, entrypoints, startISO, endISO) {
        const baseUrl = `${this.config.tzktBaseUrl}/operations/transactions`;
        const params = {
            'timestamp.ge': startISO,
            'timestamp.lt': endISO,
            'status': 'applied',
            'sender': senderAddress,
            'target.in': marketplaceAddresses.join(','),
            'entrypoint.in': entrypoints.join(','),
            'sort.asc': 'id'
        };
        yield* this.paginate(baseUrl, params);
    }
    /**
     * Get request statistics
     */
    getStats() {
        return { requestCount: this.requestCount };
    }
}
exports.TzktClient = TzktClient;
//# sourceMappingURL=tzkt.js.map