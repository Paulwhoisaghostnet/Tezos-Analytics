/**
 * Generate Charts Module
 * Create HTML page with Chart.js visualizations
 */

import { Storage } from './storage';
import { PipelineConfig, isObjktMarketplace } from './config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generate HTML charts page
 */
export function generateCharts(config: PipelineConfig, storage: Storage): void {
  console.log('\n=== Generating Charts ===');
  
  // Gather data
  const dailyMetrics = storage.getAllDailyMetrics();
  const marketplaceStats = storage.getAllMarketplaceStats();
  const dailyMarketplaceFees = storage.getAllDailyMarketplaceFees();
  const buyerCexFlow = storage.getAllBuyerCexFlow();
  const creatorFundFlow = storage.getAllCreatorFundFlow();
  
  // Prepare chart data
  const dates = dailyMetrics.map(m => m.date);
  const volumes = dailyMetrics.map(m => m.total_volume_mutez / 1_000_000);
  const avgPrices = dailyMetrics.map(m => m.avg_sale_price_mutez ? m.avg_sale_price_mutez / 1_000_000 : 0);
  const uniqueBuyers = dailyMetrics.map(m => m.unique_buyers);
  const uniqueSellers = dailyMetrics.map(m => m.unique_sellers);
  
  // Marketplace pie chart data
  const mpLabels = marketplaceStats.map(m => m.marketplace);
  const mpVolumes = marketplaceStats.map(m => m.volume_mutez / 1_000_000);
  const mpColors = mpLabels.map(label => 
    isObjktMarketplace(label) ? '#3B82F6' : // Blue for objkt
    label.includes('teia') ? '#10B981' : // Green for teia
    label.includes('fxhash') ? '#8B5CF6' : // Purple for fxhash
    '#6B7280' // Gray for others
  );
  
  // Daily fees by objkt vs others
  const objktDailyFees: Map<string, number> = new Map();
  const otherDailyFees: Map<string, number> = new Map();
  
  for (const row of dailyMarketplaceFees) {
    if (isObjktMarketplace(row.marketplace)) {
      objktDailyFees.set(row.date, (objktDailyFees.get(row.date) || 0) + row.fees_mutez);
    } else {
      otherDailyFees.set(row.date, (otherDailyFees.get(row.date) || 0) + row.fees_mutez);
    }
  }
  
  const feesDates = Array.from(new Set([...objktDailyFees.keys(), ...otherDailyFees.keys()])).sort();
  const objktFeesData = feesDates.map(d => (objktDailyFees.get(d) || 0) / 1_000_000);
  const otherFeesData = feesDates.map(d => (otherDailyFees.get(d) || 0) / 1_000_000);
  
  // Calculate totals for display
  const totalObjktFees = storage.getObjktTotalFees() / 1_000_000;
  const objktMarketShare = storage.getObjktMarketShare();
  
  // CEX flow data
  const totalFromCex = buyerCexFlow.reduce((sum, b) => sum + b.cex_funding_mutez, 0) / 1_000_000;
  const totalToCex = creatorFundFlow.reduce((sum, c) => sum + c.sent_to_cex_mutez, 0) / 1_000_000;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tezos NFT Market Analytics - 30 Day Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      margin: 0;
      padding: 20px;
    }
    h1 { text-align: center; color: #38bdf8; margin-bottom: 10px; }
    .subtitle { text-align: center; color: #94a3b8; margin-bottom: 30px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 20px; }
    .chart-container {
      background: #1e293b;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    .chart-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #f1f5f9;
    }
    .chart-subtitle {
      font-size: 14px;
      color: #94a3b8;
      margin-bottom: 10px;
    }
    .stat-highlight {
      font-size: 24px;
      font-weight: bold;
      color: #38bdf8;
    }
    canvas { max-height: 300px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #1e293b;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    .stat-value { font-size: 28px; font-weight: bold; color: #38bdf8; }
    .stat-label { font-size: 12px; color: #94a3b8; margin-top: 5px; }
    .full-width { grid-column: 1 / -1; }
  </style>
</head>
<body>
  <h1>Tezos NFT Market Analytics</h1>
  <p class="subtitle">30-Day Analysis Report | Generated ${new Date().toISOString().split('T')[0]}</p>
  
  <div class="summary-grid">
    <div class="stat-card">
      <div class="stat-value">${objktMarketShare.toFixed(1)}%</div>
      <div class="stat-label">Objkt Market Share</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalObjktFees.toFixed(1)} XTZ</div>
      <div class="stat-label">Objkt Fees (30 days)</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalFromCex.toFixed(1)} XTZ</div>
      <div class="stat-label">From CEX</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalToCex.toFixed(1)} XTZ</div>
      <div class="stat-label">To CEX</div>
    </div>
  </div>
  
  <div class="grid">
    <!-- Chart 1: Daily Average Sale Price -->
    <div class="chart-container">
      <div class="chart-title">Daily Average Sale Price</div>
      <div class="chart-subtitle">Average NFT sale price over 30 days</div>
      <canvas id="priceChart"></canvas>
    </div>
    
    <!-- Chart 2: Daily Activity -->
    <div class="chart-container">
      <div class="chart-title">Daily Activity</div>
      <div class="chart-subtitle">Volume, Buyers, and Sellers over time</div>
      <canvas id="activityChart"></canvas>
    </div>
    
    <!-- Chart 3: Daily Marketplace Fees -->
    <div class="chart-container">
      <div class="chart-title">Daily Marketplace Fee Revenue</div>
      <div class="chart-subtitle">Estimated fees earned by Objkt vs Others</div>
      <canvas id="feesChart"></canvas>
    </div>
    
    <!-- Chart 4: Marketplace Volume Share -->
    <div class="chart-container">
      <div class="chart-title">Marketplace Volume Share</div>
      <div class="chart-subtitle">Distribution of sales volume by marketplace</div>
      <canvas id="marketShareChart"></canvas>
    </div>
    
    <!-- Chart 5: CEX Flow -->
    <div class="chart-container">
      <div class="chart-title">CEX Flow Summary</div>
      <div class="chart-subtitle">XTZ movement to/from centralized exchanges</div>
      <canvas id="cexFlowChart"></canvas>
    </div>
  </div>

  <script>
    // Chart 1: Daily Average Sale Price
    new Chart(document.getElementById('priceChart'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(dates)},
        datasets: [{
          label: 'Avg Price (XTZ)',
          data: ${JSON.stringify(avgPrices)},
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 45 } }
        }
      }
    });

    // Chart 2: Daily Activity (3 lines)
    new Chart(document.getElementById('activityChart'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(dates)},
        datasets: [
          {
            label: 'Volume (XTZ)',
            data: ${JSON.stringify(volumes)},
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            yAxisID: 'y',
            tension: 0.3
          },
          {
            label: 'Unique Buyers',
            data: ${JSON.stringify(uniqueBuyers)},
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            yAxisID: 'y1',
            tension: 0.3
          },
          {
            label: 'Unique Sellers',
            data: ${JSON.stringify(uniqueSellers)},
            borderColor: '#8b5cf6',
            backgroundColor: 'transparent',
            yAxisID: 'y1',
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { 
            type: 'linear', position: 'left',
            title: { display: true, text: 'Volume (XTZ)', color: '#94a3b8' },
            grid: { color: '#334155' }, ticks: { color: '#94a3b8' }
          },
          y1: {
            type: 'linear', position: 'right',
            title: { display: true, text: 'Count', color: '#94a3b8' },
            grid: { display: false }, ticks: { color: '#94a3b8' }
          },
          x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 45 } }
        },
        plugins: { legend: { labels: { color: '#e2e8f0' } } }
      }
    });

    // Chart 3: Daily Marketplace Fees
    new Chart(document.getElementById('feesChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(feesDates)},
        datasets: [
          {
            label: 'Objkt Fees (XTZ)',
            data: ${JSON.stringify(objktFeesData)},
            backgroundColor: '#3b82f6'
          },
          {
            label: 'Other Fees (XTZ)',
            data: ${JSON.stringify(otherFeesData)},
            backgroundColor: '#6b7280'
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: { stacked: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
          x: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 45 } }
        },
        plugins: { legend: { labels: { color: '#e2e8f0' } } }
      }
    });

    // Chart 4: Marketplace Volume Share (Pie)
    new Chart(document.getElementById('marketShareChart'), {
      type: 'doughnut',
      data: {
        labels: ${JSON.stringify(mpLabels)},
        datasets: [{
          data: ${JSON.stringify(mpVolumes)},
          backgroundColor: ${JSON.stringify(mpColors)},
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right', labels: { color: '#e2e8f0' } }
        }
      }
    });

    // Chart 5: CEX Flow
    new Chart(document.getElementById('cexFlowChart'), {
      type: 'bar',
      data: {
        labels: ['XTZ Flow'],
        datasets: [
          {
            label: 'From CEX (Inflow)',
            data: [${totalFromCex.toFixed(2)}],
            backgroundColor: '#10b981'
          },
          {
            label: 'To CEX (Outflow)',
            data: [${totalToCex.toFixed(2)}],
            backgroundColor: '#ef4444'
          }
        ]
      },
      options: {
        responsive: true,
        indexAxis: 'y',
        scales: {
          x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
          y: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { labels: { color: '#e2e8f0' } } }
      }
    });
  </script>
</body>
</html>`;

  // Write HTML file
  const outDir = config.outputDir;
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const htmlPath = path.join(outDir, 'charts.html');
  fs.writeFileSync(htmlPath, html);
  
  console.log(`Charts written to ${htmlPath}`);
  console.log('Open in browser to view interactive charts.');
}
