/**
 * Derive Wallet XTZ Flow Module
 * Calculates per-wallet XTZ flow summaries:
 * - Balance at window start/end
 * - Total received/sent
 * - Received from NFT sales
 * - Spent on NFTs
 * - Sent to/received from CEX
 * - Sent to/received from L2 bridge
 */
import { Storage } from './storage';
import { PipelineConfig } from './config';
/**
 * Derive wallet XTZ flow summaries from xtz_flows table
 */
export declare function deriveWalletFlows(config: PipelineConfig, storage: Storage): void;
/**
 * Export wallet flows to CSV
 */
export declare function exportWalletFlows(storage: Storage, outputPath: string): void;
//# sourceMappingURL=derive_wallet_flow.d.ts.map