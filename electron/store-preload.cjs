const { ipcRenderer } = require('electron');
let lastStoreMetaSignature = '';

function safeString(value, maxLen = 4096) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function currentHref() {
  try {
    return safeString(window.location.href, 8192);
  } catch {
    return '';
  }
}

function isChromeWebStoreUrl(raw = currentHref()) {
  try {
    const url = new URL(String(raw || '').trim());
    const host = String(url.hostname || '').trim().toLowerCase();
    return host === 'chromewebstore.google.com' || host.endsWith('.chromewebstore.google.com');
  } catch {
    return false;
  }
}

function extractChromeWebStoreId(input) {
  const raw = safeString(input, 4096);
  if (!raw) return '';

  const direct = raw.match(/\b([a-p]{32})\b/i);
  if (direct) return String(direct[1] || '').toLowerCase();

  try {
    const url = new URL(raw);
    const segments = String(url.pathname || '')
      .split('/')
      .map((segment) => safeString(segment, 128))
      .filter(Boolean);
    const fromPath = segments.find((segment) => /^[a-p]{32}$/i.test(segment));
    if (fromPath) return String(fromPath).toLowerCase();

    const fromSearch =
      safeString(url.searchParams.get('id'), 64) ||
      safeString(url.searchParams.get('extension_id'), 64);
    if (/^[a-p]{32}$/i.test(fromSearch)) return fromSearch.toLowerCase();

    const nested = safeString(url.searchParams.get('x'), 4096);
    if (nested) {
      const decoded = decodeURIComponent(nested);
      const nestedMatch = decoded.match(/(?:^|&)id=([a-p]{32})(?:&|$)/i);
      if (nestedMatch) return String(nestedMatch[1] || '').toLowerCase();
    }
  } catch {
    // ignore
  }

  return '';
}

function getChromeWebStoreInstallPayload() {
  const href = currentHref();
  if (!isChromeWebStoreUrl(href)) return null;
  const id = extractChromeWebStoreId(href);
  if (!id) return null;

  let title = '';
  try {
    const heading =
      document.querySelector('h1') ||
      document.querySelector('[role="heading"]') ||
      document.querySelector('title');
    title = safeString(heading?.textContent || document?.title || '', 256);
  } catch {
    title = safeString(document?.title || '', 256);
  }

  return { id, url: href, title };
}

function extractStoreListingVersion() {
  try {
    const selectors = [
      'meta[itemprop="version"]',
      '[itemprop="version"]',
      'meta[name="version"]'
    ];
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const direct =
        safeString(node?.getAttribute?.('content'), 64) ||
        safeString(node?.textContent, 64);
      if (direct) return direct.replace(/^v/i, '');
    }

    const textNodes = Array.from(document.querySelectorAll('body *'))
      .slice(0, 1500);
    for (const node of textNodes) {
      const label = safeString(node?.textContent, 64).toLowerCase();
      if (label !== 'version') continue;
      const next =
        safeString(node?.nextElementSibling?.textContent, 64) ||
        safeString(node?.parentElement?.nextElementSibling?.textContent, 64) ||
        safeString(node?.parentElement?.textContent, 128).replace(/^version\s*/i, '');
      if (next) {
        const match = next.match(/\b\d+(?:\.\d+)+(?:[-+._0-9A-Za-z]*)?\b/);
        if (match) return String(match[0] || '').replace(/^v/i, '');
      }
    }

    const bodyText = safeString(document.body?.innerText, 20000);
    const versionBlock = bodyText.match(/(?:^|\n)\s*Version\s*\n?\s*([^\n]+)/i);
    if (versionBlock) {
      const match = String(versionBlock[1] || '').match(/\b\d+(?:\.\d+)+(?:[-+._0-9A-Za-z]*)?\b/);
      if (match) return String(match[0] || '').replace(/^v/i, '');
    }
  } catch {
    // ignore
  }
  return '';
}

function sendStorePageMeta() {
  try {
    const payload = getChromeWebStoreInstallPayload();
    if (!payload) return;
    const meta = {
      id: safeString(payload.id, 128).toLowerCase(),
      url: safeString(payload.url, 8192),
      title: safeString(payload.title, 256),
      version: extractStoreListingVersion()
    };
    const signature = JSON.stringify(meta);
    if (!signature || signature === lastStoreMetaSignature) return;
    lastStoreMetaSignature = signature;
    ipcRenderer.sendToHost('extensions:storePageMeta', meta);
  } catch {
    // ignore
  }
}

function sendInstallRequest(trigger = 'unknown') {
  const payload = getChromeWebStoreInstallPayload();
  if (!payload) return false;
  try {
    ipcRenderer.sendToHost('extensions:installFromStore', {
      ...payload,
      trigger: safeString(trigger, 64) || 'unknown'
    });
    return true;
  } catch {
    return false;
  }
}

function closestInstallTrigger(target) {
  try {
    const el =
      target && target.nodeType === 1
        ? target
        : target && target.parentElement
          ? target.parentElement
          : null;
    if (!el || typeof el.closest !== 'function') return null;
    return el.closest('button, a, [role="button"]');
  } catch {
    return null;
  }
}

function looksLikeInstallTrigger(target) {
  const trigger = closestInstallTrigger(target);
  if (!trigger) return false;
  const text = safeString(
    trigger.textContent ||
      (typeof trigger.getAttribute === 'function' ? trigger.getAttribute('aria-label') : '') ||
      '',
    512
  ).toLowerCase();
  if (!text) return false;
  return (
    text.includes('add to chrome') ||
    text.includes('add extension') ||
    text.includes('add to chromium') ||
    text.includes('import into lumen') ||
    text.includes('install in lumen')
  );
}

function getImportButton() {
  try {
    return document.getElementById('lumen-chrome-store-import');
  } catch {
    return null;
  }
}

function getImportBadge() {
  try {
    return document.getElementById('lumen-chrome-store-badge');
  } catch {
    return null;
  }
}

function setImportButtonText(label, isError = false) {
  try {
    const button = getImportButton();
    if (!button) return;
    button.textContent = safeString(label, 128) || 'Install in Lumen';
    button.style.background = isError ? 'linear-gradient(135deg, #991b1b, #b91c1c)' : 'linear-gradient(135deg, #0f766e, #0ea5e9)';
  } catch {
    // ignore
  }
}

function removeImportButton() {
  try {
    getImportButton()?.remove?.();
    getImportBadge()?.remove?.();
  } catch {
    // ignore
  }
}

function ensureImportButton() {
  if (!isChromeWebStoreUrl()) {
    removeImportButton();
    return;
  }

  const payload = getChromeWebStoreInstallPayload();
  if (!payload || !document?.body) {
    removeImportButton();
    return;
  }

  let button = getImportButton();
  let badge = getImportBadge();
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'lumen-chrome-store-badge';
    badge.textContent = 'Official listing viewed in Lumen';
    badge.style.position = 'fixed';
    badge.style.right = '24px';
    badge.style.top = '24px';
    badge.style.zIndex = '2147483646';
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.style.justifyContent = 'center';
    badge.style.padding = '8px 12px';
    badge.style.borderRadius = '999px';
    badge.style.border = '1px solid rgba(148, 163, 184, 0.22)';
    badge.style.background = 'rgba(15, 23, 42, 0.9)';
    badge.style.backdropFilter = 'blur(14px)';
    badge.style.color = '#e2e8f0';
    badge.style.fontSize = '11px';
    badge.style.fontWeight = '700';
    badge.style.letterSpacing = '0.08em';
    badge.style.textTransform = 'uppercase';
    badge.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    document.body.appendChild(badge);
  }

  if (!button) {
    button = document.createElement('button');
    button.id = 'lumen-chrome-store-import';
    button.type = 'button';
    button.textContent = 'Install in Lumen';
    button.style.position = 'fixed';
    button.style.right = '24px';
    button.style.top = '64px';
    button.style.zIndex = '2147483647';
    button.style.display = 'inline-flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.minHeight = '48px';
    button.style.padding = '12px 18px';
    button.style.border = '0';
    button.style.borderRadius = '999px';
    button.style.background = 'linear-gradient(135deg, #0f766e, #0ea5e9)';
    button.style.color = '#ffffff';
    button.style.fontSize = '14px';
    button.style.fontWeight = '600';
    button.style.letterSpacing = '0.01em';
    button.style.cursor = 'pointer';
    button.style.boxShadow = '0 16px 42px rgba(14, 165, 233, 0.32)';
    button.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    button.addEventListener('click', (event) => {
      try { event.preventDefault(); } catch {}
      try { event.stopPropagation(); } catch {}
      button.textContent = 'Install requested';
      sendInstallRequest('floating-button');
    });
    document.body.appendChild(button);
  } else {
    button.textContent = 'Install in Lumen';
  }

  button.setAttribute('data-extension-id', payload.id);
}

function handleChromeWebStoreClick(event) {
  try {
    if (!isChromeWebStoreUrl()) return;
    if (!getChromeWebStoreInstallPayload()) return;
    if (!looksLikeInstallTrigger(event?.target)) return;

    try { event.preventDefault?.(); } catch {}
    try { event.stopImmediatePropagation?.(); } catch {}
    try { event.stopPropagation?.(); } catch {}

    sendInstallRequest('page-install-button');
    ensureImportButton();
  } catch {
    // ignore
  }
}

function attachChromeWebStoreWatcher() {
  try {
    if (window.__lumenChromeStoreWatcherAttached) return;
    window.__lumenChromeStoreWatcherAttached = true;
    let refreshTimer = null;

    const scheduleRefresh = () => {
      try {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
        }
        refreshTimer = setTimeout(() => {
          refreshTimer = null;
          try {
            ensureImportButton();
            sendStorePageMeta();
          } catch {
            // ignore
          }
        }, 120);
      } catch {
        // ignore
      }
    };

    const refresh = () => {
      try {
        ensureImportButton();
        sendStorePageMeta();
      } catch {
        // ignore
      }
    };

    document.addEventListener('click', handleChromeWebStoreClick, true);
    window.addEventListener('hashchange', scheduleRefresh, true);
    window.addEventListener('popstate', scheduleRefresh, true);
    window.addEventListener('DOMContentLoaded', refresh, { once: true });

    const observer = new MutationObserver(() => scheduleRefresh());
    try {
      observer.observe(document.documentElement || document.body || document, {
        childList: true,
        subtree: true
      });
    } catch {
      // ignore
    }

    refresh();
  } catch {
    // ignore
  }
}

try {
  ipcRenderer.on('extensions:storeInstallResult', (_event, payload) => {
    if (payload?.ok) {
      setImportButtonText('Installed in Lumen', false);
    } else {
      setImportButtonText('Install failed', true);
    }
  });
} catch {
  // ignore
}

attachChromeWebStoreWatcher();
