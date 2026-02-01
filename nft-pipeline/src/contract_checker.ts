/**
 * Contract Type Checker
 * Determines if a contract is fungible or NFT using TzKT API
 * Results are cached in the database to avoid repeated API calls
 */

import { TzktClient } from './tzkt';
import { Storage, ContractMetadataRow } from './storage';
import { PipelineConfig, DEFAULT_CONFIG } from './config';

// Known fungible token contracts (pre-populated, no API call needed)
const KNOWN_FUNGIBLE_CONTRACTS = new Set([
  'KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o', // kUSD
  'KT1XRPEPXbZK25r3Htzp2o1x7xdMMmfocKNW', // USDtz
  'KT1VaEsVNiBoA56eToEK6n6BcPgh1tdx9eXi', // wrapped ETH
  'KT1PnUZCp3u2KzWr93pn4DD7HAJnm3rWVrgn', // UNO
  'KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn', // tzBTC
  'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV', // KUSD
  'KT1SjXiUX63QvdNMcM2m492f7kuf8JxXRLp4', // ctez
  'KT1LN4LPSqTMS7Sd2CJw4bbDGRkMv2t68Fy9', // USDt
  'KT1Ha4yFVeyzw6KRAdkzq6TxDHB97KG4pZe8', // DOGA
  'KT1JkoE42rrMBP9b2oDhbx6EUr26GcySZMUH', // kDAO
  'KT1GRSvLoikDsXujKgZPsGLX8k8VvR2Tq95b', // PLENTY
]);

// Known NFT platforms (contracts that are definitely NFTs)
const KNOWN_NFT_CONTRACTS = new Set([
  'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton', // HEN/OBJKT FA2
  'KT1KEa8z6vWXDJrVqtMrAeDVzsvxat3kHaCE', // fxhash GENTK v1
  'KT1U6EHmNxJTkvaWJ4ThczG4FSDaHC21ssvi', // fxhash GENTK v2
  'KT1EfsNuqwLAWDd3o4pvfUx1CAh5GMdTrRvr', // fxhash articles
]);

interface TzktContractResponse {
  address: string;
  alias?: string;
  kind?: string;
  tzips?: string[];
  creator?: { address: string };
}

interface TzktTokenResponse {
  id: number;
  contract: { address: string };
  tokenId: string;
  standard: string;
  totalSupply?: string;
  metadata?: {
    name?: string;
    symbol?: string;
    decimals?: string;
    artifactUri?: string;
    displayUri?: string;
    thumbnailUri?: string;
  };
}

/**
 * Check if a contract is fungible based on TzKT token metadata
 * 
 * Heuristics:
 * 1. Has 'decimals' in metadata = fungible
 * 2. Has 'artifactUri' or 'displayUri' = NFT
 * 3. totalSupply very large = likely fungible
 */
function isFungibleFromMetadata(token: TzktTokenResponse): boolean {
  const meta = token.metadata;
  
  // Decimals field is a strong indicator of fungible token
  if (meta?.decimals && parseInt(meta.decimals, 10) > 0) {
    return true;
  }
  
  // Art-related metadata indicates NFT
  if (meta?.artifactUri || meta?.displayUri || meta?.thumbnailUri) {
    return false;
  }
  
  // Very large supply suggests fungible
  const supply = parseInt(token.totalSupply || '0', 10);
  if (supply > 1000000000) { // > 1 billion
    return true;
  }
  
  return false;
}

/**
 * Check contract type from TzKT API
 */
async function checkContractFromTzkt(
  client: TzktClient,
  contractAddress: string
): Promise<{ isFungible: boolean; tokenType: string | null; alias: string | null }> {
  try {
    // First, get contract info
    const contract = await client.get<TzktContractResponse>(
      `https://api.tzkt.io/v1/contracts/${contractAddress}`
    );
    
    // Check if it's known as FA1.2 (always fungible)
    if (contract.tzips?.includes('fa12')) {
      return { isFungible: true, tokenType: 'fa1.2', alias: contract.alias || null };
    }
    
    // For FA2, we need to check the token metadata
    // Get token 0 info (the one that's typically fungible)
    const tokens = await client.get<TzktTokenResponse[]>(
      `https://api.tzkt.io/v1/tokens?contract=${contractAddress}&tokenId=0&limit=1`
    );
    
    if (tokens.length > 0) {
      const token = tokens[0];
      const isFungible = isFungibleFromMetadata(token);
      return { 
        isFungible, 
        tokenType: isFungible ? 'fa2-fungible' : 'fa2-nft',
        alias: contract.alias || null 
      };
    }
    
    // If no token 0, it's likely an NFT contract (starts at token 1)
    return { isFungible: false, tokenType: 'fa2-nft', alias: contract.alias || null };
    
  } catch (error) {
    console.warn(`Warning: Could not check contract ${contractAddress}: ${error}`);
    return { isFungible: false, tokenType: null, alias: null };
  }
}

/**
 * Check if a contract is fungible, using cache first then TzKT API
 */
export async function isContractFungible(
  storage: Storage,
  client: TzktClient,
  contractAddress: string
): Promise<boolean> {
  // 1. Check known lists first (no DB or API needed)
  if (KNOWN_FUNGIBLE_CONTRACTS.has(contractAddress)) {
    return true;
  }
  if (KNOWN_NFT_CONTRACTS.has(contractAddress)) {
    return false;
  }
  
  // 2. Check cache
  const cached = storage.isContractFungible(contractAddress);
  if (cached !== null) {
    return cached;
  }
  
  // 3. Query TzKT
  const result = await checkContractFromTzkt(client, contractAddress);
  
  // 4. Cache the result
  storage.insertContractMetadata({
    address: contractAddress,
    is_fungible: result.isFungible,
    token_type: result.tokenType,
    alias: result.alias,
    checked_at: new Date().toISOString()
  });
  storage.save();
  
  return result.isFungible;
}

/**
 * Pre-populate cache for known contracts (call at startup)
 */
export function cacheKnownContracts(storage: Storage): void {
  const now = new Date().toISOString();
  
  for (const addr of KNOWN_FUNGIBLE_CONTRACTS) {
    if (!storage.getContractMetadata(addr)) {
      storage.insertContractMetadata({
        address: addr,
        is_fungible: true,
        token_type: 'known-fungible',
        alias: null,
        checked_at: now
      });
    }
  }
  
  for (const addr of KNOWN_NFT_CONTRACTS) {
    if (!storage.getContractMetadata(addr)) {
      storage.insertContractMetadata({
        address: addr,
        is_fungible: false,
        token_type: 'known-nft',
        alias: null,
        checked_at: now
      });
    }
  }
  
  storage.save();
}

/**
 * Batch check multiple contracts (more efficient)
 * Returns a Map of contract address -> isFungible
 */
export async function batchCheckContracts(
  storage: Storage,
  client: TzktClient,
  contractAddresses: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  const toCheck: string[] = [];
  
  for (const addr of contractAddresses) {
    // Check known lists
    if (KNOWN_FUNGIBLE_CONTRACTS.has(addr)) {
      result.set(addr, true);
      continue;
    }
    if (KNOWN_NFT_CONTRACTS.has(addr)) {
      result.set(addr, false);
      continue;
    }
    
    // Check cache
    const cached = storage.isContractFungible(addr);
    if (cached !== null) {
      result.set(addr, cached);
      continue;
    }
    
    toCheck.push(addr);
  }
  
  // Query uncached contracts from TzKT
  if (toCheck.length > 0) {
    console.log(`Checking ${toCheck.length} contracts via TzKT API...`);
    let checked = 0;
    
    for (const addr of toCheck) {
      const checkResult = await checkContractFromTzkt(client, addr);
      result.set(addr, checkResult.isFungible);
      
      // Cache the result
      storage.insertContractMetadata({
        address: addr,
        is_fungible: checkResult.isFungible,
        token_type: checkResult.tokenType,
        alias: checkResult.alias,
        checked_at: new Date().toISOString()
      });
      
      checked++;
      if (checked % 10 === 0) {
        console.log(`  Checked ${checked}/${toCheck.length} contracts`);
        storage.save(); // Save periodically
      }
    }
    
    storage.save();
    console.log(`Contract check complete. Found ${toCheck.filter(a => result.get(a)).length} fungible.`);
  }
  
  return result;
}

/**
 * Get all unique token_id=0 contracts from transfers that need checking
 */
export function getTokenId0Contracts(storage: Storage): string[] {
  const rows = storage.query<{ token_contract: string }>(`
    SELECT DISTINCT token_contract 
    FROM raw_token_transfers 
    WHERE token_id = '0'
      AND from_address IS NOT NULL 
      AND from_address != ''
  `);
  return rows.map(r => r.token_contract);
}
