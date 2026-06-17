import { parseAbi } from 'viem'

export const vaultAbi = parseAbi([
  'function asset() view returns (address)',
  'function balanceOf(address account) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function deposit(uint256 assets, address receiver) returns (uint256 shares)',
  'function maxWithdraw(address owner) view returns (uint256)',
  'function prizePool() view returns (address)',
  'function totalAssets() view returns (uint256)',
  'function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)',
  'function withdraw(uint256 assets, address receiver, address owner, uint256 maxShares) returns (uint256 shares)'
])

export const erc20Abi = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
])

export const prizePoolAbi = parseAbi([
  'function drawPeriodSeconds() view returns (uint48)',
  'function getTierAccrualDurationInDraws(uint8 tier) view returns (uint24)',
  'function getTierPrizeSize(uint8 tier) view returns (uint104)',
  'function numberOfTiers() view returns (uint8)',
  'function prizeToken() view returns (address)'
])

export const twabRewardsAbi = parseAbi([
  'function claimRewards(address user, uint256 promotionId, uint8[] epochIds) returns (uint256)',
  'function getPromotion(uint256 promotionId) view returns ((address creator, uint64 startTimestamp, uint8 numberOfEpochs, address vault, uint48 epochDuration, uint48 createdAt, address token, uint256 tokensPerEpoch, uint256 rewardsUnclaimed))',
  'function getRewardsAmount(address user, uint256 promotionId, uint8[] epochIds) view returns (uint256[])',
  'function multicall(bytes[] data) returns (bytes[] results)'
])

export const poolWideTwabRewardsAbi = parseAbi([
  'function calculateRewards(address vault, address user, uint256 promotionId, uint8[] epochIds) returns (uint256[] rewards)',
  'function claimedEpochs(uint256 promotionId, address vault, address user) view returns (bytes32 claimMask)',
  'function claimRewards(address vault, address user, uint256 promotionId, uint8[] epochIds) returns (uint256)',
  'function claimTwabRewards(address twabRewards, address user, uint256 promotionId, uint8[] epochIds) returns (uint256)',
  'function getPromotion(uint256 promotionId) view returns ((address token, uint40 epochDuration, uint40 createdAt, uint8 numberOfEpochs, uint40 startTimestamp, uint104 tokensPerEpoch, uint112 rewardsUnclaimed))',
  'function latestPromotionId() view returns (uint256)',
  'function multicall(bytes[] data) returns (bytes[] results)'
])

export const ammFactoryAbi = parseAbi([
  'function getPool(address tokenA, address tokenB, bool stable) view returns (address)'
])

export const ammPoolAbi = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast)',
  'function totalSupply() view returns (uint256)'
])
