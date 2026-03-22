const crypto = require('node:crypto');

const PROVIDER_KEYS = Object.freeze(['keplr', 'leap', 'ethereum']);

const DEFAULT_BECH32_PREFIXES = Object.freeze({
  accountAddress: 'lmn',
  accountPubKey: 'lmnpub',
  validatorAddress: 'lmnvaloper',
  validatorPubKey: 'lmnvaloperpub',
  consensusAddress: 'lmnvalcons',
  consensusPubKey: 'lmnvalconspub'
});

function safeString(value, maxLen = 2048) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function normalizeProviderHints(input) {
  const items = Array.isArray(input) ? input : [];
  return Array.from(
    new Set(
      items
        .map((item) => safeString(item, 64).toLowerCase())
        .filter((item) => PROVIDER_KEYS.includes(item))
    )
  );
}

function hashStableId(input, length = 32) {
  return crypto
    .createHash('sha256')
    .update(Buffer.from(String(input || ''), 'utf8'))
    .digest('hex')
    .slice(0, Math.max(8, Math.min(64, Number(length) || 32)));
}

function detectProviderHints(manifest, installSource = '') {
  const raw = [
    manifest?.name,
    manifest?.short_name,
    manifest?.description,
    manifest?.homepage_url,
    installSource
  ]
    .map((item) => safeString(item, 2048).toLowerCase())
    .join(' ');

  const hints = [];
  if (raw.includes('keplr')) hints.push('keplr');
  if (raw.includes('leap')) hints.push('leap');
  if (raw.includes('metamask') || raw.includes('ethereum')) hints.push('ethereum');
  return normalizeProviderHints(hints);
}

function buildProviderFallbackState(entries) {
  const items = Array.isArray(entries) ? entries : [];
  const enabledLoadedHints = new Set();

  for (const entry of items) {
    if (!entry || entry.enabled !== true || entry.loaded !== true) continue;
    for (const hint of normalizeProviderHints(entry.providerHints)) {
      enabledLoadedHints.add(hint);
    }
  }

  return {
    keplr: !enabledLoadedHints.has('keplr'),
    leap: !enabledLoadedHints.has('leap'),
    ethereum: !enabledLoadedHints.has('ethereum')
  };
}

module.exports = {
  PROVIDER_KEYS,
  DEFAULT_BECH32_PREFIXES,
  hashStableId,
  detectProviderHints,
  normalizeProviderHints,
  buildProviderFallbackState
};
