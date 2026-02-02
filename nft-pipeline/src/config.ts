/**
 * Configuration for Tezos NFT Market Pressure Pipeline
 * Marketplace contracts, entrypoints, CEX addresses, and pipeline settings
 */

import path from 'path';

// Resolve DB and output paths relative to nft-pipeline root so server, CLI,
// and background sync always use the same DB regardless of process cwd.
const PIPELINE_ROOT = path.resolve(__dirname, '..');
const DEFAULT_DB_PATH = path.join(PIPELINE_ROOT, 'data', 'pipeline.db');
const DEFAULT_OUTPUT_DIR = path.join(PIPELINE_ROOT, 'out');

export interface MarketplaceEntrypoints {
  buy: string[];
  list: string[];
  acceptOffer: string[];
}

export interface MarketplaceConfig {
  name: string;
  address: string;
  entrypoints: MarketplaceEntrypoints;
  feeRate: number; // Marketplace fee rate (e.g., 0.025 = 2.5%)
}

export interface PipelineConfig {
  // Time window
  windowDays: number;
  
  // TzKT API
  tzktBaseUrl: string;
  pageSize: number;
  maxConcurrency: number;
  retryAttempts: number;
  retryBaseDelayMs: number;
  
  // Marketplaces
  marketplaces: MarketplaceConfig[];
  
  // CEX (Centralized Exchange) addresses
  cexAddresses: string[];
  
  // Output
  outputDir: string;
  dbPath: string;
}

// Known Tezos CEX deposit/withdrawal addresses
// Sources: TzKT labels, exchange documentation, community knowledge
export const KNOWN_CEX_ADDRESSES: string[] = [
  // Coinbase
  'tz1hTFcQk2KJRPzZyHkCwbj7E1zY1xBkiHsk',
  'tz1YgDUQV2eXm8pUWNz3S5aWP86iFzNp4jnD',
  'tz1Kf25fX1VdmYGSEzwFy1wNmkbSEZ2V9LYU',
  'tz1irJKkXS2DBWkU1NnmFQx1c1L7pbGg4yhk', // Coinbase Baker
  'KT1EgpBXzhHbjMwdsSNasjUT5G99THef9pyG', // Coinbase Delegator
  'KT1RfPAUW8JCcG54TG3Xxsoo3FKU1kvKiGbY', // Coinbase Delegator
  
  // Kraken
  'tz1gfArv665EUkSg2ojMBzcbfwuPxAvqPvjo',
  'tz1hRTppkUow3wQNcj9nZ9s5sne6P5M5bFZ4',
  
  // Binance
  'tz1S8MNvuFEUsWgjHvi3AxibRBf388NhT1q2',
  'tz1aWXP237BLwNHJcCD4b3DutCevhqq2T1Z9',
  'tz1Q3jvYU9knekDYJfyvj3GjUy6898MNjvb2', // Binance Delegator 2
  'tz2WDATNYnp7FdsmuZDYSidioZqeoLNZqXvE', // Binance
  
  // Upbit
  'tz1beW9AVJjE9QpTGYVPdtZCF5w1NPknMJ3T', // Upbit 12
  
  // Gate.io
  'tz1NortRftucvAkD1J58L32EhSVrQEWJCEnB',
  'tz1e42w8ZaGAbM3gucbBy8iRypdbnqUj7oWY',
  
  // KuCoin
  'tz1MDhGTfMQjtMYFXeasKzRWFSLzsmJXMCMD',
  'tz1R2GnBudU97Ng2izMFkzPSVpCjdvnfopgM',
  
  // MEXC
  'tz1burnburnburnburnburnburnburjAYjjX', // placeholder - needs verification
  
  // OKX
  'tz1TgK3oaBaqcCHankT97AUNMjcs87Tfj5vb',
  
  // Bitfinex
  'tz1iQPKkeGSiHxsvHxcfPUH5dVR4x4qWEsYT',
  
  // Huobi
  'tz1L7dCLBJEpRWjAHaXhMwfXhKUbRPHpUP98',
  
  // Crypto.com
  'tz1Wc6gvCJR9FqhGLtPJrE6mbUMEdsCqhLwY',
];

// Etherlink Bridge Contracts (Layer 2)
// These contracts handle XTZ bridging between Tezos and Etherlink
export const ETHERLINK_BRIDGE_CONTRACTS = {
  // Bridge contract - accepts deposits and sends to exchanger
  bridge: 'KT1Wj8SUGmnEPFqyahHAcjcNQwe6YGhEXJb5',
  // Exchanger contract - stores XTZ and issues tickets (holds 16M+ XTZ)
  exchanger: 'KT1CeFqjJRJPNVvhvznQrWfHad2jCiDZ6Lyj',
};

// All bridge-related contract addresses
export const KNOWN_BRIDGE_ADDRESSES: string[] = [
  ETHERLINK_BRIDGE_CONTRACTS.bridge,
  ETHERLINK_BRIDGE_CONTRACTS.exchanger,
];

/**
 * Check if an address is a known bridge contract
 */
export function isBridgeAddress(address: string): boolean {
  return KNOWN_BRIDGE_ADDRESSES.includes(address);
}

// Default marketplace configurations
// These entrypoints are based on known objkt.com v2 contract patterns
// The discover_entrypoints.ts script can update these based on actual usage
export const DEFAULT_MARKETPLACES: MarketplaceConfig[] = [
  {
    name: 'objkt_v2',
    address: 'KT1WvzYHCNBvDSdwafTHv7nJ1dWmZ8GCYuuC',
    entrypoints: {
      buy: ['fulfill_ask', 'collect', 'buy', 'collection_offer_accept'],
      list: ['ask', 'create_ask', 'list', 'swap'],
      acceptOffer: ['fulfill_offer', 'accept_offer', 'acceptOffer']
    },
    feeRate: 0.025 // 2.5%
  },
  {
    name: 'objkt_english_auctions',
    address: 'KT1XjcRq5MLAzMKQ3UHsrue2SeU2NbxUrzmU',
    entrypoints: {
      buy: ['conclude_auction', 'bid'],
      list: ['create_auction'],
      acceptOffer: []
    },
    feeRate: 0.025
  },
  {
    name: 'objkt_english_auctions_v2',
    address: 'KT18iSHoRW1iogamADWwQSDoZa3QkN4izkqj',
    entrypoints: {
      buy: ['conclude_auction', 'bid', 'settle'],
      list: ['create_auction'],
      acceptOffer: []
    },
    feeRate: 0.025
  },
  {
    name: 'objkt_dutch_auctions', 
    address: 'KT1ET45vnyEFMLS9wX1dYHEs9aCN3twDEiQw',
    entrypoints: {
      buy: ['buy'],
      list: ['create_auction'],
      acceptOffer: []
    },
    feeRate: 0.025
  },
  {
    name: 'objkt_dutch_auctions_v2', 
    address: 'KT1FvqJwEDWb1Gwc55Jd1jjTHRVWbYKUUpyq',
    entrypoints: {
      buy: ['buy', 'collect'],
      list: ['create_auction'],
      acceptOffer: []
    },
    feeRate: 0.025
  },
  {
    name: 'hen_marketplace',
    address: 'KT1HbQepzV1nVGg8QVznG7z4RcHseD5kwqBn',
    entrypoints: {
      buy: ['collect'],
      list: ['swap'],
      acceptOffer: []
    },
    feeRate: 0.025
  },
  {
    name: 'teia_marketplace',
    address: 'KT1PHubm9HtyQEJ4BBpMTVomq6mhbfNZ9z5w',
    entrypoints: {
      buy: ['collect'],
      list: ['swap'],
      acceptOffer: []
    },
    feeRate: 0.025
  },
  {
    name: 'fxhash_marketplace_v2',
    address: 'KT1GbyoDi7H1sfXmimXpptZJuCdHMh66WS9u',
    entrypoints: {
      buy: ['listing_accept', 'offer_accept'],
      list: ['listing'],
      acceptOffer: ['offer_accept']
    },
    feeRate: 0.025
  }
];

export const DEFAULT_CONFIG: PipelineConfig = {
  windowDays: 30,
  tzktBaseUrl: 'https://api.tzkt.io/v1',
  pageSize: 1000,
  maxConcurrency: 6,
  retryAttempts: 5,
  retryBaseDelayMs: 1000,
  marketplaces: DEFAULT_MARKETPLACES,
  cexAddresses: KNOWN_CEX_ADDRESSES,
  outputDir: DEFAULT_OUTPUT_DIR,
  dbPath: DEFAULT_DB_PATH
};

/**
 * Check if an address is a known CEX
 */
export function isCexAddress(config: PipelineConfig, address: string): boolean {
  return config.cexAddresses.includes(address);
}

/**
 * Get marketplace fee rate by name
 */
export function getMarketplaceFeeRate(config: PipelineConfig, marketplaceName: string): number {
  const mp = config.marketplaces.find(m => m.name === marketplaceName);
  return mp?.feeRate ?? 0.025; // Default 2.5%
}

/**
 * Check if marketplace is objkt (any objkt contract)
 */
export function isObjktMarketplace(marketplaceName: string): boolean {
  return marketplaceName.startsWith('objkt');
}

/**
 * Calculate window timestamps
 */
export function getTimeWindow(config: PipelineConfig): { start: Date; end: Date; startISO: string; endISO: string } {
  const end = new Date();
  const start = new Date(end.getTime() - config.windowDays * 24 * 60 * 60 * 1000);
  
  return {
    start,
    end,
    startISO: start.toISOString(),
    endISO: end.toISOString()
  };
}

/**
 * Get all buy entrypoints across all marketplaces
 */
export function getAllBuyEntrypoints(config: PipelineConfig): string[] {
  const entrypoints = new Set<string>();
  for (const mp of config.marketplaces) {
    mp.entrypoints.buy.forEach(e => entrypoints.add(e));
  }
  return Array.from(entrypoints);
}

/**
 * Get all list entrypoints across all marketplaces
 */
export function getAllListEntrypoints(config: PipelineConfig): string[] {
  const entrypoints = new Set<string>();
  for (const mp of config.marketplaces) {
    mp.entrypoints.list.forEach(e => entrypoints.add(e));
  }
  return Array.from(entrypoints);
}

/**
 * Get all accept offer entrypoints across all marketplaces
 */
export function getAllAcceptOfferEntrypoints(config: PipelineConfig): string[] {
  const entrypoints = new Set<string>();
  for (const mp of config.marketplaces) {
    mp.entrypoints.acceptOffer.forEach(e => entrypoints.add(e));
  }
  return Array.from(entrypoints);
}

/**
 * Get all marketplace addresses
 */
export function getAllMarketplaceAddresses(config: PipelineConfig): string[] {
  return config.marketplaces.map(mp => mp.address);
}

/**
 * Find marketplace by address
 */
export function findMarketplace(config: PipelineConfig, address: string): MarketplaceConfig | undefined {
  return config.marketplaces.find(mp => mp.address === address);
}
