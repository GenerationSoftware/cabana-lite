import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CabanaLogo } from './CabanaLogo'
import { NETWORK } from '../lib/constants'
import { accountHref, prizesHref, vaultsHref, type Route } from '../lib/route'

export const Header = ({ route, chainId = NETWORK.base }: { route?: Route; chainId?: number }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const ignoreMenuClickRef = useRef(false)
  const menuOpenedAtRef = useRef(0)
  const navClass = (isActive: boolean) =>
    `transition hover:text-pt-teal ${isActive ? 'text-pt-teal' : ''}`
  const mobileNavClass = (isActive: boolean) =>
    `rounded-2xl px-5 py-4 font-grotesk text-2xl font-semibold transition ${
      isActive ? 'bg-pt-purple-500 text-white' : 'text-pt-purple-100 hover:bg-white/10 hover:text-white'
    }`
  const links = [
    { label: 'Prizes', href: prizesHref(chainId), isActive: route?.type === 'prizes' },
    { label: 'Vaults', href: vaultsHref(chainId), isActive: route?.type === 'vaults' || route?.type === 'vault' },
    { label: 'Account', href: accountHref(chainId), isActive: route?.type === 'account' }
  ]
  const toggleMenu = () => {
    menuOpenedAtRef.current = Date.now()
    setIsMenuOpen((value) => !value)
  }
  const closeMenuFromOutside = () => {
    if (Date.now() - menuOpenedAtRef.current < 350) return
    setIsMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-20 bg-[#21064E]">
      <div className="relative grid h-20 grid-cols-[auto_1fr_auto] items-center gap-4 px-5 sm:px-8">
        <div className="flex items-center">
          <CabanaLogo smLogoClassName="w-10" mdLogoClassName="w-44" />
        </div>

        <nav className="hidden items-center justify-center gap-11 font-grotesk text-lg font-semibold text-pt-purple-50 lg:flex">
          {links.map((link) => (
            <Link key={link.label} to={link.href} className={navClass(link.isActive)}>
              {link.label}
            </Link>
          ))}
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
                  aria-label="Open wallet account"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-transparent font-grotesk text-lg font-semibold text-pt-purple-50 transition hover:text-pt-teal sm:h-auto sm:w-auto sm:gap-3 sm:px-1 sm:py-2"
                >
                  {account.ensAvatar ? (
                    <img src={account.ensAvatar} alt="" className="h-9 w-9 rounded-full" />
                  ) : (
                    <span className="h-9 w-9 rounded-full bg-[#FF7D8F]" />
                  )}
                  <span className="hidden max-w-44 truncate sm:inline">{account.displayName}</span>
                  <span className="hidden text-pt-purple-200 sm:inline">v</span>
                </button>

                <button
                  type="button"
                  aria-label="Menu"
                  aria-expanded={isMenuOpen}
                  onTouchEnd={(event) => {
                    event.preventDefault()
                    ignoreMenuClickRef.current = true
                    toggleMenu()
                  }}
                  onClick={(event) => {
                    if (ignoreMenuClickRef.current) {
                      event.preventDefault()
                      ignoreMenuClickRef.current = false
                      return
                    }

                    toggleMenu()
                  }}
                  className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl text-pt-purple-100 transition hover:bg-white/10 hover:text-white"
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

        {isMenuOpen && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-x-0 bottom-0 top-20 z-40 cursor-default bg-black/30 backdrop-blur-[2px] animate-[menu-backdrop-in_180ms_ease-out] lg:hidden"
              onClick={closeMenuFromOutside}
            />
            <div className="fixed inset-x-4 top-20 z-50 animate-[mobile-menu-in_180ms_ease-out] rounded-b-3xl border border-t-0 border-white/10 bg-[#2D0C66] p-4 shadow-2xl lg:hidden">
              <nav className="flex flex-col gap-2">
                {links.map((link) => (
                  <Link
                    key={link.label}
                    to={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={mobileNavClass(link.isActive)}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
