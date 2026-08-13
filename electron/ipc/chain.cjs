const { ipcMain } = require('electron');
const { httpGet } = require('./http.cjs');
const { getNetworkPool } = require('../daemons/peers/pool_singleton.cjs');
const { trimSlash } = require('../utils/strings.cjs');
const { pollChainOnce, getChainState } = require('../daemons/chain_poller.cjs');

// Which node to talk to is the peer pool's decision, not this module's: it
// reads resources/peers.txt once (daemons/peers/peer_pool.cjs) and tracks health per
// peer. Reading that file here as well is how the two would drift apart.
function getRestBaseUrl() {
  try {
    const peer = getNetworkPool().getBestPeer('rest');
    return peer ? peer.rest : null;
  } catch {
    return null;
  }
}

async function walletGetBalance(input) {
  const address = String(input && input.address ? input.address : '').trim();
  if (!address) {
    return { ok: false, error: 'missing address' };
  }
  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { ok: false, error: 'rest_base_missing' };
  }
  const denom = String((input && input.denom) || 'ulmn');
  const base = trimSlash(restBase);
  const byDenomUrl = `${base}/cosmos/bank/v1beta1/balances/${encodeURIComponent(
    address
  )}/by_denom?denom=${encodeURIComponent(denom)}`;
  const listUrl = `${base}/cosmos/bank/v1beta1/balances/${encodeURIComponent(address)}`;

  try {
    let coin = null;
    const r1 = await httpGet(byDenomUrl, { timeout: 5000 });
    if (r1.ok && r1.json && r1.json.balance) {
      coin = r1.json.balance;
    } else if (r1.status === 404) {
      const r2 = await httpGet(listUrl, { timeout: 5000 });
      if (!r2.ok) {
        return { ok: false, status: r2.status, error: 'balance query failed' };
      }
      const coins = Array.isArray(r2.json && r2.json.balances ? r2.json.balances : [])
        ? r2.json.balances
        : [];
      coin = coins.find((c) => String(c && c.denom) === denom) || null;
    } else if (!r1.ok) {
      return { ok: false, status: r1.status, error: 'balance query failed' };
    }
    return { ok: true, balance: coin || { denom, amount: '0' } };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

async function walletListSendTxs(input) {
  const address = String(input && input.address ? input.address : '').trim();
  if (!address) {
    return { ok: false, error: 'missing address' };
  }
  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { ok: false, error: 'rest_base_missing' };
  }
  const base = trimSlash(restBase);
  const limit = Number(input && input.limit ? input.limit : 50) || 50;

  function collectTxEvents(tx) {
    const out = [];
    if (tx && Array.isArray(tx.events)) out.push(...tx.events);
    if (tx && tx.tx_result && Array.isArray(tx.tx_result.events)) out.push(...tx.tx_result.events);
    const logs = tx && Array.isArray(tx.logs) ? tx.logs : [];
    for (const log of logs) {
      const events = Array.isArray(log && log.events ? log.events : []) ? log.events : [];
      out.push(...events);
    }
    return out;
  }

  function findEventAttr(events, type, key) {
    const typeLower = String(type || '').toLowerCase();
    const keyLower = String(key || '').toLowerCase();
    const list = Array.isArray(events) ? events : [];

    for (const ev of list) {
      const evType = String(ev && ev.type ? ev.type : '').toLowerCase();
      if (!evType || evType !== typeLower) continue;

      const attrs = Array.isArray(ev && ev.attributes ? ev.attributes : []) ? ev.attributes : [];
      for (const a of attrs) {
        const k = String(a && a.key ? a.key : '').toLowerCase();
        if (k !== keyLower) continue;
        const v = a && a.value != null ? String(a.value) : '';
        if (v) return v;
      }
    }
    return '';
  }

  function extractPrimaryActionAndDnsName(tx) {
    let action = '';
    let dnsName = '';

    try {
      const messages =
        tx && tx.tx && tx.tx.body && Array.isArray(tx.tx.body.messages) ? tx.tx.body.messages : [];
      for (const msg of messages) {
        if (!msg) continue;
        const msgType = String(msg['@type'] || msg.typeUrl || msg.type_url || '').trim();
        if (!action && msgType) action = msgType;

        if (
          msgType === '/lumen.dns.v1.MsgUpdate' ||
          msgType === '/lumen.dns.v1.MsgTransfer' ||
          msgType === '/lumen.dns.v1.MsgRegister'
        ) {
          const fqdn = msg.name || msg.fqdn;
          if (fqdn) {
            dnsName = String(fqdn);
          } else if (msg.domain && msg.ext) {
            dnsName = `${String(msg.domain)}.${String(msg.ext)}`;
          } else if (msg.domain) {
            dnsName = String(msg.domain);
          }
          action = msgType;
          break;
        }
      }
    } catch {
      // ignore
    }

    const events = collectTxEvents(tx);
    if (!action) action = findEventAttr(events, 'message', 'action');
    if (action === '/lumen.dns.v1.MsgUpdate') {
      const evName = findEventAttr(events, 'dns_update', 'name');
      if (evName) dnsName = evName;
    } else if (action === '/lumen.dns.v1.MsgTransfer') {
      const evName = findEventAttr(events, 'dns_transfer', 'name');
      if (evName) dnsName = evName;
    } else if (action === '/lumen.dns.v1.MsgRegister') {
      const evName = findEventAttr(events, 'dns_register', 'name');
      if (evName) dnsName = evName;
    } else if (action === '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward') {
      const validator = findEventAttr(events, 'withdraw_rewards', 'validator');
      if (validator) dnsName = validator;
    } else if (action === '/lumen.release.v1.MsgPublishRelease') {
      const version = findEventAttr(events, 'release_publish', 'version');
      const channel = findEventAttr(events, 'release_publish', 'channel');
      const id = findEventAttr(events, 'release_publish', 'id');

      let details = '';
      if (version && channel) details = `${version} • ${channel}`;
      else details = version || channel || '';
      if (id) details = details ? `${details} (#${id})` : `#${id}`;

      if (details) dnsName = details;
    }

    return { action, dnsName };
  }

  const filters = [
    { key: 'sent', filter: `message.sender='${address}'`, type: 'send' },
    { key: 'signed', filter: `message.signer='${address}'`, type: 'send' },
    { key: 'received', filter: `transfer.recipient='${address}'`, type: 'receive' },
    { key: 'dns_to', filter: `dns_transfer.to='${address}'`, type: 'receive' },
    { key: 'dns_owner', filter: `dns_register.owner='${address}'`, type: 'receive' }
  ];

  const byHash = new Map();

  for (const entry of filters) {
    let txs = [];
    try {
      // Try LCD tx search via events (Cosmos 0.47+ style)
      const u1 = new URL('/cosmos/tx/v1beta1/txs', base);
      u1.searchParams.set('events', entry.filter);
      u1.searchParams.set('order_by', 'ORDER_BY_DESC');
      u1.searchParams.set('page', '1');
      u1.searchParams.set('limit', String(Math.min(100, Math.max(1, limit | 0))));
      
      const res1 = await httpGet(u1.toString(), { timeout: 15000 });
      
      if (res1 && res1.ok) {
        const data = res1.json || {};
        txs = Array.isArray(data.tx_responses) ? data.tx_responses : [];
      } else {
        // Fallback: legacy LCD "query" parameter
        const u2 = new URL('/cosmos/tx/v1beta1/txs', base);
        u2.searchParams.set('query', entry.filter);
        u2.searchParams.set('order_by', 'ORDER_BY_DESC');
        u2.searchParams.set('page', '1');
        u2.searchParams.set('limit', String(Math.min(100, Math.max(1, limit | 0))));
        
        const res2 = await httpGet(u2.toString(), { timeout: 15000 });
        
        if (!res2 || !res2.ok) {
          // Suppress 404 (no transactions) and 500 (indexer issues) errors
          if (res2 && res2.status !== 404 && res2.status !== 500) {
            console.warn(
              '[wallet] listSendTxs error',
              entry.filter,
              'status:',
              res2.status
            );
          }
          continue;
        }
        const data2 = res2.json || {};
        txs = Array.isArray(data2.tx_responses) ? data2.tx_responses : [];
      }
    } catch (e) {
      // Silently continue on errors
      continue;
    }

    for (const tx of txs) {
      if (!tx) continue;
      const txhash = String(tx.txhash || tx.tx?.hash || '');
      if (!txhash) continue;
      if (!byHash.has(txhash)) {
        byHash.set(txhash, { tx, primaryType: entry.type });
      } else {
        const existing = byHash.get(txhash);
        if (existing && existing.primaryType !== 'send' && entry.type === 'send') {
          existing.primaryType = 'send';
        }
      }
    }
  }

  const out = [];
  for (const { tx, primaryType } of byHash.values()) {
    const txhash = String(tx.txhash || '');
    const timestamp = String(tx.timestamp || '');
    const heightRaw = tx.height;
    const height =
      typeof heightRaw === 'number'
        ? heightRaw
        : typeof heightRaw === 'string'
          ? Number.parseInt(heightRaw, 10)
          : undefined;

    let from = '';
    let to = '';
    let outAmount = 0n;
    let inAmount = 0n;
    let outDenom = '';
    let inDenom = '';

    const eventsForTransfers = (() => {
      const logs = Array.isArray(tx.logs) ? tx.logs : [];
      const fromLogs = [];
      for (const log of logs) {
        const events = Array.isArray(log && log.events ? log.events : []) ? log.events : [];
        fromLogs.push(...events);
      }
      if (fromLogs.length) return fromLogs;
      return Array.isArray(tx.events) ? tx.events : [];
    })();

    for (const ev of eventsForTransfers) {
      if (!ev || ev.type !== 'transfer') continue;
      const attrs = Array.isArray(ev.attributes) ? ev.attributes : [];

      let sender = '';
      let recipient = '';
      let amountRaw = '';
      for (const a of attrs) {
        const key = String(a && a.key ? a.key : '').toLowerCase();
        const val = String(a && a.value ? a.value : '');

        if (key === 'sender') sender = val;
        else if (key === 'recipient') recipient = val;
        else if (key === 'amount') amountRaw = val;
      }

      if (!amountRaw) continue;
      const first = String(amountRaw.split(',')[0] || '').trim();
      const m = first.match(/^(\d+)([a-zA-Z0-9/]+)$/);
      if (!m) continue;
      const amt = BigInt(m[1]);
      const denom = m[2];

      // Always capture from/to addresses for display
      if (!from && sender) from = sender;
      if (!to && recipient) to = recipient;

      if (sender === address) {
        from = sender;
        to = recipient || to;
        outAmount += amt;
        if (!outDenom) outDenom = denom;
      } else if (recipient === address) {
        from = from || sender;
        to = recipient;
        inAmount += amt;
        if (!inDenom) inDenom = denom;
      }
    }

    // Fallback: Try to extract from/to from tx body messages if not found in events
    if ((!from || !to) && tx.tx && tx.tx.body) {
      try {
        const body = tx.tx.body;
        const messages = Array.isArray(body.messages) ? body.messages : [];
        
        for (const msg of messages) {
          if (!msg) continue;
          
          // MsgSend: /cosmos.bank.v1beta1.MsgSend
          if (msg['@type'] === '/cosmos.bank.v1beta1.MsgSend' || msg.typeUrl === '/cosmos.bank.v1beta1.MsgSend') {
            const fromAddr = msg.from_address || msg.fromAddress;
            const toAddr = msg.to_address || msg.toAddress;
            const amounts = Array.isArray(msg.amount) ? msg.amount : [];
            
            if (!from && fromAddr) from = String(fromAddr);
            if (!to && toAddr) to = String(toAddr);
            
            // Extract amount if not already found
            if (amounts.length > 0 && outAmount === 0n && inAmount === 0n) {
              const coin = amounts[0];
              const amt = BigInt(coin.amount || '0');
              const denom = String(coin.denom || '');
              
              if (fromAddr === address) {
                outAmount = amt;
                outDenom = denom;
              } else if (toAddr === address) {
                inAmount = amt;
                inDenom = denom;
              }
            }
          }
          
          // Other message types
          const fromAddr = msg.from_address || msg.fromAddress || msg.delegator_address || msg.delegatorAddress || msg.sender;
          const toAddr = msg.to_address || msg.toAddress || msg.validator_address || msg.validatorAddress || msg.recipient;
          
          if (!from && fromAddr) from = String(fromAddr);
          if (!to && toAddr) to = String(toAddr);
          
          if (from && to) break;
        }
      } catch (e) {
        // Silently ignore fallback errors
      }
    }

    const type = primaryType || (outAmount > 0n ? 'send' : inAmount > 0n ? 'receive' : 'unknown');

    const amounts = [];
    if (outAmount > 0n && outDenom) {
      amounts.push({ amount: outAmount.toString(), denom: outDenom });
    } else if (inAmount > 0n && inDenom) {
      amounts.push({ amount: inAmount.toString(), denom: inDenom });
    }

    const memo =
      tx.tx && tx.tx.body && typeof tx.tx.body.memo === 'string' ? tx.tx.body.memo : '';

    let { action, dnsName } = extractPrimaryActionAndDnsName(tx);

    if (action === '/lumen.dns.v1.MsgTransfer') {
      const events = collectTxEvents(tx);
      const dnsFrom = findEventAttr(events, 'dns_transfer', 'from');
      const dnsTo = findEventAttr(events, 'dns_transfer', 'to');
      if (dnsFrom) from = dnsFrom;
      if (dnsTo) to = dnsTo;
    } else if (action === '/lumen.dns.v1.MsgRegister') {
      const events = collectTxEvents(tx);
      const createdBy = findEventAttr(events, 'dns_register', 'created_by');
      const owner = findEventAttr(events, 'dns_register', 'owner');
      if (createdBy) from = createdBy;
      if (owner) to = owner;
    } else if (action === '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward') {
      const events = collectTxEvents(tx);
      const validator = findEventAttr(events, 'withdraw_rewards', 'validator');
      const delegator = findEventAttr(events, 'withdraw_rewards', 'delegator');

      if (validator) {
        from = validator;
        if (!dnsName) dnsName = validator;
      }
      if (delegator) to = delegator;
    } else if (action === '/lumen.release.v1.MsgPublishRelease') {
      const events = collectTxEvents(tx);
      const publisher = findEventAttr(events, 'release_publish', 'publisher');
      if (publisher) from = publisher;
    }

    const codeRaw = tx.code ?? (tx.tx_result ? tx.tx_result.code : undefined);
    const code =
      typeof codeRaw === 'number'
        ? codeRaw
        : typeof codeRaw === 'string'
          ? Number.parseInt(codeRaw, 10)
          : undefined;

    const id = txhash || `${timestamp || ''}-${height || 0}`;
    out.push({
      id,
      txhash,
      type,
      timestamp,
      height,
      code,
      amounts,
      from: from || undefined,
      to: to || undefined,
      memo,
      action: action || undefined,
      dnsName: dnsName || undefined
    });
  }

  out.sort((a, b) => {
    const ta = new Date(a.timestamp || '').getTime() || 0;
    const tb = new Date(b.timestamp || '').getTime() || 0;
    return tb - ta;
  });

  return { ok: true, items: out };
}

// ---------------- Staking functions ----------------
async function walletGetDelegations(input) {
  const address = String(input && input.address ? input.address : '').trim();
  if (!address) {
    return { ok: false, error: 'missing address' };
  }
  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { ok: false, error: 'rest_base_missing' };
  }
  const base = trimSlash(restBase);
  const url = `${base}/cosmos/staking/v1beta1/delegations/${encodeURIComponent(address)}`;

  try {
    const res = await httpGet(url, { timeout: 10000 });
    if (!res.ok) {
      return { ok: false, status: res.status, error: 'delegations query failed' };
    }
    const delegations = Array.isArray(res.json && res.json.delegation_responses)
      ? res.json.delegation_responses
      : [];
    return { ok: true, delegations };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

/**
 * Stake on its way out, per validator.
 *
 * Separate from the delegations above because the chain keeps it separate: an
 * undelegation leaves the delegation immediately and stays in an unbonding
 * queue for the unbonding period, belonging to neither the validator nor the
 * wallet's spendable balance until it completes. A UI that only reads
 * delegations shows that stake as gone.
 */
async function walletGetUnbondingDelegations(input) {
  const address = String(input && input.address ? input.address : '').trim();
  if (!address) {
    return { ok: false, error: 'missing address' };
  }
  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { ok: false, error: 'rest_base_missing' };
  }
  const base = trimSlash(restBase);
  const url = `${base}/cosmos/staking/v1beta1/delegators/${encodeURIComponent(address)}/unbonding_delegations`;

  try {
    const res = await httpGet(url, { timeout: 10000 });
    if (!res.ok) {
      return { ok: false, status: res.status, error: 'unbonding query failed' };
    }
    const unbonding = Array.isArray(res.json && res.json.unbonding_responses)
      ? res.json.unbonding_responses
      : [];
    return { ok: true, unbonding };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

/**
 * Rewards accrued and not yet claimed, per validator.
 *
 * The distribution module answers in decimal ulmn - "2093587.342379405193" -
 * because rewards accrue continuously between blocks. The fractional part is
 * never claimable on its own, but it is returned as-is here: rounding belongs
 * where the number is displayed, not where it is fetched.
 */
async function walletGetStakingRewards(input) {
  const address = String(input && input.address ? input.address : '').trim();
  if (!address) {
    return { ok: false, error: 'missing address' };
  }
  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { ok: false, error: 'rest_base_missing' };
  }
  const base = trimSlash(restBase);
  const url = `${base}/cosmos/distribution/v1beta1/delegators/${encodeURIComponent(address)}/rewards`;

  try {
    const res = await httpGet(url, { timeout: 10000 });
    if (!res.ok) {
      return { ok: false, status: res.status, error: 'rewards query failed' };
    }
    const rewards = Array.isArray(res.json && res.json.rewards) ? res.json.rewards : [];
    const total = Array.isArray(res.json && res.json.total) ? res.json.total : [];
    return { ok: true, rewards, total };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

// ---------------- DNS helpers (pricing) ----------------
const TIER_BPS_DENOM = 10_000n;
const SDK_DEC_PRECISION = 1_000_000_000_000_000_000n; // 1e18

function parseLengthTiers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry) return null;
      const maxLen = Number(entry.max_len ?? entry.maxLen ?? 0);
      const multiplier = Number(
        entry.multiplier_bps ?? entry.multiplierBps ?? entry.multiplier ?? 0
      );
      if (!Number.isFinite(multiplier) || multiplier <= 0) return null;
      if (!Number.isFinite(maxLen) || maxLen < 0) {
        return { maxLen: 0, multiplierBps: multiplier };
      }
      return { maxLen, multiplierBps: multiplier };
    })
    .filter((x) => !!x);
}

function pickTier(length, tiers) {
  if (!Array.isArray(tiers) || !tiers.length) {
    return { multiplier: Number(TIER_BPS_DENOM) };
  }
  for (const tier of tiers) {
    if (!tier) continue;
    if (tier.maxLen === 0 || length <= tier.maxLen) {
      return { multiplier: tier.multiplierBps, tier };
    }
  }
  const last = tiers[tiers.length - 1];
  return {
    multiplier: last && Number.isFinite(last.multiplierBps)
      ? last.multiplierBps
      : Number(TIER_BPS_DENOM),
    tier: last || null
  };
}

function monthsFromDays(durationDays) {
  if (!Number.isFinite(durationDays) || durationDays <= 0) return 1;
  const days = Math.floor(durationDays);
  const months = Math.floor((days + 29) / 30);
  return months > 0 ? months : 1;
}

function applyBps(amount, multiplierBps) {
  if (amount === 0n) return amount;
  const bps = BigInt(Math.max(0, multiplierBps));
  if (bps === 0n) return 0n;
  const num = amount * bps;
  const div = num / TIER_BPS_DENOM;
  return num % TIER_BPS_DENOM === 0n ? div : div + 1n;
}

function parsePositiveBigInt(value, label) {
  try {
    const asBig = BigInt(String(value ?? '0'));
    if (asBig <= 0n) throw new Error(`${label} must be > 0`);
    return asBig;
  } catch {
    throw new Error(`invalid ${label}`);
  }
}

function parseSdkDec(value) {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('base_fee_dns missing');
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error('invalid base_fee_dns');
  const parts = raw.split('.');
  const intPart = parts[0] || '0';
  const fracPart = parts[1] || '';
  const frac = (fracPart + '000000000000000000').slice(0, 18);
  return BigInt(intPart) * SDK_DEC_PRECISION + BigInt(frac || '0');
}

function mulDec(amount, dec) {
  if (amount === 0n || dec === 0n) return 0n;
  const num = amount * dec;
  const div = num / SDK_DEC_PRECISION;
  return num % SDK_DEC_PRECISION === 0n ? div : div + 1n;
}

async function dnsGetParams() {
  const LCD_TIMEOUT_MS = 20_000;
  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { ok: false, error: 'rest_base_missing' };
  }
  const url = `${trimSlash(restBase)}/lumen/dns/v1/params`;
  const res = await httpGet(url, { timeout: LCD_TIMEOUT_MS });
  if (!res.ok) {
    return { ok: false, status: res.status, error: res.error || `http_${res.status}` };
  }
  return { ok: true, data: res.json || null };
}

async function pqcGetParams() {
  const LCD_TIMEOUT_MS = 20_000;
  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { ok: false, error: 'rest_base_missing' };
  }
  const url = `${trimSlash(restBase)}/lumen/pqc/v1/params`;
  const res = await httpGet(url, { timeout: LCD_TIMEOUT_MS });
  if (!res.ok) {
    return { ok: false, status: res.status, error: res.error || `http_${res.status}` };
  }
  const data = res.json || null;
  const params = (data && (data.params || data)) || data || null;
  return { ok: true, data: { params } };
}

// "This account has no key yet", told apart from a node that is simply broken.
// A gRPC not-found normally arrives as 404, but the pqc module raises the SDK's
// own not-found and the gateway maps that to 500, so the body is the only
// reliable signal. A malformed address (400) is deliberately not in here: that
// is the caller's mistake, and reporting it as "not linked" would hide it.
function isPqcRecordMissing(res) {
  if (res.status === 404) return true;
  const message = String((res.json && res.json.message) || res.text || '');
  if (/no pqc record/i.test(message)) return true;
  return Number(res.json && res.json.code) === 2 && /not found/i.test(message);
}

async function pqcGetAccount(addressInput) {
  const LCD_TIMEOUT_MS = 20_000;
  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { ok: false, error: 'rest_base_missing' };
  }

  const address = String(addressInput || '').trim();
  if (!address) return { ok: false, error: 'missing_address' };

  const url = `${trimSlash(restBase)}/lumen/pqc/v1/accounts/${encodeURIComponent(address)}`;
  const res = await httpGet(url, { timeout: LCD_TIMEOUT_MS });

  // An address with no key yet is the normal case, not a failure - and the
  // chain reports it as `500 {"code":2,"message":"...not found: no pqc record
  // for lmn1..."}`, not as a 404. Recognised by the body: a bare 500 also means
  // the node is broken, and answering "not linked" to that would be a lie.
  if (!res.ok && isPqcRecordMissing(res)) {
    return { ok: true, linked: false, account: null };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: res.error || `http_${res.status}` };
  }

  const data = res.json || null;
  const account = (data && (data.account || data)) || data || null;
  const pubKeyHash =
    account && (account.pubKeyHash || account.pub_key_hash || account.pubKey || account.pub_key)
      ? String(account.pubKeyHash || account.pub_key_hash || account.pubKey || account.pub_key)
      : '';
  return { ok: true, linked: !!pubKeyHash, account };
}

async function dnsGetDomainInfo(nameInput) {
  const LCD_TIMEOUT_MS = 20_000;
  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { ok: false, error: 'rest_base_missing' };
  }
  const name = String(nameInput || '').trim();
  if (!name) return { ok: false, error: 'missing_name' };
  const url = `${trimSlash(restBase)}/lumen/dns/v1/domain/${encodeURIComponent(name)}`;
  const res = await httpGet(url, { timeout: LCD_TIMEOUT_MS });
  if (!res.ok) {
    return { ok: false, status: res.status, error: res.error || `http_${res.status}` };
  }
  const data = res.json && (res.json.domain || res.json) ? res.json : null;
  return { ok: true, data };
}

async function dnsEstimateRegisterPrice(input) {
  try {
    let domain = String(input && input.domain ? input.domain : '').trim();
    let ext = String(input && input.ext ? input.ext : '').trim();
    const fqdn = String(input && input.name ? input.name : '').trim();

    if ((!domain || !ext) && fqdn) {
      const m = fqdn.match(/^([^\.]+)\.([^\.]+)$/);
      if (m) {
        domain = m[1];
        ext = m[2];
      }
    }

    if (!domain || !ext) {
      return { ok: false, error: 'missing domain/ext' };
    }

    const paramsRes = await dnsGetParams();
    if (!paramsRes || paramsRes.ok === false) {
      return {
        ok: false,
        error: (paramsRes && paramsRes.error) || 'dns_params_unavailable'
      };
    }

    const params =
      (paramsRes.data && (paramsRes.data.params || paramsRes.data)) ||
      paramsRes.data ||
      {};

    const minPriceRaw =
      params.min_price_ulmn_per_month ?? params.minPriceUlmnPerMonth;
    const baseFeeRaw = params.base_fee_dns ?? params.baseFeeDns ?? '1';
    const domainTiersRaw = params.domain_tiers ?? params.domainTiers ?? [];
    const extTiersRaw = params.ext_tiers ?? params.extTiers ?? [];

    const durationDaysRaw =
      Number(
        input && (input.duration_days ?? input.durationDays ?? input.days)
      ) || 0;
    const durationDays =
      Number.isFinite(durationDaysRaw) && durationDaysRaw > 0
        ? durationDaysRaw
        : 365;
    const months = monthsFromDays(durationDays);

    const minPrice = parsePositiveBigInt(
      minPriceRaw,
      'min_price_ulmn_per_month'
    );
    let quoted = minPrice * BigInt(months);

    const domainTiers = parseLengthTiers(domainTiersRaw);
    const extTiers = parseLengthTiers(extTiersRaw);
    const domainTier = pickTier(domain.length, domainTiers);
    const extTier = pickTier(ext.length, extTiers);

    quoted = applyBps(quoted, domainTier.multiplier);
    quoted = applyBps(quoted, extTier.multiplier);
    const baseAfterTiers = quoted;

    const multiplierDec = parseSdkDec(baseFeeRaw);
    const amountBig = mulDec(baseAfterTiers, multiplierDec);
    const amountStr = amountBig.toString();
    const amountNumber =
      amountBig <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(amountBig)
        : null;
    const amountLMN =
      amountNumber == null ? null : amountNumber / 1_000_000;

    return {
      ok: true,
      denom: 'ulmn',
      amount: amountStr,
      amountNumber,
      amountLMN,
      detail: {
        months,
        durationDays,
        minPriceUlmnPerMonth: minPrice.toString(),
        baseFeeDns: String(baseFeeRaw),
        domainTier: domainTier.tier || null,
        extTier: extTier.tier || null,
        domainMultiplierBps: domainTier.multiplier,
        extMultiplierBps: extTier.multiplier,
        baseAfterTiersUlmn: baseAfterTiers.toString()
      }
    };
  } catch (e) {
    return {
      ok: false,
      error: String(e && e.message ? e.message : e)
    };
  }
}

async function dnsListByOwnerDetailed(ownerInput) {
  const LCD_LIST_TIMEOUT_MS = 20_000;
  const LCD_ITEM_TIMEOUT_MS = 15_000;
  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { ok: false, error: 'rest_base_missing' };
  }
  const owner = String(ownerInput || '').trim();
  if (!owner) return { ok: false, error: 'missing_owner' };

  const byOwnerUrl = `${trimSlash(restBase)}/lumen/dns/v1/domains_by_owner/${encodeURIComponent(owner)}`;
  const listRes = await httpGet(byOwnerUrl, { timeout: LCD_LIST_TIMEOUT_MS });
  if (!listRes.ok) {
    return { ok: false, status: listRes.status, error: listRes.error || `http_${listRes.status}` };
  }
  const names = Array.isArray(listRes.json?.domains)
    ? listRes.json.domains
    : Array.isArray(listRes.json)
      ? listRes.json
      : [];
  if (!names.length) return { ok: true, data: [] };

  const out = [];
  for (const rawName of names) {
    const name = String(rawName || '').trim();
    if (!name) continue;
    try {
      const u = `${trimSlash(restBase)}/lumen/dns/v1/domain/${encodeURIComponent(name)}`;
      const d = await httpGet(u, { timeout: LCD_ITEM_TIMEOUT_MS });
      if (!d.ok) continue;
      const dom = (d.json && (d.json.domain || d.json)) || {};
      out.push(dom);
    } catch {
      // ignore per-domain errors
    }
  }
  return { ok: true, data: out };
}

function registerChainIpc() {
  ipcMain.handle('rpc:getHeight', async () => {
    const before = getChainState();
    // Nothing has answered yet and no tick is in flight: ask now rather than
    // making the caller wait for the daemon's next one.
    if (!before.lastUpdated && !before.polling) {
      await pollChainOnce('ipc');
    }

    const state = getChainState();
    return {
      ok: state.status === 'ok',
      height: state.height,
      status: state.status,
      error: state.error,
      lastUpdated: state.lastUpdated,
      rpcBase: state.rpcBase,
    };
  });

  ipcMain.handle('dns:getParams', async () => {
    try {
      return await dnsGetParams();
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('dns:getDomainInfo', async (_evt, name) => {
    try {
      return await dnsGetDomainInfo(name);
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('dns:estimateRegisterPrice', async (_evt, input) => {
    return await dnsEstimateRegisterPrice(input || {});
  });

  ipcMain.handle('dns:listByOwnerDetailed', async (_evt, owner) => {
    try {
      return await dnsListByOwnerDetailed(owner);
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('chain:getTokenomicsParams', async () => {
    try {
      const restBase = getRestBaseUrl();
      if (!restBase) {
        return { ok: false, error: 'rest_base_missing' };
      }
      const url = `${trimSlash(restBase)}/lumen/tokenomics/v1/params`;
      const res = await httpGet(url, { timeout: 7000 });
      if (!res.ok) {
        return { ok: false, status: res.status, error: res.error || `http_${res.status}` };
      }
      return { ok: true, data: res.json || null };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('pqc:getParams', async () => {
    try {
      return await pqcGetParams();
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('pqc:getAccount', async (_evt, address) => {
    try {
      return await pqcGetAccount(address);
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('wallet:getBalance', async (_evt, input) => {
    try {
      return await walletGetBalance(input || {});
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('wallet:listSendTxs', async (_evt, input) => {
    try {
      return await walletListSendTxs(input || {});
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('wallet:getDelegations', async (_evt, input) => {
    try {
      return await walletGetDelegations(input || {});
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('wallet:getUnbondingDelegations', async (_evt, input) => {
    try {
      return await walletGetUnbondingDelegations(input || {});
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('wallet:getStakingRewards', async (_evt, input) => {
    try {
      return await walletGetStakingRewards(input || {});
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });
}

module.exports = {
  registerChainIpc,
};
