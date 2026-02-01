/**
 * Contract Type Checker
 * Determines if a contract is fungible or NFT using TzKT API
 * Results are cached in the database to avoid repeated API calls
 */
import { TzktClient } from './tzkt';
import { Storage } from './storage';
/**
 * Check if a contract is fungible, using cache first then TzKT API
 */
export declare function isContractFungible(storage: Storage, client: TzktClient, contractAddress: string): Promise<boolean>;
/**
 * Pre-populate cache for known contracts (call at startup)
 */
export declare function cacheKnownContracts(storage: Storage): void;
/**
 * Batch check multiple contracts (more efficient)
 * Returns a Map of contract address -> isFungible
 */
export declare function batchCheckContracts(storage: Storage, client: TzktClient, contractAddresses: string[]): Promise<Map<string, boolean>>;
/**
 * Get all unique token_id=0 contracts from transfers that need checking
 */
export declare function getTokenId0Contracts(storage: Storage): string[];
//# sourceMappingURL=contract_checker.d.ts.map