/**
 * Derive CEX Flow Module
 * Track CEX funding and cash-out patterns for buyers and creators
 */

import { PipelineConfig, isCexAddress } from './config';
import { Storage, BuyerCexFlowRow } from './storage';

/**
 * Derive CEX flow analysis for buyers
 */
export function deriveBuyerCexFlow(config: PipelineConfig, storage: Storage): void {
  console.log('\n=== Deriving Buyer CEX Flow ===');
  
  const buyers = storage.getAllBuyers();
  const xtzTransferCount = storage.getRawXtzTransferCount();
  
  console.log(`Analyzing ${buyers.length} buyers...`);
  console.log(`XTZ transfers in database: ${xtzTransferCount}`);
  
  if (xtzTransferCount === 0) {
    console.log('No XTZ transfers synced yet. Run sync to pull XTZ transfer data.');
    console.log('Skipping CEX flow analysis for now.');
    return;
  }
  
  let withCexFunding = 0;
  let salesOnly = 0;
  let totalCexFunding = 0;
  
  for (const address of buyers) {
    // Get XTZ received from CEX
    const cexFunding = storage.getCexFundingForAddress(address);
    
    // Get all incoming XTZ transfers
    const incomingTransfers = storage.getXtzTransfersToAddress(address);
    const totalReceived = incomingTransfers.reduce((sum, t) => sum + t.amount, 0);
    
    // Check if they have any incoming that's NOT from CEX
    const nonCexIncoming = incomingTransfers.filter(t => !t.is_from_cex);
    
    // Get sales income (from purchases where this buyer was the seller)
    const purchases = storage.getAllPurchases();
    const salesIncome = purchases
      .filter(p => p.seller === address && p.spend_mutez)
      .reduce((sum, p) => sum + (p.spend_mutez || 0), 0);
    
    // Determine flags
    const hasCexFunding = cexFunding > 0;
    // Sales only = has sales income but no CEX funding and no other significant external income
    const isSalesOnly = salesIncome > 0 && cexFunding === 0 && nonCexIncoming.length === 0;
    
    if (hasCexFunding) withCexFunding++;
    if (isSalesOnly) salesOnly++;
    totalCexFunding += cexFunding;
    
    const row: BuyerCexFlowRow = {
      address,
      has_cex_funding: hasCexFunding,
      cex_funding_mutez: cexFunding,
      is_sales_only: isSalesOnly,
      total_received_mutez: totalReceived,
      total_from_sales_mutez: salesIncome
    };
    
    storage.insertBuyerCexFlow(row);
  }
  
  storage.save();
  
  const buyerCount = buyers.length;
  console.log(`\n--- Buyer CEX Flow Summary ---`);
  console.log(`Buyers with CEX funding: ${withCexFunding} (${((withCexFunding / buyerCount) * 100).toFixed(1)}%)`);
  console.log(`Sales-only buyers (no CEX/external): ${salesOnly} (${((salesOnly / buyerCount) * 100).toFixed(1)}%)`);
  console.log(`Total CEX funding: ${(totalCexFunding / 1_000_000).toFixed(2)} XTZ`);
}

/**
 * Quick CEX flow summary without XTZ transfers
 * Uses heuristics from balance data when XTZ transfers not available
 */
export function deriveBuyerCexFlowFromBalances(storage: Storage): void {
  console.log('\n=== Deriving Buyer CEX Flow (from balances) ===');
  console.log('Note: XTZ transfers not synced, using balance heuristics');
  
  const buyers = storage.getAllBuyers();
  const purchases = storage.getAllPurchases();
  
  // Build a map of seller income
  const sellerIncome: Map<string, number> = new Map();
  for (const p of purchases) {
    if (p.seller && p.spend_mutez) {
      sellerIncome.set(p.seller, (sellerIncome.get(p.seller) || 0) + p.spend_mutez);
    }
  }
  
  // For buyers who are also sellers, estimate if they're "sales only"
  let potentialSalesOnly = 0;
  
  for (const address of buyers) {
    const balance = storage.getBuyerBalance(address);
    const income = sellerIncome.get(address) || 0;
    const spent = purchases
      .filter(p => p.buyer === address && p.spend_mutez)
      .reduce((sum, p) => sum + (p.spend_mutez || 0), 0);
    
    // Heuristic: if starting balance was low but they had sales, might be sales-only
    const startBalance = balance?.balance_mutez || 0;
    const isSalesOnly = income > 0 && startBalance < 10_000_000 && income > spent * 0.5;
    
    if (isSalesOnly) potentialSalesOnly++;
    
    const row: BuyerCexFlowRow = {
      address,
      has_cex_funding: false, // Unknown without XTZ transfers
      cex_funding_mutez: 0,
      is_sales_only: isSalesOnly,
      total_received_mutez: income,
      total_from_sales_mutez: income
    };
    
    storage.insertBuyerCexFlow(row);
  }
  
  storage.save();
  
  console.log(`Potential sales-only buyers (heuristic): ${potentialSalesOnly}`);
  console.log('For accurate CEX tracking, sync XTZ transfers.');
}
