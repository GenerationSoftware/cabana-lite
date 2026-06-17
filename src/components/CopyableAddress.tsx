import { useState } from 'react'
import type { Address } from 'viem'
import { shortenAddress } from '../lib/format'

interface CopyableAddressProps {
  label: string
  address?: Address
}

export const CopyableAddress = ({ label, address }: CopyableAddressProps) => {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_500)
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-white/10 p-4">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-pt-purple-200">
        {label}
      </span>
      <button
        type="button"
        onClick={copy}
        disabled={!address}
        className="flex items-center justify-between gap-3 rounded-lg bg-pt-purple-900/60 px-3 py-3 text-left transition hover:bg-pt-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0 truncate font-mono text-sm text-white">
          {address ? shortenAddress(address) : 'Unavailable'}
        </span>
        <span className="shrink-0 text-sm font-semibold text-pt-teal">
          {copied ? 'Copied' : 'Copy'}
        </span>
      </button>
    </div>
  )
}
