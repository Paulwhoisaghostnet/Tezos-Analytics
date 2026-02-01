/**
 * Derive Listings Module
 * Works entirely from local database - NO API calls
 */

import { 
  PipelineConfig, 
  getAllListEntrypoints, 
  getAllMarketplaceAddresses,
  findMarketplace 
} from './config';
import { Storage } from './storage';

/**
 * Parse JSON parameters safely
 */
function parseParams(params: string | null): any {
  if (!params) return null;
  try {
    return JSON.parse(params);
  } catch {
    return null;
  }
}

/**
 * Extract listing details from transaction parameters
 */
function extractListingFromParams(params: any): {
  tokenContract: string;
  tokenId: string;
  qty: number;
  priceMutez: number | null;
} | null {
  if (!params) return null;

  try {
    let tokenContract: string | null = null;
    let tokenId: string | null = null;
    let qty = 1;
    let priceMutez: number | null = null;

    // objkt v2 ask format
    if (params.ask !== undefined || params.asks !== undefined) {
      const ask = params.ask || (Array.isArray(params.asks) ? params.asks[0] : params.asks);
      if (ask) {
        tokenContract = ask.token?.address || ask.fa2 || null;
        tokenId = ask.token?.token_id !== undefined ? String(ask.token.token_id) : 
                  (ask.token_id !== undefined ? String(ask.token_id) : null);
        qty = parseInt(ask.editions || ask.amount || '1', 10) || 1;
        priceMutez = ask.price !== undefined ? parseInt(ask.price, 10) : null;
      }
    }
    
    // Direct parameter format
    if (!tokenContract && params.fa2 !== undefined) {
      tokenContract = params.fa2;
    }
    if (!tokenContract && params.token?.address !== undefined) {
      tokenContract = params.token.address;
    }
    
    if (!tokenId && params.token_id !== undefined) {
      tokenId = String(params.token_id);
    }
    if (!tokenId && params.token?.token_id !== undefined) {
      tokenId = String(params.token.token_id);
    }
    if (!tokenId && params.objkt_id !== undefined) {
      tokenId = String(params.objkt_id);
    }
    
    if (params.amount !== undefined && qty === 1) {
      qty = parseInt(params.amount, 10) || 1;
    }
    if (params.editions !== undefined && qty === 1) {
      qty = parseInt(params.editions, 10) || 1;
    }
    
    if (priceMutez === null && params.price !== undefined) {
      priceMutez = parseInt(params.price, 10);
    }
    if (priceMutez === null && params.xtz_per_objkt !== undefined) {
      priceMutez = parseInt(params.xtz_per_objkt, 10);
    }

    // HEN/Teia swap format
    if (!tokenContract && !tokenId && params.objkt_amount !== undefined) {
      qty = parseInt(params.objkt_amount, 10) || 1;
      priceMutez = params.xtz_per_objkt ? parseInt(params.xtz_per_objkt, 10) : null;
    }

    // fxhash listing format
    if (params.listing !== undefined) {
      const listing = params.listing;
      tokenContract = listing.token?.address || listing.gentk?.address || null;
      tokenId = listing.token?.id !== undefined ? String(listing.token.id) :
                (listing.gentk?.id !== undefined ? String(listing.gentk.id) : null);
      priceMutez = listing.price !== undefined ? parseInt(listing.price, 10) : null;
    }

    if (!tokenContract || !tokenId) return null;

    return { tokenContract, tokenId, qty, priceMutez };
  } catch {
    return null;
  }
}

/**
 * Derive listings from local raw transaction data
 */
export function deriveListings(
  config: PipelineConfig,
  storage: Storage
): void {
  console.log('\n=== Deriving Listings (from local data) ===');
  
  const marketplaceAddresses = getAllMarketplaceAddresses(config);
  const listEntrypoints = getAllListEntrypoints(config);
  
  console.log(`List entrypoints: ${listEntrypoints.join(', ')}`);
  
  // Query raw transactions from local database
  const rawTxs = storage.getRawTransactionsByTarget(marketplaceAddresses, listEntrypoints);
  console.log(`Found ${rawTxs.length} listing transactions in local database`);
  
  let listingCount = 0;
  let skippedNoToken = 0;
  
  for (const tx of rawTxs) {
    const marketplace = findMarketplace(config, tx.target);
    if (!marketplace) continue;
    
    const creator = tx.sender;
    if (!creator.startsWith('tz')) continue;
    
    const params = parseParams(tx.parameters);
    const listing = extractListingFromParams(params);
    
    if (!listing) {
      skippedNoToken++;
      continue;
    }
    
    storage.insertListing({
      op_hash: tx.hash,
      ts: tx.timestamp,
      creator,
      marketplace: marketplace.name,
      token_contract: listing.tokenContract,
      token_id: listing.tokenId,
      qty: listing.qty,
      list_price_mutez: listing.priceMutez
    });
    listingCount++;
  }
  
  console.log(`\n--- Listings Summary ---`);
  console.log(`Listings recorded: ${listingCount}`);
  console.log(`Skipped (no token info): ${skippedNoToken}`);
  console.log(`Total editions listed: ${storage.getTotalEditionsListed()}`);
  console.log(`Distinct tokens listed: ${storage.getDistinctTokensListed()}`);
}
