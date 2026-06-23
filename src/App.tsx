import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom'
import { formatUnits, type Address } from 'viem'
import { useAccount, useSwitchChain } from 'wagmi'
import defaultVaultList from './vaultLists/default'
import { CHAIN_LABELS, NETWORK } from './lib/constants'
import { accountHref, prizesHref, vaultHref, vaultsHref, type Route } from './lib/route'
import type { VaultListToken } from './lib/types'
import { AccountPage } from './components/AccountPage'
import { ConnectScreen } from './components/ConnectScreen'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { PrivacyPolicy } from './components/PrivacyPolicy'
import { PrizeList } from './components/PrizeList'
import { TermsOfService } from './components/TermsOfService'
import { VaultPage } from './components/VaultPage'
import { VaultRow } from './components/VaultRow'
import { VaultTransactionModalHost } from './components/VaultTransactionModalHost'
import { ChainIcon } from './components/ChainIcon'
import { getVaultReadId, usePrizePoolReads, useVaultListReads } from './lib/useVaultReads'
import { useTokenPricesInUsdc } from './lib/tokenPrices'

type ModalState = {
  vault: VaultListToken
  mode: 'deposit' | 'withdraw'
}

const MAINNET_CHAIN_IDS = new Set<number>([
  NETWORK.mainnet,
  NETWORK.optimism,
  NETWORK.base,
  NETWORK.arbitrum,
  NETWORK.scroll,
  NETWORK.gnosis,
  NETWORK.world
])

const readNetworkParam = (searchParams: URLSearchParams) => {
  const network = Number(searchParams.get('network'))
  return MAINNET_CHAIN_IDS.has(network) ? network : NETWORK.base
}

const useAnimatedNumber = (target: number, durationMs = 1000) => {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let frameId = 0
    const start = performance.now()

    const tick = (time: number) => {
      const progress = Math.min((time - start) / durationMs, 1)
      const easedProgress = 1 - (1 - progress) ** 3

      setValue(target * easedProgress)

      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frameId)
  }, [durationMs, target])

  return value
}

const formatAnimatedPrize = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

const ChainSelectButton = ({
  chainId,
  chainLabel,
  isExpanded,
  onClick
}: {
  chainId: number
  chainLabel: string
  isExpanded?: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-12 min-w-48 items-center justify-between gap-4 rounded-lg border border-pt-purple-200/80 bg-[#2D0C66] px-5 font-grotesk text-base font-medium text-pt-purple-100 outline-none transition hover:border-pt-purple-100 hover:text-white focus:border-pt-teal lg:h-16 lg:min-w-64 lg:px-7 lg:text-xl"
    aria-haspopup="dialog"
    aria-expanded={isExpanded}
  >
    <span className="flex items-center gap-2">
      <ChainIcon chainId={chainId} className="h-5 w-5 rounded-full lg:h-7 lg:w-7" />
      <span>{chainLabel}</span>
    </span>
    <span className="text-pt-purple-200 lg:text-2xl">v</span>
  </button>
)

export const App = () => {
  const { address, chain } = useAccount()
  const { switchChain } = useSwitchChain()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const vaultMatch = useMatch('/vault/:chainId/:address')
  const [modalState, setModalState] = useState<ModalState>()
  const [isChainModalOpen, setIsChainModalOpen] = useState(false)
  const route: Route = vaultMatch?.params.chainId && vaultMatch.params.address?.startsWith('0x')
    ? {
        type: 'vault',
        chainId: Number(vaultMatch.params.chainId),
        address: vaultMatch.params.address as Address
      }
    : location.pathname === '/prizes'
      ? { type: 'prizes' }
    : location.pathname === '/account'
        ? { type: 'account' }
    : location.pathname === '/terms'
        ? { type: 'terms' }
    : location.pathname === '/privacy'
        ? { type: 'privacy' }
        : { type: 'vaults' }
  const chainFilter = readNetworkParam(searchParams)

  useEffect(() => {
    if (
      !address ||
      (route.type !== 'vaults' && route.type !== 'prizes' && route.type !== 'account')
    ) {
      return
    }
    switchChain({ chainId: chainFilter })
  }, [address, chainFilter, route.type, switchChain])

  useEffect(() => {
    if (!address || location.pathname !== '/') return
    navigate(vaultsHref(NETWORK.base), { replace: true })
  }, [address, location.pathname, navigate])

  const chains = useMemo(() => {
    return Array.from(
      new Set(
        defaultVaultList.tokens
          .map((vault) => vault.chainId)
          .filter((chainId) => MAINNET_CHAIN_IDS.has(chainId))
      )
    )
  }, [])

  const vaults = useMemo(() => {
    return defaultVaultList.tokens.filter((vault) => vault.chainId === chainFilter)
  }, [chainFilter])
  const vaultListReadVaults = route.type === 'vaults' ? vaults : []
  const vaultListReads = useVaultListReads(vaultListReadVaults)
  const tokenPriceInputs = useMemo(() => {
    if (!vaultListReads.data) return []

    return vaultListReadVaults.flatMap((vault) => {
      const data = vaultListReads.data?.[getVaultReadId(vault)]
      return [
        {
          address: data?.asset ?? vault.extensions?.underlyingAsset?.address,
          decimals: vault.decimals
        },
        {
          address: data?.prizeToken,
          decimals: data?.prizeTokenDecimals
        }
      ]
    })
  }, [vaultListReads.data, vaultListReadVaults])
  const tokenPrices = useTokenPricesInUsdc(chainFilter, tokenPriceInputs, {
    enabled: !!vaultListReads.data && !vaultListReads.isLoading
  })
  const isSwitchingSelectedChain =
    !!address &&
    (route.type === 'vaults' || route.type === 'prizes' || route.type === 'account') &&
    !!chain?.id &&
    chain.id !== chainFilter

  const selectedChainLabel = CHAIN_LABELS[chainFilter] ?? `Chain ${chainFilter}`

  const selectedVault = useMemo(() => {
    if (route.type !== 'vault') return undefined
    return defaultVaultList.tokens.find(
      (vault) =>
        vault.chainId === route.chainId &&
        vault.address.toLowerCase() === route.address.toLowerCase()
    )
  }, [route])

  const closeVault = () => {
    navigate(vaultsHref(chainFilter))
  }

  const selectChain = (chainId: number) => {
    setIsChainModalOpen(false)
    navigate(
      route.type === 'prizes'
        ? prizesHref(chainId)
        : route.type === 'account'
          ? accountHref(chainId)
          : vaultsHref(chainId)
    )
  }

  if (!address && route.type !== 'terms' && route.type !== 'privacy') return <ConnectScreen />
  if (location.pathname === '/') return <Navigate to={vaultsHref(NETWORK.base)} replace />

  return (
    <div className="flex min-h-screen flex-col bg-[#21064E] text-pt-purple-50">
      <Header route={route} chainId={chainFilter} />
      <div className="flex-1">
        {route.type === 'terms' ? (
          <LegalPage>
            <TermsOfService className="text-sm leading-7 text-pt-purple-100 sm:text-base" />
          </LegalPage>
        ) : route.type === 'privacy' ? (
          <LegalPage>
            <PrivacyPolicy className="text-sm leading-7 text-pt-purple-100 sm:text-base" />
          </LegalPage>
        ) : selectedVault ? (
          <VaultPage
            vault={selectedVault}
            onBack={closeVault}
            onAction={(mode) => setModalState({ vault: selectedVault, mode })}
          />
        ) : route.type === 'prizes' ? (
          <PrizesPage
            chainId={chainFilter}
            chainLabel={selectedChainLabel}
            isSwitchingChain={isSwitchingSelectedChain}
            onOpenChainSelect={() => setIsChainModalOpen(true)}
          />
        ) : route.type === 'account' ? (
          <AccountPage
            chainId={chainFilter}
            chainLabel={selectedChainLabel}
            vaults={vaults}
            isSwitchingChain={isSwitchingSelectedChain}
            onOpenChainSelect={() => setIsChainModalOpen(true)}
            onVaultAction={(vault, mode) => setModalState({ vault, mode })}
          />
        ) : (
          <main className="mx-auto flex max-w-[94rem] flex-col gap-9 px-4 pb-14 pt-10 sm:px-6 lg:pt-12">
            <section className="flex flex-col items-center gap-7 text-center">
              <h1 className="font-grotesk text-[2rem] font-bold leading-none text-white sm:text-4xl lg:text-5xl">
                Deposit tokens, <span className="text-pt-teal">win prizes</span>. Withdraw anytime,
                <span className="text-pt-teal"> no loss</span>
              </h1>

              <div className="rounded-[1.75rem] bg-[#2D0C66] px-5 py-4 shadow-[0_20px_80px_rgba(20,4,48,0.18)]">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <ChainSelectButton
                    chainId={chainFilter}
                    chainLabel={selectedChainLabel}
                    onClick={() => setIsChainModalOpen(true)}
                    isExpanded={isChainModalOpen}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-t-2xl rounded-b-[2.5rem] bg-[#2D0C66] px-5 pb-5 pt-7">
              <div className="hidden grid-cols-[minmax(0,5fr)_repeat(3,minmax(0,4fr))_minmax(0,5fr)] px-5 pb-7 text-base font-medium text-pt-purple-200 lg:grid">
                <div>Prize Vault</div>
                <div className="text-center">Your Deposit</div>
                <div className="text-center">Total Deposits</div>
                <div className="text-center">Prize Size</div>
                <div className="text-right">
                  <span className="inline-block w-52 text-center">Manage</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {vaults.map((vault) => (
                  <VaultRow
                    key={`${vault.chainId}-${vault.address}`}
                    vault={vault}
                    data={vaultListReads.data?.[getVaultReadId(vault)]}
                    tokenPrices={tokenPrices.data}
                    isLoading={vaultListReads.isLoading || vaultListReads.isFetching || !vaultListReads.data}
                    isError={vaultListReads.isError}
                    isSwitchingChain={isSwitchingSelectedChain}
                    href={vaultHref(vault.chainId, vault.address)}
                    onAction={(mode) => setModalState({ vault, mode })}
                  />
                ))}
              </div>
            </section>
          </main>
        )}
      </div>
      <Footer />
      {modalState && (
        <VaultTransactionModalHost
          vault={modalState.vault}
          mode={modalState.mode}
          onModeChange={(mode) => setModalState({ ...modalState, mode })}
          onClose={() => setModalState(undefined)}
        />
      )}
      {isChainModalOpen && (
        <ChainSelectModal
          chains={chains}
          selectedChainId={chainFilter}
          onSelect={selectChain}
          onClose={() => setIsChainModalOpen(false)}
        />
      )}
    </div>
  )
}

const LegalPage = ({ children }: { children: ReactNode }) => (
  <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-10 sm:px-6 lg:pt-12">
    <article className="rounded-2xl border border-white/10 bg-[#2D0C66] px-5 py-7 shadow-[0_20px_80px_rgba(20,4,48,0.18)] sm:px-8 sm:py-10 lg:px-12">
      {children}
    </article>
  </main>
)

type ChainSelectModalProps = {
  chains: number[]
  selectedChainId: number
  onSelect: (chainId: number) => void
  onClose: () => void
}

const ChainSelectModal = ({ chains, selectedChainId, onSelect, onClose }: ChainSelectModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
    <button type="button" className="absolute inset-0 cursor-default" aria-label="Close chain selector" onClick={onClose} />
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Select chain"
      className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#2D0C66] p-4 text-pt-purple-50 shadow-2xl"
    >
      <div className="mb-3 flex items-center justify-between gap-4 px-2">
        <h2 className="font-grotesk text-xl font-semibold text-white">Select Chain</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 font-grotesk text-lg font-semibold text-pt-purple-200 transition hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          x
        </button>
      </div>
      <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
        {chains.map((chainId) => {
          const isSelected = chainId === selectedChainId

          return (
            <button
              key={chainId}
              type="button"
              onClick={() => onSelect(chainId)}
              className={`flex items-center justify-between gap-4 rounded-xl px-4 py-3 text-left transition ${
                isSelected
                  ? 'bg-pt-purple-500 text-white'
                  : 'bg-white/5 text-pt-purple-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <ChainIcon chainId={chainId} className="h-7 w-7 rounded-full" />
                <span className="font-grotesk text-lg font-semibold">
                  {CHAIN_LABELS[chainId] ?? `Chain ${chainId}`}
                </span>
              </span>
              {isSelected && <span className="font-grotesk text-sm font-semibold text-pt-teal">Selected</span>}
            </button>
          )
        })}
      </div>
    </div>
  </div>
)

type PrizesPageProps = {
  chainId: number
  chainLabel: string
  isSwitchingChain: boolean
  onOpenChainSelect: () => void
}

const PrizesPage = ({
  chainId,
  chainLabel,
  isSwitchingChain,
  onOpenChainSelect
}: PrizesPageProps) => {
  const prizePoolReads = usePrizePoolReads(chainId)
  const prizeData = prizePoolReads.data
  const tokenPrices = useTokenPricesInUsdc(
    chainId,
    [{ address: prizeData?.prizeToken, decimals: prizeData?.prizeTokenDecimals }],
    { enabled: !!prizeData?.prizeToken && !prizePoolReads.isLoading }
  )
  const prizeTokenPrice = prizeData?.prizeToken
    ? tokenPrices.data?.[prizeData.prizeToken.toLowerCase()]
    : undefined
  const isLoading = isSwitchingChain || prizePoolReads.isLoading || prizePoolReads.isFetching
  const tierOnePrize = Number(
    formatUnits(prizeData?.tierPrizes[0] ?? 0n, prizeData?.prizeTokenDecimals ?? 18)
  )
  const animatedTierOnePrize = useAnimatedNumber(tierOnePrize)
  const prizeTokenSymbol =
    prizeData?.prizeTokenSymbol === 'WETH' ? 'ETH' : (prizeData?.prizeTokenSymbol ?? 'ETH')
  const prizeAmountLabel = `${formatAnimatedPrize(animatedTierOnePrize)} ${prizeTokenSymbol}`
  const prizeAmountWidthLabel = `${formatAnimatedPrize(tierOnePrize)} ${prizeTokenSymbol}`

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-9 px-4 pb-14 pt-10 sm:px-6 lg:pt-12">
      <section className="flex flex-col items-center gap-7 text-center">
        <h1 className="max-w-4xl font-grotesk text-[2rem] font-bold leading-none text-white sm:text-4xl lg:text-5xl">
          Keep your deposit. Win up to{' '}
          <span className="inline-flex whitespace-nowrap">
            <span
              className="inline-flex text-pt-teal tabular-nums"
              style={{ minWidth: `${prizeAmountWidthLabel.length}ch` }}
            >
              {prizeAmountLabel}
            </span>
            <span className="ml-2" aria-hidden="true">
              🎉
            </span>
          </span>
        </h1>
        <div className="rounded-[1.75rem] bg-[#2D0C66] px-5 py-4 shadow-[0_20px_80px_rgba(20,4,48,0.18)]">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <ChainSelectButton
              chainId={chainId}
              chainLabel={chainLabel}
              onClick={onOpenChainSelect}
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col items-center">
        <PrizeList
          chainId={chainId}
          data={prizeData}
          prizeTokenPrice={prizeTokenPrice}
          isLoading={isLoading}
          isError={prizePoolReads.isError}
          isSwitchingChain={isSwitchingChain}
        />
      </section>
    </main>
  )
}
