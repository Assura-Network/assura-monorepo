/**
 * Encoding and decoding utilities for Assura compliance data
 */

import { encodeAbiParameters, decodeAbiParameters, type Hex } from "viem";
import type { ComplianceData, AttestedData } from "../types";

/**
 * Encode compliance data for on-chain verification
 * @param complianceData The compliance data to encode
 * @returns Encoded hex string
 */
export function encodeComplianceData(complianceData: ComplianceData): Hex {
  return encodeAbiParameters(
    [
      {
        name: "ComplianceData",
        type: "tuple",
        components: [
          { name: "userAddress", type: "address" },
          { name: "key", type: "bytes32" },
          { name: "signedAttestedDataWithTEESignature", type: "bytes" },
          {
            name: "actualAttestedData",
            type: "tuple",
            components: [
              { name: "score", type: "uint256" },
              { name: "timeAtWhichAttested", type: "uint256" },
              { name: "chainId", type: "uint256" },
            ],
          },
        ],
      },
    ],
    [complianceData]
  );
}

/**
 * Decode compliance data from encoded bytes
 * @param encodedData The encoded compliance data
 * @returns Decoded compliance data
 */
export function decodeComplianceData(encodedData: Hex): ComplianceData {
  const decoded = decodeAbiParameters(
    [
      {
        name: "ComplianceData",
        type: "tuple",
        components: [
          { name: "userAddress", type: "address" },
          { name: "key", type: "bytes32" },
          { name: "signedAttestedDataWithTEESignature", type: "bytes" },
          {
            name: "actualAttestedData",
            type: "tuple",
            components: [
              { name: "score", type: "uint256" },
              { name: "timeAtWhichAttested", type: "uint256" },
              { name: "chainId", type: "uint256" },
            ],
          },
        ],
      },
    ],
    encodedData
  )[0] as ComplianceData;

  return decoded;
}

/**
 * Create compliance data from components
 * @param userAddress The user address
 * @param key The verification key (function selector or custom key)
 * @param signature The TEE signature
 * @param attestedData The attested data
 * @returns Compliance data ready for encoding
 */
export function createComplianceData(
  userAddress: `0x${string}`,
  key: `0x${string}`,
  signature: `0x${string}`,
  attestedData: AttestedData
): ComplianceData {
  // Ensure key is properly formatted as bytes32
  let keyStr = typeof key === "string" ? key : String(key);
  if (!keyStr.startsWith("0x")) {
    keyStr = `0x${keyStr}`;
  }
  let hexPart = keyStr.slice(2).replace(/[^0-9a-fA-F]/g, "");
  if (hexPart.length === 0) hexPart = "0";
  const paddedHex = hexPart.padStart(64, "0");
  const paddedKey = `0x${paddedHex}` as Hex;

  return {
    userAddress: userAddress as `0x${string}`,
    key: paddedKey,
    signedAttestedDataWithTEESignature: signature,
    actualAttestedData: attestedData,
  };
}

