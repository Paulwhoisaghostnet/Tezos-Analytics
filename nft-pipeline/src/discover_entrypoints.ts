/**
 * Entrypoint Discovery Script
 * Works from local database after sync
 */

import { DEFAULT_CONFIG, PipelineConfig } from './config';
import { Storage } from './storage';
import * as fs from 'fs';
import * as path from 'path';

interface EntrypointCount {
  entrypoint: string;
  count: number;
  target: string;
}

/**
 * Discover top entrypoints from local data
 */
export function discoverEntrypoints(config: PipelineConfig, storage: Storage): void {
  console.log('\n=== Entrypoint Discovery (from local data) ===');
  
  const marketplaceAddresses = config.marketplaces.map(m => m.address);
  
  const counts = storage.getEntrypointCounts(marketplaceAddresses);
  
  if (counts.length === 0) {
    console.log('No transactions in local database. Run sync first!');
    return;
  }
  
  const byMarketplace: Record<string, EntrypointCount[]> = {};
  for (const count of counts) {
    const mp = config.marketplaces.find(m => m.address === count.target);
    const name = mp?.name || count.target;
    if (!byMarketplace[name]) {
      byMarketplace[name] = [];
    }
    byMarketplace[name].push(count);
  }
  
  const results: Record<string, EntrypointCount[]> = {};
  
  for (const [mpName, entrypoints] of Object.entries(byMarketplace)) {
    const totalTxs = entrypoints.reduce((sum, e) => sum + e.count, 0);
    console.log(`\n${mpName} (${totalTxs} total transactions):`);
    
    const sorted = entrypoints.sort((a, b) => b.count - a.count);
    results[mpName] = sorted;
    
    for (const ep of sorted.slice(0, 15)) {
      const pct = ((ep.count / totalTxs) * 100).toFixed(1);
      console.log(`  ${ep.entrypoint}: ${ep.count} (${pct}%)`);
    }
    
    const buyLikely = sorted.filter(ep => 
      ['collect', 'fulfill_ask', 'buy', 'listing_accept', 'conclude_auction', 'bid'].includes(ep.entrypoint)
    );
    const listLikely = sorted.filter(ep =>
      ['ask', 'create_ask', 'list', 'swap', 'listing', 'create_auction'].includes(ep.entrypoint)
    );
    const offerLikely = sorted.filter(ep =>
      ['fulfill_offer', 'accept_offer', 'acceptOffer', 'offer_accept'].includes(ep.entrypoint)
    );
    
    if (buyLikely.length > 0) {
      console.log(`\n  Detected BUY: ${buyLikely.map(e => e.entrypoint).join(', ')}`);
    }
    if (listLikely.length > 0) {
      console.log(`  Detected LIST: ${listLikely.map(e => e.entrypoint).join(', ')}`);
    }
    if (offerLikely.length > 0) {
      console.log(`  Detected OFFER ACCEPT: ${offerLikely.map(e => e.entrypoint).join(', ')}`);
    }
  }
  
  const outDir = config.outputDir;
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const debugPath = path.join(outDir, 'debug_entrypoints.json');
  fs.writeFileSync(debugPath, JSON.stringify(results, null, 2));
  console.log(`\nEntrypoint analysis written to ${debugPath}`);
}

// Run if executed directly
if (require.main === module) {
  (async () => {
    const storage = await Storage.create(DEFAULT_CONFIG.dbPath);
    try {
      discoverEntrypoints(DEFAULT_CONFIG, storage);
    } finally {
      storage.close();
    }
  })();
}
