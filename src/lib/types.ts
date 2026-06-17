import type { Address } from 'viem'

export interface VaultListToken {
  chainId: number
  address: Address
  name: string
  decimals: number
  symbol: string
  logoURI?: string
  tags?: string[]
  extensions?: {
    underlyingAsset?: {
      address: Address
      symbol: string
      name: string
    }
    yieldSource?: {
      name: string
      appURI?: string
    }
    lp?: {
      address?: Address
      name?: string
      appURI?: string
      tokens?: {
        address: Address
        symbol: string
        name: string
      }[]
    }
    [key: string]: unknown
  }
}

export interface VaultList {
  name: string
  keywords: string[]
  version: { major: number; minor: number; patch: number }
  timestamp: string
  logoURI: string
  tokens: VaultListToken[]
}

export interface VaultReadData {
  asset?: Address
  prizePool?: Address
  prizeToken?: Address
  prizeTokenSymbol?: string
  prizeTokenDecimals?: number
  totalAssets?: bigint
  userShares?: bigint
  userAssets?: bigint
  walletAssetBalance?: bigint
  allowance?: bigint
  tierZeroPrize?: bigint
  tierPrizes?: bigint[]
}

export interface PrizePoolReadData {
  prizePool?: Address
  prizeToken?: Address
  prizeTokenSymbol?: string
  prizeTokenDecimals?: number
  tierPrizes: bigint[]
  tierDailyFrequencies: number[]
  drawPeriodSeconds?: number
}
