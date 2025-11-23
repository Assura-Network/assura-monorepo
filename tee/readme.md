# ROFL TEE Server

Simple Express TypeScript server running in Oasis ROFL TEE.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build TypeScript:
```bash
npm run build
```

3. Start server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Core Endpoints
- `GET /` - Service information
- `GET /health` - Health check with TEE wallet status

### Wallet Endpoints
- `GET /address` - Get TEE wallet address (production endpoint)
  - Returns: `{ "address": "0x..." }`
- `GET /wallet/info` - Get detailed wallet information
  - Returns: `{ "address": "0x...", "keyId": "evm:base:sepolia", "walletInitialized": true, ... }`
- `POST /wallet/sign` - Sign a message with TEE wallet
  - Body: `{ "message": "..." }`
  - Returns: `{ "message": "...", "signature": "0x...", "address": "0x..." }`

### Document Processing
- `POST /summarize-doc` - Submit document for processing
  - Body: `{ "document": "..." }`
  - Returns: `{ "job_id": "...", "status": "processing", "status_url": "/summarize-doc/{job_id}" }`
- `GET /summarize-doc/:jobId` - Get job status and result

### ENS Subname Endpoints
- `GET /subnames` - List all subnames
- `GET /subname/:label` - Get specific subname details
- `GET /subname/:label/available` - Check subname availability
- `POST /subname` - Create a new subname

## TEE Wallet & Key Generation

The service automatically generates a deterministic wallet using Oasis ROFL keygen:

### Key Generation Methods (Priority Order)
1. **ROFL Keygen** (Production) - Generates keys via `/run/rofl-appd.sock`
2. **Environment Variables** - `TEE_PRIVATE_KEY` or `PRIVATE_KEY`
3. **Secure File Paths** - `/run/secrets/private_key`, `/run/tee/private_key`, etc.
4. **Local Development** - `LOCAL_DEV_SK` with `ALLOW_LOCAL_DEV=true`

### Get Wallet Address

#### Via Script (Local)
Run the script to display the TEE wallet address:
```bash
npm run get-address
```

For local development:
```bash
ALLOW_LOCAL_DEV=true LOCAL_DEV_SK=0x... npm run get-address
```

#### Via API (Production)
Once deployed, get the wallet address via HTTP:
```bash
# Using the proxy URL
curl https://p3000.m602.test-proxy-b.rofl.app/address

# Or using custom domain
curl https://tee.assura.network/address
```

Response:
```json
{
  "address": "0xFCAd0B19bB29D4674531d6f115237E16AfCE377c"
}
```

## Environment Variables

### Server Configuration
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (default: production)

### Wallet Configuration
- `KEY_ID` - ROFL key identifier (default: `evm:base:sepolia`)
- `RPC_URL` - Blockchain RPC endpoint
- `CHAIN_ID` - Blockchain chain ID (e.g., 84532 for Base Sepolia)
- `TEE_ENABLED` - Enable TEE mode (default: auto-detect)

### Development Only
- `ALLOW_LOCAL_DEV` - Enable local development mode (`true`/`false`)
- `LOCAL_DEV_SK` - Local development private key (0x-prefixed hex)

## Deployment

Build and deploy to Oasis ROFL:
```bash
oasis rofl build
oasis rofl deploy
```

## Proxy & Custom Domain

The ROFL proxy automatically generates HTTPS URLs for exposed ports. Port 3000 is configured for proxy access.

### Getting the Proxy URL

After deployment, get the proxy URL:
```bash
oasis rofl machine show
```

Look for the `Proxy` section in the output:
```
Proxy:
  Domain: m602.test-proxy-b.rofl.app
  Ports from compose file:
    3000 (app): https://p3000.m602.test-proxy-b.rofl.app
```

### Setting up Custom Domain (tee.assura.network)

The custom domain `tee.assura.network` is configured in `compose.yaml`. To complete the setup:

1. **Deploy the updated configuration:**
   ```bash
   oasis rofl build
   oasis rofl deploy
   ```

2. **Get the machine IP and verification TXT record:**
   After deployment, check the output or run:
   ```bash
   oasis rofl machine show
   ```
   Look for the machine IP address and any TXT record requirements for domain verification.

3. **Configure DNS records:**
   - **A Record:** `tee.assura.network` → `<machine-ip-address>`
   - **TXT Record:** Create the TXT record as specified in the deployment output for domain verification

4. **Access your service:**
   Once DNS propagates (5-60 minutes), access at: `https://tee.assura.network`

The proxy handles TLS certificate generation and termination automatically for your custom domain.
