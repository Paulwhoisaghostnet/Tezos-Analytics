"use strict";
/**
 * Export Module
 * Generate CSV and JSON outputs from pipeline data
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportData = exportData;
exports.printSummary = printSummary;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const papaparse_1 = __importDefault(require("papaparse"));
const derive_daily_metrics_1 = require("./derive_daily_metrics");
const derive_marketplace_fees_1 = require("./derive_marketplace_fees");
const derive_fund_flow_1 = require("./derive_fund_flow");
/**
 * Convert mutez to XTZ
 */
function mutezToXtz(mutez) {
    if (mutez === null)
        return null;
    return mutez / 1_000_000;
}
/**
 * Calculate summary statistics
 */
function calculateSummary(storage, startISO, endISO) {
    const buyerCount = storage.getBuyerCount();
    const creatorCount = storage.getCreatorCount();
    const purchaseCount = storage.getPurchaseCount();
    const mintCount = storage.getMintCount();
    const mintedQty = storage.getTotalMintedQty();
    const listingCount = storage.getListingCount();
    const editionsListed = storage.getTotalEditionsListed();
    const distinctTokens = storage.getDistinctTokensListed();
    const offerAcceptCount = storage.getOfferAcceptCount();
    const offerAcceptsWithBothPrices = storage.getOfferAcceptsWithBothPrices();
    const underListCount = storage.getUnderListCount();
    const resaleCount = storage.getResaleCount();
    const totalSpend = storage.getTotalSpendMutez();
    const totalResaleProceeds = storage.getTotalResaleProceeds();
    const overlap = storage.getBuyerCreatorOverlap();
    const resales = storage.getAllResales();
    const uniqueResellers = new Set(resales.map(r => r.seller_collector)).size;
    // Volume trend
    const volumeTrend = (0, derive_daily_metrics_1.calculateVolumeTrend)(storage);
    // Marketplace breakdown
    const marketplaceBreakdown = (0, derive_marketplace_fees_1.getMarketplaceBreakdown)(storage);
    // Objkt stats
    const objktMarketShare = storage.getObjktMarketShare();
    const objktTotalFees = storage.getObjktTotalFees() / 1_000_000;
    // CEX flow
    const fundFlow = (0, derive_fund_flow_1.calculateFundFlowSummary)(storage);
    const buyersWithCex = storage.getBuyersWithCexFundingCount();
    const salesOnlyBuyers = storage.getSalesOnlyBuyersCount();
    const totalCexFunding = storage.getTotalCexFunding() / 1_000_000;
    return {
        windowStart: startISO,
        windowEnd: endISO,
        unique_buyers_count: buyerCount,
        total_purchases_count: purchaseCount,
        total_spend_xtz: mutezToXtz(totalSpend) || 0,
        purchases_per_buyer: buyerCount > 0 ? purchaseCount / buyerCount : 0,
        unique_creators_count: creatorCount,
        total_mints_count: mintCount,
        total_minted_qty: mintedQty,
        total_listings_count: listingCount,
        total_editions_listed: editionsListed,
        distinct_tokens_listed: distinctTokens,
        total_offer_accepts_count: offerAcceptCount,
        offer_accepts_with_both_prices: offerAcceptsWithBothPrices,
        under_list_count: underListCount,
        under_list_rate: offerAcceptsWithBothPrices > 0
            ? (underListCount / offerAcceptsWithBothPrices) * 100
            : null,
        total_resales_count: resaleCount,
        total_resale_proceeds_xtz: mutezToXtz(totalResaleProceeds) || 0,
        unique_resellers_count: uniqueResellers,
        overlap_count: overlap.length,
        overlap_rate_of_buyers: buyerCount > 0 ? (overlap.length / buyerCount) * 100 : 0,
        overlap_rate_of_creators: creatorCount > 0 ? (overlap.length / creatorCount) * 100 : 0,
        listings_per_buyer: buyerCount > 0 ? listingCount / buyerCount : 0,
        editions_listed_per_buyer: buyerCount > 0 ? editionsListed / buyerCount : 0,
        creators_per_buyer: buyerCount > 0 ? creatorCount / buyerCount : 0,
        choice_overload_proxy: buyerCount > 0 ? distinctTokens / buyerCount : 0,
        volume_trend: volumeTrend.trend,
        volume_trend_percent: volumeTrend.percent,
        marketplace_breakdown: marketplaceBreakdown,
        objkt_market_share_percent: objktMarketShare,
        objkt_total_fees_xtz: objktTotalFees,
        cex_flow: {
            total_xtz_from_cex: totalCexFunding,
            total_xtz_to_cex: fundFlow.total_xtz_to_cex,
            net_ecosystem_flow: totalCexFunding - fundFlow.total_xtz_to_cex,
            buyers_with_cex_funding: buyersWithCex,
            buyers_with_cex_funding_percent: buyerCount > 0 ? (buyersWithCex / buyerCount) * 100 : 0,
            sales_only_buyers: salesOnlyBuyers,
            sales_only_buyers_percent: buyerCount > 0 ? (salesOnlyBuyers / buyerCount) * 100 : 0,
            creators_who_bought_nfts: fundFlow.creators_who_bought_nfts,
            creators_who_bought_nfts_percent: fundFlow.creators_who_bought_nfts_percent,
            creators_who_cashed_out: fundFlow.creators_who_cashed_out,
            creators_who_cashed_out_percent: fundFlow.creators_who_cashed_out_percent
        }
    };
}
/**
 * Export all data to CSV and JSON files (synchronous - works from local data only)
 */
function exportData(config, storage, startISO, endISO) {
    console.log('\n=== Exporting Data ===');
    const outDir = config.outputDir;
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    // 1. Summary JSON
    const summary = calculateSummary(storage, startISO, endISO);
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log('  Written: summary.json');
    // 2. Buyers CSV
    const buyers = storage.getAllBuyers();
    const buyerRows = buyers.map(address => {
        const balance = storage.getBuyerBalance(address);
        const purchases = storage.getPurchasesByBuyer(address);
        const totalQty = purchases.reduce((sum, p) => sum + p.qty, 0);
        const totalSpend = purchases.reduce((sum, p) => sum + (p.spend_mutez || 0), 0);
        return {
            address,
            start_balance_xtz: mutezToXtz(balance?.balance_mutez ?? null),
            total_purchases: purchases.length,
            total_qty: totalQty,
            total_spend_xtz: mutezToXtz(totalSpend)
        };
    });
    fs.writeFileSync(path.join(outDir, 'buyers.csv'), papaparse_1.default.unparse(buyerRows));
    console.log(`  Written: buyers.csv (${buyerRows.length} rows)`);
    // 3. Buyer Purchases CSV
    const allPurchases = storage.getAllPurchases();
    const purchaseRows = allPurchases.map(p => ({
        buyer: p.buyer,
        ts: p.ts,
        op_hash: p.op_hash,
        token_contract: p.token_contract,
        token_id: p.token_id,
        qty: p.qty,
        spend_xtz: mutezToXtz(p.spend_mutez),
        marketplace: p.marketplace,
        kind: p.kind,
        seller: p.seller || ''
    }));
    fs.writeFileSync(path.join(outDir, 'buyer_purchases.csv'), papaparse_1.default.unparse(purchaseRows));
    console.log(`  Written: buyer_purchases.csv (${purchaseRows.length} rows)`);
    // 4. Creators CSV
    const creators = storage.getAllCreators();
    const creatorRows = creators.map(address => {
        const mints = storage.getMintsByCreator(address);
        const totalQty = mints.reduce((sum, m) => sum + m.qty, 0);
        const listings = storage.getListingsByCreator(address);
        const offerAccepts = storage.getOfferAcceptsBySeller(address);
        return {
            address,
            minted_count: mints.length,
            minted_qty_total: totalQty,
            listings_count: listings.length,
            offer_accepts_count: offerAccepts.length
        };
    });
    fs.writeFileSync(path.join(outDir, 'creators.csv'), papaparse_1.default.unparse(creatorRows));
    console.log(`  Written: creators.csv (${creatorRows.length} rows)`);
    // 5. Creator Mints CSV
    const allMints = storage.getAllMints();
    const mintRows = allMints.map(m => ({
        creator: m.creator,
        ts: m.ts,
        op_hash: m.op_hash,
        token_contract: m.token_contract,
        token_id: m.token_id,
        qty: m.qty
    }));
    fs.writeFileSync(path.join(outDir, 'creator_mints.csv'), papaparse_1.default.unparse(mintRows));
    console.log(`  Written: creator_mints.csv (${mintRows.length} rows)`);
    // 6. Creator Listings CSV
    const allListings = storage.getAllListings();
    const listingRows = allListings.map(l => ({
        creator: l.creator,
        ts: l.ts,
        op_hash: l.op_hash,
        token_contract: l.token_contract,
        token_id: l.token_id,
        qty: l.qty,
        list_price_xtz: mutezToXtz(l.list_price_mutez),
        marketplace: l.marketplace
    }));
    fs.writeFileSync(path.join(outDir, 'creator_listings.csv'), papaparse_1.default.unparse(listingRows));
    console.log(`  Written: creator_listings.csv (${listingRows.length} rows)`);
    // 7. Creator Offer Accepts CSV
    const allOfferAccepts = storage.getAllOfferAccepts();
    const offerAcceptRows = allOfferAccepts.map(oa => ({
        creator_seller: oa.creator_seller,
        ts: oa.ts,
        op_hash: oa.op_hash,
        token_contract: oa.token_contract,
        token_id: oa.token_id,
        qty: oa.qty,
        accepted_price_xtz: mutezToXtz(oa.accepted_price_mutez),
        reference_list_price_xtz: mutezToXtz(oa.reference_list_price_mutez),
        under_list: oa.under_list === null ? '' : (oa.under_list ? 'true' : 'false'),
        buyer_offer: oa.buyer_offer || ''
    }));
    fs.writeFileSync(path.join(outDir, 'creator_offer_accepts.csv'), papaparse_1.default.unparse(offerAcceptRows));
    console.log(`  Written: creator_offer_accepts.csv (${offerAcceptRows.length} rows)`);
    // 8. Collector Resales CSV
    const allResales = storage.getAllResales();
    const resaleRows = allResales.map(r => ({
        seller_collector: r.seller_collector,
        ts: r.ts,
        op_hash: r.op_hash,
        token_contract: r.token_contract,
        token_id: r.token_id,
        qty: r.qty,
        proceeds_xtz: mutezToXtz(r.proceeds_mutez),
        buyer: r.buyer || '',
        marketplace: r.marketplace
    }));
    fs.writeFileSync(path.join(outDir, 'collector_resales.csv'), papaparse_1.default.unparse(resaleRows));
    console.log(`  Written: collector_resales.csv (${resaleRows.length} rows)`);
    // 9. Daily Metrics CSV
    const dailyMetrics = storage.getAllDailyMetrics();
    const dailyMetricsRows = dailyMetrics.map(m => ({
        date: m.date,
        total_volume_xtz: mutezToXtz(m.total_volume_mutez),
        avg_sale_price_xtz: m.avg_sale_price_mutez ? mutezToXtz(m.avg_sale_price_mutez) : null,
        sale_count: m.sale_count,
        unique_buyers: m.unique_buyers,
        unique_sellers: m.unique_sellers
    }));
    fs.writeFileSync(path.join(outDir, 'daily_metrics.csv'), papaparse_1.default.unparse(dailyMetricsRows));
    console.log(`  Written: daily_metrics.csv (${dailyMetricsRows.length} rows)`);
    // 10. Marketplace Stats CSV
    const marketplaceStats = storage.getAllMarketplaceStats();
    const mpStatsRows = marketplaceStats.map(s => ({
        marketplace: s.marketplace,
        sale_count: s.sale_count,
        volume_xtz: mutezToXtz(s.volume_mutez),
        volume_percent: s.volume_percent?.toFixed(2),
        estimated_fees_xtz: mutezToXtz(s.estimated_fees_mutez)
    }));
    fs.writeFileSync(path.join(outDir, 'marketplace_stats.csv'), papaparse_1.default.unparse(mpStatsRows));
    console.log(`  Written: marketplace_stats.csv (${mpStatsRows.length} rows)`);
    // 11. Daily Marketplace Fees CSV
    const dailyFees = storage.getAllDailyMarketplaceFees();
    const dailyFeesRows = dailyFees.map(f => ({
        date: f.date,
        marketplace: f.marketplace,
        volume_xtz: mutezToXtz(f.volume_mutez),
        fees_xtz: mutezToXtz(f.fees_mutez),
        sale_count: f.sale_count
    }));
    fs.writeFileSync(path.join(outDir, 'daily_marketplace_fees.csv'), papaparse_1.default.unparse(dailyFeesRows));
    console.log(`  Written: daily_marketplace_fees.csv (${dailyFeesRows.length} rows)`);
    // 12. Buyer CEX Flow CSV
    const buyerCexFlow = storage.getAllBuyerCexFlow();
    const buyerCexRows = buyerCexFlow.map(b => ({
        address: b.address,
        has_cex_funding: b.has_cex_funding,
        cex_funding_xtz: mutezToXtz(b.cex_funding_mutez),
        is_sales_only: b.is_sales_only,
        total_received_xtz: mutezToXtz(b.total_received_mutez),
        total_from_sales_xtz: mutezToXtz(b.total_from_sales_mutez)
    }));
    fs.writeFileSync(path.join(outDir, 'buyer_cex_flow.csv'), papaparse_1.default.unparse(buyerCexRows));
    console.log(`  Written: buyer_cex_flow.csv (${buyerCexRows.length} rows)`);
    // 13. Creator Fund Flow CSV
    const creatorFundFlow = storage.getAllCreatorFundFlow();
    const creatorFlowRows = creatorFundFlow.map(c => ({
        address: c.address,
        total_sales_xtz: mutezToXtz(c.total_sales_mutez),
        sent_to_cex_xtz: mutezToXtz(c.sent_to_cex_mutez),
        spent_on_nfts_xtz: mutezToXtz(c.spent_on_nfts_mutez),
        cashed_out: c.cashed_out,
        bought_nfts: c.bought_nfts
    }));
    fs.writeFileSync(path.join(outDir, 'creator_fund_flow.csv'), papaparse_1.default.unparse(creatorFlowRows));
    console.log(`  Written: creator_fund_flow.csv (${creatorFlowRows.length} rows)`);
    console.log('\n=== Export Complete ===');
    console.log(`All files written to ${outDir}/`);
}
/**
 * Print summary to console
 */
function printSummary(summary) {
    console.log('\n' + '='.repeat(60));
    console.log('TEZOS NFT MARKET PRESSURE - SUMMARY');
    console.log('='.repeat(60));
    console.log(`\nTime Window: ${summary.windowStart} to ${summary.windowEnd}`);
    console.log('\n--- BUYERS ---');
    console.log(`Unique buyers: ${summary.unique_buyers_count.toLocaleString()}`);
    console.log(`Total purchases: ${summary.total_purchases_count.toLocaleString()}`);
    console.log(`Total spend: ${summary.total_spend_xtz.toFixed(2)} XTZ`);
    console.log(`Purchases per buyer: ${summary.purchases_per_buyer.toFixed(2)}`);
    console.log('\n--- CREATORS ---');
    console.log(`Unique creators: ${summary.unique_creators_count.toLocaleString()}`);
    console.log(`Total mints: ${summary.total_mints_count.toLocaleString()}`);
    console.log(`Total minted qty: ${summary.total_minted_qty.toLocaleString()}`);
    console.log('\n--- LISTINGS ---');
    console.log(`Total listings: ${summary.total_listings_count.toLocaleString()}`);
    console.log(`Total editions listed: ${summary.total_editions_listed.toLocaleString()}`);
    console.log(`Distinct tokens listed: ${summary.distinct_tokens_listed.toLocaleString()}`);
    console.log('\n--- OFFER ACCEPTS ---');
    console.log(`Total offer accepts: ${summary.total_offer_accepts_count.toLocaleString()}`);
    console.log(`With both prices: ${summary.offer_accepts_with_both_prices.toLocaleString()}`);
    console.log(`Under list price: ${summary.under_list_count.toLocaleString()}`);
    if (summary.under_list_rate !== null) {
        console.log(`Under-list rate: ${summary.under_list_rate.toFixed(1)}%`);
    }
    console.log('\n--- RESALES ---');
    console.log(`Total resales: ${summary.total_resales_count.toLocaleString()}`);
    console.log(`Total proceeds: ${summary.total_resale_proceeds_xtz.toFixed(2)} XTZ`);
    console.log(`Unique resellers: ${summary.unique_resellers_count.toLocaleString()}`);
    console.log('\n--- OVERLAP (Collectors who are also Creators) ---');
    console.log(`Overlap count: ${summary.overlap_count.toLocaleString()}`);
    console.log(`% of buyers who are creators: ${summary.overlap_rate_of_buyers.toFixed(1)}%`);
    console.log(`% of creators who are buyers: ${summary.overlap_rate_of_creators.toFixed(1)}%`);
    console.log('\n--- SUPPLY PRESSURE ---');
    console.log(`Listings per buyer: ${summary.listings_per_buyer.toFixed(2)}`);
    console.log(`Editions listed per buyer: ${summary.editions_listed_per_buyer.toFixed(2)}`);
    console.log(`Creators per buyer: ${summary.creators_per_buyer.toFixed(2)}`);
    console.log(`Choice overload proxy: ${summary.choice_overload_proxy.toFixed(2)} tokens/buyer`);
    console.log('\n--- VOLUME TREND ---');
    console.log(`Trend: ${summary.volume_trend.toUpperCase()} (${summary.volume_trend_percent >= 0 ? '+' : ''}${summary.volume_trend_percent.toFixed(1)}%)`);
    console.log('\n--- MARKETPLACE BREAKDOWN ---');
    console.log(`Objkt Market Share: ${summary.objkt_market_share_percent.toFixed(1)}%`);
    console.log(`Objkt Total Fees (30 days): ${summary.objkt_total_fees_xtz.toFixed(2)} XTZ`);
    for (const [mp, data] of Object.entries(summary.marketplace_breakdown)) {
        console.log(`  ${mp}: ${data.sale_count} sales, ${data.volume_xtz.toFixed(2)} XTZ (${data.volume_percent.toFixed(1)}%)`);
    }
    console.log('\n--- CEX FLOW ---');
    console.log(`XTZ from CEX to NFT buyers: ${summary.cex_flow.total_xtz_from_cex.toFixed(2)} XTZ`);
    console.log(`XTZ from NFT creators to CEX: ${summary.cex_flow.total_xtz_to_cex.toFixed(2)} XTZ`);
    console.log(`Net ecosystem flow: ${summary.cex_flow.net_ecosystem_flow >= 0 ? '+' : ''}${summary.cex_flow.net_ecosystem_flow.toFixed(2)} XTZ`);
    console.log(`Buyers with CEX funding: ${summary.cex_flow.buyers_with_cex_funding} (${summary.cex_flow.buyers_with_cex_funding_percent.toFixed(1)}%)`);
    console.log(`Sales-only buyers: ${summary.cex_flow.sales_only_buyers} (${summary.cex_flow.sales_only_buyers_percent.toFixed(1)}%)`);
    console.log(`Creators who bought NFTs: ${summary.cex_flow.creators_who_bought_nfts} (${summary.cex_flow.creators_who_bought_nfts_percent.toFixed(1)}%)`);
    console.log(`Creators who cashed out: ${summary.cex_flow.creators_who_cashed_out} (${summary.cex_flow.creators_who_cashed_out_percent.toFixed(1)}%)`);
    console.log('\n' + '='.repeat(60));
}
//# sourceMappingURL=export.js.map