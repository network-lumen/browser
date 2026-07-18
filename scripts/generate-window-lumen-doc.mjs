import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(repoRoot, 'electron', 'webview-preload.cjs');
const docsDir = path.join(repoRoot, 'docs');
const outputPath = path.join(docsDir, 'window-lumen.html');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeComment(comment) {
  if (!comment) return '';
  return comment
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*+\s?/, '').trim())
    .filter(Boolean)
    .join(' ');
}

function parseObjectKeys(source, objectName) {
  const search = `const ${objectName} = `;
  const start = source.indexOf(search);
  if (start === -1) return null;

  const openBrace = source.indexOf('{', start + search.length);
  if (openBrace === -1) return null;

  let depth = 1;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openBrace + 1; i < source.length; i += 1) {
    const char = source[i];
    const nextChar = source[i + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (inSingle) {
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === "'") {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inDouble = false;
      }
      continue;
    }

    if (inTemplate) {
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '`') {
        inTemplate = false;
      }
      continue;
    }

    if (char === '/' && nextChar === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (char === "'") {
      inSingle = true;
      continue;
    }

    if (char === '"') {
      inDouble = true;
      continue;
    }

    if (char === '`') {
      inTemplate = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openBrace + 1, i);
      }
    }
  }

  return null;
}

function parseEntries(source) {
  const lines = source.split(/\r?\n/);
  const result = [];
  const stack = [];
  let currentComment = '';
  let isInBlockComment = false;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      currentComment = '';
      continue;
    }

    if (line.startsWith('/**')) {
      isInBlockComment = true;
      currentComment = line.replace(/^\/\*\*/, '').replace(/\*\/$/, '').trim();
      if (line.includes('*/')) {
        isInBlockComment = false;
        currentComment = normalizeComment(currentComment);
      }
      continue;
    }

    if (isInBlockComment) {
      if (line.includes('*/')) {
        isInBlockComment = false;
        currentComment += ' ' + line.replace(/\*\//, '').trim();
        currentComment = normalizeComment(currentComment);
      } else {
        currentComment += ' ' + line.replace(/^\*/, '').trim();
      }
      continue;
    }

    if (line.startsWith('//')) {
      currentComment = line.slice(2).trim();
      continue;
    }

    if (line.endsWith('{') && line.includes(':')) {
      const name = line.split(':')[0].trim();
      stack.push(name);
      currentComment = '';
      continue;
    }

    if (line === '},' || line === '}' || line === '},' || line === '},') {
      stack.pop();
      currentComment = '';
      continue;
    }

    const fnMatch = line.match(/^([A-Za-z0-9_$]+)\s*:\s*wrapLumenApiCall\(/);
    const rawFnMatch = line.match(/^([A-Za-z0-9_$]+)\s*:\s*async\s*\(/);
    const rawFnArrowMatch = line.match(/^([A-Za-z0-9_$]+)\s*:\s*\(/);
    const match = fnMatch || rawFnMatch || (rawFnArrowMatch && line.includes('=>') ? rawFnArrowMatch : null);

    if (match) {
      const name = match[1];
      result.push({
        path: [...stack, name],
        description: normalizeComment(currentComment)
      });
      currentComment = '';
      continue;
    }
  }

  return result;
}

function generateMarkdown(entries) {
  // Build a JSDoc-like HTML page with sidebar and detailed method sections
  const methodsHtml = entries
    .map((entry, idx) => {
      const name = escapeHtml(entry.path.join('.'));
      const raw = entry.description || '';

      const paramRe = /@param\s+(?:\{([^}]+)\}\s+)?([A-Za-z0-9_.$]+)\s*-?\s*(.*)/g;
      const returnsRe = /@returns?\s+(?:\{([^}]+)\})?\s*-?\s*(.*)/g;
      const throwsRe = /@(throws|error)\s+(?:\{([^}]+)\})?\s*-?\s*(.*)/g;

      const params = [];
      const returns = [];
      const throwsArr = [];
      let m;
      while ((m = paramRe.exec(raw))) params.push({ type: m[1] || '', name: m[2], desc: (m[3] || '').trim() });
      while ((m = returnsRe.exec(raw))) returns.push({ type: m[1] || '', desc: (m[2] || '').trim() });
      while ((m = throwsRe.exec(raw))) throwsArr.push({ type: m[2] || '', desc: (m[3] || '').trim() });

      const descriptionHtml = escapeHtml(raw.replace(/@param[\s\S]*$/m, '').trim()).replace(/\n/g, '<br>') || '';

      const paramsHtml = params.length
        ? `<table class="params"><thead><tr><th>Parameter</th><th>Type</th><th>Description</th></tr></thead><tbody>${params
            .map(p => `<tr><td><code>${escapeHtml(p.name)}</code></td><td>${escapeHtml(p.type)}</td><td>${escapeHtml(p.desc)}</td></tr>`)
            .join('')}</tbody></table>`
        : '';

      const returnsHtml = returns.length
        ? `<p><strong>Returns</strong>: ${returns.map(r => `${r.type ? `<em>${escapeHtml(r.type)}</em> — ` : ''}${escapeHtml(r.desc)}`).join('<br>')}</p>`
        : '';

      const throwsHtml = throwsArr.length
        ? `<p><strong>Errors</strong>:<ul>${throwsArr.map(t => `<li>${t.type ? `<em>${escapeHtml(t.type)}</em> — ` : ''}${escapeHtml(t.desc)}</li>`).join('')}</ul></p>`
        : '';

      return `
        <section id="m${idx}" class="method">
          <h2 class="method-name"><code>${name}</code></h2>
          <div class="method-desc">${descriptionHtml || '<em>No description available.</em>'}</div>
          ${paramsHtml}
          ${returnsHtml}
          ${throwsHtml}
        </section>`;
    })
    .join('\n');

  const toc = entries
    .map((e, i) => `<li><a href="#m${i}">${escapeHtml(e.path.join('.'))}</a></li>`)
    .join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>window.lumen API Reference</title>
  <style>
    :root{--bg:#ffffff;--muted:#666;--accent:#0366d6}
    body{font-family: Inter, Roboto, Arial, sans-serif; margin:0; background: #f6f8fa; color:#111}
    .wrap{display:flex; max-width:1100px; margin:24px auto; gap:24px}
    nav{width:260px; background:#fff; border:1px solid #e1e4e8; padding:16px; border-radius:8px}
    nav h3{margin:0 0 8px 0}
    nav ul{list-style:none; padding:0; margin:0}
    nav li{margin:6px 0}
    nav a{color:var(--accent); text-decoration:none}
    main{flex:1; background:#fff; border:1px solid #e1e4e8; padding:20px; border-radius:8px}
    h1{margin-top:0}
    .method{border-bottom:1px dashed #e6eef8; padding:18px 0}
    .method-name{margin:0 0 8px 0}
    .method-desc{color:var(--muted); margin-bottom:12px}
    table.params{width:100%; border-collapse:collapse; margin-bottom:12px}
    table.params th, table.params td{border:1px solid #eee; padding:8px; text-align:left}
    code{background:#f1f8ff; padding:2px 6px; border-radius:4px}
  </style>
</head>
<body>
  <div class="wrap">
    <nav>
      <h3>window.lumen</h3>
      <p style="color:var(--muted); margin:0 0 12px 0">Auto-generated API reference</p>
      <ul>
        ${toc}
      </ul>
    </nav>
    <main>
      <h1>window.lumen API Reference</h1>
      <p style="color:var(--muted); margin-top:0">Generated from JSDoc-style comments in <code>electron/webview-preload.cjs</code>.</p>
      ${methodsHtml}
    </main>
  </div>
</body>
</html>`;
}

function main() {
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source file not found: ${sourcePath}`);
    process.exit(1);
  }

  const source = fs.readFileSync(sourcePath, 'utf8');
  const lumenBody = parseObjectKeys(source, 'lumen');
  if (!lumenBody) {
    console.error('Could not parse lumen object from source.');
    process.exit(1);
  }

  const entries = parseEntries(lumenBody);
  if (!entries.length) {
    console.error('No lumen entries found.');
    process.exit(1);
  }

  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const markdown = generateMarkdown(entries);
  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.log(`Generated ${outputPath} with ${entries.length} entries.`);
}

main();
