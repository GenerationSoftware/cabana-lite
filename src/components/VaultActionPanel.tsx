import { useState } from 'react'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAccount, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { erc20Abi, vaultAbi } from '../lib/abis'
import { CHAIN_LABELS } from '../lib/constants'
import { formatTokenAmount, parseTokenAmount } from '../lib/format'
import type { VaultListToken, VaultReadData } from '../lib/types'

interface VaultActionPanelProps {
  vault: VaultListToken
  data?: VaultReadData
  refetch: () => void
}

export const VaultActionPanel = ({ vault, data, refetch }: VaultActionPanelProps) => {
  const { chain, address } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { switchChain } = useSwitchChain()
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('')
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    chainId: vault.chainId,
    hash,
    query: {
      enabled: !!hash,
      refetchInterval: 1_000
    }
  })

  const parsedAmount = (() => {
    try {
      return parseTokenAmount(amount, vault.decimals)
    } catch {
      return 0n
    }
  })()
  const needsApproval = mode === 'deposit' && parsedAmount > 0n && (data?.allowance ?? 0n) < parsedAmount
  const disabled = !address || !data || parsedAmount <= 0n || isPending || isConfirming

  const submit = () => {
    if (!data?.asset || !address || parsedAmount <= 0n) return

    if (needsApproval) {
      writeContract(
        {
          address: data.asset,
          abi: erc20Abi,
          functionName: 'approve',
          args: [vault.address, parsedAmount]
        },
        { onSuccess: () => refetch() }
      )
      return
    }

    if (mode === 'deposit') {
      writeContract(
        {
          address: vault.address,
          abi: vaultAbi,
          functionName: 'deposit',
          args: [parsedAmount, address]
        },
        { onSuccess: () => refetch() }
      )
    } else {
      writeContract(
        {
          address: vault.address,
          abi: vaultAbi,
          functionName: 'withdraw',
          args: [parsedAmount, address, address]
        },
        { onSuccess: () => refetch() }
      )
    }
  }

  if (!address) {
    return (
      <button
        type="button"
        onClick={openConnectModal}
        className="w-full rounded-lg bg-pt-teal px-4 py-3 font-grotesk text-lg font-bold text-pt-purple-900 transition hover:bg-pt-teal-light"
      >
        Connect Wallet
      </button>
    )
  }

  if (chain?.id !== vault.chainId) {
    return (
      <button
        type="button"
        onClick={() => switchChain({ chainId: vault.chainId })}
        className="w-full rounded-lg bg-pt-purple-500 px-4 py-3 font-grotesk text-lg font-bold text-white transition hover:bg-pt-purple-400"
      >
        Switch to {CHAIN_LABELS[vault.chainId]}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 rounded-lg bg-pt-purple-900/60 p-1">
        <button
          type="button"
          onClick={() => setMode('deposit')}
          className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === 'deposit' ? 'bg-pt-purple-500 text-white' : 'text-pt-purple-200'}`}
        >
          Deposit
        </button>
        <button
          type="button"
          onClick={() => setMode('withdraw')}
          className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === 'withdraw' ? 'bg-pt-purple-500 text-white' : 'text-pt-purple-200'}`}
        >
          Withdraw
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-white outline-none placeholder:text-pt-purple-300"
        />
        <span className="shrink-0 text-sm font-semibold text-pt-purple-200">
          {vault.extensions?.underlyingAsset?.symbol ?? vault.symbol}
        </span>
      </div>
      <div className="flex justify-between text-xs text-pt-purple-200">
        <span>
          Wallet {formatTokenAmount(data?.walletAssetBalance, vault.decimals, { compact: true })}
        </span>
        <span>
          Deposited {formatTokenAmount(data?.userAssets, vault.decimals, { compact: true })}
        </span>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={submit}
        className="rounded-lg bg-pt-teal px-4 py-3 font-grotesk text-xl font-bold text-pt-purple-900 transition hover:bg-pt-teal-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending || isConfirming ? 'Confirming...' : needsApproval ? 'Approve' : mode === 'deposit' ? 'Deposit' : 'Withdraw'}
      </button>
      {error && <div className="text-xs text-pt-warning-light">{error.message}</div>}
    </div>
  )
}
