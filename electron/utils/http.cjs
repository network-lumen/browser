const http = require('http');
const https = require('https');

// Refuses anything else rather than guessing: the release download URL comes
// from the chain, and picking a transport for a protocol nobody checked is how
// a wrong one gets used.
function httpModuleForUrl(url) {
  const protocol = String((url && url.protocol) || '');
  if (protocol === 'https:') return https;
  if (protocol === 'http:') return http;
  throw new Error(`unsupported_protocol:${protocol || 'none'}`);
}

module.exports = { httpModuleForUrl };
