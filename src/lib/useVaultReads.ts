import { useQuery } from '@tanstack/react-query'
import { decodeFunctionResult, encodeFunctionData, publicActions, type Address } from 'viem'
import { useAccount, useChainId, useConnectorClient } from 'wagmi'
import { erc20Abi, prizePoolAbi, vaultAbi } from './abis'
import { PRIZE_POOL_BY_CHAIN, SUPPORTED_CHAINS } from './constants'
import type { PrizePoolReadData, VaultListToken, VaultReadData } from './types'

const READ_CACHE_TTL_MS = 60_000

export const useWalletPublicClient = (chainId?: number) => {
  const { status } = useAccount()
  const currentChainId = useChainId()
  const { data: walletClient } = useConnectorClient({
    chainId,
    query: {
      enabled: !!chainId && (status === 'connected' || status === 'reconnecting')
    }
  })
  const supportedChain = SUPPORTED_CHAINS.find((supportedChain) => supportedChain.id === chainId)

  if (
    (status !== 'connected' && status !== 'reconnecting') ||
    !walletClient ||
    !supportedChain ||
    currentChainId !== chainId ||
    walletClient.chain?.id !== chainId
  ) {
    return undefined
  }

  return walletClient.extend(publicActions)
}

export const useVaultReads = (vault: VaultListToken) => {
  const { address: userAddress, chain } = useAccount()
  const publicClient = useWalletPublicClient(vault.chainId)
  const isCurrentChain = chain?.id === vault.chainId

  return useQuery({
    queryKey: ['vault', vault.chainId, vault.address, userAddress],
    enabled: !!publicClient && !!userAddress && isCurrentChain,
    staleTime: READ_CACHE_TTL_MS,
    gcTime: READ_CACHE_TTL_MS,
    queryFn: async (): Promise<VaultReadData> => {
      if (!publicClient || !userAddress) throw new Error('Wallet is not connected.')

      const prizePoolConfig = PRIZE_POOL_BY_CHAIN[vault.chainId]
      const asset =
        vault.extensions?.underlyingAsset?.address ??
        getSuccessfulResult<Address>(
          (
            await publicClient.multicall({
              allowFailure: true,
              contracts: [
                {
                  address: vault.address,
                  abi: vaultAbi,
                  functionName: 'asset'
                }
              ]
            })
          )[0]
        )
      const prizePool =
        prizePoolConfig?.address ??
        getSuccessfulResult<Address>(
          (
            await publicClient.multicall({
              allowFailure: true,
              contracts: [
                {
                  address: vault.address,
                  abi: vaultAbi,
                  functionName: 'prizePool'
                }
              ]
            })
          )[0]
        )
      const prizeToken =
        prizePoolConfig?.prizeTokenAddress ??
        (prizePool
          ? getSuccessfulResult<Address>(
              (
                await publicClient.multicall({
                  allowFailure: true,
                  contracts: [
                    {
                      address: prizePool,
                      abi: prizePoolAbi,
                      functionName: 'prizeToken'
                    }
                  ]
                })
              )[0]
            )
          : undefined)

      if (!asset || !prizePool || !prizeToken) {
        throw new Error('Vault metadata is not available.')
      }

      const readResults = await publicClient.multicall({
        allowFailure: true,
        contracts: [
          {
            address: vault.address,
            abi: vaultAbi,
            functionName: 'totalAssets'
          },
          {
            address: vault.address,
            abi: vaultAbi,
            functionName: 'balanceOf',
            args: [userAddress]
          },
          {
            address: vault.address,
            abi: vaultAbi,
            functionName: 'maxWithdraw',
            args: [userAddress]
          },
          {
            address: asset,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [userAddress]
          },
          {
            address: asset,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [userAddress, vault.address]
          },
          {
            address: prizeToken,
            abi: erc20Abi,
            functionName: 'symbol'
          },
          {
            address: prizeToken,
            abi: erc20Abi,
            functionName: 'decimals'
          },
          {
            address: prizePool,
            abi: prizePoolAbi,
            functionName: 'numberOfTiers'
          },
          {
            address: prizePool,
            abi: prizePoolAbi,
            functionName: 'isShutdown'
          }
        ]
      })

      const totalAssets = getSuccessfulResult<bigint>(readResults[0])
      const userShares = getSuccessfulResult<bigint>(readResults[1])
      const userAssets = getSuccessfulResult<bigint>(readResults[2])
      const walletAssetBalance = getSuccessfulResult<bigint>(readResults[3])
      const allowance = getSuccessfulResult<bigint>(readResults[4])
      const prizeTokenSymbol = getSuccessfulResult<string>(readResults[5])
      const prizeTokenDecimals = getSuccessfulResult<number>(readResults[6])
      const numberOfTiers = getSuccessfulResult<number>(readResults[7]) ?? 0
      const isPrizePoolShutdown = getSuccessfulResult<boolean>(readResults[8]) ?? false
      const tierContracts = Array.from({ length: Number(numberOfTiers) }, (_, tier) => ({
        address: prizePool,
        abi: prizePoolAbi,
        functionName: 'getTierPrizeSize',
        args: [tier]
      }))
      const tierResults =
        tierContracts.length > 0
          ? await publicClient.multicall({
              allowFailure: true,
              contracts: tierContracts
            })
          : []
      const tierPrizes = tierResults.map((result) => getSuccessfulResult<bigint>(result) ?? 0n)
      const shutdownMetadata = isPrizePoolShutdown
        ? await publicClient.multicall({
            allowFailure: true,
            contracts: [
              {
                address: prizePool,
                abi: prizePoolAbi,
                functionName: 'shutdownAt'
              },
              {
                address: prizePool,
                abi: prizePoolAbi,
                functionName: 'drawTimeoutAt'
              }
            ]
          })
        : []
      const shutdownBalance = isPrizePoolShutdown
        ? await readShutdownBalance(publicClient, prizePool, vault.address, userAddress)
        : undefined

      return {
        asset,
        prizePool,
        prizeToken,
        prizeTokenSymbol,
        prizeTokenDecimals,
        totalAssets,
        userShares,
        userAssets,
        walletAssetBalance,
        allowance,
        tierZeroPrize: tierPrizes[0],
        tierPrizes,
        isPrizePoolShutdown,
        shutdownAt: getSuccessfulResult<bigint>(shutdownMetadata[0]),
        drawTimeoutAt: getSuccessfulResult<bigint>(shutdownMetadata[1]),
        shutdownBalance
      }
    }
  })
}

export const getVaultReadId = (vault: VaultListToken) =>
  `${vault.chainId}-${vault.address.toLowerCase()}`

export const useVaultListReads = (vaults: VaultListToken[]) => {
  const { address: userAddress, chain } = useAccount()
  const chainId = vaults[0]?.chainId
  const publicClient = useWalletPublicClient(chainId)
  const isCurrentChain = !!chainId && chain?.id === chainId
  const vaultAddresses = vaults.map((vault) => vault.address.toLowerCase()).join(',')

  return useQuery({
    queryKey: ['vaultList', chainId, vaultAddresses, userAddress],
    enabled: !!publicClient && !!userAddress && isCurrentChain && vaults.length > 0,
    staleTime: READ_CACHE_TTL_MS,
    gcTime: READ_CACHE_TTL_MS,
    queryFn: async (): Promise<Record<string, VaultReadData>> => {
      if (!publicClient || !userAddress) throw new Error('Wallet is not connected.')

      const prizePool = chainId ? PRIZE_POOL_BY_CHAIN[chainId] : undefined
      const vaultCallCount = vaults.length * 2
      const contracts: MulticallCall[] = vaults.flatMap((vault) => [
        {
          address: vault.address,
          abi: vaultAbi,
          functionName: 'totalAssets'
        },
        {
          address: vault.address,
          abi: vaultAbi,
          functionName: 'maxWithdraw',
          args: [userAddress]
        }
      ])

      if (prizePool) {
        contracts.push(
          {
            address: prizePool.address,
            abi: prizePoolAbi,
            functionName: 'isShutdown'
          },
          {
            address: prizePool.address,
            abi: prizePoolAbi,
            functionName: 'getTierPrizeSize',
            args: [0]
          },
          {
            address: prizePool.prizeTokenAddress,
            abi: erc20Abi,
            functionName: 'symbol'
          },
          {
            address: prizePool.prizeTokenAddress,
            abi: erc20Abi,
            functionName: 'decimals'
          }
        )
      }

      const results = await publicClient.multicall({
        allowFailure: true,
        contracts
      })

      const isPrizePoolShutdown = prizePool
        ? (getSuccessfulResult<boolean>(results[vaultCallCount]) ?? false)
        : false
      const tierZeroPrize = prizePool
        ? getSuccessfulResult<bigint>(results[vaultCallCount + 1])
        : undefined
      const prizeTokenSymbol = prizePool
        ? getSuccessfulResult<string>(results[vaultCallCount + 2])
        : undefined
      const prizeTokenDecimals = prizePool
        ? getSuccessfulResult<number>(results[vaultCallCount + 3])
        : undefined
      const shutdownMetadata =
        prizePool && isPrizePoolShutdown
          ? await publicClient.multicall({
              allowFailure: true,
              contracts: [
                {
                  address: prizePool.address,
                  abi: prizePoolAbi,
                  functionName: 'shutdownAt'
                },
                {
                  address: prizePool.address,
                  abi: prizePoolAbi,
                  functionName: 'drawTimeoutAt'
                }
              ]
            })
          : []
      const shutdownResults =
        prizePool && isPrizePoolShutdown
          ? await Promise.all(
              vaults.map((vault) =>
                readShutdownBalance(publicClient, prizePool.address, vault.address, userAddress)
              )
            )
          : []
      const shutdownAt = getSuccessfulResult<bigint>(shutdownMetadata[0])
      const drawTimeoutAt = getSuccessfulResult<bigint>(shutdownMetadata[1])
      const dataById: Record<string, VaultReadData> = {}

      vaults.forEach((vault, index) => {
        const offset = index * 2
        const totalAssets = getSuccessfulResult<bigint>(results[offset])
        const userAssets = getSuccessfulResult<bigint>(results[offset + 1])

        dataById[getVaultReadId(vault)] = {
          asset: vault.extensions?.underlyingAsset?.address,
          prizePool: prizePool?.address,
          prizeToken: prizePool?.prizeTokenAddress,
          prizeTokenSymbol,
          prizeTokenDecimals,
          totalAssets,
          userAssets,
          tierZeroPrize,
          isPrizePoolShutdown,
          shutdownAt,
          drawTimeoutAt,
          shutdownBalance: shutdownResults[index]
        }
      })

      return dataById
    }
  })
}

export const usePrizePoolReads = (chainId: number) => {
  const { address: userAddress, chain } = useAccount()
  const publicClient = useWalletPublicClient(chainId)
  const isCurrentChain = chain?.id === chainId
  const prizePool = PRIZE_POOL_BY_CHAIN[chainId]

  return useQuery({
    queryKey: ['prizePool', chainId, userAddress],
    enabled: !!publicClient && !!userAddress && isCurrentChain && !!prizePool,
    staleTime: READ_CACHE_TTL_MS,
    gcTime: READ_CACHE_TTL_MS,
    queryFn: async (): Promise<PrizePoolReadData> => {
      if (!publicClient || !prizePool) throw new Error('Prize pool is not available.')

      const readResults = await publicClient.multicall({
        allowFailure: true,
        contracts: [
          {
            address: prizePool.prizeTokenAddress,
            abi: erc20Abi,
            functionName: 'symbol'
          },
          {
            address: prizePool.prizeTokenAddress,
            abi: erc20Abi,
            functionName: 'decimals'
          },
          {
            address: prizePool.address,
            abi: prizePoolAbi,
            functionName: 'numberOfTiers'
          },
          {
            address: prizePool.address,
            abi: prizePoolAbi,
            functionName: 'drawPeriodSeconds'
          },
          {
            address: prizePool.address,
            abi: prizePoolAbi,
            functionName: 'isShutdown'
          }
        ]
      })
      const prizeTokenSymbol = getSuccessfulResult<string>(readResults[0])
      const prizeTokenDecimals = getSuccessfulResult<number>(readResults[1])
      const numberOfTiers = getSuccessfulResult<number>(readResults[2]) ?? 0
      const drawPeriodSeconds = getSuccessfulResult<number>(readResults[3])
      const isShutdown = getSuccessfulResult<boolean>(readResults[4]) ?? false
      const tierContracts = Array.from({ length: Number(numberOfTiers) }, (_, tier) => [
        {
          address: prizePool.address,
          abi: prizePoolAbi,
          functionName: 'getTierPrizeSize',
          args: [tier]
        },
        {
          address: prizePool.address,
          abi: prizePoolAbi,
          functionName: 'getTierAccrualDurationInDraws',
          args: [tier]
        }
      ]).flat()
      const tierResults =
        tierContracts.length > 0
          ? await publicClient.multicall({
              allowFailure: true,
              contracts: tierContracts
            })
          : []
      const tierPrizes = Array.from({ length: Number(numberOfTiers) }, (_, tier) => {
        return getSuccessfulResult<bigint>(tierResults[tier * 2]) ?? 0n
      })
      const tierAccrualDurations = Array.from({ length: Number(numberOfTiers) }, (_, tier) => {
        return getSuccessfulResult<number>(tierResults[tier * 2 + 1]) ?? 0
      })
      const drawPeriod = Number(drawPeriodSeconds)
      const tierDailyFrequencies = tierAccrualDurations.map((duration, tier) => {
        const accrualDays = (Number(duration) * drawPeriod) / 86_400
        return accrualDays > 0 ? 4 ** tier / accrualDays : 0
      })
      const shutdownMetadata = isShutdown
        ? await publicClient.multicall({
            allowFailure: true,
            contracts: [
              {
                address: prizePool.address,
                abi: prizePoolAbi,
                functionName: 'shutdownAt'
              },
              {
                address: prizePool.address,
                abi: prizePoolAbi,
                functionName: 'drawTimeoutAt'
              }
            ]
          })
        : []

      return {
        prizePool: prizePool.address,
        prizeToken: prizePool.prizeTokenAddress,
        prizeTokenSymbol,
        prizeTokenDecimals,
        tierPrizes,
        tierDailyFrequencies,
        drawPeriodSeconds: drawPeriod,
        isShutdown,
        shutdownAt: getSuccessfulResult<bigint>(shutdownMetadata[0]),
        drawTimeoutAt: getSuccessfulResult<bigint>(shutdownMetadata[1])
      }
    }
  })
}

type WalletPublicClient = NonNullable<ReturnType<typeof useWalletPublicClient>>

type MulticallCall = {
  address: Address
  abi: typeof vaultAbi | typeof erc20Abi | typeof prizePoolAbi
  functionName: string
  args?: readonly unknown[]
}

const getSuccessfulResult = <T>(result: unknown): T | undefined => {
  if (typeof result !== 'object' || !result || !('status' in result)) return undefined

  if (result.status !== 'success' || !('result' in result)) return undefined

  return result.result as T
}

const readShutdownBalance = async (
  publicClient: WalletPublicClient,
  prizePool: Address,
  vault: Address,
  userAddress: Address
): Promise<bigint | undefined> => {
  try {
    const result = await publicClient.call({
      to: prizePool,
      data: encodeFunctionData({
        abi: prizePoolAbi,
        functionName: 'shutdownBalanceOf',
        args: [vault, userAddress]
      })
    })

    if (!result.data) return undefined

    return decodeFunctionResult({
      abi: prizePoolAbi,
      functionName: 'shutdownBalanceOf',
      data: result.data
    }) as bigint
  } catch {
    return undefined
  }
}
