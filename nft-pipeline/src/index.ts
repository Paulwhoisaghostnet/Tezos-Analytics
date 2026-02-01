/**
 * Tezos NFT Market Pressure Pipeline
 * 
 * Two-phase architecture:
 * 1. SYNC: Pull all raw data from TzKT API into local SQLite (run once or periodically)
 * 2. ANALYZE: Derive insights from local data (no API calls, instant re-runs)
 */

import { DEFAULT_CONFIG, getTimeWindow, PipelineConfig } from './config';
import { Storage } from './storage';
import { 
  syncAllData, 
  getSyncStatus, 
  syncXtzTransfersOnly, 
  syncAllComprehensive,
  syncWeek,
  printWeeklySyncStatus,
  syncAllIncompleteWeeks,
  initializeWeeklySyncProgress,
  SYNC_WEEKS
} from './sync';
import { deriveBuyers, populateBuyerBalances } from './derive_buyers';
import { deriveCreators } from './derive_creators';
import { deriveListings } from './derive_listings';
import { deriveOfferAccepts } from './derive_offer_accepts';
import { deriveResales } from './derive_resales';
import { deriveDailyMetrics } from './derive_daily_metrics';
import { deriveMarketplaceFees } from './derive_marketplace_fees';
import { deriveBuyerCexFlow, deriveBuyerCexFlowFromBalances } from './derive_cex_flow';
import { deriveCreatorFundFlow } from './derive_fund_flow';
import { discoverEntrypoints } from './discover_entrypoints';
import { runAddressDiscovery, exportAddressRegistry } from './discover_addresses';
import { resolveUnresolvedAddresses, printResolvedAddresses } from './identity_resolver';
import { exportData, printSummary, SummaryStats } from './export';
import { generateCharts } from './generate_charts';
import { generateNetworkVisualization } from './generate_network';
import { classifyAllTransactions } from './classify_transactions';
import { deriveWalletFlows, exportWalletFlows } from './derive_wallet_flow';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SYNC COMMAND: Pull all raw data from TzKT into local database
 */
async function runSync(config: PipelineConfig = DEFAULT_CONFIG): Promise<void> {
  console.log('='.repeat(60));
  console.log('PHASE 1: DATA SYNC');
  console.log('Pulling all data from TzKT API into local database');
  console.log('='.repeat(60));
  
  const storage = await Storage.create(config.dbPath);
  
  try {
    await syncAllData(config, storage);
  } finally {
    storage.close();
  }
}

/**
 * ANALYZE COMMAND: Derive insights from local data (no API calls)
 */
async function runAnalyze(config: PipelineConfig = DEFAULT_CONFIG): Promise<void> {
  console.log('='.repeat(60));
  console.log('PHASE 2: ANALYZE');
  console.log('Deriving insights from local database (no API calls)');
  console.log('='.repeat(60));
  
  const storage = await Storage.create(config.dbPath);
  const window = getTimeWindow(config);
  
  try {
    const status = getSyncStatus(storage);
    console.log('\nLocal database status:');
    console.log(`  Last sync: ${status.lastSync || 'never'}`);
    console.log(`  Transactions: ${status.transactions}`);
    console.log(`  Token transfers: ${status.transfers}`);
    console.log(`  Balances: ${status.balances}`);
    console.log(`  XTZ transfers: ${status.xtzTransfers}`);
    
    if (status.transactions === 0) {
      console.log('\nNo data in local database. Run sync first!');
      console.log('  npm run sync');
      return;
    }
    
    console.log('\nClearing previous derived data...');
    storage.clearDerived();
    
    const startTime = Date.now();
    
    // Core derivations
    console.log('\n' + '-'.repeat(60));
    await deriveBuyers(config, storage);
    
    console.log('\n' + '-'.repeat(60));
    populateBuyerBalances(storage);
    
    console.log('\n' + '-'.repeat(60));
    deriveCreators(storage);
    
    console.log('\n' + '-'.repeat(60));
    deriveListings(config, storage);
    
    console.log('\n' + '-'.repeat(60));
    deriveOfferAccepts(config, storage);
    
    console.log('\n' + '-'.repeat(60));
    deriveResales(config, storage);
    
    // New analytics
    console.log('\n' + '-'.repeat(60));
    deriveDailyMetrics(storage);
    
    console.log('\n' + '-'.repeat(60));
    deriveMarketplaceFees(config, storage);
    
    console.log('\n' + '-'.repeat(60));
    // CEX flow - use full version if XTZ transfers available
    if (status.xtzTransfers > 0) {
      deriveBuyerCexFlow(config, storage);
    } else {
      deriveBuyerCexFlowFromBalances(storage);
    }
    
    console.log('\n' + '-'.repeat(60));
    deriveCreatorFundFlow(config, storage);
    
    // Export data
    console.log('\n' + '-'.repeat(60));
    exportData(config, storage, window.startISO, window.endISO);
    
    // Generate charts
    console.log('\n' + '-'.repeat(60));
    generateCharts(config, storage);
    
    const summary: SummaryStats = JSON.parse(
      fs.readFileSync(path.join(config.outputDir, 'summary.json'), 'utf-8')
    );
    printSummary(summary);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nAnalysis completed in ${elapsed}s (no API calls)`);
    
    if (status.xtzTransfers === 0) {
      console.log('\nNote: For detailed CEX flow analysis, run:');
      console.log('  npm run sync-xtz');
    }
    
  } finally {
    storage.close();
  }
}

/**
 * DISCOVER COMMAND: Analyze entrypoints from local data
 */
async function runDiscover(config: PipelineConfig = DEFAULT_CONFIG): Promise<void> {
  const storage = await Storage.create(config.dbPath);
  try {
    // Discover entrypoints
    discoverEntrypoints(config, storage);
    
    // Discover top contracts and wallets
    runAddressDiscovery(storage, 50, 200);
    
    // Export address registry
    const outDir = './out';
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    exportAddressRegistry(storage, path.join(outDir, 'address_registry.csv'));
  } finally {
    storage.close();
  }
}

/**
 * RESOLVE COMMAND: Resolve wallet identities via TzKT and Tezos Domains
 */
async function runResolve(config: PipelineConfig = DEFAULT_CONFIG): Promise<void> {
  const storage = await Storage.create(config.dbPath);
  try {
    await resolveUnresolvedAddresses(config, storage, 50, 500);
    
    // Print resolved addresses
    printResolvedAddresses(storage);
    
    // Export updated registry
    const outDir = './out';
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    exportAddressRegistry(storage, path.join(outDir, 'address_registry.csv'));
  } finally {
    storage.close();
  }
}

/**
 * CLASSIFY COMMAND: Classify all transactions by category
 */
async function runClassify(config: PipelineConfig = DEFAULT_CONFIG): Promise<void> {
  const storage = await Storage.create(config.dbPath);
  try {
    classifyAllTransactions(config, storage);
    
    // Also derive wallet flows if we have XTZ data
    if (storage.getXtzFlowsCount() > 0) {
      deriveWalletFlows(config, storage);
      
      const outDir = './out';
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      exportWalletFlows(storage, path.join(outDir, 'wallet_flows.csv'));
    }
  } finally {
    storage.close();
  }
}

/**
 * NETWORK COMMAND: Generate D3.js network visualization
 */
async function runNetwork(config: PipelineConfig = DEFAULT_CONFIG): Promise<void> {
  const storage = await Storage.create(config.dbPath);
  try {
    // Check for wallet filter argument
    const walletArg = process.argv.find(arg => arg.startsWith('--wallet='));
    const filterWallet = walletArg ? walletArg.split('=')[1] : undefined;
    
    generateNetworkVisualization(config, storage, './out', filterWallet);
  } finally {
    storage.close();
  }
}

/**
 * SYNC-XTZ COMMAND: Sync XTZ transfers for CEX flow analysis
 */
async function runSyncXtz(config: PipelineConfig = DEFAULT_CONFIG): Promise<void> {
  console.log('='.repeat(60));
  console.log('SYNC XTZ TRANSFERS');
  console.log('For detailed CEX flow analysis');
  console.log('='.repeat(60));
  
  const storage = await Storage.create(config.dbPath);
  
  try {
    // Check if we have buyer/creator data
    const buyerCount = storage.getBuyerCount();
    const creatorCount = storage.getCreatorCount();
    
    if (buyerCount === 0 && creatorCount === 0) {
      console.log('\nNo buyers or creators found. Run analyze first to identify wallets.');
      console.log('  npm run analyze');
      return;
    }
    
    await syncXtzTransfersOnly(config, storage);

  } finally {
    storage.close();
  }
}

/**
 * SYNC-ALL COMMAND: Comprehensive sync of ALL transactions
 */
async function runSyncAll(config: PipelineConfig = DEFAULT_CONFIG): Promise<void> {
  const storage = await Storage.create(config.dbPath);
  
  try {
    await syncAllComprehensive(config, storage);
  } finally {
    storage.close();
  }
}

/**
 * SYNC-WEEK COMMAND: Sync a specific week or show status
 */
async function runSyncWeek(config: PipelineConfig = DEFAULT_CONFIG): Promise<void> {
  const args = process.argv.slice(2);
  const weekArg = args[1]; // e.g., 'week1', 'status', 'all'
  
  const storage = await Storage.create(config.dbPath);
  
  try {
    // Initialize week tracking
    initializeWeeklySyncProgress(storage);
    
    if (!weekArg || weekArg === 'status') {
      // Show status
      printWeeklySyncStatus(storage);
    } else if (weekArg === 'all') {
      // Sync all incomplete weeks
      await syncAllIncompleteWeeks(config, storage);
    } else if (SYNC_WEEKS.some(w => w.id === weekArg)) {
      // Sync specific week
      await syncWeek(config, storage, weekArg);
      
      // Show updated status
      printWeeklySyncStatus(storage);
    } else {
      console.log(`Unknown week: ${weekArg}`);
      console.log(`Valid options: ${SYNC_WEEKS.map(w => w.id).join(', ')}, status, all`);
    }
  } finally {
    storage.close();
  }
}

/**
 * STATUS COMMAND: Show database status
 */
async function runStatus(config: PipelineConfig = DEFAULT_CONFIG): Promise<void> {
  const storage = await Storage.create(config.dbPath);
  try {
    const status = getSyncStatus(storage);
    
    console.log('='.repeat(60));
    console.log('DATABASE STATUS');
    console.log('='.repeat(60));
    console.log(`\nDatabase path: ${config.dbPath}`);
    console.log(`\nSync status:`);
    console.log(`  Last sync: ${status.lastSync || 'never'}`);
    console.log(`  Window start: ${status.windowStart || 'n/a'}`);
    console.log(`  Window end: ${status.windowEnd || 'n/a'}`);
    console.log(`\nRaw data:`);
    console.log(`  Transactions: ${status.transactions.toLocaleString()}`);
    console.log(`  Token transfers: ${status.transfers.toLocaleString()}`);
    console.log(`  Balances: ${status.balances.toLocaleString()}`);
    console.log(`  XTZ transfers: ${status.xtzTransfers.toLocaleString()}`);
    console.log(`\nDerived data:`);
    console.log(`  Buyers: ${storage.getBuyerCount().toLocaleString()}`);
    console.log(`  Creators: ${storage.getCreatorCount().toLocaleString()}`);
    console.log(`  Purchases: ${storage.getPurchaseCount().toLocaleString()}`);
    console.log(`  Mints: ${storage.getMintCount().toLocaleString()}`);
    console.log(`  Listings: ${storage.getListingCount().toLocaleString()}`);
    console.log(`  Offer accepts: ${storage.getOfferAcceptCount().toLocaleString()}`);
    console.log(`  Resales: ${storage.getResaleCount().toLocaleString()}`);
    console.log(`  Daily metrics: ${storage.getDailyMetricsCount().toLocaleString()}`);
    console.log(`\nMarketplace stats:`);
    const mpStats = storage.getAllMarketplaceStats();
    for (const stat of mpStats) {
      console.log(`  ${stat.marketplace}: ${stat.sale_count} sales, ${(stat.volume_mutez / 1_000_000).toFixed(2)} XTZ`);
    }
    
    console.log(`\nAddress registry:`);
    console.log(`  Total addresses: ${storage.getAddressRegistryCount().toLocaleString()}`);
    console.log(`  Resolved (with identity): ${storage.getResolvedAddressCount().toLocaleString()}`);
    console.log(`\nComprehensive data:`);
    console.log(`  All transactions: ${storage.getAllTransactionsCount().toLocaleString()}`);
    console.log(`  XTZ flows: ${storage.getXtzFlowsCount().toLocaleString()}`);
    
  } finally {
    storage.close();
  }
}

/**
 * FULL COMMAND: Sync + Analyze in one go
 */
async function runFull(config: PipelineConfig = DEFAULT_CONFIG): Promise<void> {
  await runSync(config);
  console.log('\n');
  await runAnalyze(config);
}

/**
 * Print help
 */
function printHelp(): void {
  console.log(`
Tezos NFT Market Pressure Pipeline

USAGE:
  node dist/index.js <command> [options]

COMMANDS:
  sync       Pull marketplace data from TzKT API into local database
  sync-xtz   Sync XTZ transfers for CEX flow analysis (requires analyze first)
  sync-all   Sync ALL transactions for January 2026 (comprehensive - slow!)
  sync-week  Smart weekly sync - use 'status', 'week1'-'week5', or 'all'
  analyze    Derive insights from local data (no API calls)
  full       Run sync + analyze together
  discover   Discover top contracts/wallets and analyze entrypoints
  resolve    Resolve wallet identities via TzKT and Tezos Domains
  classify   Classify all transactions by category
  network   Generate D3.js network visualization
  status    Show database status
  help      Show this help message

OPTIONS:
  --clear   Clear all data before running (for sync/full)

EXAMPLES:
  # First time: pull data from TzKT
  node dist/index.js sync

  # Then analyze (instant, no API calls)
  node dist/index.js analyze

  # For detailed CEX flow analysis (optional)
  node dist/index.js sync-xtz
  node dist/index.js analyze

  # Re-run analysis with different parameters (instant)
  node dist/index.js analyze

  # Full pipeline in one command
  node dist/index.js full

  # Check what's in the database
  node dist/index.js status

  # Discover marketplace entrypoints
  node dist/index.js discover

WEEKLY SYNC (recommended):
  npm run sync-week status   # Show weekly sync progress
  npm run sync-week week1    # Sync Jan 1-7 (run when you have time)
  npm run sync-week week2    # Sync Jan 8-14
  npm run sync-week week3    # Sync Jan 15-21
  npm run sync-week week4    # Sync Jan 22-28
  npm run sync-week week5    # Sync Jan 29-31
  npm run sync-week all      # Sync all incomplete weeks

DASHBOARD:
  npm run dev                # Start local analytics dashboard at http://localhost:3000

OUTPUT FILES (written to ./out/):
  summary.json              - Summary statistics with all metrics
  buyers.csv                - Unique buyers with balances and spend
  buyer_purchases.csv       - All purchase transactions
  creators.csv              - Unique creators with mint counts
  creator_mints.csv         - All mint transactions
  creator_listings.csv      - All listing transactions
  creator_offer_accepts.csv - Offer accepts with price comparison
  collector_resales.csv     - Secondary sales by collectors
  daily_metrics.csv         - Daily volume, buyers, sellers
  marketplace_stats.csv     - Marketplace breakdown with fees
  daily_marketplace_fees.csv - Daily fees by marketplace
  buyer_cex_flow.csv        - Buyer CEX funding analysis
  creator_fund_flow.csv     - Creator fund flow (CEX cashout, NFT buying)
  charts.html               - Interactive HTML charts (open in browser)
  network.html              - D3.js network visualization
  address_registry.csv      - All identified addresses with aliases
`);
}

// Main entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  // Handle --clear flag
  if (args.includes('--clear')) {
    const storage = await Storage.create(DEFAULT_CONFIG.dbPath);
    console.log('Clearing all data...');
    storage.clearAll();
    storage.close();
  }
  
  switch (command) {
    case 'sync':
      await runSync();
      break;
    case 'sync-xtz':
      await runSyncXtz();
      break;
    case 'sync-all':
      await runSyncAll();
      break;
    case 'sync-week':
      await runSyncWeek();
      break;
    case 'analyze':
      await runAnalyze();
      break;
    case 'full':
      await runFull();
      break;
    case 'discover':
      await runDiscover();
      break;
    case 'resolve':
      await runResolve();
      break;
    case 'classify':
      await runClassify();
      break;
    case 'network':
      await runNetwork();
      break;
    case 'status':
      await runStatus();
      break;
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
    default:
      console.log(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Pipeline failed:', error);
    process.exit(1);
  });
}

export { runSync, runSyncXtz, runSyncAll, runAnalyze, runFull, runDiscover, runResolve, runClassify, runNetwork, runStatus };
