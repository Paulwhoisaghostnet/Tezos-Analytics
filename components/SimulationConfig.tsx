'use client'

import { SimulationConfig } from '@/lib/simulation'
import { useState } from 'react'

interface SimulationConfigProps {
  config: SimulationConfig
  onConfigChange: (config: SimulationConfig) => void
  onRunSimulation: () => void
}

export default function SimulationConfigPanel({
  config,
  onConfigChange,
  onRunSimulation,
}: SimulationConfigProps) {
  const [localConfig, setLocalConfig] = useState<SimulationConfig>(config)

  const updateConfig = (updates: Partial<SimulationConfig>) => {
    const newConfig = { ...localConfig, ...updates }
    setLocalConfig(newConfig)
    onConfigChange(newConfig)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Simulation Configuration
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Initial State */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">
            Initial State
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Initial Token Price (USD)
            </label>
            <input
              type="number"
              step="0.01"
              value={localConfig.initialTokenPrice}
              onChange={(e) => updateConfig({ initialTokenPrice: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Initial Staking Reward Rate (%/year)
            </label>
            <input
              type="number"
              step="0.1"
              value={localConfig.initialStakingRewardRate}
              onChange={(e) => updateConfig({ initialStakingRewardRate: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Initial Transaction Fee (tokens)
            </label>
            <input
              type="number"
              step="0.0001"
              value={localConfig.initialTransactionFee}
              onChange={(e) => updateConfig({ initialTransactionFee: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Initial Staked Percentage (%)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              max="100"
              value={localConfig.initialStakedPercentage}
              onChange={(e) => updateConfig({ initialStakedPercentage: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Price Scenarios */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">
            Price Scenarios
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Monthly Price Change Rate (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={localConfig.priceChangeRate}
              onChange={(e) => updateConfig({ priceChangeRate: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Positive = price increase, Negative = price decrease
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Price Volatility (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={localConfig.priceVolatility}
              onChange={(e) => updateConfig({ priceVolatility: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Network Parameters */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">
            Network Parameters
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Total Supply (tokens)
            </label>
            <input
              type="number"
              step="1000000"
              value={localConfig.totalSupply}
              onChange={(e) => updateConfig({ totalSupply: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Daily Transactions
            </label>
            <input
              type="number"
              step="1000"
              value={localConfig.dailyTransactions}
              onChange={(e) => updateConfig({ dailyTransactions: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Staking Reward Adjustment (0-1)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={localConfig.stakingRewardAdjustment}
              onChange={(e) => updateConfig({ stakingRewardAdjustment: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              How much staking rewards adjust to price changes
            </p>
          </div>
        </div>

        {/* Simulation Parameters */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">
            Simulation Parameters
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Duration (months)
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={localConfig.durationMonths}
              onChange={(e) => updateConfig({ durationMonths: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time Step (days)
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={localConfig.timeStepDays}
              onChange={(e) => updateConfig({ timeStepDays: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onRunSimulation}
          className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg shadow-md transition-colors"
        >
          Run Simulation
        </button>
      </div>
    </div>
  )
}
