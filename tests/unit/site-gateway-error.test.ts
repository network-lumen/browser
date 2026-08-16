import { describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * Which failing gateway responses reach the site, and which are swallowed.
 *
 * A site asking for a file it never published gets a 404 from Kubo carrying a
 * `text/plain` sentence. Chromium reads that body as a candidate stylesheet and
 * reports "Refused to apply style ... its MIME type ('text/plain') is not a
 * supported stylesheet MIME type" - a message about our scheme, for a fault
 * that is entirely the site's. The body is dropped so the console says 404.
 *
 * The line to hold is that only Kubo's own error text is dropped: a site that
 * ships its own 404 page still gets to serve it.
 */

const { isGatewayErrorBody } = stubElectron().load<any>('sites/protocol.cjs');

describe("the gateway's own error text", () => {
  it('is recognised whatever the charset', () => {
    expect(isGatewayErrorBody(404, 'text/plain')).toBe(true);
    expect(isGatewayErrorBody(404, 'text/plain; charset=utf-8')).toBe(true);
    expect(isGatewayErrorBody(404, 'Text/Plain;charset=UTF-8')).toBe(true);
  });

  it('covers the other ways a gateway fails, not just 404', () => {
    expect(isGatewayErrorBody(400, 'text/plain')).toBe(true);
    expect(isGatewayErrorBody(500, 'text/plain')).toBe(true);
    expect(isGatewayErrorBody(504, 'text/plain')).toBe(true);
  });
});

describe('what the site keeps', () => {
  it('serves its own error page, which is HTML', () => {
    expect(isGatewayErrorBody(404, 'text/html; charset=utf-8')).toBe(false);
  });

  it('never touches a successful response', () => {
    expect(isGatewayErrorBody(200, 'text/plain')).toBe(false);
    expect(isGatewayErrorBody(206, 'text/plain')).toBe(false);
    expect(isGatewayErrorBody(304, 'text/plain')).toBe(false);
  });

  it('leaves a redirect alone, so _redirects still works', () => {
    expect(isGatewayErrorBody(301, 'text/plain')).toBe(false);
  });

  it('keeps a body whose type the gateway did not set', () => {
    expect(isGatewayErrorBody(404, '')).toBe(false);
    expect(isGatewayErrorBody(404, null)).toBe(false);
    expect(isGatewayErrorBody(404, undefined)).toBe(false);
  });

  it('does not mistake text/plaintext-ish types for the error format', () => {
    expect(isGatewayErrorBody(404, 'text/plainish')).toBe(false);
    expect(isGatewayErrorBody(404, 'application/octet-stream')).toBe(false);
  });

  it('treats a status it cannot read as not an error', () => {
    expect(isGatewayErrorBody(NaN, 'text/plain')).toBe(false);
    expect(isGatewayErrorBody(undefined, 'text/plain')).toBe(false);
  });
});
