import { baseSepolia } from "viem/chains";

export const currentChain = baseSepolia;

// Contract addresses (update these with your deployed contract addresses)
export const CONTRACT_ADDRESSES = {
  // AssuraVerifier deployed address
  ASSURA_VERIFIER:
    "0x0cD35Ce218e0d9eD83A5dA919d0E1CE9c60D49a7" as `0x${string}`,
  // AssuraProtectedVault deployed address
  VAULT: "0xd85eb9344c87a22615756463c27cdc3493203e80" as `0x${string}`,
} as const;

// Image paths
export const IMAGE_PATHS = {
  chains: {
    baseSepolia: "/images/chains/base.jpeg",
  },
  tokens: {
    usdc: "/images/tokens/usdc.png",
    usdt: "/images/tokens/usdt.png",
    dai: "/images/tokens/dai.png",
  },
} as const;

// Token configurations
export const TOKENS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    image: IMAGE_PATHS.tokens.usdc,
    available: true,
    // address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
    address: "0x3701d87417992dd6cb90558380a00b2df5ff59b4", // MOCK USDC
    decimals: 6,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    image: IMAGE_PATHS.tokens.usdt,
    available: false,
    comingSoon: true,
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    image: IMAGE_PATHS.tokens.dai,
    available: false,
    comingSoon: true,
  },
] as const;
