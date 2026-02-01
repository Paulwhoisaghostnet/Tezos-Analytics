import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tezos Blockchain Simulator',
  description: 'Simulate blockchain pricing scenarios for Tezos-like networks',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
