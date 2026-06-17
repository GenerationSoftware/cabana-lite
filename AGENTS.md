# Agent Instructions

This repository is a static Cabana Lite client. Keep changes small, local, and aligned with the source Cabana app style.

## Core Rules

- Use Tailwind, Vite, React, TanStack Query, RainbowKit, viem, and wagmi.
- Do not introduce a subgraph.
- Do not introduce app-owned RPC URLs or `http(...)` wagmi transports for chain reads.
- Use the connected wallet transport for reads and writes.
- Preserve the wallet list and grouping from `src/lib/wagmi.ts`.
- Preserve Cabana/PoolTogether branding: colors, fonts, logo, and vault/token icons.

## Chain and Vault Behavior

- The vault list defaults to Base (`NETWORK.base`).
- The vault list and account page chain selectors must both filter page data and call `switchChain({ chainId })`.
- Do not re-add an `All vaults` option unless the product requirement changes.
- Do not re-add a network switcher to the header. Chain switching belongs in the vault list selector.
- Vault pages are hash-routed with `#/vault/:chainId/:address`.
- The account page is routed at `/account` and uses the shared chain selector pattern.

## Contract Reads

- Keep ABIs minimal in `src/lib/abis.ts`.
- Prize breakdown must read `numberOfTiers()` from the prize pool, then read `getTierPrizeSize(tier)` for each tier.
- Vault reads live in `src/lib/useVaultReads.ts`.
- Bonus Rewards reads live in `src/lib/useAccountRewards.ts`.
- Reads only work reliably for the connected wallet chain; keep UI states honest about this.
- Do not use `getLogs` for Bonus Rewards in this static client. The account page discovers pool-wide rewards with `latestPromotionId()` and bounded multicalls.
- Vault-specific TWAB rewards do not expose an enumerable promotion id range on-chain. Without logs or a maintained off-chain id list, do not claim complete vault-specific reward discovery.
- Bonus Rewards should scan all listed vaults in batches, show search progress, and keep completed per-chain search progress visible when navigating between account chains.

## Transaction Flow

- Deposit and withdraw should stay in modals, not embedded in the vault list.
- Deposit should approve the deposit token when allowance is too low, then call vault `deposit`.
- Withdraw should call vault `withdraw`.
- Keep chain switching in modal actions when the selected vault chain differs from the connected chain.
- Bonus Rewards claim actions should use multicall aggregation where possible and should not enable Claim All while a batched search is still in progress.

## Styling

- Match Cabana’s quiet purple interface and Grotesk/Inter typography.
- Keep action buttons large, rounded, and close to the Cabana app treatment.
- Avoid explanatory in-app text that describes implementation details.

## Verification

Run this before finishing:

```bash
CI=true pnpm --config.confirm-modules-purge=false build
```

If dependencies need approval, use `pnpm approve-builds` and approve the listed wallet/build helper packages.
