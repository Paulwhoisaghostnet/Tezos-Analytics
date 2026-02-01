/**
 * Derive Fund Flow Module
 * Track where creator proceeds go (CEX cash-out vs buying NFTs)
 */

import { PipelineConfig, isCexAddress, getAllMarketplaceAddresses } from './config';
import { Storage, CreatorFundFlowRow } from './storage';

/**
 * Derive fund flow for creators who made sales
 */
export function deriveCreatorFundFlow(config: PipelineConfig, storage: Storage): void {
  console.log('\n=== Deriving Creator Fund Flow ===');
  
  const purchases = storage.getAllPurchases();
  const xtzTransferCount = storage.getRawXtzTransferCount();
  
  // Find creators who made sales (they appear as sellers in purchases)
  const creatorSales: Map<string, number> = new Map();
  for (const p of purchases) {
    if (p.seller && p.spend_mutez) {
      creatorSales.set(p.seller, (creatorSales.get(p.seller) || 0) + p.spend_mutez);
    }
  }
  
  const creatorsWithSales = Array.from(creatorSales.keys());
  console.log(`Creators with sales: ${creatorsWithSales.length}`);
  console.log(`XTZ transfers in database: ${xtzTransferCount}`);
  
  // Check which creators are also buyers
  const buyerSet = new Set(storage.getAllBuyers());
  
  let cashedOut = 0;
  let boughtNfts = 0;
  let totalSentToCex = 0;
  let totalSpentOnNfts = 0;
  
  for (const address of creatorsWithSales) {
    const salesAmount = creatorSales.get(address) || 0;
    
    // Check if creator bought NFTs (appears in purchases as buyer)
    const creatorPurchases = purchases.filter(p => p.buyer === address);
    const spentOnNfts = creatorPurchases.reduce((sum, p) => sum + (p.spend_mutez || 0), 0);
    const didBuyNfts = spentOnNfts > 0;
    
    // Check CEX cash-out from XTZ transfers
    let sentToCex = 0;
    let didCashOut = false;
    
    if (xtzTransferCount > 0) {
      sentToCex = storage.getCexCashoutFromAddress(address);
      didCashOut = sentToCex > 0;
    }
    
    if (didCashOut) cashedOut++;
    if (didBuyNfts) boughtNfts++;
    totalSentToCex += sentToCex;
    totalSpentOnNfts += spentOnNfts;
    
    const row: CreatorFundFlowRow = {
      address,
      total_sales_mutez: salesAmount,
      sent_to_cex_mutez: sentToCex,
      spent_on_nfts_mutez: spentOnNfts,
      cashed_out: didCashOut,
      bought_nfts: didBuyNfts
    };
    
    storage.insertCreatorFundFlow(row);
  }
  
  storage.save();
  
  const totalCreators = creatorsWithSales.length;
  console.log(`\n--- Creator Fund Flow Summary ---`);
  console.log(`Creators who bought NFTs: ${boughtNfts} (${((boughtNfts / totalCreators) * 100).toFixed(1)}%)`);
  console.log(`Total spent on NFTs by creators: ${(totalSpentOnNfts / 1_000_000).toFixed(2)} XTZ`);
  
  if (xtzTransferCount > 0) {
    console.log(`Creators who cashed out to CEX: ${cashedOut} (${((cashedOut / totalCreators) * 100).toFixed(1)}%)`);
    console.log(`Total sent to CEX: ${(totalSentToCex / 1_000_000).toFixed(2)} XTZ`);
  } else {
    console.log('CEX cash-out tracking requires XTZ transfer sync.');
  }
}

/**
 * Calculate aggregate fund flow metrics
 */
export function calculateFundFlowSummary(storage: Storage): {
  total_xtz_from_cex: number;
  total_xtz_to_cex: number;
  net_ecosystem_flow: number;
  creators_who_bought_nfts: number;
  creators_who_bought_nfts_percent: number;
  creators_who_cashed_out: number;
  creators_who_cashed_out_percent: number;
} {
  const buyerFlow = storage.getAllBuyerCexFlow();
  const creatorFlow = storage.getAllCreatorFundFlow();
  
  const totalFromCex = buyerFlow.reduce((sum, b) => sum + b.cex_funding_mutez, 0);
  const totalToCex = creatorFlow.reduce((sum, c) => sum + c.sent_to_cex_mutez, 0);
  
  const creatorsWhoBought = creatorFlow.filter(c => c.bought_nfts).length;
  const creatorsWhoCashedOut = creatorFlow.filter(c => c.cashed_out).length;
  const totalCreators = creatorFlow.length;
  
  return {
    total_xtz_from_cex: totalFromCex / 1_000_000,
    total_xtz_to_cex: totalToCex / 1_000_000,
    net_ecosystem_flow: (totalFromCex - totalToCex) / 1_000_000,
    creators_who_bought_nfts: creatorsWhoBought,
    creators_who_bought_nfts_percent: totalCreators > 0 ? (creatorsWhoBought / totalCreators) * 100 : 0,
    creators_who_cashed_out: creatorsWhoCashedOut,
    creators_who_cashed_out_percent: totalCreators > 0 ? (creatorsWhoCashedOut / totalCreators) * 100 : 0
  };
}
