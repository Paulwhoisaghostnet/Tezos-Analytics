/**
 * Transaction Classification Module
 * Categorizes all transactions by type:
 * - nft_sale: NFT marketplace transactions
 * - nft_mint: Token minting
 * - defi: DeFi contract interactions
 * - bridge: Etherlink bridge
 * - cex: CEX deposit/withdrawal
 * - delegation: Staking operations
 * - other: Uncategorized
 */

import { Storage, AllTransactionRow, AddressRegistryRow } from './storage';
import { 
  PipelineConfig, 
  getAllMarketplaceAddresses, 
  isCexAddress, 
  isBridgeAddress,
  getAllBuyEntrypoints,
  getAllAcceptOfferEntrypoints
} from './config';

// Known DeFi entrypoints
const DEFI_ENTRYPOINTS = new Set([
  'swap', 'addLiquidity', 'removeLiquidity', 'trade', 'exchange',
  'invest', 'divest', 'stake', 'unstake', 'claim', 'harvest',
  'mint', 'burn', 'deposit', 'withdraw', 'borrow', 'repay',
  'liquidate', 'flash_loan', 'update_operators', 'transfer'
]);

// Known DeFi contract categories from address registry
const DEFI_CATEGORIES = new Set(['defi', 'dex', 'lending', 'staking']);

// NFT-related entrypoints
const NFT_ENTRYPOINTS = new Set([
  'fulfill_ask', 'collect', 'buy', 'bid', 'conclude_auction',
  'listing_accept', 'offer_accept', 'collection_offer_accept', 'fulfill_offer',
  'ask', 'create_ask', 'list', 'create_auction', 'listing',
  'mint', 'burn', 'transfer'
]);

// Bridge entrypoints
const BRIDGE_ENTRYPOINTS = new Set([
  'deposit', 'withdraw', 'mint', 'burn', 'callback'
]);

/**
 * Classify a single transaction
 */
function classifyTransaction(
  tx: AllTransactionRow,
  addressRegistry: Map<string, AddressRegistryRow>,
  marketplaceAddresses: Set<string>,
  buyEntrypoints: Set<string>,
  config: PipelineConfig
): string {
  const target = tx.target || '';
  const entrypoint = tx.entrypoint || '';
  const targetInfo = addressRegistry.get(target);
  
  // 1. Check if target is a known marketplace
  if (marketplaceAddresses.has(target)) {
    if (buyEntrypoints.has(entrypoint)) {
      return 'nft_sale';
    }
    if (NFT_ENTRYPOINTS.has(entrypoint)) {
      return 'nft_activity';
    }
    return 'nft_marketplace';
  }
  
  // 2. Check if target is NFT contract
  if (targetInfo?.category === 'nft_contract' || targetInfo?.category === 'nft_marketplace') {
    return 'nft_activity';
  }
  
  // 3. Check if target is bridge
  if (isBridgeAddress(target) || targetInfo?.category === 'bridge') {
    return 'bridge';
  }
  
  // 4. Check if target is CEX
  if (isCexAddress(config, target)) {
    return 'cex_deposit';
  }
  
  // 5. Check if sender is CEX
  if (isCexAddress(config, tx.sender)) {
    return 'cex_withdrawal';
  }
  
  // 6. Check if target is DeFi
  if (targetInfo?.category && DEFI_CATEGORIES.has(targetInfo.category)) {
    return 'defi';
  }
  
  // 7. Check entrypoint patterns
  if (DEFI_ENTRYPOINTS.has(entrypoint)) {
    // But not if it looks like NFT
    if (!NFT_ENTRYPOINTS.has(entrypoint)) {
      return 'defi';
    }
  }
  
  // 8. Delegation operations
  if (entrypoint === 'setDelegate' || entrypoint === 'delegate') {
    return 'delegation';
  }
  
  // 9. Simple XTZ transfer (no entrypoint, has amount)
  if (!entrypoint && tx.amount > 0) {
    return 'xtz_transfer';
  }
  
  // 10. Contract origination or other
  if (!target) {
    return 'origination';
  }
  
  return 'other';
}

/**
 * Classify all transactions in the database
 */
export function classifyAllTransactions(config: PipelineConfig, storage: Storage): void {
  console.log('\n=== Classifying All Transactions ===');
  
  // Get address registry
  const registryList = storage.getAllAddressRegistry();
  const addressRegistry = new Map<string, AddressRegistryRow>();
  for (const r of registryList) {
    addressRegistry.set(r.address, r);
  }
  console.log(`Loaded ${registryList.length} addresses from registry`);
  
  // Build lookup sets
  const marketplaceAddresses = new Set(getAllMarketplaceAddresses(config));
  const buyEntrypoints = new Set([
    ...getAllBuyEntrypoints(config),
    ...getAllAcceptOfferEntrypoints(config)
  ]);
  
  // Get all transactions
  const total = storage.getAllTransactionsCount();
  console.log(`Total transactions to classify: ${total.toLocaleString()}`);
  
  if (total === 0) {
    console.log('No transactions found. Run sync-all first.');
    return;
  }
  
  // Process in batches
  const BATCH_SIZE = 1000;
  let processed = 0;
  const categoryCounts: Record<string, number> = {};
  
  // We need to iterate through all transactions
  // Since we can't easily paginate, let's do it by ID ranges
  const maxId = storage.getMaxAllTransactionId();
  
  for (let startId = 0; startId <= maxId; startId += BATCH_SIZE) {
    const transactions = storage.query<AllTransactionRow>(`
      SELECT * FROM all_transactions 
      WHERE id > ? AND id <= ? 
      ORDER BY id
    `, [startId, startId + BATCH_SIZE]);
    
    for (const tx of transactions) {
      const category = classifyTransaction(
        tx, 
        addressRegistry, 
        marketplaceAddresses, 
        buyEntrypoints, 
        config
      );
      
      // Update category
      if (tx.tx_category !== category) {
        storage.updateTransactionCategory(tx.id, category);
      }
      
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      processed++;
    }
    
    if (processed % 10000 === 0 || processed === total) {
      console.log(`  Classified ${processed.toLocaleString()}/${total.toLocaleString()} transactions`);
      storage.save();
    }
  }
  
  storage.save();
  
  // Print summary
  console.log('\n--- Classification Summary ---');
  const sortedCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1]);
  
  for (const [category, count] of sortedCategories) {
    const pct = ((count / processed) * 100).toFixed(1);
    console.log(`  ${category}: ${count.toLocaleString()} (${pct}%)`);
  }
}

/**
 * Get classification statistics
 */
export function getClassificationStats(storage: Storage): Record<string, number> {
  const results = storage.query<{ tx_category: string; cnt: number }>(`
    SELECT tx_category, COUNT(*) as cnt 
    FROM all_transactions 
    WHERE tx_category IS NOT NULL 
    GROUP BY tx_category 
    ORDER BY cnt DESC
  `);
  
  const stats: Record<string, number> = {};
  for (const r of results) {
    stats[r.tx_category] = r.cnt;
  }
  return stats;
}

/**
 * Export classification stats
 */
export function exportClassificationStats(storage: Storage, outputPath: string): void {
  const stats = getClassificationStats(storage);
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  
  const header = 'category,count,percentage\n';
  const rows = Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, cnt]) => `${cat},${cnt},${((cnt / total) * 100).toFixed(2)}`)
    .join('\n');
  
  require('fs').writeFileSync(outputPath, header + rows);
  console.log(`  Written: ${outputPath}`);
}
