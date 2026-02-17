/**
 * Simple JSON-based database for embedded gateway server
 * No native dependencies required
 */

const fs = require('node:fs');
const path = require('node:path');

let dbPath = null;
let db = null;

/**
 * Initialize database
 */
function initDatabase(dataPath) {
  dbPath = path.join(dataPath, 'gateway-db.json');
  
  // Load or create database
  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf8');
      db = JSON.parse(data);
    } catch (e) {
      console.error('[gateway-db] Failed to load database:', e);
      db = createEmptyDb();
    }
  } else {
    db = createEmptyDb();
    saveDb();
  }
  
  return db;
}

function createEmptyDb() {
  return {
    whitelist: {},
    usage: {}
  };
}

function saveDb() {
  if (!dbPath || !db) return;
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('[gateway-db] Failed to save database:', e);
  }
}

/**
 * Add user to whitelist
 */
function addToWhitelist(entry) {
  if (!db) throw new Error('Database not initialized');
  
  db.whitelist[entry.wallet_address] = {
    wallet_address: entry.wallet_address,
    added_at: Date.now(),
    added_by: entry.added_by || 'embedded-server',
    bandwidth_per_day: entry.bandwidth_per_day || 0,
    requests_per_day: entry.requests_per_day || 0,
    bandwidth_per_month: entry.bandwidth_per_month || 0,
    requests_per_month: entry.requests_per_month || 0,
    enabled: true,
    notes: entry.notes || ''
  };
  
  saveDb();
  return true;
}

/**
 * Remove user from whitelist
 */
function removeFromWhitelist(address) {
  if (!db) throw new Error('Database not initialized');
  
  if (db.whitelist[address]) {
    delete db.whitelist[address];
    // Also remove usage data
    Object.keys(db.usage).forEach(key => {
      if (key.startsWith(address + ':')) {
        delete db.usage[key];
      }
    });
    saveDb();
    return true;
  }
  return false;
}

/**
 * Check if address is whitelisted
 */
function isWhitelisted(address) {
  if (!db) return false;
  return db.whitelist[address] && db.whitelist[address].enabled;
}

/**
 * Get whitelist entry
 */
function getWhitelistEntry(address) {
  if (!db) return null;
  return db.whitelist[address] || null;
}

/**
 * Get all whitelist entries
 */
function getAllWhitelistEntries() {
  if (!db) return [];
  return Object.values(db.whitelist);
}

/**
 * Update usage statistics
 */
function updateUsage(address, bandwidth, requests = 1) {
  if (!db) throw new Error('Database not initialized');
  
  const now = Date.now();
  const dayStart = new Date(now).setHours(0, 0, 0, 0);
  const monthStart = new Date(now).setDate(1);
  new Date(monthStart).setHours(0, 0, 0, 0);
  
  // Update daily usage
  const dailyKey = `${address}:day:${dayStart}`;
  if (!db.usage[dailyKey]) {
    db.usage[dailyKey] = {
      wallet_address: address,
      period_start: dayStart,
      period_end: dayStart + 24 * 60 * 60 * 1000,
      bandwidth_used: 0,
      request_count: 0,
      last_request: null
    };
  }
  db.usage[dailyKey].bandwidth_used += bandwidth;
  db.usage[dailyKey].request_count += requests;
  db.usage[dailyKey].last_request = now;
  
  // Update monthly usage
  const monthlyKey = `${address}:month:${monthStart}`;
  if (!db.usage[monthlyKey]) {
    const monthEnd = new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1)).getTime();
    db.usage[monthlyKey] = {
      wallet_address: address,
      period_start: monthStart,
      period_end: monthEnd,
      bandwidth_used: 0,
      request_count: 0,
      last_request: null
    };
  }
  db.usage[monthlyKey].bandwidth_used += bandwidth;
  db.usage[monthlyKey].request_count += requests;
  db.usage[monthlyKey].last_request = now;
  
  saveDb();
}

/**
 * Get usage statistics
 */
function getUsageStats(address, period = 'day') {
  if (!db) return null;
  
  const now = Date.now();
  let periodStart;
  
  if (period === 'day') {
    periodStart = new Date(now).setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    periodStart = new Date(now).setDate(1);
    new Date(periodStart).setHours(0, 0, 0, 0);
  } else {
    return null;
  }
  
  const key = `${address}:${period}:${periodStart}`;
  return db.usage[key] || null;
}

/**
 * Get aggregated usage statistics
 */
function getAggregatedUsageStats() {
  if (!db) return { daily: {}, monthly: {} };
  
  const now = Date.now();
  const dayStart = new Date(now).setHours(0, 0, 0, 0);
  const monthStart = new Date(now).setDate(1);
  new Date(monthStart).setHours(0, 0, 0, 0);
  
  const dailyStats = {
    active_users: 0,
    total_bandwidth: 0,
    total_requests: 0
  };
  
  const monthlyStats = {
    active_users: 0,
    total_bandwidth: 0,
    total_requests: 0
  };
  
  const dailyUsers = new Set();
  const monthlyUsers = new Set();
  
  Object.entries(db.usage).forEach(([key, usage]) => {
    if (key.includes(':day:') && usage.period_start === dayStart) {
      dailyUsers.add(usage.wallet_address);
      dailyStats.total_bandwidth += usage.bandwidth_used;
      dailyStats.total_requests += usage.request_count;
    }
    if (key.includes(':month:') && usage.period_start === monthStart) {
      monthlyUsers.add(usage.wallet_address);
      monthlyStats.total_bandwidth += usage.bandwidth_used;
      monthlyStats.total_requests += usage.request_count;
    }
  });
  
  dailyStats.active_users = dailyUsers.size;
  monthlyStats.active_users = monthlyUsers.size;
  
  return {
    daily: dailyStats,
    monthly: monthlyStats
  };
}

/**
 * Clean up old usage records
 */
function cleanupOldUsage(daysToKeep = 90) {
  if (!db) return 0;
  
  const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  let count = 0;
  
  Object.keys(db.usage).forEach(key => {
    const usage = db.usage[key];
    if (usage.period_end < cutoffTime) {
      delete db.usage[key];
      count++;
    }
  });
  
  if (count > 0) {
    saveDb();
  }
  
  return count;
}

module.exports = {
  initDatabase,
  addToWhitelist,
  removeFromWhitelist,
  isWhitelisted,
  getWhitelistEntry,
  getAllWhitelistEntries,
  updateUsage,
  getUsageStats,
  getAggregatedUsageStats,
  cleanupOldUsage
};
