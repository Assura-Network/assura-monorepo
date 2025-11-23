# Assura Network Contracts

This directory contains the Solidity smart contracts for Assura Network.

## Structure

```
contracts/
├── assura/
│   ├── AssuraVerifier.sol          # Main verification contract
│   ├── IAssuraVerifier.sol         # Interface for AssuraVerifier
│   ├── types/
│   │   └── AssuraTypes.sol         # Type definitions
│   ├── libraries/
│   │   └── AssuraVerifierLib.sol   # Verification library
│   └── examples/
│       └── AssuraProtectedVault.sol # Example protected vault
└── account/
    └── NexusAccountDeployer.sol    # Nexus account deployer
```

## Usage

### Installation

```bash
npm install @assura-network/sdk
```

### Import Contracts

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@assura-network/sdk/contracts/assura/AssuraVerifier.sol";
import "@assura-network/sdk/contracts/assura/IAssuraVerifier.sol";
import "@assura-network/sdk/contracts/assura/types/AssuraTypes.sol";
import "@assura-network/sdk/contracts/assura/libraries/AssuraVerifierLib.sol";
```

### Example Integration

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAssuraVerifier} from "@assura-network/sdk/contracts/assura/IAssuraVerifier.sol";
import {AssuraTypes} from "@assura-network/sdk/contracts/assura/types/AssuraTypes.sol";
import {AssuraVerifierLib} from "@assura-network/sdk/contracts/assura/libraries/AssuraVerifierLib.sol";

contract MyProtectedContract {
    IAssuraVerifier public immutable assuraVerifier;
    
    constructor(address _assuraVerifier) {
        assuraVerifier = IAssuraVerifier(_assuraVerifier);
        
        // Set requirements: myFunction() requires score >= 100
        assuraVerifier.setVerifyingData(
            address(this),
            bytes32(this.myFunction.selector),
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
            bytes32(this.myFunction.selector),
            attestedData
        );
        _;
    }
    
    function myFunction(bytes calldata attestedData) 
        public 
        onlyComplianceUser(attestedData) 
    {
        // Your function logic
    }
}
```

## Contracts

### AssuraVerifier

Main contract for verifying Assura compliance attestations. Provides centralized verification system for compliance requirements.

**Key Functions:**
- `setVerifyingData()` - Set verification requirements for an app contract
- `getVerifyingData()` - Get verification requirements
- `verify()` - Verify compliance data (read-only)
- `verifyWithBypass()` - Verify compliance with automatic bypass creation

### IAssuraVerifier

Interface for AssuraVerifier contract.

### AssuraTypes

Type definitions including:
- `AttestedData` - Attested compliance data from TEE
- `VerifyingData` - Configuration for verification requirements
- `ComplianceData` - Complete compliance data structure
- `BypassData` - Bypass data for time-based access control

### AssuraVerifierLib

Library providing:
- `verifySignature()` - Verify TEE signatures
- `checkRequirements()` - Check if requirements are met
- `decodeComplianceData()` - Decode compliance data
- `requireCompliance()` - Require compliance (for modifiers)

## License

MIT

