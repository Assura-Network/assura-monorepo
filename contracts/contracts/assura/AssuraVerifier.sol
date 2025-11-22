// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IAssuraVerifier, VerifyingData} from "./IAssuraVerifier.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

struct ActualAttestedData {
    uint256 score;
    uint256 timeAtWhichAttested;
    uint256 chainId;
}

struct ComplianceData {
    address userAddress;
    bytes32 key;
    bytes signedAttestedDataWithTEESignature; // use ActualAttestedData struct to sign and decode onchain
    ActualAttestedData actualAttestedData;
}

contract AssuraVerifier is IAssuraVerifier, EIP712 {
    mapping(address appContractAddress => mapping(bytes32 key => VerifyingData))
        public verifyingData;

    address public owner;
    address public ASSURA_TEE_ADDRESS;

    // EIP-712 type hash for ActualAttestedData
    bytes32 public constant ACTUAL_ATTESTED_DATA_TYPEHASH = 
        keccak256("ActualAttestedData(uint256 score,uint256 timeAtWhichAttested,uint256 chainId)");

    constructor(address _owner, address _ASSURA_TEE_ADDRESS) 
        EIP712("AssuraVerifier", "1")
    {
        require(_owner != address(0), "Owner cannot be 0");
        owner = _owner;
        ASSURA_TEE_ADDRESS = _ASSURA_TEE_ADDRESS;
    }

    function setVerifyingData(
        address appContractAddress,
        bytes32 key,
        VerifyingData memory data
    ) external override {
        require(msg.sender == appContractAddress, "Only app contract can set its verifying data");
        verifyingData[appContractAddress][key] = data;
    }

    function getVerifyingData(
        address appContractAddress,
        bytes32 key
    ) external view override returns (VerifyingData memory) {
        return verifyingData[appContractAddress][key];
    }
    
    function verify(
        address app,
        bytes32 key,
        bytes calldata attestedComplianceData
    ) external view override returns (bool) {
        VerifyingData memory vData = verifyingData[app][key];
        
        // Check expiry (0 means no expiry)
        if (vData.expiry != 0 && vData.expiry < block.timestamp) {
            return false;
        }
        
        // Check chainId (0 means any chain)
        if (vData.chainId != 0 && vData.chainId != block.chainid) {
            return false;
        }
        
        // Decode complianceData bytes calldata to ComplianceData struct
        ComplianceData memory data = abi.decode(attestedComplianceData, (ComplianceData));
        
        // Verify the key matches
        require(data.key == key, "Key mismatch");
        
        bytes memory signature = data.signedAttestedDataWithTEESignature;
        
        // Compute hash for EIP-191 format (backward compatibility)
        bytes32 eip191Hash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(data.actualAttestedData))
            )
        );
        
        // Compute hash for EIP-712 format
        bytes32 eip712Hash = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ACTUAL_ATTESTED_DATA_TYPEHASH,
                    data.actualAttestedData.score,
                    data.actualAttestedData.timeAtWhichAttested,
                    data.actualAttestedData.chainId
                )
            )
        );
        
        // Try EIP-712 first, then fall back to EIP-191
        // SignatureChecker handles both EIP-1271 (smart contract wallets) and ECDSA (EOAs)
        bool isValid = SignatureChecker.isValidSignatureNow(
            ASSURA_TEE_ADDRESS,
            eip712Hash,
            signature
        ) || SignatureChecker.isValidSignatureNow(
            ASSURA_TEE_ADDRESS,
            eip191Hash,
            signature
        );
        
        require(isValid, "Signature not from TEE");
        
        // Check chainId from actualAttestedData (0 means any chain)
        if (vData.chainId != 0 && data.actualAttestedData.chainId != block.chainid) {
            return false;
        }
        
        // Check score requirement
        if (data.actualAttestedData.score < vData.score) {
            return false;
        }
        
        return true;
    }

    function updateAssuraTeeAddress(address _ASSURA_TEE_ADDRESS) external {
        require(msg.sender == owner, "Only owner can update ASSURA_TEE_ADDRESS");
        ASSURA_TEE_ADDRESS = _ASSURA_TEE_ADDRESS;
    }
}
