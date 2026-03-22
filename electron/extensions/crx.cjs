const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('jszip');
const { ensureDir } = require('../utils/fs.cjs');

const CRX_DOWNLOAD_BASE = 'https://clients2.google.com/service/update2/crx';
const CRX_PROD_VERSION = '131.0.6778.86';

function safeString(value, maxLen = 2048) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function extractChromeWebStoreId(input) {
  const raw = safeString(input, 4096);
  if (!raw) throw new Error('missing_extension_id');

  const direct = raw.match(/\b([a-p]{32})\b/i);
  if (direct) return direct[1].toLowerCase();

  try {
    const url = new URL(raw);
    const segments = String(url.pathname || '')
      .split('/')
      .map((segment) => safeString(segment, 128))
      .filter(Boolean);
    const fromPath = segments.find((segment) => /^[a-p]{32}$/i.test(segment));
    if (fromPath) return fromPath.toLowerCase();

    const fromSearch =
      safeString(url.searchParams.get('id'), 64) ||
      safeString(url.searchParams.get('extension_id'), 64);
    if (/^[a-p]{32}$/i.test(fromSearch)) return fromSearch.toLowerCase();
  } catch {
    // Fall through to invalid ID error below.
  }

  throw new Error('invalid_chrome_web_store_id');
}

function buildCrxDownloadUrl(extensionId) {
  const id = extractChromeWebStoreId(extensionId);
  return `${CRX_DOWNLOAD_BASE}?response=redirect&prodversion=${encodeURIComponent(CRX_PROD_VERSION)}&acceptformat=crx2,crx3&x=id%3D${encodeURIComponent(id)}%26installsource%3Dondemand%26uc`;
}

function buildCrxDownloadCandidates(extensionId) {
  const id = extractChromeWebStoreId(extensionId);
  return [
    buildCrxDownloadUrl(id),
    `${CRX_DOWNLOAD_BASE}?response=redirect&prodversion=${encodeURIComponent(CRX_PROD_VERSION)}&acceptformat=crx3&x=id%3D${encodeURIComponent(id)}%26installsource%3Dondemand%26uc`,
    `${CRX_DOWNLOAD_BASE}?response=redirect&prodversion=${encodeURIComponent(CRX_PROD_VERSION)}&acceptformat=crx3&x=id%3D${encodeURIComponent(id)}%26installsource%3Dondemand%26lang%3Den-US%26uc`,
    `${CRX_DOWNLOAD_BASE}?response=redirect&prodversion=${encodeURIComponent(CRX_PROD_VERSION)}&acceptformat=crx3&x=id%3D${encodeURIComponent(id)}%26lang%3Den-US%26uc`
  ];
}

async function downloadCrxArchive(extensionId) {
  const targetId = extractChromeWebStoreId(extensionId);
  const candidates = buildCrxDownloadCandidates(targetId);
  const errors = [];

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          accept: 'application/x-chrome-extension,application/octet-stream;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        errors.push(`http_${response.status}`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) {
        errors.push('empty');
        continue;
      }

      return {
        id: targetId,
        url,
        buffer
      };
    } catch (error) {
      errors.push(safeString(error?.message || error || 'fetch_failed', 256) || 'fetch_failed');
    }
  }

  throw new Error(`chrome_web_store_download_failed:${errors.join(',') || 'unknown'}`);
}

function stripCrxHeader(buffer) {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (data.length < 16) {
    throw new Error('invalid_crx_archive');
  }

  const magic = data.slice(0, 4).toString('ascii');
  if (magic === 'PK\x03\x04') {
    return data;
  }
  if (magic !== 'Cr24') {
    throw new Error('invalid_crx_magic');
  }

  const version = data.readUInt32LE(4);
  if (version === 2) {
    const publicKeyLength = data.readUInt32LE(8);
    const signatureLength = data.readUInt32LE(12);
    const offset = 16 + publicKeyLength + signatureLength;
    if (offset >= data.length) throw new Error('invalid_crx_v2_header');
    return data.subarray(offset);
  }

  if (version === 3) {
    const headerLength = data.readUInt32LE(8);
    const offset = 12 + headerLength;
    if (offset >= data.length) throw new Error('invalid_crx_v3_header');
    return data.subarray(offset);
  }

  throw new Error(`unsupported_crx_version:${version}`);
}

async function extractZipBufferToDirectory(zipBuffer, targetDir) {
  const zip = await JSZip.loadAsync(zipBuffer);
  ensureDir(targetDir);

  for (const [relativePath, file] of Object.entries(zip.files)) {
    const normalized = relativePath.replace(/\\/g, '/');
    if (!normalized || normalized.startsWith('__MACOSX/')) continue;

    const absolutePath = path.join(targetDir, normalized);
    const relativeSafePath = path.relative(targetDir, absolutePath);
    if (relativeSafePath.startsWith('..') || path.isAbsolute(relativeSafePath)) {
      throw new Error(`unsafe_extension_path:${normalized}`);
    }

    if (file.dir) {
      ensureDir(absolutePath);
      continue;
    }

    ensureDir(path.dirname(absolutePath));
    const content = await file.async('nodebuffer');
    fs.writeFileSync(absolutePath, content);
  }
}

async function extractCrxArchiveToDirectory(crxBuffer, targetDir) {
  const zipBuffer = stripCrxHeader(crxBuffer);
  await extractZipBufferToDirectory(zipBuffer, targetDir);
  return targetDir;
}

module.exports = {
  extractChromeWebStoreId,
  buildCrxDownloadUrl,
  buildCrxDownloadCandidates,
  downloadCrxArchive,
  stripCrxHeader,
  extractCrxArchiveToDirectory
};
