/**
 * @assura-network/sdk
 * 
 * TypeScript SDK for Assura Network - A compliance layer for blockchain applications
 * 
 * @packageDocumentation
 */

// Types
export type {
  AttestedData,
  VerifyingData,
  ComplianceData,
  BypassData,
  AttestationResponse,
} from "./types";

// Clients
export { TEEClient } from "./client/tee-client";
export type { TEEClientConfig } from "./client/tee-client";

export { AssuraVerifierClient } from "./client/contract-client";
export type { AssuraVerifierConfig } from "./client/contract-client";

// Utilities
export {
  encodeComplianceData,
  decodeComplianceData,
  createComplianceData,
} from "./utils/encoding";

export {
  createEIP712Signature,
  createEIP191Signature,
} from "./utils/signatures";
export type { EIP712Domain } from "./utils/signatures";

// ABIs
export { IAssuraVerifierAbi, AssuraVerifierAbi } from "./abis";

