const { safeString } = require('../utils/strings.cjs');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const JSZip = require('jszip');
const { ensureDir } = require('../utils/fs.cjs');

const CRX_DOWNLOAD_BASE = 'https://clients2.google.com/service/update2/crx';
const CRX_PROD_VERSION = '131.0.6778.86';
const CRX_SIGNATURE_CONTEXT = Buffer.from('CRX3 SignedData\0', 'utf8');
const CRX_HEADER_EOCD = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const CRX_HEADER_EOCD64 = Buffer.from([0x50, 0x4b, 0x06, 0x07]);

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
  return `${CRX_DOWNLOAD_BASE}?response=redirect&prodversion=${encodeURIComponent(CRX_PROD_VERSION)}&acceptformat=crx3&x=id%3D${encodeURIComponent(id)}%26installsource%3Dondemand%26uc`;
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

function extensionIdFromHashHex(input) {
  const hex = safeString(input, 128).toLowerCase();
  if (!hex) return '';
  return Array.from(hex)
    .map((char) => {
      const value = Number.parseInt(char, 16);
      return Number.isFinite(value) ? String.fromCharCode(97 + value) : '';
    })
    .join('');
}

function extensionIdFromPublicKey(publicKeyBytes) {
  const digest = crypto.createHash('sha256').update(Buffer.from(publicKeyBytes || [])).digest('hex');
  return extensionIdFromHashHex(digest.slice(0, 32));
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(Buffer.from(input || [])).digest('hex');
}

function readVarint(buffer, offset) {
  let result = 0;
  let shift = 0;
  let cursor = offset;
  while (cursor < buffer.length) {
    const value = buffer[cursor];
    result |= (value & 0x7f) << shift;
    cursor += 1;
    if ((value & 0x80) === 0) {
      return { value: result, offset: cursor };
    }
    shift += 7;
    if (shift > 35) break;
  }
  throw new Error('invalid_crx_proto_varint');
}

function readLengthDelimited(buffer, offset) {
  const { value: length, offset: nextOffset } = readVarint(buffer, offset);
  const end = nextOffset + length;
  if (!Number.isFinite(length) || length < 0 || end > buffer.length) {
    throw new Error('invalid_crx_proto_length');
  }
  return {
    value: buffer.subarray(nextOffset, end),
    offset: end
  };
}

function skipProtoField(buffer, offset, wireType) {
  if (wireType === 0) {
    return readVarint(buffer, offset).offset;
  }
  if (wireType === 1) {
    const nextOffset = offset + 8;
    if (nextOffset > buffer.length) throw new Error('invalid_crx_proto_skip64');
    return nextOffset;
  }
  if (wireType === 2) {
    return readLengthDelimited(buffer, offset).offset;
  }
  if (wireType === 5) {
    const nextOffset = offset + 4;
    if (nextOffset > buffer.length) throw new Error('invalid_crx_proto_skip32');
    return nextOffset;
  }
  throw new Error(`unsupported_crx_proto_wire_type:${wireType}`);
}

function parseAsymmetricKeyProof(buffer) {
  let offset = 0;
  let publicKey = Buffer.alloc(0);
  let signature = Buffer.alloc(0);

  while (offset < buffer.length) {
    const tag = readVarint(buffer, offset);
    offset = tag.offset;
    const fieldNumber = tag.value >>> 3;
    const wireType = tag.value & 7;

    if (wireType === 2 && fieldNumber === 1) {
      const field = readLengthDelimited(buffer, offset);
      publicKey = Buffer.from(field.value);
      offset = field.offset;
      continue;
    }

    if (wireType === 2 && fieldNumber === 2) {
      const field = readLengthDelimited(buffer, offset);
      signature = Buffer.from(field.value);
      offset = field.offset;
      continue;
    }

    offset = skipProtoField(buffer, offset, wireType);
  }

  return { publicKey, signature };
}

function parseCrx3SignedData(buffer) {
  let offset = 0;
  let crxId = Buffer.alloc(0);

  while (offset < buffer.length) {
    const tag = readVarint(buffer, offset);
    offset = tag.offset;
    const fieldNumber = tag.value >>> 3;
    const wireType = tag.value & 7;

    if (wireType === 2 && fieldNumber === 1) {
      const field = readLengthDelimited(buffer, offset);
      crxId = Buffer.from(field.value);
      offset = field.offset;
      continue;
    }

    offset = skipProtoField(buffer, offset, wireType);
  }

  return { crxId };
}

function parseCrx3Header(buffer) {
  let offset = 0;
  const rsaProofs = [];
  const ecdsaProofs = [];
  let signedHeaderData = Buffer.alloc(0);
  let verifiedContents = Buffer.alloc(0);

  while (offset < buffer.length) {
    const tag = readVarint(buffer, offset);
    offset = tag.offset;
    const fieldNumber = tag.value >>> 3;
    const wireType = tag.value & 7;

    if (wireType === 2 && fieldNumber === 2) {
      const field = readLengthDelimited(buffer, offset);
      rsaProofs.push(parseAsymmetricKeyProof(field.value));
      offset = field.offset;
      continue;
    }

    if (wireType === 2 && fieldNumber === 3) {
      const field = readLengthDelimited(buffer, offset);
      ecdsaProofs.push(parseAsymmetricKeyProof(field.value));
      offset = field.offset;
      continue;
    }

    if (wireType === 2 && fieldNumber === 4) {
      const field = readLengthDelimited(buffer, offset);
      verifiedContents = Buffer.from(field.value);
      offset = field.offset;
      continue;
    }

    if (wireType === 2 && fieldNumber === 10000) {
      const field = readLengthDelimited(buffer, offset);
      signedHeaderData = Buffer.from(field.value);
      offset = field.offset;
      continue;
    }

    offset = skipProtoField(buffer, offset, wireType);
  }

  return {
    rsaProofs,
    ecdsaProofs,
    signedHeaderData,
    verifiedContents
  };
}

function createEcdsaPublicKeyObject(publicKeyBytes) {
  return crypto.createPublicKey({
    key: Buffer.from(publicKeyBytes || []),
    format: 'der',
    type: 'spki'
  });
}

function createRsaPublicKeyObject(publicKeyBytes) {
  return crypto.createPublicKey({
    key: Buffer.from(publicKeyBytes || []),
    format: 'der',
    type: 'spki'
  });
}

function verifyProofSignature(kind, proof, signedPayload) {
  const publicKeyBytes = Buffer.from(proof?.publicKey || []);
  const signatureBytes = Buffer.from(proof?.signature || []);
  if (!publicKeyBytes.length || !signatureBytes.length) {
    throw new Error('invalid_crx3_proof');
  }

  const keyObject =
    kind === 'rsa'
      ? createRsaPublicKeyObject(publicKeyBytes)
      : createEcdsaPublicKeyObject(publicKeyBytes);

  const verifier = crypto.createVerify('sha256');
  verifier.update(signedPayload);
  verifier.end();
  return verifier.verify(keyObject, signatureBytes);
}

function verifyCrxArchive(crxBuffer, expectedExtensionId = '') {
  const data = Buffer.isBuffer(crxBuffer) ? crxBuffer : Buffer.from(crxBuffer || []);
  if (data.length < 16) {
    throw new Error('invalid_crx_archive');
  }

  const magic = data.slice(0, 4).toString('ascii');
  if (magic !== 'Cr24') {
    throw new Error('invalid_crx_magic');
  }

  const version = data.readUInt32LE(4);
  if (version !== 3) {
    throw new Error(`unsupported_crx_version:${version}`);
  }

  const headerLength = data.readUInt32LE(8);
  const headerStart = 12;
  const headerEnd = headerStart + headerLength;
  if (headerLength <= 0 || headerEnd > data.length) {
    throw new Error('invalid_crx_v3_header');
  }

  const headerBytes = data.subarray(headerStart, headerEnd);
  if (headerBytes.includes(CRX_HEADER_EOCD) || headerBytes.includes(CRX_HEADER_EOCD64)) {
    throw new Error('invalid_crx_v3_header');
  }

  const archiveBytes = data.subarray(headerEnd);
  const header = parseCrx3Header(headerBytes);
  if (!header.signedHeaderData.length) {
    throw new Error('missing_crx3_signed_header_data');
  }

  const signedData = parseCrx3SignedData(header.signedHeaderData);
  if (signedData.crxId.length !== 16) {
    throw new Error('invalid_crx3_declared_id');
  }

  const declaredCrxId = extensionIdFromHashHex(signedData.crxId.toString('hex'));
  if (!declaredCrxId) {
    throw new Error('invalid_crx3_declared_id');
  }

  const expectedId = safeString(expectedExtensionId, 64).toLowerCase();
  if (expectedId && declaredCrxId !== expectedId) {
    throw new Error('crx_declared_id_mismatch');
  }

  const signedHeaderSize = Buffer.alloc(4);
  signedHeaderSize.writeUInt32LE(header.signedHeaderData.length, 0);
  const signedPayload = Buffer.concat([
    CRX_SIGNATURE_CONTEXT,
    signedHeaderSize,
    header.signedHeaderData,
    archiveBytes
  ]);

  let matchedDeveloperPublicKey = null;
  const allProofs = [
    ...header.rsaProofs.map((proof) => ({ kind: 'rsa', proof })),
    ...header.ecdsaProofs.map((proof) => ({ kind: 'ecdsa', proof }))
  ];
  if (!allProofs.length) {
    throw new Error('missing_crx3_proof');
  }

  for (const item of allProofs) {
    const publicKeyBytes = Buffer.from(item.proof.publicKey || []);
    const derivedId = extensionIdFromPublicKey(publicKeyBytes);
    const valid = verifyProofSignature(item.kind, item.proof, signedPayload);
    if (!valid) {
      throw new Error('crx_signature_verification_failed');
    }
    if (derivedId === declaredCrxId) {
      matchedDeveloperPublicKey = publicKeyBytes;
    }
  }

  if (!matchedDeveloperPublicKey) {
    throw new Error('crx_public_key_id_mismatch');
  }

  return {
    version,
    crxId: declaredCrxId,
    publicKeyBase64: matchedDeveloperPublicKey.toString('base64'),
    publicKeySha256: sha256Hex(matchedDeveloperPublicKey),
    archiveSha256: sha256Hex(archiveBytes),
    fileSha256: sha256Hex(data),
    hasVerifiedContents: !!header.verifiedContents.length
  };
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
  verifyCrxArchive,
  stripCrxHeader,
  extractCrxArchiveToDirectory
};
