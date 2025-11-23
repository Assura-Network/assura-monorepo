/**
 * Contract client utilities for interacting with AssuraVerifier
 */

import {
  type Address,
  type PublicClient,
  type WalletClient,
  type Hex,
  getAddress,
} from "viem";
import type { VerifyingData, BypassData, ComplianceData } from "../types";
import { encodeComplianceData } from "../utils/encoding";
import { IAssuraVerifierAbi } from "../abis";

/**
 * Configuration for AssuraVerifier contract
 */
export interface AssuraVerifierConfig {
  /** Address of the AssuraVerifier contract */
  address: Address;
  /** Public client for read operations */
  publicClient: PublicClient;
  /** Wallet client for write operations (optional) */
  walletClient?: WalletClient;
}

/**
 * Client for interacting with AssuraVerifier contract
 */
export class AssuraVerifierClient {
  private address: Address;
  private publicClient: PublicClient;
  private walletClient?: WalletClient;

  constructor(config: AssuraVerifierConfig) {
    this.address = getAddress(config.address);
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
  }

  /**
   * Get verification requirements for an app contract
   * @param app The app contract address
   * @param key The verification key identifier
   * @returns The verification requirements
   */
  async getVerifyingData(
    app: Address,
    key: Hex
  ): Promise<VerifyingData> {
    const result = (await this.publicClient.readContract({
      address: this.address,
      abi: IAssuraVerifierAbi,
      functionName: "getVerifyingData",
      args: [getAddress(app), key],
    })) as unknown as { score: bigint; expiry: bigint; chainId: bigint };

    return {
      score: result.score,
      expiry: result.expiry,
      chainId: result.chainId,
    };
  }

  /**
   * Set verification requirements for an app contract
   * @param app The app contract address (must be the caller)
   * @param key The verification key identifier
   * @param verifyingData The verification requirements
   * @returns Transaction hash
   */
  async setVerifyingData(
    app: Address,
    key: Hex,
    verifyingData: VerifyingData
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client is required for write operations");
    }

    const hash = await this.walletClient.writeContract({
      address: this.address,
      abi: IAssuraVerifierAbi,
      functionName: "setVerifyingData",
      args: [
        getAddress(app),
        key,
        {
          score: verifyingData.score,
          expiry: verifyingData.expiry,
          chainId: verifyingData.chainId,
        },
      ],
    } as any);

    return hash;
  }

  /**
   * Verify compliance data against requirements
   * @param app The app contract address
   * @param key The verification key identifier
   * @param complianceData The compliance data to verify
   * @returns True if the compliance data meets all requirements
   */
  async verify(
    app: Address,
    key: Hex,
    complianceData: ComplianceData
  ): Promise<boolean> {
    const encoded = encodeComplianceData(complianceData);

    const result = await this.publicClient.readContract({
      address: this.address,
      abi: IAssuraVerifierAbi,
      functionName: "verify",
      args: [getAddress(app), key, encoded],
    });

    return result as boolean;
  }

  /**
   * Verify compliance with automatic bypass entry creation
   * @param app The app contract address
   * @param key The verification key identifier
   * @param complianceData The compliance data to verify
   * @returns Transaction hash
   */
  async verifyWithBypass(
    app: Address,
    key: Hex,
    complianceData: ComplianceData
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client is required for write operations");
    }

    const encoded = encodeComplianceData(complianceData);

    const hash = await this.walletClient.writeContract({
      address: this.address,
      abi: IAssuraVerifierAbi,
      functionName: "verifyWithBypass",
      args: [getAddress(app), key, encoded],
    } as any);

    return hash;
  }

  /**
   * Get bypass entry for a user
   * @param userAddress The user address
   * @param app The app contract address
   * @param functionSelector The function selector
   * @returns The bypass data
   */
  async getBypassEntry(
    userAddress: Address,
    app: Address,
    functionSelector: Hex
  ): Promise<BypassData> {
    const result = (await this.publicClient.readContract({
      address: this.address,
      abi: IAssuraVerifierAbi,
      functionName: "bypassEntries",
      args: [getAddress(userAddress), getAddress(app), functionSelector],
    })) as unknown as { expiry: bigint; nonce: bigint; allowed: boolean };

    return {
      expiry: result.expiry,
      nonce: result.nonce,
      allowed: result.allowed,
    };
  }

  /**
   * Get the TEE address
   * @returns The TEE address
   */
  async getTeeAddress(): Promise<Address> {
    const result = await this.publicClient.readContract({
      address: this.address,
      abi: IAssuraVerifierAbi,
      functionName: "ASSURA_TEE_ADDRESS",
    });

    return getAddress(result as Address);
  }
}

