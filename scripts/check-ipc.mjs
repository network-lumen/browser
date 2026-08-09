// Contract checks over every IPC channel in electron/.
//
// Written instead of one unit test per handler. Of the 211 channels, roughly a
// third are four-line pass-throughs where a test asserts that a function calls
// a function - it exercises the mock, not the code. And a per-handler test
// would have caught none of the four missing sender guards found by hand,
// because each test would have verified that its handler does what it does,
// including ignoring its event.
//
// What is uniform across all 211 is not their logic but their contract, so the
// contract is checked once, over the whole surface. A new handler is covered
// the moment it is written, without anyone remembering to cover it.
//
// Run via `npm run check:ipc` (part of `npm test`).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1'));
const ELECTRON = join(ROOT, 'electron');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.cjs$/.test(name) ? [full] : [];
  });
}

const rel = (f) => relative(ELECTRON, f).replace(/\\/g, '/');
const files = walk(ELECTRON);

/**
 * Balanced-paren scan, so a body containing `)` in a string is not cut short.
 *
 * Comments are skipped, and that is not a nicety. An apostrophe in prose -
 * `this site's own cached JSON`, in main.cjs - reads as the start of a string
 * literal, and from there the scan swallows the rest of the file. The handler
 * it was measuring appeared to contain the next four, and every rule below
 * inherited the mistake: one reported a violation that lived in a completely
 * different handler.
 */
function handlerBodies(src) {
  const out = [];
  const re = /ipcMain\.(handle|on)\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(src))) {
    let i = src.indexOf('(', m.index);
    let depth = 0;
    let inStr = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (inStr) {
        if (c === inStr && src[i - 1] !== '\\') inStr = null;
        continue;
      }
      if (c === '/' && src[i + 1] === '/') {
        i = src.indexOf('\n', i);
        if (i < 0) i = src.length;
        continue;
      }
      if (c === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        i = end < 0 ? src.length : end + 1;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (!depth) break; }
    }
    const body = src.slice(m.index, i);
    out.push({
      kind: m[1],
      channel: m[2],
      body,
      line: src.slice(0, m.index).split('\n').length,
      isAsync: /\(\s*(?:async\s*)?\([^)]*\)\s*=>/.test(body) ? /async\s*\(/.test(body) : /async/.test(body.slice(0, 120)),
      hasTry: /\btry\s*\{/.test(body),
      guardsSender: /senderSiteContext(?:AwaitingDomain)?\(|ensureUiSender\(/.test(body),
    });
  }
  return out;
}

const handlers = [];
const byChannel = new Map();
for (const file of files) {
  for (const h of handlerBodies(readFileSync(file, 'utf8'))) {
    const entry = { ...h, file: rel(file) };
    handlers.push(entry);
    if (!byChannel.has(h.channel)) byChannel.set(h.channel, []);
    byChannel.get(h.channel).push(entry);
  }
}

/** Channels a preload can reach, and from where. Covers invoke/send/sendSync. */
function invokedChannels(fileName) {
  const src = readFileSync(join(ELECTRON, fileName), 'utf8');
  const found = new Set();
  for (const m of src.matchAll(/\.(?:invoke|send|sendSync)\(\s*['"`]([^'"`]+)['"`]/g)) found.add(m[1]);
  // Channel names also appear as bare arguments in multi-line calls.
  for (const m of src.matchAll(/^\s*['"`]([a-zA-Z]+:[a-zA-Z][\w:]*)['"`],?\s*$/gm)) found.add(m[1]);
  return found;
}

const fromSite = invokedChannels('preloads/webview-preload.cjs');
const fromUi = invokedChannels('preloads/preload.cjs');
const fromExtensionPage = invokedChannels('preloads/extension-preload.cjs');
const fromStore = invokedChannels('preloads/store-preload.cjs');
const anyPreload = new Set([...fromSite, ...fromUi, ...fromExtensionPage, ...fromStore]);

const violations = [];
const add = (rule, h, detail) =>
  violations.push({ rule, where: `${h.file}:${h.line}`, channel: h.channel, detail });

// ---------------------------------------------------------------------------
// Rule 1: never take a site's identity from its own arguments.
//
// This is deliberately not "every site-reachable channel must guard its
// sender". Most of them - ipfs:add, ipfs:get, dns:getDomainInfo - are the
// site-facing API on purpose, and do the same thing whoever calls them; they
// are gated in webview-preload by `ensureLumenSite()`. Firing on all 36 would
// make this check noise, and a check that cries wolf gets switched off.
//
// The real hazard is narrower: a handler whose behaviour depends on *which*
// site is asking - permissions are stored per site key - reading that identity
// out of the payload instead of deriving it from the sender. Then any caller
// can act as any site. `senderSiteContext` derives it from the sender's own
// URL; `ensureUiSender` refuses anything but the app window, which is how the
// domainSite:* family stays safe while taking a host argument.
// ---------------------------------------------------------------------------
const CLAIMS_IDENTITY = /\b(?:input|payload|opts)\s*(?:&&|\?)?\s*\.?\s*(?:\.\s*)?(?:siteKey|host)\b|\b(?:siteKey|host)\s*[:=]\s*safeString\(\s*(?:input|payload)/;

for (const h of handlers) {
  if (h.guardsSender) continue;
  if (!CLAIMS_IDENTITY.test(h.body)) continue;
  add(
    'no-site-identity-from-payload',
    h,
    'takes a site key or host from its arguments without checking the sender - derive it with senderSiteContext(), or restrict the channel with ensureUiSender()'
  );
}

// ---------------------------------------------------------------------------
// Rule 2: an async `ipcMain.on` handler must catch.
//
// `handle` rejects the caller's promise, which the preload wrapper turns into
// `{ok:false}`. `on` has no caller to reject: an async throw there is an
// unhandled rejection in the main process, which is a crash the renderer never
// hears about.
// ---------------------------------------------------------------------------
for (const h of handlers) {
  if (h.kind !== 'on' || !h.isAsync || h.hasTry) continue;
  add('async-on-must-catch', h, 'async ipcMain.on with no try/catch - an throw here is unhandled in main');
}

// ---------------------------------------------------------------------------
// Rule 3: one handler per channel.
//
// Two registrations for one channel is not an error Electron reports - the
// second silently replaces the first for `handle`, and both fire for `on`.
// ---------------------------------------------------------------------------
for (const [channel, list] of byChannel) {
  if (list.length > 1) {
    violations.push({
      rule: 'no-duplicate-channel',
      where: list.map((h) => `${h.file}:${h.line}`).join(', '),
      channel,
      detail: `registered ${list.length} times`,
    });
  }
}

// ---------------------------------------------------------------------------
// Rule 4: no channel called by a preload without a handler behind it.
//
// The call would hang or reject with a message naming a channel nobody can
// find. Cheap to check, and it catches a rename that only touched one side.
// ---------------------------------------------------------------------------
for (const channel of anyPreload) {
  if (!byChannel.has(channel)) {
    violations.push({
      rule: 'no-missing-handler',
      where: '(preload)',
      channel,
      detail: 'called by a preload, but nothing registers it',
    });
  }
}

// ---------------------------------------------------------------------------
// Rule 5: the two chrome shims must offer the same namespaces.
//
// `webview-preload` builds the API for a content script inside a <webview>;
// `extension-preload` builds it for an extension's own pages. They are two
// implementations of one surface, and today both expose the same fourteen
// namespaces - so an extension that works in one place works in the other.
//
// Nothing enforced that. A namespace added to one and forgotten in the other
// is invisible until an extension calls it and gets `undefined is not a
// function`, in whichever of the two contexts nobody tested.
//
// Only the namespace *set* is compared. The members inside differ legitimately
// - a content script has no business calling `management.uninstall` - and
// checking those would fire constantly.
// ---------------------------------------------------------------------------
function shimNamespaces(fileName) {
  const src = readFileSync(join(ELECTRON, fileName), 'utf8');
  const found = new Set();
  // `const namespaces = { alarms: …, runtime: … }` in the extension preload,
  // and `api.alarms = …` / `api.runtime.x = …` in the webview one, which
  // enhances an object rather than declaring it whole.
  for (const m of src.matchAll(/(?:^|\n)\s{4}([a-z][\w]*)\s*:/g)) found.add(m[1]);
  for (const m of src.matchAll(/\bapi\.([a-z][\w]*)\b/g)) found.add(m[1]);
  return found;
}

const KNOWN_CHROME_NAMESPACES = [
  'alarms', 'extension', 'identity', 'idle', 'management', 'notifications',
  'permissions', 'runtime', 'scripting', 'sidePanel', 'storage', 'tabs',
  'webNavigation', 'windows',
];

{
  const inWebview = shimNamespaces('preloads/webview-preload.cjs');
  const inExtension = shimNamespaces('preloads/extension-preload.cjs');
  for (const ns of KNOWN_CHROME_NAMESPACES) {
    const w = inWebview.has(ns);
    const e = inExtension.has(ns);
    if (w === e) continue;
    violations.push({
      rule: 'shims-must-match',
      where: w ? 'extension-preload.cjs' : 'webview-preload.cjs',
      channel: `chrome.${ns}`,
      detail: `offered by ${w ? 'webview-preload' : 'extension-preload'} but not the other - an extension using it breaks in whichever context was forgotten`,
    });
  }
}

// ---------------------------------------------------------------------------
// Rule 6: a site-reachable handler must not return a raw error message.
//
// The caller on these channels is whatever page the user is visiting. Six
// wallet channels - the Keplr/Leap shim - returned `String(e.message)`, and
// the realistic failure in that path is a filesystem error naming
// keystore.json, which spells out the OS username and the profile layout. A
// site could ask for a signature it knew would fail and read the answer.
//
// The fix is a stable code plus a local log, so the allowlist below is the
// list of channels where that was considered and the message was kept. Each
// one is here because its errors carry nothing about the machine: either the
// message is about input the site supplied itself, or the handler only ever
// touches memory.
// ---------------------------------------------------------------------------
const RAW_ERROR_ALLOWED = new Set([
  // Pure crypto over the site's own arguments. The message tells it nothing
  // it did not already know, and it is what makes a bad signature debuggable.
  'wallet:verifyArbitrary',
  // Encoding failures on the payload the site just handed in.
  'ipfs:pubsub:publish',
  'ipfs:pubsub:subscribe',
  // Read in-memory state only - no file is ever opened behind these.
  'extensions:getGrantedPermissionsSync',
  'extensions:getProviderFallbackStateSync',
  // Talks to an RPC node whose address ships in resources/peers.txt, and the
  // app window shows this same message to the user.
  'dns:getDomainInfo',
]);

const RETURNS_RAW_ERROR = /error:\s*(?:String\()?\s*(?:e|err|error)\s*(?:\?\.|\s*&&|\.message)/;

for (const h of handlers) {
  if (!fromSite.has(h.channel)) continue;
  if (RAW_ERROR_ALLOWED.has(h.channel)) continue;
  if (!RETURNS_RAW_ERROR.test(h.body)) continue;
  add(
    'no-raw-error-to-site',
    h,
    'returns a raw error message on a channel a site can call - return a stable code and log the detail, or add the channel to RAW_ERROR_ALLOWED in this script with the reason'
  );
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const TITLES = {
  'no-site-identity-from-payload': 'Site identity taken from arguments without checking the sender',
  'async-on-must-catch': 'Async ipcMain.on without try/catch (unhandled rejection in main)',
  'no-duplicate-channel': 'Channel registered more than once',
  'no-missing-handler': 'Channel called by a preload with no handler',
  'shims-must-match': 'chrome namespace present in one preload shim but not the other',
  'no-raw-error-to-site': 'Raw error message returned to a site',
};

const siteCount = handlers.filter((h) => fromSite.has(h.channel)).length;
console.log(
  `check:ipc - ${handlers.length} handlers, ${byChannel.size} channels, ${siteCount} reachable from a site.`
);

if (!violations.length) {
  console.log('check:ipc - all clear.');
  process.exit(0);
}

const byRule = new Map();
for (const v of violations) {
  if (!byRule.has(v.rule)) byRule.set(v.rule, []);
  byRule.get(v.rule).push(v);
}
for (const [rule, items] of byRule) {
  console.log(`\n=== ${TITLES[rule] || rule} (${items.length}) ===`);
  for (const v of items) console.log(`  ${v.where}  ${v.channel}\n      ${v.detail}`);
}
console.log(`\ncheck:ipc failed - ${violations.length} violation(s).`);
process.exit(1);
