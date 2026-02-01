"use strict";
/**
 * Network Visualization Data Generator
 * Creates node/edge data for D3.js force-directed graph
 * with heatmap coloring based on XTZ transaction values
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
exports.generateNetworkData = generateNetworkData;
exports.exportNetworkData = exportNetworkData;
exports.generateNetworkVisualization = generateNetworkVisualization;
const config_1 = require("./config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Generate heatmap color from blue (low) to red (high)
 */
function getHeatmapColor(value, min, max) {
    if (max === min)
        return 'rgb(128, 0, 128)'; // Purple for single value
    const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
    // Blue (0) -> Purple (0.5) -> Red (1)
    let r, g, b;
    if (normalized < 0.5) {
        // Blue to Purple
        const t = normalized * 2;
        r = Math.round(128 * t);
        g = 0;
        b = Math.round(255 - 127 * t);
    }
    else {
        // Purple to Red
        const t = (normalized - 0.5) * 2;
        r = Math.round(128 + 127 * t);
        g = 0;
        b = Math.round(128 - 128 * t);
    }
    return `rgb(${r}, ${g}, ${b})`;
}
/**
 * Determine node type from address
 */
function getNodeType(address, registry, config) {
    const info = registry.get(address);
    if ((0, config_1.isCexAddress)(config, address)) {
        return { type: 'cex', category: 'cex' };
    }
    if ((0, config_1.isBridgeAddress)(address)) {
        return { type: 'bridge', category: 'bridge' };
    }
    if (info?.category === 'nft_marketplace') {
        return { type: 'marketplace', category: info.category };
    }
    if (address.startsWith('KT1')) {
        return { type: 'contract', category: info?.category || 'unknown' };
    }
    return { type: 'wallet', category: info?.category || 'unknown' };
}
/**
 * Get display label for address
 */
function getNodeLabel(address, registry) {
    const info = registry.get(address);
    // Prefer Tezos domain
    if (info?.tezos_domain) {
        return info.tezos_domain;
    }
    // Then TzKT alias
    if (info?.alias) {
        return info.alias;
    }
    // Fallback to truncated address
    return `${address.slice(0, 8)}...${address.slice(-4)}`;
}
/**
 * Generate network data from XTZ flows
 */
function generateNetworkData(config, storage, filterWallet, maxNodes = 500) {
    console.log('\n=== Generating Network Data ===');
    // Load address registry
    const registryList = storage.getAllAddressRegistry();
    const registry = new Map();
    for (const r of registryList) {
        registry.set(r.address, r);
    }
    console.log(`Loaded ${registryList.length} addresses from registry`);
    // Get XTZ flows (or filter by wallet)
    let flows;
    if (filterWallet) {
        flows = storage.getXtzFlowsForAddress(filterWallet);
        console.log(`Filtering to wallet: ${filterWallet}`);
        console.log(`Found ${flows.length} flows for this wallet`);
    }
    else {
        // Get all flows but aggregate to avoid too many edges
        flows = storage.query(`
      SELECT * FROM xtz_flows 
      WHERE amount_mutez > 0
      ORDER BY amount_mutez DESC
      LIMIT 50000
    `);
        console.log(`Loaded ${flows.length} XTZ flows`);
    }
    if (flows.length === 0) {
        console.log('No XTZ flows found. Run sync-all first.');
        return {
            nodes: [],
            edges: [],
            stats: { nodeCount: 0, edgeCount: 0, minValue: 0, maxValue: 0, totalVolume: 0 }
        };
    }
    // Aggregate edges by sender-target pair
    const edgeMap = new Map();
    const nodeActivity = new Map();
    for (const flow of flows) {
        const edgeKey = `${flow.sender}|${flow.target}`;
        // Update edge
        const existing = edgeMap.get(edgeKey) || { value: 0, count: 0 };
        existing.value += flow.amount_mutez;
        existing.count += 1;
        edgeMap.set(edgeKey, existing);
        // Update node activity
        for (const addr of [flow.sender, flow.target]) {
            const nodeStats = nodeActivity.get(addr) || { count: 0, volume: 0 };
            nodeStats.count += 1;
            nodeStats.volume += flow.amount_mutez;
            nodeActivity.set(addr, nodeStats);
        }
    }
    console.log(`Aggregated ${edgeMap.size} unique edges`);
    console.log(`Found ${nodeActivity.size} unique nodes`);
    // Find min/max for heatmap
    let minValue = Infinity;
    let maxValue = 0;
    let totalVolume = 0;
    for (const [, edge] of edgeMap) {
        if (edge.value < minValue)
            minValue = edge.value;
        if (edge.value > maxValue)
            maxValue = edge.value;
        totalVolume += edge.value;
    }
    // Convert to XTZ for display
    const minXtz = minValue / 1_000_000;
    const maxXtz = maxValue / 1_000_000;
    console.log(`Value range: ${minXtz.toFixed(2)} - ${maxXtz.toFixed(2)} XTZ`);
    // Limit nodes by activity if too many
    let activeNodes = Array.from(nodeActivity.entries())
        .sort((a, b) => b[1].count - a[1].count);
    if (activeNodes.length > maxNodes) {
        console.log(`Limiting to top ${maxNodes} nodes by activity`);
        activeNodes = activeNodes.slice(0, maxNodes);
    }
    const includedNodes = new Set(activeNodes.map(([addr]) => addr));
    // Build nodes
    const nodes = activeNodes.map(([address, stats]) => {
        const { type, category } = getNodeType(address, registry, config);
        return {
            id: address,
            label: getNodeLabel(address, registry),
            type,
            category,
            size: Math.log10(stats.count + 1) * 5 + 5, // Log scale for size
            totalVolume: stats.volume / 1_000_000
        };
    });
    // Build edges (only between included nodes)
    const edges = [];
    for (const [edgeKey, edgeData] of edgeMap) {
        const [source, target] = edgeKey.split('|');
        // Only include if both nodes are in the graph
        if (!includedNodes.has(source) || !includedNodes.has(target)) {
            continue;
        }
        edges.push({
            source,
            target,
            value: edgeData.value / 1_000_000, // Convert to XTZ
            color: getHeatmapColor(edgeData.value, minValue, maxValue),
            count: edgeData.count,
            avgValue: (edgeData.value / edgeData.count) / 1_000_000
        });
    }
    console.log(`Final graph: ${nodes.length} nodes, ${edges.length} edges`);
    return {
        nodes,
        edges,
        stats: {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            minValue: minXtz,
            maxValue: maxXtz,
            totalVolume: totalVolume / 1_000_000
        }
    };
}
/**
 * Export network data to JSON
 */
function exportNetworkData(graph, outputPath) {
    const json = JSON.stringify(graph, null, 2);
    fs.writeFileSync(outputPath, json);
    console.log(`  Written: ${outputPath}`);
}
/**
 * Generate D3.js HTML visualization
 */
function generateNetworkHtml(graph, filterWallet) {
    const dataJson = JSON.stringify(graph);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tezos Network Activity - ${filterWallet ? filterWallet.slice(0, 12) + '...' : 'Full Network'}</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e; 
      color: #eee;
      overflow: hidden;
    }
    #container { width: 100vw; height: 100vh; position: relative; }
    svg { width: 100%; height: 100%; }
    
    #controls {
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(26, 26, 46, 0.95);
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #333;
      z-index: 100;
      max-width: 350px;
    }
    #controls h1 { font-size: 18px; margin-bottom: 15px; color: #fff; }
    #controls .stat { margin: 5px 0; font-size: 13px; color: #aaa; }
    #controls .stat span { color: #fff; }
    
    #wallet-filter {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #333;
    }
    #wallet-filter label { display: block; margin-bottom: 5px; font-size: 13px; }
    #wallet-filter input {
      width: 100%;
      padding: 8px;
      background: #2a2a4e;
      border: 1px solid #444;
      border-radius: 4px;
      color: #fff;
      font-family: monospace;
      font-size: 12px;
    }
    #wallet-filter button {
      margin-top: 10px;
      padding: 8px 16px;
      background: #4a4aff;
      border: none;
      border-radius: 4px;
      color: #fff;
      cursor: pointer;
      font-size: 13px;
    }
    #wallet-filter button:hover { background: #5a5aff; }
    
    #legend {
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: rgba(26, 26, 46, 0.95);
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #333;
    }
    #legend h3 { font-size: 14px; margin-bottom: 10px; }
    .legend-item { display: flex; align-items: center; margin: 5px 0; font-size: 12px; }
    .legend-color { width: 16px; height: 16px; border-radius: 50%; margin-right: 8px; }
    
    #heatmap-legend {
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: rgba(26, 26, 46, 0.95);
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #333;
    }
    #heatmap-legend h3 { font-size: 14px; margin-bottom: 10px; }
    .heatmap-bar {
      width: 200px;
      height: 20px;
      background: linear-gradient(to right, rgb(0, 0, 255), rgb(128, 0, 128), rgb(255, 0, 0));
      border-radius: 4px;
      margin: 10px 0;
    }
    .heatmap-labels { display: flex; justify-content: space-between; font-size: 11px; color: #aaa; }
    
    #tooltip {
      position: absolute;
      background: rgba(0, 0, 0, 0.9);
      padding: 12px;
      border-radius: 6px;
      font-size: 12px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      max-width: 300px;
      z-index: 200;
    }
    #tooltip.visible { opacity: 1; }
    #tooltip .label { font-weight: bold; color: #fff; margin-bottom: 5px; }
    #tooltip .info { color: #aaa; margin: 2px 0; }
    #tooltip .value { color: #4a4aff; }
    
    .node { cursor: pointer; }
    .node:hover { opacity: 0.8; }
    .link { fill: none; stroke-opacity: 0.6; }
    .node-label { font-size: 10px; fill: #fff; pointer-events: none; }
  </style>
</head>
<body>
  <div id="container">
    <svg id="network"></svg>
    
    <div id="controls">
      <h1>Tezos Network Activity</h1>
      <div class="stat">Nodes: <span id="node-count">0</span></div>
      <div class="stat">Edges: <span id="edge-count">0</span></div>
      <div class="stat">Total Volume: <span id="total-volume">0</span> XTZ</div>
      <div class="stat">Value Range: <span id="value-range">0 - 0</span> XTZ</div>
      
      <div id="wallet-filter">
        <label>Filter by Wallet Address:</label>
        <input type="text" id="wallet-input" placeholder="tz1... or KT1...">
        <button onclick="filterByWallet()">Filter</button>
        <button onclick="resetFilter()">Reset</button>
      </div>
    </div>
    
    <div id="legend">
      <h3>Node Types</h3>
      <div class="legend-item"><div class="legend-color" style="background: #4a9eff;"></div> Wallet</div>
      <div class="legend-item"><div class="legend-color" style="background: #9c27b0;"></div> Contract</div>
      <div class="legend-item"><div class="legend-color" style="background: #4caf50;"></div> Marketplace</div>
      <div class="legend-item"><div class="legend-color" style="background: #ff9800;"></div> CEX</div>
      <div class="legend-item"><div class="legend-color" style="background: #00bcd4;"></div> Bridge</div>
    </div>
    
    <div id="heatmap-legend">
      <h3>Transaction Value</h3>
      <div class="heatmap-bar"></div>
      <div class="heatmap-labels">
        <span id="min-label">0 XTZ</span>
        <span id="max-label">0 XTZ</span>
      </div>
    </div>
    
    <div id="tooltip">
      <div class="label"></div>
      <div class="info type"></div>
      <div class="info volume"></div>
    </div>
  </div>

  <script>
    // Network data (embedded)
    const graphData = ${dataJson};
    
    // Node color by type
    const nodeColors = {
      wallet: '#4a9eff',
      contract: '#9c27b0',
      marketplace: '#4caf50',
      cex: '#ff9800',
      bridge: '#00bcd4'
    };
    
    // Update stats display
    document.getElementById('node-count').textContent = graphData.stats.nodeCount.toLocaleString();
    document.getElementById('edge-count').textContent = graphData.stats.edgeCount.toLocaleString();
    document.getElementById('total-volume').textContent = graphData.stats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 });
    document.getElementById('value-range').textContent = 
      graphData.stats.minValue.toFixed(2) + ' - ' + graphData.stats.maxValue.toFixed(2);
    document.getElementById('min-label').textContent = graphData.stats.minValue.toFixed(2) + ' XTZ';
    document.getElementById('max-label').textContent = graphData.stats.maxValue.toFixed(2) + ' XTZ';
    
    // Set up SVG
    const svg = d3.select('#network');
    const container = document.getElementById('container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    svg.call(zoom);
    
    // Create main group for zoom/pan
    const g = svg.append('g');
    
    // Create arrow marker for directed edges
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#666')
      .style('stroke', 'none');
    
    // Create force simulation
    const simulation = d3.forceSimulation(graphData.nodes)
      .force('link', d3.forceLink(graphData.edges)
        .id(d => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.size + 5));
    
    // Create links
    const links = g.append('g')
      .selectAll('path')
      .data(graphData.edges)
      .join('path')
      .attr('class', 'link')
      .attr('stroke', d => d.color)
      .attr('stroke-width', d => Math.max(1, Math.log10(d.value + 1) * 2))
      .attr('marker-end', 'url(#arrowhead)');
    
    // Create nodes
    const nodes = g.append('g')
      .selectAll('circle')
      .data(graphData.nodes)
      .join('circle')
      .attr('class', 'node')
      .attr('r', d => d.size)
      .attr('fill', d => nodeColors[d.type] || '#999')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));
    
    // Create labels
    const labels = g.append('g')
      .selectAll('text')
      .data(graphData.nodes)
      .join('text')
      .attr('class', 'node-label')
      .attr('dx', d => d.size + 4)
      .attr('dy', 4)
      .text(d => d.size > 8 ? d.label : '');
    
    // Tooltip
    const tooltip = d3.select('#tooltip');
    
    nodes
      .on('mouseover', (event, d) => {
        tooltip.select('.label').text(d.label);
        tooltip.select('.type').text('Type: ' + d.type + (d.category ? ' (' + d.category + ')' : ''));
        tooltip.select('.volume').html('Volume: <span class="value">' + d.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XTZ</span>');
        tooltip.classed('visible', true);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', (event.pageX + 15) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', () => {
        tooltip.classed('visible', false);
      })
      .on('click', (event, d) => {
        document.getElementById('wallet-input').value = d.id;
      });
    
    links
      .on('mouseover', (event, d) => {
        tooltip.select('.label').text(d.count + ' transaction(s)');
        tooltip.select('.type').text(d.source.id ? d.source.id.slice(0, 12) + '... → ' + d.target.id.slice(0, 12) + '...' : '');
        tooltip.select('.volume').html('Total: <span class="value">' + d.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XTZ</span> (avg: ' + d.avgValue.toFixed(2) + ' XTZ)');
        tooltip.classed('visible', true);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', (event.pageX + 15) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', () => {
        tooltip.classed('visible', false);
      });
    
    // Update positions on simulation tick
    simulation.on('tick', () => {
      links.attr('d', d => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        return 'M' + d.source.x + ',' + d.source.y + 'A' + dr + ',' + dr + ' 0 0,1 ' + d.target.x + ',' + d.target.y;
      });
      
      nodes
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
      
      labels
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });
    
    // Drag functions
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
    
    // Filter functions
    function filterByWallet() {
      const wallet = document.getElementById('wallet-input').value.trim();
      if (wallet) {
        window.location.href = window.location.pathname + '?wallet=' + encodeURIComponent(wallet);
      }
    }
    
    function resetFilter() {
      window.location.href = window.location.pathname;
    }
    
    // Keyboard shortcut
    document.getElementById('wallet-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') filterByWallet();
    });
    
    // Initial zoom to fit
    const initialScale = 0.7;
    svg.call(zoom.transform, d3.zoomIdentity
      .translate(width / 2 * (1 - initialScale), height / 2 * (1 - initialScale))
      .scale(initialScale));
  </script>
</body>
</html>`;
}
/**
 * Generate and export complete network visualization files
 */
function generateNetworkVisualization(config, storage, outputDir, filterWallet) {
    console.log('\n' + '='.repeat(60));
    console.log('NETWORK VISUALIZATION');
    console.log('='.repeat(60));
    // Generate network data
    const graph = generateNetworkData(config, storage, filterWallet);
    if (graph.nodes.length === 0) {
        console.log('No network data to visualize.');
        return;
    }
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    // Export JSON data
    exportNetworkData(graph, path.join(outputDir, 'network_data.json'));
    // Generate HTML visualization
    const html = generateNetworkHtml(graph, filterWallet);
    fs.writeFileSync(path.join(outputDir, 'network.html'), html);
    console.log(`  Written: ${path.join(outputDir, 'network.html')}`);
    console.log('\nNetwork visualization generated.');
    console.log('Open out/network.html in a browser to view the interactive graph.');
}
//# sourceMappingURL=generate_network.js.map