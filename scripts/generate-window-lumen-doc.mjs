// ============================================================================
// scripts/generate-window-lumen-doc.mjs
//
// Generates the window.lumen API reference from the JSDoc comments in
// electron/webview-preload.cjs:
//   1. docs/window-lumen.json — the canonical, machine-readable data.
//   2. docs/window-lumen.html — a self-contained page that renders it.
//
// Unlike a naive text/regex scan, this uses the TypeScript compiler API
// (already a project devDependency — nothing new to install) to parse the
// file into a real AST and pull JSDoc off it the same way an editor's
// "hover" tooltip would. That means nested braces in a return type
// (`Promise<{ok:boolean,data?:{...}}>`), multi-line comments, and bracketed
// optional params (`[opts]`) all just work — there is no line-by-line
// brace-counting to trip over.
//
// Contract this relies on: inside the `lumen` object literal, every leaf API
// method must be a `wrapLumenApiCall(implementationFn, 'fallback_error_code')`
// call, with a `/** ... */` JSDoc block directly above it. Nested plain
// object literals (`wallet: {...}`, `stableLinks: {...}`, ...) are treated
// as namespaces and traversed recursively. See electron/webview-preload.cjs's
// header comment for the full contract.
//
// `buildDocModel()` is also exported for tests: tests/unit/window-lumen-docs.test.ts
// re-parses the current source and diffs the result against the committed
// docs/window-lumen.json to catch "edited the API but forgot to regenerate
// the docs" before it ships.
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const sourceRelPath = path.join('electron', 'webview-preload.cjs');
const sourcePath = path.join(repoRoot, sourceRelPath);
const packageJsonPath = path.join(repoRoot, 'package.json');
const docsDir = path.join(repoRoot, 'docs');
const jsonOutputPath = path.join(docsDir, 'window-lumen.json');
const htmlOutputPath = path.join(docsDir, 'window-lumen.html');

const WRAPPER_CALL_NAME = 'wrapLumenApiCall';

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

/** Collapse a (possibly multi-line, CRLF-containing) comment span into a single normalized line. */
function collapseWhitespace(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

/** Strip a JSDoc tag's leading `- `/whitespace separator, keeping the rest of the description. */
function cleanTagText(text) {
  return collapseWhitespace(String(text ?? '').replace(/^\s*-?\s*/, ''));
}

/** `@returns {Promise<{ok:boolean}>}` etc — read the type text without the wrapping `{}` (handles nested braces). */
function typeTextOf(tag, sourceFile) {
  if (!tag.typeExpression || !tag.typeExpression.type) return '';
  return collapseWhitespace(tag.typeExpression.type.getText(sourceFile));
}

/**
 * Custom `@error`/`@throws` tags aren't native JSDoc tag kinds, so TS gives
 * us the whole `{code} description` string as one blob in `tag.comment`.
 * Split it back into `{code, description}` ourselves.
 */
function parseErrorTag(tag, sourceFile) {
  const raw = collapseWhitespace(ts.getTextOfJSDocComment(tag.comment) || '');
  const match = /^\{([^}]*)\}\s*-?\s*([\s\S]*)$/.exec(raw);
  if (match) {
    return { code: match[1].trim(), description: match[2].trim() };
  }
  return { code: '', description: raw };
}

/** Extract `{description, params[], returns, errors[]}` from a node's leading JSDoc, or null if it has none. */
function extractJsDoc(node, sourceFile) {
  const docs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
  if (!docs.length) return null;

  // If a property somehow has more than one /** */ block, the closest one
  // (last in source order) wins — matches how editors resolve it too.
  const doc = docs[docs.length - 1];
  const description = collapseWhitespace(ts.getTextOfJSDocComment(doc.comment) || '');

  const params = [];
  const errors = [];
  let returns = null;

  for (const tag of doc.tags || []) {
    if (ts.isJSDocParameterTag(tag)) {
      params.push({
        name: tag.name ? tag.name.getText(sourceFile) : '',
        type: typeTextOf(tag, sourceFile),
        optional: !!tag.isBracketed,
        description: cleanTagText(ts.getTextOfJSDocComment(tag.comment))
      });
      continue;
    }
    if (ts.isJSDocReturnTag(tag)) {
      returns = {
        type: typeTextOf(tag, sourceFile),
        description: cleanTagText(ts.getTextOfJSDocComment(tag.comment))
      };
      continue;
    }
    const tagName = tag.tagName.text;
    if (tagName === 'error' || tagName === 'throws') {
      errors.push(parseErrorTag(tag, sourceFile));
    }
  }

  return { description, params, returns, errors };
}

/** Find `const lumen = {...}` among the file's top-level statements. */
function findLumenObjectLiteral(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(decl.name) &&
        decl.name.text === 'lumen' &&
        decl.initializer &&
        ts.isObjectLiteralExpression(decl.initializer)
      ) {
        return decl.initializer;
      }
    }
  }
  return null;
}

/** True for a `wrapLumenApiCall(fn, 'code')`-shaped call expression. */
function isWrapperCall(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === WRAPPER_CALL_NAME
  );
}

/**
 * Walk the `lumen` object literal (and any nested plain-object namespaces
 * inside it) collecting one entry per `wrapLumenApiCall(...)` leaf.
 * `groups` is populated as a side effect: {id -> {label, paths: []}}, in the
 * order namespaces are first encountered, with a synthetic "general" group
 * (top-level, unnamespaced entries) always seeded first.
 */
function collectEntries(objectLiteral, sourceFile, { pathParts = [], entries = [], groups } = {}) {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue;

    const key = property.name.getText(sourceFile).replace(/^['"]|['"]$/g, '');
    const nextPathParts = [...pathParts, key];
    const value = property.initializer;

    if (ts.isObjectLiteralExpression(value)) {
      const groupId = nextPathParts.join('.');
      if (!groups.has(groupId)) {
        groups.set(groupId, { id: groupId, label: key, paths: [] });
      }
      collectEntries(value, sourceFile, { pathParts: nextPathParts, entries, groups });
      continue;
    }

    if (isWrapperCall(value)) {
      const [implArg, fallbackArg] = value.arguments;
      const implementation = implArg ? implArg.getText(sourceFile) : '';
      const fallbackError =
        fallbackArg && ts.isStringLiteralLike(fallbackArg)
          ? fallbackArg.text
          : (fallbackArg ? fallbackArg.getText(sourceFile) : '');

      const doc = extractJsDoc(property, sourceFile);
      const entryPath = nextPathParts.join('.');
      const namespace = pathParts.length ? pathParts.join('.') : null;

      entries.push({
        path: entryPath,
        namespace,
        member: key,
        implementation,
        fallbackError,
        description: doc?.description || '',
        params: doc?.params || [],
        returns: doc?.returns || null,
        errors: doc?.errors || []
      });

      const groupId = namespace || 'general';
      if (!groups.has(groupId)) {
        groups.set(groupId, { id: groupId, label: namespace || 'General', paths: [] });
      }
      groups.get(groupId).paths.push(entryPath);
      continue;
    }

    console.warn(
      `[generate-window-lumen-doc] Skipping "${nextPathParts.join('.')}": ` +
      `not a nested namespace object or a ${WRAPPER_CALL_NAME}(...) call — ` +
      'wrap real logic in a named function and reference it here instead of inlining it.'
    );
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Build the doc model
// ---------------------------------------------------------------------------

function buildDocModel() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    sourceRelPath,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.JS
  );

  const lumenObject = findLumenObjectLiteral(sourceFile);
  if (!lumenObject) {
    throw new Error(`Could not find "const lumen = {...}" in ${sourceRelPath}`);
  }

  const groups = new Map();
  groups.set('general', { id: 'general', label: 'General', paths: [] });

  const entries = collectEntries(lumenObject, sourceFile, { groups });
  if (!entries.length) {
    throw new Error(`Found the lumen object in ${sourceRelPath} but it has no documented entries.`);
  }

  // Drop the seeded "general" group if nothing ended up unnamespaced, and
  // drop any namespace group that (defensively) ended up empty.
  const orderedGroups = Array.from(groups.values()).filter((g) => g.paths.length > 0);

  let appVersion = '0.0.0';
  try {
    appVersion = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version || appVersion;
  } catch {
    // ignore — fall back to '0.0.0' rather than fail the whole generation
  }

  return {
    title: 'window.lumen API Reference',
    source: sourceRelPath.replace(/\\/g, '/'),
    generatedAt: new Date().toISOString(),
    generator: path.relative(repoRoot, __filename).replace(/\\/g, '/'),
    appVersion,
    groups: orderedGroups,
    entries
  };
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

function renderHtml(model) {
  const embeddedJson = JSON.stringify(model)
    // Guard against `</script>` (or a stray `<!--`) inside any doc string
    // breaking out of the embedding <script> tag.
    .replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(model.title)}</title>
<style>${CSS}</style>
</head>
<body>
<div id="app" class="app" aria-busy="true"></div>

<script id="lumen-doc-data" type="application/json">${embeddedJson}</script>
<script>${CLIENT_JS}</script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CSS = `
:root {
  color-scheme: light;
  --bg: #f7f7f9;
  --bg-elevated: #ffffff;
  --border: #e3e4e8;
  --text: #1b1d23;
  --text-muted: #666a75;
  --text-faint: #9198a3;
  --accent: #4f46e5;
  --accent-soft: #eef0ff;
  --accent-contrast: #ffffff;
  --code-bg: #f1f2f6;
  --error: #b91c1c;
  --error-soft: #fdeeee;
  --optional: #9198a3;
  --shadow: 0 1px 2px rgba(20, 20, 30, 0.04), 0 8px 24px rgba(20, 20, 30, 0.05);
  --radius: 12px;
  --namespace-colors: #4f46e5, #0d9488, #b45309, #be185d, #4338ca, #15803d, #a21caf;
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }

.app { display: flex; min-height: 100%; }

/* ---- sidebar ---- */
.sidebar {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--bg-elevated);
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  padding: 20px 16px 32px;
}
.sidebar-header { padding: 4px 8px 16px; }
.sidebar-title { font-size: 16px; font-weight: 700; margin: 0 0 2px; }
.sidebar-title .mono { color: var(--accent); }
.sidebar-subtitle { font-size: 12.5px; color: var(--text-muted); margin: 0; }

.search {
  display: flex; align-items: center; gap: 8px;
  margin: 12px 4px 18px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--bg);
}
.search svg { flex-shrink: 0; color: var(--text-faint); }
.search input {
  border: 0; outline: 0; background: transparent; color: var(--text);
  font: inherit; width: 100%;
}
.search input::placeholder { color: var(--text-faint); }
.search kbd {
  font: 11px/1 ui-monospace, monospace; color: var(--text-faint);
  border: 1px solid var(--border); border-radius: 4px; padding: 2px 5px;
}

.nav-group { margin-bottom: 6px; }
.nav-group-header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 8px; margin-top: 10px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--text-faint);
}
.nav-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.nav-count {
  margin-left: auto; font-size: 10.5px; font-weight: 600; color: var(--text-faint);
  background: var(--code-bg); border-radius: 999px; padding: 1px 7px;
}
.nav-list { list-style: none; margin: 0; padding: 0; }
.nav-link {
  display: block; padding: 6px 10px 6px 22px; margin: 1px 0;
  border-radius: 7px; color: var(--text-muted); text-decoration: none;
  font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  border-left: 2px solid transparent;
}
.nav-link:hover { background: var(--accent-soft); color: var(--text); }
.nav-link.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; border-left-color: var(--accent); }
.nav-empty { padding: 24px 12px; color: var(--text-faint); font-size: 13px; }

/* ---- main ---- */
.main { flex: 1; min-width: 0; }
.topbar {
  position: sticky; top: 0; z-index: 5;
  display: flex; align-items: center; gap: 12px;
  padding: 14px 32px; border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
}
.meta-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px; color: var(--text-muted);
  border: 1px solid var(--border); border-radius: 999px; padding: 5px 12px;
}
.meta-pill .mono { color: var(--accent); font-weight: 600; }

.content { max-width: 880px; margin: 0 auto; padding: 40px 32px 120px; }
.page-title { font-size: 26px; font-weight: 800; margin: 0 0 28px; }

.group-heading {
  display: flex; align-items: baseline; gap: 10px;
  margin: 48px 0 16px;
  padding-bottom: 8px; border-bottom: 1px solid var(--border);
}
.group-heading:first-of-type { margin-top: 0; }
.group-heading h2 { font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; margin: 0; }
.group-heading .nav-dot { width: 8px; height: 8px; }

.card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 22px 24px 24px;
  margin-bottom: 18px;
  scroll-margin-top: 76px;
}
.card-head {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  margin-bottom: 4px;
}
.card-title {
  font-size: 17px; font-weight: 700; margin: 0;
}
.copy-link {
  border: 0; background: transparent; color: var(--text-faint); cursor: pointer;
  padding: 4px; border-radius: 6px; display: flex;
}
.copy-link:hover { color: var(--accent); background: var(--accent-soft); }
.badge {
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase;
  padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-muted);
}
.card-desc { color: var(--text-muted); margin: 10px 0 0; }

.section-label {
  font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
  color: var(--text-faint); margin: 20px 0 8px;
}
table.data-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13.5px; }
table.data-table th {
  text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-faint); font-weight: 600; padding: 0 10px 6px; border-bottom: 1px solid var(--border);
}
table.data-table td { padding: 9px 10px; border-bottom: 1px solid var(--border); vertical-align: top; overflow-wrap: anywhere; }
table.data-table tr:last-child td { border-bottom: 0; }
table.data-table td.desc { color: var(--text-muted); }
.type-chip {
  display: inline-block; font-size: 12px; padding: 2px 8px; border-radius: 6px;
  background: var(--code-bg); color: var(--text-muted);
  white-space: normal; overflow-wrap: anywhere; max-width: 100%;
}
.param-name { font-weight: 600; }
.optional-tag { color: var(--optional); font-weight: 500; font-size: 11.5px; margin-left: 6px; }

.returns-box {
  display: flex; align-items: flex-start; gap: 10px; flex-wrap: wrap;
  background: var(--code-bg); border-radius: 9px; padding: 12px 14px; font-size: 13.5px;
}
.returns-box .type-chip { background: var(--accent-soft); color: var(--accent); min-width: 0; }
.returns-box .desc { color: var(--text-muted); min-width: 0; flex: 1 1 220px; }

.error-code {
  font-size: 12.5px; background: var(--error-soft); color: var(--error);
  padding: 2px 8px; border-radius: 6px; white-space: nowrap;
}

.card-meta {
  margin-top: 20px; padding-top: 14px; border-top: 1px dashed var(--border);
  display: flex; flex-wrap: wrap; gap: 16px;
  font-size: 12px; color: var(--text-faint);
}
.card-meta span b { color: var(--text-muted); font-weight: 600; }

.empty-note { color: var(--text-faint); font-size: 13px; margin: 6px 0 0; }
.no-results { padding: 60px 0; text-align: center; color: var(--text-faint); }

@media (max-width: 860px) {
  .app { flex-direction: column; }
  .sidebar { position: relative; width: 100%; height: auto; max-height: 44vh; }
  .content { padding: 28px 18px 100px; }
  .topbar { padding: 12px 18px; }
}
`;

const CLIENT_JS = `
(function () {
  var dataEl = document.getElementById('lumen-doc-data');
  var model = JSON.parse(dataEl.textContent);
  var app = document.getElementById('app');

  var NAMESPACE_COLORS = getComputedStyle(document.documentElement)
    .getPropertyValue('--namespace-colors')
    .split(',').map(function (c) { return c.trim(); }).filter(Boolean);

  function colorForGroup(index) {
    return NAMESPACE_COLORS[index % NAMESPACE_COLORS.length];
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function slugify(pathStr) {
    return 'm-' + pathStr.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  }

  var entryByPath = {};
  model.entries.forEach(function (e) { entryByPath[e.path] = e; });

  function paramsTable(entry) {
    if (!entry.params.length) return '';
    var rows = entry.params.map(function (p) {
      return '<tr>' +
        '<td><span class="param-name mono">' + esc(p.name) + '</span>' +
        (p.optional ? '<span class="optional-tag">optional</span>' : '') + '</td>' +
        '<td>' + (p.type ? '<span class="type-chip mono">' + esc(p.type) + '</span>' : '') + '</td>' +
        '<td class="desc">' + esc(p.description) + '</td>' +
      '</tr>';
    }).join('');
    return '<div class="section-label">Parameters</div>' +
      '<table class="data-table">' +
      '<colgroup><col style="width:19%"><col style="width:27%"><col></colgroup>' +
      '<thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
  }

  function returnsBlock(entry) {
    if (!entry.returns) return '';
    return '<div class="section-label">Returns</div>' +
      '<div class="returns-box">' +
      (entry.returns.type ? '<span class="type-chip mono">' + esc(entry.returns.type) + '</span>' : '') +
      '<span class="desc">' + esc(entry.returns.description) + '</span>' +
      '</div>';
  }

  function errorsTable(entry) {
    if (!entry.errors.length) return '';
    var rows = entry.errors.map(function (er) {
      return '<tr>' +
        '<td><span class="error-code mono">' + esc(er.code) + '</span></td>' +
        '<td class="desc">' + esc(er.description) + '</td>' +
      '</tr>';
    }).join('');
    return '<div class="section-label">Possible errors</div>' +
      '<table class="data-table">' +
      '<colgroup><col style="width:27%"><col></colgroup>' +
      '<thead><tr><th>Code</th><th>Description</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
  }

  function renderCard(entry, groupIndex) {
    var id = slugify(entry.path);
    return '<article class="card" id="' + id + '" data-path="' + esc(entry.path.toLowerCase()) + '">' +
      '<div class="card-head">' +
        '<h3 class="card-title mono">' + esc(entry.path) + '</h3>' +
        '<button class="copy-link" data-copy="#' + id + '" title="Copy link to this method" aria-label="Copy link">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.5"/><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L12.5 19.5"/></svg>' +
        '</button>' +
      '</div>' +
      (entry.description ? '<p class="card-desc">' + esc(entry.description) + '</p>' : '') +
      paramsTable(entry) +
      returnsBlock(entry) +
      errorsTable(entry) +
      '<div class="card-meta">' +
        '<span><b>Implementation</b> <code class="mono">' + esc(entry.implementation || '—') + '</code></span>' +
        '<span><b>Default error code</b> <code class="mono">' + esc(entry.fallbackError || '—') + '</code></span>' +
      '</div>' +
    '</article>';
  }

  function renderSidebar() {
    var groupsHtml = model.groups.map(function (g, i) {
      var links = g.paths.map(function (p) {
        var entry = entryByPath[p];
        return '<li><a class="nav-link" href="#' + slugify(p) + '" data-path="' + esc(p.toLowerCase()) + '">' + esc(entry.member) + '</a></li>';
      }).join('');
      return '<div class="nav-group" data-group="' + esc(g.id) + '">' +
        '<div class="nav-group-header"><span class="nav-dot" style="background:' + colorForGroup(i) + '"></span>' + esc(g.label) + '<span class="nav-count">' + g.paths.length + '</span></div>' +
        '<ul class="nav-list">' + links + '</ul>' +
      '</div>';
    }).join('');

    return (
      '<nav class="sidebar" id="sidebar">' +
        '<div class="sidebar-header">' +
          '<p class="sidebar-title"><span class="mono">window.lumen</span></p>' +
          '<p class="sidebar-subtitle">' + model.entries.length + ' methods · auto-generated</p>' +
        '</div>' +
        '<label class="search">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
          '<input id="search-input" type="text" placeholder="Filter methods…" autocomplete="off">' +
          '<kbd>/</kbd>' +
        '</label>' +
        '<div id="nav-groups">' + groupsHtml + '</div>' +
        '<p class="nav-empty" id="nav-empty" hidden>No methods match.</p>' +
      '</nav>'
    );
  }

  function renderMain() {
    var groupsHtml = model.groups.map(function (g, i) {
      var cards = g.paths.map(function (p) { return renderCard(entryByPath[p], i); }).join('');
      return '<section data-group="' + esc(g.id) + '">' +
        '<div class="group-heading"><span class="nav-dot" style="background:' + colorForGroup(i) + '"></span><h2>' + esc(g.label) + '</h2></div>' +
        cards +
      '</section>';
    }).join('');

    var generated = new Date(model.generatedAt);
    var generatedLabel = isNaN(generated.getTime()) ? model.generatedAt : generated.toLocaleString();

    return (
      '<main class="main">' +
        '<div class="topbar">' +
          '<span class="meta-pill">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' +
            'Generated ' + esc(generatedLabel) + ' <span class="mono">· v' + esc(model.appVersion) + '</span>' +
          '</span>' +
        '</div>' +
        '<div class="content">' +
          '<h1 class="page-title">' + esc(model.title) + '</h1>' +
          '<div id="groups-container">' + groupsHtml + '</div>' +
          '<p class="no-results" id="no-results" hidden>No methods match your search.</p>' +
        '</div>' +
      '</main>'
    );
  }

  app.setAttribute('aria-busy', 'false');
  app.innerHTML = renderSidebar() + renderMain();

  // ---- search / filter ----
  var searchInput = document.getElementById('search-input');
  var navEmpty = document.getElementById('nav-empty');
  var noResults = document.getElementById('no-results');

  function applyFilter(query) {
    var q = query.trim().toLowerCase();
    var visibleCount = 0;

    document.querySelectorAll('.nav-link').forEach(function (link) {
      var match = !q || link.getAttribute('data-path').indexOf(q) !== -1;
      link.style.display = match ? '' : 'none';
      if (match) visibleCount += 1;
    });
    document.querySelectorAll('.nav-group').forEach(function (group) {
      var anyVisible = Array.prototype.some.call(group.querySelectorAll('.nav-link'), function (l) { return l.style.display !== 'none'; });
      group.style.display = anyVisible ? '' : 'none';
    });
    navEmpty.hidden = visibleCount !== 0;

    var visibleCards = 0;
    document.querySelectorAll('.card').forEach(function (card) {
      var match = !q || card.getAttribute('data-path').indexOf(q) !== -1;
      card.style.display = match ? '' : 'none';
      if (match) visibleCards += 1;
    });
    document.querySelectorAll('#groups-container > section').forEach(function (section) {
      var anyVisible = Array.prototype.some.call(section.querySelectorAll('.card'), function (c) { return c.style.display !== 'none'; });
      section.style.display = anyVisible ? '' : 'none';
    });
    noResults.hidden = visibleCards !== 0;
  }

  searchInput.addEventListener('input', function (e) { applyFilter(e.target.value); });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
    if (e.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.value = '';
      applyFilter('');
      searchInput.blur();
    }
  });

  // ---- active-section highlight on scroll ----
  var sections = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));
  function setActive(id) {
    links.forEach(function (l) { l.classList.toggle('active', l.getAttribute('href') === '#' + id); });
  }
  if ('IntersectionObserver' in window && sections.length) {
    var observer = new IntersectionObserver(function (entriesList) {
      entriesList.forEach(function (e) {
        if (e.isIntersecting) setActive(e.target.id);
      });
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
    sections.forEach(function (s) { observer.observe(s); });
  }

  // ---- copy-link buttons ----
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.copy-link') : null;
    if (!btn) return;
    var hash = btn.getAttribute('data-copy');
    var url = location.origin + location.pathname + hash;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(function () {});
    }
    history.replaceState(null, '', hash);
  });
})();
`;

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  const model = buildDocModel();

  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  fs.writeFileSync(jsonOutputPath, JSON.stringify(model, null, 2) + '\n', 'utf8');
  fs.writeFileSync(htmlOutputPath, renderHtml(model), 'utf8');

  console.log(
    `Generated ${path.relative(repoRoot, jsonOutputPath)} and ` +
    `${path.relative(repoRoot, htmlOutputPath)} with ${model.entries.length} entries ` +
    `across ${model.groups.length} groups.`
  );
}

const isMainModule = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1] || '').href;
  } catch {
    return false;
  }
})();

if (isMainModule) {
  try {
    main();
  } catch (error) {
    console.error(`[generate-window-lumen-doc] ${error.message}`);
    process.exit(1);
  }
}

export { buildDocModel, renderHtml, sourceRelPath, jsonOutputPath };
