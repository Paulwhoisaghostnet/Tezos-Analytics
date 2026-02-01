/**
 * Identity Resolver Module
 * Looks up wallet and contract identities via TzKT API and Tezos Domains
 */

import { Storage, AddressRegistryRow } from './storage';
import { TzktClient } from './tzkt';
import { PipelineConfig, DEFAULT_CONFIG } from './config';

// TzKT Account Response
interface TzktAccountResponse {
  address: string;
  alias?: string;
  type: string; // 'user', 'contract', 'delegate', etc.
  balance: number;
  firstActivity?: number;
  lastActivity?: number;
  numTransactions?: number;
  delegate?: {
    alias?: string;
    address: string;
  };
}

// Tezos Domains GraphQL Response
interface TezosDomainResponse {
  data?: {
    reverseRecord?: {
      domain?: {
        name: string;
      };
    };
  };
}

interface OwnedDomainsResponse {
  data?: {
    domains?: Array<{
      name: string;
    }>;
  };
}

const TEZOS_DOMAINS_API = 'https://api.tezos.domains/graphql';

/**
 * Look up account info from TzKT
 */
async function lookupTzktAccount(client: TzktClient, address: string): Promise<TzktAccountResponse | null> {
  try {
    const result = await client.get<TzktAccountResponse>(`https://api.tzkt.io/v1/accounts/${address}`);
    return result;
  } catch (error) {
    console.warn(`  Warning: Could not lookup ${address}: ${error}`);
    return null;
  }
}

/**
 * Look up reverse record (address -> domain name) from Tezos Domains
 */
async function lookupTezosDomain(address: string): Promise<string | null> {
  try {
    const query = `
      query ReverseRecord($address: String!) {
        reverseRecord(address: $address) {
          domain {
            name
          }
        }
      }
    `;
    
    const response = await fetch(TEZOS_DOMAINS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { address }
      })
    });
    
    const data = await response.json() as TezosDomainResponse;
    return data?.data?.reverseRecord?.domain?.name || null;
  } catch (error) {
    // Silently fail - not all addresses have domains
    return null;
  }
}

/**
 * Look up all domains owned by an address
 */
async function lookupOwnedDomains(address: string): Promise<string[]> {
  try {
    const query = `
      query OwnedDomains($owner: String!) {
        domains(where: { owner: { address: { equalTo: $owner } } }, first: 100) {
          items {
            name
          }
        }
      }
    `;
    
    const response = await fetch(TEZOS_DOMAINS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { owner: address }
      })
    });
    
    const data = await response.json() as { data?: { domains?: { items?: Array<{ name: string }> } } };
    const items = data?.data?.domains?.items || [];
    return items.map((d: { name: string }) => d.name);
  } catch (error) {
    return [];
  }
}

/**
 * Resolve a single address identity
 */
async function resolveAddress(
  client: TzktClient,
  storage: Storage,
  address: string,
  resolveDomainsFlag: boolean = true
): Promise<void> {
  // Get TzKT info
  const tzktInfo = await lookupTzktAccount(client, address);
  
  let alias: string | null = tzktInfo?.alias || null;
  let tezosDomain: string | null = null;
  let ownedDomains: string[] = [];
  
  // Only lookup domains for wallets (tz addresses), not contracts
  if (resolveDomainsFlag && address.startsWith('tz')) {
    tezosDomain = await lookupTezosDomain(address);
    ownedDomains = await lookupOwnedDomains(address);
    
    // Use domain as alias if no TzKT alias
    if (!alias && tezosDomain) {
      alias = tezosDomain;
    }
  }
  
  // Update the registry
  storage.updateAddressResolution(address, alias, tezosDomain, ownedDomains.length > 0 ? ownedDomains : null);
}

/**
 * Batch resolve unresolved addresses
 */
export async function resolveUnresolvedAddresses(
  config: PipelineConfig,
  storage: Storage,
  batchSize: number = 50,
  maxAddresses: number = 500
): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('IDENTITY RESOLUTION');
  console.log('Looking up identities via TzKT and Tezos Domains');
  console.log('='.repeat(60));
  
  const client = new TzktClient(config);
  
  // Get unresolved addresses
  const unresolved = storage.getUnresolvedAddresses(maxAddresses);
  console.log(`\nFound ${unresolved.length} unresolved addresses`);
  
  if (unresolved.length === 0) {
    console.log('All addresses already resolved.');
    return;
  }
  
  // Separate contracts from wallets
  const contracts = unresolved.filter(a => a.startsWith('KT1'));
  const wallets = unresolved.filter(a => a.startsWith('tz'));
  
  console.log(`  Contracts to resolve: ${contracts.length}`);
  console.log(`  Wallets to resolve: ${wallets.length}`);
  
  // Resolve contracts first (TzKT only, no domains)
  console.log('\n=== Resolving Contracts via TzKT ===');
  let resolvedContracts = 0;
  let contractsWithAlias = 0;
  
  for (let i = 0; i < contracts.length; i++) {
    const address = contracts[i];
    await resolveAddress(client, storage, address, false);
    resolvedContracts++;
    
    const registry = storage.getAddressRegistry(address);
    if (registry?.alias) {
      contractsWithAlias++;
      console.log(`  [${i + 1}/${contracts.length}] ${address.slice(0, 12)}... -> ${registry.alias}`);
    }
    
    if ((i + 1) % 10 === 0) {
      console.log(`  Resolved ${i + 1}/${contracts.length} contracts`);
      storage.save();
    }
  }
  storage.save();
  console.log(`Contracts resolved: ${resolvedContracts} (${contractsWithAlias} with aliases)`);
  
  // Resolve wallets (TzKT + Tezos Domains)
  console.log('\n=== Resolving Wallets via TzKT + Tezos Domains ===');
  let resolvedWallets = 0;
  let walletsWithAlias = 0;
  let walletsWithDomain = 0;
  
  for (let i = 0; i < wallets.length; i++) {
    const address = wallets[i];
    await resolveAddress(client, storage, address, true);
    resolvedWallets++;
    
    const registry = storage.getAddressRegistry(address);
    if (registry?.alias) walletsWithAlias++;
    if (registry?.tezos_domain) {
      walletsWithDomain++;
      console.log(`  [${i + 1}/${wallets.length}] ${address.slice(0, 12)}... -> ${registry.tezos_domain}`);
    }
    
    if ((i + 1) % 10 === 0) {
      console.log(`  Resolved ${i + 1}/${wallets.length} wallets`);
      storage.save();
    }
    
    // Small delay to avoid rate limiting Tezos Domains
    await new Promise(r => setTimeout(r, 50));
  }
  storage.save();
  
  console.log(`\nWallets resolved: ${resolvedWallets}`);
  console.log(`  With TzKT alias: ${walletsWithAlias}`);
  console.log(`  With Tezos Domain: ${walletsWithDomain}`);
  
  // Print summary
  console.log('\n' + '-'.repeat(60));
  console.log('RESOLUTION SUMMARY');
  console.log('-'.repeat(60));
  
  const totalResolved = storage.getResolvedAddressCount();
  const totalRegistry = storage.getAddressRegistryCount();
  console.log(`Total addresses in registry: ${totalRegistry}`);
  console.log(`Resolved addresses: ${totalResolved}`);
  console.log(`Resolution rate: ${((totalResolved / totalRegistry) * 100).toFixed(1)}%`);
}

/**
 * Print resolved addresses with identities
 */
export function printResolvedAddresses(storage: Storage): void {
  const registry = storage.getAllAddressRegistry();
  const resolved = registry.filter(r => r.alias || r.tezos_domain);
  
  console.log('\n=== Addresses with Known Identities ===');
  console.log(`\nContracts:`);
  for (const r of resolved.filter(r => r.address_type === 'contract')) {
    console.log(`  ${r.address.slice(0, 15)}... | ${r.alias || 'no alias'} | ${r.category || 'unknown'} | ${r.tx_count} txs`);
  }
  
  console.log(`\nWallets:`);
  for (const r of resolved.filter(r => r.address_type === 'wallet').slice(0, 50)) {
    const domains = r.owned_domains ? JSON.parse(r.owned_domains).length : 0;
    console.log(`  ${r.address.slice(0, 15)}... | ${r.tezos_domain || r.alias || 'no alias'} | ${domains} domains | ${r.tx_count} txs`);
  }
}
