import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { encodeFunctionData, hexToBigInt, type Address } from 'viem'
import { useAccount } from 'wagmi'
import { erc20Abi, poolWideTwabRewardsAbi, twabRewardsAbi, vaultAbi } from './abis'
import {
  POOL_WIDE_TWAB_REWARDS_ADDRESSES,
  TWAB_REWARDS_ADDRESSES,
  TWAB_REWARDS_TOKEN_ADDRESSES
} from './constants'
import type { VaultListToken } from './types'
import { useWalletPublicClient } from './useVaultReads'

const READ_CACHE_TTL_MS = 45_000
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const MAX_REWARD_MULTICALLS_PER_BATCH = 80
const MAX_VAULTS_PER_REWARD_BATCH = 4
const MAX_REGULAR_PROMOTION_SEARCH_ID = 10_000n

export type AccountReward = {
  id: string
  type: 'regular' | 'poolWide'
  chainId: number
  promotionId: bigint
  vault: Address
  vaultName: string
  token: Address
  tokenSymbol: string
  tokenDecimals: number
  amount: bigint
  epochRewards: Record<number, bigint>
}

type PromotionInfo = {
  creator?: Address
  startTimestamp?: bigint
  numberOfEpochs?: number
  epochDuration?: number
  token?: Address
  vault?: Address
}

export type AccountRewardsProgress = {
  searchedVaults: number
  totalVaults: number
  isSearching: boolean
}

type AccountRewardsSnapshot = {
  rewards: AccountReward[]
  progress: AccountRewardsProgress
}

export type VaultTwabRewardToken = {
  address: Address
  symbol: string
  decimals: number
}

export const useAccountRewards = (chainId: number, vaults: VaultListToken[]) => {
  const { address: userAddress, chain } = useAccount()
  const publicClient = useWalletPublicClient(chainId)
  const isCurrentChain = chain?.id === chainId
  const vaultAddresses = vaults.map((vault) => vault.address.toLowerCase()).join(',')
  const searchKey = `${chainId}:${userAddress ?? ''}:${vaultAddresses}`
  const [snapshots, setSnapshots] = useState<Record<string, AccountRewardsSnapshot>>({})
  const snapshot = snapshots[searchKey] ?? {
    rewards: [],
    progress: { searchedVaults: 0, totalVaults: vaults.length, isSearching: false }
  }

  const setSnapshot = (rewards: AccountReward[], progress: AccountRewardsProgress) => {
    setSnapshots((currentSnapshots) => ({
      ...currentSnapshots,
      [searchKey]: { rewards, progress }
    }))
  }

  const query = useQuery({
    queryKey: ['accountRewards', chainId, vaultAddresses, userAddress],
    enabled: !!publicClient && !!userAddress && isCurrentChain && vaults.length > 0,
    staleTime: READ_CACHE_TTL_MS,
    gcTime: READ_CACHE_TTL_MS,
    retry: false,
    queryFn: async ({ signal }): Promise<AccountReward[]> => {
      if (!publicClient || !userAddress) throw new Error('Wallet is not connected.')

      setSnapshot([], { searchedVaults: 0, totalVaults: vaults.length, isSearching: true })

      const regularRewards = await readRegularRewards(
        publicClient,
        chainId,
        userAddress,
        vaults,
        signal
      )
      const poolWideRewards = await readPoolWideRewards(
        publicClient,
        chainId,
        userAddress,
        vaults,
        signal,
        ({ rewards, searchedVaults, totalVaults }) => {
          setSnapshot([...regularRewards, ...rewards].filter((reward) => reward.amount > 0n), {
            searchedVaults,
            totalVaults,
            isSearching: searchedVaults < totalVaults
          })
        }
      )
      const rewards = [...regularRewards, ...poolWideRewards].filter((reward) => reward.amount > 0n)
      setSnapshot(rewards, {
        searchedVaults: vaults.length,
        totalVaults: vaults.length,
        isSearching: false
      })
      return rewards
    }
  })

  return {
    ...query,
    data: query.data ?? snapshot.rewards,
    progress: snapshot.progress
  }
}

export const useVaultTwabRewardTokens = (chainId: number, vaults: VaultListToken[]) => {
  const { chain } = useAccount()
  const publicClient = useWalletPublicClient(chainId)
  const isCurrentChain = chain?.id === chainId
  const vaultAddresses = vaults.map((vault) => vault.address.toLowerCase()).join(',')

  return useQuery({
    queryKey: ['vaultTwabRewardTokens', chainId, vaultAddresses],
    enabled: !!publicClient && isCurrentChain && vaults.length > 0,
    staleTime: READ_CACHE_TTL_MS,
    gcTime: READ_CACHE_TTL_MS,
    retry: false,
    queryFn: async (): Promise<Record<string, VaultTwabRewardToken[]>> => {
      if (!publicClient) throw new Error('Wallet is not connected.')

      const promotions = await readRegularPromotionInfos(publicClient, chainId)
      const currentTimestamp = Math.floor(Date.now() / 1000)
      const vaultAddressSet = new Set(vaults.map((vault) => vault.address.toLowerCase()))
      const activePromotions = promotions.filter((promotion) => {
        if (!promotion.vault || !promotion.token) return false
        if (!vaultAddressSet.has(promotion.vault.toLowerCase())) return false
        if (!isRewardToken(chainId, promotion.token)) return false
        if (!promotion.startTimestamp || !promotion.numberOfEpochs || !promotion.epochDuration) {
          return false
        }

        const startsAt = Number(promotion.startTimestamp)
        const endsAt = startsAt + promotion.epochDuration * promotion.numberOfEpochs
        return startsAt <= currentTimestamp && currentTimestamp < endsAt
      })
      const tokens = await readRewardTokenMetadata(
        publicClient,
        activePromotions.flatMap((promotion) => (promotion.token ? [promotion.token] : []))
      )
      const rewardsByVault: Record<string, VaultTwabRewardToken[]> = {}

      activePromotions.forEach((promotion) => {
        if (!promotion.vault || !promotion.token) return

        const vaultKey = promotion.vault.toLowerCase()
        const tokenKey = promotion.token.toLowerCase()
        const existingTokens = rewardsByVault[vaultKey] ?? []

        if (existingTokens.some((token) => token.address.toLowerCase() === tokenKey)) return

        rewardsByVault[vaultKey] = [
          ...existingTokens,
          {
            address: promotion.token,
            symbol: tokens[tokenKey]?.symbol ?? 'TOKEN',
            decimals: tokens[tokenKey]?.decimals ?? 18
          }
        ]
      })

      return rewardsByVault
    }
  })
}

export const getClaimRewardRequest = (
  chainId: number,
  userAddress: Address,
  rewards: AccountReward[]
) => {
  const regularRewards = rewards.filter((reward) => reward.type === 'regular')
  const poolWideRewards = rewards.filter((reward) => reward.type === 'poolWide')
  const twabRewardsAddress = TWAB_REWARDS_ADDRESSES[chainId]
  const poolWideRewardsAddress = POOL_WIDE_TWAB_REWARDS_ADDRESSES[chainId]

  if (!rewards.length) return undefined

  if (regularRewards.length > 0 && poolWideRewards.length > 0) {
    if (!twabRewardsAddress || !poolWideRewardsAddress) return undefined

    return {
      address: poolWideRewardsAddress,
      abi: poolWideTwabRewardsAbi,
      functionName: 'multicall',
      args: [
        [
          ...regularRewards.map((reward) =>
            encodeFunctionData({
              abi: poolWideTwabRewardsAbi,
              functionName: 'claimTwabRewards',
              args: [twabRewardsAddress, userAddress, reward.promotionId, getRewardEpochs(reward)]
            })
          ),
          ...poolWideRewards.map((reward) =>
            encodeFunctionData({
              abi: poolWideTwabRewardsAbi,
              functionName: 'claimRewards',
              args: [reward.vault, userAddress, reward.promotionId, getRewardEpochs(reward)]
            })
          )
        ]
      ]
    } as const
  }

  if (regularRewards.length > 1) {
    if (!twabRewardsAddress) return undefined

    return {
      address: twabRewardsAddress,
      abi: twabRewardsAbi,
      functionName: 'multicall',
      args: [
        regularRewards.map((reward) =>
          encodeFunctionData({
            abi: twabRewardsAbi,
            functionName: 'claimRewards',
            args: [userAddress, reward.promotionId, getRewardEpochs(reward)]
          })
        )
      ]
    } as const
  }

  if (regularRewards.length === 1) {
    if (!twabRewardsAddress) return undefined

    return {
      address: twabRewardsAddress,
      abi: twabRewardsAbi,
      functionName: 'claimRewards',
      args: [userAddress, regularRewards[0].promotionId, getRewardEpochs(regularRewards[0])]
    } as const
  }

  if (poolWideRewards.length > 1) {
    if (!poolWideRewardsAddress) return undefined

    return {
      address: poolWideRewardsAddress,
      abi: poolWideTwabRewardsAbi,
      functionName: 'multicall',
      args: [
        poolWideRewards.map((reward) =>
          encodeFunctionData({
            abi: poolWideTwabRewardsAbi,
            functionName: 'claimRewards',
            args: [reward.vault, userAddress, reward.promotionId, getRewardEpochs(reward)]
          })
        )
      ]
    } as const
  }

  if (poolWideRewards.length === 1 && poolWideRewardsAddress) {
    return {
      address: poolWideRewardsAddress,
      abi: poolWideTwabRewardsAbi,
      functionName: 'claimRewards',
      args: [
        poolWideRewards[0].vault,
        userAddress,
        poolWideRewards[0].promotionId,
        getRewardEpochs(poolWideRewards[0])
      ]
    } as const
  }

  return undefined
}

const readPoolWideRewards = async (
  publicClient: ReturnType<typeof useWalletPublicClient>,
  chainId: number,
  userAddress: Address,
  vaults: VaultListToken[],
  signal: AbortSignal,
  onProgress: (progress: {
    rewards: AccountReward[]
    searchedVaults: number
    totalVaults: number
  }) => void
): Promise<AccountReward[]> => {
  const poolWideRewardsAddress = POOL_WIDE_TWAB_REWARDS_ADDRESSES[chainId]
  if (!publicClient || !poolWideRewardsAddress) return []

  const promotionIds = await readPoolWidePromotionIds(publicClient, poolWideRewardsAddress)
  if (!promotionIds.length) return []

  const promotionResults = await publicClient.multicall({
    allowFailure: true,
    contracts: promotionIds.map((promotionId) => ({
      address: poolWideRewardsAddress,
      abi: poolWideTwabRewardsAbi,
      functionName: 'getPromotion',
      args: [promotionId]
    }))
  })
  const promotions = promotionIds.map((promotionId, index) => {
    const result = getSuccessfulResult<PromotionInfo | readonly unknown[]>(promotionResults[index])

    return {
      id: promotionId,
      token: getPromotionField<Address>(result, 'token', 0),
      startTimestamp: getBigIntPromotionField(result, 'startTimestamp', 4),
      numberOfEpochs: getNumberPromotionField(result, 'numberOfEpochs', 3),
      epochDuration: getNumberPromotionField(result, 'epochDuration', 1)
    }
  })
  const claimablePromotions = promotions
    .map((promotion) => ({ ...promotion, epochs: getPromotionEpochs(promotion) }))
    .filter((promotion) => promotion.epochs.length > 0 && isRewardToken(chainId, promotion.token))

  if (!claimablePromotions.length) return []

  const tokens = await readRewardTokenMetadata(
    publicClient,
    claimablePromotions.flatMap((promotion) => (promotion.token ? [promotion.token] : []))
  )
  const orderedVaults = await readVaultsByCurrentBalance(publicClient, userAddress, vaults)
  const rewards: AccountReward[] = []
  const totalVaults = orderedVaults.length
  const batchSize = getRewardVaultBatchSize(claimablePromotions.length)

  onProgress({ rewards, searchedVaults: 0, totalVaults })

  for (let vaultIndex = 0; vaultIndex < orderedVaults.length; vaultIndex += batchSize) {
    if (signal.aborted) return rewards

    const vaultBatch = orderedVaults.slice(vaultIndex, vaultIndex + batchSize)
    const batchRewards = await readPoolWideVaultBatchRewards({
      publicClient,
      chainId,
      poolWideRewardsAddress,
      userAddress,
      vaults: vaultBatch,
      promotions: claimablePromotions,
      tokens
    })

    rewards.push(...batchRewards)
    onProgress({
      rewards: [...rewards],
      searchedVaults: Math.min(vaultIndex + vaultBatch.length, totalVaults),
      totalVaults
    })
  }

  return rewards
}

const readRegularRewards = async (
  publicClient: ReturnType<typeof useWalletPublicClient>,
  chainId: number,
  userAddress: Address,
  vaults: VaultListToken[],
  signal: AbortSignal
): Promise<AccountReward[]> => {
  const twabRewardsAddress = TWAB_REWARDS_ADDRESSES[chainId]
  if (!publicClient || !twabRewardsAddress) return []

  const vaultsByAddress = new Map(vaults.map((vault) => [vault.address.toLowerCase(), vault]))
  const claimablePromotions = (await readRegularPromotionInfos(publicClient, chainId))
    .map((promotion) => ({ ...promotion, epochs: getPromotionEpochs(promotion) }))
    .filter((promotion) => {
      if (!promotion.vault || !promotion.token || promotion.epochs.length === 0) return false
      if (!vaultsByAddress.has(promotion.vault.toLowerCase())) return false
      return isRewardToken(chainId, promotion.token)
    })

  if (!claimablePromotions.length || signal.aborted) return []

  const tokens = await readRewardTokenMetadata(
    publicClient,
    claimablePromotions.flatMap((promotion) => (promotion.token ? [promotion.token] : []))
  )
  const rewards: AccountReward[] = []

  for (let index = 0; index < claimablePromotions.length; index += MAX_REWARD_MULTICALLS_PER_BATCH) {
    if (signal.aborted) return rewards

    const promotionBatch = claimablePromotions.slice(index, index + MAX_REWARD_MULTICALLS_PER_BATCH)
    const results = await publicClient.multicall({
      allowFailure: true,
      contracts: promotionBatch.map((promotion) => ({
        address: twabRewardsAddress,
        abi: twabRewardsAbi,
        functionName: 'getRewardsAmount',
        args: [userAddress, promotion.id, promotion.epochs]
      }))
    })

    promotionBatch.forEach((promotion, promotionIndex) => {
      if (!promotion.vault || !promotion.token) return

      const rewardAmounts = getSuccessfulResult<bigint[]>(results[promotionIndex])
      const vault = vaultsByAddress.get(promotion.vault.toLowerCase())
      const epochRewards: Record<number, bigint> = {}

      if (!rewardAmounts || !vault) return

      promotion.epochs.forEach((epoch, rewardIndex) => {
        const amount = rewardAmounts[rewardIndex] ?? 0n
        if (amount > 0n) epochRewards[epoch] = amount
      })

      const amount = sumEpochRewards(epochRewards)
      if (amount === 0n) return

      rewards.push({
        id: `regular-${promotion.id.toString()}-${vault.address.toLowerCase()}`,
        type: 'regular',
        chainId,
        promotionId: promotion.id,
        vault: vault.address,
        vaultName: vault.name,
        token: promotion.token,
        tokenSymbol: tokens[promotion.token.toLowerCase()]?.symbol ?? 'TOKEN',
        tokenDecimals: tokens[promotion.token.toLowerCase()]?.decimals ?? 18,
        amount,
        epochRewards
      })
    })
  }

  return rewards
}

const readRegularPromotionInfos = async (
  publicClient: NonNullable<ReturnType<typeof useWalletPublicClient>>,
  chainId: number
) => {
  const twabRewardsAddress = TWAB_REWARDS_ADDRESSES[chainId]
  if (!twabRewardsAddress) return []

  const promotionIds = await readRegularPromotionIds(publicClient, twabRewardsAddress)
  if (!promotionIds.length) return []

  const promotions: Array<PromotionInfo & { id: bigint }> = []

  for (let index = 0; index < promotionIds.length; index += MAX_REWARD_MULTICALLS_PER_BATCH) {
    const promotionBatch = promotionIds.slice(index, index + MAX_REWARD_MULTICALLS_PER_BATCH)
    const promotionResults = await publicClient.multicall({
      allowFailure: true,
      contracts: promotionBatch.map((promotionId) => ({
        address: twabRewardsAddress,
        abi: twabRewardsAbi,
        functionName: 'getPromotion',
        args: [promotionId]
      }))
    })

    promotionBatch.forEach((promotionId, promotionIndex) => {
      const result = getSuccessfulResult<PromotionInfo | readonly unknown[]>(
        promotionResults[promotionIndex]
      )

      if (!result) return

      promotions.push({
        id: promotionId,
        creator: getPromotionField<Address>(result, 'creator', 0),
        startTimestamp: getBigIntPromotionField(result, 'startTimestamp', 1),
        numberOfEpochs: getNumberPromotionField(result, 'numberOfEpochs', 2),
        vault: getPromotionField<Address>(result, 'vault', 3),
        epochDuration: getNumberPromotionField(result, 'epochDuration', 4),
        token: getPromotionField<Address>(result, 'token', 6)
      })
    })
  }

  return promotions
}

const readVaultsByCurrentBalance = async (
  publicClient: NonNullable<ReturnType<typeof useWalletPublicClient>>,
  userAddress: Address,
  vaults: VaultListToken[]
) => {
  const balanceResults = await publicClient.multicall({
    allowFailure: true,
    contracts: vaults.map((vault) => ({
      address: vault.address,
      abi: vaultAbi,
      functionName: 'balanceOf',
      args: [userAddress]
    }))
  })

  return [...vaults].sort((a, b) => {
    const aIndex = vaults.indexOf(a)
    const bIndex = vaults.indexOf(b)
    const aBalance = getSuccessfulResult<bigint>(balanceResults[aIndex]) ?? 0n
    const bBalance = getSuccessfulResult<bigint>(balanceResults[bIndex]) ?? 0n

    if (aBalance > 0n && bBalance === 0n) return -1
    if (aBalance === 0n && bBalance > 0n) return 1
    return aIndex - bIndex
  })
}

const readPoolWideVaultBatchRewards = async ({
  publicClient,
  chainId,
  poolWideRewardsAddress,
  userAddress,
  vaults,
  promotions,
  tokens
}: {
  publicClient: NonNullable<ReturnType<typeof useWalletPublicClient>>
  chainId: number
  poolWideRewardsAddress: Address
  userAddress: Address
  vaults: VaultListToken[]
  promotions: Array<PromotionInfo & { id: bigint; epochs: number[] }>
  tokens: Record<string, { symbol: string; decimals: number }>
}) => {
  const calculateContracts = vaults.flatMap((vault) =>
    promotions.map((promotion) => ({
      address: poolWideRewardsAddress,
      abi: poolWideTwabRewardsAbi,
      functionName: 'calculateRewards',
      args: [vault.address, userAddress, promotion.id, promotion.epochs]
    }))
  )
  const claimedContracts = vaults.flatMap((vault) =>
    promotions.map((promotion) => ({
      address: poolWideRewardsAddress,
      abi: poolWideTwabRewardsAbi,
      functionName: 'claimedEpochs',
      args: [promotion.id, vault.address, userAddress]
    }))
  )
  const results = await publicClient.multicall({
    allowFailure: true,
    contracts: [...calculateContracts, ...claimedContracts]
  })
  const rewards: AccountReward[] = []
  const promotionCount = promotions.length

  vaults.forEach((vault, vaultIndex) => {
    promotions.forEach((promotion, promotionIndex) => {
      const resultIndex = vaultIndex * promotionCount + promotionIndex
      const rewardAmounts = getSuccessfulResult<bigint[]>(results[resultIndex])
      const claimMask = getSuccessfulResult<`0x${string}`>(
        results[resultIndex + calculateContracts.length]
      )
      const claimedEpochs = claimMask ? decodeClaimedEpochs(claimMask) : []
      const epochRewards: Record<number, bigint> = {}

      if (!rewardAmounts || !promotion.token) return

      promotion.epochs.forEach((epoch, rewardIndex) => {
        const amount = rewardAmounts[rewardIndex] ?? 0n
        if (amount > 0n && !claimedEpochs.includes(epoch)) epochRewards[epoch] = amount
      })

      const amount = sumEpochRewards(epochRewards)
      if (amount === 0n) return

      rewards.push({
        id: `poolWide-${promotion.id.toString()}-${vault.address.toLowerCase()}`,
        type: 'poolWide',
        chainId,
        promotionId: promotion.id,
        vault: vault.address,
        vaultName: vault.name,
        token: promotion.token,
        tokenSymbol: tokens[promotion.token.toLowerCase()]?.symbol ?? 'TOKEN',
        tokenDecimals: tokens[promotion.token.toLowerCase()]?.decimals ?? 18,
        amount,
        epochRewards
      })
    })
  })

  return rewards
}

const readRewardTokenMetadata = async (
  publicClient: NonNullable<ReturnType<typeof useWalletPublicClient>>,
  tokenAddresses: Address[]
) => {
  const addresses = Array.from(new Set(tokenAddresses.map((address) => address.toLowerCase())))
  const tokenResults =
    addresses.length > 0
      ? await publicClient.multicall({
          allowFailure: true,
          contracts: addresses.flatMap((address) => [
            { address: address as Address, abi: erc20Abi, functionName: 'symbol' },
            { address: address as Address, abi: erc20Abi, functionName: 'decimals' }
          ])
        })
      : []
  const tokens: Record<string, { symbol: string; decimals: number }> = {}

  addresses.forEach((address, index) => {
    tokens[address] = {
      symbol: getSuccessfulResult<string>(tokenResults[index * 2]) ?? 'TOKEN',
      decimals: getSuccessfulResult<number>(tokenResults[index * 2 + 1]) ?? 18
    }
  })

  return tokens
}

const getRewardVaultBatchSize = (promotionCount: number) => {
  if (promotionCount <= 0) return 1

  return Math.max(
    1,
    Math.min(
      MAX_VAULTS_PER_REWARD_BATCH,
      Math.floor(MAX_REWARD_MULTICALLS_PER_BATCH / (promotionCount * 2))
    )
  )
}

const readPoolWidePromotionIds = async (
  publicClient: NonNullable<ReturnType<typeof useWalletPublicClient>>,
  poolWideRewardsAddress: Address
) => {
  const latestPromotionId = await publicClient
    .readContract({
      address: poolWideRewardsAddress,
      abi: poolWideTwabRewardsAbi,
      functionName: 'latestPromotionId'
    })
    .catch(() => undefined)

  if (latestPromotionId === undefined) return []

  const latestPromotionIdNumber = Number(latestPromotionId)
  if (!Number.isSafeInteger(latestPromotionIdNumber) || latestPromotionIdNumber < 0) return []

  return Array.from({ length: latestPromotionIdNumber + 1 }, (_, promotionId) =>
    BigInt(promotionId)
  )
}

const readRegularPromotionIds = async (
  publicClient: NonNullable<ReturnType<typeof useWalletPublicClient>>,
  twabRewardsAddress: Address
) => {
  const isValidPromotionId = async (promotionId: bigint) => {
    try {
      await publicClient.readContract({
        address: twabRewardsAddress,
        abi: twabRewardsAbi,
        functionName: 'getPromotion',
        args: [promotionId]
      })
      return true
    } catch (error) {
      if (isInvalidPromotionError(error)) return false
      throw error
    }
  }

  if (!(await isValidPromotionId(1n))) return []

  let lowerBound = 1n
  let upperBound = 2n

  while (upperBound <= MAX_REGULAR_PROMOTION_SEARCH_ID && (await isValidPromotionId(upperBound))) {
    lowerBound = upperBound
    upperBound *= 2n
  }

  if (upperBound > MAX_REGULAR_PROMOTION_SEARCH_ID) upperBound = MAX_REGULAR_PROMOTION_SEARCH_ID + 1n

  while (lowerBound + 1n < upperBound) {
    const midpoint = (lowerBound + upperBound) / 2n

    if (await isValidPromotionId(midpoint)) {
      lowerBound = midpoint
    } else {
      upperBound = midpoint
    }
  }

  const latestPromotionId = Number(lowerBound)
  if (!Number.isSafeInteger(latestPromotionId) || latestPromotionId < 1) return []

  return Array.from({ length: latestPromotionId }, (_, index) => BigInt(index + 1))
}

const getRewardEpochs = (reward: AccountReward) => Object.keys(reward.epochRewards).map(Number)

const getPromotionEpochs = (info: {
  startTimestamp?: bigint
  numberOfEpochs?: number
  epochDuration?: number
}) => {
  const epochs: number[] = []
  const currentTimestamp = Math.floor(Date.now() / 1000)

  if (!info.startTimestamp || !info.numberOfEpochs || !info.epochDuration) return epochs

  for (let i = 0; i < info.numberOfEpochs; i++) {
    const epochEndsAt = Number(info.startTimestamp) + info.epochDuration * (i + 1)
    if (epochEndsAt > currentTimestamp) break
    epochs.push(i)
  }

  return epochs
}

const getPromotionField = <T>(
  result: PromotionInfo | readonly unknown[] | undefined,
  key: keyof PromotionInfo,
  index: number
): T | undefined => {
  if (!result) return undefined
  if (Array.isArray(result)) return result[index] as T
  if (!Array.isArray(result)) {
    return (result as Record<keyof PromotionInfo, unknown>)[key] as T | undefined
  }
  return undefined
}

const getBigIntPromotionField = (
  result: PromotionInfo | readonly unknown[] | undefined,
  key: keyof PromotionInfo,
  index: number
) => {
  const value = getPromotionField<bigint | number | string>(result, key, index)
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(value)
  if (typeof value === 'string' && value !== '') return BigInt(value)
  return undefined
}

const getNumberPromotionField = (
  result: PromotionInfo | readonly unknown[] | undefined,
  key: keyof PromotionInfo,
  index: number
) => {
  const value = getPromotionField<bigint | number | string>(result, key, index)
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string' && value !== '') return Number(value)
  return undefined
}

const isRewardToken = (chainId: number, token?: Address) => {
  if (!token || token.toLowerCase() === ZERO_ADDRESS) return false

  const tokenAddresses = TWAB_REWARDS_TOKEN_ADDRESSES[chainId]
  if (!tokenAddresses?.length) return true

  return tokenAddresses.some((tokenAddress) => tokenAddress.toLowerCase() === token.toLowerCase())
}

const decodeClaimedEpochs = (claimFlags: `0x${string}`) => {
  const epochIds: number[] = []
  const parsedValue = hexToBigInt(claimFlags)

  for (let epochId = 0n; epochId < 256n; ++epochId) {
    if (((parsedValue >> epochId) & 1n) === 1n) epochIds.push(Number(epochId))
  }

  return epochIds
}

const sumEpochRewards = (epochRewards: Record<number, bigint>) =>
  Object.values(epochRewards).reduce((total, amount) => total + amount, 0n)

const isInvalidPromotionError = (error: unknown) => {
  const message = getErrorMessage(error)
  return /InvalidPromotion|execution reverted|revert/i.test(message)
}

const getErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== 'object') return ''

  const parsedError = error as {
    shortMessage?: string
    message?: string
    details?: string
    cause?: unknown
  }

  return [
    parsedError.shortMessage,
    parsedError.message,
    parsedError.details,
    getErrorMessage(parsedError.cause)
  ]
    .filter(Boolean)
    .join(' ')
}

const getSuccessfulResult = <T>(result: unknown): T | undefined => {
  if (typeof result !== 'object' || !result || !('status' in result)) return undefined
  if (result.status !== 'success' || !('result' in result)) return undefined
  return result.result as T
}
