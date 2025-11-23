/**
 * Signature utilities for Assura attestations
 */

import {
  keccak256,
  encodeAbiParameters,
  hexToBytes,
  toBytes,
  serializeSignature,
  type Hex,
} from "viem";
import { signTypedData, sign, type PrivateKeyAccount } from "viem/accounts";
import type { AttestedData } from "../types";

/**
 * EIP-712 domain for AssuraVerifier
 */
export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: `0x${string}`;
}

/**
 * Create EIP-712 signature for AttestedData
 * @param attestedData The attested data to sign
 * @param domain The EIP-712 domain
 * @param signer The account to sign with
 * @returns The signature
 */
export async function createEIP712Signature(
  attestedData: AttestedData,
  domain: EIP712Domain,
  signer: PrivateKeyAccount
): Promise<Hex> {
  const types = {
    AttestedData: [
      { name: "score", type: "uint256" },
      { name: "timeAtWhichAttested", type: "uint256" },
      { name: "chainId", type: "uint256" },
    ],
  };

  const signature = await signer.signTypedData({
    domain,
    types,
    primaryType: "AttestedData",
    message: {
      score: attestedData.score,
      timeAtWhichAttested: attestedData.timeAtWhichAttested,
      chainId: attestedData.chainId,
    },
  });

  return signature;
}

/**
 * Create EIP-191 signature for AttestedData (backward compatibility)
 * @param attestedData The attested data to sign
 * @param signerPrivateKey The private key to sign with
 * @returns The signature
 */
export async function createEIP191Signature(
  attestedData: AttestedData,
  signerPrivateKey: Hex
): Promise<Hex> {
  const encodedData = encodeAbiParameters(
    [
      { name: "score", type: "uint256" },
      { name: "timeAtWhichAttested", type: "uint256" },
      { name: "chainId", type: "uint256" },
    ],
    [attestedData.score, attestedData.timeAtWhichAttested, attestedData.chainId]
  );

  const dataHash = keccak256(encodedData);
  const messagePrefix = "\x19Ethereum Signed Message:\n32";
  const messageBytes = new Uint8Array(
    messagePrefix.length + hexToBytes(dataHash).length
  );
  messageBytes.set(toBytes(messagePrefix), 0);
  messageBytes.set(hexToBytes(dataHash), messagePrefix.length);

  const messageHash = keccak256(messageBytes);
  const signature = await sign({
    hash: messageHash,
    privateKey: signerPrivateKey,
  });

  return serializeSignature(signature);
}

