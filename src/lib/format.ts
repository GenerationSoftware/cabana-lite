import { formatUnits, parseUnits } from 'viem'

export const shortenAddress = (address?: string) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''

export const formatTokenAmount = (
  amount?: bigint,
  decimals = 18,
  options: { compact?: boolean; symbol?: string } = {}
) => {
  if (amount === undefined) return '...'

  const value = Number(formatUnits(amount, decimals))
  const formatted = new Intl.NumberFormat('en-US', {
    notation: options.compact ? 'compact' : 'standard',
    maximumFractionDigits: value < 1 ? 4 : 2
  }).format(value)

  return options.symbol ? `${formatted} ${options.symbol}` : formatted
}

export const formatUsdcValue = (
  amount?: bigint,
  decimals = 18,
  price?: number,
  options: { compact?: boolean } = {}
) => {
  if (amount === undefined || price === undefined) return undefined

  const value = Number(formatUnits(amount, decimals)) * price
  const formatted = new Intl.NumberFormat('en-US', {
    notation: options.compact ? 'compact' : 'standard',
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 1 ? 4 : 2
  }).format(value)

  return formatted
}

export const parseTokenAmount = (value: string, decimals = 18) => {
  const normalized = value.trim()
  if (!normalized) return 0n
  return parseUnits(normalized, decimals)
}
