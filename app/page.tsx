'use client'

import { useState } from 'react'
import SimulationConfigPanel from '@/components/SimulationConfig'
import SimulationResults from '@/components/SimulationResults'
import { SimulationConfig, SimulationResult, runSimulation, getDefaultConfig } from '@/lib/simulation'

export default function Home() {
  const [config, setConfig] = useState<SimulationConfig>(getDefaultConfig())
  const [result, setResult] = useState<SimulationResult | null>(null)

  const handleRunSimulation = () => {
    const simulationResult = runSimulation(config)
    setResult(simulationResult)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Tezos Blockchain Simulator
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Simulate blockchain pricing scenarios and analyze economic dynamics
          </p>
        </header>

        <div className="space-y-8">
          <SimulationConfigPanel
            config={config}
            onConfigChange={setConfig}
            onRunSimulation={handleRunSimulation}
          />

          <SimulationResults result={result} />
        </div>
      </div>
    </main>
  )
}
