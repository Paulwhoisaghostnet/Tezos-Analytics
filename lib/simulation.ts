/**
 * Blockchain Simulation Engine
 * Simulates Tezos-like blockchain behavior with focus on pricing dynamics
 */

export interface SimulationConfig {
  // Initial state
  initialTokenPrice: number; // USD per token
  initialStakingRewardRate: number; // Annual percentage (e.g., 5.5 for 5.5%)
  initialTransactionFee: number; // Base fee in tokens
  initialStakedPercentage: number; // Percentage of total supply staked (0-100)
  
  // Price scenarios
  priceChangeRate: number; // Monthly percentage change (can be negative)
  priceVolatility: number; // Standard deviation for price fluctuations
  
  // Network parameters
  totalSupply: number; // Total token supply
  dailyTransactions: number; // Average transactions per day
  stakingRewardAdjustment: number; // How staking rewards adjust to price (0-1)
  
  // Simulation parameters
  durationMonths: number; // How many months to simulate
  timeStepDays: number; // Simulation granularity (e.g., 1 day)
}

export interface SimulationState {
  timestamp: Date;
  tokenPrice: number;
  stakingRewardRate: number;
  transactionFee: number;
  stakedAmount: number;
  stakedPercentage: number;
  totalStakingRewards: number;
  totalTransactionFees: number;
  networkValue: number; // Total market cap
  dailyRevenue: number; // Daily fees + staking rewards (in USD)
  apy: number; // Annual percentage yield for stakers
}

export interface SimulationResult {
  config: SimulationConfig;
  states: SimulationState[];
  summary: {
    finalPrice: number;
    priceChange: number;
    priceChangePercent: number;
    totalStakingRewards: number;
    totalTransactionFees: number;
    averageAPY: number;
    peakNetworkValue: number;
    finalNetworkValue: number;
  };
}

/**
 * Run a blockchain simulation based on the provided configuration
 */
export function runSimulation(config: SimulationConfig): SimulationResult {
  const states: SimulationState[] = [];
  
  // Initialize state
  let currentState: SimulationState = {
    timestamp: new Date(),
    tokenPrice: config.initialTokenPrice,
    stakingRewardRate: config.initialStakingRewardRate,
    transactionFee: config.initialTransactionFee,
    stakedAmount: (config.totalSupply * config.initialStakedPercentage) / 100,
    stakedPercentage: config.initialStakedPercentage,
    totalStakingRewards: 0,
    totalTransactionFees: 0,
    networkValue: config.totalSupply * config.initialTokenPrice,
    dailyRevenue: 0,
    apy: config.initialStakingRewardRate,
  };
  
  states.push({ ...currentState });
  
  const totalDays = config.durationMonths * 30;
  const steps = Math.floor(totalDays / config.timeStepDays);
  
  // Simulate price with random walk + trend
  let priceTrend = config.initialTokenPrice;
  
  for (let step = 1; step <= steps; step++) {
    const daysElapsed = step * config.timeStepDays;
    const monthsElapsed = daysElapsed / 30;
    
    // Update price: trend + volatility
    const trendChange = (config.priceChangeRate / 100) * monthsElapsed;
    const volatility = (Math.random() - 0.5) * 2 * config.priceVolatility / 100;
    priceTrend = config.initialTokenPrice * (1 + trendChange);
    currentState.tokenPrice = priceTrend * (1 + volatility);
    
    // Ensure price doesn't go negative
    currentState.tokenPrice = Math.max(0.01, currentState.tokenPrice);
    
    // Adjust staking rewards based on price (Tezos-like: rewards adjust to maintain real value)
    // If price increases, nominal rewards may decrease to maintain real value
    const priceMultiplier = config.initialTokenPrice / currentState.tokenPrice;
    currentState.stakingRewardRate = config.initialStakingRewardRate * 
      (1 - config.stakingRewardAdjustment * (1 - priceMultiplier));
    
    // Transaction fees adjust with price (fees in tokens, but value in USD changes)
    // Keep fee amount in tokens relatively stable, but USD value changes
    currentState.transactionFee = config.initialTransactionFee;
    
    // Calculate daily metrics
    const dailyStakingRewardsTokens = (currentState.stakedAmount * currentState.stakingRewardRate / 100) / 365;
    const dailyTransactionFeesTokens = config.dailyTransactions * currentState.transactionFee;
    
    currentState.totalStakingRewards += dailyStakingRewardsTokens * config.timeStepDays;
    currentState.totalTransactionFees += dailyTransactionFeesTokens * config.timeStepDays;
    
    // Daily revenue in USD
    currentState.dailyRevenue = 
      (dailyStakingRewardsTokens * currentState.tokenPrice) +
      (dailyTransactionFeesTokens * currentState.tokenPrice);
    
    // Update network value
    currentState.networkValue = config.totalSupply * currentState.tokenPrice;
    
    // Calculate APY (staking rewards in USD / staked value in USD)
    const stakedValueUSD = currentState.stakedAmount * currentState.tokenPrice;
    const annualRewardsUSD = dailyStakingRewardsTokens * 365 * currentState.tokenPrice;
    currentState.apy = stakedValueUSD > 0 
      ? (annualRewardsUSD / stakedValueUSD) * 100 
      : 0;
    
    // Update timestamp
    currentState.timestamp = new Date(
      currentState.timestamp.getTime() + config.timeStepDays * 24 * 60 * 60 * 1000
    );
    
    states.push({ ...currentState });
  }
  
  // Calculate summary
  const finalState = states[states.length - 1];
  const initialState = states[0];
  
  const summary = {
    finalPrice: finalState.tokenPrice,
    priceChange: finalState.tokenPrice - initialState.tokenPrice,
    priceChangePercent: ((finalState.tokenPrice - initialState.tokenPrice) / initialState.tokenPrice) * 100,
    totalStakingRewards: finalState.totalStakingRewards,
    totalTransactionFees: finalState.totalTransactionFees,
    averageAPY: states.reduce((sum, s) => sum + s.apy, 0) / states.length,
    peakNetworkValue: Math.max(...states.map(s => s.networkValue)),
    finalNetworkValue: finalState.networkValue,
  };
  
  return {
    config,
    states,
    summary,
  };
}

/**
 * Generate default simulation configuration
 */
export function getDefaultConfig(): SimulationConfig {
  return {
    initialTokenPrice: 1.0,
    initialStakingRewardRate: 5.5,
    initialTransactionFee: 0.001,
    initialStakedPercentage: 70,
    priceChangeRate: 2.0, // 2% monthly increase
    priceVolatility: 5.0, // 5% volatility
    totalSupply: 1000000000, // 1 billion tokens
    dailyTransactions: 50000,
    stakingRewardAdjustment: 0.3, // 30% adjustment to price changes
    durationMonths: 12,
    timeStepDays: 7, // Weekly granularity
  };
}
