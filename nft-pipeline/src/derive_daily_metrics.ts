/**
 * Derive Daily Metrics Module
 * Calculate daily time-series aggregates from purchase data
 */

import { Storage, DailyMetricsRow } from './storage';

/**
 * Get date string (YYYY-MM-DD) from ISO timestamp
 */
function getDateFromTimestamp(ts: string): string {
  return ts.split('T')[0];
}

/**
 * Derive daily metrics from purchases
 */
export function deriveDailyMetrics(storage: Storage): void {
  console.log('\n=== Deriving Daily Metrics ===');
  
  const purchases = storage.getAllPurchases();
  console.log(`Processing ${purchases.length} purchases...`);
  
  // Group purchases by date
  const dailyData: Map<string, {
    volume: number;
    prices: number[];
    buyers: Set<string>;
    sellers: Set<string>;
    count: number;
  }> = new Map();
  
  for (const purchase of purchases) {
    const date = getDateFromTimestamp(purchase.ts);
    
    if (!dailyData.has(date)) {
      dailyData.set(date, {
        volume: 0,
        prices: [],
        buyers: new Set(),
        sellers: new Set(),
        count: 0
      });
    }
    
    const day = dailyData.get(date)!;
    day.count++;
    day.buyers.add(purchase.buyer);
    
    if (purchase.seller) {
      day.sellers.add(purchase.seller);
    }
    
    if (purchase.spend_mutez !== null && purchase.spend_mutez > 0) {
      day.volume += purchase.spend_mutez;
      day.prices.push(purchase.spend_mutez);
    }
  }
  
  // Insert daily metrics
  let insertedCount = 0;
  for (const [date, data] of dailyData.entries()) {
    const avgPrice = data.prices.length > 0 
      ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length 
      : null;
    
    const metrics: DailyMetricsRow = {
      date,
      total_volume_mutez: data.volume,
      avg_sale_price_mutez: avgPrice,
      sale_count: data.count,
      unique_buyers: data.buyers.size,
      unique_sellers: data.sellers.size
    };
    
    storage.insertDailyMetrics(metrics);
    insertedCount++;
  }
  
  storage.save();
  
  console.log(`Inserted ${insertedCount} daily metric rows`);
  
  // Calculate trend
  const allMetrics = storage.getAllDailyMetrics();
  if (allMetrics.length >= 2) {
    const midpoint = Math.floor(allMetrics.length / 2);
    const firstHalf = allMetrics.slice(0, midpoint);
    const secondHalf = allMetrics.slice(midpoint);
    
    const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.total_volume_mutez, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.total_volume_mutez, 0) / secondHalf.length;
    
    const trendPercent = firstHalfAvg > 0 
      ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 
      : 0;
    
    const trend = trendPercent > 5 ? 'up' : (trendPercent < -5 ? 'down' : 'flat');
    
    console.log(`\nVolume trend: ${trend} (${trendPercent.toFixed(1)}%)`);
    console.log(`  First half avg: ${(firstHalfAvg / 1_000_000).toFixed(2)} XTZ/day`);
    console.log(`  Second half avg: ${(secondHalfAvg / 1_000_000).toFixed(2)} XTZ/day`);
  }
}

/**
 * Calculate volume trend
 */
export function calculateVolumeTrend(storage: Storage): { trend: 'up' | 'down' | 'flat'; percent: number } {
  const allMetrics = storage.getAllDailyMetrics();
  
  if (allMetrics.length < 2) {
    return { trend: 'flat', percent: 0 };
  }
  
  const midpoint = Math.floor(allMetrics.length / 2);
  const firstHalf = allMetrics.slice(0, midpoint);
  const secondHalf = allMetrics.slice(midpoint);
  
  const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.total_volume_mutez, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.total_volume_mutez, 0) / secondHalf.length;
  
  const trendPercent = firstHalfAvg > 0 
    ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 
    : 0;
  
  const trend = trendPercent > 5 ? 'up' : (trendPercent < -5 ? 'down' : 'flat');
  
  return { trend, percent: trendPercent };
}
