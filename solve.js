// Fast, dependency-free drop-in replacement for makefun-site 1.0.0
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const RESERVED = ['posts', 'tags', 'page'];
const FM_KEYS = new Set(['title', 'date', 'tags', 'draft', 'layout', 'slug', 'summary']);
const ESC_RE = /[&<>"']/;
const ESC_G = /[&<>"']/g;
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const NON_ASCII = /[^\x00-\x7F]/;
const MARK_RE = /\p{M}/gu;

const byCodeUnits = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function escapeHtml(s) {
  return ESC_RE.test(s) ? s.replace(ESC_G, (c) => ESC_MAP[c]) : s;
}

function slugify(text) {
  const plain = NON_ASCII.test(text) ? text.normalize('NFKD').replace(MARK_RE, '') : text;
  let out = '';
  let gap = false;
  for (let i = 0; i < plain.length; i++) {
    const code = plain.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      if (gap) { out += '-'; gap = false; }
      out += String.fromCharCode(code + 32);
    } else if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57)) {
      if (gap) { out += '-'; gap = false; }
      out += plain[i];
    } else {
      if (out.length > 0) gap = true;
    }
  }
  if (out.length > 64) out = out.slice(0, 64);
  let end = out.length;
  while (end > 0 && out.charCodeAt(end - 1) === 45) end--;
  return end === 0 ? 'untitled' : (end === out.length ? out : out.slice(0, end));
}

function uniqueSlug(slug, taken) {
  let out = slug;
  for (let n = 2; taken.has(out); n++) out = `${slug}-${n}`;
  taken.add(out);
  return out;
}

function longDate(date) {
  const y = date.slice(0, 4);
  const m = (date.charCodeAt(5) - 48) * 10 + (date.charCodeAt(6) - 48);
  const d = (date.charCodeAt(8) - 48) * 10 + (date.charCodeAt(9) - 48);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function daysIn(y, m) {
  if (m === 2) return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 29 : 28;
  return (m === 4 || m === 6 || m === 9 || m === 11) ? 30 : 31;
}

const FM_LINE = /^([a-z_]+):(?: (.*))?$/;
const FM_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FM_NAME = /^[a-z0-9-]+$/;
const FM_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FM_TAG = /^[^"[\]]+$/;

function stringOf(raw) {
  if (raw.charCodeAt(0) === 34) {
    if (raw.length < 2 || raw.charCodeAt(raw.length - 1) !== 34) return { error: 'a quoted string is not closed' };
    let out = '';
    for (let i = 1; i < raw.length - 1; i++) {
      const c = raw.charCodeAt(i);
      if (c === 92) {
        const n = raw.charCodeAt(i + 1);
        if ((n !== 34 && n !== 92) || i + 1 === raw.length - 1) return { error: 'a quoted string holds an escape other than \\" or \\\\' };
        out += raw[++i];
      } else if (c === 34) return { error: 'a quoted string holds a stray quote' };
      else out += raw[i];
    }
    return { value: out };
  }
  if (raw.charCodeAt(0) === 91) return { error: 'a bare string opens on [' };
  return { value: raw };
}

function valueOf(key, raw) {
  switch (key) {
    case 'title':
    case 'summary': {
      const s = stringOf(raw);
      return 'error' in s ? { error: `key "${key}": ${s.error}` } : s;
    }
    case 'date': {
      const m = FM_DATE.exec(raw);
      if (!m) return { error: 'key "date": not a date from 1970-01-01 to 2099-12-31 (YYYY-MM-DD)' };
      const y = +m[1], mo = +m[2], d = +m[3];
      if (y < 1970 || y > 2099 || mo < 1 || mo > 12 || d < 1 || d > daysIn(y, mo))
        return { error: 'key "date": not a date from 1970-01-01 to 2099-12-31 (YYYY-MM-DD)' };
      return { value: raw };
    }
    case 'tags': {
      if (raw.charCodeAt(0) !== 91 || raw.charCodeAt(raw.length - 1) !== 93)
        return { error: 'key "tags": not a list [a, b]' };
      const inner = raw.slice(1, -1);
      if (inner.trim() === '') return { value: [] };
      const tags = inner.split(',').map((t) => t.trim());
      for (let i = 0; i < tags.length; i++) {
        if (tags[i] === '' || !FM_TAG.test(tags[i]))
          return { error: 'key "tags": an empty tag, or one holding " [ or ]' };
      }
      return { value: tags };
    }
    case 'draft':
      return raw === 'true' ? { value: true } : raw === 'false' ? { value: false } : { error: 'key "draft": true or false' };
    case 'layout':
      return FM_NAME.test(raw) ? { value: raw } : { error: 'key "layout": not a template name' };
    case 'slug':
      return FM_SLUG.test(raw) && raw.length <= 64 ? { value: raw } : { error: 'key "slug": not a slug' };
    default:
      return { error: `unknown key "${key}"` };
  }
}

function parseFrontMatter(text) {
  const nl0 = text.indexOf('\n');
  const first = nl0 === -1 ? text : text.slice(0, nl0);
  if (first !== '---') return { error: 'no front matter' };
  let pos = nl0 === -1 ? text.length : nl0 + 1;
  const lines = [];
  let closed = false;
  let bodyStart = text.length;
  while (pos <= text.length) {
    const nl = text.indexOf('\n', pos);
    const line = nl === -1 ? text.slice(pos) : text.slice(pos, nl);
    if (line === '---') {
      closed = true;
      bodyStart = nl === -1 ? text.length : nl + 1;
      break;
    }
    lines.push(line);
    if (nl === -1) break;
    pos = nl + 1;
  }
  if (!closed) return { error: 'the front matter is not closed' };
  const data = Object.create(null);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0 || line.charCodeAt(0) === 35) continue;
    let onlyWs = true;
    for (let j = 0; j < line.length; j++) {
      const c = line.charCodeAt(j);
      if (c !== 32 && c !== 9) { onlyWs = false; break; }
    }
    if (onlyWs) continue;
    const m = FM_LINE.exec(line);
    if (!m) return { error: `line ${i + 2} is not "key: value"` };
    const key = m[1];
    let raw = m[2] ?? '';
    let end = raw.length;
    while (end > 0 && (raw.charCodeAt(end - 1) === 32 || raw.charCodeAt(end - 1) === 9)) end--;
    if (end !== raw.length) raw = raw.slice(0, end);
    if (!FM_KEYS.has(key)) return { error: `unknown key "${key}"` };
    if (key in data) return { error: `key "${key}" is given twice` };
    if (raw === '') return { error: `key "${key}" has no value` };
    const v = valueOf(key, raw);
    if ('error' in v) return v;
    data[key] = v.value;
  }
  if (!('title' in data)) return { error: 'no title' };
  return { data, body: text.slice(bodyStart) };
}

// Fast lookup table for Markdown inline triggers & escapable chars
const IS_ESCAPABLE = new Uint8Array(128);
for (const ch of '\\`*_[]()#+-.!>') IS_ESCAPABLE[ch.charCodeAt(0)] = 1;
const IS_INLINE_SPEC = new Uint8Array(128);
for (const ch of '\\`*[&<>"\'') IS_INLINE_SPEC[ch.charCodeAt(0)] = 1;

function findUnescaped2(s, a, b, from) {
  const lim = s.length - 1;
  for (let j = from; j < lim; j++) {
    const c = s.charCodeAt(j);
    if (c === 92 && j + 1 < s.length) {
      const nc = s.charCodeAt(j + 1);
      if (nc < 128 && IS_ESCAPABLE[nc]) { j++; continue; }
    }
    if (c === a && s.charCodeAt(j + 1) === b) return j;
  }
  return -1;
}

function findUnescaped1(s, target, from) {
  for (let j = from; j < s.length; j++) {
    const c = s.charCodeAt(j);
    if (c === 92 && j + 1 < s.length) {
      const nc = s.charCodeAt(j + 1);
      if (nc < 128 && IS_ESCAPABLE[nc]) { j++; continue; }
    }
    if (c === target) return j;
  }
  return -1;
}

function findSingleStar(s, from) {
  for (let j = from; j < s.length; j++) {
    const c = s.charCodeAt(j);
    if (c === 92 && j + 1 < s.length) {
      const nc = s.charCodeAt(j + 1);
      if (nc < 128 && IS_ESCAPABLE[nc]) { j++; continue; }
    }
    if (c !== 42) continue;
    if (s.charCodeAt(j + 1) === 42) { j++; continue; }
    return j;
  }
  return -1;
}

const WS_RE = /\s/;
function inline(s, linkFn) {
  let out = '';
  let i = 0;
  let plainStart = 0;
  const n = s.length;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c >= 128 || !IS_INLINE_SPEC[c]) { i++; continue; }
    if (i > plainStart) out += s.slice(plainStart, i);
    if (c === 38) { out += '&amp;'; i++; plainStart = i; continue; }
    if (c === 60) { out += '&lt;'; i++; plainStart = i; continue; }
    if (c === 62) { out += '&gt;'; i++; plainStart = i; continue; }
    if (c === 34) { out += '&quot;'; i++; plainStart = i; continue; }
    if (c === 39) { out += '&#39;'; i++; plainStart = i; continue; }
    if (c === 92) {
      if (i + 1 < n) {
        const nc = s.charCodeAt(i + 1);
        if (nc < 128 && IS_ESCAPABLE[nc]) {
          out += nc === 62 ? '&gt;' : s[i + 1];
          i += 2; plainStart = i; continue;
        }
      }
      out += '\\'; i++; plainStart = i; continue;
    }
    if (c === 96) {
      const j = s.indexOf('`', i + 1);
      if (j > i + 1) {
        out += '<code>' + escapeHtml(s.slice(i + 1, j)) + '</code>';
        i = j + 1;
      } else {
        out += '`'; i++;
      }
      plainStart = i; continue;
    }
    if (c === 42) {
      if (s.charCodeAt(i + 1) === 42) {
        const j = findUnescaped2(s, 42, 42, i + 2);
        if (j > i + 2) {
          out += '<strong>' + inline(s.slice(i + 2, j), linkFn) + '</strong>';
          i = j + 2;
        } else {
          out += '**'; i += 2;
        }
      } else {
        const j = findSingleStar(s, i + 1);
        if (j > i + 1) {
          out += '<em>' + inline(s.slice(i + 1, j), linkFn) + '</em>';
          i = j + 1;
        } else {
          out += '*'; i++;
        }
      }
      plainStart = i; continue;
    }
    if (c === 91) {
      const k = findUnescaped1(s, 93, i + 1);
      const m = k !== -1 && s.charCodeAt(k + 1) === 40 ? s.indexOf(')', k + 2) : -1;
      const target = m === -1 ? '' : s.slice(k + 2, m);
      if (target !== '' && !WS_RE.test(target)) {
        out += '<a href="' + escapeHtml(linkFn(target)) + '">' + inline(s.slice(i + 1, k), linkFn) + '</a>';
        i = m + 1;
      } else {
        out += '['; i++;
      }
      plainStart = i; continue;
    }
  }
  if (plainStart === 0) return s;
  return plainStart < n ? out + s.slice(plainStart) : out;
}

const FENCE_OPEN = /^```([A-Za-z0-9_+-]*)[ \t]*$/;
const FENCE_CLOSE = /^```[ \t]*$/;
const HEADING = /^(#{1,6})[ \t]+(.*?)[ \t]*$/;
const HR = /^(?:---|\*\*\*)[ \t]*$/;
const ORDERED = /^(\d{1,9})\. (.*)$/;
const CONTINUED = /^ {2,}\S/;

function isBlankLine(line) {
  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (c !== 32 && c !== 9) return false;
  }
  return true;
}

function trimLine(line) {
  let s = 0, e = line.length;
  while (s < e && (line.charCodeAt(s) === 32 || line.charCodeAt(s) === 9)) s++;
  while (e > s && (line.charCodeAt(e - 1) === 32 || line.charCodeAt(e - 1) === 9)) e--;
  return (s === 0 && e === line.length) ? line : line.slice(s, e);
}

function headingOf(line) {
  if (line.charCodeAt(0) !== 35) return null;
  const m = HEADING.exec(line);
  return m === null || m[2] === '' ? null : { depth: m[1].length, text: m[2] };
}

function endsParagraph(line) {
  if (isBlankLine(line)) return true;
  const c0 = line.charCodeAt(0);
  if (c0 === 96) return FENCE_OPEN.test(line);
  if (c0 === 35) return headingOf(line) !== null;
  if (c0 === 45 || c0 === 42) return HR.test(line);
  return false;
}

function renderMarkdown(src, linkFn) {
  const lines = src.split('\n');
  const n = lines.length;
  const ids = new Set();
  const toc = [];
  let html = '';
  let excerpt = null;
  let i = 0;

  while (i < n) {
    const line = lines[i];
    if (isBlankLine(line)) { i++; continue; }
    const c0 = line.charCodeAt(0);
    if (c0 === 96) {
      const f = FENCE_OPEN.exec(line);
      if (f !== null) {
        const lang = f[1];
        const cls = lang === '' ? '' : ` class="language-${escapeHtml(lang)}"`;
        let code = '';
        i++;
        while (i < n && !(lines[i].charCodeAt(0) === 96 && FENCE_CLOSE.test(lines[i]))) {
          code += escapeHtml(lines[i++]) + '\n';
        }
        i++;
        html += `<pre><code${cls}>${code}</code></pre>\n`;
        continue;
      }
    }
    if (c0 === 35) {
      const h = headingOf(line);
      if (h !== null) {
        const id = uniqueSlug(slugify(h.text), ids);
        const hHtml = inline(h.text, linkFn);
        html += `<h${h.depth} id="${id}">${hHtml}</h${h.depth}>\n`;
        if (h.depth === 2 || h.depth === 3) toc.push({ level: h.depth, id, html: hHtml });
        i++;
        continue;
      }
    }
    if ((c0 === 45 || c0 === 42) && HR.test(line)) {
      html += '<hr>\n';
      i++;
      continue;
    }
    if (c0 === 62) {
      const qLines = [];
      while (i < n && lines[i].charCodeAt(0) === 62) {
        const l = lines[i++];
        const stripped = l.charCodeAt(1) === 32 ? l.slice(2) : l.slice(1);
        const tr = trimLine(stripped);
        if (tr !== '') qLines.push(tr);
      }
      html += qLines.length === 0
        ? '<blockquote>\n</blockquote>\n'
        : `<blockquote>\n<p>${inline(qLines.join('\n'), linkFn)}</p>\n</blockquote>\n`;
      continue;
    }
    const isBullet = (c0 === 45 || c0 === 42) && line.charCodeAt(1) === 32;
    const ord = (!isBullet && c0 >= 48 && c0 <= 57) ? ORDERED.exec(line) : null;
    if (isBullet || ord !== null) {
      const isOrd = ord !== null;
      const start = isOrd ? Number(ord[1]) : 1;
      const items = [];
      while (i < n) {
        const l = lines[i];
        if (!isOrd) {
          const lc0 = l.charCodeAt(0);
          if ((lc0 === 45 || lc0 === 42) && l.charCodeAt(1) === 32) {
            items.push([trimLine(l.slice(2))]);
            i++; continue;
          }
        } else {
          const m = (l.charCodeAt(0) >= 48 && l.charCodeAt(0) <= 57) ? ORDERED.exec(l) : null;
          if (m !== null) { items.push([trimLine(m[2])]); i++; continue; }
        }
        if (l.charCodeAt(0) === 32 && l.charCodeAt(1) === 32 && CONTINUED.test(l)) {
          items[items.length - 1].push(trimLine(l));
          i++;
        } else break;
      }
      const tag = isOrd ? 'ol' : 'ul';
      const open = isOrd && start !== 1 ? `<ol start="${start}">` : `<${tag}>`;
      let out = open + '\n';
      for (let k = 0; k < items.length; k++) out += `<li>${inline(items[k].join('\n'), linkFn)}</li>\n`;
      html += out + `</${tag}>\n`;
      continue;
    }
    let pText = trimLine(line);
    i++;
    while (i < n && !endsParagraph(lines[i])) pText += '\n' + trimLine(lines[i++]);
    const pHtml = inline(pText, linkFn);
    if (excerpt === null) excerpt = pHtml;
    html += `<p>${pHtml}</p>\n`;
  }
  return { html, toc, excerpt: excerpt ?? '' };
}

// Template parser + fast AST renderer with static-partial caching
const INCLUDE_DEPTH = 8;
const T_PATH = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const T_FOR = /^for ([A-Za-z_][A-Za-z0-9_]*) in (\S+)$/;
const T_IF = /^if (not )?(\S+)$/;
const T_INC = /^include "([a-z0-9-]+)"$/;

class TemplateError extends Error {}

function pathOf(name, text) {
  if (!T_PATH.test(text)) throw new TemplateError(`template "${name}": ${JSON.stringify(text)} is not a path`);
  return text.split('.');
}

function tokenize(name, src) {
  const tokens = [];
  let text = '';
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open === -1 || open === src.length - 1) { text += src.slice(i); break; }
    const next = src.charCodeAt(open + 1);
    if (next !== 123 && next !== 37) { text += src.slice(i, open + 1); i = open + 1; continue; }
    text += src.slice(i, open);
    if (next === 123) {
      const raw = src.charCodeAt(open + 2) === 123;
      const close = src.indexOf(raw ? '}}}' : '}}', open + (raw ? 3 : 2));
      if (close === -1) throw new TemplateError(`template "${name}": a ${raw ? '{{{' : '{{'} is not closed`);
      if (text !== '') tokens.push({ t: 0, text });
      text = '';
      tokens.push({ t: raw ? 2 : 1, path: pathOf(name, src.slice(open + (raw ? 3 : 2), close).trim()) });
      i = close + (raw ? 3 : 2);
      continue;
    }
    const close = src.indexOf('%}', open + 2);
    if (close === -1) throw new TemplateError(`template "${name}": a {% is not closed`);
    const end = close + 2;
    const lineStart = src.lastIndexOf('\n', open - 1) + 1;
    const nl = src.indexOf('\n', end);
    const lineEnd = nl === -1 ? src.length : nl;
    let standalone = true;
    for (let k = lineStart; k < open; k++) { const c = src.charCodeAt(k); if (c !== 32 && c !== 9) { standalone = false; break; } }
    if (standalone) {
      for (let k = end; k < lineEnd; k++) { const c = src.charCodeAt(k); if (c !== 32 && c !== 9) { standalone = false; break; } }
    }
    if (standalone) text = text.slice(0, text.length - (open - lineStart));
    if (text !== '') tokens.push({ t: 0, text });
    text = '';
    tokens.push({ t: 3, tag: src.slice(open + 2, close).trim() });
    i = standalone ? (nl === -1 ? src.length : nl + 1) : end;
  }
  if (text !== '') tokens.push({ t: 0, text });
  return tokens;
}

function parseTemplate(name, src) {
  const root = { kind: 'root', body: [] };
  const stack = [root];
  let body = root.body;
  for (const tok of tokenize(name, src)) {
    if (tok.t === 0) body.push({ kind: 0, text: tok.text });
    else if (tok.t === 1 || tok.t === 2) body.push({ kind: tok.t, path: tok.path });
    else {
      const tag = tok.tag;
      const top = stack[stack.length - 1];
      let m;
      if ((m = T_FOR.exec(tag)) !== null) {
        const node = { kind: 4, name: m[1], path: pathOf(name, m[2]), body: [] };
        body.push(node); stack.push(node); body = node.body;
      } else if ((m = T_IF.exec(tag)) !== null) {
        const node = { kind: 3, not: m[1] !== undefined, path: pathOf(name, m[2]), then: [], else: null };
        body.push(node); stack.push(node); body = node.then;
      } else if (tag === 'else') {
        if (top.kind !== 3 || top.else !== null) throw new TemplateError(`template "${name}": an else outside an if`);
        top.else = []; body = top.else;
      } else if (tag === 'endfor' || tag === 'endif') {
        const want = tag === 'endfor' ? 4 : 3;
        if (top.kind !== want) throw new TemplateError(`template "${name}": an ${tag} with no open ${tag.slice(3)}`);
        stack.pop();
        const p = stack[stack.length - 1];
        body = p.kind === 'root' ? p.body : p.kind === 4 ? p.body : (p.else ?? p.then);
      } else if ((m = T_INC.exec(tag)) !== null) {
        body.push({ kind: 5, name: m[1] });
      } else {
        throw new TemplateError(`template "${name}": {% ${tag} %} is not a tag`);
      }
    }
  }
  if (stack.length > 1) {
    const kname = stack[stack.length - 1].kind === 4 ? 'for' : 'if';
    throw new TemplateError(`template "${name}": a ${kname} is not closed`);
  }
  return root.body;
}

function lookup(scope, path) {
  let s = scope;
  const k0 = path[0];
  while (s !== null && !Object.hasOwn(s.vars, k0)) s = s.parent;
  if (s === null) return undefined;
  let v = s.vars[k0];
  for (let k = 1; k < path.length; k++) {
    if (v === null || typeof v !== 'object' || !Object.hasOwn(v, path[k])) return undefined;
    v = v[path[k]];
  }
  return v;
}

function textOf(v) {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return v.map(textOf).join(', ');
  return '';
}

function truthy(v) {
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && v !== false && v !== '' && v !== 0;
}

function renderNodes(nodes, scope, templates, depth) {
  let out = '';
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    switch (n.kind) {
      case 0: out += n.text; break;
      case 1: out += escapeHtml(textOf(lookup(scope, n.path))); break;
      case 2: out += textOf(lookup(scope, n.path)); break;
      case 3: {
        const v = truthy(lookup(scope, n.path));
        const br = (v !== n.not) ? n.then : n.else;
        if (br !== null) out += renderNodes(br, scope, templates, depth);
        break;
      }
      case 4: {
        const xs = lookup(scope, n.path);
        if (!Array.isArray(xs)) break;
        const len = xs.length;
        for (let k = 0; k < len; k++) {
          const vars = { [n.name]: xs[k], loop: { index: k + 1, first: k === 0, last: k === len - 1, length: len } };
          out += renderNodes(n.body, { vars, parent: scope }, templates, depth);
        }
        break;
      }
      case 5: {
        const t = templates.get(n.name);
        if (t !== undefined && depth < INCLUDE_DEPTH) out += renderNodes(t, scope, templates, depth + 1);
        break;
      }
    }
  }
  return out;
}

function wordsOf(text) {
  const m = text.match(/\S+/g);
  return m === null ? 0 : m.length;
}

function resolvePath(dir, rel) {
  const parts = dir === '' ? [] : dir.split('/');
  const segs = rel.split('/');
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { if (parts.length === 0) return null; parts.pop(); }
    else parts.push(seg);
  }
  return parts.join('/');
}

const dirOf = (path) => { const idx = path.lastIndexOf('/'); return idx === -1 ? '' : path.slice(0, idx); };
const SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;

export function run(input) {
  const templates = new Map();
  const report = [];
  const tplNames = Object.keys(input.templates).sort(byCodeUnits);
  for (let i = 0; i < tplNames.length; i++) {
    const name = tplNames[i];
    try { templates.set(name, parseTemplate(name, input.templates[name])); }
    catch (err) { if (!(err instanceof TemplateError)) throw err; report.push(err.message); }
  }

  let base = input.site.base_url;
  while (base.length > 0 && base.charCodeAt(base.length - 1) === 47) base = base.slice(0, -1);

  const files = [...input.files].sort((x, y) => byCodeUnits(x.path, y.path));
  const sources = [];
  const statics = [];
  const staticPaths = new Set();

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.path.endsWith('.md')) {
      const text = f.content.indexOf('\r') === -1 ? f.content : f.content.replace(/\r\n?/g, '\n');
      const fm = parseFrontMatter(text);
      if ('error' in fm) { report.push(`refused ${f.path}: ${fm.error}`); continue; }
      const post = f.path.startsWith('posts/');
      if (f.path.startsWith('tags/')) { report.push(`refused ${f.path}: tags/ is the generator's own`); continue; }
      if (f.path.startsWith('page/')) { report.push(`refused ${f.path}: page/ is the generator's own`); continue; }
      if (post && !('date' in fm.data)) { report.push(`refused ${f.path}: a post needs a date`); continue; }
      const layout = fm.data.layout ?? (post ? 'post' : 'page');
      if (!templates.has(layout)) { report.push(`refused ${f.path}: layout "${layout}" is no template that parses`); continue; }
      if (fm.data.draft === true) { report.push(`draft ${f.path}`); continue; }
      sources.push({ path: f.path, data: fm.data, body: fm.body, post, layout, slug: '', outDir: '', url: '', html: '', toc: null, excerpt: '', newer: null, older: null, tagRefs: null });
    } else {
      statics.push(f);
      staticPaths.add(f.path);
    }
  }

  const taken = new Map();
  const bySource = new Map();
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const dir = s.post ? 'posts' : dirOf(s.path);
    let set = taken.get(dir);
    if (set === undefined) { set = new Set(dir === '' ? RESERVED : []); taken.set(dir, set); }
    const slug = uniqueSlug(s.data.slug ?? slugify(s.data.title), set);
    s.slug = slug;
    s.outDir = dir === '' ? slug : `${dir}/${slug}`;
    s.url = `${base}/${s.outDir}/`;
    bySource.set(s.path, s);
  }

  const broken = new Set();
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const dir = dirOf(s.path);
    const linkFn = (target) => {
      if (target.charCodeAt(0) === 47 || target.charCodeAt(0) === 35 || SCHEME_RE.test(target)) return target;
      const hash = target.indexOf('#');
      const rel = hash === -1 ? target : target.slice(0, hash);
      const frag = hash === -1 ? '' : target.slice(hash);
      const p = rel === '' ? null : resolvePath(dir, rel);
      if (p !== null) {
        const targetSrc = bySource.get(p);
        if (targetSrc !== undefined) return `${targetSrc.url}${frag}`;
        if (staticPaths.has(p)) return `${base}/${p}${frag}`;
      }
      broken.add(`broken-link ${s.path} -> ${target}`);
      return target;
    };
    const md = renderMarkdown(s.body, linkFn);
    s.html = md.html;
    s.toc = md.toc;
    s.excerpt = md.excerpt;
  }

  const posts = sources.filter((s) => s.post);
  posts.sort((x, y) => byCodeUnits(y.data.date, x.data.date) || byCodeUnits(x.slug, y.slug));
  for (let k = 0; k < posts.length; k++) {
    posts[k].newer = k === 0 ? null : posts[k - 1];
    posts[k].older = k === posts.length - 1 ? null : posts[k + 1];
  }

  const slugCache = new Map();
  const getSlug = (name) => { let v = slugCache.get(name); if (v === undefined) { v = slugify(name); slugCache.set(name, v); } return v; };

  const bySlug = new Map();
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const rawTags = p.data.tags;
    p.tagRefs = [];
    if (rawTags) {
      const seen = new Set();
      for (let j = 0; j < rawTags.length; j++) {
        const name = rawTags[j];
        const sl = getSlug(name);
        if (seen.has(sl)) continue;
        seen.add(sl);
        let tag = bySlug.get(sl);
        if (tag === undefined) { tag = { name, slug: sl, url: `${base}/tags/${sl}/`, posts: [] }; bySlug.set(sl, tag); }
        tag.posts.push(p);
        p.tagRefs.push(tag);
      }
    }
  }
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    if (s.post) continue;
    const rawTags = s.data.tags;
    s.tagRefs = [];
    if (rawTags) {
      const seen = new Set();
      for (let j = 0; j < rawTags.length; j++) {
        const name = rawTags[j];
        const sl = getSlug(name);
        if (seen.has(sl)) continue;
        seen.add(sl);
        s.tagRefs.push(bySlug.get(sl) ?? { name, slug: sl, url: '', posts: [] });
      }
    }
  }
  const tags = [...bySlug.values()].sort((x, y) => y.posts.length - x.posts.length || byCodeUnits(x.slug, y.slug));

  const linkOf = (s) => (s === null ? null : { title: s.data.title, url: s.url, date: s.data.date ?? '', date_long: s.data.date === undefined ? '' : longDate(s.data.date) });
  const cardOf = (s) => ({
    title: s.data.title,
    url: s.url,
    date: s.data.date ?? '',
    date_long: s.data.date === undefined ? '' : longDate(s.data.date),
    summary: s.data.summary ?? '',
    excerpt: s.excerpt,
    reading_minutes: Math.max(1, Math.ceil(wordsOf(s.body) / 200)),
    tags: s.tagRefs.map((t) => ({ name: t.name, slug: t.slug, url: t.url })),
  });
  const cards = new Map();
  for (let i = 0; i < posts.length; i++) cards.set(posts[i], cardOf(posts[i]));

  const site = { title: input.site.title, base_url: base };
  const allTags = tags.map((t) => ({ name: t.name, slug: t.slug, url: t.url, count: t.posts.length }));
  const recent = posts.slice(0, input.site.recent).map((p) => cards.get(p));
  const output = {};

  const render = (name, extraVars) => {
    const nodes = templates.get(name);
    if (nodes === undefined) return null;
    const vars = { site, tags: allTags, recent, ...extraVars };
    return renderNodes(nodes, { vars, parent: null }, templates, 0);
  };

  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const c = s.post ? cards.get(s) : cardOf(s);
    const page = { ...c, slug: s.slug, content: s.html, toc: s.toc, newer: linkOf(s.newer), older: linkOf(s.older), is_post: s.post };
    output[`${s.outDir}/index.html`] = render(s.layout, { page });
  }
  const per = input.site.per_page;
  const pageCount = Math.max(1, Math.ceil(posts.length / per));
  const indexUrl = (k) => (k === 1 ? `${base}/` : `${base}/page/${k}/`);
  if (templates.has('index')) {
    for (let k = 1; k <= pageCount; k++) {
      output[k === 1 ? 'index.html' : `page/${k}/index.html`] = render('index', {
        posts: posts.slice((k - 1) * per, k * per).map((p) => cards.get(p)),
        pager: { number: k, total: pageCount, url: indexUrl(k), newer_url: k === 1 ? '' : indexUrl(k - 1), older_url: k === pageCount ? '' : indexUrl(k + 1) },
      });
    }
  }
  if (templates.has('tag')) {
    for (let i = 0; i < tags.length; i++) {
      const t = tags[i];
      output[`tags/${t.slug}/index.html`] = render('tag', {
        tag: { name: t.name, slug: t.slug, url: t.url, count: t.posts.length, posts: t.posts.map((p) => cards.get(p)) },
      });
    }
  }
  if (templates.has('tags')) output['tags/index.html'] = render('tags', {});
  for (let i = 0; i < statics.length; i++) {
    const f = statics[i];
    if (Object.hasOwn(output, f.path)) report.push(`shadowed ${f.path}: a built page has its path`);
    else output[f.path] = f.content;
  }

  const lines = [...report, ...broken].sort(byCodeUnits);
  const numPages = sources.length - posts.length;
  lines.push(`built ${numPages} pages, ${posts.length} posts, ${tags.length} tags and ${statics.length} static files`);
  output['build-report.txt'] = lines.join('\n') + '\n';
  return output;
}
