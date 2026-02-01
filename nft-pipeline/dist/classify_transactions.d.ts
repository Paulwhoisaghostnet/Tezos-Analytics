/**
 * Transaction Classification Module
 * Categorizes all transactions by type:
 * - nft_sale: NFT marketplace transactions
 * - nft_mint: Token minting
 * - defi: DeFi contract interactions
 * - bridge: Etherlink bridge
 * - cex: CEX deposit/withdrawal
 * - delegation: Staking operations
 * - other: Uncategorized
 */
import { Storage } from './storage';
import { PipelineConfig } from './config';
/**
 * Classify all transactions in the database
 */
export declare function classifyAllTransactions(config: PipelineConfig, storage: Storage): void;
/**
 * Get classification statistics
 */
export declare function getClassificationStats(storage: Storage): Record<string, number>;
/**
 * Export classification stats
 */
export declare function exportClassificationStats(storage: Storage, outputPath: string): void;
//# sourceMappingURL=classify_transactions.d.ts.map