const v8 = require('node:v8');
for (const f of [
  '--no-wasm-tier-up',
  '--no-wasm-lazy-compilation',
  '--no-incremental-marking',
  '--no-concurrent-marking',
  '--no-concurrent-sweeping',
  '--no-concurrent-recompilation',
  '--no-concurrent-sparkplug',
  '--no-parallel-scavenge',
  '--no-parallel-compaction',
  '--no-parallel-pointer-update',
]) v8.setFlagsFromString(f);

const fs = require('node:fs');
const inDir = process.env.MAKEFUN_INPUT_DIR || '/input';
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const inPath = inDir + '/cases.json';
const outPath = outDir + '/answers.json';

function fallback() {
  import('./solve.js').then((m) => {
    const cases = JSON.parse(fs.readFileSync(inPath, 'utf8'));
    const out = new Array(cases.length);
    for (let i = 0; i < cases.length; i++) out[i] = m.run(cases[i].input);
    fs.writeFileSync(outPath, JSON.stringify(out));
  });
}

const inFd = fs.openSync(inPath, 'r');
const inSize = fs.fstatSync(inFd).size;
let outFd;
try {
  outFd = fs.openSync(outPath, 'w');
} catch {
  fs.mkdirSync(outDir, { recursive: true });
  outFd = fs.openSync(outPath, 'w');
}

const BASE = 131072;
const OUT_CAP = 524288;
const ARENA_CAP = Math.max(24 * 1024 * 1024, Math.min(64 * 1024 * 1024, inSize * 8));
const inOff = BASE;
const outOff = inOff + ((inSize + 128 + 15) & ~15);
const arenaOff = outOff + OUT_CAP + 256;
const pages = (((arenaOff + ARENA_CAP) + 65535) >>> 16) + 1;

const mem = new WebAssembly.Memory({ initial: pages });
const u8 = new Uint8Array(mem.buffer);
let got = 0;
while (got < inSize) {
  const n = fs.readSync(inFd, u8, inOff + got, inSize - got, null);
  if (n <= 0) break;
  got += n;
}
fs.closeSync(inFd);

const MARK_RE = /\p{M}/gu;
function slugUniJs(text) {
  const plain = text.normalize('NFKD').replace(MARK_RE, '');
  let out = '', gap = false;
  for (let i = 0; i < plain.length; i++) {
    const code = plain.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      if (gap) { out += '-'; gap = false; }
      out += String.fromCharCode(code + 32);
    } else if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57)) {
      if (gap) { out += '-'; gap = false; }
      out += plain[i];
    } else if (out.length > 0) {
      gap = true;
    }
  }
  if (out.length > 64) out = out.slice(0, 64);
  let end = out.length;
  while (end > 0 && out.charCodeAt(end - 1) === 45) end--;
  return end === 0 ? 'untitled' : (end === out.length ? out : out.slice(0, end));
}

const mod = new WebAssembly.Module(fs.readFileSync(__dirname + '/sg.wasm'));
const inst = new WebAssembly.Instance(mod, {
  env: {
    memory: mem,
    flush(ptr, len) {
      let off = 0;
      while (off < len) {
        const n = fs.writeSync(outFd, u8, ptr + off, len - off);
        if (n <= 0) break;
        off += n;
      }
    },
    slug_uni(inPtr, inLen, outPtr) {
      const s = Buffer.from(mem.buffer, inPtr, inLen).toString('utf8');
      const sl = slugUniJs(s);
      for (let i = 0; i < sl.length; i++) u8[outPtr + i] = sl.charCodeAt(i);
      return sl.length;
    },
  },
});

const rc = inst.exports.run_all(inOff, inSize, outOff, OUT_CAP, arenaOff, ARENA_CAP);
fs.closeSync(outFd);
if (rc !== 0) fallback();
