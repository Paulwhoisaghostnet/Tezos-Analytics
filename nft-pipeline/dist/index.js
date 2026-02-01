"use strict";
/**
 * Tezos NFT Market Pressure Pipeline
 *
 * Two-phase architecture:
 * 1. SYNC: Pull all raw data from TzKT API into local SQLite (run once or periodically)
 * 2. ANALYZE: Derive insights from local data (no API calls, instant re-runs)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSync = runSync;
exports.runSyncXtz = runSyncXtz;
exports.runSyncAll = runSyncAll;
exports.runAnalyze = runAnalyze;
exports.runFull = runFull;
exports.runDiscover = runDiscover;
exports.runResolve = runResolve;
exports.runClassify = runClassify;
exports.runNetwork = runNetwork;
exports.runStatus = runStatus;
const config_1 = require("./config");
const storage_1 = require("./storage");
const sync_1 = require("./sync");
const derive_buyers_1 = require("./derive_buyers");
const derive_creators_1 = require("./derive_creators");
const derive_listings_1 = require("./derive_listings");
const derive_offer_accepts_1 = require("./derive_offer_accepts");
const derive_resales_1 = require("./derive_resales");
const derive_daily_metrics_1 = require("./derive_daily_metrics");
const derive_marketplace_fees_1 = require("./derive_marketplace_fees");
const derive_cex_flow_1 = require("./derive_cex_flow");
const derive_fund_flow_1 = require("./derive_fund_flow");
const discover_entrypoints_1 = require("./discover_entrypoints");
const discover_addresses_1 = require("./discover_addresses");
const identity_resolver_1 = require("./identity_resolver");
const export_1 = require("./export");
const generate_charts_1 = require("./generate_charts");
const generate_network_1 = require("./generate_network");
const classify_transactions_1 = require("./classify_transactions");
const derive_wallet_flow_1 = require("./derive_wallet_flow");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * SYNC COMMAND: Pull all raw data from TzKT into local database
 */
async function runSync(config = config_1.DEFAULT_CONFIG) {
    console.log('='.repeat(60));
    console.log('PHASE 1: DATA SYNC');
    console.log('Pulling all data from TzKT API into local database');
    console.log('='.repeat(60));
    const storage = await storage_1.Storage.create(config.dbPath);
    try {
        await (0, sync_1.syncAllData)(config, storage);
    }
    finally {
        storage.close();
    }
}
/**
 * ANALYZE COMMAND: Derive insights from local data (no API calls)
 */
async function runAnalyze(config = config_1.DEFAULT_CONFIG) {
    console.log('='.repeat(60));
    console.log('PHASE 2: ANALYZE');
    console.log('Deriving insights from local database (no API calls)');
    console.log('='.repeat(60));
    const storage = await storage_1.Storage.create(config.dbPath);
    const window = (0, config_1.getTimeWindow)(config);
    try {
        const status = (0, sync_1.getSyncStatus)(storage);
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
        await (0, derive_buyers_1.deriveBuyers)(config, storage);
        console.log('\n' + '-'.repeat(60));
        (0, derive_buyers_1.populateBuyerBalances)(storage);
        console.log('\n' + '-'.repeat(60));
        (0, derive_creators_1.deriveCreators)(storage);
        console.log('\n' + '-'.repeat(60));
        (0, derive_listings_1.deriveListings)(config, storage);
        console.log('\n' + '-'.repeat(60));
        (0, derive_offer_accepts_1.deriveOfferAccepts)(config, storage);
        console.log('\n' + '-'.repeat(60));
        (0, derive_resales_1.deriveResales)(config, storage);
        // New analytics
        console.log('\n' + '-'.repeat(60));
        (0, derive_daily_metrics_1.deriveDailyMetrics)(storage);
        console.log('\n' + '-'.repeat(60));
        (0, derive_marketplace_fees_1.deriveMarketplaceFees)(config, storage);
        console.log('\n' + '-'.repeat(60));
        // CEX flow - use full version if XTZ transfers available
        if (status.xtzTransfers > 0) {
            (0, derive_cex_flow_1.deriveBuyerCexFlow)(config, storage);
        }
        else {
            (0, derive_cex_flow_1.deriveBuyerCexFlowFromBalances)(storage);
        }
        console.log('\n' + '-'.repeat(60));
        (0, derive_fund_flow_1.deriveCreatorFundFlow)(config, storage);
        // Export data
        console.log('\n' + '-'.repeat(60));
        (0, export_1.exportData)(config, storage, window.startISO, window.endISO);
        // Generate charts
        console.log('\n' + '-'.repeat(60));
        (0, generate_charts_1.generateCharts)(config, storage);
        const summary = JSON.parse(fs.readFileSync(path.join(config.outputDir, 'summary.json'), 'utf-8'));
        (0, export_1.printSummary)(summary);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\nAnalysis completed in ${elapsed}s (no API calls)`);
        if (status.xtzTransfers === 0) {
            console.log('\nNote: For detailed CEX flow analysis, run:');
            console.log('  npm run sync-xtz');
        }
    }
    finally {
        storage.close();
    }
}
/**
 * DISCOVER COMMAND: Analyze entrypoints from local data
 */
async function runDiscover(config = config_1.DEFAULT_CONFIG) {
    const storage = await storage_1.Storage.create(config.dbPath);
    try {
        // Discover entrypoints
        (0, discover_entrypoints_1.discoverEntrypoints)(config, storage);
        // Discover top contracts and wallets
        (0, discover_addresses_1.runAddressDiscovery)(storage, 50, 200);
        // Export address registry
        const outDir = './out';
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        (0, discover_addresses_1.exportAddressRegistry)(storage, path.join(outDir, 'address_registry.csv'));
    }
    finally {
        storage.close();
    }
}
/**
 * RESOLVE COMMAND: Resolve wallet identities via TzKT and Tezos Domains
 */
async function runResolve(config = config_1.DEFAULT_CONFIG) {
    const storage = await storage_1.Storage.create(config.dbPath);
    try {
        await (0, identity_resolver_1.resolveUnresolvedAddresses)(config, storage, 50, 500);
        // Print resolved addresses
        (0, identity_resolver_1.printResolvedAddresses)(storage);
        // Export updated registry
        const outDir = './out';
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        (0, discover_addresses_1.exportAddressRegistry)(storage, path.join(outDir, 'address_registry.csv'));
    }
    finally {
        storage.close();
    }
}
/**
 * CLASSIFY COMMAND: Classify all transactions by category
 */
async function runClassify(config = config_1.DEFAULT_CONFIG) {
    const storage = await storage_1.Storage.create(config.dbPath);
    try {
        (0, classify_transactions_1.classifyAllTransactions)(config, storage);
        // Also derive wallet flows if we have XTZ data
        if (storage.getXtzFlowsCount() > 0) {
            (0, derive_wallet_flow_1.deriveWalletFlows)(config, storage);
            const outDir = './out';
            if (!fs.existsSync(outDir)) {
                fs.mkdirSync(outDir, { recursive: true });
            }
            (0, derive_wallet_flow_1.exportWalletFlows)(storage, path.join(outDir, 'wallet_flows.csv'));
        }
    }
    finally {
        storage.close();
    }
}
/**
 * NETWORK COMMAND: Generate D3.js network visualization
 */
async function runNetwork(config = config_1.DEFAULT_CONFIG) {
    const storage = await storage_1.Storage.create(config.dbPath);
    try {
        // Check for wallet filter argument
        const walletArg = process.argv.find(arg => arg.startsWith('--wallet='));
        const filterWallet = walletArg ? walletArg.split('=')[1] : undefined;
        (0, generate_network_1.generateNetworkVisualization)(config, storage, './out', filterWallet);
    }
    finally {
        storage.close();
    }
}
/**
 * SYNC-XTZ COMMAND: Sync XTZ transfers for CEX flow analysis
 */
async function runSyncXtz(config = config_1.DEFAULT_CONFIG) {
    console.log('='.repeat(60));
    console.log('SYNC XTZ TRANSFERS');
    console.log('For detailed CEX flow analysis');
    console.log('='.repeat(60));
    const storage = await storage_1.Storage.create(config.dbPath);
    try {
        // Check if we have buyer/creator data
        const buyerCount = storage.getBuyerCount();
        const creatorCount = storage.getCreatorCount();
        if (buyerCount === 0 && creatorCount === 0) {
            console.log('\nNo buyers or creators found. Run analyze first to identify wallets.');
            console.log('  npm run analyze');
            return;
        }
        await (0, sync_1.syncXtzTransfersOnly)(config, storage);
    }
    finally {
        storage.close();
    }
}
/**
 * SYNC-ALL COMMAND: Comprehensive sync of ALL transactions
 */
async function runSyncAll(config = config_1.DEFAULT_CONFIG) {
    const storage = await storage_1.Storage.create(config.dbPath);
    try {
        await (0, sync_1.syncAllComprehensive)(config, storage);
    }
    finally {
        storage.close();
    }
}
/**
 * SYNC-WEEK COMMAND: Sync a specific week or show status
 */
async function runSyncWeek(config = config_1.DEFAULT_CONFIG) {
    const args = process.argv.slice(2);
    const weekArg = args[1]; // e.g., 'week1', 'status', 'all'
    const storage = await storage_1.Storage.create(config.dbPath);
    try {
        // Initialize week tracking
        (0, sync_1.initializeWeeklySyncProgress)(storage);
        if (!weekArg || weekArg === 'status') {
            // Show status
            (0, sync_1.printWeeklySyncStatus)(storage);
        }
        else if (weekArg === 'all') {
            // Sync all incomplete weeks
            await (0, sync_1.syncAllIncompleteWeeks)(config, storage);
        }
        else if (sync_1.SYNC_WEEKS.some(w => w.id === weekArg)) {
            // Sync specific week
            await (0, sync_1.syncWeek)(config, storage, weekArg);
            // Show updated status
            (0, sync_1.printWeeklySyncStatus)(storage);
        }
        else {
            console.log(`Unknown week: ${weekArg}`);
            console.log(`Valid options: ${sync_1.SYNC_WEEKS.map(w => w.id).join(', ')}, status, all`);
        }
    }
    finally {
        storage.close();
    }
}
/**
 * STATUS COMMAND: Show database status
 */
async function runStatus(config = config_1.DEFAULT_CONFIG) {
    const storage = await storage_1.Storage.create(config.dbPath);
    try {
        const status = (0, sync_1.getSyncStatus)(storage);
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
    }
    finally {
        storage.close();
    }
}
/**
 * FULL COMMAND: Sync + Analyze in one go
 */
async function runFull(config = config_1.DEFAULT_CONFIG) {
    await runSync(config);
    console.log('\n');
    await runAnalyze(config);
}
/**
 * Print help
 */
function printHelp() {
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
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';
    // Handle --clear flag
    if (args.includes('--clear')) {
        const storage = await storage_1.Storage.create(config_1.DEFAULT_CONFIG.dbPath);
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
//# sourceMappingURL=index.js.map