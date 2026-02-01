/**
 * Data Sync Module
 * Pull all raw data from TzKT API into local SQLite database
 * This is the ONLY module that makes API calls
 */

import { PipelineConfig, getTimeWindow, getAllMarketplaceAddresses, isCexAddress, KNOWN_CEX_ADDRESSES, isBridgeAddress, KNOWN_BRIDGE_ADDRESSES } from './config';
import { TzktClient, TzktTransaction, TzktTokenTransfer } from './tzkt';
import { Storage, RawTransaction, RawTokenTransfer, RawXtzTransfer, AllTransactionRow, XtzFlowRow } from './storage';
import pLimit from 'p-limit';

/**
 * Convert TzKT transaction to raw storage format
 */
function txToRaw(tx: TzktTransaction): RawTransaction {
  return {
    id: tx.id,
    hash: tx.hash,
    level: tx.level,
    timestamp: tx.timestamp,
    sender: tx.sender.address,
    target: tx.target?.address || '',
    amount: tx.amount,
    entrypoint: tx.parameter?.entrypoint || null,
    parameters: tx.parameter?.value ? JSON.stringify(tx.parameter.value) : null,
    status: tx.status,
    has_internals: tx.hasInternals
  };
}

/**
 * Convert TzKT token transfer to raw storage format
 */
function transferToRaw(transfer: TzktTokenTransfer): RawTokenTransfer {
  return {
    id: transfer.id,
    level: transfer.level,
    timestamp: transfer.timestamp,
    token_contract: transfer.token.contract.address,
    token_id: transfer.token.tokenId,
    token_standard: transfer.token.standard,
    from_address: transfer.from?.address || null,
    to_address: transfer.to?.address || null,
    amount: transfer.amount,
    transaction_id: transfer.transactionId || null
  };
}

/**
 * Sync marketplace transactions from TzKT
 */
async function syncMarketplaceTransactions(
  config: PipelineConfig,
  client: TzktClient,
  storage: Storage,
  startISO: string,
  endISO: string
): Promise<number> {
  console.log('\n--- Syncing Marketplace Transactions ---');
  
  const marketplaceAddresses = getAllMarketplaceAddresses(config);
  console.log(`Marketplaces: ${marketplaceAddresses.join(', ')}`);
  
  const lastId = storage.getMaxRawTransactionId();
  console.log(`Last synced transaction ID: ${lastId ?? 'none'}`);
  
  let syncedCount = 0;
  let batchBuffer: RawTransaction[] = [];
  const BATCH_SIZE = 500;
  
  for await (const batch of client.getAllMarketplaceTransactions(
    marketplaceAddresses,
    startISO,
    endISO
  )) {
    for (const tx of batch) {
      if (lastId !== null && tx.id <= lastId) continue;
      
      batchBuffer.push(txToRaw(tx));
      
      if (batchBuffer.length >= BATCH_SIZE) {
        storage.insertRawTransactionsBatch(batchBuffer);
        syncedCount += batchBuffer.length;
        console.log(`  Synced ${syncedCount} transactions...`);
        batchBuffer = [];
      }
    }
  }
  
  if (batchBuffer.length > 0) {
    storage.insertRawTransactionsBatch(batchBuffer);
    syncedCount += batchBuffer.length;
  }
  
  console.log(`Synced ${syncedCount} new marketplace transactions`);
  console.log(`Total in database: ${storage.getRawTransactionCount()}`);
  
  return syncedCount;
}

/**
 * Sync FA2 token transfers from TzKT
 */
async function syncTokenTransfers(
  config: PipelineConfig,
  client: TzktClient,
  storage: Storage,
  startISO: string,
  endISO: string
): Promise<number> {
  console.log('\n--- Syncing Token Transfers ---');
  
  const lastId = storage.getMaxRawTokenTransferId();
  console.log(`Last synced transfer ID: ${lastId ?? 'none'}`);
  
  let syncedCount = 0;
  let batchBuffer: RawTokenTransfer[] = [];
  const BATCH_SIZE = 500;
  
  for await (const batch of client.getTokenTransfers(startISO, endISO)) {
    for (const transfer of batch) {
      if (lastId !== null && transfer.id <= lastId) continue;
      
      batchBuffer.push(transferToRaw(transfer));
      
      if (batchBuffer.length >= BATCH_SIZE) {
        storage.insertRawTokenTransfersBatch(batchBuffer);
        syncedCount += batchBuffer.length;
        console.log(`  Synced ${syncedCount} transfers...`);
        batchBuffer = [];
      }
    }
  }
  
  if (batchBuffer.length > 0) {
    storage.insertRawTokenTransfersBatch(batchBuffer);
    syncedCount += batchBuffer.length;
  }
  
  console.log(`Synced ${syncedCount} new token transfers`);
  console.log(`Total in database: ${storage.getRawTokenTransferCount()}`);
  
  return syncedCount;
}

/**
 * Sync wallet balances at window start
 */
async function syncBalances(
  config: PipelineConfig,
  client: TzktClient,
  storage: Storage,
  startISO: string
): Promise<number> {
  console.log('\n--- Syncing Wallet Balances ---');
  
  const addressesNeedingBalance = storage.getAddressesWithoutBalance();
  console.log(`Addresses needing balance: ${addressesNeedingBalance.length}`);
  
  if (addressesNeedingBalance.length === 0) {
    console.log(`All balances already synced (${storage.getRawBalanceCount()} in database)`);
    return 0;
  }
  
  const limit = pLimit(config.maxConcurrency);
  let syncedCount = 0;
  let failedCount = 0;
  
  const promises = addressesNeedingBalance.map(address =>
    limit(async () => {
      try {
        const balance = await client.getBalanceAtTime(address, startISO);
        storage.insertRawBalance(address, balance, startISO);
        syncedCount++;
        
        if (syncedCount % 100 === 0) {
          console.log(`  Synced ${syncedCount}/${addressesNeedingBalance.length} balances...`);
          storage.save(); // Periodic save
        }
      } catch (error) {
        failedCount++;
        storage.insertRawBalance(address, null, startISO);
      }
    })
  );
  
  await Promise.all(promises);
  storage.save();
  
  console.log(`Synced ${syncedCount} balances (${failedCount} failed)`);
  console.log(`Total in database: ${storage.getRawBalanceCount()}`);
  
  return syncedCount;
}

/**
 * Sync XTZ transfers for tracked wallets (for CEX flow analysis)
 */
async function syncXtzTransfers(
  config: PipelineConfig,
  client: TzktClient,
  storage: Storage,
  startISO: string,
  endISO: string
): Promise<number> {
  console.log('\n--- Syncing XTZ Transfers (for CEX tracking) ---');
  
  // Get all known buyer and seller addresses
  const buyers = storage.getAllBuyers();
  const creators = storage.getAllCreators();
  const trackedAddresses = new Set([...buyers, ...creators]);
  
  console.log(`Tracked addresses: ${trackedAddresses.size}`);
  
  if (trackedAddresses.size === 0) {
    console.log('No addresses to track. Run analyze first to identify buyers/creators.');
    return 0;
  }
  
  const lastId = storage.getMaxRawXtzTransferId();
  console.log(`Last synced XTZ transfer ID: ${lastId ?? 'none'}`);
  
  let syncedCount = 0;
  let batchBuffer: RawXtzTransfer[] = [];
  const BATCH_SIZE = 500;
  
  // Sync XTZ transfers where tracked addresses are sender or target
  // We need to query in batches by address since TzKT doesn't support OR on sender/target
  const limit = pLimit(config.maxConcurrency);
  const addressList = Array.from(trackedAddresses);
  
  console.log(`Fetching XTZ transfers for ${addressList.length} addresses...`);
  
  // Process in chunks to avoid overwhelming the API
  const CHUNK_SIZE = 50;
  for (let i = 0; i < addressList.length; i += CHUNK_SIZE) {
    const chunk = addressList.slice(i, i + CHUNK_SIZE);
    
    const promises = chunk.map(address =>
      limit(async () => {
        try {
          // Get incoming transfers (address is target)
          const incomingUrl = `${config.tzktBaseUrl}/operations/transactions?target=${address}&timestamp.ge=${startISO}&timestamp.lt=${endISO}&status=applied&amount.gt=0&limit=1000&select=id,hash,timestamp,sender,target,amount`;
          const incomingResponse = await fetch(incomingUrl);
          const incoming = await incomingResponse.json() as any[];
          
          for (const tx of incoming) {
            if (lastId !== null && tx.id <= lastId) continue;
            
            const transfer: RawXtzTransfer = {
              id: tx.id,
              hash: tx.hash,
              timestamp: tx.timestamp,
              sender: tx.sender?.address || tx.sender,
              target: tx.target?.address || tx.target,
              amount: tx.amount,
              is_from_cex: isCexAddress(config, tx.sender?.address || tx.sender),
              is_to_cex: false
            };
            batchBuffer.push(transfer);
          }
          
          // Get outgoing transfers (address is sender)
          const outgoingUrl = `${config.tzktBaseUrl}/operations/transactions?sender=${address}&timestamp.ge=${startISO}&timestamp.lt=${endISO}&status=applied&amount.gt=0&limit=1000&select=id,hash,timestamp,sender,target,amount`;
          const outgoingResponse = await fetch(outgoingUrl);
          const outgoing = await outgoingResponse.json() as any[];
          
          for (const tx of outgoing) {
            if (lastId !== null && tx.id <= lastId) continue;
            
            const transfer: RawXtzTransfer = {
              id: tx.id,
              hash: tx.hash,
              timestamp: tx.timestamp,
              sender: tx.sender?.address || tx.sender,
              target: tx.target?.address || tx.target,
              amount: tx.amount,
              is_from_cex: false,
              is_to_cex: isCexAddress(config, tx.target?.address || tx.target)
            };
            batchBuffer.push(transfer);
          }
          
          // Flush batch if large enough
          if (batchBuffer.length >= BATCH_SIZE) {
            storage.insertRawXtzTransfersBatch(batchBuffer);
            syncedCount += batchBuffer.length;
            batchBuffer = [];
          }
        } catch (error) {
          // Skip failed addresses
        }
      })
    );
    
    await Promise.all(promises);
    console.log(`  Processed ${Math.min(i + CHUNK_SIZE, addressList.length)}/${addressList.length} addresses...`);
  }
  
  // Flush remaining
  if (batchBuffer.length > 0) {
    storage.insertRawXtzTransfersBatch(batchBuffer);
    syncedCount += batchBuffer.length;
  }
  
  console.log(`Synced ${syncedCount} XTZ transfers`);
  console.log(`Total in database: ${storage.getRawXtzTransferCount()}`);
  
  return syncedCount;
}

/**
 * Convert TzKT transaction to AllTransactionRow format
 */
function txToAllTransaction(tx: TzktTransaction): AllTransactionRow {
  return {
    id: tx.id,
    hash: tx.hash,
    level: tx.level,
    timestamp: tx.timestamp,
    sender: tx.sender.address,
    target: tx.target?.address || null,
    amount: tx.amount,
    entrypoint: tx.parameter?.entrypoint || null,
    parameters: tx.parameter?.value ? JSON.stringify(tx.parameter.value) : null,
    status: tx.status,
    tx_category: null, // Will be classified later
    is_internal: tx.hasInternals
  };
}

/**
 * Convert TzKT transaction to XtzFlowRow format
 */
function txToXtzFlow(tx: TzktTransaction): XtzFlowRow {
  const sender = tx.sender.address;
  const target = tx.target?.address || '';
  
  // Determine flow type based on sender/target
  let flowType: string = 'p2p';
  
  if (KNOWN_CEX_ADDRESSES.includes(sender)) {
    flowType = 'cex_withdrawal';
  } else if (KNOWN_CEX_ADDRESSES.includes(target)) {
    flowType = 'cex_deposit';
  } else if (isBridgeAddress(target)) {
    flowType = 'bridge_to_l2';
  } else if (isBridgeAddress(sender)) {
    flowType = 'bridge_from_l2';
  } else if (target.startsWith('KT1')) {
    flowType = 'contract';
  }
  
  return {
    id: tx.id,
    hash: tx.hash,
    timestamp: tx.timestamp,
    sender,
    target,
    amount_mutez: tx.amount,
    flow_type: flowType
  };
}

/**
 * Sync ALL transactions from TzKT (comprehensive)
 * WARNING: This pulls a LOT of data - can be millions of transactions for a month
 */
async function syncAllTransactionsComprehensive(
  config: PipelineConfig,
  client: TzktClient,
  storage: Storage,
  startISO: string,
  endISO: string
): Promise<number> {
  console.log('\n--- Syncing ALL Transactions (Comprehensive) ---');
  console.log('WARNING: This may take a long time and use significant disk space.');
  
  const lastId = storage.getMaxAllTransactionId();
  console.log(`Last synced transaction ID: ${lastId ?? 'none'}`);
  
  let syncedCount = 0;
  let batchBuffer: AllTransactionRow[] = [];
  const BATCH_SIZE = 1000;
  
  for await (const batch of client.getAllTransactions(startISO, endISO, lastId || 0)) {
    for (const tx of batch) {
      batchBuffer.push(txToAllTransaction(tx));
      
      if (batchBuffer.length >= BATCH_SIZE) {
        for (const row of batchBuffer) {
          storage.insertAllTransaction(row);
        }
        syncedCount += batchBuffer.length;
        console.log(`  Synced ${syncedCount} transactions...`);
        storage.save();
        batchBuffer = [];
      }
    }
  }
  
  // Flush remaining
  if (batchBuffer.length > 0) {
    for (const row of batchBuffer) {
      storage.insertAllTransaction(row);
    }
    syncedCount += batchBuffer.length;
    storage.save();
  }
  
  console.log(`Synced ${syncedCount} new transactions`);
  console.log(`Total in database: ${storage.getAllTransactionsCount()}`);
  
  return syncedCount;
}

/**
 * Sync ALL XTZ transfers/flows (comprehensive)
 */
async function syncAllXtzFlows(
  config: PipelineConfig,
  client: TzktClient,
  storage: Storage,
  startISO: string,
  endISO: string
): Promise<number> {
  console.log('\n--- Syncing ALL XTZ Flows ---');
  
  const lastId = storage.getMaxXtzFlowId();
  console.log(`Last synced XTZ flow ID: ${lastId ?? 'none'}`);
  
  let syncedCount = 0;
  let batchBuffer: XtzFlowRow[] = [];
  const BATCH_SIZE = 1000;
  
  for await (const batch of client.getAllXtzTransfers(startISO, endISO, lastId || 0)) {
    for (const tx of batch) {
      batchBuffer.push(txToXtzFlow(tx));
      
      if (batchBuffer.length >= BATCH_SIZE) {
        for (const row of batchBuffer) {
          storage.insertXtzFlow(row);
        }
        syncedCount += batchBuffer.length;
        console.log(`  Synced ${syncedCount} XTZ flows...`);
        storage.save();
        batchBuffer = [];
      }
    }
  }
  
  // Flush remaining
  if (batchBuffer.length > 0) {
    for (const row of batchBuffer) {
      storage.insertXtzFlow(row);
    }
    syncedCount += batchBuffer.length;
    storage.save();
  }
  
  console.log(`Synced ${syncedCount} new XTZ flows`);
  console.log(`Total in database: ${storage.getXtzFlowsCount()}`);
  
  return syncedCount;
}

/**
 * Main sync function - pulls all data from TzKT
 */
export async function syncAllData(
  config: PipelineConfig,
  storage: Storage,
  includeXtzTransfers: boolean = false
): Promise<{ transactions: number; transfers: number; balances: number; xtzTransfers: number }> {
  console.log('='.repeat(60));
  console.log('DATA SYNC - Pulling from TzKT API');
  console.log('='.repeat(60));
  
  const window = getTimeWindow(config);
  console.log(`\nTime Window: ${window.startISO} to ${window.endISO}`);
  
  const client = new TzktClient(config);
  const startTime = Date.now();
  
  const txCount = await syncMarketplaceTransactions(
    config, client, storage, window.startISO, window.endISO
  );
  
  const transferCount = await syncTokenTransfers(
    config, client, storage, window.startISO, window.endISO
  );
  
  const balanceCount = await syncBalances(
    config, client, storage, window.startISO
  );
  
  // XTZ transfers require buyer/creator data, so only sync if requested
  // and after initial analysis has been run
  let xtzTransferCount = 0;
  if (includeXtzTransfers) {
    xtzTransferCount = await syncXtzTransfers(
      config, client, storage, window.startISO, window.endISO
    );
  }
  
  storage.setSyncMetadata('lastSyncTime', new Date().toISOString());
  storage.setSyncMetadata('windowStart', window.startISO);
  storage.setSyncMetadata('windowEnd', window.endISO);
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const apiStats = client.getStats();
  
  console.log('\n' + '='.repeat(60));
  console.log('SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`Time elapsed: ${elapsed}s`);
  console.log(`API requests: ${apiStats.requestCount}`);
  console.log(`\nDatabase totals:`);
  console.log(`  Transactions: ${storage.getRawTransactionCount()}`);
  console.log(`  Token transfers: ${storage.getRawTokenTransferCount()}`);
  console.log(`  Balances: ${storage.getRawBalanceCount()}`);
  console.log(`  XTZ transfers: ${storage.getRawXtzTransferCount()}`);
  
  return {
    transactions: txCount,
    transfers: transferCount,
    balances: balanceCount,
    xtzTransfers: xtzTransferCount
  };
}

/**
 * Sync only XTZ transfers (requires analyze to be run first)
 */
export async function syncXtzTransfersOnly(
  config: PipelineConfig,
  storage: Storage
): Promise<number> {
  console.log('='.repeat(60));
  console.log('XTZ TRANSFER SYNC - For CEX Flow Analysis');
  console.log('='.repeat(60));
  
  const window = getTimeWindow(config);
  const client = new TzktClient(config);
  
  const count = await syncXtzTransfers(
    config, client, storage, window.startISO, window.endISO
  );
  
  return count;
}

/**
 * Comprehensive sync - pull ALL transactions and XTZ flows
 * This is for full chain analysis, not just NFT marketplace activity
 */
export async function syncAllComprehensive(
  config: PipelineConfig,
  storage: Storage
): Promise<{ allTransactions: number; xtzFlows: number }> {
  console.log('='.repeat(60));
  console.log('COMPREHENSIVE SYNC - ALL Tezos Activity');
  console.log('WARNING: This pulls ALL transactions and may take hours!');
  console.log('='.repeat(60));
  
  const window = getTimeWindow(config);
  console.log(`\nTime Window: ${window.startISO} to ${window.endISO}`);
  
  const client = new TzktClient(config);
  const startTime = Date.now();
  
  // Sync all transactions
  const allTxCount = await syncAllTransactionsComprehensive(
    config, client, storage, window.startISO, window.endISO
  );
  
  // Sync all XTZ flows
  const xtzFlowCount = await syncAllXtzFlows(
    config, client, storage, window.startISO, window.endISO
  );
  
  storage.setSyncMetadata('comprehensiveSyncTime', new Date().toISOString());
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const apiStats = client.getStats();
  
  console.log('\n' + '='.repeat(60));
  console.log('COMPREHENSIVE SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`Time elapsed: ${elapsed}s`);
  console.log(`API requests: ${apiStats.requestCount}`);
  console.log(`\nDatabase totals:`);
  console.log(`  All transactions: ${storage.getAllTransactionsCount()}`);
  console.log(`  XTZ flows: ${storage.getXtzFlowsCount()}`);
  
  return {
    allTransactions: allTxCount,
    xtzFlows: xtzFlowCount
  };
}

// ==================== WEEKLY SYNC SYSTEM ====================

// Weekly sync definitions for January 2026
export const SYNC_WEEKS = [
  { id: 'week1', start: '2026-01-01T00:00:00Z', end: '2026-01-08T00:00:00Z', label: 'Jan 1-7' },
  { id: 'week2', start: '2026-01-08T00:00:00Z', end: '2026-01-15T00:00:00Z', label: 'Jan 8-14' },
  { id: 'week3', start: '2026-01-15T00:00:00Z', end: '2026-01-22T00:00:00Z', label: 'Jan 15-21' },
  { id: 'week4', start: '2026-01-22T00:00:00Z', end: '2026-01-29T00:00:00Z', label: 'Jan 22-28' },
  { id: 'week5', start: '2026-01-29T00:00:00Z', end: '2026-02-01T00:00:00Z', label: 'Jan 29-31' },
];

/**
 * Initialize weekly sync progress tracking
 */
export function initializeWeeklySyncProgress(storage: Storage): void {
  storage.initializeSyncWeeks(SYNC_WEEKS.map(w => ({ id: w.id, start: w.start, end: w.end })));
}

/**
 * Sync a specific week's comprehensive data
 */
export async function syncWeek(
  config: PipelineConfig,
  storage: Storage,
  weekId: string
): Promise<{ allTransactions: number; xtzFlows: number }> {
  const week = SYNC_WEEKS.find(w => w.id === weekId);
  if (!week) {
    throw new Error(`Unknown week: ${weekId}. Valid weeks: ${SYNC_WEEKS.map(w => w.id).join(', ')}`);
  }
  
  // Check if already complete
  const progress = storage.getSyncProgress(weekId);
  if (progress?.status === 'complete') {
    console.log(`Week ${weekId} (${week.label}) is already complete.`);
    console.log(`  Transactions: ${progress.all_tx_count}`);
    console.log(`  XTZ Flows: ${progress.xtz_flow_count}`);
    return { allTransactions: progress.all_tx_count, xtzFlows: progress.xtz_flow_count };
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`WEEKLY SYNC: ${week.label} (${weekId})`);
  console.log('='.repeat(60));
  console.log(`Date Range: ${week.start} to ${week.end}`);
  
  // Mark as in progress
  storage.updateSyncProgress(weekId, 'in_progress');
  
  const client = new TzktClient(config);
  const startTime = Date.now();
  
  try {
    // Sync all transactions for this week
    console.log('\n--- Syncing Transactions ---');
    const allTxCount = await syncAllTransactionsComprehensive(
      config, client, storage, week.start, week.end
    );
    
    // Sync all XTZ flows for this week
    console.log('\n--- Syncing XTZ Flows ---');
    const xtzFlowCount = await syncAllXtzFlows(
      config, client, storage, week.start, week.end
    );
    
    // Mark as complete
    storage.updateSyncProgress(weekId, 'complete', allTxCount, xtzFlowCount);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const apiStats = client.getStats();
    
    console.log('\n' + '='.repeat(60));
    console.log(`WEEK ${weekId.toUpperCase()} SYNC COMPLETE`);
    console.log('='.repeat(60));
    console.log(`Time elapsed: ${elapsed}s`);
    console.log(`API requests: ${apiStats.requestCount}`);
    console.log(`Transactions synced: ${allTxCount}`);
    console.log(`XTZ flows synced: ${xtzFlowCount}`);
    
    return { allTransactions: allTxCount, xtzFlows: xtzFlowCount };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    storage.updateSyncProgress(weekId, 'error', 0, 0, errorMsg);
    throw error;
  }
}

/**
 * Print weekly sync status
 */
export function printWeeklySyncStatus(storage: Storage): void {
  // Initialize weeks if not already done
  initializeWeeklySyncProgress(storage);
  
  const progress = storage.getAllSyncProgress();
  const summary = storage.getSyncSummary();
  
  console.log('\n' + '='.repeat(60));
  console.log('WEEKLY SYNC STATUS');
  console.log('='.repeat(60));
  
  console.log(`\nOverall Progress: ${summary.complete}/${summary.total} weeks complete`);
  console.log('');
  
  for (const week of SYNC_WEEKS) {
    const p = progress.find(pr => pr.week_id === week.id);
    const status = p?.status || 'pending';
    const statusIcon = status === 'complete' ? '[DONE]' : 
                       status === 'in_progress' ? '[....]' : 
                       status === 'error' ? '[FAIL]' : '[    ]';
    
    let details = '';
    if (p?.status === 'complete') {
      details = `${p.all_tx_count.toLocaleString()} txs, ${p.xtz_flow_count.toLocaleString()} flows`;
    } else if (p?.status === 'error') {
      details = p.error_message || 'Unknown error';
    }
    
    console.log(`  ${statusIcon} ${week.id}: ${week.label.padEnd(12)} ${details}`);
  }
  
  console.log('\nCommands:');
  console.log('  npm run sync-week week1    # Sync specific week');
  console.log('  npm run sync-week all      # Sync all incomplete weeks');
}

/**
 * Sync all incomplete weeks
 */
export async function syncAllIncompleteWeeks(
  config: PipelineConfig,
  storage: Storage
): Promise<void> {
  // Initialize weeks if not already done
  initializeWeeklySyncProgress(storage);
  
  const incomplete = storage.getIncompleteWeeks();
  
  if (incomplete.length === 0) {
    console.log('All weeks are already synced!');
    return;
  }
  
  console.log(`\nSyncing ${incomplete.length} incomplete week(s)...`);
  
  for (const week of incomplete) {
    try {
      await syncWeek(config, storage, week.week_id);
    } catch (error) {
      console.error(`Failed to sync ${week.week_id}:`, error);
      // Continue with next week
    }
  }
}

/**
 * Check sync status
 */
export function getSyncStatus(storage: Storage): {
  lastSync: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  transactions: number;
  transfers: number;
  balances: number;
  xtzTransfers: number;
} {
  return {
    lastSync: storage.getSyncMetadata('lastSyncTime'),
    windowStart: storage.getSyncMetadata('windowStart'),
    windowEnd: storage.getSyncMetadata('windowEnd'),
    transactions: storage.getRawTransactionCount(),
    transfers: storage.getRawTokenTransferCount(),
    balances: storage.getRawBalanceCount(),
    xtzTransfers: storage.getRawXtzTransferCount()
  };
}
