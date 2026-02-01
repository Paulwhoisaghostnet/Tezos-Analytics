/**
 * Derive Resales Module
 * Works entirely from local database - NO API calls
 */

import { 
  PipelineConfig, 
  getAllBuyEntrypoints,
  getAllAcceptOfferEntrypoints,
  getAllMarketplaceAddresses,
  findMarketplace 
} from './config';
import { Storage } from './storage';

/**
 * Derive resales (secondary sales by collectors) from local data
 */
export function deriveResales(
  config: PipelineConfig,
  storage: Storage
): void {
  console.log('\n=== Deriving Resales (from local data) ===');
  
  // Get all buyers (collectors from this window)
  const buyers = storage.getAllBuyers();
  const buyerSet = new Set(buyers);
  console.log(`Checking ${buyers.length} collectors for secondary sales...`);
  
  if (buyers.length === 0) {
    console.log('No buyers found, skipping resales detection.');
    return;
  }
  
  const marketplaceAddresses = getAllMarketplaceAddresses(config);
  const buyEntrypoints = getAllBuyEntrypoints(config);
  const acceptOfferEntrypoints = getAllAcceptOfferEntrypoints(config);
  
  let resaleCount = 0;
  
  // Method 1: Find offer accepts where collector is the sender (seller)
  if (acceptOfferEntrypoints.length > 0) {
    console.log('\nChecking offer accepts by collectors...');
    
    for (const collector of buyers) {
      const sellerTxs = storage.getRawTransactionsBySender(
        collector, 
        marketplaceAddresses, 
        acceptOfferEntrypoints
      );
      
      for (const tx of sellerTxs) {
        const marketplace = findMarketplace(config, tx.target);
        if (!marketplace) continue;
        
        const transfers = storage.getRawTransfersByTransactionId(tx.id);
        const fa2Transfer = transfers.find(t => 
          t.token_standard === 'fa2' && 
          t.from_address === collector
        );
        
        if (!fa2Transfer) continue;
        
        storage.insertResale({
          op_hash: tx.hash,
          ts: tx.timestamp,
          seller_collector: collector,
          buyer: fa2Transfer.to_address || null,
          marketplace: marketplace.name,
          token_contract: fa2Transfer.token_contract,
          token_id: fa2Transfer.token_id,
          qty: parseInt(fa2Transfer.amount, 10) || 1,
          proceeds_mutez: tx.amount || null
        });
        
        resaleCount++;
      }
    }
    console.log(`Found ${resaleCount} resales via offer accepts`);
  }
  
  // Method 2: Find listing sales where a collector's token was sold
  // Look at buy transactions and check if seller (from transfer) is a collector
  console.log('\nScanning for listing-based resales...');
  
  const buyTxs = storage.getRawTransactionsByTarget(marketplaceAddresses, buyEntrypoints);
  let listingResales = 0;
  
  for (const tx of buyTxs) {
    const marketplace = findMarketplace(config, tx.target);
    if (!marketplace) continue;
    
    // Skip if sender is a collector (they're the buyer, not seller)
    if (buyerSet.has(tx.sender)) continue;
    
    const transfers = storage.getRawTransfersByTransactionId(tx.id);
    
    for (const transfer of transfers) {
      if (transfer.token_standard !== 'fa2') continue;
      
      const seller = transfer.from_address;
      if (!seller || !buyerSet.has(seller)) continue;
      
      // This is a resale! A collector sold their token
      storage.insertResale({
        op_hash: tx.hash,
        ts: tx.timestamp,
        seller_collector: seller,
        buyer: transfer.to_address || tx.sender,
        marketplace: marketplace.name,
        token_contract: transfer.token_contract,
        token_id: transfer.token_id,
        qty: parseInt(transfer.amount, 10) || 1,
        proceeds_mutez: tx.amount || null
      });
      
      listingResales++;
      resaleCount++;
    }
  }
  
  console.log(`Found ${listingResales} listing-based resales`);
  
  console.log(`\n--- Resales Summary ---`);
  console.log(`Total resales detected: ${resaleCount}`);
  console.log(`Total resale proceeds: ${(storage.getTotalResaleProceeds() / 1_000_000).toFixed(2)} XTZ`);
  
  // Count unique collectors who resold
  const resales = storage.getAllResales();
  const resellers = new Set(resales.map(r => r.seller_collector));
  console.log(`Unique collectors who resold: ${resellers.size}`);
}
