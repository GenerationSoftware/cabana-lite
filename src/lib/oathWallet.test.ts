import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { oathWallet, OATH_WALLET_ID } from './oathWallet'
import { getWalletGroups, wagmiConfig } from './wagmi'

const PAIRING = `wc:${'a'.repeat(64)}@2?relay-protocol=irn&symKey=${'b'.repeat(64)}&expiryTimestamp=2000000000`
const names = (search = '') => getWalletGroups(search).map(group => ({
  name: group.groupName,
  wallets: group.wallets.map(factory => factory({ projectId: 'test', appName: 'Cabana' }).name)
}))

afterEach(() => vi.unstubAllGlobals())

describe('Oath Wallet connection', () => {
  it('preserves the QR payload and encodes the complete iOS handoff URI', () => {
    const wallet = oathWallet({ projectId: 'test' })
    expect(wallet.qrCode?.getUri(PAIRING)).toBe(PAIRING)
    const uri = new URL(wallet.mobile!.getUri!(PAIRING))
    expect(uri.protocol).toBe('oathwallet:')
    expect(uri.hostname).toBe('wc')
    expect([...uri.searchParams]).toEqual([['uri', PAIRING]])
  })

  it('does not advertise an extension or an Android app', () => {
    const wallet = oathWallet({ projectId: 'test' })
    expect(wallet.extension).toBeUndefined()
    expect(wallet.downloadUrls?.android).toBeUndefined()
    expect(wallet.downloadUrls?.ios).toBe('https://apps.apple.com/app/id6780187283')
    expect(wallet.qrCode?.instructions?.steps.map(step => step.step)).toEqual(['install', 'scan', 'connect'])
  })

  it.each([
    ['Mozilla/5.0 (Linux; Android 15)', true],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X)', false],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', false]
  ])('handles platform visibility for %s', (userAgent, hidden) => {
    vi.stubGlobal('navigator', { userAgent })
    expect(Boolean(oathWallet({ projectId: 'test' }).hidden?.())).toBe(hidden)
  })

  it('adds Oath to the default group without removing or reordering existing wallets', () => {
    const groups = names()
    expect(groups[0].wallets).toContain('Oath Wallet')
    expect(groups[0].wallets.filter(name => name !== 'Oath Wallet')).toEqual([
      'Browser Wallet', 'WalletConnect', 'Rainbow', 'MetaMask', 'Coinbase Wallet'
    ])
    expect(groups[1].wallets).toHaveLength(11)
    expect(groups[1].name).toBe('Other')
  })

  it('supports the existing highlighted-wallet link without duplicating Oath', () => {
    const groups = names('?wallet=oath')
    expect(groups[0]).toEqual({ name: 'Recommended', wallets: ['Oath Wallet'] })
    expect(groups.flatMap(group => group.wallets).filter(name => name === 'Oath Wallet')).toHaveLength(1)
    expect(groups[1].wallets).toContain('WalletConnect')
  })

  it('keeps existing highlight links and ignores unknown wallet names', () => {
    expect(names('?wallet=metamask')[0]).toEqual({ name: 'Recommended', wallets: ['MetaMask'] })
    expect(names('?wallet=not-a-wallet')).toEqual(names())
    expect(names('?wallet=injected')).toEqual(names())
  })

  it.each(['__proto__', 'constructor', 'toString'])(
    'ignores inherited object properties in wallet highlight links: %s',
    wallet => {
      expect(names(`?wallet=${wallet}`)).toEqual(names())
    }
  )

  it('registers a distinct Oath connector in the actual Wagmi config', () => {
    const oath = wagmiConfig.connectors.find(connector => connector.id === OATH_WALLET_ID)
    expect(oath?.name).toBe('Oath Wallet')
    expect(oath?.type).toBe('walletConnect')
    const ids = wagmiConfig.connectors.map(connector => connector.id)
    expect(ids.indexOf(OATH_WALLET_ID)).toBeLessThan(ids.indexOf('walletConnect'))
    expect(wagmiConfig.connectors.some(connector => connector.id === 'walletConnect')).toBe(true)
    expect(wagmiConfig.connectors.filter(connector => connector.id === OATH_WALLET_ID)).toHaveLength(1)
  })

  it('ships a local rounded logo without active content or remote image dependencies', () => {
    const svg = readFileSync('public/images/oath-wallet.svg', 'utf8')
    expect(svg).toMatch(/rx="\d+"/)
    expect(svg).not.toMatch(/<script|(?:href|src)=["']https?:\/\//)
  })
})
