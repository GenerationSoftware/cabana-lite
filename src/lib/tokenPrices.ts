import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { formatUnits, isAddress } from 'viem'
import { ammFactoryAbi, ammPoolAbi, erc20Abi } from './abis'
import { NETWORK } from './constants'
import { useWalletPublicClient } from './useVaultReads'

const CACHE_TTL_MS = 60_000
const CACHE_KEY = 'cabana-lite:token-prices-usdc:v1'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

type TokenInput = {
  address?: Address
  decimals?: number
}

type PricedTokenInput = {
  address: Address
  decimals: number
}

type MulticallClient = {
  multicall: (parameters: {
    allowFailure: true
    contracts: readonly unknown[]
  }) => Promise<readonly unknown[]>
}

type LpTokenInfo = {
  token: PricedTokenInput
  underlying: [PricedTokenInput, PricedTokenInput]
  reserves: [bigint, bigint]
  totalSupply: bigint
}

type TokenPriceCache = {
  [chainId: string]: {
    [address: string]: {
      price: number
      updatedAt: number
    }
  }
}

type AmmConfig = {
  factories: Address[]
  usdc: Address
  wrappedNative?: Address
}

const AMM_CONFIGS: Record<number, AmmConfig | undefined> = {
  [NETWORK.optimism]: {
    factories: [
      '0xf1046053aa5682b4f9a81b5481394da16be5ff5a',
      '0x25cbddb98b35ab1ff77413456b31ec81a6b6b746',
      '0x548118c7e0b865c2cfa94d15ec86b666468ac758'
    ],
    usdc: '0x0b2c639c533813f4Aa9D7837CAf62653d097Ff85',
    wrappedNative: '0x4200000000000000000000000000000000000006'
  },
  [NETWORK.base]: {
    factories: [
      '0x420DD381b31aEf6683db6B902084cB0FFEce40Da',
      '0x5e7bb104d84c7CB9B682aac2F3d509f5F406809A'
    ],
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    wrappedNative: '0x4200000000000000000000000000000000000006'
  },
  [NETWORK.arbitrum]: {
    factories: ['0xaaa20d08e59f6561f242b08513d36266c5a29415'],
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    wrappedNative: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
  }
}

export const useTokenPricesInUsdc = (
  chainId: number | undefined,
  tokens: TokenInput[],
  options: { enabled?: boolean } = {}
) => {
  const publicClient = useWalletPublicClient(chainId)
  const tokenKey = tokens
    .map((token) => `${token.address?.toLowerCase() ?? ''}:${token.decimals ?? ''}`)
    .sort()
    .join(',')

  return useQuery({
    queryKey: ['tokenPricesInUsdc', chainId, tokenKey],
    enabled:
      options.enabled !== false &&
      !!chainId &&
      !!publicClient &&
      tokens.some((token) => !!token.address),
    staleTime: CACHE_TTL_MS,
    queryFn: async () => {
      if (!chainId || !publicClient) return {}
      return getTokenPricesInUsdc(publicClient, chainId, tokens)
    }
  })
}

export const getTokenPricesInUsdc = async (
  publicClient: MulticallClient,
  chainId: number,
  tokens: TokenInput[]
) => {
  const config = AMM_CONFIGS[chainId]
  const now = Date.now()
  const cache = readPriceCache()
  const chainCache = cache[String(chainId)] ?? {}
  const prices: Record<string, number> = {}
  const missingTokens: PricedTokenInput[] = []

  const uniqueTokens = getUniqueTokens(tokens)
  uniqueTokens.forEach((token) => {
    if (!token.address) return

    const address = token.address.toLowerCase()
    const cachedPrice = chainCache[address]

    if (cachedPrice && now - cachedPrice.updatedAt < CACHE_TTL_MS) {
      prices[address] = cachedPrice.price
    } else if (config && address === config.usdc.toLowerCase()) {
      prices[address] = 1
    } else if (token.decimals !== undefined) {
      missingTokens.push({ address: token.address, decimals: token.decimals })
    }
  })

  if (config && missingTokens.length > 0) {
    const freshPrices = await readAmmPrices(publicClient, config, missingTokens)
    Object.assign(prices, freshPrices)
  }

  const updatedChainCache = { ...chainCache }
  Object.entries(prices).forEach(([address, price]) => {
    if (Number.isFinite(price) && price > 0) {
      updatedChainCache[address] = { price, updatedAt: now }
    }
  })

  writePriceCache({ ...cache, [String(chainId)]: updatedChainCache })

  return prices
}

const readAmmPrices = async (
  publicClient: MulticallClient,
  config: AmmConfig,
  tokens: PricedTokenInput[],
  depth = 0
) => {
  const routePairs = getRoutePairs(config, tokens)
  const poolResults = await publicClient.multicall({
    allowFailure: true,
    contracts: routePairs.flatMap((pair) =>
      config.factories.flatMap((factory) => [
        {
          address: factory,
          abi: ammFactoryAbi,
          functionName: 'getPool',
          args: [pair.base.address, pair.quote.address, false]
        },
        {
          address: factory,
          abi: ammFactoryAbi,
          functionName: 'getPool',
          args: [pair.base.address, pair.quote.address, true]
        }
      ])
    )
  })

  const pools = new Map<string, (typeof routePairs)[number] & { pool: Address }>()
  routePairs.forEach((pair, index) => {
    const offset = index * config.factories.length * 2
    const pool = config.factories
      .flatMap((_, factoryIndex) => [
        getMulticallResult<Address>(poolResults[offset + factoryIndex * 2]),
        getMulticallResult<Address>(poolResults[offset + factoryIndex * 2 + 1])
      ])
      .find((address) => !!address && address !== ZERO_ADDRESS)

    if (pool) {
      pools.set(pair.key, { ...pair, pool })
    }
  })

  if (pools.size === 0) return {}

  const reserveResults = await publicClient.multicall({
    allowFailure: true,
    contracts: [...pools.values()].flatMap((pair) => [
      { address: pair.pool, abi: ammPoolAbi, functionName: 'token0' },
      { address: pair.pool, abi: ammPoolAbi, functionName: 'token1' },
      { address: pair.pool, abi: ammPoolAbi, functionName: 'getReserves' }
    ])
  })

  const pairPrices = new Map<string, number>()
  ;[...pools.values()].forEach((pair, index) => {
    const offset = index * 3
    const token0 = getMulticallResult<Address>(reserveResults[offset])
    const token1 = getMulticallResult<Address>(reserveResults[offset + 1])
    const reserves = getMulticallResult<readonly [bigint, bigint, bigint]>(
      reserveResults[offset + 2]
    )

    if (!token0 || !token1 || !reserves) return

    const price = getPairPrice(pair.base, pair.quote, token0, token1, reserves)
    if (price !== undefined) {
      pairPrices.set(pair.key, price)
    }
  })

  const prices = tokens.reduce<Record<string, number>>((acc, token) => {
    const tokenAddress = token.address.toLowerCase()
    const directPrice = pairPrices.get(getPairKey(token.address, config.usdc))
    const nativePairPrice =
      config.wrappedNative &&
      pairPrices.get(getPairKey(token.address, config.wrappedNative)) &&
      pairPrices.get(getPairKey(config.wrappedNative, config.usdc))

    if (directPrice) {
      acc[tokenAddress] = directPrice
    } else if (nativePairPrice && config.wrappedNative) {
      const tokenInNative = pairPrices.get(getPairKey(token.address, config.wrappedNative))
      const nativeInUsdc = pairPrices.get(getPairKey(config.wrappedNative, config.usdc))
      if (tokenInNative && nativeInUsdc) {
        acc[tokenAddress] = tokenInNative * nativeInUsdc
      }
    }

    return acc
  }, {})

  if (depth >= 2) return prices

  const missingLpCandidates = tokens.filter((token) => prices[token.address.toLowerCase()] === undefined)
  if (missingLpCandidates.length === 0) return prices

  const lpTokenInfo = await readLpTokenInfo(publicClient, missingLpCandidates)
  if (lpTokenInfo.length === 0) return prices

  const underlyingTokenPrices = await readAmmPrices(
    publicClient,
    config,
    lpTokenInfo.flatMap((info) => info.underlying),
    depth + 1
  )

  lpTokenInfo.forEach((info) => {
    const token0Price = underlyingTokenPrices[info.underlying[0].address.toLowerCase()]
    const token1Price = underlyingTokenPrices[info.underlying[1].address.toLowerCase()]

    if (!token0Price || !token1Price) return

    const token0Value =
      Number(formatUnits(info.reserves[0], info.underlying[0].decimals)) * token0Price
    const token1Value =
      Number(formatUnits(info.reserves[1], info.underlying[1].decimals)) * token1Price
    const supply = Number(formatUnits(info.totalSupply, info.token.decimals))

    if (supply > 0) {
      prices[info.token.address.toLowerCase()] = (token0Value + token1Value) / supply
    }
  })

  return prices
}

const readLpTokenInfo = async (publicClient: MulticallClient, tokens: PricedTokenInput[]) => {
  const results = await publicClient.multicall({
    allowFailure: true,
    contracts: tokens.flatMap((token) => [
      { address: token.address, abi: ammPoolAbi, functionName: 'token0' },
      { address: token.address, abi: ammPoolAbi, functionName: 'token1' },
      { address: token.address, abi: ammPoolAbi, functionName: 'getReserves' },
      { address: token.address, abi: ammPoolAbi, functionName: 'totalSupply' }
    ])
  })

  const rawLpInfo = tokens.reduce<
    {
      token: PricedTokenInput
      underlying: [Address, Address]
      reserves: [bigint, bigint]
      totalSupply: bigint
    }[]
  >((acc, token, index) => {
    const offset = index * 4
    const token0 = getMulticallResult<Address>(results[offset])
    const token1 = getMulticallResult<Address>(results[offset + 1])
    const reserves = getMulticallResult<readonly [bigint, bigint, bigint]>(results[offset + 2])
    const totalSupply = getMulticallResult<bigint>(results[offset + 3])

    if (!token0 || !token1 || !reserves || !totalSupply) return acc

    acc.push({
      token,
      underlying: [token0, token1],
      reserves: [reserves[0], reserves[1]],
      totalSupply
    })

    return acc
  }, [])

  if (rawLpInfo.length === 0) return []

  const underlyingAddresses = [
    ...new Set(rawLpInfo.flatMap((info) => info.underlying.map((address) => address.toLowerCase())))
  ] as Address[]
  const decimalsResults = await publicClient.multicall({
    allowFailure: true,
    contracts: underlyingAddresses.map((address) => ({
      address,
      abi: erc20Abi,
      functionName: 'decimals'
    }))
  })
  const decimalsByAddress = underlyingAddresses.reduce<Record<string, number>>(
    (acc, address, index) => {
      const decimals = getMulticallResult<number>(decimalsResults[index])
      if (decimals !== undefined) {
        acc[address.toLowerCase()] = decimals
      }
      return acc
    },
    {}
  )

  return rawLpInfo.reduce<LpTokenInfo[]>((acc, info) => {
    const token0Decimals = decimalsByAddress[info.underlying[0].toLowerCase()]
    const token1Decimals = decimalsByAddress[info.underlying[1].toLowerCase()]

    if (token0Decimals === undefined || token1Decimals === undefined) return acc

    acc.push({
      ...info,
      underlying: [
        { address: info.underlying[0], decimals: token0Decimals },
        { address: info.underlying[1], decimals: token1Decimals }
      ]
    })

    return acc
  }, [])
}

const getRoutePairs = (config: AmmConfig, tokens: PricedTokenInput[]) => {
  const usdc = { address: config.usdc, decimals: 6 }
  const wrappedNative = config.wrappedNative
    ? { address: config.wrappedNative, decimals: 18 }
    : undefined
  const pairs = new Map<
    string,
    {
      key: string
      base: PricedTokenInput
      quote: PricedTokenInput
    }
  >()

  tokens.forEach((token) => {
    addPair(pairs, token, usdc)

    if (wrappedNative && token.address.toLowerCase() !== wrappedNative.address.toLowerCase()) {
      addPair(pairs, token, wrappedNative)
      addPair(pairs, wrappedNative, usdc)
    }
  })

  return [...pairs.values()]
}

const addPair = (
  pairs: Map<string, { key: string; base: PricedTokenInput; quote: PricedTokenInput }>,
  base: PricedTokenInput,
  quote: PricedTokenInput
) => {
  if (base.address.toLowerCase() === quote.address.toLowerCase()) return

  const key = getPairKey(base.address, quote.address)
  if (!pairs.has(key)) {
    pairs.set(key, { key, base, quote })
  }
}

const getPairPrice = (
  base: PricedTokenInput,
  quote: PricedTokenInput,
  token0: Address,
  token1: Address,
  reserves: readonly [bigint, bigint, bigint]
) => {
  const baseAddress = base.address.toLowerCase()
  const quoteAddress = quote.address.toLowerCase()
  const token0Address = token0.toLowerCase()
  const token1Address = token1.toLowerCase()

  if (token0Address !== baseAddress && token1Address !== baseAddress) return undefined
  if (token0Address !== quoteAddress && token1Address !== quoteAddress) return undefined

  const baseReserve =
    token0Address === baseAddress
      ? Number(formatUnits(reserves[0], base.decimals))
      : Number(formatUnits(reserves[1], base.decimals))
  const quoteReserve =
    token0Address === quoteAddress
      ? Number(formatUnits(reserves[0], quote.decimals))
      : Number(formatUnits(reserves[1], quote.decimals))

  if (!baseReserve || !quoteReserve) return undefined

  return quoteReserve / baseReserve
}

const getPairKey = (a: Address, b: Address) => [a.toLowerCase(), b.toLowerCase()].sort().join(':')

const getUniqueTokens = (tokens: TokenInput[]) => {
  const unique = new Map<string, TokenInput>()

  tokens.forEach((token) => {
    if (!token.address || !isAddress(token.address)) return

    const address = token.address.toLowerCase()
    if (!unique.has(address) || unique.get(address)?.decimals === undefined) {
      unique.set(address, token)
    }
  })

  return [...unique.values()]
}

const getMulticallResult = <T>(result: unknown): T | undefined => {
  if (typeof result !== 'object' || !result || !('status' in result)) return undefined
  if (result.status !== 'success' || !('result' in result)) return undefined
  return result.result as T
}

const readPriceCache = (): TokenPriceCache => {
  if (typeof window === 'undefined') return {}

  try {
    const rawCache = window.localStorage.getItem(CACHE_KEY)
    return rawCache ? (JSON.parse(rawCache) as TokenPriceCache) : {}
  } catch {
    return {}
  }
}

const writePriceCache = (cache: TokenPriceCache) => {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore quota/private-mode failures; pricing can still work without a persistent cache.
  }
}
