"use strict";
/**
 * Derive Marketplace Fees Module
 * Calculate marketplace breakdown, fees, and market share
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveMarketplaceFees = deriveMarketplaceFees;
exports.getMarketplaceBreakdown = getMarketplaceBreakdown;
const config_1 = require("./config");
/**
 * Get date string (YYYY-MM-DD) from ISO timestamp
 */
function getDateFromTimestamp(ts) {
    return ts.split('T')[0];
}
/**
 * Derive marketplace statistics and fees
 */
function deriveMarketplaceFees(config, storage) {
    console.log('\n=== Deriving Marketplace Fees ===');
    const purchases = storage.getAllPurchases();
    console.log(`Processing ${purchases.length} purchases...`);
    // Aggregate by marketplace
    const marketplaceData = new Map();
    // Daily aggregates by marketplace
    const dailyData = new Map();
    let totalVolume = 0;
    for (const purchase of purchases) {
        const mp = purchase.marketplace;
        const date = getDateFromTimestamp(purchase.ts);
        const amount = purchase.spend_mutez || 0;
        // Aggregate totals
        if (!marketplaceData.has(mp)) {
            marketplaceData.set(mp, { saleCount: 0, volumeMutez: 0 });
        }
        const mpData = marketplaceData.get(mp);
        mpData.saleCount++;
        mpData.volumeMutez += amount;
        totalVolume += amount;
        // Daily breakdown
        if (!dailyData.has(date)) {
            dailyData.set(date, new Map());
        }
        const dayMp = dailyData.get(date);
        if (!dayMp.has(mp)) {
            dayMp.set(mp, { volumeMutez: 0, saleCount: 0 });
        }
        const dayMpData = dayMp.get(mp);
        dayMpData.volumeMutez += amount;
        dayMpData.saleCount++;
    }
    // Insert marketplace stats
    let objktVolume = 0;
    let objktFees = 0;
    for (const [marketplace, data] of marketplaceData.entries()) {
        const feeRate = (0, config_1.getMarketplaceFeeRate)(config, marketplace);
        const estimatedFees = Math.floor(data.volumeMutez * feeRate);
        const volumePercent = totalVolume > 0 ? (data.volumeMutez / totalVolume) * 100 : 0;
        const stats = {
            marketplace,
            sale_count: data.saleCount,
            volume_mutez: data.volumeMutez,
            volume_percent: volumePercent,
            estimated_fees_mutez: estimatedFees
        };
        storage.insertMarketplaceStats(stats);
        if ((0, config_1.isObjktMarketplace)(marketplace)) {
            objktVolume += data.volumeMutez;
            objktFees += estimatedFees;
        }
        console.log(`  ${marketplace}: ${data.saleCount} sales, ${(data.volumeMutez / 1_000_000).toFixed(2)} XTZ (${volumePercent.toFixed(1)}%), fees: ${(estimatedFees / 1_000_000).toFixed(2)} XTZ`);
    }
    // Insert daily marketplace fees
    let dailyRowsInserted = 0;
    for (const [date, marketplaces] of dailyData.entries()) {
        for (const [marketplace, data] of marketplaces.entries()) {
            const feeRate = (0, config_1.getMarketplaceFeeRate)(config, marketplace);
            const fees = Math.floor(data.volumeMutez * feeRate);
            const row = {
                date,
                marketplace,
                volume_mutez: data.volumeMutez,
                fees_mutez: fees,
                sale_count: data.saleCount
            };
            storage.insertDailyMarketplaceFees(row);
            dailyRowsInserted++;
        }
    }
    storage.save();
    const objktMarketShare = totalVolume > 0 ? (objktVolume / totalVolume) * 100 : 0;
    console.log(`\n--- Marketplace Summary ---`);
    console.log(`Total marketplaces: ${marketplaceData.size}`);
    console.log(`Daily rows inserted: ${dailyRowsInserted}`);
    console.log(`\nObjkt Market Share: ${objktMarketShare.toFixed(1)}%`);
    console.log(`Objkt Total Volume: ${(objktVolume / 1_000_000).toFixed(2)} XTZ`);
    console.log(`Objkt Estimated Fees (30 days): ${(objktFees / 1_000_000).toFixed(2)} XTZ`);
}
/**
 * Get marketplace breakdown summary for export
 */
function getMarketplaceBreakdown(storage) {
    const stats = storage.getAllMarketplaceStats();
    const result = {};
    for (const stat of stats) {
        result[stat.marketplace] = {
            sale_count: stat.sale_count,
            volume_xtz: stat.volume_mutez / 1_000_000,
            volume_percent: stat.volume_percent || 0,
            estimated_fees_xtz: stat.estimated_fees_mutez / 1_000_000
        };
    }
    return result;
}
//# sourceMappingURL=derive_marketplace_fees.js.map