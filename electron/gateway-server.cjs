/**
 * Embedded Gateway Server for Lumen Browser
 * Allows users to run their own private gateway directly in the browser
 */

const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { app } = require('electron');

let gatewayServer = null;
let gatewayServerPort = null;

/**
 * Get gateway server data directory
 */
function getGatewayDataDir() {
  const userData = app.getPath('userData');
  return path.join(userData, 'gateway-server');
}

/**
 * Initialize and start the embedded gateway server
 */
async function startGatewayServer(options = {}) {
  if (gatewayServer) {
    console.log('[electron][gateway-server] Server already running on port', gatewayServerPort);
    return { ok: true, port: gatewayServerPort };
  }

  try {
    const port = options.port || 3100;
    const dataDir = getGatewayDataDir();

    // Ensure data directory exists
    const fs = require('node:fs');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Load or generate API key (persistent)
    const apiKeyPath = path.join(dataDir, 'api-key.txt');
    let apiKey;
    
    if (fs.existsSync(apiKeyPath)) {
      // Load existing API key
      apiKey = fs.readFileSync(apiKeyPath, 'utf8').trim();
      console.log('[electron][gateway-server] Loaded existing API key');
    } else {
      // Generate new API key and save it
      apiKey = generateDefaultApiKey();
      fs.writeFileSync(apiKeyPath, apiKey, 'utf8');
      console.log('[electron][gateway-server] Generated new API key');
    }

    // Set up configuration
    const config = {
      port,
      host: '127.0.0.1', // Only listen on localhost for security
      apiKey,
      database: {
        path: path.join(dataDir, 'gateway.db')
      },
      ipfs: {
        apiUrl: 'http://127.0.0.1:5001' // Use local IPFS daemon
      },
      auth: {
        timestampTolerance: 300000 // 5 minutes
      }
    };

    // Initialize database
    const { initDatabase, addToWhitelist, removeFromWhitelist, getAllWhitelistEntries,
            getWhitelistEntry, updateUsage, getUsageStats, getAggregatedUsageStats } = 
            require('./gateway-database.cjs');
    
    initDatabase(dataDir);

    // Initialize authentication module
    const { authenticateRequest, verifyApiKey, setConfig: setAuthConfig } = 
            require('./gateway-auth.cjs');
    
    // Set config for auth module
    setAuthConfig(config);

    // Create Express app
    const expressApp = express();
    expressApp.use(cors());
    expressApp.use(express.json());

    // Initialize IPFS client (using direct HTTP calls instead of ipfs-http-client)
    const ipfsApiUrl = config.ipfs.apiUrl;
    console.log('[electron][gateway-server] IPFS API URL:', ipfsApiUrl);
    
    // Helper function to fetch from IPFS
    async function ipfsCat(cid) {
      const response = await fetch(`${ipfsApiUrl}/api/v0/cat?arg=${cid}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`IPFS cat failed: ${response.statusText}`);
      }
      
      return Buffer.from(await response.arrayBuffer());
    }
    
    // Helper function to check IPFS status
    async function ipfsId() {
      const response = await fetch(`${ipfsApiUrl}/api/v0/id`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`IPFS id failed: ${response.statusText}`);
      }
      
      return response.json();
    }

    // Health check endpoint
    expressApp.get('/health', async (req, res) => {
      let ipfsStatus = false;
      try {
        await ipfsId();
        ipfsStatus = true;
      } catch (error) {
        console.error('[electron][gateway-server] IPFS health check failed:', error);
      }
      
      res.json({
        ok: true,
        ipfs: ipfsStatus,
        db: true,
        timestamp: Date.now(),
        version: '1.0.0'
      });
    });

    // Content retrieval endpoint (authenticated)
    expressApp.get('/ipfs/:cid', async (req, res) => {
      try {
        const { cid } = req.params;
        
        // Authenticate request
        const auth = await authenticateRequest(req.headers, cid);
        if (!auth.authenticated) {
          return res.status(auth.error.includes('whitelisted') ? 403 : 401).json({ 
            error: auth.error 
          });
        }
        
        // Fetch content from IPFS using direct HTTP call
        const content = await ipfsCat(cid);
        
        // Update usage statistics
        updateUsage(auth.address, content.length, 1);
        
        // Return content
        res.set('Content-Type', 'application/octet-stream');
        res.set('X-Content-Length', content.length);
        res.send(content);
        
      } catch (error) {
        console.error('[electron][gateway-server] Error fetching content:', error);
        
        if (error.message && error.message.includes('not found')) {
          return res.status(404).json({ error: 'Content not found' });
        }
        
        res.status(500).json({ error: 'Failed to fetch content' });
      }
    });

    // API key authentication middleware
    function requireApiKey(req, res, next) {
      const apiKeyHeader = req.headers['x-api-key'];
      
      if (!verifyApiKey(apiKeyHeader)) {
        return res.status(401).json({ error: 'Invalid or missing API key' });
      }
      
      next();
    }

    // Add user to whitelist
    expressApp.post('/api/whitelist', requireApiKey, (req, res) => {
      try {
        const { address, bandwidth_per_day, requests_per_day, bandwidth_per_month, requests_per_month, notes } = req.body;
        
        if (!address) {
          return res.status(400).json({ error: 'Missing wallet address' });
        }
        
        const existing = getWhitelistEntry(address);
        if (existing) {
          return res.status(409).json({ error: 'Address already whitelisted' });
        }
        
        const entry = {
          wallet_address: address,
          added_by: 'embedded-server',
          bandwidth_per_day: bandwidth_per_day || 0,
          requests_per_day: requests_per_day || 0,
          bandwidth_per_month: bandwidth_per_month || 0,
          requests_per_month: requests_per_month || 0,
          notes: notes || ''
        };
        
        addToWhitelist(entry);
        
        res.status(201).json({ 
          success: true, 
          message: 'User added to whitelist',
          entry: getWhitelistEntry(address)
        });
        
      } catch (error) {
        console.error('[electron][gateway-server] Error adding to whitelist:', error);
        res.status(500).json({ error: 'Failed to add user to whitelist' });
      }
    });

    // Remove user from whitelist
    expressApp.delete('/api/whitelist/:address', requireApiKey, (req, res) => {
      try {
        const { address } = req.params;
        
        const existing = getWhitelistEntry(address);
        if (!existing) {
          return res.status(404).json({ error: 'Address not found in whitelist' });
        }
        
        removeFromWhitelist(address);
        
        res.json({ 
          success: true, 
          message: 'User removed from whitelist' 
        });
        
      } catch (error) {
        console.error('[electron][gateway-server] Error removing from whitelist:', error);
        res.status(500).json({ error: 'Failed to remove user from whitelist' });
      }
    });

    // Get all whitelist entries
    expressApp.get('/api/whitelist', requireApiKey, (req, res) => {
      try {
        const entries = getAllWhitelistEntries();
        
        const entriesWithUsage = entries.map(entry => {
          const dailyUsage = getUsageStats(entry.wallet_address, 'day');
          const monthlyUsage = getUsageStats(entry.wallet_address, 'month');
          
          return {
            ...entry,
            usage: {
              daily: dailyUsage || { bandwidth_used: 0, request_count: 0 },
              monthly: monthlyUsage || { bandwidth_used: 0, request_count: 0 }
            }
          };
        });
        
        res.json({ 
          success: true, 
          count: entriesWithUsage.length,
          entries: entriesWithUsage 
        });
        
      } catch (error) {
        console.error('[electron][gateway-server] Error getting whitelist:', error);
        res.status(500).json({ error: 'Failed to get whitelist' });
      }
    });

    // Get usage statistics for a specific address
    expressApp.get('/api/usage/:address', requireApiKey, (req, res) => {
      try {
        const { address } = req.params;
        
        const entry = getWhitelistEntry(address);
        if (!entry) {
          return res.status(404).json({ error: 'Address not found in whitelist' });
        }
        
        const dailyUsage = getUsageStats(address, 'day');
        const monthlyUsage = getUsageStats(address, 'month');
        
        res.json({
          success: true,
          address,
          limits: {
            bandwidth_per_day: entry.bandwidth_per_day,
            requests_per_day: entry.requests_per_day,
            bandwidth_per_month: entry.bandwidth_per_month,
            requests_per_month: entry.requests_per_month
          },
          usage: {
            daily: dailyUsage || { bandwidth_used: 0, request_count: 0, last_request: null },
            monthly: monthlyUsage || { bandwidth_used: 0, request_count: 0, last_request: null }
          },
          remaining: {
            daily_bandwidth: entry.bandwidth_per_day > 0 
              ? Math.max(0, entry.bandwidth_per_day - (dailyUsage?.bandwidth_used || 0))
              : -1,
            daily_requests: entry.requests_per_day > 0 
              ? Math.max(0, entry.requests_per_day - (dailyUsage?.request_count || 0))
              : -1,
            monthly_bandwidth: entry.bandwidth_per_month > 0 
              ? Math.max(0, entry.bandwidth_per_month - (monthlyUsage?.bandwidth_used || 0))
              : -1,
            monthly_requests: entry.requests_per_month > 0 
              ? Math.max(0, entry.requests_per_month - (monthlyUsage?.request_count || 0))
              : -1
          }
        });
        
      } catch (error) {
        console.error('[electron][gateway-server] Error getting usage stats:', error);
        res.status(500).json({ error: 'Failed to get usage statistics' });
      }
    });

    // Get aggregated usage statistics
    expressApp.get('/api/usage', requireApiKey, (req, res) => {
      try {
        const stats = getAggregatedUsageStats();
        
        res.json({
          success: true,
          stats
        });
        
      } catch (error) {
        console.error('[electron][gateway-server] Error getting aggregated stats:', error);
        res.status(500).json({ error: 'Failed to get usage statistics' });
      }
    });

    // Error handling middleware
    expressApp.use((err, req, res, next) => {
      console.error('[electron][gateway-server] Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });

    // Start server
    return new Promise((resolve, reject) => {
      const server = expressApp.listen(port, config.host, () => {
        gatewayServer = server;
        gatewayServerPort = port;
        console.log(`[electron][gateway-server] Running on http://${config.host}:${port}`);
        console.log(`[electron][gateway-server] API Key: ${apiKey}`);
        console.log(`[electron][gateway-server] Database: ${config.database.path}`);
        resolve({ ok: true, port, apiKey, url: `http://${config.host}:${port}` });
      });

      server.on('error', (error) => {
        console.error('[electron][gateway-server] Failed to start:', error);
        reject(error);
      });
    });

  } catch (error) {
    console.error('[electron][gateway-server] Initialization error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Stop the embedded gateway server
 */
function stopGatewayServer() {
  return new Promise((resolve) => {
    if (!gatewayServer) {
      console.log('[electron][gateway-server] Server not running');
      resolve({ ok: true });
      return;
    }

    gatewayServer.close(() => {
      console.log('[electron][gateway-server] Server stopped');
      gatewayServer = null;
      gatewayServerPort = null;
      resolve({ ok: true });
    });
  });
}

/**
 * Get gateway server status
 */
function getGatewayServerStatus() {
  return {
    running: !!gatewayServer,
    port: gatewayServerPort,
    url: gatewayServerPort ? `http://127.0.0.1:${gatewayServerPort}` : null
  };
}

/**
 * Generate a default API key
 */
function generateDefaultApiKey() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get the stored API key (if exists)
 */
function getStoredApiKey() {
  const dataDir = getGatewayDataDir();
  const apiKeyPath = path.join(dataDir, 'api-key.txt');
  const fs = require('node:fs');
  
  if (fs.existsSync(apiKeyPath)) {
    return fs.readFileSync(apiKeyPath, 'utf8').trim();
  }
  
  return null;
}

module.exports = {
  startGatewayServer,
  stopGatewayServer,
  getGatewayServerStatus,
  getGatewayDataDir,
  getStoredApiKey
};
