/**
 * Derive Daily Metrics Module
 * Calculate daily time-series aggregates from purchase data
 */
import { Storage } from './storage';
/**
 * Derive daily metrics from purchases
 */
export declare function deriveDailyMetrics(storage: Storage): void;
/**
 * Calculate volume trend
 */
export declare function calculateVolumeTrend(storage: Storage): {
    trend: 'up' | 'down' | 'flat';
    percent: number;
};
//# sourceMappingURL=derive_daily_metrics.d.ts.map