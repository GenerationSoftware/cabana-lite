import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { POOL_STAKING_VAULTS } from '../lib/constants'
import { formatTokenAmount, formatUsdcValue } from '../lib/format'
import type { VaultTwabRewardToken } from '../lib/useAccountRewards'
import type { VaultListToken, VaultReadData } from '../lib/types'
import { ClaimShutdownBalanceButton } from './ClaimShutdownBalanceButton'

interface VaultRowProps {
  vault: VaultListToken
  data?: VaultReadData
  tokenPrices?: Record<string, number>
  isLoading: boolean
  isError: boolean
  isSwitchingChain: boolean
  href: string
  rewardTokens?: VaultTwabRewardToken[]
  onAction: (mode: 'deposit' | 'withdraw') => void
  onShutdownClaimSettled?: () => void
}

export const VaultRow = ({
  vault,
  data,
  tokenPrices,
  isLoading,
  isError,
  isSwitchingChain,
  href,
  rewardTokens,
  onAction,
  onShutdownClaimSettled
}: VaultRowProps) => {
  const { address, chain } = useAccount()
  const isCurrentChain = chain?.id === vault.chainId
  const metricFallback = !address ? '-' : !isCurrentChain && !isSwitchingChain ? 'Switch chain' : undefined
  const isMetricLoading = isSwitchingChain || isLoading
  const isPoolStakingVault = POOL_STAKING_VAULTS[vault.chainId] === vault.address.toLowerCase()
  const hasUserAssets = (data?.userAssets ?? 0n) > 0n
  const assetAddress = data?.asset ?? vault.extensions?.underlyingAsset?.address
  const assetPrice = assetAddress ? tokenPrices?.[assetAddress.toLowerCase()] : undefined
  const prizeTokenPrice = data?.prizeToken ? tokenPrices?.[data.prizeToken.toLowerCase()] : undefined
  const rewardLabel = getRewardTokenLabel(rewardTokens)
  const isShutdown = data?.isPrizePoolShutdown ?? false
  const isDisabled = vault.tags?.includes('disabled') ?? false
  const shutdownBalance = data?.shutdownBalance ?? 0n
  const hasShutdownClaim = shutdownBalance > 0n
  const canDeposit = !!data && isCurrentChain && !isSwitchingChain && !isShutdown && !isDisabled

  return (
    <article
      className={`grid gap-4 rounded-3xl px-5 py-4 lg:grid-cols-[minmax(0,5fr)_repeat(3,minmax(0,4fr))_minmax(0,5fr)] lg:items-center ${
        isPoolStakingVault ? 'bg-pt-purple-600' : 'bg-pt-transparent'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={vault.logoURI || '/favicon.png'}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full bg-pt-purple-900 object-contain"
        />
        <Link
          to={href}
          className="min-w-0 text-left font-grotesk text-lg font-semibold leading-none text-pt-purple-50 underline decoration-pt-purple-200/60 decoration-2 underline-offset-4 transition hover:text-pt-teal hover:decoration-pt-teal focus:text-pt-teal focus:outline-none focus:decoration-pt-teal"
        >
          <span className="block truncate">{vault.name}</span>
        </Link>
      </div>

      <Metric
        label="Your deposit"
        isLoading={isMetricLoading && !metricFallback}
        subValue={
          !metricFallback && !isMetricLoading
            ? formatUsdcValue(data?.userAssets, vault.decimals, assetPrice, { compact: true })
            : undefined
        }
        value={
          metricFallback
            ? metricFallback
            : isMetricLoading
              ? undefined
              : formatTokenAmount(data?.userAssets, vault.decimals, {
                  compact: true,
                  symbol: vault.extensions?.underlyingAsset?.symbol
                })
        }
      />
      <Metric
        label="Total deposits"
        isLoading={isMetricLoading && !metricFallback}
        subValue={
          !metricFallback && !isMetricLoading
            ? formatUsdcValue(data?.totalAssets, vault.decimals, assetPrice, { compact: true })
            : undefined
        }
        value={
          metricFallback
            ? metricFallback
            : isMetricLoading
              ? undefined
              : formatTokenAmount(data?.totalAssets, vault.decimals, {
                  compact: true,
                  symbol: vault.extensions?.underlyingAsset?.symbol
                })
        }
      />
      <Metric
        label={isShutdown ? 'Shutdown' : 'Prize'}
        isLoading={isMetricLoading && !metricFallback}
        subValue={
          !isShutdown && !metricFallback && !isMetricLoading
            ? formatUsdcValue(data?.tierZeroPrize, data?.prizeTokenDecimals, prizeTokenPrice, {
                compact: true
              })
            : isShutdown && !metricFallback && !isMetricLoading && hasShutdownClaim
              ? 'Claimable'
            : undefined
        }
        value={
          metricFallback
            ? metricFallback
            : isMetricLoading
              ? undefined
              : isShutdown
                ? hasShutdownClaim
                  ? formatTokenAmount(shutdownBalance, data?.prizeTokenDecimals, {
                      compact: true,
                      symbol: data?.prizeTokenSymbol
                    })
                  : 'No prizes'
                : formatTokenAmount(data?.tierZeroPrize, data?.prizeTokenDecimals, {
                    compact: true,
                    symbol: data?.prizeTokenSymbol
                  })
        }
        extraValue={
          !metricFallback && !isMetricLoading
            ? isShutdown
              ? 'Shutdown'
              : rewardLabel
            : undefined
        }
        extraTone={isShutdown ? 'warning' : 'teal'}
      />
      <div className="min-w-0">
        {isError && isCurrentChain && (
          <div className="mb-3 rounded-lg bg-pt-warning/40 px-3 py-2 text-xs text-pt-warning-light">
            Wallet read failed for this vault.
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2 lg:ml-auto">
          {isShutdown && hasShutdownClaim && (
            <ClaimShutdownBalanceButton
              vault={vault}
              data={data}
              onSettled={onShutdownClaimSettled}
              className="lg:w-32"
            />
          )}
          {hasUserAssets && (
            <button
              type="button"
              onClick={() => onAction('withdraw')}
              className="h-[3.25rem] rounded-lg border border-pt-purple-200/10 bg-white/10 px-5 font-grotesk text-base font-semibold text-pt-purple-100 transition hover:bg-white/15 hover:text-white"
            >
              Withdraw
            </button>
          )}
          {canDeposit && (
            <button
              type="button"
              onClick={() => onAction('deposit')}
              className="h-[3.25rem] rounded-lg bg-pt-teal px-7 font-grotesk text-base font-semibold text-pt-purple-900 transition hover:bg-pt-teal-light"
            >
              Deposit
            </button>
          )}
          {isDisabled && (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-pt-warning/30 bg-pt-warning/10 px-3 py-1 font-grotesk text-xs font-bold uppercase tracking-wide text-pt-warning-light">
                Disabled
              </span>
              <button
                type="button"
                disabled
                className="h-[3.25rem] cursor-not-allowed rounded-lg bg-pt-purple-200/15 px-7 font-grotesk text-base font-semibold text-pt-purple-200/60"
              >
                Deposit
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

const Metric = ({
  label,
  value,
  subValue,
  extraValue,
  extraTone = 'teal',
  isLoading
}: {
  label: string
  value?: string
  subValue?: string
  extraValue?: string
  extraTone?: 'teal' | 'warning'
  isLoading?: boolean
}) => (
  <div className="flex items-center justify-between gap-4 rounded-lg bg-pt-purple-900/30 px-3 py-3 text-right lg:block lg:bg-transparent lg:px-0 lg:py-0 lg:text-center">
    <div className="text-sm font-medium text-pt-purple-200 lg:hidden">{label}</div>
    <div className="mt-0 flex min-h-[2.25rem] flex-col items-end justify-center gap-1 text-lg font-semibold leading-none text-pt-purple-50 lg:mt-0 lg:items-center">
      {isLoading ? (
        <LoadingIndicator />
      ) : (
        <>
          <span>{value}</span>
          {subValue && <span className="text-xs font-medium text-pt-purple-200">{subValue}</span>}
          {extraValue && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase leading-none ${
                extraTone === 'warning'
                  ? 'bg-pt-warning/30 text-pt-warning-light'
                  : 'bg-pt-teal/20 text-pt-teal'
              }`}
            >
              {extraValue}
            </span>
          )}
        </>
      )}
    </div>
  </div>
)

const getRewardTokenLabel = (rewardTokens?: VaultTwabRewardToken[]) => {
  if (!rewardTokens?.length) return undefined

  const symbols = Array.from(new Set(rewardTokens.map((token) => token.symbol))).filter(Boolean)
  if (!symbols.length) return undefined

  return `+ ${symbols.join(' + ')} rewards!`
}

const LoadingIndicator = () => (
  <span className="flex items-center gap-1.5" aria-label="Loading">
    <span className="h-2 w-2 animate-pulse rounded-full bg-pt-teal" />
    <span className="h-2 w-2 animate-pulse rounded-full bg-pt-purple-200 [animation-delay:120ms]" />
    <span className="h-2 w-2 animate-pulse rounded-full bg-pt-purple-200 [animation-delay:240ms]" />
  </span>
)
