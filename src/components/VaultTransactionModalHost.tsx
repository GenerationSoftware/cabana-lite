import { useAccount } from 'wagmi'
import type { VaultListToken } from '../lib/types'
import { useVaultReads } from '../lib/useVaultReads'
import { TransactionModal } from './TransactionModal'

interface VaultTransactionModalHostProps {
  vault: VaultListToken
  mode: 'deposit' | 'withdraw'
  onModeChange: (mode: 'deposit' | 'withdraw') => void
  onClose: () => void
}

export const VaultTransactionModalHost = (props: VaultTransactionModalHostProps) => {
  const { vault, mode, onModeChange, onClose } = props
  const { address, chain } = useAccount()
  const { data, refetch } = useVaultReads(vault)

  if (!address) return null

  return (
    <TransactionModal
      vault={vault}
      data={data}
      account={address}
      connectedChainId={chain?.id}
      mode={mode}
      onModeChange={onModeChange}
      onClose={onClose}
      onSettled={() => void refetch()}
    />
  )
}
