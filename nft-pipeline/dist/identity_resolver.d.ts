/**
 * Identity Resolver Module
 * Looks up wallet and contract identities via TzKT API and Tezos Domains
 */
import { Storage } from './storage';
import { PipelineConfig } from './config';
/**
 * Batch resolve unresolved addresses
 */
export declare function resolveUnresolvedAddresses(config: PipelineConfig, storage: Storage, batchSize?: number, maxAddresses?: number): Promise<void>;
/**
 * Print resolved addresses with identities
 */
export declare function printResolvedAddresses(storage: Storage): void;
//# sourceMappingURL=identity_resolver.d.ts.map