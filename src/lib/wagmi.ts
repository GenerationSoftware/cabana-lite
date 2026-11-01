import {
  argentWallet,
  braveWallet,
  coin98Wallet,
  coinbaseWallet,
  imTokenWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  tahoWallet,
  trustWallet,
  uniswapWallet,
  walletConnectWallet,
  xdefiWallet,
  zerionWallet
} from '@rainbow-me/rainbowkit/wallets'
import { connectorsForWallets, darkTheme, type Theme, type WalletList } from '@rainbow-me/rainbowkit'
import { createConfig, custom, type Transport } from 'wagmi'
import { SUPPORTED_CHAINS } from './constants'
import { oathWallet } from './oathWallet'

const projectId = '3eb812d6ed9689e2ced204df2b9e6c76'
const walletMap = {
  oath: oathWallet,
  metamask: metaMaskWallet,
  walletconnect: walletConnectWallet,
  rainbow: rainbowWallet,
  injected: injectedWallet,
  argent: argentWallet,
  coinbase: coinbaseWallet,
  ledger: ledgerWallet,
  taho: tahoWallet,
  trust: trustWallet,
  zerion: zerionWallet,
  brave: braveWallet,
  safe: safeWallet,
  xdefi: xdefiWallet,
  uniswap: uniswapWallet,
  coin98: coin98Wallet,
  imtoken: imTokenWallet
} as const

const getBrowserProvider = () => {
  if (typeof window === 'undefined') return undefined
  return window.ethereum
}

const walletTransport = (): Transport =>
  custom({
    request: async ({ method, params }) => {
      const provider = getBrowserProvider()
      if (!provider) throw new Error('No injected wallet provider is available.')
      return provider.request({ method, params })
    }
  })

const defaultWallets = ['injected', 'oath', 'walletconnect', 'rainbow', 'metamask', 'coinbase'] as const
const otherWallets = [
  'argent',
  'brave',
  'coin98',
  'imtoken',
  'ledger',
  'safe',
  'taho',
  'trust',
  'uniswap',
  'xdefi',
  'zerion'
] as const

export const getWalletGroups = (
  search = typeof window === 'undefined' ? '' : window.location.search
): WalletList => {
  const highlightedWallet = new URLSearchParams(search).get('wallet') ?? undefined

  if (
    highlightedWallet &&
    highlightedWallet !== 'injected' &&
    Object.prototype.hasOwnProperty.call(walletMap, highlightedWallet)
  ) {
    const wallet = highlightedWallet as keyof typeof walletMap
    return [
      { groupName: 'Recommended', wallets: [walletMap[wallet]] },
      {
        groupName: 'Default',
        wallets: defaultWallets.filter((id) => id !== wallet).map((id) => walletMap[id])
      },
      {
        groupName: 'Other',
        wallets: otherWallets.filter((id) => id !== wallet).map((id) => walletMap[id])
      }
    ]
  }

  return [
    { groupName: 'Default', wallets: defaultWallets.map((id) => walletMap[id]) },
    { groupName: 'Other', wallets: otherWallets.map((id) => walletMap[id]) }
  ]
}

export const wagmiConfig = createConfig({
  chains: SUPPORTED_CHAINS,
  connectors: connectorsForWallets(getWalletGroups(), {
    appName: 'Cabana',
    projectId
  }),
  transports: Object.fromEntries(SUPPORTED_CHAINS.map((chain) => [chain.id, walletTransport()])) as any,
  batch: { multicall: { batchSize: 1_024 * 1_024 } }
})

export const ptRainbowTheme = (): Theme => {
  const theme = darkTheme()
  Object.assign(theme.colors, {
    accentColor: '#8050E3',
    connectButtonBackground: 'transparent',
    connectButtonText: '#F5F0FF'
  })
  Object.assign(theme.fonts, { body: 'Grotesk' })
  Object.assign(theme.shadows, { connectButton: '0 0 0 transparent' })
  return theme
}

declare global {
  interface Window {
    ethereum?: any
  }
}
