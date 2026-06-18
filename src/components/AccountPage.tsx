import { useEffect, useMemo } from 'react'
import { formatUnits } from 'viem'
import { useAccount, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { CHAIN_LABELS } from '../lib/constants'
import { formatTokenAmount } from '../lib/format'
import { vaultHref } from '../lib/route'
import { useTokenPricesInUsdc } from '../lib/tokenPrices'
import {
  getClaimRewardRequest,
  type AccountReward,
  useAccountRewards
} from '../lib/useAccountRewards'
import { getVaultReadId, useVaultListReads } from '../lib/useVaultReads'
import type { VaultListToken } from '../lib/types'
import { ChainIcon } from './ChainIcon'
import { VaultRow } from './VaultRow'

type AccountPageProps = {
  chainId: number
  chainLabel: string
  vaults: VaultListToken[]
  isSwitchingChain: boolean
  onOpenChainSelect: () => void
  onVaultAction: (vault: VaultListToken, mode: 'deposit' | 'withdraw') => void
}

export const AccountPage = ({
  chainId,
  chainLabel,
  vaults,
  isSwitchingChain,
  onOpenChainSelect,
  onVaultAction
}: AccountPageProps) => {
  const vaultListReads = useVaultListReads(vaults)
  const rewardsQuery = useAccountRewards(chainId, vaults)
  const rewards = rewardsQuery.data ?? []
  const rewardsProgress = rewardsQuery.progress
  const depositedVaults = useMemo(() => {
    if (!vaultListReads.data) return []

    return vaults.filter((vault) => {
      const data = vaultListReads.data?.[getVaultReadId(vault)]
      return (data?.userAssets ?? 0n) > 0n
    })
  }, [vaultListReads.data, vaults])
  const tokenPriceInputs = useMemo(() => {
    if (!vaultListReads.data) return []

    return depositedVaults.flatMap((vault) => {
      const data = vaultListReads.data?.[getVaultReadId(vault)]
      return [
        {
          address: data?.asset ?? vault.extensions?.underlyingAsset?.address,
          decimals: vault.decimals
        },
        {
          address: data?.prizeToken,
          decimals: data?.prizeTokenDecimals
        }
      ]
    })
  }, [depositedVaults, vaultListReads.data])
  const tokenPrices = useTokenPricesInUsdc(chainId, tokenPriceInputs, {
    enabled: !!vaultListReads.data && depositedVaults.length > 0 && !vaultListReads.isLoading
  })
  const groupedRewards = useMemo(() => groupRewardsByToken(rewards), [rewards])
  const hasSearchedVaults = rewardsProgress.searchedVaults > 0
  const isSearchingRewards = rewardsProgress.isSearching && !isSwitchingChain
  const isVaultListLoading =
    isSwitchingChain ||
    vaultListReads.isLoading ||
    vaultListReads.isFetching ||
    (!vaultListReads.data && !vaultListReads.isError)
  const isLoading =
    isSwitchingChain || ((rewardsQuery.isLoading || rewardsQuery.isFetching) && !hasSearchedVaults)

  return (
    <main className="mx-auto flex max-w-[94rem] flex-col gap-9 px-4 pb-14 pt-10 sm:px-6 lg:pt-12">
      <section className="flex flex-col items-center gap-7 text-center">
        <h1 className="font-grotesk text-[2rem] font-bold leading-none text-white sm:text-4xl lg:text-5xl">
          Account
        </h1>

        <div className="rounded-[1.75rem] bg-[#2D0C66] px-5 py-4 shadow-[0_20px_80px_rgba(20,4,48,0.18)]">
          <button
            type="button"
            onClick={onOpenChainSelect}
            className="flex h-12 min-w-48 items-center justify-between gap-4 rounded-lg border border-pt-purple-200/80 bg-[#2D0C66] px-5 font-grotesk text-base font-medium text-pt-purple-100 outline-none transition hover:border-pt-purple-100 hover:text-white focus:border-pt-teal lg:h-16 lg:min-w-64 lg:px-7 lg:text-xl"
            aria-haspopup="dialog"
          >
            <span className="flex items-center gap-2">
              <ChainIcon chainId={chainId} className="h-5 w-5 rounded-full lg:h-7 lg:w-7" />
              <span>{chainLabel}</span>
            </span>
            <span className="text-pt-purple-200 lg:text-2xl">v</span>
          </button>
        </div>
      </section>

      <section className="rounded-t-2xl rounded-b-[2.5rem] bg-[#2D0C66] px-5 pb-5 pt-7">
        <div className="mb-6 px-1 sm:px-4">
          <h2 className="font-grotesk text-3xl font-semibold text-white">Your Vaults</h2>
        </div>

        <div className="hidden grid-cols-[minmax(0,5fr)_repeat(3,minmax(0,4fr))_minmax(0,5fr)] px-5 pb-7 text-base font-medium text-pt-purple-200 lg:grid">
          <div>Prize Vault</div>
          <div className="text-center">Your Deposit</div>
          <div className="text-center">Total Deposits</div>
          <div className="text-center">Prize Size</div>
          <div className="text-right">
            <span className="inline-block w-52 text-center">Manage</span>
          </div>
        </div>

        {isVaultListLoading ? (
          <VaultSkeleton />
        ) : vaultListReads.isError ? (
          <div className="rounded-2xl bg-white/5 px-5 py-8 text-center font-grotesk text-xl font-semibold text-white">
            Vault deposits are unavailable on {CHAIN_LABELS[chainId] ?? `Chain ${chainId}`}.
          </div>
        ) : depositedVaults.length === 0 ? (
          <div className="rounded-2xl bg-white/5 px-5 py-8 text-center font-grotesk text-xl font-semibold text-white">
            No active vault deposits on {CHAIN_LABELS[chainId] ?? `Chain ${chainId}`}.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {depositedVaults.map((vault) => (
              <VaultRow
                key={`${vault.chainId}-${vault.address}`}
                vault={vault}
                data={vaultListReads.data?.[getVaultReadId(vault)]}
                tokenPrices={tokenPrices.data}
                isLoading={vaultListReads.isLoading || vaultListReads.isFetching || !vaultListReads.data}
                isError={vaultListReads.isError}
                isSwitchingChain={isSwitchingChain}
                href={vaultHref(vault.chainId, vault.address)}
                onAction={(mode) => onVaultAction(vault, mode)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-t-2xl rounded-b-[2.5rem] bg-[#2D0C66] px-5 pb-5 pt-7">
        <div className="mb-6 flex flex-col gap-4 px-1 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div>
            <h2 className="font-grotesk text-3xl font-semibold text-white">Bonus Rewards</h2>
            {rewards.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 text-sm font-medium text-pt-purple-100">
                {groupedRewards.map((reward) => (
                  <span
                    key={reward.token}
                    className="rounded-full bg-white/10 px-3 py-1 text-pt-purple-50"
                  >
                    {formatTokenAmount(reward.amount, reward.decimals, {
                      symbol: reward.symbol
                    })}
                  </span>
                ))}
              </div>
            )}
          </div>

          {!isSearchingRewards && rewards.length > 1 && (
            <ClaimRewardsButton
              chainId={chainId}
              rewards={rewards}
              onSettled={() => rewardsQuery.refetch()}
              className="w-full sm:w-auto"
            />
          )}
        </div>

        {(isSearchingRewards || hasSearchedVaults) && (
          <RewardSearchProgress
            searchedVaults={rewardsProgress.searchedVaults}
            totalVaults={rewardsProgress.totalVaults}
            isSearching={isSearchingRewards}
          />
        )}

        {isLoading ? (
          <RewardSkeleton />
        ) : rewardsQuery.isError ? (
          <div className="rounded-2xl bg-white/5 px-5 py-8 text-center font-grotesk text-xl font-semibold text-white">
            Rewards are unavailable on {CHAIN_LABELS[chainId] ?? `Chain ${chainId}`}.
          </div>
        ) : rewards.length === 0 && isSearchingRewards ? (
          <div className="rounded-2xl bg-white/5 px-5 py-8 text-center font-grotesk text-xl font-semibold text-white">
            Searching for bonus rewards.
          </div>
        ) : rewards.length === 0 ? (
          <div className="rounded-2xl bg-white/5 px-5 py-8 text-center font-grotesk text-xl font-semibold text-white">
            No bonus rewards to claim.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rewards.map((reward) => (
              <RewardRow key={reward.id} reward={reward} onSettled={() => rewardsQuery.refetch()} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

const RewardRow = ({
  reward,
  onSettled
}: {
  reward: AccountReward
  onSettled: () => void
}) => {
  const amount = Number(formatUnits(reward.amount, reward.tokenDecimals))
  const epochCount = Object.keys(reward.epochRewards).length

  return (
    <div className="grid gap-4 rounded-2xl bg-white px-5 py-5 text-pt-purple-900 shadow-[0_16px_50px_rgba(20,4,48,0.12)] lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-grotesk text-2xl font-semibold text-pt-purple-900">
            {reward.vaultName}
          </h3>
          <span className="rounded-full bg-pt-purple-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-pt-purple-700">
            {reward.type === 'poolWide' ? 'Pool-Wide' : 'Vault'}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium text-pt-purple-600">
          {epochCount} {epochCount === 1 ? 'epoch' : 'epochs'} claimable
        </p>
      </div>

      <div className="font-grotesk text-2xl font-semibold text-pt-purple-900 lg:min-w-40 lg:text-right">
        {formatTokenAmount(reward.amount, reward.tokenDecimals, {
          symbol: reward.tokenSymbol,
          compact: amount >= 100_000
        })}
      </div>

      <ClaimRewardsButton chainId={reward.chainId} rewards={[reward]} onSettled={onSettled} />
    </div>
  )
}

const ClaimRewardsButton = ({
  chainId,
  rewards,
  onSettled,
  className = ''
}: {
  chainId: number
  rewards: AccountReward[]
  onSettled: () => void
  className?: string
}) => {
  const { address, chain } = useAccount()
  const { switchChain } = useSwitchChain()
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isFetching: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    chainId,
    hash,
    query: { enabled: !!hash, refetchInterval: 1_000 }
  })
  const request = address ? getClaimRewardRequest(chainId, address, rewards) : undefined
  const errorMessage = getDisplayError(error)

  useEffect(() => {
    if (isSuccess) onSettled()
  }, [isSuccess, onSettled])

  const onClick = () => {
    reset()
    if (chain?.id !== chainId) {
      switchChain({ chainId })
      return
    }
    if (request) writeContract(request as Parameters<typeof writeContract>[0])
  }

  const label =
    chain?.id !== chainId
      ? `Switch to ${CHAIN_LABELS[chainId] ?? 'Chain'}`
      : isPending
        ? 'Confirm in Wallet'
        : isConfirming
          ? 'Claiming'
          : isSuccess
            ? 'Claimed'
            : rewards.length > 1
              ? 'Claim All'
              : 'Claim'

  return (
    <div className={`flex min-w-0 flex-col items-stretch gap-2 lg:w-52 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={!request || isPending || isConfirming}
        className="min-h-14 w-full rounded-2xl bg-pt-teal px-8 py-3 font-grotesk text-xl font-semibold text-pt-purple-900 transition hover:bg-pt-teal-light disabled:cursor-not-allowed disabled:opacity-60"
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

const RewardSkeleton = () => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: 3 }, (_, index) => (
      <div key={index} className="h-24 animate-pulse rounded-2xl bg-white/10" />
    ))}
  </div>
)

const VaultSkeleton = () => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: 3 }, (_, index) => (
      <div key={index} className="h-28 animate-pulse rounded-3xl bg-white/10 lg:h-20" />
    ))}
  </div>
)

const RewardSearchProgress = ({
  searchedVaults,
  totalVaults,
  isSearching
}: {
  searchedVaults: number
  totalVaults: number
  isSearching: boolean
}) => {
  const progress = totalVaults > 0 ? Math.round((searchedVaults / totalVaults) * 100) : 0

  return (
    <div className="mb-4 rounded-2xl bg-white/10 px-4 py-3">
      <div className="flex items-center justify-between gap-4 font-grotesk text-sm font-semibold text-pt-purple-50">
        <span>{isSearching ? 'Searching rewards' : 'Reward search complete'}</span>
        <span>
          {searchedVaults}/{totalVaults} vaults
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-pt-teal transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

const groupRewardsByToken = (rewards: AccountReward[]) => {
  const grouped: Record<
    string,
    { token: string; symbol: string; decimals: number; amount: bigint }
  > = {}

  rewards.forEach((reward) => {
    const key = reward.token.toLowerCase()
    grouped[key] ??= {
      token: key,
      symbol: reward.tokenSymbol,
      decimals: reward.tokenDecimals,
      amount: 0n
    }
    grouped[key].amount += reward.amount
  })

  return Object.values(grouped)
}
