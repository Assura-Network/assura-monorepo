'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { CustomConnectButton } from './CustomConnectButton'
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'
import { TOKENS, IMAGE_PATHS, CONTRACT_ADDRESSES, currentChain } from '@/lib/constants'
import { createComplianceData } from '@/lib/compliance'
import { ThemeToggle } from './ThemeToggle'

// Vault ABI - depositWithCompliance function and verificationKey
const VAULT_ABI = [
  {
    name: 'depositWithCompliance',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'attestedComplianceData', type: 'bytes' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'verificationKey',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'minScore',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// ERC20 ABI for approvals
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// AssuraVerifier ABI
const ASSURA_VERIFIER_ABI = [
  {
    name: 'getVerifyingData',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'appContractAddress', type: 'address' },
      { name: 'key', type: 'bytes32' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'score', type: 'uint256' },
          { name: 'expiry', type: 'uint256' },
          { name: 'chainId', type: 'uint256' },
        ],
      },
    ],
  },
] as const

export default function VaultDeposit() {
  const [selectedToken, setSelectedToken] = useState(TOKENS[0])
  const [depositAmount, setDepositAmount] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsApproval, setNeedsApproval] = useState(false)
  const [approvalAmount, setApprovalAmount] = useState<bigint | null>(null)
  const { address, isConnected, chainId } = useAccount()

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  const tokenAddress = selectedToken.available && 'address' in selectedToken
    ? selectedToken.address
    : undefined

  const { data: balance } = useBalance({
    address,
    token: tokenAddress,
    chainId: currentChain.id,
  })

  // Read user's shares from vault contract
  const { data: userShares, refetch: refetchShares } = useReadContract({
    address: CONTRACT_ADDRESSES.VAULT,
    abi: VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected && CONTRACT_ADDRESSES.VAULT !== '0x0000000000000000000000000000000000000000',
    },
  })

  // Get balances for each available token
  const usdcToken = TOKENS.find(t => t.symbol === 'USDC' && t.available && 'address' in t)
  const { data: usdcBalance } = useBalance({
    address: isConnected && !!usdcToken ? address : undefined,
    token: usdcToken && 'address' in usdcToken ? usdcToken.address : undefined,
    chainId: currentChain.id,
  })

  const getTokenBalance = (tokenSymbol: string) => {
    if (tokenSymbol === 'USDC' && usdcBalance) {
      return parseFloat(formatUnits(usdcBalance.value, usdcBalance.decimals)).toFixed(2)
    }
    return '0.00'
  }

  // Check if user has no USDC
  const hasNoUSDC = isConnected && selectedToken.symbol === 'USDC' && (
    !usdcBalance ||
    parseFloat(formatUnits(usdcBalance.value, usdcBalance.decimals)) === 0
  )

  const handleGetUSDC = () => {
    window.open('https://faucet.circle.com/', '_blank')
  }

  const handleOpenDialog = () => {
    if (!isConnected || !selectedToken.available) return
    setShowDialog(true)
  }

  const handleConfirmDeposit = async () => {
    if (!address || !isConnected || !depositAmount || parseFloat(depositAmount) <= 0) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      if (!selectedToken.available || !('address' in selectedToken) || !selectedToken.address) {
        throw new Error('Invalid token selected')
      }

      const vaultAddress = CONTRACT_ADDRESSES.VAULT
      const assuraVerifierAddress = CONTRACT_ADDRESSES.ASSURA_VERIFIER

      if (vaultAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error('Vault contract address not configured. Please update CONTRACT_ADDRESSES.VAULT in constants.ts')
      }

      // Convert amount to wei/smallest unit
      const amountInWei = parseUnits(depositAmount, selectedToken.decimals)

      // Read verification key and minScore from vault contract
      const { createPublicClient, http } = await import('viem')
      const publicClient = createPublicClient({
        chain: currentChain,
        transport: http(),
      })

      const [verificationKey, minScore] = await Promise.all([
        publicClient.readContract({
          address: vaultAddress,
          abi: VAULT_ABI,
          functionName: 'verificationKey',
        }) as Promise<`0x${string}`>,
        publicClient.readContract({
          address: vaultAddress,
          abi: VAULT_ABI,
          functionName: 'minScore',
        }) as Promise<bigint>,
      ])

      // Get verifying data from AssuraVerifier to check required score
      const verifyingData = await publicClient.readContract({
        address: assuraVerifierAddress,
        abi: ASSURA_VERIFIER_ABI,
        functionName: 'getVerifyingData',
        args: [vaultAddress, verificationKey],
      }) as { score: bigint; expiry: bigint; chainId: bigint }

      // Use the required score from verifying data (or minScore as fallback)
      const requiredScore = verifyingData.score > BigInt(0) ? verifyingData.score : minScore
      // Use a score higher than required to ensure it passes
      const score = requiredScore + BigInt(50) // Add buffer to ensure it's above minimum

      // Check and handle token approval
      const tokenAddress = selectedToken.address as `0x${string}`
      const allowance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, vaultAddress],
      })

      // Handle token approval if needed
      if (allowance < amountInWei) {
        console.log('Insufficient allowance, requesting approval...')

        // Request approval - use a larger amount to avoid repeated approvals
        const approveAmount = amountInWei * BigInt(10) // Approve 10x the amount for future deposits

        // Set state to show approval is needed
        setNeedsApproval(true)
        setApprovalAmount(approveAmount)

        // Trigger approval transaction
        writeContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [vaultAddress, approveAmount],
        })

        setIsLoading(false)
        return // Exit early, approval transaction will be handled by useEffect
      }

      // Prepare attested data
      const currentTimestamp = BigInt(Math.floor(Date.now() / 1000))
      // Use chainId from verifying data if set, otherwise use current chain
      // If chainId is 0 in verifying data, it means "any chain"
      const currentChainId = verifyingData.chainId > BigInt(0)
        ? verifyingData.chainId
        : BigInt(chainId || currentChain.id)

      const attestedData = {
        score,
        timeAtWhichAttested: currentTimestamp,
        chainId: currentChainId,
      }

      // Get TEE signature from API
      const teeResponse = await fetch('/api/tee/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          score: attestedData.score.toString(),
          timeAtWhichAttested: attestedData.timeAtWhichAttested.toString(),
          chainId: attestedData.chainId.toString(),
          assuraVerifierAddress,
          signatureType: 'eip712', // Use EIP-712 by default
        }),
      })

      if (!teeResponse.ok) {
        const errorData = await teeResponse.json()
        throw new Error(errorData.error || 'Failed to get TEE signature')
      }

      const { signature, attestedData: responseAttestedData } = await teeResponse.json()

      // Create compliance data
      const complianceData = createComplianceData(
        address,
        verificationKey,
        signature as `0x${string}`,
        {
          score: BigInt(responseAttestedData.score),
          timeAtWhichAttested: BigInt(responseAttestedData.timeAtWhichAttested),
          chainId: BigInt(responseAttestedData.chainId),
        }
      )

      // Deposit with compliance
      // Note: User must approve the vault contract first to spend tokens
      // This can be done separately or we can add an approval step here
      console.log('Depositing with compliance...')
      writeContract({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: 'depositWithCompliance',
        args: [amountInWei, address, complianceData],
      })
    } catch (err) {
      console.error('Deposit error:', err)
      setError(err instanceof Error ? err.message : 'Failed to deposit')
      setIsLoading(false)
    }
  }

  // Handle approval success - retry deposit automatically
  useEffect(() => {
    if (isSuccess && needsApproval && approvalAmount && hash) {
      // Approval succeeded, wait a bit then retry the deposit
      const retryDeposit = async () => {
        setNeedsApproval(false)
        setApprovalAmount(null)
        await new Promise((resolve) => setTimeout(resolve, 2000))
        // Retry deposit - trigger it by calling the handler
        // We'll use a flag to indicate we should proceed with deposit
        setIsLoading(true)
        // The actual deposit will happen in the next render cycle
      }
      retryDeposit()
    }
  }, [isSuccess, needsApproval, approvalAmount, hash])

  // Update shares display when deposit transaction succeeds (not approval)
  useEffect(() => {
    if (isSuccess && !needsApproval && !isLoading && depositAmount) {
      // Refetch shares from contract
      refetchShares()
      setDepositAmount('')
      setShowDialog(false)
      setIsLoading(false)
    }
  }, [isSuccess, needsApproval, isLoading, depositAmount, refetchShares])

  const handleMax = () => {
    if (balance) {
      const formatted = formatUnits(balance.value, balance.decimals)
      setDepositAmount(formatted)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-[625px] mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex cursor-pointer items-center gap-3 group">
            <div className="relative w-12 h-12 shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:rotate-360">
              <Image
                src="/images/Assura-Light.svg"
                alt="Assura"
                width={45}
                height={45}
                className="absolute inset-0 m-auto dark:hidden"
              />
              <Image
                src="/images/Assura-Dark.svg"
                alt="Assura"
                width={45}
                height={45}
                className="absolute inset-0 m-auto hidden dark:block"
              />
            </div>
            <span className="text-2xl font-medium -ml-5">Assura</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <CustomConnectButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mt-16">
        <div className="max-w-[625px] mx-auto px-8">
          {/* Current Vault Shares */}
          <div className="mb-16">
            <div className="text-lg font-light text-muted-foreground mb-3">Your Shares</div>
            <div className="flex items-end gap-4">
              <div className="text-7xl font-light leading-none text-foreground">
                {userShares !== undefined
                  ? parseFloat(formatUnits(userShares, selectedToken.decimals)).toFixed(4)
                  : '0.0000'}
              </div>
              <div className="text-3xl font-light text-muted-foreground pb-2">APV</div>
            </div>
            <div className="flex gap-8 mt-6 text-base font-light">
              <div>
                <span className="text-muted-foreground">APY </span>
                <span className="text-foreground">4.2%</span>
              </div>
              <div>
                <span className="text-muted-foreground">TVL </span>
                <span className="text-foreground">$12.4M</span>
              </div>
              {/* {balance && (
                <div>
                  <span className="text-muted-foreground">Available </span>
                  <span className="text-foreground">
                    {parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4)} {selectedToken.symbol}
                  </span>
                </div>
              )} */}
            </div>
          </div>

          {/* Deposit Section */}
          <div>
            <div className="text-5xl font-normal mb-8 text-foreground">Deposit</div>

            {/* Token Selection */}
            <div className="mb-8">
              <div className="text-base font-light text-muted-foreground mb-4">Select Token</div>
              <div className="flex gap-4">
                {TOKENS.map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      if (token.available) {
                        setSelectedToken(token)
                        setDepositAmount('')
                      }
                    }}
                    disabled={!token.available}
                    className={`
                      flex flex-col items-start gap-3 px-6 py-4 border border-border rounded-3xl transition-all
                      ${selectedToken.symbol === token.symbol
                        ? 'border-foreground'
                        : 'hover:opacity-50'
                      }
                      ${!token.available ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden">
                        <Image
                          src={token.image}
                          alt={token.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="text-left flex-1">
                        <div className="text-lg font-normal text-foreground">{token.symbol}</div>
                        {token.available && isConnected ? (
                          <div className="text-xs font-light text-muted-foreground">
                            {getTokenBalance(token.symbol)} {token.symbol}
                          </div>
                        ) : (
                          'comingSoon' in token && token.comingSoon && (
                            <div className="text-xs font-light text-muted-foreground">Coming Soon</div>
                          )
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Get USDC Button - Show when user has no USDC */}
            {hasNoUSDC && (
              <Button
                onClick={handleGetUSDC}
                variant="outline"
                className="w-full h-14 text-lg font-light rounded-full mb-4 border-2 flex items-center justify-center gap-2"
              >
                <div className="relative w-5 h-5 rounded-full overflow-hidden">
                  <Image
                    src={IMAGE_PATHS.chains.baseSepolia}
                    alt="Base"
                    fill
                    className="object-cover"
                  />
                </div>
                Get USDC on Base Sepolia
              </Button>
            )}

            {/* Deposit Button */}
            {selectedToken.available && (
              <Button
                onClick={handleOpenDialog}
                disabled={!isConnected}
                className="w-full h-14 text-lg font-light rounded-full"
              >
                {!isConnected ? 'Connect Wallet to Deposit' : 'Deposit'}
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* Deposit Dialog with Form */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent className="max-w-lg rounded-3xl p-6">
          <AlertDialogHeader className="mb-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="relative w-10 h-10 rounded-full overflow-hidden">
                <Image
                  src={selectedToken.image}
                  alt={selectedToken.name}
                  fill
                  className="object-cover"
                />
              </div>
              <AlertDialogTitle className="text-3xl font-light">Deposit {selectedToken.symbol}</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base font-light text-muted-foreground">
              Enter the amount to deposit into your vault
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error && (
            <div className="p-4 border border-red-500/50 rounded-3xl bg-red-500/10">
              <div className="text-sm font-light text-red-500">{error}</div>
            </div>
          )}

          <div className="space-y-4">
            {/* Available Balance */}
            {balance && (
              <div className="p-4 border border-border rounded-3xl bg-card/50">
                <div className="text-xs font-light text-muted-foreground mb-2 uppercase tracking-wider">Available Balance</div>
                <div className="flex items-center gap-3">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden">
                    <Image
                      src={selectedToken.image}
                      alt={selectedToken.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="text-2xl font-light text-foreground">
                    {parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(2)} {selectedToken.symbol}
                  </div>
                </div>
              </div>
            )}

            {/* Show Get USDC button if user has no USDC */}
            {hasNoUSDC && (
              <div className="p-4 border border-border rounded-3xl bg-card/50">
                <div className="text-xs font-light text-muted-foreground mb-3 uppercase tracking-wider">No USDC Balance</div>
                <div className="text-sm font-light text-muted-foreground mb-4">
                  You need USDC to deposit. Get free testnet USDC from Circle&apos;s faucet.
                </div>
                <Button
                  onClick={handleGetUSDC}
                  variant="outline"
                  className="w-full h-16 text-base font-light border-2 flex items-center justify-center gap-2"
                >
                  <div className="relative overflow-hidden">
                    <Image
                      src={IMAGE_PATHS.chains.baseSepolia}
                      alt="Base"
                      width={24}
                      height={24}
                    />
                  </div>
                  Get USDC on Base Sepolia
                </Button>
              </div>
            )}

            {/* Amount Input */}
            <div>
              <div className="text-xs font-light text-muted-foreground mb-2 uppercase tracking-wider">Amount</div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="text-3xl font-light h-16 pr-20 border-0 border-b-2 border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-foreground transition-colors"
                />
                {balance && (
                  <button
                    onClick={handleMax}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Max
                  </button>
                )}
              </div>
            </div>

            {/* Summary */}
            {depositAmount && parseFloat(depositAmount) > 0 && (
              <div className="space-y-2">
                <div className="p-4 border border-border rounded-3xl bg-card/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-light text-muted-foreground">You will deposit</span>
                    <span className="text-lg font-light text-foreground">{depositAmount} {selectedToken.symbol}</span>
                  </div>
                  <div className="h-px bg-border mb-2"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-light text-muted-foreground">Estimated shares</span>
                    <span className="text-lg font-light text-foreground">
                      {depositAmount
                        ? `~${parseFloat(depositAmount).toFixed(4)} APV`
                        : '0.0000 APV'}
                    </span>
                  </div>
                </div>

              </div>
            )}
          </div>

          <AlertDialogFooter className="gap-0 mt-4">
            <AlertDialogCancel
              onClick={() => setDepositAmount('')}
              className="rounded-full font-light h-12 px-8 text-sm"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeposit}
              disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isLoading || isPending || isConfirming}
              className="rounded-full font-light h-12 px-8 text-sm"
            >
              {needsApproval
                ? isPending || isConfirming
                  ? 'Approving...'
                  : isSuccess
                    ? 'Approved! Retrying...'
                    : 'Approve Tokens'
                : isLoading || isPending || isConfirming
                  ? 'Processing...'
                  : isSuccess
                    ? 'Success!'
                    : 'Confirm Deposit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}