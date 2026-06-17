# Cabana Lite Client

A static, wallet-backed PoolTogether/Cabana frontend built with Vite, React, Tailwind, TanStack Query, RainbowKit, wagmi, and viem.

This app intentionally avoids app-owned RPC URLs and subgraphs. Chain reads are performed through the connected wallet provider, and vault metadata is sourced from the local Cabana vault list copied into `src/vaultLists/default`.

## Features

- Fullscreen Cabana wallet connect screen
- Cabana-style connected header
- Vault list filtered by chain
- Chain selector defaults to Base and calls `switchChain` when changed
- Vault detail pages at `#/vault/:chainId/:address`
- Account page at `/account`
- Wallet-backed vault reads:
  - user deposit
  - vault total deposits
  - prize pool address
  - prize token address
  - deposit token address
  - prize tier count via `numberOfTiers()`
  - prize tier sizes via `getTierPrizeSize(tier)`
- Deposit and withdraw modals
- ERC20 approval before deposits when required
- Bonus Rewards on the account page:
  - uses the same chain selector treatment as the vault/prizes pages
  - reads pool-wide TWAB rewards from on-chain contracts without logs or a subgraph
  - scans listed vaults in bounded multicall batches
  - streams partial rewards and search progress while remaining vaults are checked
  - claims discovered unclaimed rewards

## Requirements

- Node.js
- pnpm
- A browser wallet for live chain reads and transactions

## Commands

```bash
pnpm install
pnpm dev --port 5173
pnpm build
pnpm preview
```

The dev server runs at `http://localhost:5173/` by default when using the command above.

## Architecture Notes

- `src/lib/wagmi.ts` configures RainbowKit and wagmi wallet connectors.
- `src/lib/useVaultReads.ts` creates a public client from the connected wallet client transport. Do not replace this with `http(...)` RPC transports unless the product requirement changes.
- `src/lib/useAccountRewards.ts` handles the Bonus Rewards search and claim request construction. It intentionally avoids `getLogs`; pool-wide reward discovery uses `latestPromotionId()` and batched multicalls.
- `src/vaultLists/default` contains the local Cabana vault list.
- `src/lib/abis.ts` contains the minimal ABIs used by this static client.
- `src/App.tsx` owns the hash routing, vault chain filter, and transaction modal state.

## Important Constraints

- Do not add a subgraph dependency.
- Do not add app-owned RPC URLs.
- Preserve the Cabana/PoolTogether fonts, colors, logo treatment, vault icons, and wallet flow.
- The app can only read live data for the connected wallet chain. The vault list selector switches chain and filters the list to keep the UI aligned with that constraint.
- Bonus Rewards are contract-only in this static client. Do not add log scans, subgraphs, or app-owned indexing unless the product requirement changes.
- Vault-specific TWAB rewards do not expose an enumerable promotion id range on-chain, so the account page can only fully discover pool-wide rewards without logs or a maintained off-chain id list.

## Verification

Before handing off changes, run:

```bash
CI=true pnpm --config.confirm-modules-purge=false build
```

The build may show Rollup warnings about third-party pure annotations and large wallet-related chunks. Those warnings are expected with the current RainbowKit/wagmi bundle.
