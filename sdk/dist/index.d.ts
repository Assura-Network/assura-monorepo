import { Address, Hex, PublicClient, WalletClient } from 'viem';
import { PrivateKeyAccount } from 'viem/accounts';

/**
 * Type definitions for Assura Network SDK
 */

/**
 * Attested compliance data from TEE
 */
interface AttestedData {
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
interface VerifyingData {
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
interface ComplianceData {
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
interface BypassData {
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
interface AttestationResponse {
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

/**
 * TEE Service Client for fetching attestations
 */

/**
 * Configuration for TEE client
 */
interface TEEClientConfig {
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
declare class TEEClient {
    private axiosInstance;
    private maxRetries;
    private retryDelay;
    constructor(config?: TEEClientConfig);
    /**
     * Retry helper for handling intermittent connection issues
     */
    private retryRequest;
    /**
     * Fetch TEE address from the TEE service
     * @returns TEE wallet address
     */
    getTeeAddress(): Promise<Address>;
    /**
     * Get attestation from TEE service
     * @param userAddress User address to attest for
     * @param chainId Chain ID (optional, defaults to 84532 for Base Sepolia)
     * @param username Username for registration (optional, required for first-time users)
     * @returns Attestation data with signature
     */
    getAttestation(userAddress: Address, chainId?: number, username?: string): Promise<AttestationResponse>;
}

/**
 * Contract client utilities for interacting with AssuraVerifier
 */

/**
 * Configuration for AssuraVerifier contract
 */
interface AssuraVerifierConfig {
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
declare class AssuraVerifierClient {
    private address;
    private publicClient;
    private walletClient?;
    constructor(config: AssuraVerifierConfig);
    /**
     * Get verification requirements for an app contract
     * @param app The app contract address
     * @param key The verification key identifier
     * @returns The verification requirements
     */
    getVerifyingData(app: Address, key: Hex): Promise<VerifyingData>;
    /**
     * Set verification requirements for an app contract
     * @param app The app contract address (must be the caller)
     * @param key The verification key identifier
     * @param verifyingData The verification requirements
     * @returns Transaction hash
     */
    setVerifyingData(app: Address, key: Hex, verifyingData: VerifyingData): Promise<Hex>;
    /**
     * Verify compliance data against requirements
     * @param app The app contract address
     * @param key The verification key identifier
     * @param complianceData The compliance data to verify
     * @returns True if the compliance data meets all requirements
     */
    verify(app: Address, key: Hex, complianceData: ComplianceData): Promise<boolean>;
    /**
     * Verify compliance with automatic bypass entry creation
     * @param app The app contract address
     * @param key The verification key identifier
     * @param complianceData The compliance data to verify
     * @returns Transaction hash
     */
    verifyWithBypass(app: Address, key: Hex, complianceData: ComplianceData): Promise<Hex>;
    /**
     * Get bypass entry for a user
     * @param userAddress The user address
     * @param app The app contract address
     * @param functionSelector The function selector
     * @returns The bypass data
     */
    getBypassEntry(userAddress: Address, app: Address, functionSelector: Hex): Promise<BypassData>;
    /**
     * Get the TEE address
     * @returns The TEE address
     */
    getTeeAddress(): Promise<Address>;
}

/**
 * Encoding and decoding utilities for Assura compliance data
 */

/**
 * Encode compliance data for on-chain verification
 * @param complianceData The compliance data to encode
 * @returns Encoded hex string
 */
declare function encodeComplianceData(complianceData: ComplianceData): Hex;
/**
 * Decode compliance data from encoded bytes
 * @param encodedData The encoded compliance data
 * @returns Decoded compliance data
 */
declare function decodeComplianceData(encodedData: Hex): ComplianceData;
/**
 * Create compliance data from components
 * @param userAddress The user address
 * @param key The verification key (function selector or custom key)
 * @param signature The TEE signature
 * @param attestedData The attested data
 * @returns Compliance data ready for encoding
 */
declare function createComplianceData(userAddress: `0x${string}`, key: `0x${string}`, signature: `0x${string}`, attestedData: AttestedData): ComplianceData;

/**
 * Signature utilities for Assura attestations
 */

/**
 * EIP-712 domain for AssuraVerifier
 */
interface EIP712Domain {
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
declare function createEIP712Signature(attestedData: AttestedData, domain: EIP712Domain, signer: PrivateKeyAccount): Promise<Hex>;
/**
 * Create EIP-191 signature for AttestedData (backward compatibility)
 * @param attestedData The attested data to sign
 * @param signerPrivateKey The private key to sign with
 * @returns The signature
 */
declare function createEIP191Signature(attestedData: AttestedData, signerPrivateKey: Hex): Promise<Hex>;

/**
 * Contract ABIs for Assura Network
 */
declare const IAssuraVerifierAbi: ({
    inputs: {
        internalType: string;
        name: string;
        type: string;
    }[];
    name: string;
    outputs: {
        components: {
            internalType: string;
            name: string;
            type: string;
        }[];
        internalType: string;
        name: string;
        type: string;
    }[];
    stateMutability: string;
    type: string;
} | {
    inputs: ({
        internalType: string;
        name: string;
        type: string;
        components?: undefined;
    } | {
        components: {
            internalType: string;
            name: string;
            type: string;
        }[];
        internalType: string;
        name: string;
        type: string;
    })[];
    name: string;
    outputs: never[];
    stateMutability: string;
    type: string;
} | {
    inputs: {
        internalType: string;
        name: string;
        type: string;
    }[];
    name: string;
    outputs: {
        internalType: string;
        name: string;
        type: string;
    }[];
    stateMutability: string;
    type: string;
})[];
declare const AssuraVerifierAbi: ({
    inputs: {
        internalType: string;
        name: string;
        type: string;
    }[];
    stateMutability: string;
    type: string;
    name?: undefined;
    anonymous?: undefined;
    outputs?: undefined;
} | {
    inputs: {
        internalType: string;
        name: string;
        type: string;
    }[];
    name: string;
    type: string;
    stateMutability?: undefined;
    anonymous?: undefined;
    outputs?: undefined;
} | {
    anonymous: boolean;
    inputs: ({
        indexed: boolean;
        internalType: string;
        name: string;
        type: string;
        components?: undefined;
    } | {
        components: {
            internalType: string;
            name: string;
            type: string;
        }[];
        indexed: boolean;
        internalType: string;
        name: string;
        type: string;
    })[];
    name: string;
    type: string;
    stateMutability?: undefined;
    outputs?: undefined;
} | {
    inputs: {
        internalType: string;
        name: string;
        type: string;
    }[];
    name: string;
    outputs: {
        internalType: string;
        name: string;
        type: string;
    }[];
    stateMutability: string;
    type: string;
    anonymous?: undefined;
} | {
    inputs: {
        internalType: string;
        name: string;
        type: string;
    }[];
    name: string;
    outputs: {
        components: {
            internalType: string;
            name: string;
            type: string;
        }[];
        internalType: string;
        name: string;
        type: string;
    }[];
    stateMutability: string;
    type: string;
    anonymous?: undefined;
} | {
    inputs: ({
        internalType: string;
        name: string;
        type: string;
        components?: undefined;
    } | {
        components: {
            internalType: string;
            name: string;
            type: string;
        }[];
        internalType: string;
        name: string;
        type: string;
    })[];
    name: string;
    outputs: never[];
    stateMutability: string;
    type: string;
    anonymous?: undefined;
})[];

export { AssuraVerifierAbi, AssuraVerifierClient, type AssuraVerifierConfig, type AttestationResponse, type AttestedData, type BypassData, type ComplianceData, type EIP712Domain, IAssuraVerifierAbi, TEEClient, type TEEClientConfig, type VerifyingData, createComplianceData, createEIP191Signature, createEIP712Signature, decodeComplianceData, encodeComplianceData };
