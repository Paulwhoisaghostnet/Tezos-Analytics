/**
 * Derive Offer Accepts Module
 * Works entirely from local database - NO API calls
 */

import { 
  PipelineConfig, 
  getAllAcceptOfferEntrypoints, 
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
 * Derive offer accepts from local raw transaction data
 */
export function deriveOfferAccepts(
  config: PipelineConfig,
  storage: Storage
): void {
  console.log('\n=== Deriving Offer Accepts (from local data) ===');
  
  const marketplaceAddresses = getAllMarketplaceAddresses(config);
  const acceptOfferEntrypoints = getAllAcceptOfferEntrypoints(config);
  
  if (acceptOfferEntrypoints.length === 0) {
    console.log('No accept offer entrypoints configured, skipping.');
    return;
  }
  
  console.log(`Accept offer entrypoints: ${acceptOfferEntrypoints.join(', ')}`);
  
  // Query raw transactions from local database
  const rawTxs = storage.getRawTransactionsByTarget(marketplaceAddresses, acceptOfferEntrypoints);
  console.log(`Found ${rawTxs.length} offer accept transactions in local database`);
  
  let offerAcceptCount = 0;
  let withBothPrices = 0;
  let underListCount = 0;
  
  for (const tx of rawTxs) {
    const marketplace = findMarketplace(config, tx.target);
    if (!marketplace) continue;
    
    const creatorSeller = tx.sender;
    if (!creatorSeller.startsWith('tz')) continue;
    
    // Get token info from transfers
    const transfers = storage.getRawTransfersByTransactionId(tx.id);
    const fa2Transfer = transfers.find(t => t.token_standard === 'fa2');
    
    if (!fa2Transfer) continue;
    
    const tokenContract = fa2Transfer.token_contract;
    const tokenId = fa2Transfer.token_id;
    const qty = parseInt(fa2Transfer.amount, 10) || 1;
    const buyerOffer = fa2Transfer.to_address || null;
    const acceptedPrice = tx.amount || null;
    
    // Look up reference listing price from local listings table
    const referenceListPrice = storage.getLatestListingPrice(
      creatorSeller,
      tokenContract,
      tokenId,
      tx.timestamp
    );
    
    // Determine if accepted under list price
    let underList: boolean | null = null;
    if (acceptedPrice !== null && referenceListPrice !== null) {
      underList = acceptedPrice < referenceListPrice;
      if (underList) underListCount++;
      withBothPrices++;
    }
    
    storage.insertOfferAccept({
      op_hash: tx.hash,
      ts: tx.timestamp,
      creator_seller: creatorSeller,
      buyer_offer: buyerOffer,
      marketplace: marketplace.name,
      token_contract: tokenContract,
      token_id: tokenId,
      qty,
      accepted_price_mutez: acceptedPrice,
      reference_list_price_mutez: referenceListPrice,
      under_list: underList
    });
    
    offerAcceptCount++;
  }
  
  console.log(`\n--- Offer Accepts Summary ---`);
  console.log(`Offer accepts recorded: ${offerAcceptCount}`);
  console.log(`With both prices (for comparison): ${withBothPrices}`);
  console.log(`Accepted under list price: ${underListCount}`);
  
  if (withBothPrices > 0) {
    const underListRate = ((underListCount / withBothPrices) * 100).toFixed(1);
    console.log(`Under-list rate: ${underListRate}%`);
  }
}
