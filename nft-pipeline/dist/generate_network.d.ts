/**
 * Network Visualization Data Generator
 * Creates node/edge data for D3.js force-directed graph
 * with heatmap coloring based on XTZ transaction values
 */
import { Storage } from './storage';
import { PipelineConfig } from './config';
export interface NetworkNode {
    id: string;
    label: string;
    type: 'wallet' | 'contract' | 'marketplace' | 'cex' | 'bridge';
    category: string | null;
    size: number;
    totalVolume: number;
}
export interface NetworkEdge {
    source: string;
    target: string;
    value: number;
    color: string;
    count: number;
    avgValue: number;
}
export interface NetworkGraph {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
    stats: {
        nodeCount: number;
        edgeCount: number;
        minValue: number;
        maxValue: number;
        totalVolume: number;
    };
}
/**
 * Generate network data from XTZ flows
 */
export declare function generateNetworkData(config: PipelineConfig, storage: Storage, filterWallet?: string, maxNodes?: number): NetworkGraph;
/**
 * Export network data to JSON
 */
export declare function exportNetworkData(graph: NetworkGraph, outputPath: string): void;
/**
 * Generate and export complete network visualization files
 */
export declare function generateNetworkVisualization(config: PipelineConfig, storage: Storage, outputDir: string, filterWallet?: string): void;
//# sourceMappingURL=generate_network.d.ts.map