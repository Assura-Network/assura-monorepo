# assura-sdk

TypeScript SDK and Solidity contracts for Assura Network - A compliance layer for blockchain applications.

## Installation

```bash
npm install assura-sdk
# or
pnpm add assura-sdk
# or
yarn add assura-sdk
```

## Package Contents

This package includes:

- **JavaScript SDK** (`/dist`) - TypeScript SDK for interacting with Assura
- **Solidity Contracts** (`/contracts`) - Smart contracts for integrating Assura into your dApp
- **Contract ABIs** (`/abis`) - Contract ABIs for easy integration

## Quick Links

- [JavaScript SDK Documentation](#javascript-sdk) - TypeScript SDK usage
- [Solidity Contracts Documentation](#solidity-contracts) - Smart contract integration

## Overview

Assura Network provides a simple, thin layer that sits between your application contract and your users, allowing any app to become compliance-friendly in under an hour.

This SDK provides:

- **TypeScript types** for all Assura data structures
- **TEE Client** for fetching attestations from the Assura TEE service
- **Contract Client** for interacting with AssuraVerifier contracts
- **Encoding/Decoding utilities** for compliance data
- **Signature utilities** for EIP-712 and EIP-191 signing
- **Contract ABIs** for easy integration with viem/ethers

## Quick Start

### 1. Get an Attestation from TEE Service

```typescript
import { TEEClient } from "assura-sdk";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

// Initialize TEE client
const teeClient = new TEEClient({
  baseUrl: "https://tee.assura.network", // optional, defaults to this
});

// Get attestation for a user
const userAddress = "0x..."; // User's wallet address
const attestation = await teeClient.getAttestation(userAddress, 84532); // 84532 is Base Sepolia

console.log("Score:", attestation.attestedData.score);
console.log("Signature:", attestation.signature);
```

### 2. Encode Compliance Data

```typescript
import {
  createComplianceData,
  encodeComplianceData,
} from "@assura-network/sdk";
import { getFunctionSelector } from "viem";

// Create compliance data
const functionSelector = getFunctionSelector("deposit(uint256)");
const complianceData = createComplianceData(
  userAddress,
  functionSelector,
  attestation.signature,
  {
    score: BigInt(attestation.attestedData.score),
    timeAtWhichAttested: BigInt(attestation.attestedData.timeAtWhichAttested),
    chainId: BigInt(attestation.attestedData.chainId),
  }
);

// Encode for on-chain use
const encoded = encodeComplianceData(complianceData);
```

### 3. Interact with AssuraVerifier Contract

```typescript
import { AssuraVerifierClient } from "@assura-network/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Setup clients
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const account = privateKeyToAccount("0x...");
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

// Initialize AssuraVerifier client
const verifierClient = new AssuraVerifierClient({
  address: "0x...", // AssuraVerifier contract address
  publicClient,
  walletClient,
});

// Get verification requirements
const requirements = await verifierClient.getVerifyingData(
  "0x...", // Your app contract address
  functionSelector
);

console.log("Required score:", requirements.score);

// Verify compliance (read-only)
const isValid = await verifierClient.verify(
  "0x...", // Your app contract address
  functionSelector,
  complianceData
);

// Verify with bypass (creates bypass entry if score insufficient)
const txHash = await verifierClient.verifyWithBypass(
  "0x...", // Your app contract address
  functionSelector,
  complianceData
);
```

### 4. Complete Example: Protected Function Call

```typescript
import {
  TEEClient,
  AssuraVerifierClient,
  createComplianceData,
  encodeComplianceData,
} from "@assura-network/sdk";
import { createPublicClient, createWalletClient, http, getFunctionSelector } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

async function callProtectedFunction() {
  // Setup
  const userAddress = "0x...";
  const appContractAddress = "0x...";
  const verifierAddress = "0x...";
  const functionSelector = getFunctionSelector("deposit(uint256)");

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const account = privateKeyToAccount("0x...");
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  // 1. Get attestation from TEE
  const teeClient = new TEEClient();
  const attestation = await teeClient.getAttestation(userAddress, 84532);

  // 2. Create compliance data
  const complianceData = createComplianceData(
    userAddress,
    functionSelector,
    attestation.signature as `0x${string}`,
    {
      score: BigInt(attestation.attestedData.score),
      timeAtWhichAttested: BigInt(attestation.attestedData.timeAtWhichAttested),
      chainId: BigInt(attestation.attestedData.chainId),
    }
  );

  // 3. Encode compliance data
  const encodedComplianceData = encodeComplianceData(complianceData);

  // 4. Call your protected function with compliance data
  const hash = await walletClient.writeContract({
    address: appContractAddress,
    abi: [
      {
        name: "deposit",
        type: "function",
        inputs: [
          { name: "amount", type: "uint256" },
          { name: "attestedData", type: "bytes" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
      },
    ],
    functionName: "deposit",
    args: [1000000n, encodedComplianceData],
  });

  return hash;
}
```

## API Reference

### TEEClient

Client for interacting with the Assura TEE service.

#### Constructor

```typescript
new TEEClient(config?: TEEClientConfig)
```

**Config options:**
- `baseUrl?: string` - Base URL of TEE service (default: `https://tee.assura.network`)
- `timeout?: number` - Request timeout in ms (default: 30000)
- `maxRetries?: number` - Max retry attempts (default: 3)
- `retryDelay?: number` - Delay between retries in ms (default: 1000)

#### Methods

##### `getTeeAddress(): Promise<Address>`

Fetches the TEE address from the service.

##### `getAttestation(userAddress: Address, chainId?: number, username?: string): Promise<AttestationResponse>`

Gets an attestation for a user.

- `userAddress` - The user's wallet address
- `chainId` - Chain ID (default: 84532 for Base Sepolia)
- `username` - Optional username for first-time registration

### AssuraVerifierClient

Client for interacting with AssuraVerifier contracts.

#### Constructor

```typescript
new AssuraVerifierClient(config: AssuraVerifierConfig)
```

**Config:**
- `address: Address` - AssuraVerifier contract address
- `publicClient: PublicClient` - viem public client
- `walletClient?: WalletClient` - viem wallet client (required for write operations)

#### Methods

##### `getVerifyingData(app: Address, key: Hex): Promise<VerifyingData>`

Gets verification requirements for an app contract.

##### `setVerifyingData(app: Address, key: Hex, verifyingData: VerifyingData): Promise<Hex>`

Sets verification requirements (requires wallet client).

##### `verify(app: Address, key: Hex, complianceData: ComplianceData): Promise<boolean>`

Verifies compliance data (read-only).

##### `verifyWithBypass(app: Address, key: Hex, complianceData: ComplianceData): Promise<Hex>`

Verifies compliance with automatic bypass creation (requires wallet client).

##### `getBypassEntry(userAddress: Address, app: Address, functionSelector: Hex): Promise<BypassData>`

Gets bypass entry for a user.

##### `getTeeAddress(): Promise<Address>`

Gets the TEE address from the contract.

### Utilities

#### Encoding

```typescript
encodeComplianceData(complianceData: ComplianceData): Hex
decodeComplianceData(encodedData: Hex): ComplianceData
createComplianceData(
  userAddress: Address,
  key: Hex,
  signature: Hex,
  attestedData: AttestedData
): ComplianceData
```

#### Signatures

```typescript
createEIP712Signature(
  attestedData: AttestedData,
  domain: EIP712Domain,
  signer: PrivateKeyAccount
): Promise<Hex>

createEIP191Signature(
  attestedData: AttestedData,
  signerPrivateKey: Hex
): Promise<Hex>
```

## Types

### AttestedData

```typescript
interface AttestedData {
  score: bigint; // 0-1000
  timeAtWhichAttested: bigint;
  chainId: bigint;
}
```

### VerifyingData

```typescript
interface VerifyingData {
  score: bigint; // Minimum required score
  expiry: bigint; // Expiry timestamp (0 = no expiry)
  chainId: bigint; // Required chain ID (0 = any chain)
}
```

### ComplianceData

```typescript
interface ComplianceData {
  userAddress: Address;
  key: Hex; // Function selector or custom key
  signedAttestedDataWithTEESignature: Hex;
  actualAttestedData: AttestedData;
}
```

## Contract ABIs

The SDK exports contract ABIs for easy integration:

```typescript
import { IAssuraVerifierAbi, AssuraVerifierAbi } from "assura-sdk";

// Use with viem
const contract = getContract({
  address: verifierAddress,
  abi: AssuraVerifierAbi,
  client: publicClient,
});
```

## Solidity Contracts

### Installation

The Solidity contracts are included in this package. Import them in your contracts:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "assura-sdk/contracts/assura/AssuraVerifier.sol";
import "assura-sdk/contracts/assura/IAssuraVerifier.sol";
import "assura-sdk/contracts/assura/types/AssuraTypes.sol";
import "assura-sdk/contracts/assura/libraries/AssuraVerifierLib.sol";
```

### Available Contracts

- `contracts/assura/AssuraVerifier.sol` - Main verification contract
- `contracts/assura/IAssuraVerifier.sol` - Interface
- `contracts/assura/types/AssuraTypes.sol` - Type definitions
- `contracts/assura/libraries/AssuraVerifierLib.sol` - Verification library
- `contracts/assura/examples/AssuraProtectedVault.sol` - Example implementation
- `contracts/account/NexusAccountDeployer.sol` - Nexus account deployer

See [contracts/README.md](./contracts/README.md) for detailed Solidity documentation.

### Example: Protected Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAssuraVerifier} from "assura-sdk/contracts/assura/IAssuraVerifier.sol";
import {AssuraTypes} from "assura-sdk/contracts/assura/types/AssuraTypes.sol";
import {AssuraVerifierLib} from "assura-sdk/contracts/assura/libraries/AssuraVerifierLib.sol";

contract MyProtectedContract {
    IAssuraVerifier public immutable assuraVerifier;
    
    constructor(address _assuraVerifier) {
        assuraVerifier = IAssuraVerifier(_assuraVerifier);
        
        // Set requirements: deposit() requires score >= 100
        assuraVerifier.setVerifyingData(
            address(this),
            bytes32(this.deposit.selector),
            AssuraTypes.VerifyingData({
                score: 100,
                expiry: 0,
                chainId: 0
            })
        );
    }
    
    modifier onlyComplianceUser(bytes calldata attestedData) {
        AssuraVerifierLib.requireCompliance(
            assuraVerifier,
            address(this),
            bytes32(this.deposit.selector),
            attestedData
        );
        _;
    }
    
    function deposit(uint256 amount, bytes calldata attestedData) 
        public 
        onlyComplianceUser(attestedData) 
    {
        // Your deposit logic
    }
}
```

## License

MIT

## Links

- [Documentation](https://docs.assura.network)
- [GitHub](https://github.com/assura-network/assura-monorepo)
- [Website](https://assura.network)
