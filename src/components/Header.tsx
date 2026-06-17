import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Link } from 'react-router-dom'
import { CabanaLogo } from './CabanaLogo'
import { NETWORK } from '../lib/constants'
import { accountHref, prizesHref, vaultsHref, type Route } from '../lib/route'

export const Header = ({ route, chainId = NETWORK.base }: { route?: Route; chainId?: number }) => {
  const navClass = (isActive: boolean) =>
    `transition hover:text-pt-teal ${isActive ? 'text-pt-teal' : ''}`

  return (
    <header className="sticky top-0 z-20 bg-[#21064E]">
      <div className="grid h-20 grid-cols-[auto_1fr_auto] items-center gap-4 px-5 sm:px-8">
        <div className="flex items-center">
          <CabanaLogo className="w-44" />
        </div>

        <nav className="hidden items-center justify-center gap-11 font-grotesk text-lg font-semibold text-pt-purple-50 lg:flex">
          <Link
            to={prizesHref(chainId)}
            className={navClass(route?.type === 'prizes')}
          >
            Prizes
          </Link>
          <Link
            to={vaultsHref(chainId)}
            className={navClass(route?.type === 'vaults' || route?.type === 'vault')}
          >
            Vaults
          </Link>
          <Link
            to={accountHref(chainId)}
            className={navClass(route?.type === 'account')}
          >
            Account
          </Link>
        </nav>

        <ConnectButton.Custom>
          {({ account, openAccountModal, openConnectModal, mounted }) => {
            const ready = mounted
            const connected = ready && account

            if (!connected) {
              return (
                <button
                  type="button"
                  onClick={openConnectModal}
                  className="rounded-2xl bg-pt-teal px-6 py-3 font-grotesk text-lg font-semibold text-pt-purple-900 transition hover:bg-pt-teal-light"
                >
                  Connect Wallet
                </button>
              )
            }

            return (
              <div className="flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={openAccountModal}
                  className="flex items-center gap-3 rounded-2xl bg-transparent px-1 py-2 font-grotesk text-lg font-semibold text-pt-purple-50 transition hover:text-pt-teal"
                >
                  {account.ensAvatar ? (
                    <img src={account.ensAvatar} alt="" className="h-9 w-9 rounded-full" />
                  ) : (
                    <span className="h-9 w-9 rounded-full bg-[#FF7D8F]" />
                  )}
                  <span className="hidden max-w-44 truncate sm:inline">{account.displayName}</span>
                  <span className="text-pt-purple-200">v</span>
                </button>

                <button
                  type="button"
                  aria-label="Menu"
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-pt-purple-100 transition hover:bg-white/10 hover:text-white"
                >
                  <span className="flex flex-col gap-1.5">
                    <span className="block h-0.5 w-7 rounded-full bg-current" />
                    <span className="block h-0.5 w-7 rounded-full bg-current" />
                    <span className="block h-0.5 w-7 rounded-full bg-current" />
                  </span>
                </button>
              </div>
            )
          }}
        </ConnectButton.Custom>
      </div>
    </header>
  )
}
