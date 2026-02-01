"use strict";
/**
 * Address Discovery Module
 * Identifies top contracts and wallets from existing data
 * Populates the address_registry table with initial entries
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverTopContracts = discoverTopContracts;
exports.discoverTopWallets = discoverTopWallets;
exports.runAddressDiscovery = runAddressDiscovery;
exports.exportAddressRegistry = exportAddressRegistry;
const config_1 = require("./config");
// Known contract categories
const KNOWN_CONTRACTS = {
    // Etherlink Bridge
    'KT1Wj8SUGmnEPFqyahHAcjcNQwe6YGhEXJb5': { category: 'bridge', alias: 'Etherlink Bridge' },
    'KT1CeFqjJRJPNVvhvznQrWfHad2jCiDZ6Lyj': { category: 'bridge', alias: 'Etherlink Exchanger' },
    // NFT Marketplaces
    'KT1WvzYHCNBvDSdwafTHv7nJ1dWmZ8GCYuuC': { category: 'nft_marketplace', alias: 'objkt.com Marketplace v4' },
    'KT1GbyoDi7H1sfXmimXpptZJuCdHMh66WS9u': { category: 'nft_marketplace', alias: 'fxhash Marketplace v2' },
    'KT1PHubm9HtyQEJ4BBpMTVomq6mhbfNZ9z5w': { category: 'nft_marketplace', alias: 'Teia Marketplace' },
    'KT1HbQepzV1nVGg8QVznG7z4RcHseD5kwqBn': { category: 'nft_marketplace', alias: 'HEN Marketplace' },
    'KT18iSHoRW1iogamADWwQSDoZa3QkN4izkqj': { category: 'nft_marketplace', alias: 'objkt.com English Auctions' },
    'KT1FvqJwEDWb1Gwc55Jd1jjTHRVWbYKUUpyq': { category: 'nft_marketplace', alias: 'objkt.com Dutch Auctions' },
    'KT1XjcRq5MLAzMKQ3UHsrue2SeU2NbxUrzmU': { category: 'nft_marketplace', alias: 'objkt.com English Auctions v1' },
    'KT1ET45vnyEFMLS9wX1dYHEs9aCN3twDEiQw': { category: 'nft_marketplace', alias: 'objkt.com Dutch Auctions v1' },
    // NFT Contracts
    'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton': { category: 'nft_contract', alias: 'HEN/OBJKT FA2' },
    'KT1KEa8z6vWXDJrVqtMrAeDVzsvxat3kHaCE': { category: 'nft_contract', alias: 'fxhash GENTK v1' },
    'KT1U6EHmNxJTkvaWJ4ThczG4FSDaHC21ssvi': { category: 'nft_contract', alias: 'fxhash GENTK v2' },
    'KT1EfsNuqwLAWDd3o4pvfUx1CAh5GMdTrRvr': { category: 'nft_contract', alias: 'fxhash Articles' },
    // DeFi
    'KT1TxqZ8QtKvLu3V3JH7Gx58n7Co8pgtpQU5': { category: 'defi', alias: 'Quipuswap' },
    'KT1K4EwTpbvYN9agJdjpyJm4ZZdhpUNKB3F6': { category: 'defi', alias: 'Youves' },
    'KT1PL1YciLdwMbydt21Ax85iZXXyGSrKT2BE': { category: 'defi', alias: 'Plenty DeFi' },
    'KT1Puc9St8wdNoGtLiD2WXaHbWU7styaxYhD': { category: 'defi', alias: 'Spicyswap' },
    // Tezos Domains
    'KT1GBZmSxmnKJXGMdMLbugPfLyUPmuLSMwKS': { category: 'domains', alias: 'Tezos Domains Registry' },
    // Bridges (Etherlink - will need to research exact addresses)
    // 'KT1...': { category: 'bridge', alias: 'Etherlink Bridge' },
};
// Determine address type from prefix
function getAddressType(address) {
    if (address.startsWith('KT1')) {
        return 'contract';
    }
    return 'wallet';
}
// Check if address is a CEX
function isCexAddress(address) {
    return config_1.KNOWN_CEX_ADDRESSES.includes(address);
}
/**
 * Discover and register top contracts from existing data
 */
function discoverTopContracts(storage, limit = 50) {
    console.log(`\n=== Discovering Top ${limit} Contracts ===`);
    const topContracts = storage.getTopContracts(limit);
    console.log(`Found ${topContracts.length} contracts in database`);
    let known = 0;
    let unknown = 0;
    for (const { address, tx_count } of topContracts) {
        const knownInfo = KNOWN_CONTRACTS[address];
        const row = {
            address,
            address_type: 'contract',
            alias: knownInfo?.alias || null,
            tezos_domain: null,
            owned_domains: null,
            category: knownInfo?.category || 'unknown',
            tx_count,
            metadata: null,
            resolved_at: knownInfo ? new Date().toISOString() : null
        };
        storage.insertAddressRegistry(row);
        if (knownInfo) {
            known++;
            console.log(`  [KNOWN] ${address.slice(0, 12)}... (${tx_count} txs) - ${knownInfo.alias}`);
        }
        else {
            unknown++;
        }
    }
    console.log(`\nContract Discovery Summary:`);
    console.log(`  Known contracts: ${known}`);
    console.log(`  Unknown contracts: ${unknown} (need TzKT lookup)`);
    storage.save();
}
/**
 * Discover and register top wallets from existing data
 */
function discoverTopWallets(storage, limit = 200) {
    console.log(`\n=== Discovering Top ${limit} Wallets ===`);
    const topWallets = storage.getTopWallets(limit);
    console.log(`Found ${topWallets.length} wallets in database`);
    let cex = 0;
    let regular = 0;
    for (const { address, tx_count } of topWallets) {
        const isCex = isCexAddress(address);
        const row = {
            address,
            address_type: isCex ? 'cex' : 'wallet',
            alias: null,
            tezos_domain: null,
            owned_domains: null,
            category: isCex ? 'cex' : 'unknown',
            tx_count,
            metadata: null,
            resolved_at: null // Will be resolved via Tezos Domains
        };
        storage.insertAddressRegistry(row);
        if (isCex) {
            cex++;
            console.log(`  [CEX] ${address.slice(0, 12)}... (${tx_count} txs)`);
        }
        else {
            regular++;
        }
    }
    console.log(`\nWallet Discovery Summary:`);
    console.log(`  CEX wallets: ${cex}`);
    console.log(`  Regular wallets: ${regular} (need Tezos Domains lookup)`);
    storage.save();
}
/**
 * Run full address discovery
 */
function runAddressDiscovery(storage, contractLimit = 50, walletLimit = 200) {
    console.log('\n' + '='.repeat(60));
    console.log('ADDRESS DISCOVERY');
    console.log('Identifying top contracts and wallets from local data');
    console.log('='.repeat(60));
    discoverTopContracts(storage, contractLimit);
    discoverTopWallets(storage, walletLimit);
    // Print registry summary
    const registry = storage.getAllAddressRegistry();
    const contracts = registry.filter(r => r.address_type === 'contract');
    const wallets = registry.filter(r => r.address_type === 'wallet' || r.address_type === 'cex');
    const resolved = registry.filter(r => r.resolved_at !== null);
    const unresolved = registry.filter(r => r.resolved_at === null);
    console.log('\n' + '-'.repeat(60));
    console.log('ADDRESS REGISTRY SUMMARY');
    console.log('-'.repeat(60));
    console.log(`Total addresses registered: ${registry.length}`);
    console.log(`  Contracts: ${contracts.length}`);
    console.log(`  Wallets/CEX: ${wallets.length}`);
    console.log(`  Resolved (with identity): ${resolved.length}`);
    console.log(`  Unresolved (need lookup): ${unresolved.length}`);
    console.log('\nRun `npm run resolve` to lookup identities via TzKT and Tezos Domains');
}
/**
 * Export address registry to CSV
 */
function exportAddressRegistry(storage, outputPath) {
    const registry = storage.getAllAddressRegistry();
    const header = 'address,address_type,alias,tezos_domain,category,tx_count,resolved_at\n';
    const rows = registry.map(r => `${r.address},${r.address_type},${r.alias || ''},${r.tezos_domain || ''},${r.category || ''},${r.tx_count},${r.resolved_at || ''}`).join('\n');
    require('fs').writeFileSync(outputPath, header + rows);
    console.log(`  Written: ${outputPath} (${registry.length} rows)`);
}
//# sourceMappingURL=discover_addresses.js.map