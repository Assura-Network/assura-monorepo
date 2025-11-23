import { encodeAbiParameters, type Hex } from 'viem';

/**
 * Create ComplianceData and encode it for contract calls
 */
export function createComplianceData(
  userAddress: `0x${string}`,
  key: `0x${string}`,
  signature: `0x${string}`,
  attestedData: {
    score: bigint;
    timeAtWhichAttested: bigint;
    chainId: bigint;
  }
): `0x${string}` {
  // Ensure key is properly formatted as bytes32
  let keyStr = typeof key === 'string' ? key : String(key);
  if (!keyStr.startsWith('0x')) {
    keyStr = `0x${keyStr}`;
  }
  let hexPart = keyStr.slice(2).replace(/[^0-9a-fA-F]/g, '');
  if (hexPart.length === 0) hexPart = '0';
  const paddedHex = hexPart.padStart(64, '0');
  const paddedKey = `0x${paddedHex}` as `0x${string}`;

  const encoded = encodeAbiParameters(
    [
      {
        name: 'ComplianceData',
        type: 'tuple',
        components: [
          { name: 'userAddress', type: 'address' },
          { name: 'key', type: 'bytes32' },
          { name: 'signedAttestedDataWithTEESignature', type: 'bytes' },
          {
            name: 'actualAttestedData',
            type: 'tuple',
            components: [
              { name: 'score', type: 'uint256' },
              { name: 'timeAtWhichAttested', type: 'uint256' },
              { name: 'chainId', type: 'uint256' },
            ],
          },
        ],
      },
    ],
    [
      {
        userAddress,
        key: paddedKey,
        signedAttestedDataWithTEESignature: signature,
        actualAttestedData: {
          score: attestedData.score,
          timeAtWhichAttested: attestedData.timeAtWhichAttested,
          chainId: attestedData.chainId,
        },
      },
    ]
  );

  return encoded;
}

/**
 * Get the verification key for a function selector
 * This is typically the function selector (first 4 bytes of function signature)
 */
export function getVerificationKey(functionSelector: `0x${string}`): `0x${string}` {
  // Ensure it's a valid 4-byte selector
  if (functionSelector.length !== 10) {
    throw new Error('Invalid function selector');
  }
  // Pad to 32 bytes (bytes32)
  return `0x${functionSelector.slice(2).padStart(64, '0')}` as `0x${string}`;
}

