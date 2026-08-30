import { useEffect, useState } from 'react'
import { useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { formatUnits, type Address } from 'viem'
import { erc20Abi, vaultAbi } from '../lib/abis'
import { CHAIN_LABELS } from '../lib/constants'
import { formatTokenAmount, parseTokenAmount } from '../lib/format'
import type { VaultListToken, VaultReadData } from '../lib/types'

interface TransactionModalProps {
  vault: VaultListToken
  data?: VaultReadData
  account: Address
  connectedChainId?: number
  mode: 'deposit' | 'withdraw'
  onModeChange: (mode: 'deposit' | 'withdraw') => void
  onClose: () => void
  onSettled: () => void
}

export const TransactionModal = (props: TransactionModalProps) => {
  const { vault, data, account, connectedChainId, mode, onModeChange, onClose, onSettled } = props
  const { switchChain } = useSwitchChain()
  const [amount, setAmount] = useState('')
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    chainId: vault.chainId,
    hash,
    query: { enabled: !!hash, refetchInterval: 1_000 }
  })

  const parsedAmount = (() => {
    try {
      return parseTokenAmount(amount, vault.decimals)
    } catch {
      return 0n
    }
  })()

  const symbol = vault.extensions?.underlyingAsset?.symbol ?? vault.symbol
  const isWrongChain = connectedChainId !== vault.chainId
  const isShutdown = data?.isPrizePoolShutdown ?? false
  const isDeprecated = vault.tags?.includes('deprecated') ?? false
  const isDisabled = vault.tags?.includes('disabled') ?? false
  const isDepositDisabled = isShutdown || isDeprecated || isDisabled
  const activeMode = isDepositDisabled && mode === 'deposit' ? 'withdraw' : mode
  const modes: Array<'deposit' | 'withdraw'> = isDepositDisabled ? ['withdraw'] : ['deposit', 'withdraw']
  const needsApproval = activeMode === 'deposit' && parsedAmount > 0n && (data?.allowance ?? 0n) < parsedAmount
  const disabled = !data || parsedAmount <= 0n || isPending || isConfirming || (isDepositDisabled && activeMode === 'deposit')

  useEffect(() => {
    if (isSuccess) {
      onSettled()
    }
  }, [isSuccess, onSettled])

  useEffect(() => {
    if (isDepositDisabled && mode === 'deposit') {
      onModeChange('withdraw')
    }
  }, [isDepositDisabled, mode, onModeChange])

  const submit = () => {
    if (!data?.asset || parsedAmount <= 0n) return
    if (isDepositDisabled && activeMode === 'deposit') return

    if (needsApproval) {
      writeContract({
        address: data.asset,
        abi: erc20Abi,
        functionName: 'approve',
        args: [vault.address, parsedAmount]
      })
      return
    }

    writeContract({
      address: vault.address,
      abi: vaultAbi,
      functionName: activeMode,
      args:
        activeMode === 'deposit'
          ? [parsedAmount, account]
          : [parsedAmount, account, account]
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#21064E] p-6 text-pt-purple-50 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-grotesk text-3xl font-bold text-white">
              {activeMode === 'deposit' ? 'Deposit' : 'Withdraw'}
            </h2>
            <p className="mt-1 text-sm text-pt-purple-200">
              {vault.name} on {CHAIN_LABELS[vault.chainId]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xl font-bold text-pt-purple-200 transition hover:bg-white/10 hover:text-white"
          >
            x
          </button>
        </div>

        <div className={`mb-5 grid rounded-lg bg-pt-purple-900/60 p-1 ${isDepositDisabled ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {modes.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                reset()
                onModeChange(tab)
              }}
              className={`rounded-md px-3 py-2 font-semibold capitalize ${
                activeMode === tab ? 'bg-pt-purple-500 text-white' : 'text-pt-purple-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {isWrongChain ? (
          <button
            type="button"
            onClick={() => switchChain({ chainId: vault.chainId })}
            className="w-full rounded-lg bg-pt-purple-500 px-4 py-4 font-grotesk text-xl font-bold text-white transition hover:bg-pt-purple-400"
          >
            Switch to {CHAIN_LABELS[vault.chainId]}
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-white/10 p-4">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-pt-purple-200">
                Amount
              </label>
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-white/10 bg-pt-purple-900/50 px-4 py-3">
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-pt-purple-300"
                />
                {activeMode === 'withdraw' && (
                  <button
                    type="button"
                    disabled={data?.userAssets === undefined}
                    onClick={() => setAmount(formatUnits(data?.userAssets ?? 0n, vault.decimals))}
                    className="shrink-0 rounded-md bg-pt-purple-500/40 px-2 py-1 text-xs font-bold uppercase tracking-wide text-pt-teal transition hover:bg-pt-purple-500/70 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Max
                  </button>
                )}
                <span className="shrink-0 font-semibold text-pt-purple-100">{symbol}</span>
              </div>
              <div className="mt-3 flex justify-between text-sm text-pt-purple-200">
                <span>
                  Wallet {formatTokenAmount(data?.walletAssetBalance, vault.decimals, { compact: true })}
                </span>
                <span>
                  Deposited {formatTokenAmount(data?.userAssets, vault.decimals, { compact: true })}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-white/10 p-4 text-sm text-pt-purple-200">
              <div className="flex justify-between gap-4">
                <span>Vault</span>
                <span className="text-right text-white">{vault.name}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span>Prize token</span>
                <span className="text-right text-white">{data?.prizeTokenSymbol ?? '...'}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span>Total deposits</span>
                <span className="text-right text-white">
                  {formatTokenAmount(data?.totalAssets, vault.decimals, { compact: true, symbol })}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={disabled}
              onClick={submit}
              className="rounded-lg bg-pt-teal px-4 py-4 font-grotesk text-2xl font-bold text-pt-purple-900 transition hover:bg-pt-teal-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending || isConfirming
                ? 'Confirming...'
                : needsApproval
                  ? 'Approve'
                  : activeMode === 'deposit'
                    ? 'Deposit'
                    : 'Withdraw'}
            </button>
          </div>
        )}

        {error && <div className="mt-4 text-sm text-pt-warning-light">{error.message}</div>}
      </div>
    </div>
  )
}
