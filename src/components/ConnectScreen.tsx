import { ConnectButton } from '@rainbow-me/rainbowkit'
import { CabanaLogo } from './CabanaLogo'
import { Footer } from './Footer'

export const ConnectScreen = () => {
  return (
    <div className="flex min-h-screen flex-col bg-[#21064E] text-pt-purple-50">
      <main className="flex-1 bg-[radial-gradient(circle_at_top,#6538C1_0,#2D0C66_42%,#21064E_100%)] px-6">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-10 text-center">
          <div className="flex flex-col items-center gap-6">
            <CabanaLogo className="w-72 sm:w-[28rem]" />
            <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em] text-pt-purple-200">
              <span>Powered by</span>
              <img src="/pooltogether-logo.svg" alt="PoolTogether" className="h-7 w-auto" />
            </div>
          </div>
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button
                type="button"
                onClick={openConnectModal}
                className="rounded-full bg-pt-teal px-10 py-5 font-grotesk text-3xl font-bold text-pt-purple-900 shadow-[0_0_60px_rgba(53,240,208,0.35)] transition hover:scale-[1.02] hover:bg-pt-teal-light"
              >
                Connect Wallet
              </button>
            )}
          </ConnectButton.Custom>
        </div>
      </main>
      <Footer />
    </div>
  )
}
