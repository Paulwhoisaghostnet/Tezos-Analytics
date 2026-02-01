"use strict";
/**
 * Derive Creators Module
 * Works entirely from local database - NO API calls
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveCreators = deriveCreators;
/**
 * Derive creators from local token transfer data
 * A mint is a transfer where from_address is null/empty
 */
function deriveCreators(storage) {
    console.log('\n=== Deriving Creators (from local data) ===');
    // Get all mint transfers from local database
    const mintTransfers = storage.getRawMintTransfers();
    console.log(`Found ${mintTransfers.length} mint transfers in local database`);
    let mintCount = 0;
    let creatorSet = new Set();
    for (const transfer of mintTransfers) {
        // The recipient of a mint is typically the creator
        const creator = transfer.to_address;
        if (!creator || !creator.startsWith('tz'))
            continue;
        creatorSet.add(creator);
        storage.upsertCreator(creator);
        storage.insertMint({
            op_hash: `mint_${transfer.id}`,
            ts: transfer.timestamp,
            creator,
            token_contract: transfer.token_contract,
            token_id: transfer.token_id,
            qty: parseInt(transfer.amount, 10) || 1
        });
        mintCount++;
    }
    console.log(`\n--- Creators Summary ---`);
    console.log(`Mints recorded: ${mintCount}`);
    console.log(`Unique creators: ${creatorSet.size}`);
}
//# sourceMappingURL=derive_creators.js.map