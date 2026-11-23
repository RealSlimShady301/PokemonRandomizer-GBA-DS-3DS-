// Gen 4 (Diamant/Parel/Platina/HeartGold/SoulSilver) en Gen 5 (Zwart/Wit/Zwart 2/Wit 2) – Nintendo DS.
// Werkt in-place in NARC-archieven (bestandsgroottes blijven gelijk).
(function (g) {
  const { r16, r32, w16 } = U;
  const CODES = { ADA: [4, 'Diamond'], APA: [4, 'Pearl'], CPU: [4, 'Platinum'], IPK: [4, 'HeartGold'], IPG: [4, 'SoulSilver'],
    IRB: [5, 'Black'], IRA: [5, 'White'], IRE: [5, 'Black 2'], IRD: [5, 'White 2'] };

  function fileSystem(rom) {
    const fnt = r32(rom, 0x40), fat = r32(rom, 0x48), fatSize = r32(rom, 0x4C);
    const files = {}; // pad -> id
    const walk = (dirId, path, depth) => {
      if (depth > 20) return;
      const e = fnt + (dirId & 0xFFF) * 8;
      let o = fnt + r32(rom, e), id = r16(rom, e + 4);
      while (true) {
        const len = rom[o++]; if (!len) break;
        const n = len & 0x7F; let name = ''; for (let k = 0; k < n; k++) name += String.fromCharCode(rom[o + k]); o += n;
        if (len & 0x80) { const sub = r16(rom, o); o += 2; walk(sub, path + name + '/', depth + 1); }
        else files[path + name] = id++;
      }
    };
    walk(0xF000, '', 0);
    const count = fatSize / 8;
    const range = (id) => [r32(rom, fat + id * 8), r32(rom, fat + id * 8 + 4)];
    return { files, count, range };
  }

  function narc(rom, start, end) {
    if (String.fromCharCode(rom[start], rom[start + 1], rom[start + 2], rom[start + 3]) !== 'NARC') return null;
    const btaf = start + r16(rom, start + 12);
    if (String.fromCharCode(rom[btaf], rom[btaf + 1], rom[btaf + 2], rom[btaf + 3]) !== 'BTAF') return null;
    const count = r16(rom, btaf + 8);
    const btnf = btaf + r32(rom, btaf + 4);
    const gmif = btnf + r32(rom, btnf + 4);
    const base = gmif + 8;
    const subs = [];
    for (let i = 0; i < count; i++) {
      const s = base + r32(rom, btaf + 12 + i * 8), e = base + r32(rom, btaf + 16 + i * 8);
      if (s > end || e > end || e < s) return null;
      subs.push([s, e]);
    }
    return subs;
  }

  // BLZ ("backwards LZ", DS-arm9-compressie): uitpakken en optimaal opnieuw inpakken (kleiner dan het origineel)
  function blzDec(comp) {
    const len = comp.length, v = r32(comp, len - 8) >>> 0, add = r32(comp, len - 4) >>> 0, hdr = v >>> 24, stop = len - (v & 0xFFFFFF);
    const dec = new Uint8Array(len + add); dec.set(comp);
    let idx = len - hdr, o = len + add;
    while (idx > stop) {
      let fl = dec[--idx];
      for (let i = 0; i < 8 && idx > stop; i++) {
        if (fl & 0x80) { const b1 = dec[--idx], b2 = dec[--idx], seg = (b1 << 8) | b2, l = (seg >> 12) + 3, d = (seg & 0xFFF) + 3; for (let k = 0; k < l; k++) { dec[o - 1] = dec[o - 1 + d]; o--; } }
        else dec[--o] = dec[--idx];
        fl = (fl << 1) & 0xFF;
      }
    }
    return { dec, stop };
  }
  function blzEnc(dec, stop) {
    const n = dec.length - stop, rev = new Uint8Array(n);
    for (let j = 0; j < n; j++) rev[j] = dec[dec.length - 1 - j];
    const H = 1 << 16, head = new Int32Array(H).fill(-1), prev = new Int32Array(n).fill(-1);
    const hash = (j) => ((rev[j] << 8) ^ (rev[j + 1] << 4) ^ rev[j + 2]) & (H - 1);
    const ml = new Uint8Array(n), md = new Uint16Array(n);
    for (let j = 0; j < n; j++) {
      if (j + 2 >= n) continue;
      let best = 0, bd = 0, c = head[hash(j)], chain = 0; const maxL = Math.min(18, n - j);
      while (c >= 0 && chain++ < 512) {
        const d = j - c; if (d > 0x1002) break;
        if (d >= 3) { let l = 0; while (l < maxL && rev[c + l] === rev[j + l]) l++; if (l > best) { best = l; bd = d; if (l === maxL) break; } }
        c = prev[c];
      }
      if (best >= 3) { ml[j] = best; md[j] = bd; }
      const h = hash(j); prev[j] = head[h]; head[h] = j;
    }
    const cost = new Float64Array(n + 1), ch = new Uint8Array(n);
    for (let j = n - 1; j >= 0; j--) { cost[j] = cost[j + 1] + 9; for (let l = 3; l <= ml[j]; l++) { const c = cost[j + l] + 17; if (c < cost[j]) { cost[j] = c; ch[j] = l; } } }
    const B = [];
    for (let j = 0; j < n;) {
      const fi = B.length; B.push(0);
      for (let i = 0; i < 8 && j < n; i++) {
        if (ch[j]) { B[fi] |= 0x80 >> i; const seg = ((ch[j] - 3) << 12) | (md[j] - 3); B.push(seg >> 8, seg & 0xFF); j += ch[j]; }
        else { B.push(rev[j]); j++; }
      }
    }
    const total = stop + B.length, pad = (4 - ((total + 8) % 4)) % 4, hdr = 8 + pad, len = total + hdr;
    const c = new Uint8Array(len); c.set(dec.subarray(0, stop));
    for (let k = 0; k < B.length; k++) c[stop + B.length - 1 - k] = B[k];
    c.fill(0xFF, total, total + pad);
    U.w32(c, len - 8, ((hdr << 24) | (len - stop)) >>> 0); U.w32(c, len - 4, dec.length - len);
    return c;
  }
  const crc16 = (b, s, e) => { let c = 0xFFFF; for (let i = s; i < e; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = c & 1 ? (c >> 1) ^ 0xA001 : c >> 1; } return c; };

  // Gen 4/5 item-nummers voor sterke trainers
  const ITEMS45 = { fullRestore: 23, hyperPotion: 25, held: [234, 158, 157, 275, 270, 287, 268, 220, 221, 245, 247, 271, 285, 213, 236, 230] };

  function load(rom) {
    const code = String.fromCharCode(...rom.slice(0x0C, 0x10));
    const info = CODES[code.slice(0, 3)];
    const gen = info[0];
    const game = { gen, platform: 'Nintendo DS', name: 'Pokémon ' + info[1] + ' (' + code + ')', rom, warnings: [],
      abilityMax: gen === 4 ? 123 : 164, hasTmCompat: false, tms: null, starters: null, wild: [] };
    game.statNames = ['HP', 'Atk', 'Def', 'Spe', 'SpA', 'SpD'];
    const TYPES = gen === 5 ? PKDATA.TYPES_GEN5 : PKDATA.TYPES_GBA_NDS;
    const maxSp = gen === 4 ? 493 : 649;
    game.typeNames = TYPES.filter(Boolean);
    const fs = fileSystem(rom);

    // Alle NARCs in volgorde van bestands-id
    const narcs = [];
    for (let id = 0; id < fs.count; id++) {
      const [s, e] = fs.range(id);
      if (e - s < 16 || e > rom.length) continue;
      const subs = narc(rom, s, e);
      if (subs) narcs.push({ id, subs });
    }

    // ---- Personal (basisstats) ----
    const personal = narcs.find((n) => n.subs.length > maxSp && (() => { const [s] = n.subs[1]; return rom[s] === 45 && rom[s + 1] === 49 && rom[s + 2] === 49 && rom[s + 3] === 45 && rom[s + 4] === 65 && rom[s + 5] === 65 && rom[s + 6] === (gen === 5 ? 11 : 12) && rom[s + 7] === 3; })());
    if (!personal) throw new Error('Persoonlijke Pokémon-data niet gevonden in deze DS-ROM.');
    const growthOff = gen === 4 ? 19 : 21, abOff = gen === 4 ? 22 : 24, abN = gen === 4 ? 2 : 3;
    game.species = [];
    for (let s = 1; s <= maxSp; s++) {
      const [o] = personal.subs[s];
      game.species.push({ id: s, dex: s, name: PKDATA.nameOf(s), off: o,
        stats: [0, 1, 2, 3, 4, 5].map((k) => rom[o + k]),
        types: [TYPES[rom[o + 6]] || 'Normal', TYPES[rom[o + 7]] || 'Normal'], _origTypes: [TYPES[rom[o + 6]] || 'Normal', TYPES[rom[o + 7]] || 'Normal'],
        catchRate: rom[o + 8], growth: rom[o + growthOff],
        abilities: Array.from({ length: abN }, (_, k) => rom[o + abOff + k]),
        heldItems: Array.from({ length: gen === 4 ? 2 : 3 }, (_, k) => r16(rom, o + 12 + k * 2)) });
    }
    game.byId = new Map(game.species.map((s) => [s.id, s]));
    game.commitSpecies = (sp) => {
      const o = sp.off;
      sp.stats.forEach((v, k) => (rom[o + k] = U.clamp(v, 1, 255)));
      rom[o + 6] = TYPES.indexOf(sp.types[0]); rom[o + 7] = TYPES.indexOf(sp.types[1]);
      rom[o + 8] = sp.catchRate; rom[o + growthOff] = sp.growth;
      sp.abilities.forEach((a, k) => (rom[o + abOff + k] = a));
      sp.heldItems.forEach((it, k) => w16(rom, o + 12 + k * 2, it));
    };

    const maxMove = gen === 4 ? 467 : 559;
    game.moves = { valid: [], max: maxMove, info: () => null };
    for (let m = 1; m <= maxMove; m++) if (m !== 165) game.moves.valid.push(m);

    // ---- Level-up aanvallen ----
    game.learnsets = new Map();
    const lsN = narcs.find((n) => n.subs.length > maxSp && (() => {
      const [s] = n.subs[1];
      return gen === 4 ? r16(rom, s) === 0x0221 : r16(rom, s) === 33 && r16(rom, s + 2) === 1;
    })());
    if (lsN) {
      for (let s = 1; s <= maxSp; s++) {
        const [a, b] = lsN.subs[s]; const entries = [];
        if (gen === 4) for (let o = a; o + 1 < b && r16(rom, o) !== 0xFFFF; o += 2) { const v = r16(rom, o); entries.push({ level: v >> 9, move: v & 0x1FF, _off: o }); }
        else for (let o = a; o + 3 < b && r16(rom, o) !== 0xFFFF; o += 4) entries.push({ level: r16(rom, o + 2), move: r16(rom, o), _off: o });
        game.learnsets.set(s, { entries, commit() {
          this.entries.forEach((e) => (gen === 4 ? w16(rom, e._off, (e.level << 9) | e.move) : w16(rom, e._off, e.move))); } });
      }
    } else game.warnings.push('Level-up aanvallen niet gevonden');

    // ---- Trainers: trdata + trpoke zijn twee opeenvolgende NARCs ----
    game.trainers = [];
    let found = null;
    // grootte per Pokémon: 6 (DP) of 8 (Pt/HGSS/BW) + 2 (item) + 8 (aanvallen); DP vult bestanden aan tot een veelvoud van 4
    const entrySize = (n, fl, len) => {
      for (const base of [6, 8]) { const es = base + (fl & 2 ? 2 : 0) + (fl & 1 ? 8 : 0); if (len >= es * n && len - es * n < 4) return es; }
      return 0;
    };
    for (let i = 0; i + 1 < narcs.length && !found; i++) {
      const A = narcs[i], B = narcs[i + 1];
      if (B.id !== A.id + 1 || A.subs.length < 200 || A.subs.length !== B.subs.length) continue;
      const len0 = A.subs[1][1] - A.subs[1][0];
      if (len0 < 16 || len0 > 24) continue;
      let good = 0, total = 0;
      for (let t = 1; t < A.subs.length; t++) {
        const [ds, de] = A.subs[t]; if (de - ds !== len0) { good = -1; break; }
        const n = rom[ds + 3], fl = rom[ds]; if (!n) continue;
        total++;
        const [ps, pe] = B.subs[t]; const len = pe - ps;
        if (n > 6) continue;
        const es = entrySize(n, fl, len);
        const sp = r16(rom, ps + 4) & 0x3FF;
        if (es && sp >= 1 && sp <= maxSp) good++;
      }
      if (total > 100 && good > total * 0.9) found = { A, B };
    }
    if (found) {
      const { A, B } = found;
      for (let t = 1; t < A.subs.length; t++) {
        const [ds] = A.subs[t]; const [ps, pe] = B.subs[t];
        const n = rom[ds + 3], fl = rom[ds]; if (!n) continue;
        const es = entrySize(n, fl, pe - ps); if (!es) continue;
        const mvOff = (gen === 4 ? 6 : 8) + (fl & 2 ? 2 : 0);
        const mons = [];
        for (let m = 0; m < n; m++) {
          const b = ps + m * es;
          mons.push({ species: r16(rom, b + 4) & 0x3FF, level: rom[b + 2], _b: b, iv: rom[b], item: fl & 2 ? r16(rom, b + (gen === 4 ? 6 : 8)) : null,
            moves: fl & 1 ? [0, 1, 2, 3].map((q) => r16(rom, b + mvOff + q * 2)) : null });
        }
        if (mons.some((m) => m.species < 1 || m.species > maxSp)) continue;
        const bag = [0, 1, 2, 3].map((q) => r16(rom, ds + 4 + q * 2));
        game.trainers.push({ label: 'Trainer ' + t, mons, bag, ai: rom[ds + 12], important: bag.some((x) => x), itemIds: ITEMS45, commit() {
          this.bag.forEach((v, q) => w16(rom, ds + 4 + q * 2, v)); rom[ds + 12] = this.ai;
          this.mons.forEach((m) => {
            rom[m._b] = m.iv; if (m.item !== null) w16(rom, m._b + (gen === 4 ? 6 : 8), m.item);
            w16(rom, m._b + 4, m.species); // vorm-bits gewist
            if (gen === 5) w16(rom, m._b + 6, m.form || 0); // vorm (bv. White/Black Kyurem)
            rom[m._b + 2] = U.clamp(m.level, 1, 100);
            if (m.moves) m.moves.forEach((v, q) => w16(rom, m._b + mvOff + q * 2, v));
          }); } });
      }
    } else game.warnings.push('Trainerdata niet gevonden');

    // ---- Evoluties: NARC met per soort 7 x (methode, parameter, doel) ----
    game.evos = null;
    const evN = narcs.find((n) => n.subs.length > maxSp && (() => { const [s] = n.subs[1]; return r16(rom, s) === 4 && r16(rom, s + 2) === 16 && r16(rom, s + 4) === 2; })());
    if (evN) {
      game.evos = { methods: gen === 4 ? { trade: [5], tradeItem: [6], tradeSpecies: [], level: 4, heldDay: 18, heldNight: 19 }
        : { trade: [5], tradeItem: [6], tradeSpecies: [7], level: 4, heldDay: 19, heldNight: 20 }, list: [] };
      for (let s = 1; s <= maxSp; s++) {
        const [a, b] = evN.subs[s]; const ent = [];
        for (let k = 0; k < 7 && a + k * 6 + 5 < b; k++) ent.push({ method: r16(rom, a + k * 6), param: r16(rom, a + k * 6 + 2), target: r16(rom, a + k * 6 + 4) });
        game.evos.list.push({ species: s, ent, commit() { this.ent.forEach((e, k) => { w16(rom, a + k * 6, e.method); w16(rom, a + k * 6 + 2, e.param); w16(rom, a + k * 6 + 4, e.target); }); } });
      }
    }
    game.tmItems = []; for (let i = 328; i <= 419; i++) game.tmItems.push(i);
    if (gen === 5) game.tmItems.push(618, 619, 620);

    const narcAt = (path) => { const id = fs.files[path]; return id === undefined ? null : narcs.find((n) => n.id === id) || null; };
    const r32u = (o) => r32(rom, o) >>> 0;
    const w32 = (o, v) => { rom[o] = v & 0xFF; rom[o + 1] = (v >> 8) & 0xFF; rom[o + 2] = (v >> 16) & 0xFF; rom[o + 3] = (v >>> 24) & 0xFF; };
    const okSp = (v) => v >= 1 && v <= maxSp;
    const code3 = code.slice(0, 3);

    // ---- Wilde Pokémon ----
    const encPath = { ADA: 'fielddata/encountdata/d_enc_data.narc', APA: 'fielddata/encountdata/p_enc_data.narc', CPU: 'fielddata/encountdata/pl_enc_data.narc',
      IPK: 'a/0/3/7', IPG: 'a/0/3/7', IRB: 'a/1/2/6', IRA: 'a/1/2/6', IRE: 'a/1/2/7', IRD: 'a/1/2/7' }[code3];
    const encN = encPath && narcAt(encPath);
    // slot-helpers: elk slot weet zelf hoe het geschreven wordt
    const slotLvl = (spOff, spSize, lvMin, lvMax) => ({ _off: spOff, species: spSize === 4 ? r32u(spOff) : r16(rom, spOff) & (gen === 5 ? 0x7FF : 0xFFFF), min: rom[lvMin], max: rom[lvMax],
      _put(s) { if (spSize === 4) w32(spOff, s.species); else w16(rom, spOff, gen === 5 ? s.species | ((s.form || 0) << 11) : s.species); rom[lvMin] = U.clamp(s.min, 1, 100); rom[lvMax] = U.clamp(Math.max(s.min, s.max), 1, 100); } });
    const slotSp = (spOff, spSize, lv) => ({ species: spSize === 4 ? r32u(spOff) : r16(rom, spOff), min: lv || 50, max: lv || 50, // geen eigen level: onbekend
      _put(s) { if (spSize === 4) w32(spOff, s.species); else w16(rom, spOff, s.species); } });
    if (encN) {
      encN.subs.forEach(([a, b], i) => {
        const slots = [];
        const len = b - a;
        if (gen === 4 && len === 424) { // Diamant/Parel/Platina
          const lv = []; for (let q = 0; q < 12; q++) { lv.push(r32u(a + 4 + q * 8)); slots.push(slotSp(a + 8 + q * 8, 4, r32u(a + 4 + q * 8))); }
          // vervangers (zwerm, dag, nacht, radar, GBA-slot) gebruiken het level van het slot dat ze vervangen
          const replLv = [0, 1, 2, 3, 2, 3, 4, 5, 10, 11];
          for (let q = 0; q < 10; q++) slots.push(slotSp(a + 100 + q * 4, 4, lv[replLv[q]] || 0));
          for (let q = 16; q < 26; q++) slots.push(slotSp(a + 100 + q * 4, 4, lv[8 + (q % 2)] || 0));
          slots.forEach((s, k) => { if (k < 12) { s.max = s.min = s.min; s._lv = a + 4 + k * 8; const put = s._put; s._put = (x) => { put(x); w32(x._lv, U.clamp(x.min, 1, 100)); }; } });
          for (let w = 0; w < 5; w++) for (let q = 0; q < 5; q++) { const o = a + 204 + w * 44 + 4 + q * 8; slots.push(slotLvl(o + 4, 4, o + 1, o)); }
        } else if (gen === 4 && len === 196) { // HeartGold/SoulSilver
          for (let q = 0; q < 12; q++) { const lo = a + 8 + q; const s = slotSp(a + 20 + q * 2, 2, rom[lo]); const put = s._put; s._put = (x) => { put(x); rom[lo] = U.clamp(x.min, 1, 100); }; slots.push(s); }
          for (const base of [44, 68]) for (let q = 0; q < 12; q++) slots.push(slotSp(a + base + q * 2, 2, rom[a + 8 + q]));
          for (let q = 0; q < 4; q++) slots.push(slotSp(a + 92 + q * 2, 2, rom[a + 8 + 2 + q] || rom[a + 8]));
          for (const [o, c] of [[100, 5], [120, 2], [128, 5], [148, 5], [168, 5]]) for (let q = 0; q < c; q++) { const p = a + o + q * 4; slots.push(slotLvl(p + 2, 2, p, p + 1)); }
          for (let q = 0; q < 4; q++) slots.push(slotSp(a + 188 + q * 2, 2, rom[a + 8]));
        } else if (gen === 5 && len % 232 === 0 && len) { // Zwart/Wit (2): 1 of 4 seizoenen x 56 slots
          for (let s0 = a; s0 < b; s0 += 232) for (let q = 0; q < 56; q++) { const p = s0 + 8 + q * 4; slots.push(slotLvl(p, 2, p + 2, p + 3)); }
        } else return;
        const real = slots.filter((s) => okSp(s.species));
        if (!real.length) return;
        game.wild.push({ label: 'Gebied ' + i, slots: real, commit() { this.slots.forEach((s) => s._put(s)); } });
      });
    }
    // ---- HeartGold/SoulSilver: Safari Zone (a/2/3/0: blokken van (soort u16, level u16)) en Headbutt-bomen (a/2/5/2) ----
    if (code3 === 'IPK' || code3 === 'IPG') {
      const saf = narcAt('a/2/3/0');
      if (saf) saf.subs.forEach(([a, b], i) => {
        const slots = [];
        for (let o = a + 8; o + 4 <= b; o += 4) {
          const sp = r16(rom, o), lv = r16(rom, o + 2);
          if (okSp(sp) && lv >= 1 && lv <= 100) slots.push({ species: sp, min: lv, max: lv, _put(s) { w16(rom, o, s.species); w16(rom, o + 2, U.clamp(s.min, 1, 100)); } });
        }
        if (slots.length) game.wild.push({ label: 'Safari Zone ' + (i + 1), slots, commit() { this.slots.forEach((s) => s._put(s)); } });
      });
      const hb = narcAt('a/2/5/2');
      if (hb) hb.subs.forEach(([a, b], i) => {
        if (b - a < 4 + 18 * 4) return;
        const slots = [];
        for (let q = 0; q < 18; q++) { const o = a + 4 + q * 4; if (okSp(r16(rom, o)) && rom[o + 2] >= 1 && rom[o + 3] >= rom[o + 2]) slots.push(slotLvl(o, 2, o + 2, o + 3)); }
        if (slots.length) game.wild.push({ label: 'Headbutt ' + i, slots, commit() { this.slots.forEach((s) => s._put(s)); } });
      });
    }
    if (!game.wild.length) game.warnings.push('Wilde Pokémon niet gevonden');

    // ---- arm9 (programmacode): bij HGSS/BW/B2W2 BLZ-gecomprimeerd -> uitpakken, aanpassen en optimaal opnieuw inpakken ----
    const a9off = r32u(0x20), a9size = r32u(0x2C), a9ram = r32u(0x28);
    let mp = -1; for (let o = 0; o < Math.min(0x8000, a9size); o += 4) if (r32u(a9off + o) === 0xDEC00621 && r32u(a9off + o + 4) === 0x2106C0DE) { mp = o; break; }
    const a9comp = mp >= 8 && r32u(a9off + mp - 8) !== 0;
    let a9 = rom.subarray(a9off, a9off + a9size), a9stop = 0, a9dirty = false;
    if (a9comp) { const D = blzDec(rom.slice(a9off, a9off + (r32u(a9off + mp - 8) - a9ram))); a9 = D.dec; a9stop = D.stop; }
    game._a9 = () => a9;
    const c16 = (o) => a9[o] | (a9[o + 1] << 8), c32 = (o) => (a9[o] | (a9[o + 1] << 8) | (a9[o + 2] << 16) | (a9[o + 3] << 24)) >>> 0;
    const cw16 = (o, v) => { a9[o] = v & 0xFF; a9[o + 1] = (v >> 8) & 0xFF; a9dirty = true; };
    const cw32 = (o, v) => { cw16(o, v & 0xFFFF); cw16(o + 2, v >>> 16); };
    const fileOf = (id) => fs.range(id);

    // ---- Starters ----
    const STARTERS = gen === 4 ? (code3 === 'IPK' || code3 === 'IPG' ? [152, 155, 158] : [387, 390, 393]) : [495, 498, 501];
    if (gen === 4) {
      // DP: overlay 64, Pt: overlay 78 (u32 per starter); HGSS: in de (uitgepakte) arm9
      for (const ov of [64, 78]) {
        if (game.starters || ov >= fs.count) continue;
        const [s, e] = fileOf(ov);
        for (let o = s; o + 12 <= e; o += 4) if (STARTERS.every((v, q) => r32u(o + q * 4) === v)) {
          game.starters = { species: STARTERS.slice(), commit() { this.species.forEach((v, q) => w32(o + q * 4, v)); starterNew = this.species.slice(); } }; break;
        }
      }
      if (!game.starters) for (let o = 0; o + 12 <= a9.length; o += 4) if (STARTERS.every((v, q) => c32(o + q * 4) === v)) {
        game.starters = { species: STARTERS.slice(), note: 'In de cutscene vóór het kiezen kan nog de originele naam/sprite staan.', commit() { this.species.forEach((v, q) => cw32(o + q * 4, v)); starterNew = this.species.slice(); } }; break;
      }
      if (!game.starters) game.warnings.push('Starters niet gevonden');
    } else {
      // Zwart/Wit (2): het script waarin je je starter kiest; elke vermelding van starter 1/2/3 wordt vervangen
      const scr = narcAt(code3 === 'IRB' || code3 === 'IRA' ? 'a/0/5/7' : 'a/0/5/6');
      let best = null;
      if (scr) scr.subs.forEach(([a, b]) => {
        const occ = STARTERS.map((v) => { const o = []; for (let p = a; p + 1 < b; p++) if (r16(rom, p) === v) o.push(p); return o; });
        if (occ.every((x) => x.length >= 3) && (!best || occ.flat().length > best.flat().length)) best = occ;
      });
      if (best) game.starters = { species: STARTERS.slice(), experimental: true, commit() { this.species.forEach((v, q) => best[q].forEach((p) => w16(rom, p, v))); starterNew = this.species.slice(); } };
      else game.warnings.push('Starters niet gevonden');
    }

    // ---- TM's: tabel met aanvalnummers in de arm9 ----
    {
      const tm = gen === 4 ? [264, 337, 352, 347, 46, 92, 258, 339, 331, 237] : [468, 337, 473, 347, 46, 92, 258, 339, 474, 237];
      const nTm = gen === 4 ? 92 : 95, nHm = gen === 4 ? 8 : 6;
      for (let o = 0; o + 200 < a9.length && !game.tms; o += 2) {
        if (!tm.every((m, q) => c16(o + q * 2) === m)) continue;
        game.tms = { moves: [], hms: [], commit() { this.moves.forEach((m, i) => cw16(o + i * 2, m)); } };
        for (let i = 0; i < nTm; i++) game.tms.moves.push(c16(o + i * 2));
        for (let i = 0; i < nHm; i++) game.tms.hms.push(c16(o + (nTm + i) * 2));
      }
      if (!game.tms) game.warnings.push('TM-lijst niet gevonden');
      // TM-compatibiliteit in de persoonlijke data (alleen TM's, HM's blijven zoals ze zijn)
      const tmOff = gen === 4 ? 0x1C : 0x28;
      game.hasTmCompat = true;
      for (const sp of game.species) sp.tm = Array.from({ length: nTm }, (_, i) => !!(rom[sp.off + tmOff + (i >> 3)] & (1 << (i & 7))));
      const prevCommit = game.commitSpecies;
      game.commitSpecies = (sp) => { prevCommit(sp); sp.tm.forEach((v, i) => { const o = sp.off + tmOff + (i >> 3), bit = 1 << (i & 7); rom[o] = v ? rom[o] | bit : rom[o] & ~bit; }); };
    }

    // ---- Itemprijzen (item-data: prijs u16 @0; 0 = key item) en items in het veld (script: setvar ITEM-var, setvar AANTAL-var) ----
    {
      const idp = { ADA: 'itemtool/itemdata/item_data.narc', APA: 'itemtool/itemdata/item_data.narc', CPU: 'itemtool/itemdata/pl_item_data.narc', IPK: 'a/0/1/7', IPG: 'a/0/1/7' }[code3] || 'a/0/2/4';
      const idn = narcAt(idp);
      if (idn && idn.subs.length > 400) game.itemPrice = (i) => (i >= 0 && i < idn.subs.length ? r16(rom, idn.subs[i][0]) : 0);
      const pat = { ADA: [0x28, 0x8008], APA: [0x28, 0x8008], CPU: [0x28, 0x8008], IPK: [0x29, 0x8008], IPG: [0x29, 0x8008] }[code3] || [0x28, 0x800C];
      if (game.itemPrice) {
        const entries = [], [op, v] = pat, maxIt = gen === 4 ? 536 : 638;
        for (let o = 0; o + 12 < rom.length; o++) {
          if (r16(rom, o) !== op || r16(rom, o + 2) !== v || r16(rom, o + 6) !== op || r16(rom, o + 8) !== v + 1) continue;
          const it = r16(rom, o + 4), q = r16(rom, o + 10);
          if (it < 1 || it > maxIt || q < 1 || q > 99) continue;
          entries.push({ item: it, orig: it, qty: q, _o: o + 4 });
        }
        if (entries.length > 100) game.fieldItems = { entries, ballCount: entries.length, commit() { this.entries.forEach((e) => w16(rom, e._o, e.item)); } };
      }
    }

    // ---- Shiny-kans: "(TID^SID^PIDhoog^PIDlaag) < 8" = Thumb "cmp rX,#8" + bcc/bcs na 3x EOR en lsr #16 (in de arm9) ----
    {
      const sites = [];
      for (let o = 0; o + 4 < a9.length; o += 2) {
        const w = c16(o); if ((w & 0xF8FF) !== 0x2808) continue;
        const nx = c16(o + 2) & 0xFF00; if (nx !== 0xD200 && nx !== 0xD300) continue;
        let eor = 0, lsr = 0;
        for (let q = 1; q <= 14; q++) { const p = c16(o - q * 2); if ((p & 0xFFC0) === 0x4040) eor++; if ((p & 0xF800) === 0x0800 && ((p >> 6) & 31) === 16) lsr++; }
        if (eor >= 3 && lsr >= 1) sites.push(o);
      }
      if (sites.length && sites.length <= 4) {
        game.shinyBase = 8192;
        game.setShinyOdds = (odds) => { const t = U.clamp(Math.round(65536 / odds), 8, 255); sites.forEach((o) => { a9[o] = t; a9dirty = true; }); return Math.round(65536 / t); };
      }
    }

    // ---- Gift-Pokémon en static encounters: script-opdrachten (GivePokemon / WildBattle: opcode, soort, level, ...) ----
    game.statics = [];
    {
      const scrP = { ADA: 'fielddata/script/scr_seq_release.narc', APA: 'fielddata/script/scr_seq_release.narc', CPU: 'fielddata/script/scr_seq.narc', IPK: 'a/0/1/2', IPG: 'a/0/1/2', IRB: 'a/0/5/7', IRA: 'a/0/5/7', IRE: 'a/0/5/6', IRD: 'a/0/5/6' }[code3];
      const ops = { ADA: [0x96, 0x2BD], APA: [0x96, 0x2BD], CPU: [0x96, 0x2BD], IPK: [0x89, 0x24D], IPG: [0x89, 0x24D], IRB: [-1, 0x178], IRA: [-1, 0x178], IRE: [-1, 0x174], IRD: [-1, 0x174] }[code3];
      const story = { ADA: [483, 484], APA: [483, 484], CPU: [487], IPK: [249, 250], IPG: [249, 250], IRB: [643, 644], IRA: [643, 644] }[code3] || [];
      const sn = scrP && narcAt(scrP);
      if (sn && ops) for (const [a, b] of sn.subs) for (let o = a; o + 6 < b; o++) {
        const op = r16(rom, o); if (op !== ops[0] && op !== ops[1]) continue;
        const sp = r16(rom, o + 2), lv = r16(rom, o + 4);
        if (!okSp(sp) || lv < 5 || lv > 100) continue;
        const gift = op === ops[0];
        if (gift && gen === 4) { const it = r16(rom, o + 6), v = r16(rom, o + 8); if (it > 600 || (v & 0xFF00) !== 0x8000) continue; }
        game.statics.push({ kind: gift ? 'gift' : 'static', label: (gift ? 'Gift ' : 'Static ') + PKDATA.nameOf(sp), species: sp, level: lv, story: !gift && story.includes(sp), commit() { w16(rom, o + 2, this.species); } });
        o += 5;
      }
    }

    // ---- In-game trades: NARC met vaste structuur (Gen 4: gegeven @0, gevraagd @0x4C; Gen 5: gegeven @4, gevraagd @0x5C) ----
    game.trades = [];
    {
      const tp = { ADA: 'fielddata/pokemon_trade/fld_trade.narc', APA: 'fielddata/pokemon_trade/fld_trade.narc', CPU: 'fielddata/pokemon_trade/fld_trade.narc',
        IPK: 'a/1/1/2', IPG: 'a/1/1/2', IRB: 'a/1/6/5', IRA: 'a/1/6/5', IRE: 'a/1/6/3', IRD: 'a/1/6/3' }[code3];
      const tn = tp && narcAt(tp);
      const [gO, qO] = gen === 4 ? [0, 0x4C] : [4, 0x5C];
      if (tn) tn.subs.forEach(([a, b], i) => {
        if (b - a < qO + 4) return;
        const give = r32u(a + gO), req = r32u(a + qO);
        if (!okSp(give) || !okSp(req) || give === req || (gen === 5 && req === 25)) return; // ongebruikte/speciale entries overslaan
        game.trades.push({ label: 'Trade ' + (game.trades.length + 1), give, req, commit() { w32(a + gO, this.give); w32(a + qO, this.req); } });
      });
    }

    // ---- Starternaam (+ categorie + type) in de verhaaltekst (Gen 4: msg-NARC, Gen 5: tekst-NARC) ----
    // Het tekstarchief wordt opnieuw opgebouwd; als het groter wordt, komt het achteraan in de (lege) ROM-ruimte.
    const al4 = (x) => (x + 3) & ~3;
    const narcBuild = (subsData) => { // [Uint8Array] -> NARC
      const n = subsData.length, btaf = 12 + n * 8, btnf = 16, dataLen = subsData.reduce((q, b) => q + al4(b.length), 0);
      const total = 16 + btaf + btnf + 8 + dataLen, b = new Uint8Array(total).fill(0xFF);
      const s4 = (o, t) => { for (let k = 0; k < 4; k++) b[o + k] = t.charCodeAt(k); };
      s4(0, 'NARC'); w16(b, 4, 0xFFFE); w16(b, 6, 0x0100); U.w32(b, 8, total); w16(b, 12, 16); w16(b, 14, 3);
      s4(16, 'BTAF'); U.w32(b, 20, btaf); w16(b, 24, n); w16(b, 26, 0);
      let pos = 0; subsData.forEach((d, i) => { U.w32(b, 28 + i * 8, pos); U.w32(b, 32 + i * 8, pos + d.length); pos += al4(d.length); });
      const o2 = 16 + btaf; s4(o2, 'BTNF'); U.w32(b, o2 + 4, btnf); U.w32(b, o2 + 8, 4); w16(b, o2 + 12, 0); w16(b, o2 + 14, 1);
      const o3 = o2 + btnf; s4(o3, 'GMIF'); U.w32(b, o3 + 4, 8 + dataLen);
      pos = 0; subsData.forEach((d) => { b.set(d, o3 + 8 + pos); pos += al4(d.length); });
      return b;
    };
    // Gen 4: u16 aantal, u16 seed, tabel (offset,lengte) xor sleutel, tekens xor lopende sleutel
    const g4dec = (a, b) => {
      const n = r16(rom, a), seed = r16(rom, a + 2); if (!n || 4 + n * 8 > b - a) return null; const lines = [];
      for (let i = 0; i < n; i++) {
        const key = (seed * 0x2FD * (i + 1)) & 0xFFFF, k2 = (key | (key << 16)) >>> 0, e = a + 4 + i * 8;
        const off = (r32u(e) ^ k2) >>> 0, len = (r32u(e + 4) ^ k2) >>> 0; if (off + len * 2 > b - a || len > 4000) return null;
        let k = (0x91BD3 * (i + 1)) & 0xFFFF; const cs = [];
        for (let j = 0; j < len; j++) { cs.push(r16(rom, a + off + j * 2) ^ k); k = (k + 0x493D) & 0xFFFF; }
        lines.push(cs);
      }
      return { seed, lines };
    };
    const g4enc = (seed, lines) => {
      const n = lines.length; let pos = 4 + n * 8; const total = pos + lines.reduce((q, l) => q + l.length * 2, 0), b = new Uint8Array(total);
      w16(b, 0, n); w16(b, 2, seed);
      lines.forEach((cs, i) => {
        const key = (seed * 0x2FD * (i + 1)) & 0xFFFF, k2 = (key | (key << 16)) >>> 0;
        U.w32(b, 4 + i * 8, (pos ^ k2) >>> 0); U.w32(b, 8 + i * 8, (cs.length ^ k2) >>> 0);
        let k = (0x91BD3 * (i + 1)) & 0xFFFF; cs.forEach((c, j) => { w16(b, pos + j * 2, c ^ k); k = (k + 0x493D) & 0xFFFF; }); pos += cs.length * 2;
      });
      return b;
    };
    let starterNew = null, starterOrig = STARTERS.slice();
    const writeStarterText = () => {
      if (!starterNew || starterNew.join() === starterOrig.join()) return;
      const tp = { ADA: 'msgdata/msg.narc', APA: 'msgdata/msg.narc', CPU: 'msgdata/pl_msg.narc', IPK: 'a/0/2/7', IPG: 'a/0/2/7' }[code3];
      if (!tp) { // Gen 5: het keuzescherm (a/0/0/2, bestand 0) toont de namen als losse regels
        const N5 = narcAt('a/0/0/2'); if (!N5) return;
        const [a0, b0] = N5.subs[0];
        const so = a0 + r32u(a0 + 0xC), n = r16(rom, a0 + 2); if (r16(rom, a0) !== 1) return;
        const lines = [];
        for (let i = 0; i < n; i++) {
          const off = r32u(so + 4 + i * 8), len = r16(rom, so + 8 + i * 8), raw = [];
          for (let j = 0; j < len; j++) raw.push(r16(rom, so + off + j * 2));
          let key = raw[len - 1] ^ 0xFFFF; const K = key, cs = new Array(len);
          for (let j = len - 1; j >= 0; j--) { cs[j] = raw[j] ^ key; key = ((key >> 3) | (key << 13)) & 0xFFFF; }
          lines.push({ cs, K, extra: r16(rom, so + 10 + i * 8) });
        }
        const str = (cs) => String.fromCharCode(...cs.filter((c) => c !== 0xFFFF));
        let ch = false;
        lines.forEach((l) => { const i = starterOrig.findIndex((sp) => PKDATA.nameOf(sp) === str(l.cs)); if (i >= 0) { l.cs = [...PKDATA.nameOf(starterNew[i])].map((c) => c.charCodeAt(0)).concat([0xFFFF]); ch = true; } });
        if (ch) {
        // opnieuw opbouwen (1 sectie)
        let pos = 4 + n * 8; const offs = lines.map((l) => { const o = pos; pos += l.cs.length * 2; return o; });
        const f = new Uint8Array(0x10 + pos);
        w16(f, 0, 1); w16(f, 2, n); U.w32(f, 4, pos); U.w32(f, 8, 0); U.w32(f, 0xC, 0x10); U.w32(f, 0x10, pos);
        lines.forEach((l, i) => {
          U.w32(f, 0x14 + i * 8, offs[i]); w16(f, 0x18 + i * 8, l.cs.length); w16(f, 0x1A + i * 8, l.extra);
          let key = l.K; for (let j = l.cs.length - 1; j >= 0; j--) { w16(f, 0x10 + offs[i] + j * 2, (l.cs[j] ^ key) & 0xFFFF); key = ((key >> 3) | (key << 13)) & 0xFFFF; }
        });
        const files = N5.subs.map(([q0, q1], i) => (i === 0 ? f : rom.slice(q0, q1)));
        placeNarc('a/0/0/2', narcBuild(files));
        }
        // verhaaltekst (a/0/0/3): starternamen vervangen (regels met getallen, zoals de lengte/gewicht-quiz, niet)
        const NS = narcAt('a/0/0/3'); if (!NS) return;
        const g5dec = (a, b) => {
          if (b - a < 0x14 || r16(rom, a) !== 1) return null;
          const n2 = r16(rom, a + 2), so2 = a + r32u(a + 0xC); if (!n2 || so2 + 4 + n2 * 8 > b) return null;
          const out = [];
          for (let i = 0; i < n2; i++) {
            const off = r32u(so2 + 4 + i * 8), len = r16(rom, so2 + 8 + i * 8); if (!len || so2 + off + len * 2 > b) return null;
            const raw = []; for (let j = 0; j < len; j++) raw.push(r16(rom, so2 + off + j * 2));
            let key = raw[len - 1] ^ 0xFFFF; const K = key, cs = new Array(len);
            for (let j = len - 1; j >= 0; j--) { cs[j] = raw[j] ^ key; key = ((key >> 3) | (key << 13)) & 0xFFFF; }
            out.push({ cs, K, extra: r16(rom, so2 + 10 + i * 8) });
          }
          return out;
        };
        const g5enc = (L5) => {
          const n2 = L5.length; let pos = 4 + n2 * 8; const offs = L5.map((l) => { const o = pos; pos += l.cs.length * 2; return o; });
          const f = new Uint8Array(0x10 + pos);
          w16(f, 0, 1); w16(f, 2, n2); U.w32(f, 4, pos); U.w32(f, 8, 0); U.w32(f, 0xC, 0x10); U.w32(f, 0x10, pos);
          L5.forEach((l, i) => {
            U.w32(f, 0x14 + i * 8, offs[i]); w16(f, 0x18 + i * 8, l.cs.length); w16(f, 0x1A + i * 8, l.extra);
            let key = l.K; for (let j = l.cs.length - 1; j >= 0; j--) { w16(f, 0x10 + offs[i] + j * 2, (l.cs[j] ^ key) & 0xFFFF); key = ((key >> 3) | (key << 13)) & 0xFFFF; }
          });
          return f;
        };
        const toA = (t) => [...t].map((c) => c.charCodeAt(0));
        const fnd = (a, sub, from) => { for (let i = from; i + sub.length <= a.length; i++) { let ok = true; for (let k = 0; k < sub.length; k++) if (a[i + k] !== sub[k]) { ok = false; break; } if (ok) return i; } return -1; };
        const oldA = starterOrig.map((sp) => toA(PKDATA.nameOf(sp))), newA = starterNew.map((sp) => toA(PKDATA.nameOf(sp)));
        let changed5 = 0;
        const files5 = NS.subs.map(([q0, q1]) => {
          const L5 = g5dec(q0, q1); if (!L5) return rom.slice(q0, q1);
          let chf = false;
          for (const l of L5) {
            const plain = String.fromCharCode(...l.cs.filter((c) => c < 0xF000 && c !== 0xFFFF));
            if (!oldA.some((o) => fnd(l.cs, o, 0) >= 0) || /[0-9]/.test(plain)) continue;
            // voorkom dat een nieuwe naam die een oude naam bevat opnieuw vervangen wordt: in één keer per positie
            const out = []; let i = 0;
            while (i < l.cs.length) { const k = oldA.findIndex((o) => o.length && o.every((c, q) => l.cs[i + q] === c)); if (k >= 0) { out.push(...newA[k]); i += oldA[k].length; } else out.push(l.cs[i++]); }
            l.cs = out; chf = true;
          }
          if (chf) { changed5++; return g5enc(L5); }
          return rom.slice(q0, q1);
        });
        if (changed5) placeNarc('a/0/0/3', narcBuild(files5));
        return;
      }
      const N = narcAt(tp); if (!N) return;
      const dec = N.subs.map(([a, b]) => g4dec(a, b));
      // namen en categorieën (ruwe tekens) uit de eigen tekst van de game
      const asc = (cs) => cs.map((c) => (c >= 0x12B && c <= 0x144 ? String.fromCharCode(65 + c - 0x12B) : c >= 0x145 && c <= 0x15E ? String.fromCharCode(97 + c - 0x145) : c === 0x1DE ? ' ' : '¤')).join('');
      const namesF = dec.find((d) => d && d.lines.length >= maxSp + 1 && asc(d.lines[1].filter((c) => c !== 0xFFFF)) === 'BULBASAUR');
      const catF = dec.find((d) => d && d.lines.length >= maxSp && /^Seed Pok/.test(asc(d.lines[1])));
      if (!namesF) return;
      const enc1 = (ch) => (ch >= 'A' && ch <= 'Z' ? 0x12B + ch.charCodeAt(0) - 65 : ch >= 'a' && ch <= 'z' ? 0x145 + ch.charCodeAt(0) - 97 : ch === '/' ? 0x1B1 : ch === ' ' ? 0x1DE : 0x1DE);
      const word = (t) => [...t].map(enc1);
      const strip = (cs) => cs.filter((c) => c !== 0xFFFF);
      const find = (a, sub, from) => { for (let i = from; i + sub.length <= a.length; i++) { let ok = true; for (let k = 0; k < sub.length; k++) if (a[i + k] !== sub[k]) { ok = false; break; } if (ok) return i; } return -1; };
      const repAll = (a, from, to) => { if (!from.length) return; let at = find(a, from, 0); while (at >= 0) { a.splice(at, from.length, ...to); at = find(a, from, at + to.length); } };
      const oldName = starterOrig.map((s) => strip(namesF.lines[s])), newName = starterNew.map((s) => strip(namesF.lines[s] || []));
      const oldCat = starterOrig.map((s) => (catF ? strip(catF.lines[s]) : [])), newCat = starterNew.map((s) => (catF ? strip(catF.lines[s]) : []));
      const typesOf = (s) => (game.byId.get(s) || { types: ['Normal', 'Normal'] }).types;
      const origTypes = starterOrig.map((s) => (game.byId.get(s) || {})._origTypes || typesOf(s));
      const tWord = (t) => (t[0] === t[1] ? t[0] : t[0] + '/' + t[1]);
      let changed = 0;
      const files = N.subs.map(([a, b], fi) => {
        const d = dec[fi]; if (!d || d.lines.length > 50) return rom.slice(a, b);
        let ch = false;
        d.lines.forEach((cs) => {
          const which = oldName.map((nm, i) => (find(cs, nm, 0) >= 0 ? i : -1)).filter((i) => i >= 0);
          if (!which.length) return;
          if (which.length === 1) { const i = which[0];
            for (const t of new Set(origTypes[i])) { const from = word(t), at = find(cs, from, 0); if (at >= 0 && asc(cs.slice(at + from.length + 1, at + from.length + 5)) === 'type') cs.splice(at, from.length, ...word(tWord(typesOf(starterNew[i])))); }
            repAll(cs, oldCat[i], newCat[i]);
          }
          for (const i of which) repAll(cs, oldName[i], newName[i]);
          ch = true;
        });
        if (!ch) return rom.slice(a, b);
        changed++; return g4enc(d.seed, d.lines);
      });
      if (!changed) return;
      placeNarc(tp, narcBuild(files));
    };
    // NARC terugschrijven: op dezelfde plek als het past, anders achteraan in de lege ROM-ruimte (FAT + header bijwerken)
    const placeNarc = (path, narc) => placeFile(fs.files[path], narc);
    const placeFile = (id, narc) => {
      const [s0, e0] = fs.range(id);
      let at = s0;
      if (narc.length > e0 - s0) {
        const dsi = rom[0x12] & 2, used = Math.max(r32u(0x80), dsi ? r32u(0x210) : 0), free = (used + 0x1FF) & ~0x1FF;
        if (free + narc.length > rom.length) { game.warnings.push('Starternamen in de tekst: geen ruimte in de ROM'); return; }
        at = free; if (!dsi) U.w32(rom, 0x80, free + narc.length);
      }
      rom.set(narc, at);
      const fat = r32u(0x48); U.w32(rom, fat + id * 8, at); U.w32(rom, fat + id * 8 + 4, at + narc.length);
      w16(rom, 0x15E, crc16(rom, 0, 0x15E));
    };
    // arm9 terugschrijven (alleen als er iets in veranderd is)
    const writeArm9 = () => {
      if (!a9comp || !a9dirty) return;
      const E = blzEnc(a9, a9stop);
      if (E.length > a9size) throw new Error('De aangepaste programmacode (arm9) past niet meer in de ROM.');
      // module-params: einde van de gecomprimeerde code (staat in het niet-gecomprimeerde begin)
      U.w32(E, mp - 8, a9ram + E.length);
      const footer = r32u(a9off + a9size) === 0xDEC00621 ? rom.slice(a9off + a9size, a9off + a9size + 12) : null;
      rom.fill(0, a9off, a9off + a9size + (footer ? 12 : 0));
      rom.set(E, a9off);
      if (footer) rom.set(footer, a9off + E.length);
      U.w32(rom, 0x2C, E.length);
      w16(rom, 0x15E, crc16(rom, 0, 0x15E)); // header-CRC
    };

    // ---- Pokédex-gebiedskaart (DPPt + HGSS): per soort en categorie een lijst met kaartcellen ----
    // DPPt: bestand = 4 + categorie*MS + soort (0-2 grot ochtend/dag/nacht, 3/4 grot speciaal, 5-7 veld, 8/9 veld speciaal)
    // HGSS: bestand = 2 + categorie*MS + soort (0-2 grot, 3-5 veld, 6 grot speciaal, 7 veld speciaal, bv. Headbutt)
    // Welke cellen bij welk gebied horen wordt afgeleid uit de originele data: het gebied krijgt de cel(len)
    // waar de meeste van zijn originele soorten staan.
    let writeDexArea = () => {};
    const DEXCFG = { ADA: ['application/zukanlist/zkn_data/zukan_enc_diamond.narc', 4, 10, [['d', [0, 1, 2], [3, 4]], ['f', [5, 6, 7], [8, 9]]]],
      APA: ['application/zukanlist/zkn_data/zukan_enc_pearl.narc', 4, 10, [['d', [0, 1, 2], [3, 4]], ['f', [5, 6, 7], [8, 9]]]],
      CPU: ['application/zukanlist/zkn_data/zukan_enc_platinum.narc', 4, 10, [['d', [0, 1, 2], [3, 4]], ['f', [5, 6, 7], [8, 9]]]],
      IPK: ['a/1/3/3', 2, 8, [['d', [0, 1, 2], [6]], ['f', [3, 4, 5], [7]]]], IPG: ['a/1/3/3', 2, 8, [['d', [0, 1, 2], [6]], ['f', [3, 4, 5], [7]]]] }[code3];
    if (DEXCFG && fs.files[DEXCFG[0]] !== undefined && game.wild.length) try {
      const [dexPath, H, C, GR] = DEXCFG, [ds, de] = fs.range(fs.files[dexPath]), subs = narc(rom, ds, de);
      if (subs && (subs.length - H) % C === 0) {
        const MS = (subs.length - H) / C, list = (i) => { const [a, b] = subs[i], out = []; for (let o = a; o + 4 <= b; o += 4) { const v = r32u(o); if (v) out.push(v); } return out; };
        const Sc = new Map(), add = (k, sp) => { if (!Sc.has(k)) Sc.set(k, new Set()); Sc.get(k).add(sp); };
        for (let sp = 1; sp < MS; sp++) for (const [G, nc, sc] of GR) { for (const c of nc) for (const x of list(H + c * MS + sp)) add(G + 'n' + x, sp); for (const c of sc) for (const x of list(H + c * MS + sp)) add(G + 's' + x, sp); }
        const keys = [...Sc.keys()];
        const areas = game.wild.map((A) => new Set(A.slots.map((x) => x.species).filter((v) => v < MS)));
        const score = (A, k) => { let n = 0; for (const v of A) if (Sc.get(k).has(v)) n++; return A.size ? n / A.size : 0; };
        const cand = areas.map((A) => { let best = 0; for (const k of keys) best = Math.max(best, score(A, k)); return best < 0.5 ? [] : keys.filter((k) => score(A, k) >= best - 1e-9); });
        const asg = cand.map((c) => (c.length === 1 ? c : null));
        for (let it = 0; it < 5; it++) for (let i = 0; i < areas.length; i++) {
          if (asg[i]) continue;
          const keep = cand[i].filter((k) => { const cov = new Set(); asg.forEach((a, j) => { if (a && a.includes(k)) areas[j].forEach((v) => cov.add(v)); }); return [...areas[i]].some((v) => !cov.has(v)); });
          if ((keep.length && keep.length < cand[i].length) || it === 4) asg[i] = keep.length ? keep : cand[i];
        }
        const owned = new Set(asg.flat().filter(Boolean)); // cellen die door een (gerandomized) gebied verklaard worden
        const sig = () => game.wild.map((A) => A.slots.map((x) => x.species).join(',')).join(';'), sig0 = sig();
        writeDexArea = () => {
          if (sig() === sig0) return;
          const per = new Map();
          game.wild.forEach((A, i) => { for (const x of A.slots) { if (x.species >= MS) continue; if (!per.has(x.species)) per.set(x.species, new Set()); (asg[i] || []).forEach((k) => per.get(x.species).add(k)); } });
          const files = subs.map(([a, b]) => rom.slice(a, b));
          const enc = (cells) => { const d = new Uint8Array((cells.length + 1) * 4); cells.forEach((v, j) => U.w32(d, j * 4, v)); return d; };
          for (let sp = 1; sp < MS; sp++) for (const [G, nc, sc] of GR) {
            const mine = [...(per.get(sp) || [])];
            const norm = mine.filter((k) => k.startsWith(G + 'n')).map((k) => +k.slice(2)).sort((x, y) => x - y);
            for (const c of nc) files[H + c * MS + sp] = enc(norm);
            for (const c of sc) { // speciale lijst: nieuwe cellen + originele cellen die niet uit een gerandomized gebied komen (bv. honingbomen)
              const keep = list(H + c * MS + sp).filter((x) => !owned.has(G + 's' + x));
              const sp2 = [...new Set([...keep, ...mine.filter((k) => k.startsWith(G + 's')).map((k) => +k.slice(2))])].sort((x, y) => x - y);
              files[H + c * MS + sp] = enc(sp2);
            }
          }
          placeNarc(dexPath, narcBuild(files));
        };
      }
    } catch (e) { /* gebiedskaart blijft origineel */ }

    // Gefuseerde Kyurem bestaat vanaf Zwart 2/Wit 2 (DNA Splicers)
    if (code3 === 'IRE' || code3 === 'IRD') game.altForms = { 646: { 1: 'White Kyurem', 2: 'Black Kyurem' } };
    // ---- Poké Marts ----
    // Gen 4: tabel met pointers (RAM-adressen) naar winkellijsten in arm9 (u16 items, einde 0xFFFF); de Seal-winkel (7x7 kleine nummers) overslaan
    // Zwart 2/Wit 2: archief a/2/8/2, één bestand per winkel. Zwart/Wit: vaste plekken in overlay 21 (gecomprimeerd).
    game.marts = null;
    let writeOverlay21 = () => {};
    try {
      if (gen === 4) {
        const ITEMMAX = 540, listAt = (o) => { const it = []; for (let q = o; q + 2 <= a9.length && it.length < 40; q += 2) { const v = c16(q); if (v === 0xFFFF) return it; if (v < 1 || v > ITEMMAX) return null; it.push(v); } return null; };
        let best = null;
        for (let o = 0; o + 80 <= a9.length; o += 4) {
          let n = 0; while (o + n * 4 + 4 <= a9.length) { const p = c32(o + n * 4); if (p < a9ram || p >= a9ram + a9.length) break; const l = listAt(p - a9ram); if (!l || !l.length) break; n++; }
          if (n >= 20 && (!best || n > best.n)) best = { o, n };
        }
        if (best) {
          const slots = [];
          for (let i = 0; i < best.n; i++) {
            const lo = c32(best.o + i * 4) - a9ram, l = listAt(lo);
            if (l.length === 7 && l.every((v) => v <= 49)) continue; // Seals
            l.forEach((v, q) => slots.push({ item: v, orig: v, _o: lo + q * 2 }));
          }
          if (slots.length >= 20) game.marts = { slots, commit() { this.slots.forEach((x) => cw16(x._o, x.item)); } };
        }
      } else if (code3 === 'IRE' || code3 === 'IRD') {
        const N = narcAt('a/2/8/2');
        if (N && N.subs.length >= 20) {
          const slots = [];
          for (const [a, b] of N.subs) for (let o = a; o + 2 <= b; o += 2) { const v = r16(rom, o); if (v >= 1 && v <= 638) slots.push({ item: v, orig: v, _o: o }); }
          if (slots.length >= 20) game.marts = { slots, commit() { this.slots.forEach((x) => w16(rom, x._o, x.item)); } };
        }
      } else if (code3 === 'IRB' || code3 === 'IRA') {
        const OFFS = { IRB: [0x51538, 0x5153C, 0x51546, 0x5154C, 0x51564, 0x51590, 0x515E4, 0x515F2, 0x51600, 0x51610, 0x51620, 0x51630, 0x51640, 0x51650, 0x51662, 0x51674, 0x51686, 0x5169C, 0x516B2, 0x516C8, 0x516F8, 0x51714, 0x51734, 0x51774, 0x51796, 0x517BA],
          IRA: [0x51530, 0x51534, 0x5153E, 0x51544, 0x5155C, 0x51588, 0x515DC, 0x515EA, 0x515F8, 0x51608, 0x51618, 0x51628, 0x51638, 0x51648, 0x5165A, 0x5166C, 0x5167E, 0x51694, 0x516AA, 0x516C0, 0x516F0, 0x5170C, 0x5172C, 0x5176C, 0x5178E, 0x517B2] }[code3];
        const SIZES = [2, 2, 3, 4, 4, 6, 7, 7, 8, 8, 8, 8, 8, 9, 9, 9, 11, 11, 11, 11, 14, 16, 16, 17, 18, 19];
        const y9 = r32u(0x50), y9n = r32u(0x54) / 32;
        let ent = -1; for (let i = 0; i < y9n; i++) if (r32u(y9 + i * 32) === 21) ent = y9 + i * 32;
        if (ent >= 0) {
          const fid = r32u(ent + 0x18), cf = r32u(ent + 0x1C), [fs0, fe0] = fs.range(fid), comp = (cf >>> 24) & 1;
          let ov = rom.slice(fs0, fe0), ovStop = 0;
          if (comp) { const D = blzDec(ov); ov = D.dec; ovStop = D.stop; }
          const slots = [];
          OFFS.forEach((o, i) => { for (let q = 0; q < SIZES[i]; q++) { const v = ov[o + q * 2] | (ov[o + q * 2 + 1] << 8); if (v >= 1 && v <= 638) slots.push({ item: v, orig: v, _o: o + q * 2 }); } });
          // controle: de winkels moeten met gewone winkelitems beginnen (anders klopt de versie niet)
          if (slots.length >= 200 && slots.some((x) => x.orig === 4) && slots.some((x) => x.orig === 17)) {
            let dirtyOv = false;
            game.marts = { slots, commit() { this.slots.forEach((x) => { ov[x._o] = x.item & 0xFF; ov[x._o + 1] = x.item >> 8; }); dirtyOv = true; } };
            writeOverlay21 = () => {
              if (!dirtyOv) return;
              const data = comp ? blzEnc(ov, ovStop) : ov;
              placeFile(fid, data);
              U.w32(rom, ent + 0x1C, ((cf & 0xFF000000) | (comp ? data.length : 0)) >>> 0);
              w16(rom, 0x15E, crc16(rom, 0, 0x15E));
            };
          }
        }
      }
    } catch (e) { game.marts = null; }
    if (!game.marts) game.warnings.push('Poké Marts niet gevonden');

    game._fs = fs; game._narcs = narcs;
    game.finalize = () => { writeStarterText(); writeDexArea(); writeOverlay21(); writeArm9(); };
    return game;
  }

  g.NDS = {
    detect(rom) {
      if (rom.length < 0x4000) return 0;
      const c = String.fromCharCode(rom[0x0C], rom[0x0D], rom[0x0E]);
      return CODES[c] ? CODES[c][0] : 0;
    },
    load,
  };
})(typeof window !== 'undefined' ? window : globalThis);
