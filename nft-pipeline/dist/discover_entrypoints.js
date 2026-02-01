"use strict";
/**
 * Entrypoint Discovery Script
 * Works from local database after sync
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
exports.discoverEntrypoints = discoverEntrypoints;
const config_1 = require("./config");
const storage_1 = require("./storage");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Discover top entrypoints from local data
 */
function discoverEntrypoints(config, storage) {
    console.log('\n=== Entrypoint Discovery (from local data) ===');
    const marketplaceAddresses = config.marketplaces.map(m => m.address);
    const counts = storage.getEntrypointCounts(marketplaceAddresses);
    if (counts.length === 0) {
        console.log('No transactions in local database. Run sync first!');
        return;
    }
    const byMarketplace = {};
    for (const count of counts) {
        const mp = config.marketplaces.find(m => m.address === count.target);
        const name = mp?.name || count.target;
        if (!byMarketplace[name]) {
            byMarketplace[name] = [];
        }
        byMarketplace[name].push(count);
    }
    const results = {};
    for (const [mpName, entrypoints] of Object.entries(byMarketplace)) {
        const totalTxs = entrypoints.reduce((sum, e) => sum + e.count, 0);
        console.log(`\n${mpName} (${totalTxs} total transactions):`);
        const sorted = entrypoints.sort((a, b) => b.count - a.count);
        results[mpName] = sorted;
        for (const ep of sorted.slice(0, 15)) {
            const pct = ((ep.count / totalTxs) * 100).toFixed(1);
            console.log(`  ${ep.entrypoint}: ${ep.count} (${pct}%)`);
        }
        const buyLikely = sorted.filter(ep => ['collect', 'fulfill_ask', 'buy', 'listing_accept', 'conclude_auction', 'bid'].includes(ep.entrypoint));
        const listLikely = sorted.filter(ep => ['ask', 'create_ask', 'list', 'swap', 'listing', 'create_auction'].includes(ep.entrypoint));
        const offerLikely = sorted.filter(ep => ['fulfill_offer', 'accept_offer', 'acceptOffer', 'offer_accept'].includes(ep.entrypoint));
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
        const storage = await storage_1.Storage.create(config_1.DEFAULT_CONFIG.dbPath);
        try {
            discoverEntrypoints(config_1.DEFAULT_CONFIG, storage);
        }
        finally {
            storage.close();
        }
    })();
}
//# sourceMappingURL=discover_entrypoints.js.map