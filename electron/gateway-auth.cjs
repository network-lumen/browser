/**
 * Authentication module for embedded gateway server
 */

const crypto = require('crypto');
const { isWhitelisted, getWhitelistEntry, getUsageStats } = require('./gateway-database.cjs');

let config = null;

function setConfig(cfg) {
  config = cfg;
}

/**
 * SHA256 hash
 */
function sha256Utf8(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest();
}

/**
 * Validate signature
 */
async function validateSignature(address, signatureB64, pubkeyB64, timestamp, message) {
  try {
    const { Secp256k1, Secp256k1Signature } = require('@cosmjs/crypto');
    
    const pubBytesRaw = Buffer.from(pubkeyB64, 'base64');
    const pubUncompressed = pubBytesRaw.length === 33 
      ? Secp256k1.uncompressPubkey(pubBytesRaw) 
      : pubBytesRaw;
    const pubCompressed = pubBytesRaw.length === 33 
      ? pubBytesRaw 
      : Secp256k1.compressPubkey(pubBytesRaw);
    
    const signature = Buffer.from(signatureB64, 'base64');
    let sigObj;
    try {
      sigObj = Secp256k1Signature.fromFixedLength(signature);
    } catch (_e) {
      if (signature.length === 65) {
        const { ExtendedSecp256k1Signature } = require('@cosmjs/crypto');
        sigObj = ExtendedSecp256k1Signature.fromFixedLength(signature);
      } else {
        throw _e;
      }
    }
    
    const digest = sha256Utf8(message);
    const validSig = await Secp256k1.verifySignature(sigObj, digest, pubUncompressed);
    
    const prefix = extractPrefix(address);
    const derivedAddr = pubkeyToAddressBech32(pubCompressed, prefix);
    const addressMatches = derivedAddr === address;
    
    return validSig && addressMatches;
  } catch (error) {
    console.error('[gateway-auth] Signature validation error:', error);
    return false;
  }
}

function extractPrefix(address) {
  const match = address.match(/^([a-z0-9]+)1/i);
  return match ? match[1] : 'lumen';
}

function pubkeyToAddressBech32(pubkey, prefix) {
  const { sha256 } = require('@cosmjs/crypto');
  const { Bech32 } = require('@cosmjs/encoding');
  const { ripemd160 } = require('@noble/hashes/ripemd160');
  
  const sha256Hash = sha256(pubkey);
  const hash = ripemd160(sha256Hash);
  
  return Bech32.encode(prefix, hash);
}

/**
 * Validate timestamp
 */
function validateTimestamp(timestamp) {
  const now = Date.now();
  const diff = Math.abs(now - timestamp);
  const tolerance = config?.auth?.timestampTolerance || 300000;
  return diff <= tolerance;
}

/**
 * Check usage limits
 */
function checkUsageLimits(address) {
  try {
    const entry = getWhitelistEntry(address);
    if (!entry) {
      return { allowed: false, remaining: {}, reason: 'not_whitelisted' };
    }
    
    if (!entry.enabled) {
      return { allowed: false, remaining: {}, reason: 'disabled' };
    }
    
    const dailyUsage = getUsageStats(address, 'day') || { bandwidth_used: 0, request_count: 0 };
    const monthlyUsage = getUsageStats(address, 'month') || { bandwidth_used: 0, request_count: 0 };
    
    if (entry.bandwidth_per_day > 0 && dailyUsage.bandwidth_used >= entry.bandwidth_per_day) {
      return { allowed: false, remaining: { daily_bandwidth: 0 }, reason: 'daily_bandwidth_exceeded' };
    }
    
    if (entry.requests_per_day > 0 && dailyUsage.request_count >= entry.requests_per_day) {
      return { allowed: false, remaining: { daily_requests: 0 }, reason: 'daily_requests_exceeded' };
    }
    
    if (entry.bandwidth_per_month > 0 && monthlyUsage.bandwidth_used >= entry.bandwidth_per_month) {
      return { allowed: false, remaining: { monthly_bandwidth: 0 }, reason: 'monthly_bandwidth_exceeded' };
    }
    
    if (entry.requests_per_month > 0 && monthlyUsage.request_count >= entry.requests_per_month) {
      return { allowed: false, remaining: { monthly_requests: 0 }, reason: 'monthly_requests_exceeded' };
    }
    
    const remaining = {
      daily_bandwidth: entry.bandwidth_per_day > 0 ? entry.bandwidth_per_day - dailyUsage.bandwidth_used : -1,
      daily_requests: entry.requests_per_day > 0 ? entry.requests_per_day - dailyUsage.request_count : -1,
      monthly_bandwidth: entry.bandwidth_per_month > 0 ? entry.bandwidth_per_month - monthlyUsage.bandwidth_used : -1,
      monthly_requests: entry.requests_per_month > 0 ? entry.requests_per_month - monthlyUsage.request_count : -1
    };
    
    return { allowed: true, remaining, reason: 'ok' };
  } catch (error) {
    console.error('[gateway-auth] Error checking usage limits:', error);
    return { allowed: false, remaining: {}, reason: 'error' };
  }
}

/**
 * Authenticate request
 */
async function authenticateRequest(headers, cid) {
  try {
    const address = headers['x-wallet-address'];
    const signatureB64 = headers['x-signature'];
    const pubkeyB64 = headers['x-pubkey'];
    const timestamp = parseInt(headers['x-timestamp'], 10);
    
    if (!address || !signatureB64 || !pubkeyB64 || !timestamp) {
      return { authenticated: false, address: null, error: 'Missing authentication headers' };
    }
    
    if (!validateTimestamp(timestamp)) {
      return { authenticated: false, address, error: 'Timestamp expired or invalid' };
    }
    
    const message = `${timestamp}:${cid}`;
    
    const validSignature = await validateSignature(address, signatureB64, pubkeyB64, timestamp, message);
    if (!validSignature) {
      return { authenticated: false, address, error: 'Invalid signature' };
    }
    
    if (!isWhitelisted(address)) {
      return { authenticated: false, address, error: 'Not whitelisted' };
    }
    
    const limits = checkUsageLimits(address);
    if (!limits.allowed) {
      return { authenticated: false, address, error: `Usage limit exceeded: ${limits.reason}` };
    }
    
    return { authenticated: true, address, error: null };
  } catch (error) {
    console.error('[gateway-auth] Authentication error:', error);
    return { authenticated: false, address: null, error: 'Authentication failed' };
  }
}

/**
 * Verify API key
 */
function verifyApiKey(apiKey) {
  return apiKey === config?.apiKey;
}

module.exports = {
  setConfig,
  validateSignature,
  validateTimestamp,
  checkUsageLimits,
  authenticateRequest,
  verifyApiKey
};
