// Holds the interface to one wording per thing.
//
// Run via `npm run check:wording` (wired into `npm test`). Every rule below was
// written after finding the drift it now blocks, in a catalogue that had grown
// to 1 850 strings with 67 groups saying the same thing two or three ways:
// "Try again" beside "Try Again", "Unable to load gateways" beside "Failed to
// load gateways", `...` beside `…`, five sentences for "you need a profile
// with a wallet". None of that fails at runtime, and none of it is visible from
// inside the one file you happen to be editing - which is why it needs a check
// rather than a convention.
//
// The catalogue is the input, so a rule here is about the *English*, not about
// any translation.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1');
const keys = Object.keys(JSON.parse(readFileSync(join(ROOT, 'src/locales/fr.json'), 'utf8')));

const violations = [];
const fail = (rule, detail, hint) => violations.push({ rule, detail, hint });

// ---------------------------------------------------------------------------
// Rule 1: the ellipsis is a character, not three dots. Mixing them means a
// translator has to reproduce the accident, and search never matches.
// ---------------------------------------------------------------------------
for (const key of keys) {
  if (key.endsWith('...')) fail('ellipsis', key, `use "${key.slice(0, -3)}…"`);
}

// ---------------------------------------------------------------------------
// Rule 2: one verb for failure. "Unable to" and "Could not" are the same
// sentence in a different mood, and a user cannot act on the difference.
// ---------------------------------------------------------------------------
for (const key of keys) {
  const m = key.match(/^(Unable to|Could not) (.+)$/);
  if (m) fail('failure-verb', key, `use "Failed to ${m[2]}"`);
}

// ---------------------------------------------------------------------------
// Rule 3: "not available", never "unavailable". Both were in use, split 31/18.
// ---------------------------------------------------------------------------
for (const key of keys) {
  if (/\bunavailable\.?$/i.test(key)) fail('unavailable', key, 'use "not available"');
}

// ---------------------------------------------------------------------------
// Rule 4: no two keys that differ only by case, trailing punctuation or the
// shape of an ellipsis. This is the one that caught the most: 67 groups.
//
// The exceptions are real distinctions, not tolerated drift:
//  - a menu item that opens further UI carries an ellipsis, the thing it opens
//    does not ("Import profile…" opens "Import profile");
//  - a question is not its own label ("Delete profile?" confirms "Delete profile");
//  - an aria-label has no ellipsis to read out ("Loading" vs "Loading…").
// ---------------------------------------------------------------------------
const ALLOWED_PAIRS = new Set([
  'Delete profile | Delete profile?',
  'Import profile | Import profile…',
  'Loading | Loading…',
  'Until restart | until restart',
]);

const normalise = (s) =>
  s.toLowerCase().replace(/\.\.\.$/, '').replace(/[.…!?]+$/, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const groups = new Map();
for (const key of keys) {
  const n = normalise(key);
  if (!n) continue;
  if (!groups.has(n)) groups.set(n, []);
  groups.get(n).push(key);
}
for (const [, variants] of groups) {
  if (variants.length < 2) continue;
  const sorted = [...variants].sort();
  if (sorted.length === 2 && ALLOWED_PAIRS.has(sorted.join(' | '))) continue;
  fail('duplicate', sorted.map((v) => JSON.stringify(v)).join(' vs '), 'keep one wording');
}

// ---------------------------------------------------------------------------
// Rule 5: a number a check enforces does not belong in a sentence. The password
// minimum was written out as 6 in two messages and 8 in three, while the code
// demanded 8 - so a user typing seven characters was told the rule they had
// just met. It reads MIN_PASSWORD_LENGTH through a {min} placeholder now.
// ---------------------------------------------------------------------------
for (const key of keys) {
  if (/\b(?:at least|min\.?|minimum)\s+\d+\s+characters/i.test(key)) {
    fail('hardcoded-minimum', key, 'pass the length as {min} from MIN_PASSWORD_LENGTH');
  }
}

// ---------------------------------------------------------------------------
// Rule 6: a heading is not shouted. The explorer's header row is uppercased by
// CSS already, so an ALL-CAPS source string is both redundant and lossy - a
// language with accents loses them to text-transform when the source shouts.
// ---------------------------------------------------------------------------
for (const key of keys) {
  const words = key.match(/[A-Za-z]{3,}/g) || [];
  if (words.length >= 2 && words.every((w) => w === w.toUpperCase())) {
    fail('shouting', key, 'write it in sentence case and let CSS uppercase it');
  }
}

// ---------------------------------------------------------------------------
// Rule 7: sentence case. Title Case belongs to the name of a page, as the route
// table spells it, and nowhere else - "Wallet Overview" beside "Domain
// settings" is two conventions in one app, and which one a string got depended
// on who wrote it.
//
// The list below is what legitimately carries a capital mid-sentence: proper
// nouns, acronyms, page names, and the words of a keyboard shortcut.
// ---------------------------------------------------------------------------
const PROPER = new Set(`Lumen IPFS IPNS CID CIDs LMN DAO PQC IBC QR API APIs URL URLs JSON
GitHub Chrome Web Store Google Dilithium Kubo Electron HLS EPUB DEX DEXs RPC SHA SHA256
ID IDs TTL GB HTML HTM ZIP CSV Esc Enter Shift Ctrl Alt I Netflix Doe VPS CRX USB
Drive Wallet Settings Extensions Domains Explorer Network Gateways Tab Cloud Space
Testnet BeeZee WalletConnect Amino Direct Veto Browser Decentralized Internet Stack
Subscription Light Normal High New All Pages Explore Create Send Other Chain Via Save My Upload
Français English`.split(/\s+/));

/**
 * The word a capital has to be judged on: leading punctuation dropped, an
 * English contraction reduced to its stem ("Lumen's" is Lumen), and a
 * hyphenated or plus-joined compound reduced to its first part, so
 * "IPNS-backed" is judged as IPNS and "Shift+Enter" as Shift.
 */
function headWord(token) {
  return token
    .replace(/^[^A-Za-z]+/, '')
    .replace(/'(?:s|m|t|ll|re|ve|d)\b.*$/i, '')
    .split(/[-+/]/)[0]
    .replace(/[^A-Za-z]/g, '');
}

for (const key of keys) {
  if (/^[^A-Za-z]/.test(key)) continue;
  const offenders = [];
  let startOfSentence = true;
  for (const token of key.split(/\s+/)) {
    const bare = headWord(token);
    // A token that opens with a quote or a bracket starts a quotation, which
    // starts a sentence.
    const opensQuote = /^[“("']/.test(token);
    if (
      bare &&
      !startOfSentence &&
      !opensQuote &&
      /^[A-Z]/.test(bare) &&
      bare !== bare.toUpperCase() &&
      !PROPER.has(bare)
    ) {
      offenders.push(token);
    }
    if (bare) startOfSentence = false;
    // A new sentence starts after . ? ! : — and after a separator like ·.
    if (/[.?!:—·…]$|[“("]$/.test(token)) startOfSentence = true;
  }
  if (offenders.length) {
    fail('title-case', key, `sentence case: ${offenders.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const TITLES = {
  ellipsis: 'Three dots instead of an ellipsis',
  'failure-verb': 'A second verb for failure',
  unavailable: '"unavailable" instead of "not available"',
  duplicate: 'Two keys saying the same thing',
  'hardcoded-minimum': 'A number the code enforces, written into a sentence',
  shouting: 'An ALL-CAPS string (the CSS already uppercases it)',
  'title-case': 'Title Case outside the name of a page',
};

if (!violations.length) {
  console.log(`check:wording - all clear (${keys.length} strings, one wording each).`);
  process.exit(0);
}

const byRule = new Map();
for (const v of violations) {
  if (!byRule.has(v.rule)) byRule.set(v.rule, []);
  byRule.get(v.rule).push(v);
}
for (const [rule, items] of byRule) {
  console.log(`\n=== ${TITLES[rule] || rule} (${items.length}) ===`);
  for (const v of items) console.log(`  ${v.detail}\n      → ${v.hint}`);
}
console.log(`\ncheck:wording failed - ${violations.length} inconsistency(ies).`);
process.exit(1);
