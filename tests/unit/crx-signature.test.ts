import { createSign, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * Whether a .crx really came from the developer whose id it claims.
 *
 * An extension runs in `persist:lumen`, the same session as every IPFS site
 * and the wallet shims. Installing one is installing code next to the money,
 * so the signature is the only thing standing between the Chrome Web Store's
 * answer and arbitrary content someone put in its place.
 *
 * The archives here are built rather than fixtured: a fixture would have to be
 * a real signed extension, and altering one byte of it to test the negative
 * case is exactly what a builder does honestly.
 */

type Crx = {
  verifyCrxArchive: (
    buffer: Buffer,
    expectedId?: string
  ) => { crxId: string; publicKeyBase64: string; hasVerifiedContents: boolean };
  extractChromeWebStoreId: (input: string) => string;
};

const { verifyCrxArchive, extractChromeWebStoreId } = stubElectron().load<Crx>(
  'extensions/crx.cjs'
);
const { sha256 } = stubElectron().load<{ sha256: (d: any, o?: any) => string }>('utils/crypto.cjs');

const CRX_SIGNATURE_CONTEXT = Buffer.from('CRX3 SignedData\0', 'utf8');

// --- the smallest protobuf writer that can produce a CRX3 header ------------

function varint(value: number) {
  const out: number[] = [];
  let v = value;
  while (v > 127) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
  return Buffer.from(out);
}

/** One length-delimited field: tag, length, bytes. */
function field(fieldNumber: number, payload: Buffer) {
  return Buffer.concat([varint((fieldNumber << 3) | 2), varint(payload.length), payload]);
}

/** The 16-byte crx id is the first half of sha256(public key). */
function crxIdBytes(publicKeyDer: Buffer) {
  return Buffer.from(sha256(publicKeyDer, { bytes: true }) as unknown as Buffer).subarray(0, 16);
}

/** The a-p alphabet Chrome uses for extension ids. */
function crxIdString(publicKeyDer: Buffer) {
  return Array.from(crxIdBytes(publicKeyDer).toString('hex'))
    .map((c) => String.fromCharCode(97 + parseInt(c, 16)))
    .join('');
}

type BuildOptions = {
  /** Sign with a key other than the one the id is derived from. */
  signWith?: Buffer;
  /** Claim an id that is not the signing key's. */
  declaredId?: Buffer;
  /** Change the payload after signing. */
  tamperArchive?: boolean;
};

function buildCrx(archive: Buffer, options: BuildOptions = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;

  const signedHeaderData = field(1, options.declaredId ?? crxIdBytes(publicKeyDer));
  const signedHeaderSize = Buffer.alloc(4);
  signedHeaderSize.writeUInt32LE(signedHeaderData.length, 0);

  const payload = Buffer.concat([
    CRX_SIGNATURE_CONTEXT,
    signedHeaderSize,
    signedHeaderData,
    archive
  ]);
  const signer = createSign('sha256');
  signer.update(payload);
  signer.end();
  const signature = signer.sign(options.signWith ? createPrivate(options.signWith) : privateKey);

  const proof = Buffer.concat([field(1, publicKeyDer), field(2, signature)]);
  const header = Buffer.concat([field(2, proof), field(10000, signedHeaderData)]);

  const prefix = Buffer.alloc(12);
  prefix.write('Cr24', 0, 'ascii');
  prefix.writeUInt32LE(3, 4);
  prefix.writeUInt32LE(header.length, 8);

  const body = options.tamperArchive
    ? Buffer.concat([archive.subarray(0, archive.length - 1), Buffer.from([archive[archive.length - 1] ^ 0xff])])
    : archive;

  return { crx: Buffer.concat([prefix, header, body]), id: crxIdString(publicKeyDer) };
}

function createPrivate(der: Buffer) {
  return { key: der, format: 'der' as const, type: 'pkcs8' as const };
}

/** Not a real zip - nothing here unzips it, and the signature covers bytes. */
const ARCHIVE = Buffer.from('PK pretend this is an extension', 'utf8');

describe('accepting a well-formed CRX3', () => {
  it('verifies it and reports the id derived from the signing key', () => {
    const { crx, id } = buildCrx(ARCHIVE);
    const result = verifyCrxArchive(crx);
    expect(result.crxId).toBe(id);
    expect(result.crxId).toMatch(/^[a-p]{32}$/);
  });

  it('accepts it when the caller asks for that exact id', () => {
    const { crx, id } = buildCrx(ARCHIVE);
    expect(verifyCrxArchive(crx, id).crxId).toBe(id);
  });
});

describe('refusing what does not verify', () => {
  it('refuses an archive changed after signing', () => {
    // The whole point: the store answered, something replaced the payload.
    const { crx } = buildCrx(ARCHIVE, { tamperArchive: true });
    expect(() => verifyCrxArchive(crx)).toThrow('crx_signature_verification_failed');
  });

  it('refuses a signature made by another key', () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const { crx } = buildCrx(ARCHIVE, {
      signWith: other.privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer
    });
    expect(() => verifyCrxArchive(crx)).toThrow('crx_signature_verification_failed');
  });

  it('refuses a header that claims an id its key does not derive to', () => {
    // A validly signed archive that says it is someone else's extension -
    // which is how a legitimate signature gets used to install an impostor
    // over a trusted id.
    const { crx } = buildCrx(ARCHIVE, { declaredId: Buffer.alloc(16, 0x11) });
    expect(() => verifyCrxArchive(crx)).toThrow('crx_public_key_id_mismatch');
  });

  it('refuses an id other than the one the caller asked for', () => {
    const { crx } = buildCrx(ARCHIVE);
    expect(() => verifyCrxArchive(crx, 'a'.repeat(32))).toThrow('crx_declared_id_mismatch');
  });

  it('refuses a header carrying no proof at all', () => {
    const signedHeaderData = field(1, Buffer.alloc(16, 0x22));
    const header = field(10000, signedHeaderData);
    const prefix = Buffer.alloc(12);
    prefix.write('Cr24', 0, 'ascii');
    prefix.writeUInt32LE(3, 4);
    prefix.writeUInt32LE(header.length, 8);
    expect(() => verifyCrxArchive(Buffer.concat([prefix, header, ARCHIVE]))).toThrow(
      'missing_crx3_proof'
    );
  });

  it('refuses anything that is not a CRX3', () => {
    expect(() => verifyCrxArchive(Buffer.from('not a crx at all really'))).toThrow(
      'invalid_crx_magic'
    );
    const v2 = Buffer.alloc(32);
    v2.write('Cr24', 0, 'ascii');
    v2.writeUInt32LE(2, 4);
    expect(() => verifyCrxArchive(v2)).toThrow('unsupported_crx_version:2');
    expect(() => verifyCrxArchive(Buffer.alloc(4))).toThrow('invalid_crx_archive');
  });
});

describe('reading the id a user pasted', () => {
  it('takes it from a store URL or on its own', () => {
    const id = 'abcdefghijklmnopabcdefghijklmnop';
    expect(extractChromeWebStoreId(id)).toBe(id);
    expect(extractChromeWebStoreId(`https://chromewebstore.google.com/detail/thing/${id}`)).toBe(id);
    expect(extractChromeWebStoreId(`https://example.com/x?id=${id}`)).toBe(id);
  });

  it('refuses anything that is not one', () => {
    // q-z are outside the alphabet, so this is not a near miss to be lenient
    // about - it is a different string.
    expect(() => extractChromeWebStoreId('zzzz')).toThrow('invalid_chrome_web_store_id');
    expect(() => extractChromeWebStoreId('')).toThrow('missing_extension_id');
  });
});
