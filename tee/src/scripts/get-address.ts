import 'dotenv/config';
import { getTeePrivateKey, getAppId } from '../utils/tee-keys';
import { secretKeyToAccount, checksumAddress, connectWallet } from '../utils/wallet';

const KEY_ID = process.env.KEY_ID || 'evm:base:sepolia';
const RPC_URL = process.env.RPC_URL || process.env.BASE_RPC_URL || 'https://sepolia.base.org';
const CHAIN_ID = Number(process.env.CHAIN_ID || process.env.BASE_CHAIN_ID || '84532');

async function main() {
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 Getting TEE Wallet Address');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get private key from ROFL keygen or fallback
    const sk = await getTeePrivateKey(KEY_ID);

    // Create account from private key
    const account = secretKeyToAccount(sk);
    const address = checksumAddress(account.address);

    // Connect wallet to network
    const wallet = connectWallet(sk, RPC_URL, CHAIN_ID);

    console.log('✅ Wallet successfully created!\n');
    console.log(JSON.stringify({
      keyId: KEY_ID,
      address: address,
      chainId: CHAIN_ID,
      rpcUrl: RPC_URL,
    }, null, 2));

    // Try to get ROFL app ID if available
    try {
      const appId = await getAppId();
      console.log(`\n🆔 ROFL App ID: ${appId}`);
    } catch (error) {
      console.log('\nℹ️  ROFL App ID not available (not in ROFL environment)');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error: any) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Error:');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
  }
}

main();
