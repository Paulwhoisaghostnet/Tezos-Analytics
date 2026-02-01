/**
 * Derive Buyers Module
 * 
 * Proper derivation path:
 * 1. Token ID = 0: Check against known fungible contracts, then TzKT API
 * 2. Token ID > 0: Treat as NFT if editions <= 5,555
 * 3. Cache contract metadata to avoid repeated API calls
 */

import { 
  PipelineConfig, 
  getAllBuyEntrypoints, 
  getAllAcceptOfferEntrypoints,
  getAllMarketplaceAddresses,
  findMarketplace 
} from './config';
import { Storage, RawTransaction, RawTokenTransfer } from './storage';
import { TzktClient } from './tzkt';
import { 
  batchCheckContracts, 
  cacheKnownContracts,
  getTokenId0Contracts 
} from './contract_checker';

// Marketplace custody contracts (transfers FROM these = definite sales)
const MARKETPLACE_CUSTODY_CONTRACTS = new Map([
  ['KT1GbyoDi7H1sfXmimXpptZJuCdHMh66WS9u', 'fxhash_marketplace_v2'],
  ['KT1PHubm9HtyQEJ4BBpMTVomq6mhbfNZ9z5w', 'teia_marketplace'],
  ['KT1HbQepzV1nVGg8QVznG7z4RcHseD5kwqBn', 'hen_marketplace'],
  ['KT18iSHoRW1iogamADWwQSDoZa3QkN4izkqj', 'objkt_english_auctions'],
  ['KT1FvqJwEDWb1Gwc55Jd1jjTHRVWbYKUUpyq', 'objkt_dutch_auctions'],
]);

// Max edition size for NFTs (many generative projects have 5000+ editions)
const MAX_NFT_EDITION_SIZE = 5555;

// Open edition contracts/marketplaces (allow 0 XTZ sales)
// Open editions are free mints, so 0 XTZ is legitimate
const OPEN_EDITION_CONTRACTS = new Set([
  'KT1WvzYHCNBvDSdwafTHv7nJ1dWmZ8GCYuuC', // objkt.com Marketplace v4 (handles open editions)
]);

/**
 * Check if a sale is a valid open edition (0 XTZ is allowed)
 */
function isValidOpenEdition(
  tokenContract: string,
  marketplace: string | null,
  amount: number
): boolean {
  // Open editions can be free (0 XTZ)
  if (amount === 0) {
    // Check if from known open edition marketplace
    if (marketplace && OPEN_EDITION_CONTRACTS.has(marketplace)) {
      return true;
    }
    // Check if token contract itself is an open edition platform
    if (OPEN_EDITION_CONTRACTS.has(tokenContract)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a transfer is an NFT based on:
 * - token_id=0: Must be verified as non-fungible via contract metadata
 * - token_id>0: Likely NFT if amount <= 5555
 * - amount > 5555: Not an NFT
 */
function isNftTransfer(
  tokenId: string, 
  amount: number,
  contractAddress: string,
  fungibleContracts: Set<string>
): boolean {
  // Amount > 5555 = not NFT
  if (amount > MAX_NFT_EDITION_SIZE) {
    return false;
  }
  
  // Token ID = 0: Check if contract is fungible
  if (tokenId === '0') {
    // If we know it's fungible, skip it
    if (fungibleContracts.has(contractAddress)) {
      return false;
    }
    // If not in fungible set, it could be the first NFT in a collection
    // (allowed through)
  }
  
  // Token ID > 0: Almost always NFT (except very large amounts already filtered)
  return true;
}

/**
 * Derive buyers with proper contract verification
 * Now async because it may need to query TzKT for unknown contracts
 */
export async function deriveBuyers(
  config: PipelineConfig,
  storage: Storage
): Promise<void> {
  console.log('\n=== Deriving Buyers (with contract verification) ===');
  
  // Pre-populate known contracts
  cacheKnownContracts(storage);
  
  // 1. Get all token_id=0 contracts that need checking
  const tokenId0Contracts = getTokenId0Contracts(storage);
  console.log(`Found ${tokenId0Contracts.length} contracts with token_id=0 transfers`);
  
  // 2. Batch check them via TzKT (uses cache, only queries unknowns)
  const client = new TzktClient(config);
  const contractTypes = await batchCheckContracts(storage, client, tokenId0Contracts);
  
  // Build set of fungible contracts
  const fungibleContracts = new Set<string>();
  for (const [addr, isFungible] of contractTypes) {
    if (isFungible) {
      fungibleContracts.add(addr);
    }
  }
  console.log(`Identified ${fungibleContracts.size} fungible token contracts`);
  
  // 3. Get marketplace transactions for matching
  const marketplaceAddresses = getAllMarketplaceAddresses(config);
  const buyEntrypoints = getAllBuyEntrypoints(config);
  const acceptOfferEntrypoints = getAllAcceptOfferEntrypoints(config);
  const allBuyerEntrypoints = [...new Set([...buyEntrypoints, ...acceptOfferEntrypoints])];
  
  const buyTxs = storage.getRawTransactionsByTarget(marketplaceAddresses, allBuyerEntrypoints);
  console.log(`Marketplace buy transactions: ${buyTxs.length}`);
  
  // Build timestamp lookup maps
  const txByTimestampSender = new Map<string, RawTransaction>();
  const txByTimestamp = new Map<string, RawTransaction[]>();
  
  for (const tx of buyTxs) {
    const tsKey = tx.timestamp.slice(0, 19);
    txByTimestampSender.set(`${tsKey}:${tx.sender}`, tx);
    
    if (!txByTimestamp.has(tsKey)) {
      txByTimestamp.set(tsKey, []);
    }
    txByTimestamp.get(tsKey)!.push(tx);
  }
  
  // 4. Get all token transfers
  const allTransfers = storage.getAllRawTokenTransfers();
  console.log(`Total token transfers: ${allTransfers.length}`);
  
  // 5. Process transfers - count verified and all NFT activity
  let purchaseCount = 0;
  let custodySales = 0;
  let matchedSales = 0;
  let openEditionSales = 0;
  let skippedFungible = 0;
  let skippedEditionSize = 0;
  let skippedP2P = 0;
  let buyerSet = new Set<string>();
  let sellerSet = new Set<string>();
  
  // For inclusive stats
  let totalNftTransfers = 0;
  let allBuyers = new Set<string>();
  let allSellers = new Set<string>();
  
  for (const transfer of allTransfers) {
    // Skip mints
    if (!transfer.from_address || transfer.from_address === '') continue;
    // Skip non-wallet recipients
    if (!transfer.to_address || !transfer.to_address.startsWith('tz')) continue;
    
    const qty = parseInt(transfer.amount, 10) || 0;
    const tokenId = transfer.token_id;
    const contract = transfer.token_contract;
    
    // Check if this is an NFT transfer
    if (!isNftTransfer(tokenId, qty, contract, fungibleContracts)) {
      if (tokenId === '0' && fungibleContracts.has(contract)) {
        skippedFungible++;
      } else {
        skippedEditionSize++;
      }
      continue;
    }
    
    // Count as NFT activity
    totalNftTransfers++;
    allBuyers.add(transfer.to_address);
    if (transfer.from_address.startsWith('tz')) {
      allSellers.add(transfer.from_address);
    }
    
    const buyer = transfer.to_address;
    const seller = transfer.from_address;
    const tsKey = transfer.timestamp.slice(0, 19);
    
    let marketplace: string | null = null;
    let spendMutez: number | null = null;
    let isVerifiedSale = false;
    
    // Check 1: Transfer from custody contract (definite sale)
    if (MARKETPLACE_CUSTODY_CONTRACTS.has(seller)) {
      marketplace = MARKETPLACE_CUSTODY_CONTRACTS.get(seller)!;
      isVerifiedSale = true;
      custodySales++;
      
      // Try to get price from matching transaction
      const possibleTxs = txByTimestamp.get(tsKey) || [];
      for (const tx of possibleTxs) {
        if (tx.sender === buyer) {
          spendMutez = tx.amount || null;
          break;
        }
      }
    }
    
    // Check 2: Match by timestamp+buyer (objkt-style direct transfer)
    if (!isVerifiedSale) {
      const matchedTx = txByTimestampSender.get(`${tsKey}:${buyer}`);
      if (matchedTx) {
        const mp = findMarketplace(config, matchedTx.target);
        if (mp) {
          marketplace = mp.name;
          spendMutez = matchedTx.amount || null;
          isVerifiedSale = true;
          matchedSales++;
        }
      }
    }
    
    // Check 3: Match by timestamp+seller (offer accepts)
    if (!isVerifiedSale) {
      const matchedTx = txByTimestampSender.get(`${tsKey}:${seller}`);
      if (matchedTx) {
        const mp = findMarketplace(config, matchedTx.target);
        if (mp && acceptOfferEntrypoints.includes(matchedTx.entrypoint || '')) {
          marketplace = mp.name;
          spendMutez = matchedTx.amount || null;
          isVerifiedSale = true;
          matchedSales++;
        }
      }
    }
    
    // Skip unverified transfers (likely P2P)
    if (!isVerifiedSale) {
      skippedP2P++;
      continue;
    }
    
    // Check for open edition (0 XTZ is valid for these)
    const isOpenEdition = spendMutez === 0 && isValidOpenEdition(
      transfer.token_contract,
      marketplace,
      spendMutez || 0
    );
    
    if (isOpenEdition) {
      openEditionSales++;
    }
    
    // Record verified sale
    buyerSet.add(buyer);
    sellerSet.add(seller);
    storage.upsertBuyer(buyer);
    
    storage.insertPurchase({
      op_hash: transfer.id.toString(),
      ts: transfer.timestamp,
      buyer,
      seller,
      marketplace: marketplace || 'unknown',
      token_contract: transfer.token_contract,
      token_id: transfer.token_id,
      qty,
      spend_mutez: spendMutez,
      kind: isOpenEdition ? 'open_edition' : 'listing_purchase'
    });
    purchaseCount++;
  }
  
  console.log(`\n--- Buyers Summary ---`);
  console.log(`VERIFIED marketplace sales: ${purchaseCount}`);
  console.log(`  From custody contracts: ${custodySales}`);
  console.log(`  Matched by timestamp: ${matchedSales}`);
  console.log(`  Open editions (0 XTZ): ${openEditionSales}`);
  console.log(`Verified unique buyers: ${buyerSet.size}`);
  console.log(`Verified unique sellers: ${sellerSet.size}`);
  console.log(`\nALL NFT activity (incl. P2P/OTC/unverified):`);
  console.log(`  Total NFT transfers: ${totalNftTransfers}`);
  console.log(`  Total unique recipients: ${allBuyers.size}`);
  console.log(`  Total unique senders: ${allSellers.size}`);
  console.log(`\nFiltered out:`);
  console.log(`  Fungible tokens (token_id=0): ${skippedFungible}`);
  console.log(`  Edition size > ${MAX_NFT_EDITION_SIZE}: ${skippedEditionSize}`);
  console.log(`  Unverified P2P/OTC: ${skippedP2P}`);
}

/**
 * Copy balances from raw_balances to buyer_balance_start for all buyers
 */
export function populateBuyerBalances(storage: Storage): void {
  console.log('\n=== Populating Buyer Balances (from local data) ===');
  
  const buyers = storage.getAllBuyers();
  let populated = 0;
  
  for (const address of buyers) {
    const rawBalance = storage.getRawBalance(address);
    if (rawBalance) {
      storage.upsertBuyerBalance(address, rawBalance.balance_mutez, rawBalance.snapshot_ts);
      populated++;
    }
  }
  
  console.log(`Populated ${populated}/${buyers.length} buyer balances`);
}
