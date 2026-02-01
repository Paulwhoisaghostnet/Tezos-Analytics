/**
 * Tezos Analytics API Server
 * Local development server for browser-based analytics dashboard
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import * as path from 'path';
import { Storage } from './storage';
import { DEFAULT_CONFIG } from './config';
import { 
  syncWeek, 
  printWeeklySyncStatus, 
  initializeWeeklySyncProgress,
  SYNC_WEEKS 
} from './sync';
import { generateNetworkData } from './generate_network';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Store database reference
let storage: Storage | null = null;

async function getStorage(): Promise<Storage> {
  if (!storage) {
    storage = await Storage.create(DEFAULT_CONFIG.dbPath);
    initializeWeeklySyncProgress(storage);
  }
  return storage;
}

// ==================== API ROUTES ====================

/**
 * GET /api/stats - Overview statistics
 */
app.get('/api/stats', async (req: Request, res: Response) => {
  try {
    const db = await getStorage();
    
    const stats = {
      buyers: db.getBuyerCount(),
      creators: db.getCreatorCount(),
      purchases: db.getPurchaseCount(),
      mints: db.getMintCount(),
      listings: db.getListingCount(),
      resales: db.getResaleCount(),
      allTransactions: db.getAllTransactionsCount(),
      xtzFlows: db.getXtzFlowsCount(),
      addressRegistry: db.getAddressRegistryCount(),
      resolvedAddresses: db.getResolvedAddressCount(),
      totalVolume: db.getValue<number>('SELECT COALESCE(SUM(spend_mutez), 0) FROM purchases') || 0,
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * GET /api/sync-status - Weekly sync progress
 */
app.get('/api/sync-status', async (req: Request, res: Response) => {
  try {
    const db = await getStorage();
    const progress = db.getAllSyncProgress();
    const summary = db.getSyncSummary();
    
    res.json({
      weeks: SYNC_WEEKS.map(w => {
        const p = progress.find(pr => pr.week_id === w.id);
        return {
          ...w,
          status: p?.status || 'pending',
          txCount: p?.all_tx_count || 0,
          flowCount: p?.xtz_flow_count || 0,
          startedAt: p?.started_at,
          completedAt: p?.completed_at
        };
      }),
      summary
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

/**
 * POST /api/sync/:weekId - Trigger sync for a week
 */
app.post('/api/sync/:weekId', async (req: Request, res: Response) => {
  const weekId = req.params.weekId as string;
  
  try {
    const db = await getStorage();
    
    // Don't await - run in background
    syncWeek(DEFAULT_CONFIG, db, weekId)
      .then(() => console.log(`Sync ${weekId} complete`))
      .catch(err => console.error(`Sync ${weekId} failed:`, err));
    
    res.json({ message: `Sync started for ${weekId}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start sync' });
  }
});

/**
 * GET /api/daily-metrics - Daily time series data
 */
app.get('/api/daily-metrics', async (req: Request, res: Response) => {
  try {
    const db = await getStorage();
    const metrics = db.getAllDailyMetrics();
    
    res.json(metrics.map(m => ({
      date: m.date,
      volumeXtz: m.total_volume_mutez / 1_000_000,
      avgPriceXtz: m.avg_sale_price_mutez ? m.avg_sale_price_mutez / 1_000_000 : 0,
      saleCount: m.sale_count,
      uniqueBuyers: m.unique_buyers,
      uniqueSellers: m.unique_sellers
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get daily metrics' });
  }
});

/**
 * GET /api/marketplaces - Marketplace breakdown
 */
app.get('/api/marketplaces', async (req: Request, res: Response) => {
  try {
    const db = await getStorage();
    const stats = db.getAllMarketplaceStats();
    
    res.json(stats.map(s => ({
      marketplace: s.marketplace,
      saleCount: s.sale_count,
      volumeXtz: s.volume_mutez / 1_000_000,
      percentage: s.volume_percent || 0,
      feesXtz: s.estimated_fees_mutez / 1_000_000
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get marketplace stats' });
  }
});

/**
 * GET /api/wallet/:address - Wallet profile
 */
app.get('/api/wallet/:address', async (req: Request, res: Response) => {
  const address = req.params.address as string;
  
  try {
    const db = await getStorage();
    
    // Get registry info
    const registry = db.getAddressRegistry(address);
    
    // Get as buyer
    const buyer = db.query<any>(
      'SELECT * FROM buyers WHERE address = ?',
      [address]
    )[0];
    
    // Get as creator
    const creator = db.query<any>(
      'SELECT * FROM creators WHERE address = ?',
      [address]
    )[0];
    
    // Get XTZ flow summary
    const xtzSummary = db.getWalletXtzSummary(address);
    
    // Get purchase count and volume
    const purchaseStats = db.query<any>(`
      SELECT COUNT(*) as count, COALESCE(SUM(spend_mutez), 0) as total
      FROM purchases WHERE buyer = ?
    `, [address])[0];
    
    // Get sales count and volume
    const saleStats = db.query<any>(`
      SELECT COUNT(*) as count, COALESCE(SUM(spend_mutez), 0) as total
      FROM purchases WHERE seller = ?
    `, [address])[0];
    
    res.json({
      address,
      alias: registry?.alias || null,
      tezosDomain: registry?.tezos_domain || null,
      ownedDomains: registry?.owned_domains ? JSON.parse(registry.owned_domains) : [],
      type: registry?.address_type || (address.startsWith('KT1') ? 'contract' : 'wallet'),
      category: registry?.category || 'unknown',
      isBuyer: !!buyer,
      isCreator: !!creator,
      purchases: {
        count: purchaseStats?.count || 0,
        totalXtz: (purchaseStats?.total || 0) / 1_000_000
      },
      sales: {
        count: saleStats?.count || 0,
        totalXtz: (saleStats?.total || 0) / 1_000_000
      },
      xtzFlow: xtzSummary ? {
        balanceStartXtz: xtzSummary.balance_start_mutez ? xtzSummary.balance_start_mutez / 1_000_000 : null,
        totalReceivedXtz: xtzSummary.total_received_mutez / 1_000_000,
        totalSentXtz: xtzSummary.total_sent_mutez / 1_000_000,
        fromSalesXtz: xtzSummary.received_from_sales_mutez / 1_000_000,
        spentOnNftsXtz: xtzSummary.spent_on_nfts_mutez / 1_000_000,
        fromCexXtz: xtzSummary.received_from_cex_mutez / 1_000_000,
        toCexXtz: xtzSummary.sent_to_cex_mutez / 1_000_000,
        fromL2Xtz: xtzSummary.received_from_l2_mutez / 1_000_000,
        toL2Xtz: xtzSummary.sent_to_l2_mutez / 1_000_000
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get wallet profile' });
  }
});

/**
 * GET /api/wallet/:address/transactions - Wallet transactions
 */
app.get('/api/wallet/:address/transactions', async (req: Request, res: Response) => {
  const address = req.params.address as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  
  try {
    const db = await getStorage();
    
    // Get purchases by this wallet
    const purchases = db.query<any>(`
      SELECT 'purchase' as type, ts, seller as counterparty, token_contract, token_id, 
             spend_mutez, marketplace
      FROM purchases WHERE buyer = ?
      ORDER BY ts DESC LIMIT ?
    `, [address, limit]);
    
    // Get sales by this wallet
    const sales = db.query<any>(`
      SELECT 'sale' as type, ts, buyer as counterparty, token_contract, token_id,
             spend_mutez, marketplace
      FROM purchases WHERE seller = ?
      ORDER BY ts DESC LIMIT ?
    `, [address, limit]);
    
    // Combine and sort
    const transactions = [...purchases, ...sales]
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, limit)
      .map(tx => ({
        ...tx,
        amountXtz: tx.spend_mutez ? tx.spend_mutez / 1_000_000 : 0
      }));
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get wallet transactions' });
  }
});

/**
 * GET /api/network - Network graph data
 */
app.get('/api/network', async (req: Request, res: Response) => {
  const filterWallet = req.query.wallet as string | undefined;
  
  try {
    const db = await getStorage();
    const graph = generateNetworkData(DEFAULT_CONFIG, db, filterWallet, 300);
    
    res.json(graph);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get network data' });
  }
});

/**
 * GET /api/search - Search addresses/domains
 */
app.get('/api/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string || '').toLowerCase().trim();
  
  if (query.length < 3) {
    return res.json([]);
  }
  
  try {
    const db = await getStorage();
    
    const results = db.query<any>(`
      SELECT address, alias, tezos_domain, address_type, category, tx_count
      FROM address_registry
      WHERE LOWER(address) LIKE ? 
         OR LOWER(alias) LIKE ?
         OR LOWER(tezos_domain) LIKE ?
      ORDER BY tx_count DESC
      LIMIT 20
    `, [`%${query}%`, `%${query}%`, `%${query}%`]);
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search' });
  }
});

/**
 * GET /api/whales - Top activity wallets
 */
app.get('/api/whales', async (req: Request, res: Response) => {
  try {
    const db = await getStorage();
    
    // Top buyers by volume
    const topBuyers = db.query<any>(`
      SELECT buyer as address, COUNT(*) as purchaseCount, 
             COALESCE(SUM(spend_mutez), 0) as totalSpent
      FROM purchases
      GROUP BY buyer
      ORDER BY totalSpent DESC
      LIMIT 20
    `);
    
    // Top sellers by volume
    const topSellers = db.query<any>(`
      SELECT seller as address, COUNT(*) as saleCount,
             COALESCE(SUM(spend_mutez), 0) as totalReceived
      FROM purchases
      GROUP BY seller
      ORDER BY totalReceived DESC
      LIMIT 20
    `);
    
    // Enrich with registry info
    const enrichAddress = (addr: string) => {
      const reg = db.getAddressRegistry(addr);
      return {
        alias: reg?.alias || reg?.tezos_domain || null
      };
    };
    
    res.json({
      topBuyers: topBuyers.map(b => ({
        ...b,
        ...enrichAddress(b.address),
        totalSpentXtz: b.totalSpent / 1_000_000
      })),
      topSellers: topSellers.map(s => ({
        ...s,
        ...enrichAddress(s.address),
        totalReceivedXtz: s.totalReceived / 1_000_000
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get whales' });
  }
});

/**
 * GET /api/cex-flow - CEX deposit/withdrawal stats
 */
app.get('/api/cex-flow', async (req: Request, res: Response) => {
  try {
    const db = await getStorage();
    
    const buyerFlow = db.getAllBuyerCexFlow();
    const creatorFlow = db.getAllCreatorFundFlow();
    
    const totalFromCex = buyerFlow.reduce((sum, b) => sum + b.cex_funding_mutez, 0);
    const totalToCex = creatorFlow.reduce((sum, c) => sum + c.sent_to_cex_mutez, 0);
    
    res.json({
      totalFromCexXtz: totalFromCex / 1_000_000,
      totalToCexXtz: totalToCex / 1_000_000,
      netFlowXtz: (totalFromCex - totalToCex) / 1_000_000,
      buyersWithCexFunding: buyerFlow.filter(b => b.has_cex_funding).length,
      creatorsSellingToCex: creatorFlow.filter(c => c.cashed_out).length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get CEX flow' });
  }
});

// Fallback to serve index.html for SPA routing
app.use((req: Request, res: Response) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   Tezos Analytics Dashboard                                  ║
║   http://localhost:${PORT}                                      ║
║                                                              ║
║   API Endpoints:                                             ║
║   GET  /api/stats          - Overview statistics             ║
║   GET  /api/sync-status    - Weekly sync progress            ║
║   POST /api/sync/:weekId   - Trigger sync for week           ║
║   GET  /api/daily-metrics  - Daily time series               ║
║   GET  /api/marketplaces   - Marketplace breakdown           ║
║   GET  /api/wallet/:addr   - Wallet profile                  ║
║   GET  /api/network        - Network graph data              ║
║   GET  /api/search?q=      - Search addresses                ║
║   GET  /api/whales         - Top wallets                     ║
║   GET  /api/cex-flow       - CEX flow stats                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  if (storage) {
    storage.close();
  }
  process.exit(0);
});
