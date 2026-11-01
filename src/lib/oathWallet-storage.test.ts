import { afterEach, expect, it, vi } from 'vitest'
import type { Wallet } from '@rainbow-me/rainbowkit'
import { mainnet } from 'wagmi/chains'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

it("clearing either wallet's requested chains does not invalidate the other wallet", async () => {
  vi.resetModules()
  // Select RainbowKit's real client delegate, without constructing Wagmi's
  // config (which would schedule setup and initialize a network provider).
  vi.stubGlobal('window', {})
  const { oathWallet } = await import('./oathWallet')
  const { walletConnectWallet } = await import('@rainbow-me/rainbowkit/wallets')
  const values = new Map<string, unknown>()
  const config = {
    chains: [mainnet],
    storage: {
      getItem: async (key: string) => values.get(key),
      setItem: async (key: string, value: unknown) => {
        values.set(key, value)
      },
    },
  }
  type ChainBookkeeping = {
    requestedChainsStorageKey: string
    setRequestedChainsIds: (ids: number[]) => Promise<void>
    getRequestedChainsIds: () => Promise<number[]>
    isChainsStale: () => Promise<boolean>
  }
  const instantiate = (wallet: Wallet) => {
    const connector = wallet.createConnector({
      rkDetails: {
        ...wallet,
        index: 0,
        groupIndex: 0,
        groupName: 'Wallets',
        isRainbowKitConnector: true,
      },
    })
    return connector(
      config as unknown as Parameters<typeof connector>[0],
    ) as unknown as ChainBookkeeping
  }
  const oath = instantiate(oathWallet({ projectId: 'test-project-id' }))
  const generic = instantiate(
    walletConnectWallet({ projectId: 'test-project-id' }),
  )
  expect(oath.requestedChainsStorageKey).not.toBe(
    generic.requestedChainsStorageKey,
  )
  await oath.setRequestedChainsIds([1])
  await generic.setRequestedChainsIds([1])
  await oath.setRequestedChainsIds([])
  expect(await generic.getRequestedChainsIds()).toEqual([1])
  expect(await generic.isChainsStale()).toBe(false)
  await oath.setRequestedChainsIds([1])
  await generic.setRequestedChainsIds([])
  expect(await oath.getRequestedChainsIds()).toEqual([1])
  expect(await oath.isChainsStale()).toBe(false)
})
