# Tezos Blockchain Simulator

A simulation lab for analyzing blockchain pricing scenarios on a Tezos-like network. This application allows you to simulate what happens when only pricing changes, keeping all other network parameters constant.

## Features

- **Pricing Simulations**: Model token price changes over time with configurable trends and volatility
- **Economic Analysis**: Track network value, staking rewards, transaction fees, and APY
- **Interactive Configuration**: Adjust initial parameters, price scenarios, and network settings
- **Visual Analytics**: Comprehensive charts showing price trends, network value, staking APY, and daily revenue

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Simulation Parameters

### Initial State
- **Initial Token Price**: Starting price in USD
- **Initial Staking Reward Rate**: Annual staking rewards percentage
- **Initial Transaction Fee**: Base transaction fee in tokens
- **Initial Staked Percentage**: Percentage of total supply staked

### Price Scenarios
- **Monthly Price Change Rate**: Expected monthly price change (can be negative)
- **Price Volatility**: Standard deviation for random price fluctuations

### Network Parameters
- **Total Supply**: Total token supply
- **Daily Transactions**: Average transactions per day
- **Staking Reward Adjustment**: How staking rewards adjust to price changes (0-1)

### Simulation Parameters
- **Duration**: Number of months to simulate
- **Time Step**: Simulation granularity in days

## How It Works

The simulator models a Tezos-like blockchain where:

1. **Token Price** evolves based on a trend (monthly change rate) plus random volatility
2. **Staking Rewards** adjust based on price changes to maintain real value
3. **Transaction Fees** remain constant in tokens but their USD value changes with price
4. **Network Value** (market cap) is calculated as total supply × token price
5. **APY** is dynamically calculated based on staking rewards and current token price

## Use Cases

- Analyze the impact of price appreciation/depreciation on network economics
- Understand how staking rewards adjust to price changes
- Model different volatility scenarios
- Study the relationship between token price and network value
- Evaluate staking yield under various price conditions

## Technology Stack

- **Next.js 14**: React framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Recharts**: Data visualization
- **Lucide React**: Icons

## License

MIT
