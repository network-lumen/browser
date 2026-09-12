// Which Lumen the app is on.
//
// Everything that identifies a network - the chain id a signature covers, the
// bech32 prefix, the fee denom, where to send someone to look at an address -
// used to be spread across the code as literals, each with its own default.
// `ipc/chain.cjs` asked the peer pool, `cosmosDirectory.ts` asked the public
// Cosmos registry (which only lists mainnet), and `WalletPage.vue` had the
// explorer URL written into an href. Three answers to one question is how
// `lumen://network` ends up on the testnet while `lumen://wallet` stays on
// mainnet.
//
// So: one table, one active entry, and every reader goes through it.
//
// Only Lumen is described here. Every other Cosmos chain the wallet can reach
// still comes from the registry, on mainnet, and is unaffected by this switch.

/**
 * The bootstrap section in `resources/peers.txt` is keyed by the network id, so
 * adding a network here means adding a `[<id>]` block there.
 *
 * `explorerAccountUrl` is a template rather than a base: explorers disagree on
 * the path, and an empty string means "this network has no explorer", which the
 * wallet renders by hiding the link rather than by linking somewhere wrong.
 */
const NETWORKS = Object.freeze({
  mainnet: Object.freeze({
    id: 'mainnet',
    label: 'Mainnet',
    chainId: 'lumen',
    prefix: 'lmn',
    denom: 'ulmn',
    symbol: 'LMN',
    decimals: 6,
    prettyName: 'Lumen',
    website: 'https://lumen-browser.com/',
    explorerAccountUrl: 'https://explorer.lumen.network/account/{address}'
  }),
  testnet: Object.freeze({
    id: 'testnet',
    label: 'Testnet',
    chainId: 'lumen-testnet',
    prefix: 'lmn',
    denom: 'ulmn',
    symbol: 'LMN',
    decimals: 6,
    prettyName: 'Lumen Testnet',
    website: 'https://lumen-browser.com/',
    // No public testnet explorer is published today. Left empty on purpose:
    // pointing this at the mainnet explorer would show every address as
    // unfunded, which reads as a wallet bug rather than as a wrong link.
    explorerAccountUrl: ''
  })
});

const DEFAULT_NETWORK_ID = 'mainnet';

/** The name the Cosmos chain registry uses for Lumen, on every network. */
const HOME_CHAIN_NAME = 'lumen';

function isNetworkId(input) {
  return Object.prototype.hasOwnProperty.call(NETWORKS, String(input || '').trim());
}

function normalizeNetworkId(input, fallback = DEFAULT_NETWORK_ID) {
  const id = String(input || '').trim();
  return isNetworkId(id) ? id : fallback;
}

function getNetwork(id) {
  return NETWORKS[normalizeNetworkId(id)];
}

function listNetworks() {
  return Object.values(NETWORKS);
}

/**
 * @returns the account page for `address`, or '' when the network has no
 *   explorer. Callers must treat '' as "do not offer the link".
 */
function explorerAccountUrl(id, address) {
  const template = getNetwork(id).explorerAccountUrl;
  const addr = String(address || '').trim();
  if (!template || !addr) return '';
  return template.replace('{address}', encodeURIComponent(addr));
}

module.exports = {
  NETWORKS,
  DEFAULT_NETWORK_ID,
  HOME_CHAIN_NAME,
  isNetworkId,
  normalizeNetworkId,
  getNetwork,
  listNetworks,
  explorerAccountUrl
};
