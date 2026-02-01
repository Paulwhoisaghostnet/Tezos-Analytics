# Tezos NFT Market Pressure Pipeline

A two-phase data pipeline for analyzing NFT market dynamics on Tezos.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PHASE 1: SYNC                          │
│                  (Run once or periodically)                  │
│                                                             │
│   TzKT API  ───────────────►  SQLite Database               │
│                               (raw_transactions,             │
│                                raw_token_transfers,          │
│                                raw_balances)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     PHASE 2: ANALYZE                         │
│                   (Instant, no API calls)                    │
│                                                             │
│   SQLite ──► Derive Buyers ──► Derive Creators ──► Export   │
│              Derive Listings   Derive Offers                 │
│              Derive Resales                                  │
│                                                             │
│   Output: summary.json, buyers.csv, creators.csv, etc.      │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Step 1: Sync data from TzKT (takes a few minutes)
npm run sync

# Step 2: Run analysis (instant, no API calls)
npm run analyze

# Or run both together
npm run full
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run sync` | Pull all data from TzKT API into local database |
| `npm run analyze` | Derive insights from local data (instant) |
| `npm run full` | Run sync + analyze together |
| `npm run discover` | Analyze marketplace entrypoints |
| `npm run status` | Show database status |

## Key Benefits

1. **Sync once, analyze many times** - No repeated API calls
2. **Instant re-analysis** - Change parameters and re-run in seconds
3. **Resumable** - Sync can be interrupted and resumed
4. **Offline capable** - Analysis works without internet
5. **Simulation-ready** - Local data can feed simulations

## Output Files

All outputs are written to `./out/`:

| File | Description |
|------|-------------|
| `summary.json` | Aggregate statistics and key metrics |
| `buyers.csv` | Unique buyer addresses with balances and spend |
| `buyer_purchases.csv` | Individual purchase transactions |
| `creators.csv` | Unique creator addresses with mint counts |
| `creator_mints.csv` | Individual mint transactions |
| `creator_listings.csv` | Listing transactions with prices |
| `creator_offer_accepts.csv` | Offer accepts with price comparison |
| `collector_resales.csv` | Secondary sales by collectors |
| `debug_entrypoints.json` | Entrypoint analysis |

## Database

Data is stored in SQLite at `./data/pipeline.db`:

### Raw Tables (synced from TzKT)
- `raw_transactions` - All marketplace transactions
- `raw_token_transfers` - All FA2 token transfers
- `raw_balances` - Wallet balance snapshots

### Derived Tables (computed locally)
- `buyers`, `purchases` - Buyer activity
- `creators`, `mints` - Creator activity
- `listings` - Market listings
- `offer_accepts` - Offer acceptance analysis
- `resales` - Secondary market activity

## Configuration

Edit `src/config.ts` to customize:

### Time Window
```typescript
windowDays: 30,  // Analyze last 30 days
```

### Marketplaces
```typescript
marketplaces: [
  {
    name: 'objkt_v2',
    address: 'KT1WvzYHCNBvDSdwafTHv7nJ1dWmZ8GCYuuC',
    entrypoints: {
      buy: ['fulfill_ask', 'collect', 'buy'],
      list: ['ask', 'create_ask', 'list', 'swap'],
      acceptOffer: ['fulfill_offer', 'accept_offer']
    }
  },
  // Add more marketplaces...
]
```

## Using the Data for Simulations

After syncing, you can:

1. **Query the database directly** for simulation input
2. **Use the CSV exports** for external analysis tools
3. **Build simulations** that work from `./data/pipeline.db`

Example simulation scenarios:
- "What if token price drops 50%?"
- "What if listing volume doubles?"
- "What if buyer count halves?"

The local database contains all the raw data needed to model these scenarios without re-fetching from the API.

## API Usage

The sync phase uses these TzKT endpoints:
- `GET /v1/operations/transactions` - Marketplace transactions
- `GET /v1/tokens/transfers` - FA2 token movements
- `GET /v1/accounts/{address}/balance_history` - Historical balances

Rate limiting is handled automatically with exponential backoff.

## Troubleshooting

### "No data in local database"
Run `npm run sync` first to pull data from TzKT.

### Sync taking too long
The first sync pulls ~30 days of data. Subsequent syncs are incremental.

### Changing time window
Edit `windowDays` in `src/config.ts`, then run sync again with `--clear`:
```bash
node dist/index.js sync --clear
```

## License

MIT
