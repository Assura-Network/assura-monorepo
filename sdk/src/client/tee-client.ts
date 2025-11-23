/**
 * TEE Service Client for fetching attestations
 */

import axios, { AxiosInstance } from "axios";
import type { Address } from "viem";
import type { AttestationResponse } from "../types";

/**
 * Configuration for TEE client
 */
export interface TEEClientConfig {
  /** Base URL of the TEE service */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum number of retries */
  maxRetries?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
}

/**
 * Client for interacting with Assura TEE service
 */
export class TEEClient {
  private axiosInstance: AxiosInstance;
  private maxRetries: number;
  private retryDelay: number;

  constructor(config: TEEClientConfig = {}) {
    const baseURL =
      config.baseUrl ||
      process.env.TEE_SERVICE_URL ||
      "https://tee.assura.network";

    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;

    this.axiosInstance = axios.create({
      baseURL,
      timeout: config.timeout ?? 30000,
      headers: {
        Connection: "close",
      },
    });
  }

  /**
   * Retry helper for handling intermittent connection issues
   */
  private async retryRequest<T>(
    fn: () => Promise<T>,
    maxRetries?: number,
    delay?: number
  ): Promise<T> {
    const retries = maxRetries ?? this.maxRetries;
    const retryDelay = delay ?? this.retryDelay;

    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        if (i === retries - 1) throw error;
        console.log(`Retry ${i + 1}/${retries} after ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
    throw new Error("Max retries exceeded");
  }

  /**
   * Fetch TEE address from the TEE service
   * @returns TEE wallet address
   */
  async getTeeAddress(): Promise<Address> {
    try {
      const response = await this.retryRequest(async () => {
        return await this.axiosInstance.get("/address");
      });

      if (!response.data || !response.data.address) {
        throw new Error("Invalid response from TEE service");
      }

      return response.data.address as Address;
    } catch (error: any) {
      if (error.code === "ECONNREFUSED") {
        throw new Error(
          `Cannot connect to TEE service at ${this.axiosInstance.defaults.baseURL}. Make sure the TEE service is running.`
        );
      }
      throw new Error(`Failed to fetch TEE address: ${error.message}`);
    }
  }

  /**
   * Get attestation from TEE service
   * @param userAddress User address to attest for
   * @param chainId Chain ID (optional, defaults to 84532 for Base Sepolia)
   * @param username Username for registration (optional, required for first-time users)
   * @returns Attestation data with signature
   */
  async getAttestation(
    userAddress: Address,
    chainId?: number,
    username?: string
  ): Promise<AttestationResponse> {
    try {
      const requestBody: any = {
        userAddress,
        chainId: chainId ?? 84532,
      };

      // Add optional username for registration
      if (username) requestBody.username = username;

      const response = await this.retryRequest(async () => {
        return await this.axiosInstance.post("/attest", requestBody);
      });

      if (
        !response.data ||
        !response.data.attestedData ||
        !response.data.signature
      ) {
        throw new Error("Invalid response from TEE service");
      }

      return response.data;
    } catch (error: any) {
      if (error.code === "ECONNREFUSED") {
        throw new Error(
          `Cannot connect to TEE service at ${this.axiosInstance.defaults.baseURL}. Make sure the TEE service is running.`
        );
      }

      // Handle registration required error
      if (
        error.response?.status === 403 &&
        error.response?.data?.requiresRegistration
      ) {
        throw new Error(
          `User not registered. Please provide a username to register first. Call getAttestation with username parameter.`
        );
      }

      // Handle 409 Conflict - user already registered
      if (error.response?.status === 409 && username) {
        console.log(`ℹ️  User already registered, fetching existing profile...`);
        // Retry without username to get existing profile
        const retryResponse = await this.retryRequest(async () => {
          return await this.axiosInstance.post("/attest", {
            userAddress,
            chainId: chainId ?? 84532,
          });
        });

        if (
          !retryResponse.data ||
          !retryResponse.data.attestedData ||
          !retryResponse.data.signature
        ) {
          throw new Error("Invalid response from TEE service");
        }

        return retryResponse.data;
      }

      throw new Error(`Failed to get attestation: ${error.message}`);
    }
  }
}

