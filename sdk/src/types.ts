/**
 * Type definitions for Assura Network SDK
 */

import type { Address, Hex } from "viem";

/**
 * Attested compliance data from TEE
 */
export interface AttestedData {
  /** The confidence score (0-1000) */
  score: bigint;
  /** Timestamp when the attestation was created */
  timeAtWhichAttested: bigint;
  /** The chain ID where the attestation is valid */
  chainId: bigint;
}

/**
 * Configuration data for verifying compliance requirements
 */
export interface VerifyingData {
  /** Minimum required confidence score */
  score: bigint;
  /** Expiry timestamp (0 means no expiry) */
  expiry: bigint;
  /** Required chain ID (0 means any chain) */
  chainId: bigint;
}

/**
 * Complete compliance data structure for verification
 */
export interface ComplianceData {
  /** The address being verified */
  userAddress: Address;
  /** The verification key identifier */
  key: Hex;
  /** The signed attestation data from TEE */
  signedAttestedDataWithTEESignature: Hex;
  /** The decoded attested data */
  actualAttestedData: AttestedData;
}

/**
 * Bypass data structure for time-based access control
 */
export interface BypassData {
  /** Timestamp when the bypass expires and user can access */
  expiry: bigint;
  /** Nonce for replay protection */
  nonce: bigint;
  /** Always set to true when creation */
  allowed: boolean;
}

/**
 * Response from TEE service when getting attestation
 */
export interface AttestationResponse {
  attestedData: {
    score: string;
    timeAtWhichAttested: string;
    chainId: string;
  };
  signature: string;
  teeAddress: string;
  userAddress: string;
  registration?: {
    success: boolean;
    username: string;
    ensFullName: string;
    eKYC: boolean;
    aKYC: boolean;
  };
  profile?: any;
}

