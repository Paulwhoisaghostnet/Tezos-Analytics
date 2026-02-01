/**
 * SQLite Storage Layer using sql.js (pure JavaScript, no native modules)
 * Schema for raw data sync + derived analytics
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

// ==================== RAW DATA TYPES ====================

export interface RawTransaction {
  id: number;
  hash: string;
  level: number;
  timestamp: string;
  sender: string;
  target: string;
  amount: number;
  entrypoint: string | null;
  parameters: string | null;
  status: string;
  has_internals: boolean;
}

export interface RawTokenTransfer {
  id: number;
  level: number;
  timestamp: string;
  token_contract: string;
  token_id: string;
  token_standard: string;
  from_address: string | null;
  to_address: string | null;
  amount: string;
  transaction_id: number | null;
}

// ==================== DERIVED DATA TYPES ====================

export interface BuyerRow {
  address: string;
}

export interface BuyerBalanceRow {
  address: string;
  balance_mutez: number | null;
  ts: string;
}

export interface PurchaseRow {
  id?: number;
  op_hash: string;
  ts: string;
  buyer: string;
  seller: string | null;
  marketplace: string;
  token_contract: string;
  token_id: string;
  qty: number;
  spend_mutez: number | null;
  kind: 'listing_purchase' | 'offer_accept_purchase' | 'open_edition';
}

export interface CreatorRow {
  address: string;
}

export interface MintRow {
  id?: number;
  op_hash: string;
  ts: string;
  creator: string;
  token_contract: string;
  token_id: string;
  qty: number;
}

export interface ListingRow {
  id?: number;
  op_hash: string;
  ts: string;
  creator: string;
  marketplace: string;
  token_contract: string;
  token_id: string;
  qty: number;
  list_price_mutez: number | null;
}

export interface OfferAcceptRow {
  id?: number;
  op_hash: string;
  ts: string;
  creator_seller: string;
  buyer_offer: string | null;
  marketplace: string;
  token_contract: string;
  token_id: string;
  qty: number;
  accepted_price_mutez: number | null;
  reference_list_price_mutez: number | null;
  under_list: boolean | null;
}

export interface ResaleRow {
  id?: number;
  op_hash: string;
  ts: string;
  seller_collector: string;
  buyer: string | null;
  marketplace: string;
  token_contract: string;
  token_id: string;
  qty: number;
  proceeds_mutez: number | null;
}

// ==================== NEW ANALYTICS TYPES ====================

export interface RawXtzTransfer {
  id: number;
  hash: string;
  timestamp: string;
  sender: string;
  target: string;
  amount: number;
  is_from_cex: boolean;
  is_to_cex: boolean;
}

export interface DailyMetricsRow {
  date: string;
  total_volume_mutez: number;
  avg_sale_price_mutez: number | null;
  sale_count: number;
  unique_buyers: number;
  unique_sellers: number;
}

export interface MarketplaceStatsRow {
  marketplace: string;
  sale_count: number;
  volume_mutez: number;
  volume_percent: number | null;
  estimated_fees_mutez: number;
}

export interface DailyMarketplaceFeesRow {
  date: string;
  marketplace: string;
  volume_mutez: number;
  fees_mutez: number;
  sale_count: number;
}

export interface BuyerCexFlowRow {
  address: string;
  has_cex_funding: boolean;
  cex_funding_mutez: number;
  is_sales_only: boolean;
  total_received_mutez: number;
  total_from_sales_mutez: number;
}

export interface CreatorFundFlowRow {
  address: string;
  total_sales_mutez: number;
  sent_to_cex_mutez: number;
  spent_on_nfts_mutez: number;
  cashed_out: boolean;
  bought_nfts: boolean;
}

export interface ContractMetadataRow {
  address: string;
  is_fungible: boolean;
  token_type: string | null; // 'fa1.2', 'fa2', 'nft', etc.
  alias: string | null;
  checked_at: string;
}

export interface AddressRegistryRow {
  address: string;
  address_type: 'wallet' | 'contract' | 'cex' | 'marketplace' | 'bridge';
  alias: string | null;
  tezos_domain: string | null;
  owned_domains: string | null; // JSON array
  category: string | null; // 'nft_marketplace', 'defi', 'bridge', 'cex', 'creator', 'collector', 'unknown'
  tx_count: number;
  metadata: string | null; // JSON
  resolved_at: string | null;
}

export interface AllTransactionRow {
  id: number;
  hash: string;
  level: number;
  timestamp: string;
  sender: string;
  target: string | null;
  amount: number;
  entrypoint: string | null;
  parameters: string | null;
  status: string;
  tx_category: string | null;
  is_internal: boolean;
}

export interface XtzFlowRow {
  id: number;
  hash: string;
  timestamp: string;
  sender: string;
  target: string;
  amount_mutez: number;
  flow_type: string | null;
}

export interface WalletXtzSummaryRow {
  address: string;
  balance_start_mutez: number | null;
  balance_end_mutez: number | null;
  total_received_mutez: number;
  total_sent_mutez: number;
  received_from_sales_mutez: number;
  spent_on_nfts_mutez: number;
  sent_to_cex_mutez: number;
  received_from_cex_mutez: number;
  sent_to_l2_mutez: number;
  received_from_l2_mutez: number;
}

export interface SyncProgressRow {
  week_id: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'in_progress' | 'complete' | 'error';
  all_tx_count: number;
  xtz_flow_count: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

/**
 * Storage class for managing SQLite database
 */
export class Storage {
  private db: SqlJsDatabase;
  private dbPath: string;

  private constructor(db: SqlJsDatabase, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  /**
   * Create/open a storage instance (async factory)
   */
  static async create(dbPath: string): Promise<Storage> {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const SQL = await initSqlJs();
    
    let db: SqlJsDatabase;
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    const storage = new Storage(db, dbPath);
    storage.initSchema();
    return storage;
  }

  /**
   * Initialize database schema
   */
  private initSchema(): void {
    this.db.run(`
      -- RAW DATA TABLES
      CREATE TABLE IF NOT EXISTS raw_transactions (
        id INTEGER PRIMARY KEY,
        hash TEXT NOT NULL,
        level INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        sender TEXT NOT NULL,
        target TEXT NOT NULL,
        amount INTEGER NOT NULL DEFAULT 0,
        entrypoint TEXT,
        parameters TEXT,
        status TEXT NOT NULL,
        has_internals INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_raw_tx_hash ON raw_transactions(hash);
      CREATE INDEX IF NOT EXISTS idx_raw_tx_target ON raw_transactions(target);
      CREATE INDEX IF NOT EXISTS idx_raw_tx_sender ON raw_transactions(sender);
      CREATE INDEX IF NOT EXISTS idx_raw_tx_entrypoint ON raw_transactions(entrypoint);
      CREATE INDEX IF NOT EXISTS idx_raw_tx_timestamp ON raw_transactions(timestamp);

      CREATE TABLE IF NOT EXISTS raw_token_transfers (
        id INTEGER PRIMARY KEY,
        level INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        token_contract TEXT NOT NULL,
        token_id TEXT NOT NULL,
        token_standard TEXT NOT NULL,
        from_address TEXT,
        to_address TEXT,
        amount TEXT NOT NULL,
        transaction_id INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_raw_transfer_tx ON raw_token_transfers(transaction_id);
      CREATE INDEX IF NOT EXISTS idx_raw_transfer_from ON raw_token_transfers(from_address);
      CREATE INDEX IF NOT EXISTS idx_raw_transfer_to ON raw_token_transfers(to_address);
      CREATE INDEX IF NOT EXISTS idx_raw_transfer_token ON raw_token_transfers(token_contract, token_id);
      CREATE INDEX IF NOT EXISTS idx_raw_transfer_timestamp ON raw_token_transfers(timestamp);

      CREATE TABLE IF NOT EXISTS raw_balances (
        address TEXT PRIMARY KEY,
        balance_mutez INTEGER,
        snapshot_ts TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- DERIVED DATA TABLES
      CREATE TABLE IF NOT EXISTS buyers (
        address TEXT PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS buyer_balance_start (
        address TEXT PRIMARY KEY,
        balance_mutez INTEGER,
        ts TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        op_hash TEXT NOT NULL,
        ts TEXT NOT NULL,
        buyer TEXT NOT NULL,
        seller TEXT,
        marketplace TEXT NOT NULL,
        token_contract TEXT NOT NULL,
        token_id TEXT NOT NULL,
        qty INTEGER NOT NULL DEFAULT 1,
        spend_mutez INTEGER,
        kind TEXT NOT NULL CHECK (kind IN ('listing_purchase', 'offer_accept_purchase', 'open_edition')),
        UNIQUE(op_hash, buyer, token_contract, token_id)
      );
      CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON purchases(buyer);
      CREATE INDEX IF NOT EXISTS idx_purchases_ts ON purchases(ts);

      CREATE TABLE IF NOT EXISTS creators (
        address TEXT PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS mints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        op_hash TEXT NOT NULL,
        ts TEXT NOT NULL,
        creator TEXT NOT NULL,
        token_contract TEXT NOT NULL,
        token_id TEXT NOT NULL,
        qty INTEGER NOT NULL DEFAULT 1,
        UNIQUE(op_hash, token_contract, token_id)
      );
      CREATE INDEX IF NOT EXISTS idx_mints_creator ON mints(creator);
      CREATE INDEX IF NOT EXISTS idx_mints_ts ON mints(ts);

      CREATE TABLE IF NOT EXISTS listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        op_hash TEXT NOT NULL,
        ts TEXT NOT NULL,
        creator TEXT NOT NULL,
        marketplace TEXT NOT NULL,
        token_contract TEXT NOT NULL,
        token_id TEXT NOT NULL,
        qty INTEGER NOT NULL DEFAULT 1,
        list_price_mutez INTEGER,
        UNIQUE(op_hash, token_contract, token_id)
      );
      CREATE INDEX IF NOT EXISTS idx_listings_creator ON listings(creator);
      CREATE INDEX IF NOT EXISTS idx_listings_token ON listings(token_contract, token_id);
      CREATE INDEX IF NOT EXISTS idx_listings_ts ON listings(ts);

      CREATE TABLE IF NOT EXISTS offer_accepts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        op_hash TEXT NOT NULL,
        ts TEXT NOT NULL,
        creator_seller TEXT NOT NULL,
        buyer_offer TEXT,
        marketplace TEXT NOT NULL,
        token_contract TEXT NOT NULL,
        token_id TEXT NOT NULL,
        qty INTEGER NOT NULL DEFAULT 1,
        accepted_price_mutez INTEGER,
        reference_list_price_mutez INTEGER,
        under_list INTEGER,
        UNIQUE(op_hash, token_contract, token_id)
      );
      CREATE INDEX IF NOT EXISTS idx_offer_accepts_seller ON offer_accepts(creator_seller);
      CREATE INDEX IF NOT EXISTS idx_offer_accepts_ts ON offer_accepts(ts);

      CREATE TABLE IF NOT EXISTS resales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        op_hash TEXT NOT NULL,
        ts TEXT NOT NULL,
        seller_collector TEXT NOT NULL,
        buyer TEXT,
        marketplace TEXT NOT NULL,
        token_contract TEXT NOT NULL,
        token_id TEXT NOT NULL,
        qty INTEGER NOT NULL DEFAULT 1,
        proceeds_mutez INTEGER,
        UNIQUE(op_hash, seller_collector, token_contract, token_id)
      );
      CREATE INDEX IF NOT EXISTS idx_resales_seller ON resales(seller_collector);
      CREATE INDEX IF NOT EXISTS idx_resales_ts ON resales(ts);

      CREATE TABLE IF NOT EXISTS pipeline_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- ==================== NEW ANALYTICS TABLES ====================

      -- Raw XTZ transfers (for CEX flow tracking)
      CREATE TABLE IF NOT EXISTS raw_xtz_transfers (
        id INTEGER PRIMARY KEY,
        hash TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        sender TEXT NOT NULL,
        target TEXT NOT NULL,
        amount INTEGER NOT NULL,
        is_from_cex INTEGER NOT NULL DEFAULT 0,
        is_to_cex INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_xtz_sender ON raw_xtz_transfers(sender);
      CREATE INDEX IF NOT EXISTS idx_xtz_target ON raw_xtz_transfers(target);
      CREATE INDEX IF NOT EXISTS idx_xtz_timestamp ON raw_xtz_transfers(timestamp);

      -- Daily metrics aggregates
      CREATE TABLE IF NOT EXISTS daily_metrics (
        date TEXT PRIMARY KEY,
        total_volume_mutez INTEGER NOT NULL DEFAULT 0,
        avg_sale_price_mutez REAL,
        sale_count INTEGER NOT NULL DEFAULT 0,
        unique_buyers INTEGER NOT NULL DEFAULT 0,
        unique_sellers INTEGER NOT NULL DEFAULT 0
      );

      -- Marketplace stats (aggregate totals)
      CREATE TABLE IF NOT EXISTS marketplace_stats (
        marketplace TEXT PRIMARY KEY,
        sale_count INTEGER NOT NULL DEFAULT 0,
        volume_mutez INTEGER NOT NULL DEFAULT 0,
        volume_percent REAL,
        estimated_fees_mutez INTEGER NOT NULL DEFAULT 0
      );

      -- Daily marketplace fees
      CREATE TABLE IF NOT EXISTS daily_marketplace_fees (
        date TEXT NOT NULL,
        marketplace TEXT NOT NULL,
        volume_mutez INTEGER NOT NULL DEFAULT 0,
        fees_mutez INTEGER NOT NULL DEFAULT 0,
        sale_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (date, marketplace)
      );

      -- Buyer CEX flow tracking
      CREATE TABLE IF NOT EXISTS buyer_cex_flow (
        address TEXT PRIMARY KEY,
        has_cex_funding INTEGER NOT NULL DEFAULT 0,
        cex_funding_mutez INTEGER NOT NULL DEFAULT 0,
        is_sales_only INTEGER NOT NULL DEFAULT 0,
        total_received_mutez INTEGER NOT NULL DEFAULT 0,
        total_from_sales_mutez INTEGER NOT NULL DEFAULT 0
      );

      -- Creator fund flow tracking
      CREATE TABLE IF NOT EXISTS creator_fund_flow (
        address TEXT PRIMARY KEY,
        total_sales_mutez INTEGER NOT NULL DEFAULT 0,
        sent_to_cex_mutez INTEGER NOT NULL DEFAULT 0,
        spent_on_nfts_mutez INTEGER NOT NULL DEFAULT 0,
        cashed_out INTEGER NOT NULL DEFAULT 0,
        bought_nfts INTEGER NOT NULL DEFAULT 0
      );

      -- Contract metadata cache (for fungible vs NFT detection)
      CREATE TABLE IF NOT EXISTS contract_metadata (
        address TEXT PRIMARY KEY,
        is_fungible INTEGER NOT NULL DEFAULT 0,
        token_type TEXT,
        alias TEXT,
        checked_at TEXT NOT NULL
      );

      -- Address registry (wallets and contracts with identity info)
      CREATE TABLE IF NOT EXISTS address_registry (
        address TEXT PRIMARY KEY,
        address_type TEXT NOT NULL, -- 'wallet', 'contract', 'cex', 'marketplace', 'bridge'
        alias TEXT,
        tezos_domain TEXT,
        owned_domains TEXT, -- JSON array
        category TEXT, -- 'nft_marketplace', 'defi', 'bridge', 'cex', 'creator', 'collector', 'unknown'
        tx_count INTEGER DEFAULT 0,
        metadata TEXT, -- JSON for additional info
        resolved_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_address_registry_type ON address_registry(address_type);
      CREATE INDEX IF NOT EXISTS idx_address_registry_category ON address_registry(category);

      -- All transactions (comprehensive, not just marketplace)
      CREATE TABLE IF NOT EXISTS all_transactions (
        id INTEGER PRIMARY KEY,
        hash TEXT NOT NULL,
        level INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        sender TEXT NOT NULL,
        target TEXT,
        amount INTEGER NOT NULL DEFAULT 0,
        entrypoint TEXT,
        parameters TEXT,
        status TEXT NOT NULL,
        tx_category TEXT, -- 'nft_sale', 'defi', 'xtz_transfer', 'bridge', 'delegation', 'other'
        is_internal INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_all_tx_hash ON all_transactions(hash);
      CREATE INDEX IF NOT EXISTS idx_all_tx_sender ON all_transactions(sender);
      CREATE INDEX IF NOT EXISTS idx_all_tx_target ON all_transactions(target);
      CREATE INDEX IF NOT EXISTS idx_all_tx_timestamp ON all_transactions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_all_tx_category ON all_transactions(tx_category);

      -- XTZ transfers with flow classification
      CREATE TABLE IF NOT EXISTS xtz_flows (
        id INTEGER PRIMARY KEY,
        hash TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        sender TEXT NOT NULL,
        target TEXT NOT NULL,
        amount_mutez INTEGER NOT NULL,
        flow_type TEXT -- 'cex_deposit', 'cex_withdrawal', 'bridge_to_l2', 'bridge_from_l2', 'nft_sale', 'nft_purchase', 'p2p', 'contract'
      );
      CREATE INDEX IF NOT EXISTS idx_xtz_flows_sender ON xtz_flows(sender);
      CREATE INDEX IF NOT EXISTS idx_xtz_flows_target ON xtz_flows(target);
      CREATE INDEX IF NOT EXISTS idx_xtz_flows_type ON xtz_flows(flow_type);

      -- Wallet XTZ summary (aggregated flow stats)
      CREATE TABLE IF NOT EXISTS wallet_xtz_summary (
        address TEXT PRIMARY KEY,
        balance_start_mutez INTEGER, -- Balance at window start
        balance_end_mutez INTEGER, -- Balance at window end
        total_received_mutez INTEGER DEFAULT 0,
        total_sent_mutez INTEGER DEFAULT 0,
        received_from_sales_mutez INTEGER DEFAULT 0,
        spent_on_nfts_mutez INTEGER DEFAULT 0,
        sent_to_cex_mutez INTEGER DEFAULT 0,
        received_from_cex_mutez INTEGER DEFAULT 0,
        sent_to_l2_mutez INTEGER DEFAULT 0,
        received_from_l2_mutez INTEGER DEFAULT 0
      );

      -- Weekly sync progress tracking
      CREATE TABLE IF NOT EXISTS sync_progress (
        week_id TEXT PRIMARY KEY,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        all_tx_count INTEGER DEFAULT 0,
        xtz_flow_count INTEGER DEFAULT 0,
        started_at TEXT,
        completed_at TEXT,
        error_message TEXT
      );
    `);
    this.save();
  }

  /**
   * Save database to disk
   */
  save(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  /**
   * Close database
   */
  close(): void {
    this.save();
    this.db.close();
  }

  // Helper to run query and get results
  query<T>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  // Helper to run a single statement
  private run(sql: string, params: any[] = []): void {
    this.db.run(sql, params);
  }

  // Helper to get single value (public for API usage)
  getValue<T>(sql: string, params: any[] = []): T | null {
    const results = this.query<any>(sql, params);
    if (results.length > 0) {
      const keys = Object.keys(results[0]);
      return results[0][keys[0]] as T;
    }
    return null;
  }

  // ==================== RAW TRANSACTION METHODS ====================

  insertRawTransaction(tx: RawTransaction): void {
    this.run(`
      INSERT OR REPLACE INTO raw_transactions 
      (id, hash, level, timestamp, sender, target, amount, entrypoint, parameters, status, has_internals)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [tx.id, tx.hash, tx.level, tx.timestamp, tx.sender, tx.target,
        tx.amount, tx.entrypoint, tx.parameters, tx.status, tx.has_internals ? 1 : 0]);
  }

  insertRawTransactionsBatch(txs: RawTransaction[]): void {
    for (const tx of txs) {
      this.insertRawTransaction(tx);
    }
    this.save();
  }

  getRawTransactionCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM raw_transactions') || 0;
  }

  getMaxRawTransactionId(): number | null {
    return this.getValue<number>('SELECT MAX(id) as max_id FROM raw_transactions');
  }

  getRawTransactionsByTarget(targets: string[], entrypoints: string[]): RawTransaction[] {
    const targetPlaceholders = targets.map(() => '?').join(',');
    const entrypointPlaceholders = entrypoints.map(() => '?').join(',');
    
    return this.query<RawTransaction>(`
      SELECT * FROM raw_transactions 
      WHERE target IN (${targetPlaceholders}) 
      AND entrypoint IN (${entrypointPlaceholders})
      ORDER BY timestamp
    `, [...targets, ...entrypoints]);
  }

  getRawTransactionsBySender(sender: string, targets: string[], entrypoints: string[]): RawTransaction[] {
    const targetPlaceholders = targets.map(() => '?').join(',');
    const entrypointPlaceholders = entrypoints.map(() => '?').join(',');
    
    return this.query<RawTransaction>(`
      SELECT * FROM raw_transactions 
      WHERE sender = ?
      AND target IN (${targetPlaceholders}) 
      AND entrypoint IN (${entrypointPlaceholders})
      ORDER BY timestamp
    `, [sender, ...targets, ...entrypoints]);
  }

  getEntrypointCounts(targets: string[]): Array<{ entrypoint: string; count: number; target: string }> {
    const targetPlaceholders = targets.map(() => '?').join(',');
    
    return this.query(`
      SELECT entrypoint, target, COUNT(*) as count 
      FROM raw_transactions 
      WHERE target IN (${targetPlaceholders})
      GROUP BY target, entrypoint
      ORDER BY count DESC
    `, targets);
  }

  // ==================== RAW TOKEN TRANSFER METHODS ====================

  insertRawTokenTransfer(transfer: RawTokenTransfer): void {
    this.run(`
      INSERT OR REPLACE INTO raw_token_transfers 
      (id, level, timestamp, token_contract, token_id, token_standard, from_address, to_address, amount, transaction_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [transfer.id, transfer.level, transfer.timestamp, transfer.token_contract,
        transfer.token_id, transfer.token_standard, transfer.from_address,
        transfer.to_address, transfer.amount, transfer.transaction_id]);
  }

  insertRawTokenTransfersBatch(transfers: RawTokenTransfer[]): void {
    for (const t of transfers) {
      this.insertRawTokenTransfer(t);
    }
    this.save();
  }

  getRawTokenTransferCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM raw_token_transfers') || 0;
  }

  getMaxRawTokenTransferId(): number | null {
    return this.getValue<number>('SELECT MAX(id) as max_id FROM raw_token_transfers');
  }

  getRawTransfersByTransactionId(txId: number): RawTokenTransfer[] {
    return this.query<RawTokenTransfer>('SELECT * FROM raw_token_transfers WHERE transaction_id = ?', [txId]);
  }

  getAllRawTokenTransfers(): RawTokenTransfer[] {
    return this.query<RawTokenTransfer>('SELECT * FROM raw_token_transfers ORDER BY timestamp');
  }

  getRawMintTransfers(): RawTokenTransfer[] {
    return this.query<RawTokenTransfer>(`
      SELECT * FROM raw_token_transfers 
      WHERE (from_address IS NULL OR from_address = '')
      AND token_standard = 'fa2'
      ORDER BY timestamp
    `);
  }

  getRawTransfersFromAddress(address: string): RawTokenTransfer[] {
    return this.query<RawTokenTransfer>('SELECT * FROM raw_token_transfers WHERE from_address = ?', [address]);
  }

  // ==================== RAW BALANCE METHODS ====================

  insertRawBalance(address: string, balanceMutez: number | null, snapshotTs: string): void {
    this.run(`
      INSERT OR REPLACE INTO raw_balances (address, balance_mutez, snapshot_ts)
      VALUES (?, ?, ?)
    `, [address, balanceMutez, snapshotTs]);
  }

  getRawBalance(address: string): { balance_mutez: number | null; snapshot_ts: string } | null {
    const results = this.query<{ balance_mutez: number | null; snapshot_ts: string }>(
      'SELECT balance_mutez, snapshot_ts FROM raw_balances WHERE address = ?', [address]);
    return results[0] || null;
  }

  getAddressesWithoutBalance(): string[] {
    return this.query<{ address: string }>(`
      SELECT DISTINCT address FROM (
        SELECT sender as address FROM raw_transactions WHERE sender LIKE 'tz%'
        UNION
        SELECT to_address as address FROM raw_token_transfers WHERE to_address LIKE 'tz%'
      ) 
      WHERE address NOT IN (SELECT address FROM raw_balances)
    `).map(r => r.address);
  }

  getRawBalanceCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM raw_balances') || 0;
  }

  // ==================== SYNC METADATA ====================

  setSyncMetadata(key: string, value: string): void {
    this.run('INSERT OR REPLACE INTO sync_metadata (key, value) VALUES (?, ?)', [key, value]);
    this.save();
  }

  getSyncMetadata(key: string): string | null {
    return this.getValue<string>('SELECT value FROM sync_metadata WHERE key = ?', [key]);
  }

  // ==================== DERIVED DATA - BUYERS ====================

  upsertBuyer(address: string): void {
    this.run('INSERT OR IGNORE INTO buyers (address) VALUES (?)', [address]);
  }

  getAllBuyers(): string[] {
    return this.query<{ address: string }>('SELECT address FROM buyers').map(r => r.address);
  }

  getBuyerCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM buyers') || 0;
  }

  // ==================== DERIVED DATA - BUYER BALANCES ====================

  upsertBuyerBalance(address: string, balanceMutez: number | null, ts: string): void {
    this.run(`
      INSERT OR REPLACE INTO buyer_balance_start (address, balance_mutez, ts) 
      VALUES (?, ?, ?)
    `, [address, balanceMutez, ts]);
  }

  getBuyerBalance(address: string): BuyerBalanceRow | null {
    const results = this.query<BuyerBalanceRow>('SELECT * FROM buyer_balance_start WHERE address = ?', [address]);
    return results[0] || null;
  }

  // ==================== DERIVED DATA - PURCHASES ====================

  insertPurchase(purchase: Omit<PurchaseRow, 'id'>): void {
    this.run(`
      INSERT OR IGNORE INTO purchases 
      (op_hash, ts, buyer, seller, marketplace, token_contract, token_id, qty, spend_mutez, kind)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [purchase.op_hash, purchase.ts, purchase.buyer, purchase.seller,
        purchase.marketplace, purchase.token_contract, purchase.token_id,
        purchase.qty, purchase.spend_mutez, purchase.kind]);
  }

  getAllPurchases(): PurchaseRow[] {
    return this.query<PurchaseRow>('SELECT * FROM purchases ORDER BY ts');
  }

  getPurchasesByBuyer(buyer: string): PurchaseRow[] {
    return this.query<PurchaseRow>('SELECT * FROM purchases WHERE buyer = ? ORDER BY ts', [buyer]);
  }

  getPurchaseCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM purchases') || 0;
  }

  getTotalSpendMutez(): number {
    return this.getValue<number>('SELECT COALESCE(SUM(spend_mutez), 0) as total FROM purchases') || 0;
  }

  // ==================== DERIVED DATA - CREATORS ====================

  upsertCreator(address: string): void {
    this.run('INSERT OR IGNORE INTO creators (address) VALUES (?)', [address]);
  }

  getAllCreators(): string[] {
    return this.query<{ address: string }>('SELECT address FROM creators').map(r => r.address);
  }

  getCreatorCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM creators') || 0;
  }

  // ==================== DERIVED DATA - MINTS ====================

  insertMint(mint: Omit<MintRow, 'id'>): void {
    this.run(`
      INSERT OR IGNORE INTO mints 
      (op_hash, ts, creator, token_contract, token_id, qty)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [mint.op_hash, mint.ts, mint.creator, mint.token_contract, mint.token_id, mint.qty]);
  }

  getAllMints(): MintRow[] {
    return this.query<MintRow>('SELECT * FROM mints ORDER BY ts');
  }

  getMintsByCreator(creator: string): MintRow[] {
    return this.query<MintRow>('SELECT * FROM mints WHERE creator = ? ORDER BY ts', [creator]);
  }

  getMintCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM mints') || 0;
  }

  getTotalMintedQty(): number {
    return this.getValue<number>('SELECT COALESCE(SUM(qty), 0) as total FROM mints') || 0;
  }

  // ==================== DERIVED DATA - LISTINGS ====================

  insertListing(listing: Omit<ListingRow, 'id'>): void {
    this.run(`
      INSERT OR IGNORE INTO listings 
      (op_hash, ts, creator, marketplace, token_contract, token_id, qty, list_price_mutez)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [listing.op_hash, listing.ts, listing.creator, listing.marketplace,
        listing.token_contract, listing.token_id, listing.qty, listing.list_price_mutez]);
  }

  getAllListings(): ListingRow[] {
    return this.query<ListingRow>('SELECT * FROM listings ORDER BY ts');
  }

  getListingsByCreator(creator: string): ListingRow[] {
    return this.query<ListingRow>('SELECT * FROM listings WHERE creator = ? ORDER BY ts', [creator]);
  }

  getListingCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM listings') || 0;
  }

  getTotalEditionsListed(): number {
    return this.getValue<number>('SELECT COALESCE(SUM(qty), 0) as total FROM listings') || 0;
  }

  getDistinctTokensListed(): number {
    return this.getValue<number>('SELECT COUNT(DISTINCT token_contract || token_id) as count FROM listings') || 0;
  }

  getLatestListingPrice(seller: string, tokenContract: string, tokenId: string, beforeTs: string): number | null {
    return this.getValue<number>(`
      SELECT list_price_mutez FROM listings 
      WHERE creator = ? AND token_contract = ? AND token_id = ? AND ts <= ?
      ORDER BY ts DESC LIMIT 1
    `, [seller, tokenContract, tokenId, beforeTs]);
  }

  // ==================== DERIVED DATA - OFFER ACCEPTS ====================

  insertOfferAccept(offerAccept: Omit<OfferAcceptRow, 'id'>): void {
    this.run(`
      INSERT OR IGNORE INTO offer_accepts 
      (op_hash, ts, creator_seller, buyer_offer, marketplace, token_contract, token_id, qty, 
       accepted_price_mutez, reference_list_price_mutez, under_list)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [offerAccept.op_hash, offerAccept.ts, offerAccept.creator_seller, offerAccept.buyer_offer,
        offerAccept.marketplace, offerAccept.token_contract, offerAccept.token_id, offerAccept.qty,
        offerAccept.accepted_price_mutez, offerAccept.reference_list_price_mutez,
        offerAccept.under_list === null ? null : (offerAccept.under_list ? 1 : 0)]);
  }

  getAllOfferAccepts(): OfferAcceptRow[] {
    return this.query<any>('SELECT * FROM offer_accepts ORDER BY ts').map(row => ({
      ...row,
      under_list: row.under_list === null ? null : Boolean(row.under_list)
    }));
  }

  getOfferAcceptsBySeller(seller: string): OfferAcceptRow[] {
    return this.query<any>('SELECT * FROM offer_accepts WHERE creator_seller = ? ORDER BY ts', [seller]).map(row => ({
      ...row,
      under_list: row.under_list === null ? null : Boolean(row.under_list)
    }));
  }

  getOfferAcceptCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM offer_accepts') || 0;
  }

  getUnderListCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM offer_accepts WHERE under_list = 1') || 0;
  }

  getOfferAcceptsWithBothPrices(): number {
    return this.getValue<number>(`
      SELECT COUNT(*) as count FROM offer_accepts 
      WHERE accepted_price_mutez IS NOT NULL AND reference_list_price_mutez IS NOT NULL
    `) || 0;
  }

  // ==================== DERIVED DATA - RESALES ====================

  insertResale(resale: Omit<ResaleRow, 'id'>): void {
    this.run(`
      INSERT OR IGNORE INTO resales 
      (op_hash, ts, seller_collector, buyer, marketplace, token_contract, token_id, qty, proceeds_mutez)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [resale.op_hash, resale.ts, resale.seller_collector, resale.buyer,
        resale.marketplace, resale.token_contract, resale.token_id, resale.qty, resale.proceeds_mutez]);
  }

  getAllResales(): ResaleRow[] {
    return this.query<ResaleRow>('SELECT * FROM resales ORDER BY ts');
  }

  getResalesBySeller(seller: string): ResaleRow[] {
    return this.query<ResaleRow>('SELECT * FROM resales WHERE seller_collector = ? ORDER BY ts', [seller]);
  }

  getResaleCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM resales') || 0;
  }

  getTotalResaleProceeds(): number {
    return this.getValue<number>('SELECT COALESCE(SUM(proceeds_mutez), 0) as total FROM resales') || 0;
  }

  // ==================== METADATA ====================

  setMetadata(key: string, value: string): void {
    this.run('INSERT OR REPLACE INTO pipeline_metadata (key, value) VALUES (?, ?)', [key, value]);
    this.save();
  }

  getMetadata(key: string): string | null {
    return this.getValue<string>('SELECT value FROM pipeline_metadata WHERE key = ?', [key]);
  }

  // ==================== OVERLAP QUERIES ====================

  getBuyerCreatorOverlap(): string[] {
    return this.query<{ address: string }>(`
      SELECT b.address FROM buyers b
      INNER JOIN creators c ON b.address = c.address
    `).map(r => r.address);
  }

  // ==================== RAW XTZ TRANSFERS ====================

  insertRawXtzTransfer(transfer: RawXtzTransfer): void {
    this.run(`
      INSERT OR REPLACE INTO raw_xtz_transfers 
      (id, hash, timestamp, sender, target, amount, is_from_cex, is_to_cex)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [transfer.id, transfer.hash, transfer.timestamp, transfer.sender,
        transfer.target, transfer.amount, transfer.is_from_cex ? 1 : 0, transfer.is_to_cex ? 1 : 0]);
  }

  insertRawXtzTransfersBatch(transfers: RawXtzTransfer[]): void {
    for (const t of transfers) {
      this.insertRawXtzTransfer(t);
    }
    this.save();
  }

  getRawXtzTransferCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM raw_xtz_transfers') || 0;
  }

  getMaxRawXtzTransferId(): number | null {
    return this.getValue<number>('SELECT MAX(id) as max_id FROM raw_xtz_transfers');
  }

  getXtzTransfersToAddress(address: string): RawXtzTransfer[] {
    return this.query<any>('SELECT * FROM raw_xtz_transfers WHERE target = ?', [address]).map(r => ({
      ...r,
      is_from_cex: Boolean(r.is_from_cex),
      is_to_cex: Boolean(r.is_to_cex)
    }));
  }

  getXtzTransfersFromAddress(address: string): RawXtzTransfer[] {
    return this.query<any>('SELECT * FROM raw_xtz_transfers WHERE sender = ?', [address]).map(r => ({
      ...r,
      is_from_cex: Boolean(r.is_from_cex),
      is_to_cex: Boolean(r.is_to_cex)
    }));
  }

  getCexFundingForAddress(address: string): number {
    return this.getValue<number>(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM raw_xtz_transfers 
      WHERE target = ? AND is_from_cex = 1
    `, [address]) || 0;
  }

  getCexCashoutFromAddress(address: string): number {
    return this.getValue<number>(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM raw_xtz_transfers 
      WHERE sender = ? AND is_to_cex = 1
    `, [address]) || 0;
  }

  // ==================== DAILY METRICS ====================

  insertDailyMetrics(metrics: DailyMetricsRow): void {
    this.run(`
      INSERT OR REPLACE INTO daily_metrics 
      (date, total_volume_mutez, avg_sale_price_mutez, sale_count, unique_buyers, unique_sellers)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [metrics.date, metrics.total_volume_mutez, metrics.avg_sale_price_mutez,
        metrics.sale_count, metrics.unique_buyers, metrics.unique_sellers]);
  }

  getAllDailyMetrics(): DailyMetricsRow[] {
    return this.query<DailyMetricsRow>('SELECT * FROM daily_metrics ORDER BY date');
  }

  getDailyMetricsCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM daily_metrics') || 0;
  }

  // ==================== MARKETPLACE STATS ====================

  insertMarketplaceStats(stats: MarketplaceStatsRow): void {
    this.run(`
      INSERT OR REPLACE INTO marketplace_stats 
      (marketplace, sale_count, volume_mutez, volume_percent, estimated_fees_mutez)
      VALUES (?, ?, ?, ?, ?)
    `, [stats.marketplace, stats.sale_count, stats.volume_mutez, 
        stats.volume_percent, stats.estimated_fees_mutez]);
  }

  getAllMarketplaceStats(): MarketplaceStatsRow[] {
    return this.query<MarketplaceStatsRow>('SELECT * FROM marketplace_stats ORDER BY volume_mutez DESC');
  }

  getMarketplaceStats(marketplace: string): MarketplaceStatsRow | null {
    const results = this.query<MarketplaceStatsRow>(
      'SELECT * FROM marketplace_stats WHERE marketplace = ?', [marketplace]);
    return results[0] || null;
  }

  getTotalMarketplaceFees(): number {
    return this.getValue<number>('SELECT COALESCE(SUM(estimated_fees_mutez), 0) as total FROM marketplace_stats') || 0;
  }

  getObjktTotalFees(): number {
    return this.getValue<number>(`
      SELECT COALESCE(SUM(estimated_fees_mutez), 0) as total 
      FROM marketplace_stats 
      WHERE marketplace LIKE 'objkt%'
    `) || 0;
  }

  getObjktMarketShare(): number {
    const objktVolume = this.getValue<number>(`
      SELECT COALESCE(SUM(volume_mutez), 0) as total 
      FROM marketplace_stats 
      WHERE marketplace LIKE 'objkt%'
    `) || 0;
    const totalVolume = this.getValue<number>(
      'SELECT COALESCE(SUM(volume_mutez), 0) as total FROM marketplace_stats'
    ) || 0;
    return totalVolume > 0 ? (objktVolume / totalVolume) * 100 : 0;
  }

  // ==================== DAILY MARKETPLACE FEES ====================

  insertDailyMarketplaceFees(row: DailyMarketplaceFeesRow): void {
    this.run(`
      INSERT OR REPLACE INTO daily_marketplace_fees 
      (date, marketplace, volume_mutez, fees_mutez, sale_count)
      VALUES (?, ?, ?, ?, ?)
    `, [row.date, row.marketplace, row.volume_mutez, row.fees_mutez, row.sale_count]);
  }

  getAllDailyMarketplaceFees(): DailyMarketplaceFeesRow[] {
    return this.query<DailyMarketplaceFeesRow>('SELECT * FROM daily_marketplace_fees ORDER BY date, marketplace');
  }

  getDailyMarketplaceFeesByMarketplace(marketplace: string): DailyMarketplaceFeesRow[] {
    return this.query<DailyMarketplaceFeesRow>(
      'SELECT * FROM daily_marketplace_fees WHERE marketplace = ? ORDER BY date', [marketplace]);
  }

  // ==================== BUYER CEX FLOW ====================

  insertBuyerCexFlow(row: BuyerCexFlowRow): void {
    this.run(`
      INSERT OR REPLACE INTO buyer_cex_flow 
      (address, has_cex_funding, cex_funding_mutez, is_sales_only, total_received_mutez, total_from_sales_mutez)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [row.address, row.has_cex_funding ? 1 : 0, row.cex_funding_mutez,
        row.is_sales_only ? 1 : 0, row.total_received_mutez, row.total_from_sales_mutez]);
  }

  getAllBuyerCexFlow(): BuyerCexFlowRow[] {
    return this.query<any>('SELECT * FROM buyer_cex_flow').map(r => ({
      ...r,
      has_cex_funding: Boolean(r.has_cex_funding),
      is_sales_only: Boolean(r.is_sales_only)
    }));
  }

  getBuyersWithCexFundingCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM buyer_cex_flow WHERE has_cex_funding = 1') || 0;
  }

  getSalesOnlyBuyersCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM buyer_cex_flow WHERE is_sales_only = 1') || 0;
  }

  getTotalCexFunding(): number {
    return this.getValue<number>('SELECT COALESCE(SUM(cex_funding_mutez), 0) as total FROM buyer_cex_flow') || 0;
  }

  // ==================== CREATOR FUND FLOW ====================

  insertCreatorFundFlow(row: CreatorFundFlowRow): void {
    this.run(`
      INSERT OR REPLACE INTO creator_fund_flow 
      (address, total_sales_mutez, sent_to_cex_mutez, spent_on_nfts_mutez, cashed_out, bought_nfts)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [row.address, row.total_sales_mutez, row.sent_to_cex_mutez, row.spent_on_nfts_mutez,
        row.cashed_out ? 1 : 0, row.bought_nfts ? 1 : 0]);
  }

  getAllCreatorFundFlow(): CreatorFundFlowRow[] {
    return this.query<any>('SELECT * FROM creator_fund_flow').map(r => ({
      ...r,
      cashed_out: Boolean(r.cashed_out),
      bought_nfts: Boolean(r.bought_nfts)
    }));
  }

  getCreatorsWhoCashedOutCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM creator_fund_flow WHERE cashed_out = 1') || 0;
  }

  getCreatorsWhoBoughtNftsCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM creator_fund_flow WHERE bought_nfts = 1') || 0;
  }

  getTotalSentToCex(): number {
    return this.getValue<number>('SELECT COALESCE(SUM(sent_to_cex_mutez), 0) as total FROM creator_fund_flow') || 0;
  }

  // ==================== CONTRACT METADATA ====================

  insertContractMetadata(row: ContractMetadataRow): void {
    this.run(`
      INSERT OR REPLACE INTO contract_metadata 
      (address, is_fungible, token_type, alias, checked_at)
      VALUES (?, ?, ?, ?, ?)
    `, [row.address, row.is_fungible ? 1 : 0, row.token_type, row.alias, row.checked_at]);
  }

  getContractMetadata(address: string): ContractMetadataRow | null {
    const rows = this.query<any>(`
      SELECT * FROM contract_metadata WHERE address = ?
    `, [address]);
    if (rows.length === 0) return null;
    return {
      ...rows[0],
      is_fungible: Boolean(rows[0].is_fungible)
    };
  }

  isContractFungible(address: string): boolean | null {
    const meta = this.getContractMetadata(address);
    if (!meta) return null; // not cached
    return meta.is_fungible;
  }

  getAllCachedFungibleContracts(): string[] {
    return this.query<{ address: string }>(`
      SELECT address FROM contract_metadata WHERE is_fungible = 1
    `).map(r => r.address);
  }

  getUncachedContracts(contracts: string[]): string[] {
    if (contracts.length === 0) return [];
    const placeholders = contracts.map(() => '?').join(',');
    const cached = this.query<{ address: string }>(`
      SELECT address FROM contract_metadata WHERE address IN (${placeholders})
    `, contracts).map(r => r.address);
    const cachedSet = new Set(cached);
    return contracts.filter(c => !cachedSet.has(c));
  }

  // ==================== ADDRESS REGISTRY ====================

  insertAddressRegistry(row: AddressRegistryRow): void {
    this.run(`
      INSERT OR REPLACE INTO address_registry 
      (address, address_type, alias, tezos_domain, owned_domains, category, tx_count, metadata, resolved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [row.address, row.address_type, row.alias, row.tezos_domain, row.owned_domains, 
        row.category, row.tx_count, row.metadata, row.resolved_at]);
  }

  getAddressRegistry(address: string): AddressRegistryRow | null {
    const rows = this.query<AddressRegistryRow>(`
      SELECT * FROM address_registry WHERE address = ?
    `, [address]);
    return rows.length > 0 ? rows[0] : null;
  }

  getAllAddressRegistry(): AddressRegistryRow[] {
    return this.query<AddressRegistryRow>('SELECT * FROM address_registry ORDER BY tx_count DESC');
  }

  getTopContracts(limit: number = 50): Array<{ address: string; tx_count: number }> {
    return this.query<{ address: string; tx_count: number }>(`
      SELECT address, COUNT(*) as tx_count FROM (
        SELECT target as address FROM raw_transactions WHERE target LIKE 'KT1%'
        UNION ALL
        SELECT sender as address FROM raw_transactions WHERE sender LIKE 'KT1%'
        UNION ALL  
        SELECT token_contract as address FROM raw_token_transfers WHERE token_contract LIKE 'KT1%'
        UNION ALL
        SELECT from_address as address FROM raw_token_transfers WHERE from_address LIKE 'KT1%'
        UNION ALL
        SELECT to_address as address FROM raw_token_transfers WHERE to_address LIKE 'KT1%'
      ) GROUP BY address ORDER BY tx_count DESC LIMIT ?
    `, [limit]);
  }

  getTopWallets(limit: number = 200): Array<{ address: string; tx_count: number }> {
    return this.query<{ address: string; tx_count: number }>(`
      SELECT address, COUNT(*) as tx_count FROM (
        SELECT sender as address FROM raw_transactions WHERE sender LIKE 'tz%'
        UNION ALL
        SELECT target as address FROM raw_transactions WHERE target LIKE 'tz%'
        UNION ALL
        SELECT from_address as address FROM raw_token_transfers WHERE from_address LIKE 'tz%'
        UNION ALL
        SELECT to_address as address FROM raw_token_transfers WHERE to_address LIKE 'tz%'
      ) GROUP BY address ORDER BY tx_count DESC LIMIT ?
    `, [limit]);
  }

  getUnresolvedAddresses(limit: number = 100): string[] {
    return this.query<{ address: string }>(`
      SELECT address FROM address_registry WHERE resolved_at IS NULL LIMIT ?
    `, [limit]).map(r => r.address);
  }

  updateAddressResolution(address: string, alias: string | null, tezosDomain: string | null, ownedDomains: string[] | null): void {
    this.run(`
      UPDATE address_registry 
      SET alias = ?, tezos_domain = ?, owned_domains = ?, resolved_at = ?
      WHERE address = ?
    `, [alias, tezosDomain, ownedDomains ? JSON.stringify(ownedDomains) : null, new Date().toISOString(), address]);
  }

  getAddressRegistryCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM address_registry') || 0;
  }

  getResolvedAddressCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM address_registry WHERE resolved_at IS NOT NULL') || 0;
  }

  // ==================== ALL TRANSACTIONS ====================

  insertAllTransaction(row: AllTransactionRow): void {
    this.run(`
      INSERT OR IGNORE INTO all_transactions 
      (id, hash, level, timestamp, sender, target, amount, entrypoint, parameters, status, tx_category, is_internal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [row.id, row.hash, row.level, row.timestamp, row.sender, row.target, row.amount,
        row.entrypoint, row.parameters, row.status, row.tx_category, row.is_internal ? 1 : 0]);
  }

  getAllTransactionsCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM all_transactions') || 0;
  }

  getMaxAllTransactionId(): number {
    return this.getValue<number>('SELECT MAX(id) as max_id FROM all_transactions') || 0;
  }

  getAllTransactionsByCategory(category: string): AllTransactionRow[] {
    return this.query<any>('SELECT * FROM all_transactions WHERE tx_category = ?', [category])
      .map(r => ({ ...r, is_internal: Boolean(r.is_internal) }));
  }

  updateTransactionCategory(id: number, category: string): void {
    this.run('UPDATE all_transactions SET tx_category = ? WHERE id = ?', [category, id]);
  }

  // ==================== XTZ FLOWS ====================

  insertXtzFlow(row: XtzFlowRow): void {
    this.run(`
      INSERT OR IGNORE INTO xtz_flows 
      (id, hash, timestamp, sender, target, amount_mutez, flow_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [row.id, row.hash, row.timestamp, row.sender, row.target, row.amount_mutez, row.flow_type]);
  }

  getXtzFlowsCount(): number {
    return this.getValue<number>('SELECT COUNT(*) as count FROM xtz_flows') || 0;
  }

  getMaxXtzFlowId(): number {
    return this.getValue<number>('SELECT MAX(id) as max_id FROM xtz_flows') || 0;
  }

  getXtzFlowsByType(flowType: string): XtzFlowRow[] {
    return this.query<XtzFlowRow>('SELECT * FROM xtz_flows WHERE flow_type = ?', [flowType]);
  }

  getXtzFlowsForAddress(address: string): XtzFlowRow[] {
    return this.query<XtzFlowRow>(
      'SELECT * FROM xtz_flows WHERE sender = ? OR target = ? ORDER BY timestamp',
      [address, address]
    );
  }

  // ==================== WALLET XTZ SUMMARY ====================

  upsertWalletXtzSummary(row: WalletXtzSummaryRow): void {
    this.run(`
      INSERT OR REPLACE INTO wallet_xtz_summary 
      (address, balance_start_mutez, balance_end_mutez, total_received_mutez, total_sent_mutez,
       received_from_sales_mutez, spent_on_nfts_mutez, sent_to_cex_mutez, received_from_cex_mutez,
       sent_to_l2_mutez, received_from_l2_mutez)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [row.address, row.balance_start_mutez, row.balance_end_mutez, row.total_received_mutez,
        row.total_sent_mutez, row.received_from_sales_mutez, row.spent_on_nfts_mutez,
        row.sent_to_cex_mutez, row.received_from_cex_mutez, row.sent_to_l2_mutez, row.received_from_l2_mutez]);
  }

  getWalletXtzSummary(address: string): WalletXtzSummaryRow | null {
    const rows = this.query<WalletXtzSummaryRow>(
      'SELECT * FROM wallet_xtz_summary WHERE address = ?',
      [address]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  getAllWalletXtzSummaries(): WalletXtzSummaryRow[] {
    return this.query<WalletXtzSummaryRow>('SELECT * FROM wallet_xtz_summary');
  }

  // ==================== SYNC PROGRESS ====================

  initializeSyncWeeks(weeks: Array<{ id: string; start: string; end: string }>): void {
    for (const week of weeks) {
      this.run(`
        INSERT OR IGNORE INTO sync_progress (week_id, start_date, end_date, status)
        VALUES (?, ?, ?, 'pending')
      `, [week.id, week.start, week.end]);
    }
    this.save();
  }

  getSyncProgress(weekId: string): SyncProgressRow | null {
    const rows = this.query<SyncProgressRow>(
      'SELECT * FROM sync_progress WHERE week_id = ?',
      [weekId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  getAllSyncProgress(): SyncProgressRow[] {
    return this.query<SyncProgressRow>('SELECT * FROM sync_progress ORDER BY start_date');
  }

  updateSyncProgress(
    weekId: string,
    status: 'pending' | 'in_progress' | 'complete' | 'error',
    txCount?: number,
    flowCount?: number,
    errorMessage?: string
  ): void {
    const now = new Date().toISOString();
    
    if (status === 'in_progress') {
      this.run(`
        UPDATE sync_progress 
        SET status = ?, started_at = ?
        WHERE week_id = ?
      `, [status, now, weekId]);
    } else if (status === 'complete') {
      this.run(`
        UPDATE sync_progress 
        SET status = ?, completed_at = ?, all_tx_count = ?, xtz_flow_count = ?
        WHERE week_id = ?
      `, [status, now, txCount || 0, flowCount || 0, weekId]);
    } else if (status === 'error') {
      this.run(`
        UPDATE sync_progress 
        SET status = ?, error_message = ?
        WHERE week_id = ?
      `, [status, errorMessage || 'Unknown error', weekId]);
    } else {
      this.run(`
        UPDATE sync_progress SET status = ? WHERE week_id = ?
      `, [status, weekId]);
    }
    this.save();
  }

  getIncompleteWeeks(): SyncProgressRow[] {
    return this.query<SyncProgressRow>(
      "SELECT * FROM sync_progress WHERE status != 'complete' ORDER BY start_date"
    );
  }

  getSyncSummary(): { total: number; complete: number; pending: number; inProgress: number } {
    const all = this.getAllSyncProgress();
    return {
      total: all.length,
      complete: all.filter(w => w.status === 'complete').length,
      pending: all.filter(w => w.status === 'pending').length,
      inProgress: all.filter(w => w.status === 'in_progress').length
    };
  }

  // ==================== CLEAR METHODS ====================

  clearDerived(): void {
    this.run('DELETE FROM buyers');
    this.run('DELETE FROM buyer_balance_start');
    this.run('DELETE FROM purchases');
    this.run('DELETE FROM creators');
    this.run('DELETE FROM mints');
    this.run('DELETE FROM listings');
    this.run('DELETE FROM offer_accepts');
    this.run('DELETE FROM resales');
    this.run('DELETE FROM pipeline_metadata');
    this.run('DELETE FROM daily_metrics');
    this.run('DELETE FROM marketplace_stats');
    this.run('DELETE FROM daily_marketplace_fees');
    this.run('DELETE FROM buyer_cex_flow');
    this.run('DELETE FROM creator_fund_flow');
    this.run('DELETE FROM wallet_xtz_summary');
    this.save();
  }

  clearAll(): void {
    this.run('DELETE FROM raw_transactions');
    this.run('DELETE FROM raw_token_transfers');
    this.run('DELETE FROM raw_balances');
    this.run('DELETE FROM raw_xtz_transfers');
    this.run('DELETE FROM sync_metadata');
    this.run('DELETE FROM all_transactions');
    this.run('DELETE FROM xtz_flows');
    this.run('DELETE FROM address_registry');
    this.clearDerived();
  }
}
