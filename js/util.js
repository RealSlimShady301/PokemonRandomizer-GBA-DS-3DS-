// Algemene hulpfuncties: byte-lezen/schrijven, patroon zoeken, seeded RNG.
(function (g) {
  const U = {};

  U.r16 = (b, o) => b[o] | (b[o + 1] << 8);
  U.r32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  U.w16 = (b, o, v) => { b[o] = v & 0xff; b[o + 1] = (v >> 8) & 0xff; };
  U.w32 = (b, o, v) => { b[o] = v & 0xff; b[o + 1] = (v >> 8) & 0xff; b[o + 2] = (v >> 16) & 0xff; b[o + 3] = (v >>> 24) & 0xff; };

  U.hex = (s) => s.trim().split(/\s+/).map((x) => (x === '??' ? -1 : parseInt(x, 16)));

  // Zoek patroon (array met bytes, -1 = wildcard). Geeft eerste offset of -1.
  U.find = function (b, pat, start = 0, end = b.length, step = 1) {
    if (typeof pat === 'string') pat = U.hex(pat);
    const n = pat.length, first = pat[0];
    for (let i = start; i <= end - n; i += step) {
      if (first >= 0 && b[i] !== first) continue;
      let ok = true;
      for (let j = 1; j < n; j++) { const p = pat[j]; if (p >= 0 && b[i + j] !== p) { ok = false; break; } }
      if (ok) return i;
    }
    return -1;
  };
  U.findAll = function (b, pat, start = 0, end = b.length, step = 1) {
    if (typeof pat === 'string') pat = U.hex(pat);
    const out = [];
    let i = start;
    while (true) { const f = U.find(b, pat, i, end, step); if (f < 0) break; out.push(f); i = f + step; }
    return out;
  };

  // Seeded RNG (xmur3 + sfc32)
  U.makeRng = function (seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    const seed = () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
    let a = seed(), b = seed(), c = seed(), d = seed();
    const next = () => {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
    for (let i = 0; i < 15; i++) next();
    const r = {
      next,
      int: (n) => Math.floor(next() * n),
      range: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
      chance: (p) => next() < p,
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      shuffle: (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
    };
    return r;
  };

  U.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // CRC32 + eenvoudige ZIP (zonder compressie) voor de LayeredFS-export
  const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  U.crc32 = (d) => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC_T[(c ^ d[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  U.zip = function (files) { // files: [{ path, data: Uint8Array }]
    const enc = new TextEncoder(), parts = [], central = [];
    let off = 0;
    for (const f of files) {
      const name = enc.encode(f.path), crc = U.crc32(f.data), n = f.data.length;
      const h = new Uint8Array(30 + name.length);
      U.w32(h, 0, 0x04034b50); U.w16(h, 4, 20); U.w16(h, 8, 0); U.w32(h, 14, crc); U.w32(h, 18, n); U.w32(h, 22, n); U.w16(h, 26, name.length); h.set(name, 30);
      const c = new Uint8Array(46 + name.length);
      U.w32(c, 0, 0x02014b50); U.w16(c, 4, 20); U.w16(c, 6, 20); U.w32(c, 16, crc); U.w32(c, 20, n); U.w32(c, 24, n); U.w16(c, 28, name.length); U.w32(c, 42, off); c.set(name, 46);
      parts.push(h, f.data); central.push(c); off += h.length + n;
    }
    const cdSize = central.reduce((a, c) => a + c.length, 0);
    const e = new Uint8Array(22);
    U.w32(e, 0, 0x06054b50); U.w16(e, 8, files.length); U.w16(e, 10, files.length); U.w32(e, 12, cdSize); U.w32(e, 16, off);
    const out = new Uint8Array(off + cdSize + 22); let p = 0;
    for (const x of parts.concat(central, [e])) { out.set(x, p); p += x.length; }
    return out;
  };
  U.toBase64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };

  g.U = U;
})(typeof window !== 'undefined' ? window : globalThis);
