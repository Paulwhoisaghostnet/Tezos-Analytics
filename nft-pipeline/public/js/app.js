/**
 * Tezos Analytics Dashboard - Main Application
 */

const API_BASE = '/api';

// State
let charts = {};
let currentView = 'overview';
let networkSimulation = null;

// ==================== UTILITIES ====================

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatXtz(n) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XTZ';
}

function truncateAddress(addr) {
  if (!addr) return '';
  return addr.slice(0, 8) + '...' + addr.slice(-4);
}

async function fetchApi(endpoint) {
  try {
    const res = await fetch(API_BASE + endpoint);
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }
    return res.json();
  } catch (err) {
    console.error(`Failed to fetch ${endpoint}:`, err);
    throw err;
  }
}

function showError(containerId, message) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `<div class="error">${message}</div>`;
  }
}

function showLoading(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '<div class="loading">Loading...</div>';
  }
}

function showEmpty(containerId, message = 'No data available') {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <p>${message}</p>
      </div>
    `;
  }
}

// ==================== NAVIGATION ====================

function switchView(view) {
  currentView = view;
  
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  
  // Update views
  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('active', v.id === `view-${view}`);
  });
  
  // Load view-specific data
  switch (view) {
    case 'overview':
      loadOverview();
      break;
    case 'charts':
      loadCharts();
      break;
    case 'network':
      loadNetwork();
      break;
    case 'whales':
      loadWhales();
      break;
    case 'sync':
      loadSyncStatus();
      break;
  }
}

// ==================== OVERVIEW ====================

async function loadOverview() {
  try {
    const [stats, metrics, marketplaces] = await Promise.all([
      fetchApi('/stats'),
      fetchApi('/daily-metrics'),
      fetchApi('/marketplaces')
    ]);
    
    // Update stat cards
    document.getElementById('stat-purchases').textContent = formatNumber(stats.purchases);
    document.getElementById('stat-buyers').textContent = formatNumber(stats.buyers);
    document.getElementById('stat-creators').textContent = formatNumber(stats.creators);
    document.getElementById('stat-volume').textContent = formatXtz(stats.totalVolume / 1000000);
    
    // Volume chart
    createLineChart('chart-volume', {
      labels: metrics.map(m => m.date),
      datasets: [{
        label: 'Volume (XTZ)',
        data: metrics.map(m => m.volumeXtz),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true
      }]
    });
    
    // Marketplaces pie chart
    createPieChart('chart-marketplaces', {
      labels: marketplaces.map(m => m.marketplace),
      datasets: [{
        data: marketplaces.map(m => m.volumeXtz),
        backgroundColor: [
          '#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'
        ]
      }]
    });
    
    // Users chart
    createLineChart('chart-users', {
      labels: metrics.map(m => m.date),
      datasets: [
        {
          label: 'Buyers',
          data: metrics.map(m => m.uniqueBuyers),
          borderColor: '#22c55e',
          backgroundColor: 'transparent'
        },
        {
          label: 'Sellers',
          data: metrics.map(m => m.uniqueSellers),
          borderColor: '#f59e0b',
          backgroundColor: 'transparent'
        }
      ]
    });
  } catch (err) {
    console.error('Failed to load overview:', err);
  }
}

// ==================== CHARTS ====================

async function loadCharts() {
  try {
    const metrics = await fetchApi('/daily-metrics');
    
    createLineChart('chart-volume-full', {
      labels: metrics.map(m => m.date),
      datasets: [{
        label: 'Volume (XTZ)',
        data: metrics.map(m => m.volumeXtz),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true
      }]
    });
    
    createLineChart('chart-avg-price', {
      labels: metrics.map(m => m.date),
      datasets: [{
        label: 'Avg Price (XTZ)',
        data: metrics.map(m => m.avgPriceXtz),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true
      }]
    });
    
    createLineChart('chart-sales-count', {
      labels: metrics.map(m => m.date),
      datasets: [{
        label: 'Sales',
        data: metrics.map(m => m.saleCount),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true
      }]
    });
  } catch (err) {
    console.error('Failed to load charts:', err);
  }
}

function createLineChart(canvasId, data) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  
  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }
  
  charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8' }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b' },
          grid: { color: '#334155' }
        },
        y: {
          ticks: { color: '#64748b' },
          grid: { color: '#334155' }
        }
      }
    }
  });
}

function createPieChart(canvasId, data) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  
  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }
  
  charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#94a3b8' }
        }
      }
    }
  });
}

// ==================== NETWORK ====================

async function loadNetwork(filterWallet = null) {
  const container = document.getElementById('network-container');
  container.innerHTML = '<div class="loading">Loading network data...</div>';
  
  try {
    const url = filterWallet ? `/network?wallet=${filterWallet}` : '/network';
    const graph = await fetchApi(url);
    
    if (!graph.nodes || graph.nodes.length === 0) {
      container.innerHTML = '<div class="loading">No network data available. Run sync-week first.</div>';
      return;
    }
    
    renderNetwork(container, graph);
  } catch (err) {
    console.error('Failed to load network:', err);
    container.innerHTML = '<div class="loading">Failed to load network data.</div>';
  }
}

function renderNetwork(container, graph) {
  container.innerHTML = '';
  
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  const g = svg.append('g');
  
  // Zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 10])
    .on('zoom', (event) => g.attr('transform', event.transform));
  
  svg.call(zoom);
  
  // Node colors
  const nodeColors = {
    wallet: '#4a9eff',
    contract: '#9c27b0',
    marketplace: '#4caf50',
    cex: '#ff9800',
    bridge: '#00bcd4'
  };
  
  // Force simulation
  const simulation = d3.forceSimulation(graph.nodes)
    .force('link', d3.forceLink(graph.edges).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-150))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => d.size + 3));
  
  // Links
  const links = g.append('g')
    .selectAll('line')
    .data(graph.edges)
    .join('line')
    .attr('stroke', d => d.color)
    .attr('stroke-width', d => Math.max(1, Math.log10(d.value + 1)));
  
  // Nodes
  const nodes = g.append('g')
    .selectAll('circle')
    .data(graph.nodes)
    .join('circle')
    .attr('r', d => d.size)
    .attr('fill', d => nodeColors[d.type] || '#999')
    .style('cursor', 'pointer')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));
  
  // Labels
  const labels = g.append('g')
    .selectAll('text')
    .data(graph.nodes.filter(n => n.size > 8))
    .join('text')
    .attr('dx', d => d.size + 3)
    .attr('dy', 4)
    .attr('fill', '#94a3b8')
    .attr('font-size', '10px')
    .text(d => d.label);
  
  // Node click - open wallet inspector
  nodes.on('click', (event, d) => {
    openWalletInspector(d.id);
  });
  
  // Simulation tick
  simulation.on('tick', () => {
    links
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    
    nodes
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);
    
    labels
      .attr('x', d => d.x)
      .attr('y', d => d.y);
  });
  
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
  
  // Initial zoom
  svg.call(zoom.transform, d3.zoomIdentity.translate(100, 50).scale(0.8));
  
  networkSimulation = simulation;
}

// ==================== WHALES ====================

async function loadWhales() {
  try {
    const [whales, cexFlow] = await Promise.all([
      fetchApi('/whales'),
      fetchApi('/cex-flow')
    ]);
    
    // Top buyers table
    const buyersBody = document.querySelector('#table-top-buyers tbody');
    buyersBody.innerHTML = whales.topBuyers.map((b, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>
          <span class="address" onclick="openWalletInspector('${b.address}')">
            ${b.alias || truncateAddress(b.address)}
          </span>
        </td>
        <td>${b.purchaseCount}</td>
        <td>${formatXtz(b.totalSpentXtz)}</td>
      </tr>
    `).join('');
    
    // Top sellers table
    const sellersBody = document.querySelector('#table-top-sellers tbody');
    sellersBody.innerHTML = whales.topSellers.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>
          <span class="address" onclick="openWalletInspector('${s.address}')">
            ${s.alias || truncateAddress(s.address)}
          </span>
        </td>
        <td>${s.saleCount}</td>
        <td>${formatXtz(s.totalReceivedXtz)}</td>
      </tr>
    `).join('');
    
    // CEX flow stats
    document.getElementById('cex-from').textContent = formatXtz(cexFlow.totalFromCexXtz);
    document.getElementById('cex-to').textContent = formatXtz(cexFlow.totalToCexXtz);
    document.getElementById('cex-net').textContent = formatXtz(cexFlow.netFlowXtz);
    document.getElementById('cex-net').className = 
      'cex-stat-value ' + (cexFlow.netFlowXtz >= 0 ? 'positive' : 'negative');
  } catch (err) {
    console.error('Failed to load whales:', err);
  }
}

// ==================== SYNC STATUS ====================

async function loadSyncStatus() {
  try {
    const [syncStatus, stats] = await Promise.all([
      fetchApi('/sync-status'),
      fetchApi('/stats')
    ]);
    
    // Render sync progress
    const progressEl = document.getElementById('sync-progress');
    progressEl.innerHTML = syncStatus.weeks.map(w => {
      const icon = w.status === 'complete' ? '✓' :
                   w.status === 'in_progress' ? '⟳' :
                   w.status === 'error' ? '✗' : '○';
      
      const stats = w.status === 'complete' 
        ? `${formatNumber(w.txCount)} txs, ${formatNumber(w.flowCount)} flows`
        : '';
      
      return `
        <div class="sync-week">
          <div class="sync-week-status ${w.status}">${icon}</div>
          <div class="sync-week-info">
            <div class="sync-week-id">${w.id.toUpperCase()}</div>
            <div class="sync-week-dates">${w.label}</div>
            ${stats ? `<div class="sync-week-stats">${stats}</div>` : ''}
          </div>
          ${w.status !== 'complete' ? `
            <button class="btn sync-week-btn" onclick="triggerSync('${w.id}')">
              Sync Now
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
    
    // Data summary
    document.getElementById('summary-txs').textContent = formatNumber(stats.allTransactions);
    document.getElementById('summary-flows').textContent = formatNumber(stats.xtzFlows);
    document.getElementById('summary-addresses').textContent = 
      `${formatNumber(stats.resolvedAddresses)} / ${formatNumber(stats.addressRegistry)}`;
  } catch (err) {
    console.error('Failed to load sync status:', err);
  }
}

async function triggerSync(weekId) {
  try {
    await fetch(`${API_BASE}/sync/${weekId}`, { method: 'POST' });
    alert(`Sync started for ${weekId}. This will run in the background.`);
    setTimeout(loadSyncStatus, 2000);
  } catch (err) {
    alert('Failed to start sync');
  }
}

// ==================== WALLET INSPECTOR ====================

async function openWalletInspector(address) {
  const modal = document.getElementById('wallet-modal');
  const profile = document.getElementById('wallet-profile');
  
  modal.classList.remove('hidden');
  profile.innerHTML = '<div class="loading">Loading wallet profile...</div>';
  
  try {
    const [wallet, transactions] = await Promise.all([
      fetchApi(`/wallet/${address}`),
      fetchApi(`/wallet/${address}/transactions`)
    ]);
    
    profile.innerHTML = `
      <div class="wallet-header">
        <div class="wallet-alias">${wallet.alias || wallet.tezosDomain || 'Unknown'}</div>
        <div class="wallet-address">${address}</div>
        ${wallet.ownedDomains.length > 0 ? `
          <div class="wallet-domains">
            ${wallet.ownedDomains.map(d => `<span class="wallet-domain">${d}</span>`).join('')}
          </div>
        ` : ''}
      </div>
      
      <div class="wallet-stats">
        <div class="wallet-stat">
          <div class="wallet-stat-label">Purchases</div>
          <div class="wallet-stat-value">${wallet.purchases.count}</div>
        </div>
        <div class="wallet-stat">
          <div class="wallet-stat-label">Purchase Volume</div>
          <div class="wallet-stat-value">${formatXtz(wallet.purchases.totalXtz)}</div>
        </div>
        <div class="wallet-stat">
          <div class="wallet-stat-label">Sales</div>
          <div class="wallet-stat-value">${wallet.sales.count}</div>
        </div>
        <div class="wallet-stat">
          <div class="wallet-stat-label">Sales Volume</div>
          <div class="wallet-stat-value">${formatXtz(wallet.sales.totalXtz)}</div>
        </div>
      </div>
      
      ${wallet.xtzFlow ? `
        <h4 style="margin: 1rem 0 0.5rem; color: var(--text-secondary);">XTZ Flow</h4>
        <div class="wallet-stats">
          <div class="wallet-stat">
            <div class="wallet-stat-label">From CEX</div>
            <div class="wallet-stat-value">${formatXtz(wallet.xtzFlow.fromCexXtz)}</div>
          </div>
          <div class="wallet-stat">
            <div class="wallet-stat-label">To CEX</div>
            <div class="wallet-stat-value">${formatXtz(wallet.xtzFlow.toCexXtz)}</div>
          </div>
          <div class="wallet-stat">
            <div class="wallet-stat-label">From L2</div>
            <div class="wallet-stat-value">${formatXtz(wallet.xtzFlow.fromL2Xtz)}</div>
          </div>
          <div class="wallet-stat">
            <div class="wallet-stat-label">To L2</div>
            <div class="wallet-stat-value">${formatXtz(wallet.xtzFlow.toL2Xtz)}</div>
          </div>
        </div>
      ` : ''}
      
      <h4 style="margin: 1rem 0 0.5rem; color: var(--text-secondary);">Recent Activity</h4>
      <table class="data-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Date</th>
            <th>Counterparty</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.slice(0, 10).map(tx => `
            <tr>
              <td>${tx.type === 'purchase' ? '🛒 Buy' : '💰 Sell'}</td>
              <td>${new Date(tx.ts).toLocaleDateString()}</td>
              <td class="address" onclick="openWalletInspector('${tx.counterparty}')">${truncateAddress(tx.counterparty)}</td>
              <td>${formatXtz(tx.amountXtz)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    profile.innerHTML = '<div class="loading">Failed to load wallet profile.</div>';
  }
}

function closeWalletModal() {
  document.getElementById('wallet-modal').classList.add('hidden');
}

// ==================== SEARCH ====================

let searchTimeout = null;

async function handleSearch(query) {
  const resultsEl = document.getElementById('search-results');
  
  if (query.length < 3) {
    resultsEl.classList.add('hidden');
    return;
  }
  
  try {
    const results = await fetchApi(`/search?q=${encodeURIComponent(query)}`);
    
    if (results.length === 0) {
      resultsEl.classList.add('hidden');
      return;
    }
    
    resultsEl.innerHTML = results.map(r => `
      <div class="search-result" onclick="openWalletInspector('${r.address}')">
        <div class="alias">${r.alias || r.tezos_domain || 'Unknown'}</div>
        <div class="address">${r.address}</div>
      </div>
    `).join('');
    
    resultsEl.classList.remove('hidden');
  } catch (err) {
    resultsEl.classList.add('hidden');
  }
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  
  // Search
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => handleSearch(e.target.value), 300);
  });
  
  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.header-search')) {
      document.getElementById('search-results').classList.add('hidden');
    }
  });
  
  // Network filter
  document.getElementById('network-filter-btn')?.addEventListener('click', () => {
    const wallet = document.getElementById('network-filter').value.trim();
    loadNetwork(wallet || null);
  });
  
  document.getElementById('network-reset-btn')?.addEventListener('click', () => {
    document.getElementById('network-filter').value = '';
    loadNetwork();
  });
  
  // Modal close
  document.querySelector('.modal-close')?.addEventListener('click', closeWalletModal);
  document.getElementById('wallet-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'wallet-modal') closeWalletModal();
  });
  
  // Initial load
  loadOverview();
});

// Make functions available globally for onclick handlers
window.openWalletInspector = openWalletInspector;
window.triggerSync = triggerSync;
