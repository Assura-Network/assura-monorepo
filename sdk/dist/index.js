'use strict';

var axios = require('axios');
var viem = require('viem');
var accounts = require('viem/accounts');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var axios__default = /*#__PURE__*/_interopDefault(axios);

// src/client/tee-client.ts
var TEEClient = class {
  constructor(config = {}) {
    const baseURL = config.baseUrl || process.env.TEE_SERVICE_URL || "https://tee.assura.network";
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 1e3;
    this.axiosInstance = axios__default.default.create({
      baseURL,
      timeout: config.timeout ?? 3e4,
      headers: {
        Connection: "close"
      }
    });
  }
  /**
   * Retry helper for handling intermittent connection issues
   */
  async retryRequest(fn, maxRetries, delay) {
    const retries = maxRetries ?? this.maxRetries;
    const retryDelay = delay ?? this.retryDelay;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
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
  async getTeeAddress() {
    try {
      const response = await this.retryRequest(async () => {
        return await this.axiosInstance.get("/address");
      });
      if (!response.data || !response.data.address) {
        throw new Error("Invalid response from TEE service");
      }
      return response.data.address;
    } catch (error) {
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
  async getAttestation(userAddress, chainId, username) {
    try {
      const requestBody = {
        userAddress,
        chainId: chainId ?? 84532
      };
      if (username) requestBody.username = username;
      const response = await this.retryRequest(async () => {
        return await this.axiosInstance.post("/attest", requestBody);
      });
      if (!response.data || !response.data.attestedData || !response.data.signature) {
        throw new Error("Invalid response from TEE service");
      }
      return response.data;
    } catch (error) {
      if (error.code === "ECONNREFUSED") {
        throw new Error(
          `Cannot connect to TEE service at ${this.axiosInstance.defaults.baseURL}. Make sure the TEE service is running.`
        );
      }
      if (error.response?.status === 403 && error.response?.data?.requiresRegistration) {
        throw new Error(
          `User not registered. Please provide a username to register first. Call getAttestation with username parameter.`
        );
      }
      if (error.response?.status === 409 && username) {
        console.log(`\u2139\uFE0F  User already registered, fetching existing profile...`);
        const retryResponse = await this.retryRequest(async () => {
          return await this.axiosInstance.post("/attest", {
            userAddress,
            chainId: chainId ?? 84532
          });
        });
        if (!retryResponse.data || !retryResponse.data.attestedData || !retryResponse.data.signature) {
          throw new Error("Invalid response from TEE service");
        }
        return retryResponse.data;
      }
      throw new Error(`Failed to get attestation: ${error.message}`);
    }
  }
};
function encodeComplianceData(complianceData) {
  return viem.encodeAbiParameters(
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
              { name: "chainId", type: "uint256" }
            ]
          }
        ]
      }
    ],
    [complianceData]
  );
}
function decodeComplianceData(encodedData) {
  const decoded = viem.decodeAbiParameters(
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
              { name: "chainId", type: "uint256" }
            ]
          }
        ]
      }
    ],
    encodedData
  )[0];
  return decoded;
}
function createComplianceData(userAddress, key, signature, attestedData) {
  let keyStr = typeof key === "string" ? key : String(key);
  if (!keyStr.startsWith("0x")) {
    keyStr = `0x${keyStr}`;
  }
  let hexPart = keyStr.slice(2).replace(/[^0-9a-fA-F]/g, "");
  if (hexPart.length === 0) hexPart = "0";
  const paddedHex = hexPart.padStart(64, "0");
  const paddedKey = `0x${paddedHex}`;
  return {
    userAddress,
    key: paddedKey,
    signedAttestedDataWithTEESignature: signature,
    actualAttestedData: attestedData
  };
}

// src/abis/IAssuraVerifier.json
var IAssuraVerifier_default = {
  abi: [
    {
      inputs: [
        {
          internalType: "address",
          name: "app",
          type: "address"
        },
        {
          internalType: "bytes32",
          name: "key",
          type: "bytes32"
        }
      ],
      name: "getVerifyingData",
      outputs: [
        {
          components: [
            {
              internalType: "uint256",
              name: "score",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "expiry",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "chainId",
              type: "uint256"
            }
          ],
          internalType: "struct AssuraTypes.VerifyingData",
          name: "",
          type: "tuple"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "app",
          type: "address"
        },
        {
          internalType: "bytes32",
          name: "key",
          type: "bytes32"
        },
        {
          components: [
            {
              internalType: "uint256",
              name: "score",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "expiry",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "chainId",
              type: "uint256"
            }
          ],
          internalType: "struct AssuraTypes.VerifyingData",
          name: "verifyingData",
          type: "tuple"
        }
      ],
      name: "setVerifyingData",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "app",
          type: "address"
        },
        {
          internalType: "bytes32",
          name: "key",
          type: "bytes32"
        },
        {
          internalType: "bytes",
          name: "attestedComplianceData",
          type: "bytes"
        }
      ],
      name: "verify",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "app",
          type: "address"
        },
        {
          internalType: "bytes32",
          name: "key",
          type: "bytes32"
        },
        {
          internalType: "bytes",
          name: "attestedComplianceData",
          type: "bytes"
        }
      ],
      name: "verifyWithBypass",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    }
  ]};

// src/abis/AssuraVerifier.json
var AssuraVerifier_default = {
  abi: [
    {
      inputs: [
        {
          internalType: "address",
          name: "_owner",
          type: "address"
        },
        {
          internalType: "address",
          name: "_ASSURA_TEE_ADDRESS",
          type: "address"
        }
      ],
      stateMutability: "nonpayable",
      type: "constructor"
    },
    {
      inputs: [],
      name: "InvalidShortString",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        }
      ],
      name: "OwnableInvalidOwner",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "account",
          type: "address"
        }
      ],
      name: "OwnableUnauthorizedAccount",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "string",
          name: "str",
          type: "string"
        }
      ],
      name: "StringTooLong",
      type: "error"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address",
          name: "oldAddress",
          type: "address"
        },
        {
          indexed: false,
          internalType: "address",
          name: "newAddress",
          type: "address"
        }
      ],
      name: "AssuraTeeAddressUpdated",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "userAddress",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "appContractAddress",
          type: "address"
        },
        {
          indexed: true,
          internalType: "bytes32",
          name: "functionSelector",
          type: "bytes32"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "expiry",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "nonce",
          type: "uint256"
        }
      ],
      name: "BypassEntryCreated",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [],
      name: "EIP712DomainChanged",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "userAddress",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "nexusAccount",
          type: "address"
        },
        {
          indexed: false,
          internalType: "bytes32",
          name: "salt",
          type: "bytes32"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "expiry",
          type: "uint256"
        }
      ],
      name: "NexusAccountDeployedOnBypass",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address",
          name: "oldAddress",
          type: "address"
        },
        {
          indexed: false,
          internalType: "address",
          name: "newAddress",
          type: "address"
        }
      ],
      name: "NexusAccountDeployerUpdated",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "previousOwner",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "newOwner",
          type: "address"
        }
      ],
      name: "OwnershipTransferred",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "appContractAddress",
          type: "address"
        },
        {
          indexed: true,
          internalType: "bytes32",
          name: "key",
          type: "bytes32"
        },
        {
          components: [
            {
              internalType: "uint256",
              name: "score",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "expiry",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "chainId",
              type: "uint256"
            }
          ],
          indexed: false,
          internalType: "struct AssuraTypes.VerifyingData",
          name: "verifyingData",
          type: "tuple"
        }
      ],
      name: "VerifyingDataSet",
      type: "event"
    },
    {
      inputs: [],
      name: "ASSURA_TEE_ADDRESS",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "userAddress",
          type: "address"
        },
        {
          internalType: "address",
          name: "appContractAddress",
          type: "address"
        },
        {
          internalType: "bytes32",
          name: "functionSelector",
          type: "bytes32"
        }
      ],
      name: "bypassEntries",
      outputs: [
        {
          internalType: "uint256",
          name: "expiry",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "nonce",
          type: "uint256"
        },
        {
          internalType: "bool",
          name: "allowed",
          type: "bool"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "eip712Domain",
      outputs: [
        {
          internalType: "bytes1",
          name: "fields",
          type: "bytes1"
        },
        {
          internalType: "string",
          name: "name",
          type: "string"
        },
        {
          internalType: "string",
          name: "version",
          type: "string"
        },
        {
          internalType: "uint256",
          name: "chainId",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "verifyingContract",
          type: "address"
        },
        {
          internalType: "bytes32",
          name: "salt",
          type: "bytes32"
        },
        {
          internalType: "uint256[]",
          name: "extensions",
          type: "uint256[]"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "getNexusAccountDeployer",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "appContractAddress",
          type: "address"
        },
        {
          internalType: "bytes32",
          name: "key",
          type: "bytes32"
        }
      ],
      name: "getVerifyingData",
      outputs: [
        {
          components: [
            {
              internalType: "uint256",
              name: "score",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "expiry",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "chainId",
              type: "uint256"
            }
          ],
          internalType: "struct AssuraTypes.VerifyingData",
          name: "",
          type: "tuple"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "nexusAccountDeployer",
      outputs: [
        {
          internalType: "contract INexusAccountDeployer",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "owner",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "renounceOwnership",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "appContractAddress",
          type: "address"
        },
        {
          internalType: "bytes32",
          name: "key",
          type: "bytes32"
        },
        {
          components: [
            {
              internalType: "uint256",
              name: "score",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "expiry",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "chainId",
              type: "uint256"
            }
          ],
          internalType: "struct AssuraTypes.VerifyingData",
          name: "data",
          type: "tuple"
        }
      ],
      name: "setVerifyingData",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "newOwner",
          type: "address"
        }
      ],
      name: "transferOwnership",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "_ASSURA_TEE_ADDRESS",
          type: "address"
        }
      ],
      name: "updateAssuraTeeAddress",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "_nexusAccountDeployer",
          type: "address"
        }
      ],
      name: "updateNexusAccountDeployer",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "app",
          type: "address"
        },
        {
          internalType: "bytes32",
          name: "key",
          type: "bytes32"
        },
        {
          internalType: "bytes",
          name: "attestedComplianceData",
          type: "bytes"
        }
      ],
      name: "verify",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "app",
          type: "address"
        },
        {
          internalType: "bytes32",
          name: "key",
          type: "bytes32"
        },
        {
          internalType: "bytes",
          name: "attestedComplianceData",
          type: "bytes"
        }
      ],
      name: "verifyWithBypass",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "appContractAddress",
          type: "address"
        },
        {
          internalType: "bytes32",
          name: "key",
          type: "bytes32"
        }
      ],
      name: "verifyingData",
      outputs: [
        {
          internalType: "uint256",
          name: "score",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "expiry",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "chainId",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    }
  ]};

// src/abis/index.ts
var IAssuraVerifierAbi = IAssuraVerifier_default.abi;
var AssuraVerifierAbi = AssuraVerifier_default.abi;

// src/client/contract-client.ts
var AssuraVerifierClient = class {
  constructor(config) {
    this.address = viem.getAddress(config.address);
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
  }
  /**
   * Get verification requirements for an app contract
   * @param app The app contract address
   * @param key The verification key identifier
   * @returns The verification requirements
   */
  async getVerifyingData(app, key) {
    const result = await this.publicClient.readContract({
      address: this.address,
      abi: IAssuraVerifierAbi,
      functionName: "getVerifyingData",
      args: [viem.getAddress(app), key]
    });
    return {
      score: result.score,
      expiry: result.expiry,
      chainId: result.chainId
    };
  }
  /**
   * Set verification requirements for an app contract
   * @param app The app contract address (must be the caller)
   * @param key The verification key identifier
   * @param verifyingData The verification requirements
   * @returns Transaction hash
   */
  async setVerifyingData(app, key, verifyingData) {
    if (!this.walletClient) {
      throw new Error("Wallet client is required for write operations");
    }
    const hash = await this.walletClient.writeContract({
      address: this.address,
      abi: IAssuraVerifierAbi,
      functionName: "setVerifyingData",
      args: [
        viem.getAddress(app),
        key,
        {
          score: verifyingData.score,
          expiry: verifyingData.expiry,
          chainId: verifyingData.chainId
        }
      ]
    });
    return hash;
  }
  /**
   * Verify compliance data against requirements
   * @param app The app contract address
   * @param key The verification key identifier
   * @param complianceData The compliance data to verify
   * @returns True if the compliance data meets all requirements
   */
  async verify(app, key, complianceData) {
    const encoded = encodeComplianceData(complianceData);
    const result = await this.publicClient.readContract({
      address: this.address,
      abi: IAssuraVerifierAbi,
      functionName: "verify",
      args: [viem.getAddress(app), key, encoded]
    });
    return result;
  }
  /**
   * Verify compliance with automatic bypass entry creation
   * @param app The app contract address
   * @param key The verification key identifier
   * @param complianceData The compliance data to verify
   * @returns Transaction hash
   */
  async verifyWithBypass(app, key, complianceData) {
    if (!this.walletClient) {
      throw new Error("Wallet client is required for write operations");
    }
    const encoded = encodeComplianceData(complianceData);
    const hash = await this.walletClient.writeContract({
      address: this.address,
      abi: IAssuraVerifierAbi,
      functionName: "verifyWithBypass",
      args: [viem.getAddress(app), key, encoded]
    });
    return hash;
  }
  /**
   * Get bypass entry for a user
   * @param userAddress The user address
   * @param app The app contract address
   * @param functionSelector The function selector
   * @returns The bypass data
   */
  async getBypassEntry(userAddress, app, functionSelector) {
    const result = await this.publicClient.readContract({
      address: this.address,
      abi: IAssuraVerifierAbi,
      functionName: "bypassEntries",
      args: [viem.getAddress(userAddress), viem.getAddress(app), functionSelector]
    });
    return {
      expiry: result.expiry,
      nonce: result.nonce,
      allowed: result.allowed
    };
  }
  /**
   * Get the TEE address
   * @returns The TEE address
   */
  async getTeeAddress() {
    const result = await this.publicClient.readContract({
      address: this.address,
      abi: IAssuraVerifierAbi,
      functionName: "ASSURA_TEE_ADDRESS"
    });
    return viem.getAddress(result);
  }
};
async function createEIP712Signature(attestedData, domain, signer) {
  const types = {
    AttestedData: [
      { name: "score", type: "uint256" },
      { name: "timeAtWhichAttested", type: "uint256" },
      { name: "chainId", type: "uint256" }
    ]
  };
  const signature = await signer.signTypedData({
    domain,
    types,
    primaryType: "AttestedData",
    message: {
      score: attestedData.score,
      timeAtWhichAttested: attestedData.timeAtWhichAttested,
      chainId: attestedData.chainId
    }
  });
  return signature;
}
async function createEIP191Signature(attestedData, signerPrivateKey) {
  const encodedData = viem.encodeAbiParameters(
    [
      { name: "score", type: "uint256" },
      { name: "timeAtWhichAttested", type: "uint256" },
      { name: "chainId", type: "uint256" }
    ],
    [attestedData.score, attestedData.timeAtWhichAttested, attestedData.chainId]
  );
  const dataHash = viem.keccak256(encodedData);
  const messagePrefix = "Ethereum Signed Message:\n32";
  const messageBytes = new Uint8Array(
    messagePrefix.length + viem.hexToBytes(dataHash).length
  );
  messageBytes.set(viem.toBytes(messagePrefix), 0);
  messageBytes.set(viem.hexToBytes(dataHash), messagePrefix.length);
  const messageHash = viem.keccak256(messageBytes);
  const signature = await accounts.sign({
    hash: messageHash,
    privateKey: signerPrivateKey
  });
  return viem.serializeSignature(signature);
}

exports.AssuraVerifierAbi = AssuraVerifierAbi;
exports.AssuraVerifierClient = AssuraVerifierClient;
exports.IAssuraVerifierAbi = IAssuraVerifierAbi;
exports.TEEClient = TEEClient;
exports.createComplianceData = createComplianceData;
exports.createEIP191Signature = createEIP191Signature;
exports.createEIP712Signature = createEIP712Signature;
exports.decodeComplianceData = decodeComplianceData;
exports.encodeComplianceData = encodeComplianceData;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map