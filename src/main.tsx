import '@rainbow-me/rainbowkit/styles.css'
import './styles.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { App } from './App'
import { ptRainbowTheme, wagmiConfig } from './lib/wagmi'

const READ_CACHE_TTL_MS = 60_000

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: READ_CACHE_TTL_MS,
      gcTime: READ_CACHE_TTL_MS,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig} reconnectOnMount={true}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={ptRainbowTheme()}
          showRecentTransactions={true}
          appInfo={{ appName: 'Cabana' }}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
