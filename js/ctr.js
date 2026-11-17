// Gen 6 – 3DS (Omega Ruby / Alpha Sapphire, X / Y). Alleen ontsleutelde .3ds/.cxi.
// Leest alleen de benodigde stukken van het (2+ GB) bestand en schrijft "patches"; de RomFS-hashes (IVFC)
// en de NCCH-superblock-hash worden opnieuw berekend zodat de ROM geldig blijft.
(function (g) {
  const { r16, r32, w16 } = U;
  const TYPES6 = ['Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel',
    'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark', 'Fairy'];
  const r64 = (b, o) => r32(b, o) + r32(b, o + 4) * 4294967296;
  const str = (b, o, n) => String.fromCharCode(...b.slice(o, o + n));
  const sha256 = async (u8) => new Uint8Array(await crypto.subtle.digest('SHA-256', u8));

  // reader: { size, read(off, len) -> Promise<Uint8Array> }
  async function detect(reader) {
    const h = await reader.read(0, 0x200);
    if (str(h, 0x100, 4) === 'NCSD') return 6;
    if (str(h, 0x100, 4) === 'NCCH') return 6;
    return 0;
  }

  // ---- LZ11: uitpakken en optimaal opnieuw inpakken (kleiner of gelijk aan Nintendo's eigen compressie) ----
  function lz11Dec(src) {
    if (src[0] !== 0x11) return null;
    let size = src[1] | (src[2] << 8) | (src[3] << 16), p = 4;
    if (!size) { size = U.r32(src, 4); p = 8; }
    const out = new Uint8Array(size); let o = 0;
    while (o < size) {
      const fl = src[p++];
      for (let b = 7; b >= 0 && o < size; b--) {
        if (!(fl & (1 << b))) { out[o++] = src[p++]; continue; }
        const b1 = src[p], ind = b1 >> 4; let len, disp;
        if (ind === 0) { len = (((b1 & 0xF) << 4) | (src[p + 1] >> 4)) + 0x11; disp = (((src[p + 1] & 0xF) << 8) | src[p + 2]) + 1; p += 3; }
        else if (ind === 1) { len = (((b1 & 0xF) << 12) | (src[p + 1] << 4) | (src[p + 2] >> 4)) + 0x111; disp = (((src[p + 2] & 0xF) << 8) | src[p + 3]) + 1; p += 4; }
        else { len = ind + 1; disp = (((b1 & 0xF) << 8) | src[p + 1]) + 1; p += 2; }
        for (let k = 0; k < len; k++) { out[o] = out[o - disp]; o++; }
      }
    }
    return out;
  }
  function lz11Enc(u) {
    const n = u.length, best = new Float64Array(n + 1).fill(Infinity), cl = new Int32Array(n + 1), cd = new Int32Array(n + 1);
    best[0] = 0;
    const head = new Int32Array(1 << 16).fill(-1), prev = new Int32Array(n).fill(-1);
    const key = (i) => ((u[i] << 8) ^ (u[i + 1] << 4) ^ u[i + 2]) & 0xFFFF;
    for (let i = 0; i < n; i++) {
      if (best[i] + 9 < best[i + 1]) { best[i + 1] = best[i] + 9; cl[i + 1] = 0; }
      if (i + 3 <= n) {
        let L = 0, D = 0, c = head[key(i)], tries = 0; const max = Math.min(n - i, 0x10110);
        while (c >= 0 && i - c <= 4096 && tries++ < 256) {
          let l = 0; while (l < max && u[c + l] === u[i + l]) l++;
          if (l > L) { L = l; D = i - c; if (l === max) break; }
          c = prev[c];
        }
        if (L >= 3) {
          const relax = (len) => { const cost = len <= 16 ? 17 : len <= 272 ? 25 : 33; if (best[i] + cost < best[i + len]) { best[i + len] = best[i] + cost; cl[i + len] = len; cd[i + len] = D; } };
          const top = Math.min(L, 400); for (let len = 3; len <= top; len++) relax(len); if (L > top) relax(L);
        }
        const k = key(i); prev[i] = head[k]; head[k] = i;
      }
    }
    const toks = [];
    for (let i = n; i > 0;) { const len = cl[i]; if (len) { toks.push([len, cd[i]]); i -= len; } else { toks.push([0, u[i - 1]]); i -= 1; } }
    toks.reverse();
    const out = [0x11, n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF];
    for (let t = 0; t < toks.length; t += 8) {
      const fp = out.length; out.push(0); let fl = 0;
      for (let k = 0; k < 8 && t + k < toks.length; k++) {
        const [len, v] = toks[t + k];
        if (!len) { out.push(v); continue; }
        fl |= 0x80 >> k; const d = v - 1;
        if (len <= 16) out.push(((len - 1) << 4) | (d >> 8), d & 0xFF);
        else if (len <= 272) { const l = len - 0x11; out.push(l >> 4, ((l & 0xF) << 4) | (d >> 8), d & 0xFF); }
        else { const l = len - 0x111; out.push(0x10 | (l >> 12), (l >> 4) & 0xFF, ((l & 0xF) << 4) | (d >> 8), d & 0xFF); }
      }
      out[fp] = fl;
    }
    return Uint8Array.from(out);
  }

  // Gen 6 item-nummers voor sterke trainers
  const ITEMS6 = { fullRestore: 23, hyperPotion: 25, maxPotion: 24, held: [234, 158, 157, 275, 270, 287, 268, 220, 221, 245, 247, 271, 285, 213, 236, 230] };

  async function load(reader) {
    const h = await reader.read(0, 0x200);
    const ncch = str(h, 0x100, 4) === 'NCSD' ? r32(h, 0x120) * 0x200 : 0;
    const n = await reader.read(ncch, 0x200);
    if (str(n, 0x100, 4) !== 'NCCH') throw new Error('Geen geldige 3DS-ROM (NCCH ontbreekt).');
    if (!(n[0x18F] & 4)) throw new Error('Deze 3DS-ROM is versleuteld. Gebruik een ontsleutelde (decrypted) .3ds of .cxi.');
    const product = str(n, 0x150, 16).replace(/\0.*$/, '');
    const titleId = (r32(n, 0x11C).toString(16).padStart(8, '0') + r32(n, 0x118).toString(16).padStart(8, '0')).toUpperCase();
    const romfs = ncch + r32(n, 0x1B0) * 0x200;
    const hashRegion = r32(n, 0x1B8) * 0x200;
    const iv = await reader.read(romfs, 0x60);
    if (str(iv, 0, 4) !== 'IVFC') throw new Error('RomFS niet gevonden.');
    const lv = [0, 1, 2].map((i) => ({ size: r64(iv, 0x14 + i * 0x18), bs: 1 << r32(iv, 0x1C + i * 0x18) }));
    const al = (x, a) => Math.ceil(x / a) * a;
    const l3 = romfs + al(0x60 + r32(iv, 8), lv[2].bs);
    const l1 = l3 + al(lv[2].size, lv[2].bs);
    const l2 = l1 + al(lv[0].size, lv[0].bs);

    // ---- RomFS bestandsboom ----
    const L = await reader.read(l3, 0x28);
    const dmeta = await reader.read(l3 + r32(L, 0xC), r32(L, 0x10));
    const fmeta = await reader.read(l3 + r32(L, 0x1C), r32(L, 0x20));
    const fdata = l3 + r32(L, 0x24);
    const u16s = (b, o, len) => { let s = ''; for (let i = 0; i < len; i += 2) s += String.fromCharCode(r16(b, o + i)); return s; };
    const files = {};
    const walk = (d, path, depth) => {
      if (depth > 30) return;
      for (let f = r32(dmeta, d + 12); f !== 0xFFFFFFFF; f = r32(fmeta, f + 4))
        files[path + u16s(fmeta, f + 0x20, r32(fmeta, f + 0x1C))] = { off: fdata + r64(fmeta, f + 8), size: r64(fmeta, f + 16), meta: l3 + r32(L, 0x1C) + f + 8 };
      for (let c = r32(dmeta, d + 8); c !== 0xFFFFFFFF; c = r32(dmeta, c + 4))
        walk(c, path + u16s(dmeta, c + 0x18, r32(dmeta, c + 0x14)) + '/', depth + 1);
    };
    walk(0, '', 0);

    // ---- GARC-metadata van alle archieven ----
    const garcs = [];
    for (const path of Object.keys(files).sort()) {
      const f = files[path]; if (f.size < 0x40) continue;
      const hd = await reader.read(f.off, 0x1C);
      if (str(hd, 0, 4) !== 'CRAG') continue;
      const hs = r32(hd, 4), dataOff = r32(hd, 0x10);
      const fo = await reader.read(f.off + hs, 12);
      const fatoSize = r32(fo, 4);
      const fb = await reader.read(f.off + hs + fatoSize, 12);
      const tab = await reader.read(f.off, hs + fatoSize + r32(fb, 4));
      const cnt = r16(tab, hs + 8), fatb = hs + fatoSize, subs = [];
      for (let i = 0; i < cnt; i++) {
        const o = fatb + 12 + r32(tab, hs + 12 + i * 4);
        const bits = r32(tab, o);
        subs.push(bits ? [dataOff + r32(tab, o + 4), dataOff + r32(tab, o + 8)] : [0, 0]);
      }
      garcs.push({ path, off: f.off, size: f.size, subs });
    }
    const loaded = []; // gewijzigde buffers: { off (absoluut), data }
    const loadGarc = async (G) => { if (!G.data) G.data = await reader.read(G.off, G.size); return G.data; };
    const use = (G) => { if (!loaded.some((x) => x.data === G.data)) loaded.push({ off: G.off, data: G.data, path: G.path }); };
    const prefix = async (G, i, len) => (G.subs[i] && G.subs[i][1] - G.subs[i][0] >= len ? reader.read(G.off + G.subs[i][0], len) : null);

    const TITLES = { ECL: 'Alpha Sapphire', ECR: 'Omega Ruby', EKJ: 'X', EK2: 'Y' };
    const t3 = product.slice(6, 9);
    const game = { gen: 6, platform: 'Nintendo 3DS', name: 'Pokémon ' + (TITLES[t3] ? TITLES[t3] + ' (' + product + ')' : product), warnings: [], abilityMax: 191,
      hasTmCompat: false, tms: null, starters: null, wild: [], trainers: [], typeNames: TYPES6, statNames: ['HP', 'Atk', 'Def', 'Spe', 'SpA', 'SpD'] };
    const isG7 = /^0004000000(1648|175E|1B50|1B51)00$/.test(titleId), isUSUM = /^00040000001B5[01]00$/.test(titleId);
    const maxSp = isG7 ? (isUSUM ? 807 : 802) : 721;

    // ---- Personal ----
    let P = null;
    for (const G of garcs) {
      if (G.subs.length <= maxSp) continue;
      const p = await prefix(G, 1, 8);
      if (p && p.join() === [45, 49, 49, 45, 65, 65, 11, 3].join()) { P = G; break; }
    }
    if (!P) P = garcs.find((G) => { // structureel (bv. al gerandomizede ROM): vaste entrygrootte + totaaltabel achteraan
      if (G.subs.length <= maxSp) return false;
      const es = G.subs[1][1] - G.subs[1][0], last = G.subs[G.subs.length - 1];
      return es >= 0x40 && es <= 0x60 && G.subs.slice(1, -1).every(([a, b]) => b - a === es) && last[1] - last[0] === (G.subs.length - 1) * es;
    });
    if (!P) throw new Error('Pokémon-data niet gevonden in deze 3DS-ROM (ondersteund: X/Y, Omega Ruby/Alpha Sapphire).');
    const pd = await loadGarc(P); use(P);
    const total = P.subs[P.subs.length - 1]; // laatste bestand = volledige tabel
    const ENTRY = (P.subs[1][1] - P.subs[1][0]);
    const hasTotal = total[1] - total[0] >= (maxSp + 1) * ENTRY;
    game.species = [];
    for (let s = 1; s <= maxSp; s++) {
      const o = P.subs[s][0];
      game.species.push({ id: s, dex: s, name: PKDATA.nameOf(s) || '#' + s, off: o,
        stats: [0, 1, 2, 3, 4, 5].map((k) => pd[o + k]),
        types: [TYPES6[pd[o + 6]] || 'Normal', TYPES6[pd[o + 7]] || 'Normal'],
        _origTypes: [TYPES6[pd[o + 6]] || 'Normal', TYPES6[pd[o + 7]] || 'Normal'],
        catchRate: pd[o + 8], growth: pd[o + 0x15], abilities: [pd[o + 0x18], pd[o + 0x19], pd[o + 0x1A]],
        heldItems: [r16(pd, o + 0xC), r16(pd, o + 0xE), r16(pd, o + 0x10)], baseExp: r16(pd, o + 0x22) });
    }
    game.byId = new Map(game.species.map((s) => [s.id, s]));
    game.commitSpecies = (sp) => {
      const targets = [sp.off]; if (hasTotal) targets.push(total[0] + sp.id * ENTRY);
      for (const o of targets) {
        sp.stats.forEach((v, k) => (pd[o + k] = U.clamp(v, 1, 255)));
        pd[o + 6] = TYPES6.indexOf(sp.types[0]); pd[o + 7] = TYPES6.indexOf(sp.types[1]);
        pd[o + 8] = sp.catchRate; pd[o + 0x15] = sp.growth;
        sp.abilities.forEach((a, k) => (pd[o + 0x18 + k] = a));
        sp.heldItems.forEach((it, k) => w16(pd, o + 0xC + k * 2, it));
        if (sp.baseExp !== undefined) w16(pd, o + 0x22, U.clamp(sp.baseExp, 1, 0xFFFF));
      }
    };
    game.moves = { valid: [], max: isG7 ? (isUSUM ? 728 : 719) : 621, info: () => null };
    // Gen 7: Z-aanvallen (622-658, 695-703, 719, 723-728) zijn niet aan te leren
    const isZ = (m) => (m >= 622 && m <= 658) || (m >= 695 && m <= 703) || m === 719 || m >= 723;
    for (let m = 1; m <= game.moves.max; m++) if (m !== 165 && !isZ(m)) game.moves.valid.push(m);

    // ---- Leersets ----
    game.learnsets = new Map();
    for (const G of garcs) {
      if (G.subs.length <= maxSp || G === P) continue;
      const p = await prefix(G, 1, 8);
      if (!p || p[2] !== 1 || p[3] !== 0) continue; // eerste aanval van Bulbasaur op level 1
      if (G.size > 2e6) continue;
      const d = await loadGarc(G);
      const okLs = G.subs.slice(1, 50).every(([a, b]) => b - a >= 4 && (b - a) % 4 === 0 && U.r32(d, b - 4) === 0xFFFFFFFF);
      if (!okLs) continue; use(G);
      for (let s = 1; s <= maxSp; s++) {
        const [a, b] = G.subs[s]; const entries = [];
        for (let o = a; o + 3 < b && r16(d, o) !== 0xFFFF; o += 4) entries.push({ level: r16(d, o + 2), move: r16(d, o), _off: o });
        game.learnsets.set(s, { entries, commit() { this.entries.forEach((e) => w16(d, e._off, e.move)); } });
      }
      break;
    }
    if (!game.learnsets.size) game.warnings.push('Leersets niet gevonden');

    // ---- Namen van items en aanvallen uit de (versleutelde) speltekst, voor een leesbare log ----
    const decText = (b) => {
      if (b.length < 0x10 || r16(b, 0) !== 1 || r32(b, 8) !== 0 || r32(b, 12) !== 0x10) return null;
      const lines = r16(b, 2), out = []; let key = 0x7C89;
      for (let i = 0; i < lines; i++) {
        const st = 0x10 + r32(b, 0x14 + i * 8), len = r16(b, 0x18 + i * 8);
        if (st + len * 2 > b.length) return null;
        let k = key, s = '';
        for (let j = 0; j < len; j++) { const c = r16(b, st + j * 2) ^ k; k = ((k << 3) | (k >> 13)) & 0xFFFF; if (c === 0) break; s += c === 0xE07F ? ' ' : c < 0x20 ? '' : String.fromCharCode(c); }
        out.push(s); key = (key + 0x2983) & 0xFFFF;
      }
      return out;
    };
    let textG = null;
    for (const G of garcs) {
      if ((game.itemNames && game.moveNames && game.abilityNames) || G.subs.length < 100 || G.subs.length > 400) continue;
      for (let i = 0; i < G.subs.length && !(game.itemNames && game.moveNames && game.abilityNames); i++) {
        const [s, e] = G.subs[i]; if (e - s < 0x20 || e - s > 60000) continue;
        const t = decText(await reader.read(G.off + s, e - s)); if (!t || t.length < 150) continue;
        if (!game.moveNames && t[1] === 'Pound' && t[2] === 'Karate Chop') { game.moveNames = t; textG = G; }
        if (!game.itemNames && t[1] === 'Master Ball' && t[3] === 'Great Ball') game.itemNames = t;
        if (!game.abilityNames && t[1] === 'Stench' && t[2] === 'Drizzle') game.abilityNames = t;
      }
    }

    // ---- Starterkeuze-tekst "The Grass-type Pokémon" enz.: herschrijven met de types van de nieuwe starters ----
    // (zelfde aantal tekens, zodat het bestand even groot blijft; Engelse tekst)
    let starterTypeLabel = null;
    if (textG) for (let i = 0; i < textG.subs.length && !starterTypeLabel; i++) {
      const [a, b] = textG.subs[i]; if (b - a < 0x20 || b - a > 4000) continue;
      const t = decText(await reader.read(textG.off + a, b - a));
      if (!t || t.length < 4 || !/^The Grass-type Pok/.test(t[1]) || !/^The Fire-type Pok/.test(t[2]) || !/^The Water-type Pok/.test(t[3])) continue;
      const d = await loadGarc(textG); use(textG);
      starterTypeLabel = (typesPerStarter) => {
        typesPerStarter.forEach((ty, n) => {
          const li = n + 1, st = a + 0x10 + r32(d, a + 0x14 + li * 8), len = r16(d, a + 0x18 + li * 8);
          const key0 = (0x7C89 + li * 0x2983) & 0xFFFF;
          let k = key0; const ch = [];
          for (let j = 0; j < len; j++) { ch.push(r16(d, st + j * 2) ^ k); k = ((k << 3) | (k >> 13)) & 0xFFFF; }
          const str = String.fromCharCode(...ch), from = str.indexOf('The '), to = str.indexOf('Pokémon', from) + 7;
          if (from < 0 || to < 7) return;
          const segLen = to - from, T = ty[0] === ty[1] ? ty[0] : ty[0] + '/' + ty[1];
          let txt = ['The ' + T + '-type Pokémon', T + '-type Pokémon', T + ' Pokémon', T].find((x) => x.length <= segLen) || T.slice(0, segLen);
          txt = txt.padEnd(segLen, ' ');
          for (let j = 0; j < segLen; j++) ch[from + j] = txt.charCodeAt(j);
          k = key0;
          for (let j = 0; j < len; j++) { w16(d, st + j * 2, ch[j] ^ k); k = ((k << 3) | (k >> 13)) & 0xFFFF; }
        });
      };
    }

    // ---- Aanvaldata ("WD"-pakket: per aanval type @0, categorie @2, kracht @3) voor STAB / eerste aanval ----
    for (const G of garcs) {
      if (G.subs.length !== 1 || G.size > 200000) continue;
      const h = await prefix(G, 0, 4); if (!h || h[0] !== 0x57 || h[1] !== 0x44 || r16(h, 2) < 500) continue;
      const d = await loadGarc(G), b = G.subs[0][0], n = r16(d, b + 2);
      const off = (m) => b + r32(d, b + 4 + m * 4);
      if (d[off(1) + 3] !== 40 || d[off(1) + 0] !== 0) continue; // Pound: Normal, kracht 40
      game.moves.info = (m) => (m >= 1 && m < n ? { power: d[off(m) + 3], type: TYPES6[d[off(m)]] || 'Normal' } : null);
      break;
    }

    // ---- Itemprijzen (item-data): prijs 0 = key item / Mega Stone / uniek -> nooit verplaatsen of uitdelen ----
    for (const G of garcs) {
      if (game.itemPrice || G.subs.length < 600 || G.subs.length > 1200 || G.size > 100000) continue;
      const es = G.subs[17][1] - G.subs[17][0]; if (es < 16 || es > 64) continue;
      const d = await loadGarc(G); const pr = (i) => (G.subs[i] ? r16(d, G.subs[i][0]) : 0);
      if (pr(17) === 30 && pr(4) === 20 && pr(1) === 0) game.itemPrice = pr;
    }

    // ---- Daycare-eieren: tabel "welke baby komt uit deze soort" (ORAS a/1/9/6: per soort u16 + 0xFFFF) ----
    game.eggs = null;
    for (const G of garcs) {
      if (G.subs.length < maxSp + 1 || G.subs.length > maxSp + 10 || G.size > 20000) continue;
      if (!G.subs.slice(1, maxSp + 1).every(([s, e]) => e - s === 4)) continue;
      const d = await loadGarc(G);
      const v = (i) => r16(d, G.subs[i][0]);
      if (v(3) !== 1 || v(6) !== 4 || v(1) !== 1) continue; // Venusaur -> Bulbasaur, Charizard -> Charmander
      use(G);
      const entries = [];
      for (let s = 1; s <= maxSp; s++) entries.push({ species: s, baby: v(s), orig: v(s), _o: G.subs[s][0] });
      game.eggs = { entries, commit() { this.entries.forEach((e) => w16(d, e._o, e.baby)); } };
      break;
    }

    game.tmItems = []; for (let i = 328; i <= 419; i++) game.tmItems.push(i); game.tmItems.push(618, 619, 620, 690, 691, 692, 693, 694);

    // ---- Evoluties: per soort 8 x (methode u16, parameter u16, doel u16) ----
    game.evos = null;
    for (const G of garcs) {
      if (G.subs.length <= maxSp || G.size > 200000) continue;
      const p = await prefix(G, 1, 8);
      if (p && p.join() === [4, 0, 0, 0, 2, 0, 0xFF, 16].join()) { // Gen 7: 8 x (methode, parameter, doel, vorm, level)
        const d = await loadGarc(G); use(G);
        game.evos = { methods: { trade: [5], tradeItem: [6], tradeSpecies: [7], level: 4, heldDay: 19, heldNight: 20 }, list: [] };
        for (let s = 1; s <= maxSp; s++) {
          const base = G.subs[s][0], ent = [];
          for (let k = 0; k < 8; k++) { const o = base + k * 8, m = r16(d, o), arg = r16(d, o + 2); ent.push({ method: m, param: m === 4 ? d[o + 7] : arg, target: r16(d, o + 4), _o: o }); }
          game.evos.list.push({ species: s, ent, commit() { this.ent.forEach((e) => { w16(d, e._o, e.method); w16(d, e._o + 4, e.target); if (e.method === 4) { w16(d, e._o + 2, 0); d[e._o + 7] = U.clamp(e.param, 0, 100); } else w16(d, e._o + 2, e.param); }); } });
        }
        break;
      }
      if (!p || p.slice(0, 6).join() !== [4, 0, 16, 0, 2, 0].join()) continue;
      const es = G.subs[1][1] - G.subs[1][0]; if (es % 6 && es % 6 !== 2) continue;
      const d = await loadGarc(G); use(G);
      const slots = Math.floor(es / 6);
      game.evos = { methods: { trade: [5], tradeItem: [6], tradeSpecies: [7], level: 4, heldDay: 19, heldNight: 20 }, list: [] };
      for (let s = 1; s <= maxSp; s++) {
        const base = G.subs[s][0], ent = [];
        for (let k = 0; k < slots; k++) ent.push({ method: r16(d, base + k * 6), param: r16(d, base + k * 6 + 2), target: r16(d, base + k * 6 + 4) });
        game.evos.list.push({ species: s, ent, commit() { this.ent.forEach((e, k) => { w16(d, base + k * 6, e.method); w16(d, base + k * 6 + 2, e.param); w16(d, base + k * 6 + 4, e.target); }); } });
      }
      break;
    }

    // ---- Trainers: trdata (vaste grootte) + trpoke, zelfde aantal bestanden ----
    const big = garcs.filter((G) => G.subs.length >= 500 && G.size < 4e6);
    let pair = null;
    for (const A of big) {
      const sz = A.subs[1][1] - A.subs[1][0];
      if (sz < 16 || sz > 40 || !A.subs.slice(1).every(([s, e]) => e - s === sz)) continue;
      for (const B of big) {
        if (B === A || B.subs.length !== A.subs.length) continue;
        const ad = await loadGarc(A), bd = await loadGarc(B);
        for (let pos = 0; pos < sz && !pair; pos++) {
          let good = 0, tot = 0;
          for (let t = 1; t < A.subs.length; t++) {
            const c = ad[A.subs[t][0] + pos], len = B.subs[t][1] - B.subs[t][0];
            if (!len) continue; tot++;
            if (c < 1 || c > 6 || len % c) continue;
            const es = len / c; if (![8, 10, 16, 18].includes(es)) continue;
            const sp = r16(bd, B.subs[t][0] + 4) & 0x7FF;
            if (sp >= 1 && sp <= maxSp) good++;
          }
          if (tot > 300 && good > tot * 0.95) pair = { A, B, pos };
        }
        if (pair) break;
      }
      if (pair) break;
    }
    if (pair) {
      const { A, B, pos } = pair; const ad = A.data, bd = B.data; use(B); use(A);
      const tsz = A.subs[1][1] - A.subs[1][0], bagOff = tsz >= 24 ? 8 : 4, aiOff = tsz >= 24 ? 16 : 12;
      for (let t = 1; t < A.subs.length; t++) {
        const c = ad[A.subs[t][0] + pos]; const [ps, pe] = B.subs[t];
        if (!c || c > 6 || (pe - ps) % c) continue;
        const es = (pe - ps) / c; if (![8, 10, 16, 18].includes(es)) continue;
        const mvOff = 8 + (es % 8 === 2 ? 2 : 0), hasMoves = es >= 16;
        const mons = [];
        for (let m = 0; m < c; m++) {
          const b = ps + m * es;
          mons.push({ species: r16(bd, b + 4) & 0x7FF, level: bd[b + 2], _b: b, iv: bd[b], item: es % 8 === 2 ? r16(bd, b + 8) : null,
            moves: hasMoves ? [0, 1, 2, 3].map((q) => r16(bd, b + mvOff + q * 2)) : null });
        }
        if (mons.some((m) => m.species < 1 || m.species > maxSp)) continue;
        const ta = A.subs[t][0], bag = [0, 1, 2, 3].map((q) => r16(ad, ta + bagOff + q * 2));
        game.trainers.push({ label: 'Trainer ' + t, mons, bag, ai: ad[ta + aiOff], important: bag.some((x) => x), itemIds: ITEMS6, commit() {
          this.bag.forEach((v, q) => w16(ad, ta + bagOff + q * 2, v)); ad[ta + aiOff] = this.ai;
          this.mons.forEach((m) => {
            bd[m._b] = m.iv; if (m.item !== null) w16(bd, m._b + 8, m.item);
            w16(bd, m._b + 4, m.species); w16(bd, m._b + 6, 0); bd[m._b + 2] = U.clamp(m.level, 1, 100);
            if (m.moves) m.moves.forEach((v, q) => w16(bd, m._b + mvOff + q * 2, v));
          }); } });
      }
    } else if (isG7) {
      // Sun/Moon/USUM: trdata a/1/0/5 (20 bytes: aantal @3, tas @4, AI @0xC) + trpoke a/1/0/6 (32 bytes per Pokémon)
      // zoek twee opeenvolgende archieven: trdata (alle bestanden 20 bytes) + trpoke (veelvoud van 32 bytes)
      let A = null, B = null;
      for (let gi = 0; gi + 1 < garcs.length && !A; gi++) {
        const X = garcs[gi], Y = garcs[gi + 1];
        if (X.subs.length < 300 || X.subs.length !== Y.subs.length) continue;
        if (!X.subs.slice(1, 50).every(([q, w]) => w - q === 20)) continue;
        if (!Y.subs.slice(1, 50).every(([q, w]) => (w - q) % 32 === 0 && w > q)) continue;
        A = X; B = Y;
      }
      if (A && B && A.subs.length === B.subs.length) {
        const ad = await loadGarc(A), bd = await loadGarc(B); use(A); use(B);
        for (let t = 1; t < A.subs.length; t++) {
          const ta = A.subs[t][0], [ps, pe] = B.subs[t], c = ad[ta + 3];
          if (!c || c > 6 || pe - ps < c * 32) continue;
          const mons = [];
          for (let m = 0; m < c; m++) {
            const b = ps + m * 32;
            mons.push({ species: r16(bd, b + 0x10), level: r16(bd, b + 0xE), _b: b, iv: (r32(bd, b + 8) & 0x1F) * 8, item: r16(bd, b + 0x14), moves: [0, 1, 2, 3].map((q) => r16(bd, b + 0x18 + q * 2)) });
          }
          if (mons.some((m) => m.species < 1 || m.species > maxSp)) continue;
          const bag = [0, 1, 2, 3].map((q) => r16(ad, ta + 4 + q * 2));
          game.trainers.push({ label: 'Trainer ' + t, mons, bag, ai: ad[ta + 0xC], important: bag.some((x) => x), itemIds: ITEMS6, commit() {
            this.bag.forEach((v, q) => w16(ad, ta + 4 + q * 2, v)); ad[ta + 0xC] = this.ai;
            this.mons.forEach((m) => {
              const iv = Math.min(31, m.iv >> 3), old = r32(bd, m._b + 8);
              U.w32(bd, m._b + 8, ((old & 0xC0000000) | iv | (iv << 5) | (iv << 10) | (iv << 15) | (iv << 20) | (iv << 25)) >>> 0);
              w16(bd, m._b + 0x10, m.species); w16(bd, m._b + 0x12, 0); w16(bd, m._b + 0xE, U.clamp(m.level, 1, 100));
              if (m.item !== null) w16(bd, m._b + 0x14, m.item);
              m.moves.forEach((v, q) => w16(bd, m._b + 0x18 + q * 2, v));
            }); } });
        }
      }
      if (!game.trainers.length) game.warnings.push('Trainerdata niet gevonden');
    } else game.warnings.push('Trainerdata niet gevonden');

    // ---- Wilde Pokémon (ORAS: zone-bestanden + "EN"-kopie achteraan in het zone-archief) ----
    let zoneFix = null;
    for (const G of garcs) {
      const last = G.subs.length - 1; if (last < 1) continue;
      const p = await prefix(G, last, 4);
      if (!p || p[0] !== 0x45 || p[1] !== 0x4E || r16(p, 2) !== last - 1 && r16(p, 2) !== last) continue;
      const [zs, ze] = G.subs[last];
      const gd = await loadGarc(G); const zd = gd.subarray(zs, ze); use(G);
      const zones = r16(zd, 2);
      // Het spel leest de encounters uit de (LZ11-gecomprimeerde) zone-bestanden zelf; het EN-bestand is een kopie.
      const zoneU = new Map(), dirty = new Set();
      const dataOff = r32(gd, 0x10), hs = r32(gd, 4), fatb = hs + r32(gd, hs + 4);
      const fatEntry = (i) => fatb + 12 + r32(gd, hs + 12 + i * 4);
      for (let z = 0; z < zones && z < last; z++) {
        const s = r32(zd, 4 + z * 4), e = z + 1 < zones ? r32(zd, 8 + z * 4) : zd.length;
        if (e <= s) continue;
        const [a, b] = G.subs[z]; const raw = gd.subarray(a, b);
        const comp = raw[0] === 0x11; const u = comp ? lz11Dec(raw) : raw.slice();
        if (!u || r16(u, 0) !== 0x4F5A) continue;
        const o3 = r32(u, 4 + 3 * 4), o4 = r32(u, 4 + 4 * 4);
        if (o4 - o3 !== e - s || !u.subarray(o3, o4).every((v, k) => v === zd[s + k])) continue;
        zoneU.set(z, { u, o3, enStart: s, comp, slot: [a, b] });
      }
      zoneFix = async () => {
        if (!dirty.size) return;
        // Hele zone-archief opnieuw opbouwen (zelfde totale grootte): bestanden achter elkaar, uitgelijnd op 4 bytes
        const n = G.subs.length, region = G.size - dataOff, al4 = (x) => (x + 3) & ~3;
        const entry = (i) => { const fe = fatEntry(i); return { fe, start: r32(gd, fe + 4), len: r32(gd, fe + 12) }; };
        const blobs = [];
        for (let i = 0; i < n; i++) {
          const E = entry(i);
          if (dirty.has(i)) { const Zn = zoneU.get(i); blobs.push(Zn.comp ? lz11Enc(Zn.u) : Zn.u.slice()); }
          else blobs.push(gd.slice(dataOff + E.start, dataOff + E.start + E.len));
        }
        const total = () => blobs.reduce((a, b) => a + al4(b.length), 0);
        if (total() > region) { // ruimte maken: ongewijzigde zones strakker comprimeren
          for (let i = 0; i < n && total() > region; i++) {
            if (dirty.has(i) || blobs[i][0] !== 0x11) continue;
            const u = lz11Dec(blobs[i]); if (!u) continue;
            const c = lz11Enc(u); if (c.length < blobs[i].length) blobs[i] = c;
          }
        }
        // laatste redmiddel: grootste gewijzigde zones terug naar het origineel
        const order = [...dirty].sort((a, b) => blobs[b].length - blobs[a].length);
        while (total() > region && order.length) {
          const z = order.shift(), E = entry(z), Zn = zoneU.get(z);
          blobs[z] = gd.slice(dataOff + E.start, dataOff + E.start + E.len);
          const orig = Zn.comp ? lz11Dec(blobs[z]) : blobs[z];
          zd.set(orig.subarray(Zn.o3, Zn.o3 + 260), Zn.enStart);
          game.warnings.push('Zone ' + z + ' kon niet aangepast worden (geen ruimte) en is origineel gebleven');
        }
        if (total() > region) throw new Error('Het zone-archief past niet meer in de ROM.');
        // het EN-bestand (laatste) opnieuw nemen, want het kan net aangepast zijn
        { const E = entry(n - 1); blobs[n - 1] = zd.slice(0, E.len); }
        let pos = 0, largest = r32(gd, 0x18);
        const out = new Uint8Array(region);
        for (let i = 0; i < n; i++) {
          const b = blobs[i], fe = fatEntry(i);
          out.set(b, pos);
          U.w32(gd, fe + 4, pos); U.w32(gd, fe + 8, pos + al4(b.length)); U.w32(gd, fe + 12, b.length);
          largest = Math.max(largest, al4(b.length));
          pos += al4(b.length);
        }
        gd.set(out, dataOff); U.w32(gd, 0x18, largest);
      };
      const isSlot = (o) => { const sp = r16(zd, o) & 0x7FF, mn = zd[o + 2], mx = zd[o + 3]; return sp >= 1 && sp <= maxSp && mn >= 1 && mn <= 100 && mx >= mn && mx <= 100; };
      const isEmpty = (o) => r16(zd, o) === 0 && zd[o + 2] === 1 && zd[o + 3] === 1;
      let align = 0, bestCnt = -1;
      for (let a = 0; a < 4; a++) { let c = 0; for (let o = 4 + zones * 4 + a; o + 4 <= zd.length; o += 4) if (isSlot(o)) c++; if (c > bestCnt) { bestCnt = c; align = a; } }
      for (let z = 0; z < zones; z++) {
        const s = r32(zd, 4 + z * 4), e = z + 1 < zones ? r32(zd, 8 + z * 4) : zd.length;
        if (e <= s || e > zd.length) continue;
        const slots = [];
        let o = s + ((align - s) % 4 + 4) % 4, run = [];
        const flush = () => { if (run.length >= 3) slots.push(...run); run = []; };
        for (; o + 4 <= e; o += 4) {
          if (isSlot(o)) run.push(o); else if (!isEmpty(o)) flush();
        }
        flush();
        if (!slots.length) continue;
        game.wild.push({ label: 'Zone ' + z, slots: slots.map((q) => ({ species: r16(zd, q) & 0x7FF, min: zd[q + 2], max: zd[q + 3], _o: q })),
          commit() {
            const Zn = zoneU.get(z);
            this.slots.forEach((x) => {
              w16(zd, x._o, x.species); zd[x._o + 2] = U.clamp(x.min, 1, 100); zd[x._o + 3] = U.clamp(Math.max(x.min, x.max), 1, 100);
              if (Zn) Zn.u.set(zd.subarray(x._o, x._o + 4), Zn.o3 + (x._o - Zn.enStart));
            });
            if (Zn) dirty.add(z);
          } });
      }
      break;
    }
    // ---- Wilde Pokémon (X/Y): in elk LZ11-zonebestand "ZO" is sectie 3 (0x188 bytes) de encountertabel:
    //      0x10 bytes kansen + 94 slots (12x gras, 3x12 bloemen, 12x hoog gras, 5 surf, 5 rock smash, 3x3 hengels, 15 hordes)
    if (!game.wild.length) for (const G of garcs) {
      if (G.subs.length < 100 || G.size > 8e6) continue;
      const p0 = await prefix(G, 0, 8); if (!p0 || p0[0] !== 0x11) continue;
      const gd = await loadGarc(G);
      const zoneU = new Map();
      for (let z = 0; z < G.subs.length; z++) {
        const [a, b] = G.subs[z]; const raw = gd.subarray(a, b); if (raw[0] !== 0x11) continue;
        const u = lz11Dec(raw); if (!u || r16(u, 0) !== 0x4F5A || r16(u, 2) !== 4) continue;
        const o3 = r32(u, 4 + 3 * 4), o4 = r32(u, 4 + 4 * 4);
        if (o4 - o3 !== 0x188 || o4 !== u.length) continue;
        zoneU.set(z, { u, o3 });
      }
      if (zoneU.size < 50) continue;
      use(G);
      const dirty = new Set(), dataOff = r32(gd, 0x10), hs = r32(gd, 4), fatb = hs + r32(gd, hs + 4);
      const fatEntry = (i) => fatb + 12 + r32(gd, hs + 12 + i * 4);
      for (const [z, Zn] of zoneU) {
        const u = Zn.u, base = Zn.o3 + 0x10, slots = [];
        for (let k = 0; k < 94; k++) {
          const o = base + k * 4, sp = r16(u, o) & 0x7FF, mn = u[o + 2], mx = u[o + 3];
          if (sp >= 1 && sp <= maxSp && mn >= 1 && mx >= mn && mx <= 100) slots.push({ species: sp, min: mn, max: mx, _o: o });
        }
        if (!slots.length) continue;
        game.wild.push({ label: 'Zone ' + z, slots, commit() {
          this.slots.forEach((x) => { w16(u, x._o, x.species); u[x._o + 2] = U.clamp(x.min, 1, 100); u[x._o + 3] = U.clamp(Math.max(x.min, x.max), 1, 100); });
          dirty.add(z);
        } });
      }
      zoneFix = async () => {
        if (!dirty.size) return;
        const n = G.subs.length, region = G.size - dataOff, al4 = (x) => (x + 3) & ~3;
        const entry = (i) => { const fe = fatEntry(i); return { fe, start: r32(gd, fe + 4), len: r32(gd, fe + 12) }; };
        const blobs = [];
        for (let i = 0; i < n; i++) { const E = entry(i); blobs.push(dirty.has(i) ? lz11Enc(zoneU.get(i).u) : gd.slice(dataOff + E.start, dataOff + E.start + E.len)); }
        const total = () => blobs.reduce((a, b) => a + al4(b.length), 0);
        for (let i = 0; i < n && total() > region; i++) {
          if (dirty.has(i) || blobs[i][0] !== 0x11) continue;
          const u = lz11Dec(blobs[i]); if (!u) continue; const c = lz11Enc(u); if (c.length < blobs[i].length) blobs[i] = c;
        }
        const order = [...dirty].sort((a, b) => blobs[b].length - blobs[a].length);
        while (total() > region && order.length) {
          const z = order.shift(), E = entry(z); blobs[z] = gd.slice(dataOff + E.start, dataOff + E.start + E.len);
          game.warnings.push('Zone ' + z + ' kon niet aangepast worden (geen ruimte) en is origineel gebleven');
        }
        if (total() > region) throw new Error('Het zone-archief past niet meer in de ROM.');
        let pos = 0, largest = r32(gd, 0x18); const out = new Uint8Array(region);
        for (let i = 0; i < n; i++) {
          const b = blobs[i], fe = fatEntry(i); out.set(b, pos);
          U.w32(gd, fe + 4, pos); U.w32(gd, fe + 8, pos + al4(b.length)); U.w32(gd, fe + 12, b.length);
          largest = Math.max(largest, al4(b.length)); pos += al4(b.length);
        }
        gd.set(out, dataOff); U.w32(gd, 0x18, largest);
      };
      break;
    }
    // ---- Wilde Pokémon (Sun/Moon/USUM): wereld-archief, per gebied 11 bestanden; nr. 9 = "EA" (LZ11) met tabellen van 0x180 bytes:
    //      u32 id, min-level, max-level, 10 kansen, dan 9 sets x 10 slots (soort u16 | vorm<<11, u16) — set 0 = normaal, 1-8 = SOS/weer
    const partial = []; // kleine stukjes binnen grote bestanden: { off, data, path, fileOff }
    let worldFix = null;
    if (!game.wild.length && isG7) {
      let G = null;
      for (const X of garcs.filter((x) => x.subs.length > 500 && x.subs.length % 11 === 0)) {
        const [q0, q1] = X.subs[9]; if (q1 <= q0 || q1 - q0 > 1e6) continue;
        const raw = await reader.read(X.off + q0, q1 - q0); const u = raw[0] === 0x11 ? lz11Dec(raw) : raw;
        if (u && str(u, 0, 2) === 'EA') { G = X; break; }
      }
      if (G) {
        const hd = await reader.read(G.off, 0x1C), hs = r32(hd, 4), dataOff = r32(hd, 0x10);
        const fo = await reader.read(G.off + hs, 12), fatoSize = r32(fo, 4);
        const fb = await reader.read(G.off + hs + fatoSize, 12);
        const tab = await reader.read(G.off, hs + fatoSize + r32(fb, 4)); const fatb = hs + fatoSize;
        const entOf = (i) => fatb + 12 + r32(tab, hs + 12 + i * 4);
        const dirty = new Map();
        for (let i = 9; i < G.subs.length; i += 11) {
          const e = entOf(i); if (!r32(tab, e)) continue;
          const start = r32(tab, e + 4), end = r32(tab, e + 8), len = r32(tab, e + 12);
          const raw = await reader.read(G.off + dataOff + start, len);
          const u = raw[0] === 0x11 ? lz11Dec(raw) : raw; if (!u || str(u, 0, 2) !== 'EA') continue;
          const n = r16(u, 2); const area = { i, start, end, e, u, comp: raw[0] === 0x11 };
          for (let k = 0; k < n; k++) {
            const a0 = r32(u, 4 + k * 4), a1 = r32(u, 8 + k * 4);
            for (let t = a0; t + 0x180 <= a1; t += 0x180) {
              const mn = u[t + 4], mx = u[t + 5]; if (!mn || mx < mn) continue;
              const slots = [];
              for (let q = 0; q < 90; q++) {
                const o = t + 0x10 + q * 4, sp = r16(u, o) & 0x7FF;
                if (sp < 1 || sp > maxSp) continue;
                slots.push({ species: sp, min: mn, max: mx, _o: o, _t: t, _orig: sp });
              }
              if (!slots.length) continue;
              const W = { label: 'Gebied ' + ((i - 9) / 11) + '-' + k, slots, commit() {
                this.slots.forEach((x, j) => { w16(u, x._o, x.species); if (j === 0) { u[x._t + 4] = U.clamp(x.min, 1, 100); u[x._t + 5] = U.clamp(Math.max(x.min, x.max), 1, 100); } });
                dirty.set(i, area);
              } };
              (area.tables = area.tables || []).push(W); game.wild.push(W);
            }
          }
        }
        worldFix = async () => {
          // Ruimte: het EA-bestand + zijn buren (ZS, ZI ervoor, BG erna) liggen achter elkaar; de buren worden strakker
          // gecomprimeerd (optimale LZ11) en alles wordt opnieuw achter elkaar gelegd binnen hetzelfde stuk.
          const al4 = (x) => (x + 3) & ~3;
          const group = async (A, wide) => {
            const idx = (wide ? [-9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1] : [-2, -1, 0, 1]).map((d) => A.i + d).filter((j) => j >= 0 && j < G.subs.length && r32(tab, entOf(j)));
            const ents = idx.map((j) => { const e = entOf(j); return { j, e, start: r32(tab, e + 4), end: r32(tab, e + 8), len: r32(tab, e + 12) }; });
            for (let q = 1; q < ents.length; q++) if (ents[q].start !== ents[q - 1].end) return null;
            for (const E of ents) if (E.j !== A.i) {
              E.blob = await reader.read(G.off + dataOff + E.start, E.len);
              // kleine buren altijd strakker comprimeren; grote (bij 'wide') alleen tot er genoeg ruimte is
              if (E.blob[0] === 0x11 && E.len < 200000) { const d = lz11Dec(E.blob); if (d) { const c2 = lz11Enc(d); if (c2.length < E.blob.length) E.blob = c2; } }
            }
            return { ents, start: ents[0].start, end: ents[ents.length - 1].end };
          };
          const place = (Gr, A, c, dry) => {
            let total = 0; for (const E of Gr.ents) total += al4(E.j === A.i ? c.length : E.blob.length);
            if (total > Gr.end - Gr.start) return false;
            if (dry) return true;
            const blob = new Uint8Array(Gr.end - Gr.start); let pos = 0;
            for (const E of Gr.ents) {
              const b = E.j === A.i ? c : E.blob; blob.set(b, pos);
              const ent = new Uint8Array(12); U.w32(ent, 0, pos + Gr.start); U.w32(ent, 4, pos + Gr.start + al4(b.length)); U.w32(ent, 8, b.length);
              partial.push({ off: G.off + E.e + 4, data: ent, path: G.path, fileOff: E.e + 4 });
              pos += al4(b.length);
            }
            partial.push({ off: G.off + dataOff + Gr.start, data: blob, path: G.path, fileOff: dataOff + Gr.start });
            return true;
          };
          let perArea = 0;
          for (const A of dirty.values()) {
            const Gr = await group(A);
            let c = A.comp ? lz11Enc(A.u) : A.u;
            if (Gr && place(Gr, A, c)) continue;
            // (grote buren opnieuw inpakken is te traag, dus: per gebied vervangen)
            // past niet (willekeurige slots comprimeren slechter): per gebied dezelfde vervanging voor elke originele soort
            const map = new Map();
            for (const W of A.tables) for (const x of W.slots) { if (!map.has(x._orig)) map.set(x._orig, x.species); x.species = map.get(x._orig); w16(A.u, x._o, x.species); }
            c = A.comp ? lz11Enc(A.u) : A.u; perArea++;
            if (Gr && place(Gr, A, c)) continue;
            // laatste redmiddel: origineel laten
            for (const W of A.tables) for (const x of W.slots) x.species = x._orig;
            game.warnings.push('Gebied ' + ((A.i - 9) / 11) + ' kon niet aangepast worden (geen ruimte) en is origineel gebleven');
          }
          if (perArea) game.warnings.push(perArea + ' gebieden: elke soort is daar overal door dezelfde willekeurige soort vervangen (anders past het niet in de ROM; de log kan daar afwijken)');
        };
      }
    }
    if (!game.wild.length) game.warnings.push('Wilde Pokémon niet gevonden in deze 3DS-game');
    let pendingStarterOrig = null, pendingStarterNew = null;
    // ---- Starters: gift-tabel in een .cro (ORAS: DllField.cro, 36-byte entries, level op +5) ----
    // .cro-bestanden zijn beveiligd met een eigen hashtabel (4x SHA-256) + een hash in .crr/static.crr.
    const fixups = [];
    const loadPlain = async (path) => { const f = files[path]; const G = { path, off: f.off, size: f.size }; G.data = await reader.read(f.off, f.size); return G; };
    const crrPath = Object.keys(files).find((p) => /\.crr$/i.test(p));
    const croPaths = Object.keys(files).filter((p) => /\.cro$/i.test(p)).sort((a, b) => (/DllField/i.test(b) ? 1 : 0) - (/DllField/i.test(a) ? 1 : 0));
    for (const path of croPaths) {
      if (!crrPath || files[path].size < 0x200) continue;
      const head = await reader.read(files[path].off, 0x84);
      if (str(head, 0x80, 4) !== 'CRO0') continue;
      const C = await loadPlain(path); const c = C.data;
      let hit = -1, stride = 0;
      for (const first of [252, 650]) {
        for (let o = 0x180; o + 0x100 < c.length && hit < 0; o += 4) {
          if (r16(c, o) !== first) continue;
          for (const d of [36, 32, 40, 24, 28, 44, 48]) {
            if (r16(c, o + d) === first + 3 && r16(c, o + 2 * d) === first + 6 && c[o + 5] === 5 && c[o + d + 5] === 5 && c[o + 2 * d + 5] === 5) { hit = o; stride = d; break; }
          }
        }
        if (hit >= 0) break;
      }
      // Al gerandomizede ORAS-ROM: vaste plek in DllField.cro
      // Al gerandomizede ROM: vaste plek in DllField.cro (ORAS 0xF906C/36, X/Y 0xF805C/24)
      if (hit < 0 && /DllField\.cro$/i.test(path)) for (const [fo, fd] of [[0xF906C, 36], [0xF805C, 24]]) {
        if (hit < 0 && c.length > fo + 3 * fd && [0, 1, 2].every((i) => { const s = r16(c, fo + i * fd); return s >= 1 && s <= maxSp && c[fo + i * fd + 5] === 5; })) { hit = fo; stride = fd; }
      }
      if (hit < 0) continue;
      const R = await loadPlain(crrPath); const crr = R.data;
      use(C); use(R);
      const listOff = r32(crr, 0x350), listCnt = r32(crr, 0x354);
      const offs = [0, 1, 2].map((i) => hit + i * stride);
      const orig = offs.map((o) => r16(c, o));
      const changedCros = [c];

      // Keuzescherm (tas van Prof. Birch): aparte tabel in de data van DllPoke3Select.cro (u32 soort per entry)
      let selOffs = null, sel = null;
      for (const sp of croPaths.filter((p) => /Select/i.test(p))) {
        const S = await loadPlain(sp); const s = S.data;
        if (str(s, 0x80, 4) !== 'CRO0') continue;
        const ds = r32(s, 0xB8), de = ds + r32(s, 0xBC);
        for (let o = ds; o + 12 <= de && !selOffs; o += 4) {
          if (r32(s, o) !== orig[0]) continue;
          for (let d = 4; d <= 0x100 && o + 2 * d + 4 <= de; d += 4)
            if (r32(s, o + d) === orig[1] && r32(s, o + 2 * d) === orig[2]) { selOffs = [o, o + d, o + 2 * d]; break; }
        }
        if (selOffs) { sel = s; use(S); changedCros.push(s); break; }
      }
      if (!selOffs) game.warnings.push('Starter-keuzescherm niet gevonden: je krijgt de nieuwe starter, maar het scherm toont mogelijk de oude');

      // Overige gift-Pokémon (na de 3 starters, zelfde tabel)
      game.statics = [];
      for (let i = 3; i < 80; i++) {
        const e = hit + i * stride, s = r16(c, e);
        if (s < 1 || s > maxSp || c[e + 5] < 1 || c[e + 5] > 100 || c[e + 9] || c[e + 10] || c[e + 11]) break;
        game.statics.push({ kind: 'gift', label: 'Gift #' + i, species: s, level: c[e + 5], commit() { w16(c, e, this.species); c[e + 4] = 0; } });
      }
      // Static encounters (legendaries, Birch's Poochyena, Voltorb, Kecleon...): 12-byte entries, level op +3
      const stOk = (e) => { const s = r16(c, e), it = r16(c, e + 4); return s >= 1 && s <= maxSp && c[e + 3] >= 1 && c[e + 3] <= 100 && c[e + 2] <= 31 && (it === 0xFFFF || it < 1000); };
      let stBest = null;
      for (let o = 0x180; o + 12 * 20 < c.length; o += 4) {
        if (!stOk(o)) continue;
        let k = 0; while (stOk(o + k * 12)) k++;
        const div = new Set(); for (let q = 0; q < k; q++) div.add(r16(c, o + q * 12));
        const lv = new Set(); for (let q = 0; q < k; q++) lv.add(c[o + q * 12 + 3]);
        // echte tabel: veel verschillende soorten (geen reeks 'Blaziken lv1..32' uit een andere tabel)
        if (k >= 10 && div.size >= Math.max(6, k / 3) && lv.size >= 3 && (!stBest || k > stBest.n)) stBest = { o, n: k };
        o += Math.max(0, (k - 1) * 12 - 4) & ~3;
      }
      if (stBest) for (let i = 0; i < stBest.n; i++) {
        const e = stBest.o + i * 12;
        game.statics.push({ kind: 'static', label: 'Static #' + i, species: r16(c, e), level: c[e + 3], story: (/^0004000000055[DE]00$/.test(titleId) ? [716, 717] : [382, 383, 384, 386]).includes(r16(c, e)), commit() { w16(c, e, this.species); c[e + 2] = 0; } });
      }
      else game.warnings.push('Static encounters niet gevonden');

      // Tabel in de programmacode (nummer 1..6 -> soort) die o.a. gebruikt wordt voor de naam van je starter in teksten/cutscenes
      pendingStarterOrig = orig.slice();
      game.starters = { species: orig.slice(),
        commit() {
          this.species.forEach((sp, i) => { w16(c, offs[i], sp); c[offs[i] + 4] = 0; if (selOffs) U.w32(sel, selOffs[i], sp); });
          pendingStarterNew = this.species.slice();
          if (starterTypeLabel) starterTypeLabel(this.species.map((sp) => (game.byId.get(sp) || { types: ['Normal', 'Normal'] }).types));
        } };
      fixups.push(async () => {
        const list = [];
        for (let i = 0; i < listCnt; i++) list.push(crr.slice(listOff + i * 32, listOff + i * 32 + 32));
        for (const x of changedCros) {
          const u = (o) => r32(x, o);
          const regions = [[0x80, u(0xB0)], [u(0xB0), u(0xB0) + u(0xB4)], [u(0xB0) + u(0xB4), u(0xB8)], [u(0xB8), u(0xB8) + u(0xBC)]];
          const oldHash = await sha256(x.slice(0, 0x80));
          for (let i = 0; i < 4; i++) x.set(await sha256(x.slice(regions[i][0], regions[i][1])), i * 32);
          const newHash = await sha256(x.slice(0, 0x80));
          const idx = list.findIndex((h) => h.every((v, k) => v === oldHash[k]));
          if (idx >= 0) list[idx] = newHash;
        }
        list.sort((a, b) => { for (let k = 0; k < 32; k++) if (a[k] !== b[k]) return a[k] - b[k]; return 0; });
        list.forEach((h, i) => crr.set(h, listOff + i * 32));
      });
      break;
    }
    // ---- Sun/Moon/USUM: encounter-GARC met gifts (0x14 bytes, starters eerst), statics (0x38) en trades (0x34) ----
    if (isG7 && !game.starters) {
      for (const G of garcs) {
        if (G.subs.length < 4 || G.subs.length > 10 || G.size > 200000) continue;
        const p = await prefix(G, 0, 0x30);
        if (!p || r16(p, 0) !== 722 || r16(p, 0x14) !== 725 || r16(p, 0x28) !== 728) continue;
        const d = await loadGarc(G); use(G);
        const [g0, g1] = G.subs[0];
        const offs = [0, 1, 2].map((k) => g0 + k * 0x14);
        pendingStarterOrig = offs.map((o) => r16(d, o));
        game.starters = { species: offs.map((o) => r16(d, o)), commit() { this.species.forEach((sp, k) => { w16(d, offs[k], sp); d[offs[k] + 2] = 0; }); pendingStarterNew = this.species.slice(); } };
        game.statics = [];
        for (let o = g0 + 3 * 0x14; o + 0x14 <= g1; o += 0x14) {
          const sp = r16(d, o); if (sp < 1 || sp > maxSp) continue;
          game.statics.push({ kind: 'gift', label: 'Gift', species: sp, level: d[o + 3], commit() { w16(d, o, this.species); d[o + 2] = 0; } });
        }
        const STORY = isUSUM ? [791, 792, 800] : [791, 792]; // Solgaleo/Lunala (en Necrozma in USUM) zijn nodig voor het verhaal
        const [s0, s1] = G.subs[1];
        for (let o = s0; o + 0x38 <= s1; o += 0x38) {
          const sp = r16(d, o); if (sp < 1 || sp > maxSp) continue;
          game.statics.push({ kind: 'static', label: 'Static', species: sp, level: d[o + 3], story: STORY.includes(sp), commit() { w16(d, o, this.species); d[o + 2] = 0; } });
        }
        if (G.subs.length > 4) {
          const [t0, t1] = G.subs[4];
          for (let o = t0; o + 0x34 <= t1; o += 0x34) {
            const give = r16(d, o), req = r16(d, o + 0x2C); if (give < 1 || give > maxSp || req < 1 || req > maxSp) continue;
            (game.trades = game.trades || []).push({ label: 'Trade ' + (game.trades.length + 1), give, req, commit() { w16(d, o, this.give); d[o + 2] = 0; w16(d, o + 0x2C, this.req); } });
          }
        }
        break;
      }
    }
    if (!game.starters) game.warnings.push('Starters niet gevonden in deze 3DS-game');

    game.finalize = () => {};
    let fixed = false;
    // ---- Starternaam (+ type) in de verhaaltekst vervangen door de nieuwe starters ----
    // Gen 6/7-tekst: per regel versleutelde u16-tekens. Het tekstarchief wordt opnieuw opgebouwd; als het groter wordt,
    // komt het op de plek van het (grotere) archief van een andere taal en wijzen beide naar de nieuwe Engelse tekst.
    const txtRead = (b, o0) => { const n = r16(b, o0 + 2), lines = []; let key = 0x7C89;
      for (let i = 0; i < n; i++) { const st = o0 + 0x10 + r32(b, o0 + 0x14 + i * 8), len = r16(b, o0 + 0x18 + i * 8), a = []; let k = key;
        for (let j = 0; j < len; j++) { a.push(r16(b, st + j * 2) ^ k); k = ((k << 3) | (k >> 13)) & 0xFFFF; }
        lines.push({ a, pad: r16(b, o0 + 0x1A + i * 8) }); key = (key + 0x2983) & 0xFFFF; }
      return lines; };
    const txtWrite = (lines) => { const n = lines.length; let pos = 4 + n * 8; const offs = [];
      for (const Ln of lines) { offs.push(pos); pos += Ln.a.length * 2; if (pos % 4) pos += 2; }
      const b = new Uint8Array(0x10 + pos); w16(b, 0, 1); w16(b, 2, n); U.w32(b, 4, pos); U.w32(b, 8, 0); U.w32(b, 12, 0x10); U.w32(b, 0x10, pos);
      let key = 0x7C89;
      lines.forEach((Ln, i) => { U.w32(b, 0x14 + i * 8, offs[i]); w16(b, 0x18 + i * 8, Ln.a.length); w16(b, 0x1A + i * 8, Ln.pad); let k = key;
        Ln.a.forEach((c, j) => { w16(b, 0x10 + offs[i] + j * 2, c ^ k); k = ((k << 3) | (k >> 13)) & 0xFFFF; }); key = (key + 0x2983) & 0xFFFF; });
      return b; };
    const isTxt = (b, o0, e) => e - o0 >= 0x14 && r16(b, o0) === 1 && r32(b, o0 + 8) === 0 && r32(b, o0 + 12) === 0x10;
    const typeWord = (types) => (types[0] === types[1] ? types[0] : types[0] + '/' + types[1]);
    const starterTextFix = async () => {
      if (!pendingStarterOrig || !pendingStarterNew || pendingStarterOrig.join() === pendingStarterNew.join()) return;
      const oldN = pendingStarterOrig.map((s) => PKDATA.nameOf(s)), newN = pendingStarterNew.map((s) => PKDATA.nameOf(s));
      const oldT = pendingStarterOrig.map((s) => (game.byId.get(s) || { types: ['Normal', 'Normal'] })._origTypes || (game.byId.get(s) || { types: ['Normal'] }).types);
      const newT = pendingStarterNew.map((s) => (game.byId.get(s) || { types: ['Normal', 'Normal'] }).types);
      const toA = (str) => [...str].map((ch) => ch.charCodeAt(0));
      const find = (a, sub, from) => { for (let i = from; i + sub.length <= a.length; i++) { let ok = true; for (let k = 0; k < sub.length; k++) if (a[i + k] !== sub[k]) { ok = false; break; } if (ok) return i; } return -1; };
      // Engels verhaalarchief: veel kleine tekstbestanden, regels met "-type" en de starternamen
      let best = null;
      for (const G of garcs) {
        if (G.subs.length < 300 || G.size > 40e6) continue;
        const p0 = await prefix(G, 1, 0x10); if (!p0 || r16(p0, 0) !== 1 || r32(p0, 12) !== 0x10) continue;
        const d = await loadGarc(G); let hits = 0, eng = 0;
        for (const [a0, a1] of G.subs) {
          if (!isTxt(d, a0, a1) || r16(d, a0 + 2) > 300) continue;
          for (const Ln of txtRead(d, a0)) { const str = String.fromCharCode(...Ln.a); if (oldN.some((nm) => str.includes(nm))) { hits++; if (/-type Pok/.test(str) || / the /.test(str)) eng++; } }
        }
        if (hits && eng && (!best || eng > best.eng)) best = { G, d, eng };
      }
      if (!best) return;
      const { G, d } = best;
      const newFiles = [];
      let changed = 0;
      for (const [a0, a1] of G.subs) {
        if (!isTxt(d, a0, a1) || r16(d, a0 + 2) > 300) { newFiles.push(null); continue; }
        const lines = txtRead(d, a0); let ch = false;
        for (const Ln of lines) {
          const which = oldN.map((nm, i) => (find(Ln.a, toA(nm), 0) >= 0 ? i : -1)).filter((i) => i >= 0);
          if (!which.length) continue;
          if (/[0-9]/.test(String.fromCharCode(...Ln.a.filter((c) => c < 0xE000)))) continue; // feitjes met getallen (lengte/gewicht-quiz) niet aanpassen
          // type-woord van de starter in deze regel (alleen als er één starter in staat)
          if (which.length === 1) {
            const i = which[0];
            for (const t of new Set(oldT[i])) { const from = toA(t + '-type'); let at = find(Ln.a, from, 0); while (at >= 0) { const to = toA(typeWord(newT[i]) + '-type'); Ln.a.splice(at, from.length, ...to); at = find(Ln.a, from, at + to.length); } }
          }
          for (const i of which) { const from = toA(oldN[i]); let at = find(Ln.a, from, 0); while (at >= 0) { const to = toA(newN[i]); Ln.a.splice(at, from.length, ...to); at = find(Ln.a, from, at + to.length); } }
          ch = true;
        }
        if (ch) { newFiles.push(txtWrite(lines)); changed++; } else newFiles.push(null);
      }
      if (!changed) return;
      // archief opnieuw opbouwen
      const hs = r32(d, 4), dataOff = r32(d, 0x10), fatoSize = r32(d, hs + 4), fatb = hs + fatoSize;
      const entOf = (i) => fatb + 12 + r32(d, hs + 12 + i * 4);
      const al4 = (x) => (x + 3) & ~3;
      const blobs = G.subs.map(([a0, a1], i) => newFiles[i] || d.slice(a0, a0 + r32(d, entOf(i) + 12)));
      const total = dataOff + blobs.reduce((q, b) => q + al4(b.length), 0);
      const out = new Uint8Array(total); out.set(d.subarray(0, dataOff));
      let pos = 0, largest = 0;
      blobs.forEach((b, i) => { const e = entOf(i); if (!r32(d, e)) return; out.set(b, dataOff + pos); U.w32(out, e + 4, pos); U.w32(out, e + 8, pos + al4(b.length)); U.w32(out, e + 12, b.length); largest = Math.max(largest, al4(b.length)); pos += al4(b.length); });
      U.w32(out, 0x14, total); U.w32(out, 0x18, Math.max(r32(d, 0x18), largest));
      const meta = (path, off, size) => { const m = new Uint8Array(16); U.w32(m, 0, off - fdata); U.w32(m, 4, 0); U.w32(m, 8, size); U.w32(m, 12, 0); loaded.push({ off: files[path].meta, data: m, noLfs: true }); };
      if (total <= G.size) { const buf = new Uint8Array(G.size); buf.set(out); loaded.push({ off: G.off, data: buf, path: G.path, lfsData: out }); meta(G.path, G.off, total); return; }
      // groter: plek van een ander-talig archief (zelfde aantal bestanden) dat groot genoeg is
      const donor = garcs.filter((x) => x !== G && x.subs.length === G.subs.length && x.size >= total).sort((x, y) => y.size - x.size)[0];
      if (!donor) { game.warnings.push('Starternamen in de tekst konden niet aangepast worden (geen ruimte)'); return; }
      const buf = new Uint8Array(donor.size); buf.set(out);
      loaded.push({ off: donor.off, data: buf, path: G.path, lfsData: out });
      meta(G.path, donor.off, total); meta(donor.path, donor.off, total);
      game.warnings.push('Starternamen in de tekst aangepast (de tekst van een andere taal, ' + donor.path + ', is daarvoor vervangen door Engels)');
    };
    const runFixups = async () => { if (fixed) return; fixed = true; for (const f of fixups) await f(); await starterTextFix(); if (zoneFix) await zoneFix(); if (worldFix) { await worldFix(); for (const p of partial) loaded.push(p); } };

    // ---- Output: patches + hashes ----
    game.buildPatches = async () => {
      await runFixups();
      const patches = loaded.map((p) => ({ off: p.off, data: p.data }));
      const readP = async (off, len) => {
        const b = await reader.read(off, len);
        for (const p of patches) {
          const s = Math.max(off, p.off), e = Math.min(off + len, p.off + p.data.length);
          if (s < e) b.set(p.data.subarray(s - p.off, e - p.off), s - off);
        }
        return b;
      };
      const rehash = async (dataStart, bs, ranges, hashStart) => {
        const blocks = new Set();
        for (const [s, e] of ranges) for (let i = Math.floor((s - dataStart) / bs); i <= Math.floor((e - 1 - dataStart) / bs); i++) blocks.add(i);
        const out = [];
        for (const i of [...blocks].sort((a, b) => a - b)) {
          const hsh = await sha256(await readP(dataStart + i * bs, bs));
          patches.push({ off: hashStart + i * 32, data: hsh }); out.push([hashStart + i * 32, hashStart + i * 32 + 32]);
        }
        return out;
      };
      let ranges = loaded.map((p) => [p.off, p.off + p.data.length]);
      ranges = await rehash(l3, lv[2].bs, ranges, l2);       // level 3 -> hashes in level 2
      ranges = await rehash(l2, lv[1].bs, ranges, l1);       // level 2 -> level 1
      await rehash(l1, lv[0].bs, ranges, romfs + 0x60);       // level 1 -> master hash
      patches.push({ off: ncch + 0x1E0, data: await sha256(await readP(romfs, hashRegion)) }); // RomFS-superblockhash (0x1C0 = ExeFS)
      for (const p of await codeExefsPatches()) patches.push(p); // shiny-kans + trades in de programmacode
      return patches;
    };
    // ---- Veld-items (item-balls + verborgen items): tabel [item, aantal, nummer] in de data van een AMX-script ----
    const amxDec = (d, count) => { const code = new Int32Array(count); let i = 0, f = 0, j = 0, x = 0;
      while (i < count && f < d.length) { const b = d[f++], v = b & 0x7F; if (++j === 1) x = ((((v >> 6) === 0 ? 1 : 0) - 1) << 6) | v; else x = (x << 7) | v; if (b & 0x80) continue; code[i++] = x; j = 0; }
      return { code, used: f }; };
    const amxEnc1 = (x) => { const g = []; let v = x | 0;
      do { g.unshift(v & 0x7F); v >>= 7; } while (!((v === 0 && !(g[0] & 0x40)) || (v === -1 && (g[0] & 0x40))));
      return g.map((b, i) => (i < g.length - 1 ? b | 0x80 : b)); };
    game.fieldItems = null;
    for (const G of garcs) {
      if (game.fieldItems || G.size > 4e6 || G.subs.length < 10) continue;
      const p0 = await prefix(G, 0, 8); if (!p0 || r16(p0, 4) !== 0xF1E0) continue;
      const gd = await loadGarc(G);
      for (let si = 0; si < G.subs.length && !game.fieldItems; si++) {
        const [s, e] = G.subs[si]; if (e - s < 0x40 || r16(gd, s + 4) !== 0xF1E0) continue;
        const size = r32(gd, s), cod = r32(gd, s + 0xC), dat = r32(gd, s + 0x10), hea = r32(gd, s + 0x14);
        if (!(cod <= dat && dat <= hea && size <= e - s)) continue;
        const { code } = amxDec(gd.subarray(s + cod, s + size), (hea - cod) / 4);
        const d0 = (dat - cod) / 4;
        // zoek reeks [item, aantal, index] met index 0,1,2,...
        for (let k = d0; k + 300 < code.length; k++) {
          if (code[k + 2] !== 0) continue;
          let n = 0;
          while (k + n * 3 + 2 < code.length && code[k + n * 3 + 2] === n && code[k + n * 3] >= 1 && code[k + n * 3] <= 775 && code[k + n * 3 + 1] >= 1 && code[k + n * 3 + 1] <= 99) n++;
          if (n < 100) continue;
          const start = k, budget = size - cod, words = code;
          const entries = []; for (let i = 0; i < n; i++) entries.push({ item: words[start + i * 3], qty: words[start + i * 3 + 1], orig: words[start + i * 3] });
          use(G);
          game.fieldItems = { entries, ballCount: Math.min(n, 240),
            commit() {
              // passen binnen de oorspronkelijke gecomprimeerde grootte: zo nodig enkele items terugzetten
              const lenOf = (v) => amxEnc1(v).length;
              let total = 0; const w2 = Int32Array.from(words);
              this.entries.forEach((en, i) => (w2[start + i * 3] = en.item));
              for (const v of w2) total += lenOf(v);
              for (let i = this.entries.length - 1; i >= 0 && total > budget; i--) {
                const en = this.entries[i]; const d = lenOf(en.item) - lenOf(en.orig);
                if (d > 0) { en.item = en.orig; w2[start + i * 3] = en.orig; total -= d; }
              }
              const out = new Uint8Array(budget); let p = 0, pad = budget - total;
              for (let i = 0; i < w2.length; i++) {
                const isItem = i >= start && i < start + this.entries.length * 3 && (i - start) % 3 === 0;
                if (isItem) while (pad > 0 && w2[i] >= 0) { out[p++] = 0x80; pad--; if (pad <= 0) break; }
                for (const b of amxEnc1(w2[i])) out[p++] = b;
              }
              if (pad > 0 || p !== budget) throw new Error('Veld-items passen niet terug in het script');
              gd.set(out, s + cod);
            } };
          break;
        }
      }
    }
    if (!game.fieldItems) game.warnings.push('Veld-items niet gevonden');

    // ---- Shiny-kans: drempel in de shiny-check van de programmacode (ExeFS .code) ----
    // Normaal: (TID^SID^PIDhi^PIDlo) < 16 -> 1 op 4096. Drempel t (16..255) geeft 1 op 65536/t.
    // .3ds: de BLZ-gecomprimeerde code wordt op token-niveau aangepast (zelfde plek, past in de vrije ruimte),
    // daarna ExeFS-hash + NCCH-superblockhash opnieuw. LayeredFS/Azahar-mod: code.ips.
    game.shinyOdds = 4096;
    let shinyInfo = null;
    const blzParse = (comp) => {
      const len = comp.length, v = r32(comp, len - 8), add = r32(comp, len - 4), hdr = v >>> 24, stop = len - (v & 0xFFFFFF);
      const dec = new Uint8Array(len + add); dec.set(comp);
      const tokens = [];
      let idx = len - hdr, o = len + add;
      while (idx > stop) {
        let fl = dec[--idx];
        for (let i = 0; i < 8 && idx > stop; i++) {
          if (fl & 0x80) { const b1 = dec[--idx], b2 = dec[--idx]; const seg = (b1 << 8) | b2; const l = (seg >> 12) + 3, d = (seg & 0xFFF) + 3; tokens.push({ t: 1, l, d }); for (let k = 0; k < l; k++) { dec[o - 1] = dec[o - 1 + d]; o--; } }
          else { const b = dec[--idx]; tokens.push({ t: 0, b }); dec[--o] = b; }
          fl = (fl << 1) & 0xFF;
        }
      }
      return { dec, tokens, stop, raw: comp.slice(0, stop), decLen: len + add };
    };
    const blzReplay = (P) => {
      const out = new Uint8Array(P.decLen), origin = new Int32Array(P.decLen), tokOf = new Int32Array(P.decLen).fill(-1);
      out.set(P.raw); for (let i = 0; i < P.stop; i++) origin[i] = -(i + 2);
      let o = P.decLen;
      P.tokens.forEach((tk, ti) => {
        if (tk.t === 0) { out[--o] = tk.b; origin[o] = ti; tokOf[o] = ti; }
        else for (let k = 0; k < tk.l; k++) { out[o - 1] = out[o - 1 + tk.d]; origin[o - 1] = origin[o - 1 + tk.d]; tokOf[o - 1] = ti; o--; }
        tk.pos = o;
      });
      return { out, origin, tokOf, ok: o === P.stop };
    };
    // optimale BLZ-compressie (voor grotere code-aanpassingen, bv. de TM-lijst)
  function blzEncOpt(dec, stop) {
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
    const blzSerialize = (P) => {
      const B = [];
      for (let g = 0; g < P.tokens.length; g += 8) {
        const grp = P.tokens.slice(g, g + 8); let fl = 0;
        grp.forEach((tk, i) => { if (tk.t === 1) fl |= 0x80 >> i; });
        B.push(fl);
        for (const tk of grp) { if (tk.t === 0) B.push(tk.b); else { const seg = ((tk.l - 3) << 12) | (tk.d - 3); B.push(seg >> 8, seg & 0xFF); } }
      }
      const total = P.stop + B.length, pad = (4 - ((total + 8) % 4)) % 4, hdr = 8 + pad, len = total + hdr;
      const c = new Uint8Array(len); c.set(P.raw);
      for (let k = 0; k < B.length; k++) c[P.stop + B.length - 1 - k] = B[k];
      c.fill(0xFF, total, total + pad);
      U.w32(c, len - 8, ((hdr << 24) | (len - P.stop)) >>> 0); U.w32(c, len - 4, P.decLen - len);
      return c;
    };
    const getShinyInfo = async () => {
      if (shinyInfo) return shinyInfo;
      const exh = await reader.read(ncch + 0x200, 0x10);
      const efs = ncch + r32(n, 0x1A0) * 0x200, efsHR = r32(n, 0x1A8) * 0x200, eh = await reader.read(efs, 0x200);
      let ci = -1; const ents = [];
      for (let i = 0; i < 10; i++) { const nm = str(eh, i * 16, 8).replace(/\0+$/, ''); if (!nm) continue; ents.push({ i, nm, off: r32(eh, i * 16 + 8), size: r32(eh, i * 16 + 12) }); if (nm === '.code') ci = i; }
      if (ci < 0) return (shinyInfo = { sites: [] });
      const ce = ents.find((e) => e.i === ci);
      const comp = await reader.read(efs + 0x200 + ce.off, ce.size);
      const compressed = !!(exh[0xD] & 1);
      const P = compressed ? blzParse(comp) : null;
      const code = compressed ? P.dec : comp;
      const isEor = (w) => (w >>> 28) === 0xE && (w & 0x0FE00000) === 0x00200000 && ((w >> 7) & 0x1F) === 16 && ((w >> 5) & 3) === 1;
      const sites = [];
      for (let o = 40; o + 4 <= code.length; o += 4) {
        const w = r32(code, o);
        if ((w >>> 28) !== 0xE || (w & 0x0FF00FFF) !== 0x03500010) continue;
        for (let k = 1; k <= 10; k++) if (isEor(r32(code, o - k * 4))) { sites.push(o); break; }
      }
      const nextOff = Math.min(...ents.filter((e) => e.off > ce.off).map((e) => e.off), r32(n, 0x1A4) * 0x200 - 0x200);
      return (shinyInfo = { sites, efs, efsHR, eh, ci, ce, comp, compressed, P, maxSize: nextOff - ce.off });
    };
    const oddsToThr = (odds) => U.clamp(Math.round(65536 / odds), 16, 255);
    // Wijzigingen in de (uitgepakte) programmacode: positie -> nieuwe byte. Gebruikt door shiny-kans en in-game trades.
    const codeChanges = new Map(); game._code = async () => { const S = await getShinyInfo(); return S.compressed ? S.P.dec : S.comp; };
    const allCodeChanges = async () => {
      const S = await getShinyInfo();
      const m = new Map(codeChanges);
      if (game.shinyOdds !== 4096) {
        if (!S.sites.length) throw new Error('De shiny-check werd niet gevonden in deze game.');
        const thr = oddsToThr(game.shinyOdds);
        for (const o of S.sites) m.set(o, thr);
      }
      const code = S.compressed ? S.P.dec : S.comp;
      // starter-tabel (nummer 1..6 -> soort) in de code, voor de naam van je starter in teksten/cutscenes
      if (pendingStarterOrig && pendingStarterNew && code) for (let o = 0; o + 48 <= code.length; o += 2) {
        let ok = true;
        for (let k = 0; k < 6 && ok; k++) if (r16(code, o + k * 8) !== k + 1 || r32(code, o + k * 8 + 4) !== pendingStarterOrig[k % 3]) ok = false;
        if (ok) { for (let k = 0; k < 6; k++) { const sp = pendingStarterNew[k % 3]; m.set(o + k * 8 + 4, sp & 0xFF); m.set(o + k * 8 + 5, sp >> 8); } break; }
      }
      for (const [p, v] of [...m]) if (code[p] === v) m.delete(p);
      return m;
    };
    // IPS-patch (voor LayeredFS / Azahar-mods); leeg = niets aangepast (overschrijft een oude patch)
    game.codeIps = async () => {
      const m = await allCodeChanges();
      const pos = [...m.keys()].sort((a, b) => a - b), recs = [];
      for (const p of pos) { const last = recs[recs.length - 1]; if (last && last.o + last.b.length === p) last.b.push(m.get(p)); else recs.push({ o: p, b: [m.get(p)] }); }
      const size = 5 + recs.reduce((a, r) => a + 5 + r.b.length, 0) + 3, ips = new Uint8Array(size);
      ips.set([0x50, 0x41, 0x54, 0x43, 0x48]); let q = 5;
      for (const r of recs) { ips.set([(r.o >> 16) & 0xFF, (r.o >> 8) & 0xFF, r.o & 0xFF, 0, r.b.length], q); ips.set(r.b, q + 5); q += 5 + r.b.length; }
      ips.set([0x45, 0x4F, 0x46], q);
      return ips;
    };
    const codeExefsPatches = async () => {
      const m = await allCodeChanges();
      if (!m.size) return [];
      const S = await getShinyInfo();
      let newCode;
      if (!S.compressed) { newCode = S.comp.slice(); for (const [p, v] of m) newCode[p] = v; }
      else if (m.size > 64) { // veel wijzigingen: alles opnieuw (optimaal) comprimeren
        const want = S.P.dec.slice(); for (const [p, v] of m) want[p] = v;
        newCode = blzEncOpt(want, S.P.stop);
        if (newCode.length > S.maxSize) throw new Error('De code-aanpassingen passen niet in de ROM.');
      } else {
        const P = { tokens: S.P.tokens.map((t) => Object.assign({}, t)), stop: S.P.stop, raw: S.P.raw, decLen: S.P.decLen };
        for (let it = 0; it < 40; it++) { // maak de te wijzigen bytes "zelfstandig" (niet gedeeld met andere code)
          const R = blzReplay(P); if (!R.ok) throw new Error('Programmacode kon niet worden geanalyseerd.');
          const groups = new Map();
          for (const p of m.keys()) groups.set(R.origin[p], []);
          for (let q = 0; q < R.origin.length; q++) { const l = groups.get(R.origin[q]); if (l) l.push(q); }
          // conflict: een byte deelt zijn bron met een byte die anders moet worden -> splits de kopie-opdracht op die plek
          const splits = new Map();
          const addSplit = (ti, x) => { if (!splits.has(ti)) splits.set(ti, new Set()); splits.get(ti).add(x); };
          for (const p of m.keys()) for (const q of groups.get(R.origin[p])) {
            if (m.has(q) && m.get(q) === m.get(p)) continue;
            const tq = R.tokOf[q];
            if (tq >= 0 && P.tokens[tq].t === 1) {
              // alleen splitsen als deze kopie RECHTSTREEKS leest van een gewijzigde byte of van de bron-byte zelf;
              // kopieën van kopieën lossen zichzelf op zodra hun bron gesplitst is
              const src = q + P.tokens[tq].d, ts = R.tokOf[src];
              if (m.has(src) || (ts >= 0 && P.tokens[ts].t === 0)) addSplit(tq, q);
            }
            else { const tp = R.tokOf[p]; if (tp >= 0 && P.tokens[tp].t === 1) addSplit(tp, p); else throw new Error('Code-patch: onverwachte codestructuur.'); }
          }
          if (!splits.size) { for (const [p, v] of m) P.tokens[R.origin[p]].b = v; break; }
          for (const ti of [...splits.keys()].sort((a, b) => b - a)) {
            const tk = P.tokens[ti], set = splits.get(ti), reps = [];
            let run = [];
            const flush = () => { if (run.length >= 3) reps.push({ t: 1, l: run.length, d: tk.d }); else run.forEach((x) => reps.push({ t: 0, b: R.out[x] })); run = []; };
            for (let x = tk.pos + tk.l - 1; x >= tk.pos; x--) { if (set.has(x)) { flush(); reps.push({ t: 0, b: R.out[x] }); } else run.push(x); }
            flush();
            P.tokens.splice(ti, 1, ...reps);
          }
        }
        newCode = blzSerialize(P);
        const chk = blzParse(newCode).dec, want = S.P.dec.slice(); for (const [p, v] of m) want[p] = v;
        if (chk.length !== want.length || chk.some((b, i) => b !== want[i])) throw new Error('Code-patch: controle mislukt.');
        if (newCode.length > S.maxSize) throw new Error('De code-aanpassingen passen niet in de ROM (gebruik LayeredFS of een lagere shiny-instelling).');
      }
      const region = new Uint8Array(Math.max(newCode.length, S.ce.size)); region.set(newCode);
      const eh = S.eh.slice(); U.w32(eh, S.ci * 16 + 12, newCode.length);
      eh.set(await sha256(newCode), 0xC0 + (9 - S.ci) * 32);
      return [
        { off: S.efs + 0x200 + S.ce.off, data: region },
        { off: S.efs, data: eh },
        { off: ncch + 0x1C0, data: await sha256(eh.subarray(0, S.efsHR)) },
      ];
    };
    game.shinyActualOdds = () => Math.round(65536 / oddsToThr(game.shinyOdds));

    // ---- Poké Marts (in de programmacode): gewone winkels per badge blijven, speciale winkels worden aanpasbaar ----
    game.marts = null;
    {
      const S = await getShinyInfo();
      const code = S.compressed ? S.P.dec : S.comp;
      const full = [4, 3, 2, 17, 26, 25, 24, 23, 28, 18, 22, 21, 19, 20, 27, 78, 79, 76, 77]; // winkel met 8 badges
      let last = -1;
      if (code) for (let o = 0; o + full.length * 2 < code.length; o += 2) {
        let ok = true; for (let k = 0; k < full.length; k++) if (r16(code, o + k * 2) !== full[k]) { ok = false; break; }
        if (ok) { last = o; o += full.length * 2 - 2; }
      }
      if (last >= 0) {
        const start = last + full.length * 2, slots = [];
        for (let o = start; o + 1 < code.length && slots.length < 400; o += 2) { const v = r16(code, o); if (v < 1 || v > 775) break; slots.push({ o, item: v, orig: v }); }
        if (slots.length >= 10) game.marts = { slots, commit() { this.slots.forEach((x) => { codeChanges.set(x.o, x.item & 0xFF); codeChanges.set(x.o + 1, x.item >> 8); }); } };
      }
    }

    // ---- TM's: lijst met aanvalnummers in de programmacode (XY/ORAS: TM01-92, HM's, TM93-100(, HM07); SM/USUM: TM01-100) ----
    {
      const code = await game._code();
      const HM = new Set([15, 19, 57, 70, 127, 249, 291]);
      const heads = [[468, 337, 473, 347, 46, 92, 258, 339, 474, 237], [526, 337, 473, 347, 46, 92, 258, 339, 474, 237]];
      let at = -1;
      if (code) for (let o = 0; o + 240 < code.length && at < 0; o += 2) if (heads.some((h) => h.every((mv, q) => r16(code, o + q * 2) === mv))) at = o;
      if (at >= 0) {
        const tmPos = [], hmPos = [];
        for (let i = 0; tmPos.length < 100 && i < 110; i++) { const o = at + i * 2, mv = r16(code, o); if (!isG7 && i >= 92 && HM.has(mv)) hmPos.push(o); else tmPos.push(o); }
        game.tms = { moves: tmPos.map((o) => r16(code, o)), hms: hmPos.map((o) => r16(code, o)),
          commit() { this.moves.forEach((mv, i) => { codeChanges.set(tmPos[i], mv & 0xFF); codeChanges.set(tmPos[i] + 1, mv >> 8); }); } };
      } else game.warnings.push('TM-lijst niet gevonden');
      // TM-compatibiliteit: 100 bits vanaf 0x28 in de persoonlijke data (HM's blijven zoals ze zijn)
      game.hasTmCompat = true;
      for (const sp of game.species) sp.tm = Array.from({ length: 100 }, (_, i) => !!(pd[sp.off + 0x28 + (i >> 3)] & (1 << (i & 7))));
      const prevC = game.commitSpecies;
      game.commitSpecies = (sp) => {
        prevC(sp);
        const targets = [sp.off]; if (hasTotal) targets.push(total[0] + sp.id * ENTRY);
        for (const o of targets) sp.tm.forEach((v, i) => { const q = o + 0x28 + (i >> 3), bit = 1 << (i & 7); pd[q] = v ? pd[q] | bit : pd[q] & ~bit; });
      };
    }
    // ---- In-game trades (ORAS/XY: tabel in de programmacode, 0x24 bytes: soort, ..., level @4, ..., gevraagde soort @0x20) ----
    game.trades = game.trades || [];
    {
      const S = await getShinyInfo();
      const code = S.compressed ? S.P.dec : S.comp;
      if (code) {
        const ok = (o) => { const s = r16(code, o), q = r16(code, o + 0x20), lv = code[o + 4];
          return s >= 1 && s <= maxSp && q >= 1 && q <= maxSp && lv >= 1 && lv <= 100 && code[o + 0x19] === 0xFF && r16(code, o + 0x1A) === 0xFFFF && r32(code, o + 0x1C) === 0xFFFFFFFF; };
        for (let o = 0; o + 0x24 * 2 < code.length && !game.trades.length; o += 4) {
          if (!ok(o)) continue;
          let k = 0; while (ok(o + k * 0x24)) k++;
          if (k < 2 || k > 20) continue;
          for (let i = 0; i < k; i++) {
            const e = o + i * 0x24;
            game.trades.push({ label: 'Trade ' + (i + 1), give: r16(code, e), req: r16(code, e + 0x20), level: code[e + 4],
              commit() { codeChanges.set(e, this.give & 0xFF); codeChanges.set(e + 1, this.give >> 8); codeChanges.set(e + 0x20, this.req & 0xFF); codeChanges.set(e + 0x21, this.req >> 8); } });
          }
        }
      }
    }

    game.isPatchBased = true; game._files = files; game._reader = reader;
    game.titleId = titleId;
    // LayeredFS (Luma3DS): alleen de gewijzigde RomFS-bestanden, in de juiste mappenstructuur
    game.layeredFsFiles = async () => {
      await runFixups();
      const whole = loaded.filter((p) => p.fileOff === undefined && !p.noLfs).map((p) => ({ path: 'luma/titles/' + titleId + '/romfs/' + p.path, data: p.lfsData || p.data }));
      const byFile = new Map(); for (const p of loaded) if (p.fileOff !== undefined) { if (!byFile.has(p.path)) byFile.set(p.path, []); byFile.get(p.path).push(p); }
      { const seen = new Map(); whole.forEach((w) => seen.set(w.path, w)); whole.length = 0; whole.push(...seen.values()); }
      for (const [path, parts] of byFile) { const f = files[path]; const d = await reader.read(f.off, f.size); for (const p of parts) d.set(p.data, p.fileOff); whole.push({ path: 'luma/titles/' + titleId + '/romfs/' + path, data: d }); }
      return whole;
    };
    game.rom = null;
    return game;
  }

  g.CTR = { detect, load };
})(typeof window !== 'undefined' ? window : globalThis);
