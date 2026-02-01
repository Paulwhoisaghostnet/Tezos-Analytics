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

import { Storage, WalletXtzSummaryRow, XtzFlowRow } from './storage';
import { PipelineConfig, isCexAddress, isBridgeAddress } from './config';
import { TzktClient } from './tzkt';

/**
 * Derive wallet XTZ flow summaries from xtz_flows table
 */
export function deriveWalletFlows(config: PipelineConfig, storage: Storage): void {
  console.log('\n=== Deriving Wallet XTZ Flows ===');
  
  // Get all unique wallets from xtz_flows
  const wallets = storage.query<{ address: string }>(`
    SELECT DISTINCT address FROM (
      SELECT sender as address FROM xtz_flows WHERE sender LIKE 'tz%'
      UNION
      SELECT target as address FROM xtz_flows WHERE target LIKE 'tz%'
    )
  `);
  
  console.log(`Found ${wallets.length} unique wallets in XTZ flows`);
  
  if (wallets.length === 0) {
    console.log('No XTZ flows found. Run sync-all first.');
    return;
  }
  
  // Get purchases for identifying NFT-related flows
  const purchases = storage.query<{ buyer: string; seller: string; spend_mutez: number; ts: string }>(`
    SELECT buyer, seller, spend_mutez, ts FROM purchases WHERE spend_mutez IS NOT NULL
  `);
  
  // Build lookup maps
  const purchaseByBuyerTime = new Map<string, number>();
  const saleBySellerTime = new Map<string, number>();
  
  for (const p of purchases) {
    const buyerKey = `${p.buyer}:${p.ts.slice(0, 19)}`;
    const sellerKey = `${p.seller}:${p.ts.slice(0, 19)}`;
    purchaseByBuyerTime.set(buyerKey, (purchaseByBuyerTime.get(buyerKey) || 0) + (p.spend_mutez || 0));
    saleBySellerTime.set(sellerKey, (saleBySellerTime.get(sellerKey) || 0) + (p.spend_mutez || 0));
  }
  
  console.log(`Loaded ${purchases.length} purchases for flow classification`);
  
  let processedCount = 0;
  
  for (const { address } of wallets) {
    // Get all flows for this wallet
    const flows = storage.getXtzFlowsForAddress(address);
    
    // Initialize summary
    const summary: WalletXtzSummaryRow = {
      address,
      balance_start_mutez: null,
      balance_end_mutez: null,
      total_received_mutez: 0,
      total_sent_mutez: 0,
      received_from_sales_mutez: 0,
      spent_on_nfts_mutez: 0,
      sent_to_cex_mutez: 0,
      received_from_cex_mutez: 0,
      sent_to_l2_mutez: 0,
      received_from_l2_mutez: 0
    };
    
    // Try to get balance from raw_balances
    const rawBalance = storage.getRawBalance(address);
    if (rawBalance) {
      summary.balance_start_mutez = rawBalance.balance_mutez;
    }
    
    // Process each flow
    for (const flow of flows) {
      const isOutgoing = flow.sender === address;
      const isIncoming = flow.target === address;
      
      if (isOutgoing) {
        summary.total_sent_mutez += flow.amount_mutez;
        
        // Classify outgoing
        if (flow.flow_type === 'cex_deposit') {
          summary.sent_to_cex_mutez += flow.amount_mutez;
        } else if (flow.flow_type === 'bridge_to_l2') {
          summary.sent_to_l2_mutez += flow.amount_mutez;
        } else {
          // Check if this is an NFT purchase (by timestamp match)
          const buyerKey = `${address}:${flow.timestamp.slice(0, 19)}`;
          if (purchaseByBuyerTime.has(buyerKey)) {
            summary.spent_on_nfts_mutez += flow.amount_mutez;
          }
        }
      }
      
      if (isIncoming) {
        summary.total_received_mutez += flow.amount_mutez;
        
        // Classify incoming
        if (flow.flow_type === 'cex_withdrawal') {
          summary.received_from_cex_mutez += flow.amount_mutez;
        } else if (flow.flow_type === 'bridge_from_l2') {
          summary.received_from_l2_mutez += flow.amount_mutez;
        } else {
          // Check if this is from an NFT sale (by timestamp match)
          const sellerKey = `${address}:${flow.timestamp.slice(0, 19)}`;
          if (saleBySellerTime.has(sellerKey)) {
            summary.received_from_sales_mutez += flow.amount_mutez;
          }
        }
      }
    }
    
    // Calculate end balance (approximate)
    if (summary.balance_start_mutez !== null) {
      summary.balance_end_mutez = summary.balance_start_mutez + 
        summary.total_received_mutez - summary.total_sent_mutez;
    }
    
    storage.upsertWalletXtzSummary(summary);
    processedCount++;
    
    if (processedCount % 100 === 0) {
      console.log(`  Processed ${processedCount}/${wallets.length} wallets`);
      storage.save();
    }
  }
  
  storage.save();
  
  // Print summary stats
  const summaries = storage.getAllWalletXtzSummaries();
  const totalCexIn = summaries.reduce((sum, s) => sum + s.received_from_cex_mutez, 0);
  const totalCexOut = summaries.reduce((sum, s) => sum + s.sent_to_cex_mutez, 0);
  const totalL2In = summaries.reduce((sum, s) => sum + s.received_from_l2_mutez, 0);
  const totalL2Out = summaries.reduce((sum, s) => sum + s.sent_to_l2_mutez, 0);
  const totalSalesIncome = summaries.reduce((sum, s) => sum + s.received_from_sales_mutez, 0);
  const totalNftSpend = summaries.reduce((sum, s) => sum + s.spent_on_nfts_mutez, 0);
  
  console.log(`\n--- Wallet Flow Summary ---`);
  console.log(`Wallets analyzed: ${summaries.length}`);
  console.log(`\nCEX Flow:`);
  console.log(`  Withdrawn from CEX: ${(totalCexIn / 1_000_000).toLocaleString()} XTZ`);
  console.log(`  Deposited to CEX: ${(totalCexOut / 1_000_000).toLocaleString()} XTZ`);
  console.log(`  Net from CEX: ${((totalCexIn - totalCexOut) / 1_000_000).toLocaleString()} XTZ`);
  console.log(`\nL2 Bridge Flow:`);
  console.log(`  From L2 (Etherlink): ${(totalL2In / 1_000_000).toLocaleString()} XTZ`);
  console.log(`  To L2 (Etherlink): ${(totalL2Out / 1_000_000).toLocaleString()} XTZ`);
  console.log(`  Net to L2: ${((totalL2Out - totalL2In) / 1_000_000).toLocaleString()} XTZ`);
  console.log(`\nNFT Flow:`);
  console.log(`  Income from sales: ${(totalSalesIncome / 1_000_000).toLocaleString()} XTZ`);
  console.log(`  Spent on NFTs: ${(totalNftSpend / 1_000_000).toLocaleString()} XTZ`);
  console.log(`  Net NFT activity: ${((totalSalesIncome - totalNftSpend) / 1_000_000).toLocaleString()} XTZ`);
}

/**
 * Export wallet flows to CSV
 */
export function exportWalletFlows(storage: Storage, outputPath: string): void {
  const summaries = storage.getAllWalletXtzSummaries();
  
  const header = [
    'address',
    'balance_start_xtz',
    'balance_end_xtz',
    'total_received_xtz',
    'total_sent_xtz',
    'received_from_sales_xtz',
    'spent_on_nfts_xtz',
    'received_from_cex_xtz',
    'sent_to_cex_xtz',
    'received_from_l2_xtz',
    'sent_to_l2_xtz',
    'net_flow_xtz'
  ].join(',') + '\n';
  
  const rows = summaries.map(s => {
    const toXtz = (mutez: number | null) => mutez !== null ? (mutez / 1_000_000).toFixed(6) : '';
    const netFlow = s.total_received_mutez - s.total_sent_mutez;
    
    return [
      s.address,
      toXtz(s.balance_start_mutez),
      toXtz(s.balance_end_mutez),
      toXtz(s.total_received_mutez),
      toXtz(s.total_sent_mutez),
      toXtz(s.received_from_sales_mutez),
      toXtz(s.spent_on_nfts_mutez),
      toXtz(s.received_from_cex_mutez),
      toXtz(s.sent_to_cex_mutez),
      toXtz(s.received_from_l2_mutez),
      toXtz(s.sent_to_l2_mutez),
      toXtz(netFlow)
    ].join(',');
  }).join('\n');
  
  require('fs').writeFileSync(outputPath, header + rows);
  console.log(`  Written: ${outputPath} (${summaries.length} rows)`);
}
