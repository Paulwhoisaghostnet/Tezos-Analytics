/**
 * Address Discovery Module
 * Identifies top contracts and wallets from existing data
 * Populates the address_registry table with initial entries
 */
import { Storage } from './storage';
/**
 * Discover and register top contracts from existing data
 */
export declare function discoverTopContracts(storage: Storage, limit?: number): void;
/**
 * Discover and register top wallets from existing data
 */
export declare function discoverTopWallets(storage: Storage, limit?: number): void;
/**
 * Run full address discovery
 */
export declare function runAddressDiscovery(storage: Storage, contractLimit?: number, walletLimit?: number): void;
/**
 * Export address registry to CSV
 */
export declare function exportAddressRegistry(storage: Storage, outputPath: string): void;
//# sourceMappingURL=discover_addresses.d.ts.map