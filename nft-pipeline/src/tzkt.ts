/**
 * TzKT API Client
 * HTTP client with pagination, retries, and rate limiting
 */

import { PipelineConfig } from './config';

// Response types from TzKT API
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
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * TzKT API Client class
 */
export class TzktClient {
  private config: PipelineConfig;
  private requestCount = 0;
  private lastRequestTime = 0;
  private minRequestInterval = 100; // ms between requests

  constructor(config: PipelineConfig) {
    this.config = config;
  }

  /**
   * Make HTTP request with retry and rate limiting
   */
  private async request<T>(url: string, attempt = 1): Promise<T> {
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
      
      return await response.json() as T;
    } catch (error) {
      if (attempt < this.config.retryAttempts && (error as any).code === 'ECONNRESET') {
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
  async *paginate<T>(
    baseUrl: string,
    params: Record<string, string | number | boolean>
  ): AsyncGenerator<T[], void, unknown> {
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
      const results = await this.request<T[]>(url);
      
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
  async *getMarketplaceTransactions(
    marketplaceAddresses: string[],
    entrypoints: string[],
    startISO: string,
    endISO: string
  ): AsyncGenerator<TzktTransaction[], void, unknown> {
    const baseUrl = `${this.config.tzktBaseUrl}/operations/transactions`;
    
    // TzKT supports filtering by multiple targets with comma separation
    const params: Record<string, string | number | boolean> = {
      'timestamp.ge': startISO,
      'timestamp.lt': endISO,
      'status': 'applied',
      'target.in': marketplaceAddresses.join(','),
      'entrypoint.in': entrypoints.join(','),
      'sort.asc': 'id'
    };
    
    yield* this.paginate<TzktTransaction>(baseUrl, params);
  }

  /**
   * Get all transactions to specific marketplace contracts in time window
   * (for entrypoint discovery)
   */
  async *getAllMarketplaceTransactions(
    marketplaceAddresses: string[],
    startISO: string,
    endISO: string
  ): AsyncGenerator<TzktTransaction[], void, unknown> {
    const baseUrl = `${this.config.tzktBaseUrl}/operations/transactions`;
    
    const params: Record<string, string | number | boolean> = {
      'timestamp.ge': startISO,
      'timestamp.lt': endISO,
      'status': 'applied',
      'target.in': marketplaceAddresses.join(','),
      'sort.asc': 'id'
    };
    
    yield* this.paginate<TzktTransaction>(baseUrl, params);
  }

  /**
   * Get ALL transactions in time window (comprehensive sync)
   * This returns EVERY transaction on Tezos in the time window
   */
  async *getAllTransactions(
    startISO: string,
    endISO: string,
    afterId: number = 0
  ): AsyncGenerator<TzktTransaction[], void, unknown> {
    const baseUrl = `${this.config.tzktBaseUrl}/operations/transactions`;
    
    const params: Record<string, string | number | boolean> = {
      'timestamp.ge': startISO,
      'timestamp.lt': endISO,
      'status': 'applied',
      'sort.asc': 'id'
    };

    if (afterId > 0) {
      params['id.gt'] = afterId;
    }
    
    yield* this.paginate<TzktTransaction>(baseUrl, params);
  }

  /**
   * Get ALL XTZ transfers (simple transfers with amount > 0)
   */
  async *getAllXtzTransfers(
    startISO: string,
    endISO: string,
    afterId: number = 0
  ): AsyncGenerator<TzktTransaction[], void, unknown> {
    const baseUrl = `${this.config.tzktBaseUrl}/operations/transactions`;
    
    const params: Record<string, string | number | boolean> = {
      'timestamp.ge': startISO,
      'timestamp.lt': endISO,
      'status': 'applied',
      'amount.gt': 0,
      'sort.asc': 'id'
    };

    if (afterId > 0) {
      params['id.gt'] = afterId;
    }
    
    yield* this.paginate<TzktTransaction>(baseUrl, params);
  }

  /**
   * Get token transfers within time window (for detecting mints and sales)
   */
  async *getTokenTransfers(
    startISO: string,
    endISO: string,
    additionalParams: Record<string, string> = {}
  ): AsyncGenerator<TzktTokenTransfer[], void, unknown> {
    const baseUrl = `${this.config.tzktBaseUrl}/tokens/transfers`;
    
    const params: Record<string, string | number | boolean> = {
      'timestamp.ge': startISO,
      'timestamp.lt': endISO,
      'token.standard': 'fa2',
      'sort.asc': 'id',
      ...additionalParams
    };
    
    yield* this.paginate<TzktTokenTransfer>(baseUrl, params);
  }

  /**
   * Get token transfers by transaction ID
   */
  async getTokenTransfersByTransactionId(transactionId: number): Promise<TzktTokenTransfer[]> {
    const url = `${this.config.tzktBaseUrl}/tokens/transfers?transactionId=${transactionId}`;
    return this.request<TzktTokenTransfer[]>(url);
  }

  /**
   * Get token transfers by operation hash
   */
  async getTokenTransfersByHash(hash: string): Promise<TzktTokenTransfer[]> {
    // Get operation details first to find transaction IDs
    const ops = await this.getOperationsByHash(hash);
    const transfers: TzktTokenTransfer[] = [];
    
    for (const op of ops) {
      if ('id' in op) {
        const txTransfers = await this.getTokenTransfersByTransactionId((op as TzktTransaction).id);
        transfers.push(...txTransfers);
      }
    }
    
    return transfers;
  }

  /**
   * Get operations by hash (full operation group)
   */
  async getOperationsByHash(hash: string): Promise<TzktTransaction[]> {
    const url = `${this.config.tzktBaseUrl}/operations/${hash}`;
    return this.request<TzktTransaction[]>(url);
  }

  /**
   * Generic GET request (public wrapper for request)
   */
  async get<T>(url: string): Promise<T> {
    return this.request<T>(url);
  }

  /**
   * Get account balance at historical timestamp
   */
  async getBalanceAtTime(address: string, timestampISO: string): Promise<number | null> {
    try {
      const url = `${this.config.tzktBaseUrl}/accounts/${address}/balance_history?timestamp.le=${timestampISO}&limit=1&sort.desc=level`;
      const results = await this.request<TzktBalanceHistory[]>(url);
      
      if (results.length > 0) {
        return results[0].balance;
      }
      
      // If no history before timestamp, try to get earliest balance
      const earliestUrl = `${this.config.tzktBaseUrl}/accounts/${address}/balance_history?limit=1&sort.asc=level`;
      const earliest = await this.request<TzktBalanceHistory[]>(earliestUrl);
      
      if (earliest.length > 0) {
        // Return 0 if account was created after our start date
        return 0;
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to get balance for ${address}: ${error}`);
      return null;
    }
  }

  /**
   * Get mint transactions (entrypoint = mint) within time window
   */
  async *getMintTransactions(
    startISO: string,
    endISO: string
  ): AsyncGenerator<TzktTransaction[], void, unknown> {
    const baseUrl = `${this.config.tzktBaseUrl}/operations/transactions`;
    
    const params: Record<string, string | number | boolean> = {
      'timestamp.ge': startISO,
      'timestamp.lt': endISO,
      'status': 'applied',
      'entrypoint': 'mint',
      'sort.asc': 'id'
    };
    
    yield* this.paginate<TzktTransaction>(baseUrl, params);
  }

  /**
   * Get transactions from specific sender (for finding seller transactions)
   */
  async *getTransactionsFromSender(
    senderAddress: string,
    marketplaceAddresses: string[],
    entrypoints: string[],
    startISO: string,
    endISO: string
  ): AsyncGenerator<TzktTransaction[], void, unknown> {
    const baseUrl = `${this.config.tzktBaseUrl}/operations/transactions`;
    
    const params: Record<string, string | number | boolean> = {
      'timestamp.ge': startISO,
      'timestamp.lt': endISO,
      'status': 'applied',
      'sender': senderAddress,
      'target.in': marketplaceAddresses.join(','),
      'entrypoint.in': entrypoints.join(','),
      'sort.asc': 'id'
    };
    
    yield* this.paginate<TzktTransaction>(baseUrl, params);
  }

  /**
   * Get request statistics
   */
  getStats(): { requestCount: number } {
    return { requestCount: this.requestCount };
  }
}
