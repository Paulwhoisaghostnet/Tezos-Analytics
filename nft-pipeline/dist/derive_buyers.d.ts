/**
 * Derive Buyers Module
 *
 * Proper derivation path:
 * 1. Token ID = 0: Check against known fungible contracts, then TzKT API
 * 2. Token ID > 0: Treat as NFT if editions <= 5,555
 * 3. Cache contract metadata to avoid repeated API calls
 */
import { PipelineConfig } from './config';
import { Storage } from './storage';
/**
 * Derive buyers with proper contract verification
 * Now async because it may need to query TzKT for unknown contracts
 */
export declare function deriveBuyers(config: PipelineConfig, storage: Storage): Promise<void>;
/**
 * Copy balances from raw_balances to buyer_balance_start for all buyers
 */
export declare function populateBuyerBalances(storage: Storage): void;
//# sourceMappingURL=derive_buyers.d.ts.map