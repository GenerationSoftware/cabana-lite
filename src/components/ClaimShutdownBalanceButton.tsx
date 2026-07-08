import { useEffect } from 'react'
import { useAccount, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { prizePoolAbi } from '../lib/abis'
import { CHAIN_LABELS } from '../lib/constants'
import type { VaultListToken, VaultReadData } from '../lib/types'

interface ClaimShutdownBalanceButtonProps {
  vault: VaultListToken
  data?: VaultReadData
  onSettled?: () => void
  className?: string
}

export const ClaimShutdownBalanceButton = ({
  vault,
  data,
  onSettled,
  className = ''
}: ClaimShutdownBalanceButtonProps) => {
  const { address, chain } = useAccount()
  const { switchChain } = useSwitchChain()
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isFetching: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    chainId: vault.chainId,
    hash,
    query: { enabled: !!hash, refetchInterval: 1_000 }
  })
  const isWrongChain = chain?.id !== vault.chainId
  const canClaim = !!address && !!data?.prizePool && (data?.shutdownBalance ?? 0n) > 0n
  const errorMessage = getDisplayError(error)

  useEffect(() => {
    if (isSuccess) onSettled?.()
  }, [isSuccess, onSettled])

  const onClick = () => {
    reset()
    if (isWrongChain) {
      switchChain({ chainId: vault.chainId })
      return
    }
    if (!address || !data?.prizePool) return

    writeContract({
      address: data.prizePool,
      abi: prizePoolAbi,
      functionName: 'withdrawShutdownBalance',
      args: [vault.address, address]
    })
  }

  const label = isWrongChain
    ? `Switch to ${CHAIN_LABELS[vault.chainId] ?? 'Chain'}`
    : isPending
      ? 'Confirm in Wallet'
      : isConfirming
        ? 'Claiming'
        : isSuccess
          ? 'Claimed'
          : 'Claim'

  return (
    <div className={`flex min-w-0 flex-col items-stretch gap-2 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={!canClaim || isPending || isConfirming}
        className="min-h-14 rounded-2xl bg-pt-teal px-6 py-3 font-grotesk text-lg font-semibold text-pt-purple-900 transition hover:bg-pt-teal-light disabled:cursor-not-allowed disabled:opacity-60"
      >
        {label}
      </button>
      {errorMessage && (
        <span className="max-w-full break-words text-right text-sm font-medium text-[#FFB6C1]">
          {errorMessage}
        </span>
      )}
    </div>
  )
}

const getDisplayError = (error: unknown) => {
  if (!error) return undefined

  const parsedError = error as {
    code?: number
    shortMessage?: string
    message?: string
    cause?: { code?: number; message?: string }
  }
  const rawMessage = parsedError.shortMessage ?? parsedError.message ?? parsedError.cause?.message

  if (
    parsedError.code === 4001 ||
    parsedError.cause?.code === 4001 ||
    /user rejected|rejected the request|denied|cancel/i.test(rawMessage ?? '')
  ) {
    return 'Transaction cancelled.'
  }

  return (rawMessage ?? 'Transaction failed.')
    .split('\n')[0]
    .replace(/0x[a-fA-F0-9]{32,}/g, '0x...')
}
