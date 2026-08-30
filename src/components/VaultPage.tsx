import { useAccount } from 'wagmi'
import { CHAIN_ICON, CHAIN_LABELS } from '../lib/constants'
import { formatTokenAmount, formatUsdcValue, shortenAddress } from '../lib/format'
import { useTokenPricesInUsdc } from '../lib/tokenPrices'
import { usePrizePoolReads, useVaultReads } from '../lib/useVaultReads'
import type { VaultListToken } from '../lib/types'
import { CopyableAddress } from './CopyableAddress'
import { ClaimShutdownBalanceButton } from './ClaimShutdownBalanceButton'
import { PrizeList } from './PrizeList'

interface VaultPageProps {
  vault: VaultListToken
  onBack: () => void
  onAction: (mode: 'deposit' | 'withdraw') => void
}

export const VaultPage = ({ vault, onBack, onAction }: VaultPageProps) => {
  const { address, chain } = useAccount()
  const { data, isLoading, isError, refetch } = useVaultReads(vault)
  const prizePoolReads = usePrizePoolReads(vault.chainId)
  const prizeData = prizePoolReads.data
  const isCurrentChain = chain?.id === vault.chainId
  const symbol = vault.extensions?.underlyingAsset?.symbol ?? vault.symbol
  const metricFallback = !address ? '-' : !isCurrentChain ? 'Switch chain' : undefined
  const assetAddress = data?.asset ?? vault.extensions?.underlyingAsset?.address
  const tokenPrices = useTokenPricesInUsdc(vault.chainId, [
    { address: assetAddress, decimals: vault.decimals },
    { address: prizeData?.prizeToken ?? data?.prizeToken, decimals: prizeData?.prizeTokenDecimals ?? data?.prizeTokenDecimals }
  ], { enabled: (!!data || !!prizeData) && !isLoading && !prizePoolReads.isLoading })
  const assetPrice = assetAddress ? tokenPrices.data?.[assetAddress.toLowerCase()] : undefined
  const prizeToken = prizeData?.prizeToken ?? data?.prizeToken
  const prizeTokenPrice = prizeToken ? tokenPrices.data?.[prizeToken.toLowerCase()] : undefined
  const tierZeroPrize = prizeData?.tierPrizes[0] ?? data?.tierZeroPrize
  const prizeTokenDecimals = prizeData?.prizeTokenDecimals ?? data?.prizeTokenDecimals
  const prizeTokenSymbol = prizeData?.prizeTokenSymbol ?? data?.prizeTokenSymbol
  const isShutdown = data?.isPrizePoolShutdown ?? prizeData?.isShutdown ?? false
  const isDeprecated = vault.tags?.includes('deprecated') ?? false
  const shutdownBalance = data?.shutdownBalance ?? 0n
  const hasShutdownClaim = shutdownBalance > 0n
  const canDeposit = !!data && isCurrentChain && !isLoading && !isShutdown && !isDeprecated

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6">
      <section className="flex flex-col items-center gap-5 text-center">
        <button
          type="button"
          onClick={onBack}
          className="self-start rounded-lg px-3 py-2 text-sm font-semibold text-pt-purple-100 transition hover:bg-white/10 hover:text-white"
        >
          Back
        </button>
        <div className="relative">
          <img
            src={vault.logoURI || '/favicon.png'}
            alt=""
            className="h-20 w-20 rounded-full bg-pt-purple-900 object-contain"
          />
          {CHAIN_ICON[vault.chainId] && (
            <img
              src={CHAIN_ICON[vault.chainId]}
              alt=""
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full"
            />
          )}
        </div>
        <div>
          <h1 className="font-grotesk text-5xl font-bold text-white">{vault.name}</h1>
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-sm text-pt-purple-200">
            <span>{CHAIN_LABELS[vault.chainId]}</span>
            <span>{shortenAddress(vault.address)}</span>
            {vault.extensions?.yieldSource?.name && <span>{vault.extensions.yieldSource.name}</span>}
          </div>
        </div>
        {isShutdown && (
          <div className="w-full rounded-2xl border border-pt-warning/30 bg-pt-warning/20 px-5 py-4 text-left text-pt-warning-light">
            <div className="font-grotesk text-xl font-semibold text-white">Prize pool shutdown</div>
            <div className="mt-1 text-sm font-medium">
              This vault no longer offers prizes. You can still withdraw deposits and claim any prize pool share.
            </div>
          </div>
        )}
        <div className="flex w-full max-w-md gap-3">
          {canDeposit && (
            <button
              type="button"
              onClick={() => onAction('deposit')}
              className="flex-1 rounded-lg bg-pt-teal px-5 py-4 font-grotesk text-2xl font-bold text-pt-purple-900 transition hover:bg-pt-teal-light"
            >
              Deposit
            </button>
          )}
          <button
            type="button"
            onClick={() => onAction('withdraw')}
            className="flex-1 rounded-lg bg-pt-purple-500 px-5 py-4 font-grotesk text-2xl font-bold text-white transition hover:bg-pt-purple-400"
          >
            Withdraw
          </button>
          {isShutdown && hasShutdownClaim && (
            <ClaimShutdownBalanceButton
              vault={vault}
              data={data}
              onSettled={() => void refetch()}
              className="flex-1"
            />
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          label="Your deposit"
          subValue={
            metricFallback || isLoading
              ? undefined
              : formatUsdcValue(data?.userAssets, vault.decimals, assetPrice, { compact: true })
          }
          value={
            metricFallback ??
            (isLoading
              ? '...'
              : formatTokenAmount(data?.userAssets, vault.decimals, { compact: true, symbol }))
          }
        />
        <StatCard
          label="Total deposits"
          subValue={
            metricFallback || isLoading
              ? undefined
              : formatUsdcValue(data?.totalAssets, vault.decimals, assetPrice, { compact: true })
          }
          value={
            metricFallback ??
            (isLoading
              ? '...'
              : formatTokenAmount(data?.totalAssets, vault.decimals, { compact: true, symbol }))
          }
        />
        <StatCard
          label={isShutdown ? 'Prize pool share' : 'Grand prize'}
          subValue={
            metricFallback || isLoading || isShutdown
              ? undefined
              : formatUsdcValue(tierZeroPrize, prizeTokenDecimals, prizeTokenPrice, {
                  compact: true
                })
          }
          value={
            metricFallback ??
            (isLoading
              ? '...'
              : isShutdown
                ? hasShutdownClaim
                  ? formatTokenAmount(shutdownBalance, prizeTokenDecimals, {
                      compact: true,
                      symbol: prizeTokenSymbol
                    })
                  : 'No claimable share'
                : formatTokenAmount(tierZeroPrize, prizeTokenDecimals, {
                    compact: true,
                    symbol: prizeTokenSymbol
                  }))
          }
        />
      </section>

      {isError && isCurrentChain && (
        <div className="rounded-lg bg-pt-warning/40 p-4 text-sm text-pt-warning-light">
          Wallet reads failed for this vault.
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <CopyableAddress label="Vault address" address={vault.address} />
        <CopyableAddress label="Deposit token address" address={data?.asset ?? vault.extensions?.underlyingAsset?.address} />
        <CopyableAddress label="Prize pool address" address={data?.prizePool} />
        <CopyableAddress label="Prize token address" address={data?.prizeToken} />
      </section>

      {!isShutdown && (
        <section className="flex flex-col items-center">
          <PrizeList
            chainId={vault.chainId}
            data={prizeData}
            prizeTokenPrice={prizeTokenPrice}
            isLoading={isCurrentChain && (prizePoolReads.isLoading || prizePoolReads.isFetching)}
            isError={prizePoolReads.isError}
            isSwitchingChain={!isCurrentChain}
          />
        </section>
      )}
    </main>
  )
}

const StatCard = ({ label, value, subValue }: { label: string; value: string; subValue?: string }) => (
  <div className="rounded-lg bg-white/10 p-5">
    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-pt-purple-200">{label}</div>
    <div className="mt-3 font-grotesk text-3xl font-bold text-white">{value}</div>
    {subValue && <div className="mt-1 text-sm font-medium text-pt-purple-200">{subValue}</div>}
  </div>
)
