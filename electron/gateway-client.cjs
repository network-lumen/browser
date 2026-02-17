/**
 * Private Gateway Client
 * Handles gateway selection, authentication, and content fetching
 */

const { loadGateways, loadPrivateCloudConfig } = require('./settings.cjs');
const crypto = require('crypto');

/**
 * SHA256 hash of UTF-8 string
 */
function sha256Utf8(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest();
}

/**
 * Derive gateway private key from mnemonic
 * @param {string} mnemonic - Wallet mnemonic
 * @returns {Promise<Uint8Array>} Private key
 */
async function deriveGatewayPrivkey(mnemonic) {
  const { Bip39, EnglishMnemonic, Slip10, Slip10Curve, stringToPath } = require('@cosmjs/crypto');
  const GATEWAY_DERIVATION_PATH = "m/44'/118'/0'/0/0";
  
  const seed = await Bip39.mnemonicToSeed(new EnglishMnemonic(mnemonic));
  const { privkey } = Slip10.derivePath(Slip10Curve.Secp256k1, seed, stringToPath(GATEWAY_DERIVATION_PATH));
  return privkey;
}

/**
 * Sign a payload with wallet private key
 * @param {string} mnemonic - Wallet mnemonic
 * @param {string} payload - Payload to sign
 * @returns {Promise<Object>} { signatureB64, pubkeyB64 }
 */
async function signGatewayPayload(mnemonic, payload) {
  const { Secp256k1 } = require('@cosmjs/crypto');
  
  const privkey = await deriveGatewayPrivkey(mnemonic);
  const digest = sha256Utf8(payload);
  const sigObj = await Secp256k1.createSignature(digest, privkey);
  const signature = sigObj.toFixedLength();
  
  const { pubkey } = await Secp256k1.makeKeypair(privkey);
  const pubkeyCompressed = Secp256k1.compressPubkey(pubkey);
  
  return {
    signatureB64: Buffer.from(signature).toString('base64'),
    pubkeyB64: Buffer.from(pubkeyCompressed).toString('base64'),
  };
}

/**
 * Generate authentication headers for gateway request
 * @param {string} walletAddress - Wallet address
 * @param {string} mnemonic - Wallet mnemonic
 * @param {string} cid - Content ID
 * @returns {Promise<Object>} Headers object
 */
async function generateAuthHeaders(walletAddress, mnemonic, cid) {
  const timestamp = Date.now();
  const message = `${timestamp}:${cid}`;
  
  const { signatureB64, pubkeyB64 } = await signGatewayPayload(mnemonic, message);
  
  return {
    'X-Wallet-Address': walletAddress,
    'X-Signature': signatureB64,
    'X-Pubkey': pubkeyB64,
    'X-Timestamp': timestamp.toString()
  };
}

/**
 * Get available private gateways
 * @returns {Array} Array of gateway objects
 */
function getAvailableGateways() {
  const config = loadPrivateCloudConfig();
  if (!config.enabled || !config.gatewayIds || config.gatewayIds.length === 0) {
    return [];
  }
  
  const allGateways = loadGateways();
  const availableGateways = allGateways.filter(gw => 
    config.gatewayIds.includes(gw.id) && gw.status === 'active'
  );
  
  return availableGateways;
}

/**
 * Select a gateway for content retrieval
 * @param {string} cid - Content ID
 * @returns {Object|null} Selected gateway or null
 */
function selectGateway(cid) {
  const gateways = getAvailableGateways();
  
  if (gateways.length === 0) {
    return null;
  }
  
  // For now, use simple round-robin or first available
  // In the future, could implement more sophisticated selection (health checks, latency, etc.)
  return gateways[0];
}

/**
 * Fetch content from a private gateway
 * @param {Object} gateway - Gateway object
 * @param {string} cid - Content ID
 * @param {string} walletAddress - Wallet address
 * @param {string} mnemonic - Wallet mnemonic
 * @param {Object} options - Fetch options
 * @returns {Promise<Buffer>} Content buffer
 */
async function fetchFromGateway(gateway, cid, walletAddress, mnemonic, options = {}) {
  const { timeout = 5000, signal } = options;
  
  // Generate authentication headers
  const authHeaders = await generateAuthHeaders(walletAddress, mnemonic, cid);
  
  // Construct gateway URL
  const gatewayUrl = gateway.url.replace(/\/+$/, '');
  const url = `${gatewayUrl}/ipfs/${cid}`;
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: authHeaders,
      signal: signal || controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Gateway request failed: ${response.status} ${errorText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Fetch content from private gateways with retry logic
 * @param {string} cid - Content ID
 * @param {string} walletAddress - Wallet address
 * @param {string} mnemonic - Wallet mnemonic
 * @param {Object} options - Options
 * @returns {Promise<Buffer|null>} Content buffer or null if all gateways failed
 */
async function fetchFromPrivateGateways(cid, walletAddress, mnemonic, options = {}) {
  const config = loadPrivateCloudConfig();
  
  if (!config.enabled) {
    return null;
  }
  
  const gateways = getAvailableGateways();
  
  if (gateways.length === 0) {
    return null;
  }
  
  const { timeout = config.timeout || 5000, maxRetries = config.maxRetries || 3 } = options;
  
  // Try each gateway
  for (const gateway of gateways) {
    let lastError = null;
    
    // Retry logic for each gateway
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const content = await fetchFromGateway(gateway, cid, walletAddress, mnemonic, { timeout });
        console.log(`[gateway-client] Successfully fetched ${cid} from private gateway ${gateway.name}`);
        return content;
      } catch (error) {
        lastError = error;
        console.warn(`[gateway-client] Attempt ${attempt + 1}/${maxRetries} failed for gateway ${gateway.name}:`, error.message);
        
        // Exponential backoff
        if (attempt < maxRetries - 1) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }
    
    console.warn(`[gateway-client] All attempts failed for gateway ${gateway.name}:`, lastError?.message);
  }
  
  console.warn(`[gateway-client] All private gateways failed for CID ${cid}`);
  return null;
}

module.exports = {
  getAvailableGateways,
  selectGateway,
  fetchFromGateway,
  fetchFromPrivateGateways,
  generateAuthHeaders
};
