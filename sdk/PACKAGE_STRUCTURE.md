# Package Structure

This package includes both JavaScript SDK and Solidity contracts for Assura Network.

## Directory Structure

```
@assura-network/sdk/
├── dist/                    # Compiled JavaScript SDK (CJS + ESM + Types)
│   ├── index.js            # CommonJS entry point
│   ├── index.mjs           # ES Module entry point
│   ├── index.d.ts          # TypeScript declarations
│   └── abis/               # Contract ABIs
├── contracts/              # Solidity contracts
│   ├── assura/
│   │   ├── AssuraVerifier.sol
│   │   ├── IAssuraVerifier.sol
│   │   ├── types/
│   │   │   └── AssuraTypes.sol
│   │   ├── libraries/
│   │   │   └── AssuraVerifierLib.sol
│   │   └── examples/
│   │       └── AssuraProtectedVault.sol
│   └── account/
│       └── NexusAccountDeployer.sol
├── package.json
├── README.md
└── LICENSE
```

## Usage

### JavaScript SDK

```typescript
import { TEEClient, AssuraVerifierClient } from "@assura-network/sdk";
```

### Solidity Contracts

```solidity
import "@assura-network/sdk/contracts/assura/AssuraVerifier.sol";
import "@assura-network/sdk/contracts/assura/IAssuraVerifier.sol";
import "@assura-network/sdk/contracts/assura/types/AssuraTypes.sol";
import "@assura-network/sdk/contracts/assura/libraries/AssuraVerifierLib.sol";
```

### Contract ABIs

```typescript
import { AssuraVerifierAbi } from "@assura-network/sdk/abis";
```

## Exports

The package exports:

- `.` - Main JavaScript SDK
- `./abis` - Contract ABIs
- `./contracts` - Solidity contracts directory

