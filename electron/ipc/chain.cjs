const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { httpGet } = require('./http.cjs');

function trimSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

function ensureHttp(u) {
  const trimmed = trimSlash(u);
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function resolvePeersFilePath() {
  const appPath = app && typeof app.getAppPath === 'function' ? app.getAppPath() : process.cwd();

  // Try multiple possible locations for peers.txt
  const candidates = [
    path.join(appPath, 'resources', 'peers.txt'),
    path.join(appPath, '..', 'resources', 'peers.txt'), // dev mode: electron/../resources
    path.join(process.cwd(), 'resources', 'peers.txt'),
  ];

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        console.log('[rpc] found peers file at:', file);
        return file;
      }
    } catch {}
  }

  return null;
}

function parsePeerLine(line) {
  const cleaned = String(line || '').replace(/#.*/, '').trim();
  if (!cleaned) return null;
  const parts = cleaned.split(/[\s,]+/).filter(Boolean);
  if (!parts.length) return null;
  const rpc = parts[0];
  if (!rpc) return null;
  const rest = parts[1] || null;
  const grpc = parts[2] || null;
  return { rpc, rest, grpc };
}

function loadPeersFromFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const peers = [];
    for (const line of raw.split(/\r?\n/)) {
      const parsed = parsePeerLine(line);
      if (parsed) peers.push(parsed);
    }
    return peers;
  } catch (e) {
    console.warn(
      '[rpc] unable to read peers file:',
      filePath,
      e && e.message ? e.message : e
    );
    return [];
  }
}

function getRpcBaseUrl() {
  const peersFile = resolvePeersFilePath();
  if (!peersFile) {
    console.warn('[rpc] peers file not found');
    return null;
  }

  const peers = loadPeersFromFile(peersFile);
  if (!peers.length) {
    console.warn('[rpc] no valid peers found in', peersFile);
    return null;
  }

  const first = peers[0];
  if (!first || !first.rpc) {
    return null;
  }

  const base = ensureHttp(first.rpc);
  console.log('[rpc] using base endpoint from peers file:', base);
  return base;
}

function getRestBaseUrl() {
  const peersFile = resolvePeersFilePath();
  if (!peersFile) {
    console.warn('[dns] peers file not found');
    return null;
  }

  const peers = loadPeersFromFile(peersFile);
  if (!peers.length) {
    console.warn('[dns] no valid peers found in', peersFile);
    return null;
  }

  const first = peers[0];
  if (!first) return null;

  let rest = first.rest || '';
  if (rest) {
    const base = ensureHttp(rest);
    console.log('[dns] using REST endpoint from peers file:', base);
    return base;
  }

  // Derive REST from RPC as a fallback (e.g. 26657 -> 1317)
  if (!first.rpc) return null;
  const rpcBase = ensureHttp(first.rpc);
  try {
    const u = new URL(rpcBase);
    const port = Number(u.port || '');
    if (port === 26657) {
      u.port = '1317';
    }
    const derived = trimSlash(u.toString());
    console.log('[dns] derived REST endpoint from RPC:', derived);
    return derived;
  } catch {
    console.warn('[dns] failed to derive REST endpoint from RPC, falling back to RPC base');
    return rpcBase;
  }
}

const chainState = {
  rpcBase: null,
  height: null,
  status: 'idle',
  error: null,
  lastUpdated: 0,
  polling: false,
};

let chainPollTimer = null;

async function pollChainOnce(reason) {
  if (chainState.polling) return;
  chainState.polling = true;

  try {
    const base = getRpcBaseUrl();
    if (!base) {
      chainState.rpcBase = null;
      chainState.height = null;
      chainState.status = 'error';
      chainState.error = 'rpc_base_missing';
      chainState.lastUpdated = Date.now();
      return;
    }

    chainState.rpcBase = base;

    const url = `${trimSlash(base)}/status`;
    const res = await httpGet(url, { timeout: 7000 });

    let data = res && res.json ? res.json : null;
    if (!data && res && typeof res.text === 'string' && res.text) {
      try {
        data = JSON.parse(res.text);
      } catch {
        data = null;
      }
    }

    const raw =
      data &&
      data.result &&
      data.result.sync_info &&
      data.result.sync_info.latest_block_height;
    const height = Number(raw);

    if (!Number.isFinite(height) || height <= 0) {
      chainState.height = null;
      chainState.status = 'error';
      chainState.error = 'invalid_height';
      chainState.lastUpdated = Date.now();
      return;
    }

    const prevHeight = chainState.height;
    chainState.height = height;
    chainState.status = 'ok';
    chainState.error = null;
    chainState.lastUpdated = Date.now();

    if (height !== prevHeight) {
      broadcastChainState();
    }
  } catch (e) {
    chainState.height = null;
    chainState.status = 'error';
    chainState.error = String(e && e.message ? e.message : e);
    chainState.lastUpdated = Date.now();
  } finally {
    chainState.polling = false;
  }
}

function broadcastChainState() {
  const payload = {
    height: chainState.height,
    status: chainState.status,
    error: chainState.error,
    lastUpdated: chainState.lastUpdated,
    rpcBase: chainState.rpcBase,
  };
  try {
    const all = BrowserWindow.getAllWindows();
    for (const win of all) {
      try {
        win.webContents.send('rpc:heightChanged', payload);
      } catch {}
    }
  } catch {}
}

function scheduleNextChainPoll(delayMs) {
  if (chainPollTimer) clearTimeout(chainPollTimer);
  chainPollTimer = setTimeout(() => {
    pollChainOnce('interval').catch(() => {});
    scheduleNextChainPoll(5000);
  }, delayMs);
}

function startChainPoller() {
  if (chainPollTimer) return;
  scheduleNextChainPoll(1000);
}

function stopChainPoller() {
  if (chainPollTimer) {
    clearTimeout(chainPollTimer);
    chainPollTimer = null;
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
          console.warn(
            '[wallet] listSendTxs lcdTxSearch error',
            entry.filter,
            res1 && res1.status,
            res2 && res2.status,
            res1 && res1.error,
            res2 && res2.error
          );
          continue;
        }
        const data2 = res2.json || {};
        txs = Array.isArray(data2.tx_responses) ? data2.tx_responses : [];
      }
    } catch (e) {
      console.warn('[wallet] listSendTxs lcdTxSearch exception', entry.filter, e && e.message ? e.message : e);
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

    const logs = Array.isArray(tx.logs) ? tx.logs : [];
    for (const log of logs) {
      const events = Array.isArray(log && log.events ? log.events : []) ? log.events : [];
      for (const ev of events) {
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

    const id = txhash || `${timestamp || ''}-${height || 0}`;
    out.push({
      id,
      txhash,
      type,
      timestamp,
      height,
      amounts,
      from,
      to,
      memo
    });
  }

  out.sort((a, b) => {
    const ta = new Date(a.timestamp || '').getTime() || 0;
    const tb = new Date(b.timestamp || '').getTime() || 0;
    return tb - ta;
  });

  return { ok: true, items: out };
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
  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { ok: false, error: 'rest_base_missing' };
  }
  const url = `${trimSlash(restBase)}/lumen/dns/v1/params`;
  const res = await httpGet(url, { timeout: 7000 });
  if (!res.ok) {
    return { ok: false, status: res.status, error: res.error || `http_${res.status}` };
  }
  return { ok: true, data: res.json || null };
}

async function pqcGetParams() {
  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { ok: false, error: 'rest_base_missing' };
  }
  const url = `${trimSlash(restBase)}/lumen/pqc/v1/params`;
  const res = await httpGet(url, { timeout: 7000 });
  if (!res.ok) {
    return { ok: false, status: res.status, error: res.error || `http_${res.status}` };
  }
  const data = res.json || null;
  const params = (data && (data.params || data)) || data || null;
  return { ok: true, data: { params } };
}

async function dnsGetDomainInfo(nameInput) {
  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { ok: false, error: 'rest_base_missing' };
  }
  const name = String(nameInput || '').trim();
  if (!name) return { ok: false, error: 'missing_name' };
  const url = `${trimSlash(restBase)}/lumen/dns/v1/domain/${encodeURIComponent(name)}`;
  const res = await httpGet(url, { timeout: 7000 });
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
  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { ok: false, error: 'rest_base_missing' };
  }
  const owner = String(ownerInput || '').trim();
  if (!owner) return { ok: false, error: 'missing_owner' };

  const byOwnerUrl = `${trimSlash(restBase)}/lumen/dns/v1/domains_by_owner/${encodeURIComponent(owner)}`;
  const listRes = await httpGet(byOwnerUrl, { timeout: 7000 });
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
      const d = await httpGet(u, { timeout: 7000 });
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
    if (!chainState.lastUpdated && !chainState.polling) {
      await pollChainOnce('ipc');
    }

    return {
      ok: chainState.status === 'ok',
      height: chainState.height,
      status: chainState.status,
      error: chainState.error,
      lastUpdated: chainState.lastUpdated,
      rpcBase: chainState.rpcBase,
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
}

module.exports = {
  registerChainIpc,
  startChainPoller,
  stopChainPoller,
};
