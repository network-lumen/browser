const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

// usage: node genericize-prop.cjs <propName> <utilPrefix> [DRY]
const propName = process.argv[2];
const utilPrefix = process.argv[3];
const DRY_RUN = process.argv[4] === 'DRY';

const utilPath = 'src/css/utilities.css';
let utilContent = fs.readFileSync(utilPath, 'utf8');

const srcFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.vue$/.test(e.name)) srcFiles.push(p);
  }
})('src');
const fileContents = new Map(srcFiles.map(f => [f, fs.readFileSync(f, 'utf8')]));

function countTokenUsage(cls) {
  let count = 0;
  for (const [, c] of fileContents) {
    const re = /\bclass="([^"]*)"/g; let m;
    while ((m = re.exec(c))) if (m[1].split(/\s+/).includes(cls)) count++;
  }
  return count;
}
// requiredClasses: array of class names that must ALL be present on the element
// (handles .base.modifier compounds correctly instead of matching on just one class)
function addClassToElements(requiredClasses, addClass) {
  let touched = 0;
  for (const [f, c] of fileContents) {
    const newC = c.replace(/\bclass="([^"]*)"/g, (full, classList) => {
      const tokens = classList.split(/\s+/);
      if (!requiredClasses.every(rc => tokens.includes(rc))) return full;
      if (tokens.includes(addClass)) return full;
      touched++;
      return `class="${classList} ${addClass}"`;
    });
    fileContents.set(f, newC);
  }
  return touched;
}
// count elements having ALL requiredClasses present
function countRequiredUsage(requiredClasses) {
  let count = 0;
  for (const [, c] of fileContents) {
    const re = /\bclass="([^"]*)"/g; let m;
    while ((m = re.exec(c))) {
      const tokens = m[1].split(/\s+/);
      if (requiredClasses.every(rc => tokens.includes(rc))) count++;
    }
  }
  return count;
}

const utilClassNames = new Set();
{
  const flexContent = fs.readFileSync('src/css/flex.css', 'utf8');
  for (const content of [utilContent, flexContent]) {
    const re = /^\.([a-zA-Z0-9_-]+)\s*[,{]/gm;
    let m;
    while ((m = re.exec(content))) utilClassNames.add(m[1]);
  }
}

// find existing utility class whose body is EXACTLY "propName: <value>;" with the SAME pseudo suffix
function findExistingClassForValue(value, pseudo) {
  const re = new RegExp('\\.([a-zA-Z0-9_-]+)' + pseudo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{\\s*' + propName + ':\\s*' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ';?\\s*\\}', '');
  const m = utilContent.match(re);
  return m ? m[1] : null;
}

function colorSlug(v) {
  v = v.trim();
  let m = v.match(/^var\(--([a-zA-Z0-9-]+)(?:,\s*[^)]+)?\)$/);
  if (m) return m[1];
  m = v.match(/^#([0-9a-fA-F]{3,8})$/);
  if (m) return 'hex-' + m[1].toLowerCase();
  if (v === 'transparent') return 'transparent';
  if (/^currentcolor$/i.test(v)) return 'current';
  // rgba(var(--x-rgb), alpha) -> "x-aNN" (matches the established --primary-aNN naming style)
  m = v.match(/^rgba?\(\s*var\(--([a-zA-Z0-9-]+)-rgb\)\s*,\s*([\d.]+)\s*\)$/);
  if (m) return m[1] + '-a' + m[2].replace(/^0\./, '').replace('.', '');
  // rgba(r, g, b, a) with literal numbers (no nested parens)
  m = v.match(/^rgba?\(([^()]+)\)$/);
  if (m) return 'rgba-' + m[1].replace(/[\s,.]+/g, '-').replace(/^-|-$/g, '');
  return null;
}
function slugForValue(value) {
  let v = value.trim();
  const cs = colorSlug(v);
  if (cs !== null) return cs;
  m2: {
    let m = v.match(/^(\d*\.?\d+)px$/); if (m) return m[1] + 'px';
    m = v.match(/^(\d*\.?\d+)rem$/); if (m) return String(Math.floor(parseFloat(m[1]) * 100 + 1e-9));
    m = v.match(/^(\d*\.?\d+)%$/); if (m) return m[1] + 'pct';
  }
  if (v === '0' || v === 'none') return v;
  // border shorthand: "<width> <style> <color>" or "<width> <style>" or "var(--border-width) <style> <color>"
  let m = v.match(/^(var\(--border-width\)|\d*\.?\d+px)\s+(solid|dashed|dotted)(?:\s+(.+))?$/);
  if (m) {
    const widthTok = m[1] === 'var(--border-width)' ? 'width' : m[1].replace('px', '').replace('.', '');
    const styleTok = m[2] === 'solid' ? '' : '-' + m[2];
    if (!m[3]) return widthTok + styleTok;
    const cSlug = colorSlug(m[3]);
    if (cSlug === null) return null;
    return widthTok + styleTok + '-' + cSlug;
  }
  return null;
}
function pseudoSlug(pseudo) {
  // ":hover" -> "hover", ":hover:not(:disabled)" -> "hover-not-disabled",
  // ":not(.active)" -> "not-active" (strip the leading "." from class args too)
  return pseudo.replace(/^:/, '').replace(/[:().]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const root = postcss.parse(fs.readFileSync('src/css/theme.css', 'utf8'));

function extractTargets(selector) {
  // each compound: one or more ".class" tokens (handles .base.modifier), optionally
  // followed by a pseudo-class chain (":hover", ":not(:disabled)"...). No descendants,
  // no pseudo-elements, no attribute selectors.
  const compounds = selector.split(',').map(s => s.trim());
  const targets = [];
  let bad = false;
  for (const c of compounds) {
    if (/::/.test(c)) { bad = true; continue; }
    if (/:(before|after)\b/.test(c)) { bad = true; continue; } // legacy single-colon pseudo-elements
    if (/[\s>+~[]/.test(c)) { bad = true; continue; } // descendant/attr selector
    const m = c.match(/^((?:\.[a-zA-Z0-9_-]+)+)((?::[a-zA-Z-]+(?:\([^)]*\))?)*)$/);
    if (!m) { bad = true; continue; }
    const classes = m[1].split('.').filter(Boolean);
    targets.push({ classes, pseudo: m[2] || '' });
  }
  if (!bad && targets.length > 0) {
    const p0 = targets[0].pseudo;
    if (!targets.every(t => t.pseudo === p0)) bad = true;
  }
  return { targets, bad };
}

// PASS 1: conflict detection
const targetValues = new Map();
root.walkRules(rule => {
  if (rule.parent && rule.parent.type === 'atrule') return;
  const decl = rule.nodes.find(n => n.type === 'decl' && n.prop === propName);
  if (!decl) return;
  const { targets, bad } = extractTargets(rule.selector);
  if (bad) return;
  for (const t of targets) {
    const key = t.classes.join('.') + '|' + t.pseudo;
    if (!targetValues.has(key)) targetValues.set(key, new Set());
    targetValues.get(key).add(decl.value.trim());
  }
});
const conflicting = new Set([...targetValues.entries()].filter(([, v]) => v.size > 1).map(([k]) => k));

const report = [];
const newUtilClasses = [];

root.walkRules(rule => {
  if (rule.parent && rule.parent.type === 'atrule') return;
  if (/ipfspage-markdown-view/.test(rule.selector)) return;
  const decl = rule.nodes.find(n => n.type === 'decl' && n.prop === propName);
  if (!decl) return;
  const { targets, bad } = extractTargets(rule.selector);
  if (bad) { report.push({ selector: rule.selector, value: decl.value, status: 'SKIP-compound-or-descendant' }); return; }

  if (targets.some(t => conflicting.has(t.classes.join('.') + '|' + t.pseudo))) {
    report.push({ selector: rule.selector, value: decl.value, status: 'SKIP-context-dependent-conflict' });
    return;
  }
  // if EVERY class in a compound is itself a pre-existing generic utility, skip (a contextual
  // override of a utility class isn't safely convertible the same way)
  if (targets.some(t => t.classes.every(c => utilClassNames.has(c)))) {
    report.push({ selector: rule.selector, value: decl.value, status: 'SKIP-target-is-generic-utility' });
    return;
  }

  const pseudo = targets[0].pseudo;
  const existing = findExistingClassForValue(decl.value.trim(), pseudo);
  let targetClass = existing;
  let classExists = !!existing;
  if (!targetClass) {
    const slug = slugForValue(decl.value.trim());
    if (slug === null) { report.push({ selector: rule.selector, value: decl.value, status: 'SKIP-unsupported-value' }); return; }
    targetClass = utilPrefix + '-' + slug + (pseudo ? '-' + pseudoSlug(pseudo) : '');
    classExists = utilContent.includes(`.${targetClass}${pseudo} {`) || utilContent.includes(`.${targetClass}${pseudo}{`) || newUtilClasses.some(l => l.startsWith(`.${targetClass}${pseudo} `));
  }

  const perTarget = targets.map(t => ({ target: t.classes.join('.'), expectedOccurrences: countRequiredUsage(t.classes) }));
  if (perTarget.some(p => p.expectedOccurrences === 0)) {
    report.push({ selector: rule.selector, value: decl.value, perTarget, status: 'SKIP-zero-static-occurrence' });
    return;
  }

  report.push({ selector: rule.selector, value: decl.value, targetClass, pseudo, classExists, perTarget, status: 'PLANNED' });

  if (!DRY_RUN) {
    if (!classExists) newUtilClasses.push(`.${targetClass}${pseudo} { ${propName}: ${decl.value}; }`);
    for (const t of targets) addClassToElements(t.classes, targetClass);
    decl.remove();
  }
});

root.walkRules(rule => {
  if (!DRY_RUN && rule.nodes.filter(n => n.type === 'decl').length === 0 && !(rule.parent && rule.parent.type === 'atrule')) rule.remove();
});

fs.writeFileSync('scratch_genplan_' + propName.replace(/[^a-z]/g, '') + '.json', JSON.stringify(report, null, 2));
const planned = report.filter(r => r.status === 'PLANNED');
console.log('Prop:', propName, '| Total seen:', report.length, '| Planned:', planned.length);
for (const s of ['SKIP-unsupported-value', 'SKIP-context-dependent-conflict', 'SKIP-target-is-generic-utility', 'SKIP-zero-static-occurrence', 'SKIP-compound-or-descendant']) {
  console.log(' ', s + ':', report.filter(r => r.status === s).length);
}

if (!DRY_RUN) {
  fs.writeFileSync('src/css/theme.css', root.toString());
  for (const [f, c] of fileContents) fs.writeFileSync(f, c);
  if (newUtilClasses.length) {
    utilContent = utilContent.replace(/\n$/, '\n' + newUtilClasses.join('\n') + '\n');
    fs.writeFileSync(utilPath, utilContent);
  }
  console.log('New utility classes added:', newUtilClasses.length);
}
