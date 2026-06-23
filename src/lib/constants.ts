import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  gnosis,
  gnosisChiado,
  mainnet,
  optimism,
  optimismSepolia,
  scroll,
  scrollSepolia,
  worldchain
} from 'viem/chains'
import type { Address } from 'viem'
import arbitrumIcon from '../assets/chain/arbitrum.svg'
import mainnetIcon from '../assets/chain/mainnet.svg'
import optimismIcon from '../assets/chain/optimism.svg'

export const DOMAINS = {
  app: '',
  landingPage: 'https://cabana.fi',
  protocolLandingPage: 'https://pooltogether.com',
  docs: 'https://docs.cabana.fi',
  protocolDocs: 'https://docs.pooltogether.com',
  protocolDevDocs: 'https://dev.pooltogether.com',
  governance: 'https://gov.pooltogether.com'
} as const

export const LINKS = {
  ...DOMAINS,
  termsOfService: `${DOMAINS.landingPage}/terms`,
  privacyPolicy: `${DOMAINS.landingPage}/privacy`,
  ecosystem: `${DOMAINS.protocolLandingPage}/ecosystem`,
  discord: `${DOMAINS.protocolLandingPage}/discord`,
  audits: `${DOMAINS.protocolDocs}/security/audits`,
  twitter: 'https://twitter.com/PoolTogether_',
  github: 'https://github.com/orgs/GenerationSoftware/repositories?q=pooltogether+sort%3Astars',
  medium: 'https://medium.com/pooltogether'
} as const

export const NETWORK = {
  mainnet: 1,
  optimism: 10,
  gnosis: 100,
  world: 480,
  base: 8453,
  arbitrum: 42161,
  scroll: 534352,
  optimism_sepolia: 11155420,
  arbitrum_sepolia: 421614,
  base_sepolia: 84532,
  scroll_sepolia: 534351,
  gnosis_chiado: 10200
} as const

export const SUPPORTED_CHAINS = [
  mainnet,
  optimism,
  base,
  arbitrum,
  scroll,
  gnosis,
  worldchain,
  optimismSepolia,
  baseSepolia,
  arbitrumSepolia,
  scrollSepolia,
  gnosisChiado
] as const

export const CHAIN_LABELS: Record<number, string> = {
  [NETWORK.mainnet]: 'Ethereum',
  [NETWORK.optimism]: 'Optimism',
  [NETWORK.base]: 'Base',
  [NETWORK.arbitrum]: 'Arbitrum',
  [NETWORK.scroll]: 'Scroll',
  [NETWORK.gnosis]: 'Gnosis',
  [NETWORK.world]: 'World',
  [NETWORK.optimism_sepolia]: 'Optimism Sepolia',
  [NETWORK.base_sepolia]: 'Base Sepolia',
  [NETWORK.arbitrum_sepolia]: 'Arbitrum Sepolia',
  [NETWORK.scroll_sepolia]: 'Scroll Sepolia',
  [NETWORK.gnosis_chiado]: 'Gnosis Chiado'
}

export const CHAIN_ICON: Record<number, string | undefined> = {
  [NETWORK.mainnet]: mainnetIcon,
  [NETWORK.optimism]: optimismIcon,
  [NETWORK.optimism_sepolia]: optimismIcon,
  [NETWORK.arbitrum]: arbitrumIcon,
  [NETWORK.arbitrum_sepolia]: arbitrumIcon
}

export const PRIZE_POOL_BY_CHAIN: Record<
  number,
  { address: Address; prizeTokenAddress: Address } | undefined
> = {
  [NETWORK.mainnet]: {
    address: '0x7865D01da4C9BA2F69B7879e6d2483aB6B354d95',
    prizeTokenAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  },
  [NETWORK.optimism]: {
    address: '0xF35fE10ffd0a9672d0095c435fd8767A7fe29B55',
    prizeTokenAddress: '0x4200000000000000000000000000000000000006'
  },
  [NETWORK.base]: {
    address: '0x45b2010d8A4f08b53c9fa7544C51dFd9733732cb',
    prizeTokenAddress: '0x4200000000000000000000000000000000000006'
  },
  [NETWORK.arbitrum]: {
    address: '0x52E7910C4C287848C8828e8b17b8371f4Ebc5D42',
    prizeTokenAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
  },
  [NETWORK.scroll]: {
    address: '0xA6ecd65C3EECdb59C2F74956DDF251Ab5D899845',
    prizeTokenAddress: '0x5300000000000000000000000000000000000004'
  },
  [NETWORK.gnosis]: {
    address: '0x0c08c2999e1a14569554eddbcda9da5e1918120f',
    prizeTokenAddress: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d'
  },
  [NETWORK.world]: {
    address: '0x99ffb0A6c0CD543861c8dE84dd40E059FD867dcF',
    prizeTokenAddress: '0x2cFc85d8E48F8EAB294be644d9E25C3030863003'
  }
}

export const POOL_STAKING_VAULTS: Record<number, Lowercase<`0x${string}`>> = {
  [NETWORK.mainnet]: '0x9ee31e845ff1358bf6b1f914d3918c6223c75573',
  [NETWORK.optimism]: '0xa52e38a9147f5ea9e0c5547376c21c9e3f3e5e1f',
  [NETWORK.arbitrum]: '0x97a9c02cfbbf0332d8172331461ab476df1e8c95',
  [NETWORK.base]: '0x6b5a5c55e9dd4bb502ce25bbfbaa49b69cf7e4dd',
  [NETWORK.scroll]: '0x29499e2eb8ff1d076a35c275aeddd613afb1fa9b',
  [NETWORK.gnosis]: '0xb75af20ecadabed9049cc2f50e38bad2768b35cf',
  [NETWORK.world]: '0x0045cc66ecf34da9d8d89ad5b36cb82061c0907c',
  [NETWORK.optimism_sepolia]: '0xc72df1091fbc6904e580b399a45efa1943532e98',
  [NETWORK.arbitrum_sepolia]: '0xb608c0f9d37b14bdfefc654b1fc8f38b34541a01',
  [NETWORK.base_sepolia]: '0x8ec8328d3281f8275d6b44ffada9df002b928aea',
  [NETWORK.scroll_sepolia]: '0xff44f114daa9a7e75c998a2bb9a1bb55bc25240b',
  [NETWORK.gnosis_chiado]: '0x7c44c6dd009a36ef393dba89d9d1e1528648cb51'
}

export const QUERY_START_BLOCK: Record<number, bigint> = {
  [NETWORK.mainnet]: 20_564_800n,
  [NETWORK.optimism]: 118_900_000n,
  [NETWORK.arbitrum]: 216_345_400n,
  [NETWORK.base]: 14_506_800n,
  [NETWORK.scroll]: 9_181_500n,
  [NETWORK.gnosis]: 35_938_500n,
  [NETWORK.world]: 11_542_400n,
  [NETWORK.optimism_sepolia]: 22_876_300n,
  [NETWORK.arbitrum_sepolia]: 48_888_900n,
  [NETWORK.base_sepolia]: 10_578_500n,
  [NETWORK.scroll_sepolia]: 6_429_500n,
  [NETWORK.gnosis_chiado]: 11_555_000n
}

export const TWAB_REWARDS_ADDRESSES: Record<number, Address | undefined> = {
  [NETWORK.mainnet]: '0x2589ff8614f74704741ee3b51851b4ae812f1a21',
  [NETWORK.optimism]: '0x90D383dEA4dcE52D3e5D3C93dE75eF36da3Ea9Ea',
  [NETWORK.base]: '0x86f0923d20810441efc593eb0f2825c6bff2dc09',
  [NETWORK.arbitrum]: '0xe21ac38a7e80104c4f6512ce4908a22bc09c59be',
  [NETWORK.scroll]: '0x0e71a9a2bd4546e7fc2af47a015747daeb48780d',
  [NETWORK.gnosis]: '0x1742157e6ef6e0cf7e49904f2c0d0fe38a276942',
  [NETWORK.world]: '0x18e9e34cfccadcac465a8b6eaf337546b0980897',
  [NETWORK.optimism_sepolia]: '0x3FF7A54024E4db58F9682a637CeA7E72237B9e69',
  [NETWORK.arbitrum_sepolia]: '0x6f38ebc8587e2e6b2f79d9f8d045abf44a3bfd13',
  [NETWORK.base_sepolia]: '0x3af156d5eae4bb67afbe9e96e646371f7ba37d18',
  [NETWORK.scroll_sepolia]: '0xeFdFF129414E7E7eA5223c69CB71cED17F5658AC',
  [NETWORK.gnosis_chiado]: '0xcaca4272be2030ef3f06eb0d8a115e411f7db34f'
}

export const POOL_WIDE_TWAB_REWARDS_ADDRESSES: Record<number, Address | undefined> = {
  [NETWORK.mainnet]: '0x3341DAC0912B630F1A8c237b64F6861e9fa11d79',
  [NETWORK.optimism]: '0x36bE31E7acD4B0D755BCc7858ef04848A3eC66c6',
  [NETWORK.base]: '0xF4c47dacFda99bE38793181af9Fd1A2Ec7576bBF',
  [NETWORK.arbitrum]: '0x0D51a33975024E8aFc55fde9F6b070c10AA71Dd9',
  [NETWORK.scroll]: '0x0D51a33975024E8aFc55fde9F6b070c10AA71Dd9',
  [NETWORK.gnosis]: '0x0D51a33975024E8aFc55fde9F6b070c10AA71Dd9',
  [NETWORK.optimism_sepolia]: '0x1B7070eb6f871ba0d77470918502F8D788978FA3'
}

export const TWAB_REWARDS_TOKEN_ADDRESSES: Record<number, Address[] | undefined> = {
  [NETWORK.mainnet]: [
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    '0x0cEC1A9154Ff802e7934Fc916Ed7Ca50bDE6844e'
  ],
  [NETWORK.optimism]: [
    '0x4200000000000000000000000000000000000042',
    '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    '0x4200000000000000000000000000000000000006',
    '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    '0x395Ae52bB17aef68C2888d941736A71dC6d4e125'
  ],
  [NETWORK.arbitrum]: [
    '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    '0xCF934E2402A5e072928a39a956964eb8F2B5B79C',
    '0x912CE59144191C1204E64559FE8253a0e49E6548'
  ],
  [NETWORK.base]: [
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    '0x4200000000000000000000000000000000000006',
    '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
    '0xd652C5425aea2Afd5fb142e120FeCf79e18fafc3',
    '0xA88594D404727625A9437C3f886C7643872296AE',
    '0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe',
    '0x32E0f9d26D1e33625742A52620cC76C1130efde6'
  ],
  [NETWORK.scroll]: [
    '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4',
    '0x5300000000000000000000000000000000000004',
    '0xcA77eB3fEFe3725Dc33bccB54eDEFc3D9f764f97',
    '0xF9Af83FC41e0cc2af2fba93644D542Df6eA0F2b7'
  ],
  [NETWORK.gnosis]: [
    '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
    '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1',
    '0x216a7d520992eD198593A16e0b17c784c9cdc660'
  ],
  [NETWORK.world]: [
    '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1',
    '0x4200000000000000000000000000000000000006',
    '0x2cFc85d8E48F8EAB294be644d9E25C3030863003',
    '0x7077C71B4AF70737a08287E279B717Dcf64fdC57'
  ]
}
