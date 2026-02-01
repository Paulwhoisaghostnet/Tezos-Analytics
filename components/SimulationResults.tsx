'use client'

import { SimulationResult } from '@/lib/simulation'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react'

interface SimulationResultsProps {
  result: SimulationResult | null
}

export default function SimulationResults({ result }: SimulationResultsProps) {
  if (!result) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          Configure and run a simulation to see results
        </p>
      </div>
    )
  }

  const { states, summary } = result

  // Format data for charts
  const chartData = states.map((state, index) => ({
    time: index,
    date: state.timestamp.toLocaleDateString(),
    tokenPrice: state.tokenPrice,
    networkValue: state.networkValue / 1e9, // Convert to billions
    apy: state.apy,
    dailyRevenue: state.dailyRevenue / 1000, // Convert to thousands
    stakingRewardRate: state.stakingRewardRate,
  }))

  const isPositive = summary.priceChangePercent >= 0

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Final Token Price</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${summary.finalPrice.toFixed(4)}
              </p>
            </div>
            {isPositive ? (
              <TrendingUp className="w-8 h-8 text-green-500" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-500" />
            )}
          </div>
          <p className={`text-sm mt-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{summary.priceChangePercent.toFixed(2)}%
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Network Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${(summary.finalNetworkValue / 1e9).toFixed(2)}B
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Peak: ${(summary.peakNetworkValue / 1e9).toFixed(2)}B
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Average APY</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.averageAPY.toFixed(2)}%
              </p>
            </div>
            <Activity className="w-8 h-8 text-purple-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Staking rewards
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Fees</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {(summary.totalTransactionFees / 1e6).toFixed(2)}M
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-orange-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Transaction fees collected
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Token Price Over Time
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="time" 
              stroke="#6b7280"
              label={{ value: 'Time Step', position: 'insideBottom', offset: -5 }}
            />
            <YAxis 
              stroke="#6b7280"
              label={{ value: 'Price (USD)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#fff' }}
            />
            <Area
              type="monotone"
              dataKey="tokenPrice"
              stroke="#0ea5e9"
              fill="#0ea5e9"
              fillOpacity={0.3}
              name="Token Price (USD)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            Network Value (Market Cap)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="time" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                formatter={(value: number) => `$${value.toFixed(2)}B`}
              />
              <Line
                type="monotone"
                dataKey="networkValue"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="Network Value (Billions USD)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            Staking APY Over Time
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="time" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                formatter={(value: number) => `${value.toFixed(2)}%`}
              />
              <Line
                type="monotone"
                dataKey="apy"
                stroke="#ec4899"
                strokeWidth={2}
                name="APY (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Daily Revenue (USD)
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="time" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              formatter={(value: number) => `$${value.toFixed(2)}K`}
            />
            <Area
              type="monotone"
              dataKey="dailyRevenue"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.3}
              name="Daily Revenue (Thousands USD)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
