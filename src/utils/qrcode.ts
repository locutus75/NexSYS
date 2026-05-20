/**
 * qrcode.ts — Pure TypeScript QR code generator.
 * No dependencies. Produces a boolean[][] matrix for SVG rendering.
 * Byte mode, error correction level M, auto-selects version 1-10.
 */

// ── Galois Field GF(256) ─────────────────────────────────────────────────────

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
    x &= 0xff;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

const gfMul = (a: number, b: number) =>
  a === 0 || b === 0 ? 0 : GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];

// ── Reed-Solomon ─────────────────────────────────────────────────────────────

function rsGeneratorPoly(degree: number): Uint8Array {
  let g = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const alpha = GF_EXP[i];
    const ng = new Uint8Array(g.length + 1);
    for (let j = 0; j < g.length; j++) {
      ng[j] ^= g[j];
      ng[j + 1] ^= gfMul(g[j], alpha);
    }
    g = ng;
  }
  return g;
}

function rsEncode(data: Uint8Array, nEc: number): Uint8Array {
  const gen = rsGeneratorPoly(nEc);
  const msg = new Uint8Array(data.length + nEc);
  msg.set(data);
  for (let i = 0; i < data.length; i++) {
    const c = msg[i];
    if (c !== 0)
      for (let j = 1; j < gen.length; j++)
        msg[i + j] ^= gfMul(gen[j], c);
  }
  return msg.slice(data.length);
}

// ── Tables (EC level M) ──────────────────────────────────────────────────────
//                          v0  v1  v2  v3  v4  v5   v6   v7   v8   v9  v10
const CAP_M   = [ 0,  14,  26,  42,  62,  84, 106, 122, 154, 180, 213];
const TOT_CW  = [ 0,  26,  44,  70, 100, 134, 172, 196, 242, 292, 346];
const DAT_CW  = [ 0,  16,  28,  44,  64,  86, 108, 124, 154, 182, 216];
const EC_CPB  = [ 0,  10,  16,  26,  18,  24,  16,  18,  22,  22,  26];
const N_BLK   = [ 0,   1,   1,   1,   2,   2,   4,   4,   4,   5,   5];
const ALN_POS = [
  [], [], [6,18], [6,22], [6,26], [6,30], [6,34],
  [6,22,38], [6,24,42], [6,28,46], [6,32,50],
];

// ── Matrix helpers ───────────────────────────────────────────────────────────

type Matrix = Int8Array[];

const makeMatrix = (sz: number): Matrix =>
  Array.from({ length: sz }, () => new Int8Array(sz).fill(-1));

function setMod(m: Matrix, r: number, c: number, v: boolean) { m[r][c] = v ? 1 : 0; }

function finderPattern(m: Matrix, tr: number, tc: number) {
  for (let dr = -1; dr <= 7; dr++)
    for (let dc = -1; dc <= 7; dc++) {
      const r = tr + dr, c = tc + dc;
      if (r < 0 || c < 0 || r >= m.length || c >= m.length) continue;
      const inSq = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const border = dr === 0 || dr === 6 || dc === 0 || dc === 6;
      const inner  = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      setMod(m, r, c, inSq && (border || inner));
    }
}

function alignmentPattern(m: Matrix, r: number, c: number) {
  for (let dr = -2; dr <= 2; dr++)
    for (let dc = -2; dc <= 2; dc++) {
      const border = Math.abs(dr) === 2 || Math.abs(dc) === 2;
      setMod(m, r + dr, c + dc, border || (dr === 0 && dc === 0));
    }
}

function timingPatterns(m: Matrix) {
  const sz = m.length;
  for (let i = 8; i < sz - 8; i++) {
    if (m[6][i] === -1) setMod(m, 6, i, i % 2 === 0);
    if (m[i][6] === -1) setMod(m, i, 6, i % 2 === 0);
  }
}

function reserveFormat(m: Matrix) {
  const sz = m.length;
  for (let i = 0; i <= 8; i++) {
    if (m[8][i] === -1) m[8][i] = 0;
    if (m[i][8] === -1) m[i][8] = 0;
  }
  for (let i = sz - 8; i < sz; i++) if (m[8][i] === -1) m[8][i] = 0;
  for (let i = sz - 7; i < sz; i++) if (m[i][8] === -1) m[i][8] = 0;
}

function applyFormatInfo(m: Matrix, maskPat: number) {
  // EC level M = 0b00; XOR mask = 0x5412
  const data = (0b00 << 3) | maskPat;
  let d = data << 10;
  for (let i = 14; i >= 10; i--) if ((d >> i) & 1) d ^= 0x537 << (i - 10);
  const fb = ((data << 10) | (d & 0x3ff)) ^ 0x5412;

  const sz = m.length;
  // Copy 1 — column 8 (top) then row 8 (left)
  const c1pos = [0,1,2,3,4,5,7,8];   // row positions for column 8
  const r1pos = [7,5,4,3,2,1,0];     // col positions for row 8 (after skipping 6 & 8)
  for (let i = 0; i < 8; i++) setMod(m, c1pos[i], 8, !!((fb >> (14 - i)) & 1));
  for (let i = 0; i < 7; i++) setMod(m, 8, r1pos[i], !!((fb >> (6 - i)) & 1));

  // Copy 2 — row 8 (top-right) then column 8 (bottom-left)
  for (let i = 0; i < 8; i++) setMod(m, 8, sz - 1 - i, !!((fb >> (14 - i)) & 1));
  for (let i = 0; i < 7; i++) setMod(m, sz - 7 + i, 8, !!((fb >> i) & 1));

  // Dark module
  setMod(m, sz - 8, 8, true);
}

// ── Data encoding ────────────────────────────────────────────────────────────

function encodeData(text: string, dataCw: number): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  const bits: number[] = [0,1,0,0]; // byte mode indicator
  const len = bytes.length;
  for (let i = 7; i >= 0; i--) bits.push((len >> i) & 1);
  for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  for (let i = 0; i < 4 && bits.length < dataCw * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const PAD = [0xec, 0x11];
  for (let pi = 0; bits.length < dataCw * 8;) {
    const p = PAD[pi++ % 2];
    for (let i = 7; i >= 0; i--) bits.push((p >> i) & 1);
  }
  const out = new Uint8Array(dataCw);
  for (let i = 0; i < dataCw; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
    out[i] = b;
  }
  return out;
}

// ── Data placement (zigzag) ──────────────────────────────────────────────────

function placeData(m: Matrix, cws: Uint8Array) {
  const sz = m.length;
  let cwIdx = 0, bit = 7;
  let up = true;
  for (let col = sz - 1; col >= 0; col -= col === 7 ? 2 : 2) {
    if (col === 6) col--;
    const cols = [col, col - 1];
    for (let i = 0; i < sz; i++) {
      const r = up ? sz - 1 - i : i;
      for (const c of cols) {
        if (c < 0 || m[r][c] !== -1) continue;
        const v = cwIdx < cws.length ? !!((cws[cwIdx] >> bit) & 1) : false;
        setMod(m, r, c, v);
        if (--bit < 0) { cwIdx++; bit = 7; }
      }
    }
    up = !up;
  }
}

// ── Masking ──────────────────────────────────────────────────────────────────

const MASK_FNS: Array<(r: number, c: number) => boolean> = [
  (r, c) => (r + c) % 2 === 0,
  (r, _c) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
  (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
  (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
];

function applyMask(m: Matrix, pat: number): Matrix {
  const sz = m.length;
  const out: Matrix = m.map(r => new Int8Array(r));
  const fn = MASK_FNS[pat];
  for (let r = 0; r < sz; r++)
    for (let c = 0; c < sz; c++)
      if (out[r][c] !== -1 && fn(r, c)) out[r][c] ^= 1;
  return out;
}

function penalty(m: Matrix): number {
  const sz = m.length;
  let s = 0;
  for (let r = 0; r < sz; r++) {
    for (let c = 0, run = 1; c < sz; c += run, run = 1) {
      while (c + run < sz && m[r][c + run] === m[r][c]) run++;
      if (run >= 5) s += 3 + run - 5;
    }
  }
  for (let c = 0; c < sz; c++) {
    for (let r = 0, run = 1; r < sz; r += run, run = 1) {
      while (r + run < sz && m[r + run][c] === m[r][c]) run++;
      if (run >= 5) s += 3 + run - 5;
    }
  }
  for (let r = 0; r < sz - 1; r++)
    for (let c = 0; c < sz - 1; c++)
      if (m[r][c] === m[r][c+1] && m[r][c] === m[r+1][c] && m[r][c] === m[r+1][c+1])
        s += 3;
  let dark = 0;
  for (let r = 0; r < sz; r++) for (let c = 0; c < sz; c++) if (m[r][c] === 1) dark++;
  const pct = (dark / (sz * sz)) * 100;
  s += Math.min(Math.abs(Math.floor(pct / 5) * 5 - 50), Math.abs(Math.ceil(pct / 5) * 5 - 50)) / 5 * 10;
  return s;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function generateQrMatrix(text: string): boolean[][] {
  const byteLen = new TextEncoder().encode(text).length;
  let ver = 1;
  while (ver <= 10 && CAP_M[ver] < byteLen) ver++;
  if (ver > 10) throw new Error(`QR: text too long (${byteLen} bytes)`);

  const sz       = 4 * ver + 17;
  const dataCw   = DAT_CW[ver];
  const ecPerBlk = EC_CPB[ver];
  const nBlk     = N_BLK[ver];

  const dataBytes = encodeData(text, dataCw);

  // Split data into blocks + RS encode each
  const blocks: Uint8Array[]  = [];
  const ecBlocks: Uint8Array[] = [];
  let start = 0;
  const baseLen = Math.floor(dataCw / nBlk);
  const extra   = dataCw % nBlk;
  for (let b = 0; b < nBlk; b++) {
    const len = baseLen + (b < extra ? 1 : 0);
    const blk = dataBytes.slice(start, start + len);
    blocks.push(blk);
    ecBlocks.push(rsEncode(blk, ecPerBlk));
    start += len;
  }

  // Interleave
  const cws: number[] = [];
  const maxData = Math.max(...blocks.map(b => b.length));
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.length) cws.push(b[i]);
  for (let i = 0; i < ecPerBlk; i++) for (const ec of ecBlocks) cws.push(ec[i]);
  while (cws.length < TOT_CW[ver]) cws.push(0);

  // Build matrix
  const m = makeMatrix(sz);
  finderPattern(m, 0, 0);
  finderPattern(m, 0, sz - 7);
  finderPattern(m, sz - 7, 0);
  timingPatterns(m);

  for (const ar of ALN_POS[ver])
    for (const ac of ALN_POS[ver])
      if (m[ar][ac] === -1) alignmentPattern(m, ar, ac);

  reserveFormat(m);
  placeData(m, new Uint8Array(cws));

  // Pick best mask
  let bestMask = 0, bestScore = Infinity;
  for (let p = 0; p < 8; p++) {
    const candidate = applyMask(m, p);
    applyFormatInfo(candidate, p);
    const score = penalty(candidate);
    if (score < bestScore) { bestScore = score; bestMask = p; }
  }

  const final = applyMask(m, bestMask);
  applyFormatInfo(final, bestMask);

  return final.map(row => Array.from(row).map(v => v === 1));
}
