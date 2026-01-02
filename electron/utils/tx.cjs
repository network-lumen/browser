function isSocketClosedError(err) {
  const code = err && (err.cause && err.cause.code ? err.cause.code : err.code);
  if (code === 'UND_ERR_SOCKET') return true;
  const msg = String(err && err.message ? err.message : '');
  return msg.includes('UND_ERR_SOCKET') || msg.includes('fetch failed');
}

async function runWithRpcRetry(action, label, attempts = 3, delayMs = 1000) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await action();
    } catch (err) {
      lastError = err;
      if (!isSocketClosedError(err) || i === attempts - 1) {
        throw err;
      }
      console.warn(
        `[rpc-retry] ${label}: connection closed (attempt ${i + 1}/${attempts}); retrying in ${delayMs}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

module.exports = {
  runWithRpcRetry
};

