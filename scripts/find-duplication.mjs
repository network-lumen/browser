#!/usr/bin/env node
/**
 * Reports repeated code in `src/`, so a cleanup pass starts from evidence
 * rather than from whatever happened to catch someone's eye.
 *
 * It reads a real AST - TypeScript's own parser, with `@vue/compiler-sfc`
 * pulling the `<script setup>` block out of `.vue` files first. That choice is
 * not incidental. Throwaway regex and brace-matching versions of this got it
 * wrong twice in one session: one truncated two function bodies at the `{`
 * inside `opts: { push?: boolean }`, so the equal prefixes hashed equal and it
 * declared them duplicates when they were not; another let `[\s\S]*?` run past
 * the end of a statement and matched a type argument two declarations up. The
 * parser has no opinion about braces inside type arguments, so neither of
 * those failure modes exists here.
 *
 * This is a REPORT, not a gate. Every finding needs a human to decide: some
 * repetition is the point (a one-line wrapper carrying a page's own constants
 * over a shared helper), and some is the bug (a protocol prefix or an
 * injection key written out twenty times). It deliberately does not fail the
 * build.
 *
 *   node scripts/find-duplication.mjs            # everything
 *   node scripts/find-duplication.mjs bodies     # one section
 *   node scripts/find-duplication.mjs --min 4    # raise the threshold
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parse as parseSfc } from '@vue/compiler-sfc';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(repoRoot, 'src');

/** Below this many occurrences, repetition is usually just coincidence. */
const DEFAULT_MIN = 2;

/** A repeated string this short is a word, not a key worth extracting. */
const MIN_LITERAL_LENGTH = 6;

// ---------------------------------------------------------------------------
// Reading files

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/**
 * The TypeScript in a file: a `.ts` as-is, or the `<script>` block of a `.vue`.
 * Returns null when there is nothing to parse.
 */
function scriptOf(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.ts')) return text;
  const { descriptor } = parseSfc(text, { filename: file });
  const block = descriptor.scriptSetup || descriptor.script;
  return block ? block.content : null;
}

function sourceFileOf(file) {
  const content = scriptOf(file);
  if (content === null) return null;
  return ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

const relative = (file) => path.relative(repoRoot, file).split(path.sep).join('/');

// ---------------------------------------------------------------------------
// Normalisation
//
// Two copies of the same logic rarely match character for character: they read
// their state from different places. Rewriting every identifier to a
// positional placeholder is what lets `tabState.value` and `activeTab.value`
// compare equal, which is exactly the difference that hid navigateInternal.

function normalise(node, sourceText) {
  const names = new Map();
  const parts = [];

  const visit = (n) => {
    if (ts.isIdentifier(n)) {
      const name = n.text;
      if (!names.has(name)) names.set(name, `v${names.size}`);
      parts.push(names.get(name));
      return;
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      parts.push(`"${n.text}"`);
      return;
    }
    if (ts.isNumericLiteral(n)) {
      parts.push(n.text);
      return;
    }
    parts.push(`(${ts.SyntaxKind[n.kind]}`);
    n.forEachChild(visit);
    parts.push(')');
  };

  visit(node);
  return parts.join(' ');
}

/** Rough size guard, so a two-line helper is not reported as a clone. */
function statementCount(node) {
  let count = 0;
  const visit = (n) => {
    if (ts.isStatement(n)) count++;
    n.forEachChild(visit);
  };
  node.forEachChild(visit);
  return count;
}

// ---------------------------------------------------------------------------
// Collectors

/** Functions whose bodies are the same once identifiers are anonymised. */
function collectBodies(files, minStatements) {
  const groups = new Map();

  for (const file of files) {
    const sf = sourceFileOf(file);
    if (!sf) continue;

    const visit = (node) => {
      const isFn =
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ((ts.isFunctionExpression(node) || ts.isArrowFunction(node)) &&
          ts.isVariableDeclaration(node.parent));

      if (isFn && node.body && ts.isBlock(node.body)) {
        if (statementCount(node.body) >= minStatements) {
          const key = normalise(node.body, sf.text);
          const name = ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)
            ? node.name?.getText() ?? '(anonymous)'
            : node.parent.name?.getText() ?? '(anonymous)';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push({ file: relative(file), name, lines: node.body.getText().split('\n').length });
        }
      }
      node.forEachChild(visit);
    };
    visit(sf);
  }
  return groups;
}

/**
 * Type annotations written out identically in several places. This is the one
 * that found `((url: string, opts?: { push?: boolean }) => void) | null`,
 * copied verbatim eighteen times because there was no name for it.
 */
function collectTypes(files) {
  const groups = new Map();

  for (const file of files) {
    const sf = sourceFileOf(file);
    if (!sf) continue;

    const visit = (node) => {
      // Only composite types: `string` repeating is not a finding.
      const composite =
        ts.isFunctionTypeNode(node) ||
        ts.isUnionTypeNode(node) ||
        ts.isTypeLiteralNode(node) ||
        ts.isIntersectionTypeNode(node);

      if (composite) {
        const text = node.getText().replace(/\s+/g, ' ').trim();
        if (text.length >= 20) {
          if (!groups.has(text)) groups.set(text, []);
          groups.get(text).push({
            file: relative(file),
            line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
          });
        }
      }
      node.forEachChild(visit);
    };
    visit(sf);
  }
  return groups;
}

/**
 * String literals repeated across files - injection keys, IPC channel names,
 * storage keys. A typo in one copy is silent by construction, which is what
 * makes these worth a named constant.
 */
/**
 * The `"function"` in `typeof x === "function"`. Defensive code is full of
 * these and they drowned every real finding - they are a language keyword
 * spelled as a string, not a shared constant anyone could get wrong.
 */
function isTypeofOperand(node) {
  const parent = node.parent;
  if (!parent || !ts.isBinaryExpression(parent)) return false;
  const other = parent.left === node ? parent.right : parent.left;
  return ts.isTypeOfExpression(other);
}

function collectLiterals(files) {
  const groups = new Map();

  for (const file of files) {
    const sf = sourceFileOf(file);
    if (!sf) continue;

    const visit = (node) => {
      if (
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        !ts.isImportDeclaration(node.parent) &&
        !ts.isExportDeclaration(node.parent) &&
        !isTypeofOperand(node)
      ) {
        const text = node.text;
        // Sentences are UI copy, not identifiers; skip anything with a space.
        if (text.length >= MIN_LITERAL_LENGTH && !/\s/.test(text)) {
          if (!groups.has(text)) groups.set(text, new Map());
          const byFile = groups.get(text);
          byFile.set(relative(file), (byFile.get(relative(file)) || 0) + 1);
        }
      }
      node.forEachChild(visit);
    };
    visit(sf);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Report

function heading(title) {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
}

function reportBodies(files, min, minStatements) {
  heading(`Identical function bodies (>= ${minStatements} statements)`);
  const groups = [...collectBodies(files, minStatements)]
    .filter(([, hits]) => hits.length >= min)
    .sort((a, b) => b[1][0].lines * b[1].length - a[1][0].lines * a[1].length);

  if (!groups.length) return console.log('  none');

  for (const [, hits] of groups) {
    console.log(`\n  ${hits.length}x  ~${hits[0].lines} lines`);
    for (const hit of hits) console.log(`      ${hit.file}  ${hit.name}()`);
  }
}

function reportTypes(files, min) {
  heading('Type annotations written out more than once');
  const groups = [...collectTypes(files)]
    .filter(([, hits]) => hits.length >= min)
    .sort((a, b) => b[1].length - a[1].length);

  if (!groups.length) return console.log('  none');

  for (const [text, hits] of groups.slice(0, 25)) {
    const files_ = [...new Set(hits.map((h) => h.file))];
    console.log(`\n  ${hits.length}x in ${files_.length} file(s)`);
    console.log(`      ${text.length > 100 ? `${text.slice(0, 100)}…` : text}`);
    for (const f of files_.slice(0, 6)) console.log(`      - ${f}`);
    if (files_.length > 6) console.log(`      - … ${files_.length - 6} more`);
  }
}

function reportLiterals(files, min) {
  heading('String literals repeated across files');
  const groups = [...collectLiterals(files)]
    .map(([text, byFile]) => ({
      text,
      files: [...byFile.keys()],
      total: [...byFile.values()].reduce((a, b) => a + b, 0)
    }))
    // Repetition inside one file is that file's business; across files it is a
    // contract nobody named.
    .filter((g) => g.files.length >= Math.max(min, 2))
    .sort((a, b) => b.files.length - a.files.length || b.total - a.total);

  if (!groups.length) return console.log('  none');

  for (const g of groups.slice(0, 25)) {
    console.log(`\n  ${JSON.stringify(g.text)}  -  ${g.total}x across ${g.files.length} files`);
    for (const f of g.files.slice(0, 6)) console.log(`      - ${f}`);
    if (g.files.length > 6) console.log(`      - … ${g.files.length - 6} more`);
  }
}

// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const minIndex = args.indexOf('--min');
  const min = minIndex === -1 ? DEFAULT_MIN : Number(args[minIndex + 1]) || DEFAULT_MIN;
  const stmtIndex = args.indexOf('--min-statements');
  const minStatements = stmtIndex === -1 ? 3 : Number(args[stmtIndex + 1]) || 3;
  const sections = args.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));

  const files = walk(SRC);
  const want = (name) => !sections.length || sections.includes(name);

  console.log(`Scanning ${files.length} files under src/  (min ${min} occurrences)`);

  if (want('bodies')) reportBodies(files, min, minStatements);
  if (want('types')) reportTypes(files, min);
  if (want('literals')) reportLiterals(files, min);

  console.log('\nNothing here is automatically a defect - read before acting.\n');
}

main();
