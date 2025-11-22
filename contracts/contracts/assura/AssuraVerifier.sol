// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IAssuraVerifier, VerifyingData} from "./IAssuraVerifier.sol";

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

contract AssuraVerifier is IAssuraVerifier {
    mapping(address appContractAddress => mapping(bytes32 key => VerifyingData))
        public verifyingData;

    address public owner;
    address public ASSURA_TEE_ADDRESS;

    constructor(address _owner, address _ASSURA_TEE_ADDRESS) {
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
        
        // Verify TEE signature
        bytes32 hash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(data.actualAttestedData))
            )
        );
        
        bytes memory signature = data.signedAttestedDataWithTEESignature;
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        // Extract r, s, v from signature bytes
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        // Recover signer from signature
        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0), "Invalid signature");
        require(signer == ASSURA_TEE_ADDRESS, "Signature not from TEE");
        
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
