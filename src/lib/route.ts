import type { Address } from 'viem'

export type Route =
  | { type: 'vaults' }
  | { type: 'prizes' }
  | { type: 'account' }
  | { type: 'vault'; chainId: number; address: Address }

export const vaultHref = (chainId: number, address: string) => `/vault/${chainId}/${address}`

export const vaultsHref = (chainId: number) => `/vaults?network=${chainId}`

export const prizesHref = (chainId: number) => `/prizes?network=${chainId}`

export const accountHref = (chainId: number) => `/account?network=${chainId}`
