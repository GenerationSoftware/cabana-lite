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

      // Vault-specific rewards do not expose an enumerable promotion id range on-chain.
      // Pool-wide rewards do, so this contract-only page can discover those without logs.
      const poolWideRewards = await readPoolWideRewards(
        publicClient,
        chainId,
        userAddress,
        vaults,
        signal,
        ({ rewards, searchedVaults, totalVaults }) => {
          setSnapshot(rewards, {
            searchedVaults,
            totalVaults,
            isSearching: searchedVaults < totalVaults
          })
        }
      )
      const rewards = poolWideRewards.filter((reward) => reward.amount > 0n)
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

const getSuccessfulResult = <T>(result: unknown): T | undefined => {
  if (typeof result !== 'object' || !result || !('status' in result)) return undefined
  if (result.status !== 'success' || !('result' in result)) return undefined
  return result.result as T
}
