import { formatUnits } from 'viem'
import { ChainIcon } from './ChainIcon'
import type { PrizePoolReadData } from '../lib/types'

interface PrizeListProps {
  chainId: number
  data?: PrizePoolReadData
  prizeTokenPrice?: number
  isLoading: boolean
  isError: boolean
  isSwitchingChain?: boolean
}

export const PrizeList = ({
  chainId,
  data,
  prizeTokenPrice,
  isLoading,
  isError,
  isSwitchingChain = false
}: PrizeListProps) => {
  const displayPrizes = (data?.tierPrizes.slice(0, -2) ?? []).map((amount, tier) => ({
    amount,
    frequency: formatPrizeFrequency(data?.tierDailyFrequencies[tier] ?? 0, data?.drawPeriodSeconds),
    tier
  }))

  return (
    <article className="w-full max-w-3xl rounded-2xl bg-[#2D0C66] px-5 py-7 shadow-[0_20px_80px_rgba(20,4,48,0.18)] sm:px-8">
      <div className="mb-7 flex items-center justify-center gap-3">
        <ChainIcon chainId={chainId} className="h-8 w-8 rounded-full" />
        <h3 className="font-grotesk text-2xl font-bold text-white">Prizes</h3>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(9rem,1fr)] border-b border-pt-purple-200/20 px-2 pb-3 text-sm font-medium text-pt-purple-200">
        <div>Prize</div>
        <div className="text-right">Frequency</div>
      </div>

      <div className="flex min-h-60 flex-col">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-14">
            <LoadingIndicator />
          </div>
        ) : isError ? (
          <div className="py-14 text-center text-pt-warning-light">
            Prize reads failed for this chain.
          </div>
        ) : displayPrizes.length > 0 ? (
          displayPrizes.map(({ amount, frequency, tier }) => {
            const usdcValue = formatPrizeUsdcValue(
              amount,
              data?.prizeTokenDecimals,
              prizeTokenPrice
            )
            const tokenValue = formatPrizeTokenAmount(
              amount,
              data?.prizeTokenDecimals,
              data?.prizeTokenSymbol
            )

            return (
              <div
                key={`${chainId}-${tier}`}
                className="grid grid-cols-[minmax(0,1fr)_minmax(9rem,1fr)] items-center gap-4 px-2 py-3"
              >
                <div className="min-w-0">
                  <div className="font-grotesk text-3xl font-bold leading-none text-pt-teal">
                    {usdcValue ?? tokenValue}
                  </div>
                  {usdcValue && (
                    <div className="mt-1 text-sm font-medium text-pt-purple-200">
                      {tokenValue}
                    </div>
                  )}
                </div>
                <div className="text-right font-grotesk text-lg font-semibold text-white">
                  {frequency}
                </div>
              </div>
            )
          })
        ) : (
          <div className="py-14 text-center text-pt-purple-200">
            {isSwitchingChain ? 'Switching chain...' : 'Switch chain to load prizes.'}
          </div>
        )}
      </div>
    </article>
  )
}

const LoadingIndicator = () => (
  <span className="flex items-center gap-1.5" aria-label="Loading">
    <span className="h-2 w-2 animate-pulse rounded-full bg-pt-teal" />
    <span className="h-2 w-2 animate-pulse rounded-full bg-pt-purple-200 [animation-delay:120ms]" />
    <span className="h-2 w-2 animate-pulse rounded-full bg-pt-purple-200 [animation-delay:240ms]" />
  </span>
)

const SECONDS_PER_DAY = 86_400
const SECONDS_PER_WEEK = SECONDS_PER_DAY * 7
const SECONDS_PER_MONTH = SECONDS_PER_DAY * (365 / 12)

type PrizeFrequencyUnit = 'day' | 'week' | 'month' | 'year'

const formatPrizeFrequency = (dailyCount: number, drawPeriodSeconds?: number) => {
  if (dailyCount <= 0) return '-'

  const days = 1 / dailyCount
  const weeks = days / 7
  const months = days / (365 / 12)
  const years = days / 365
  let frequency = days
  let unit: PrizeFrequencyUnit = 'day'

  if (weeks < 1.5 && (!drawPeriodSeconds || drawPeriodSeconds <= SECONDS_PER_DAY)) {
    frequency = days
  } else if (months < 1.5 && (!drawPeriodSeconds || drawPeriodSeconds <= SECONDS_PER_WEEK)) {
    frequency = weeks
    unit = 'week'
  } else if (years < 1.5 && (!drawPeriodSeconds || drawPeriodSeconds <= SECONDS_PER_MONTH)) {
    frequency = months
    unit = 'month'
  } else {
    frequency = years
    unit = 'year'
  }

  return getPrizeFrequencyText(frequency, unit)
}

const getPrizeFrequencyText = (frequency: number, unit: PrizeFrequencyUnit) => {
  const roundedFrequency = Math.round(frequency)
  const prizesPerTimespan = Math.round(1 / frequency)
  const formattedMultiplier = `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0
  }).format(prizesPerTimespan)}x`
  const labels: Record<PrizeFrequencyUnit, { single: string; plural: string }> = {
    day: { single: 'Daily', plural: 'days' },
    week: { single: 'Weekly', plural: 'weeks' },
    month: { single: 'Monthly', plural: 'months' },
    year: { single: 'Yearly', plural: 'years' }
  }
  const label = labels[unit]

  if (frequency < 1.5) {
    return prizesPerTimespan > 1 ? `${formattedMultiplier} ${label.single}` : label.single
  }

  return `Every ${roundedFrequency} ${label.plural}`
}

const formatPrizeUsdcValue = (amount?: bigint, decimals = 18, price?: number) => {
  if (amount === undefined || price === undefined) return undefined

  const value = Number(formatUnits(amount, decimals)) * price
  if (value > 0 && value < 0.000001) return '<$0.000001'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 6
  }).format(value)
}

const formatPrizeTokenAmount = (amount?: bigint, decimals = 18, symbol?: string) => {
  if (amount === undefined) return '...'

  const value = Number(formatUnits(amount, decimals))
  const formatted =
    value > 0 && value < 0.000001
      ? '<0.000001'
      : new Intl.NumberFormat('en-US', {
          maximumFractionDigits: 6
        }).format(value)

  return symbol ? `${formatted} ${symbol}` : formatted
}
