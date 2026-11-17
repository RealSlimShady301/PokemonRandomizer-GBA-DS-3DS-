// Gen 3 – Ruby/Sapphire/Emerald/FireRed/LeafGreen (alle talen, ook veel hacks).
(function (g) {
  const { r16, r32, w16, find, findAll } = U;
  const TYPES = PKDATA.TYPES_GBA_NDS;

  // Gen 3 item-nummers voor sterke trainers
  const ITEMS3 = { fullRestore: 19, hyperPotion: 21, held: [200, 142, 141, 219, 186, 187, 183, 179, 198, 196] };

  function load(rom) {
    const code = String.fromCharCode(...rom.slice(0xAC, 0xB0));
    const title = String.fromCharCode(...rom.slice(0xA0, 0xAC)).replace(/[^\x20-\x7e]/g, '').trim();
    const fam = /^BP[RG]/.test(code) ? 'FRLG' : /^BPE/.test(code) ? 'E' : /^AX[VP]/.test(code) ? 'RS' : '?';
    const game = { gen: 3, platform: 'Game Boy Advance', name: title + ' (' + code + ')', rom, warnings: [], abilityMax: 77, hasTmCompat: false };
    game.typeNames = TYPES.filter(Boolean);
    game.statNames = ['HP', 'Atk', 'Def', 'Spe', 'SpA', 'SpD'];
    const BASE = 0x08000000;
    const isPtr = (p) => p >= BASE && p < BASE + rom.length;

    // ---- Species & National Dex ----
    const bulba = find(rom, '2D 31 31 2D 41 41 0C 03');
    if (bulba < 28) throw new Error('Basisstatistieken niet gevonden (Gen 3).');
    const bs = bulba - 28;
    let nat = null;
    for (const o of findAll(rom, '01 00 02 00 03 00 04 00 05 00 06 00 07 00 08 00', 0, rom.length, 2)) {
      let ok = true;
      for (let s = 1; s <= 251 && ok; s++) if (r16(rom, o + (s - 1) * 2) !== s) ok = false;
      if (ok && r16(rom, o + 276 * 2) === 252) { nat = o; break; }
    }
    if (!nat) game.warnings.push('National Dex-tabel niet gevonden; Hoenn-namen kunnen afwijken');
    const dexOf = (s) => (nat ? r16(rom, nat + (s - 1) * 2) : s <= 251 ? s : 0);
    const validSp = (s) => s >= 1 && s <= 411 && !(s >= 252 && s <= 276) && dexOf(s) >= 1 && dexOf(s) <= 386;

    game.species = [];
    for (let s = 1; s <= 411; s++) {
      if (!validSp(s)) continue;
      const o = bs + s * 28;
      const sp = { id: s, dex: dexOf(s), name: PKDATA.nameOf(dexOf(s)), off: o,
        stats: [0, 1, 2, 3, 4, 5].map((k) => rom[o + k]),
        types: [TYPES[rom[o + 6]] || 'Normal', TYPES[rom[o + 7]] || 'Normal'], _origTypes: [TYPES[rom[o + 6]] || 'Normal', TYPES[rom[o + 7]] || 'Normal'],
        catchRate: rom[o + 8], growth: rom[o + 19], abilities: [rom[o + 22], rom[o + 23]], heldItems: [r16(rom, o + 12), r16(rom, o + 14)] };
      game.species.push(sp);
    }
    game.byId = new Map(game.species.map((s) => [s.id, s]));
    game.commitSpecies = (sp) => {
      const o = sp.off;
      sp.stats.forEach((v, k) => (rom[o + k] = U.clamp(v, 1, 255)));
      rom[o + 6] = TYPES.indexOf(sp.types[0]); rom[o + 7] = TYPES.indexOf(sp.types[1]);
      rom[o + 8] = sp.catchRate; rom[o + 19] = sp.growth;
      rom[o + 22] = sp.abilities[0]; rom[o + 23] = sp.abilities[1];
      w16(rom, o + 12, sp.heldItems[0]); w16(rom, o + 14, sp.heldItems[1]);
    };

    // ---- Aanvallen ----
    const mvTab = find(rom, '00 00 00 00 00 00 00 00 00 00 00 00 00 28 00 64 23 00');
    game.moves = { valid: [], max: 354,
      info: (m) => (mvTab < 0 ? null : { power: rom[mvTab + m * 12 + 1], type: TYPES[rom[mvTab + m * 12 + 2]] }) };
    for (let m = 1; m <= 354; m++) if (m !== 165) game.moves.valid.push(m);

    // ---- TM's ----
    const tmOff = find(rom, '08 01 51 01 60 01 5B 01 2E 00', 0, rom.length, 2);
    if (tmOff >= 0) {
      game.tms = { moves: [], hms: [], commit() { this.moves.forEach((m, i) => w16(rom, tmOff + i * 2, m)); } };
      for (let i = 0; i < 50; i++) game.tms.moves.push(r16(rom, tmOff + i * 2));
      for (let i = 50; i < 58; i++) game.tms.hms.push(r16(rom, tmOff + i * 2));
    } else game.warnings.push('TM-lijst niet gevonden');

    // ---- Level-up aanvallen ----
    game.learnsets = new Map();
    const bulbaLs = find(rom, '21 02 2D 08 49 0E 16 14', 0, rom.length, 2);
    let lsTab = -1;
    if (bulbaLs >= 0) {
      const p = bulbaLs + BASE;
      const pat = [p & 0xff, (p >> 8) & 0xff, (p >> 16) & 0xff, p >>> 24];
      const at = find(rom, pat, 0, rom.length, 4);
      if (at >= 4) lsTab = at - 4;
    }
    if (lsTab >= 0) {
      for (const sp of game.species) {
        const p = r32(rom, lsTab + sp.id * 4); if (!isPtr(p)) continue;
        let o = p - BASE; const entries = [];
        while (r16(rom, o) !== 0xFFFF && entries.length < 40) {
          const v = r16(rom, o); entries.push({ level: v >> 9, move: v & 0x1FF, _off: o }); o += 2;
        }
        game.learnsets.set(sp.id, { entries, commit() { this.entries.forEach((e) => w16(rom, e._off, (e.level << 9) | e.move)); } });
      }
    } else game.warnings.push('Level-up aanvallen niet gevonden');

    // ---- Wilde Pokémon ----
    game.wild = [];
    const SLOT_COUNTS = [12, 5, 5, 10], KIND = ['gras/grot', 'surfen', 'Rock Smash', 'vissen'];
    const infoOk = (p, n) => {
      if (!isPtr(p)) return false;
      const o = p - BASE; if (rom[o] > 100) return false;
      const sp = r32(rom, o + 4); if (!isPtr(sp)) return false;
      const so = sp - BASE;
      for (let k = 0; k < n; k++) {
        const mn = rom[so + k * 4], mx = rom[so + k * 4 + 1], s = r16(rom, so + k * 4 + 2);
        if (mn < 1 || mx < mn || mx > 100 || !validSp(s)) return false;
      }
      return true;
    };
    const headerOk = (o) => {
      if (rom[o] === 0xFF && rom[o + 1] === 0xFF) return false;
      let any = false;
      for (let t = 0; t < 4; t++) {
        const p = r32(rom, o + 4 + t * 4);
        if (p === 0) continue;
        if (!infoOk(p, SLOT_COUNTS[t])) return false;
        any = true;
      }
      return any;
    };
    let wt = null;
    for (let i = 0; i < rom.length - 400; i += 4) {
      if (rom[i + 2] !== 0 || rom[i + 3] !== 0) continue; // padding na mapGroup/mapNum
      let k = 0; while (headerOk(i + k * 20)) k++;
      if (k >= 20 && rom[i + k * 20] === 0xFF && (!wt || k > wt.count)) wt = { off: i, count: k };
      if (k >= 20) i += (k * 20 - 4) & ~3;
    }
    if (wt) {
      const seen = new Set();
      for (let h = 0; h < wt.count; h++) {
        const o = wt.off + h * 20;
        for (let t = 0; t < 4; t++) {
          const p = r32(rom, o + 4 + t * 4); if (!p) continue;
          const so = r32(rom, p - BASE + 4) - BASE;
          if (seen.has(so)) continue; seen.add(so);
          const slots = [];
          for (let k = 0; k < SLOT_COUNTS[t]; k++) slots.push({ min: rom[so + k * 4], max: rom[so + k * 4 + 1], species: r16(rom, so + k * 4 + 2), _o: so + k * 4 });
          game.wild.push({ label: 'Map ' + rom[o] + '.' + rom[o + 1] + ' (' + KIND[t] + ')', slots,
            commit() { this.slots.forEach((s) => { rom[s._o] = U.clamp(s.min, 1, 100); rom[s._o + 1] = U.clamp(Math.max(s.min, s.max), 1, 100); w16(rom, s._o + 2, s.species); }); } });
        }
      }
    } else game.warnings.push('Wilde Pokémon niet gevonden');

    // ---- Trainers ----
    game.trainers = [];
    const SCHEMES = [[8, 16, 8, 16], [6, 14, 8, 16]];
    const trOk = (o) => {
      const fl = rom[o]; if (fl > 3) return false;
      const n = r32(rom, o + 32); if (n < 1 || n > 6) return false;
      if (!isPtr(r32(rom, o + 36))) return false;
      let hasEnd = false; for (let k = 4; k < 16; k++) if (rom[o + k] === 0xFF) { hasEnd = true; break; }
      if (!hasEnd) return false;
      const po = r32(rom, o + 36) - BASE;
      const lv = rom[po + 2], s = r16(rom, po + 4);
      return lv >= 1 && lv <= 100 && validSp(s);
    };
    let tt = null;
    for (let i = 0; i < rom.length - 40 * 50; i += 4) {
      let k = 0; while (trOk(i + k * 40)) k++;
      if (k >= 200 && (!tt || k > tt.count)) tt = { off: i, count: k };
      if (k >= 200) i += (k - 1) * 40;
    }
    if (tt) {
      // Bepaal partij-layout (stride) door te kijken welke het vaakst geldige data geeft
      const partyValid = (o, sch) => {
        const fl = rom[o], n = r32(rom, o + 32), po = r32(rom, o + 36) - BASE, es = sch[fl];
        for (let m = 0; m < n; m++) { const lv = rom[po + m * es + 2], s = r16(rom, po + m * es + 4); if (lv < 1 || lv > 100 || !validSp(s)) return false; }
        return true;
      };
      const score = SCHEMES.map((sch) => { let c = 0; for (let k = 0; k < tt.count; k++) if (partyValid(tt.off + k * 40, sch)) c++; return c; });
      const sch = SCHEMES[score[1] > score[0] ? 1 : 0];
      for (let k = 0; k < tt.count; k++) {
        const o = tt.off + k * 40;
        if (!partyValid(o, sch)) continue;
        const fl = rom[o], n = r32(rom, o + 32), po = r32(rom, o + 36) - BASE, es = sch[fl];
        const mvOff = 6 + (fl & 2);
        const mons = [];
        for (let m = 0; m < n; m++) {
          const b = po + m * es;
          mons.push({ species: r16(rom, b + 4), level: rom[b + 2], _b: b, iv: r16(rom, b), item: fl & 2 ? r16(rom, b + 6) : null,
            moves: fl & 1 ? [0, 1, 2, 3].map((q) => r16(rom, b + mvOff + q * 2)) : null });
        }
        const bag = [0, 1, 2, 3].map((q) => r16(rom, o + 16 + q * 2));
        game.trainers.push({ label: 'Trainer ' + k, mons, bag, ai: rom[o + 28], important: bag.some((x) => x), itemIds: ITEMS3,
          commit() {
            this.bag.forEach((v, q) => w16(rom, o + 16 + q * 2, v)); rom[o + 28] = this.ai;
            this.mons.forEach((m) => {
              w16(rom, m._b + 4, m.species); rom[m._b + 2] = U.clamp(m.level, 1, 100); w16(rom, m._b, Math.min(255, m.iv));
              if (m.item !== null) w16(rom, m._b + 6, m.item);
              if (m.moves) m.moves.forEach((v, q) => w16(rom, m._b + mvOff + q * 2, v));
            }); } });
      }
    } else game.warnings.push('Trainerdata niet gevonden');

    // ---- Evoluties: per soort 5 x (methode, parameter, doel, 0) = 40 bytes ----
    game.evos = null;
    const bEvo = find(rom, '04 00 10 00 02 00 00 00', 0, rom.length, 4);
    if (bEvo >= 40 && r16(rom, bEvo + 40) === 4 && r16(rom, bEvo + 44) === 3) {
      const eb = bEvo - 40;
      game.evos = { methods: { trade: [5], tradeItem: [6], tradeSpecies: [], level: 4, heldDay: 0, heldNight: 0 }, list: [] };
      for (const sp of game.species) {
        const base = eb + sp.id * 40, ent = [];
        for (let k = 0; k < 5; k++) ent.push({ method: r16(rom, base + k * 8), param: r16(rom, base + k * 8 + 2), target: r16(rom, base + k * 8 + 4) });
        if (ent.some((e) => e.method > 15 || (e.method && !validSp(e.target)))) continue;
        game.evos.list.push({ species: sp.id, ent, commit() { this.ent.forEach((e, k) => { w16(rom, base + k * 8, e.method); w16(rom, base + k * 8 + 2, e.param); w16(rom, base + k * 8 + 4, e.target); }); } });
      }
    }
    game.tmItems = []; for (let i = 289; i <= 338; i++) game.tmItems.push(i);

    // ---- Namen voor de log: item-tabel (44 bytes per item, naam eerst) en aanvalnamen (13 bytes) ----
    const dec3 = (o, n) => { let s = ''; for (let k = 0; k < n; k++) { const c = rom[o + k]; if (c === 0xFF) break;
      s += c === 0 ? ' ' : c >= 0xBB && c <= 0xD4 ? String.fromCharCode(65 + c - 0xBB) : c >= 0xD5 && c <= 0xEE ? String.fromCharCode(97 + c - 0xD5)
        : c >= 0xA1 && c <= 0xAA ? String.fromCharCode(48 + c - 0xA1) : c === 0xAD ? '.' : c === 0xAE ? '-' : c === 0xB4 ? "'" : c === 0x1B ? 'é' : ''; } return s; };
    const enc3 = (t) => [...t].map((ch) => (ch === ' ' ? 0 : ch >= 'A' && ch <= 'Z' ? 0xBB + ch.charCodeAt(0) - 65 : 0));
    const mb = find(rom, enc3('MASTER BALL').concat([0xFF]));
    if (mb >= 44 && dec3(mb + 44, 14) === 'ULTRA BALL') { game.itemNames = []; for (let i = 0; i < 400; i++) game.itemNames.push(dec3(mb - 44 + i * 44, 14)); }
    const pd = find(rom, enc3('POUND').concat([0xFF]));
    const st = find(rom, enc3('STENCH').concat([0xFF]));
    if (st >= 13 && dec3(st + 13, 13) === 'DRIZZLE') { game.abilityNames = []; for (let i = 0; i <= 77; i++) game.abilityNames.push(dec3(st - 13 + i * 13, 13)); }
    if (pd >= 13 && dec3(pd + 13, 13) === 'KARATE CHOP') { game.moveNames = []; for (let i = 0; i <= 354; i++) game.moveNames.push(dec3(pd - 13 + i * 13, 13)); }

    // ---- TM-compatibiliteit: tabel van 8 bytes per soort (bit n = TM n+1; bits 50-57 = HM's, die blijven) ----
    {
      let tc = -1;
      for (let o = 0; o + 412 * 8 < rom.length && tc < 0; o += 4) {
        let ok = true;
        for (let q = 0; q < 8 && ok; q++) if (rom[o + q]) ok = false;
        for (let s = 252; s <= 276 && ok; s++) for (let q = 0; q < 8; q++) if (rom[o + s * 8 + q]) { ok = false; break; }
        if (!ok) continue;
        let nz = 0;
        for (let s = 1; s <= 411 && ok; s++) { if (rom[o + s * 8 + 7] & 0xFC) ok = false; for (let q = 0; q < 8; q++) if (rom[o + s * 8 + q]) { nz++; break; } }
        if (ok && nz > 350) tc = o;
      }
      if (tc >= 0) {
        game.hasTmCompat = true;
        for (const sp of game.species) { const b = tc + sp.id * 8; sp.tm = Array.from({ length: 50 }, (_, i) => !!(rom[b + (i >> 3)] & (1 << (i & 7)))); }
        const prev = game.commitSpecies;
        game.commitSpecies = (sp) => { prev(sp); const b = tc + sp.id * 8; sp.tm.forEach((v, i) => { const o = b + (i >> 3), bit = 1 << (i & 7); rom[o] = v ? rom[o] | bit : rom[o] & ~bit; }); };
      }
    }

    // ---- Shiny-kans: "(TID^SID^PIDhoog^PIDlaag) <= 7" (cmp rX,#7) op 5 plekken in de code -> drempel aanpassen ----
    {
      const sites = [];
      for (let o = 0; o < Math.min(rom.length, 0x400000); o += 2) {
        const w = r16(rom, o); if ((w & 0xF8FF) !== 0x2807) continue;
        const nx = r16(rom, o + 2) & 0xFF00; if (nx !== 0xD800 && nx !== 0xD900) continue;
        let eor = 0, lsr = 0;
        for (let k = 1; k <= 14; k++) { const p = r16(rom, o - k * 2); if ((p & 0xFFC0) === 0x4040) eor++; if ((p & 0xF800) === 0x0800 && ((p >> 6) & 31) === 16) lsr++; }
        if (eor >= 3 && lsr >= 1) sites.push(o);
      }
      if (sites.length >= 2 && sites.length <= 8) {
        game.shinyBase = 8192;
        game.setShinyOdds = (odds) => { const t = U.clamp(Math.round(65536 / odds), 8, 256); sites.forEach((o) => (rom[o] = t - 1)); return Math.round(65536 / t); };
      }
    }

    // ---- Itemprijzen (prijs 0 = key item / HM -> nooit verplaatsen) ----
    if (game.itemNames) { const base = mb - 44; game.itemPrice = (i) => (i >= 0 && i < 400 ? r16(rom, base + i * 44 + 16) : 0); }
    // basisitems (Gen 3-nummers): ballen, Potions, status-heals, Revive, Repels, Escape Rope
    game.basicItems = [1, 2, 3, 4, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 83, 84, 85, 86];

    // ---- Items in het veld + van NPC's: script "copyvar 0x8000 item; copyvar 0x8001 aantal; callstd 0/1" ----
    game.fieldItems = null;
    if (game.itemPrice) {
      const entries = [];
      for (let o = 0; o + 12 < rom.length; o++) {
        if (rom[o] !== 0x1A || rom[o + 1] !== 0 || rom[o + 2] !== 0x80 || rom[o + 5] !== 0x1A || rom[o + 6] !== 1 || rom[o + 7] !== 0x80 || rom[o + 10] !== 9 || rom[o + 11] > 1) continue;
        const it = r16(rom, o + 3), q = r16(rom, o + 8);
        if (it < 1 || it > 376 || !game.itemNames[it] || q < 1 || q > 99) continue;
        entries.push({ item: it, orig: it, qty: q, _o: o + 3 });
      }
      const ballCount = entries.length;
      const okIt = (it) => it >= 1 && it <= 376 && game.itemNames[it];
      // verborgen items: bg-events (type 7) in de MapEvents van elke map
      {
        const r32a = (o) => r32(rom, o) >>> 0, okP = (p, c) => (c === 0 ? p === 0 || p >>> 24 === 8 : p >>> 24 === 8 && (p & 0xFFFFFF) < rom.length);
        const seen = new Set();
        for (let o = 0; o + 20 < rom.length; o += 4) {
          const c = [rom[o], rom[o + 1], rom[o + 2], rom[o + 3]]; if (c[3] === 0 || c.some((x) => x > 64)) continue;
          const ps = [r32a(o + 4), r32a(o + 8), r32a(o + 12), r32a(o + 16)]; if (!ps.every((p, k) => okP(p, c[k]))) continue;
          const bg = ps[3] & 0xFFFFFF; let ok = true;
          for (let q = 0; q < c[3] && ok; q++) { const e = bg + q * 12; if (r16(rom, e) > 255 || r16(rom, e + 2) > 255 || rom[e + 4] > 15 || rom[e + 5] > 8) ok = false; }
          if (!ok) continue;
          for (let q = 0; q < c[3]; q++) { const e = bg + q * 12; if (rom[e + 5] === 7 && !seen.has(e) && okIt(r16(rom, e + 8))) { seen.add(e); entries.push({ item: r16(rom, e + 8), orig: r16(rom, e + 8), qty: 1, _o: e + 8, hidden: true }); } }
        }
      }
      // ruil/prijs-items (Game Corner e.d.): "checkitemspace ITEM, n" gevolgd door "additem ITEM, n"
      for (let o = 0; o + 0x40 < rom.length; o++) {
        if (rom[o] !== 0x46 || rom[o + 4] !== 0 || rom[o + 3] < 1 || rom[o + 3] > 99) continue;
        const it = r16(rom, o + 1); if (!okIt(it)) continue;
        for (let q = o + 5; q < o + 0x30; q++) if (rom[q] === 0x44 && r16(rom, q + 1) === it && rom[q + 3] === rom[o + 3] && rom[q + 4] === 0) {
          entries.push({ item: it, orig: it, qty: rom[o + 3], _o: o + 1, _o2: q + 1, prize: true }); break;
        }
      }
      // FireRed/LeafGreen-prijsmenu's: "setvar 0x4001 X; setvar 0x4002 prijs" (X = Pokémon of item)
      game._prizeMons = [];
      for (let o = 0; o + 12 < rom.length; o++) {
        if (rom[o] !== 0x16 || rom[o + 1] !== 1 || rom[o + 2] !== 0x40 || rom[o + 5] !== 0x16 || rom[o + 6] !== 2 || rom[o + 7] !== 0x40) continue;
        const v = r16(rom, o + 3);
        let isMon = false; for (let q = o; q < o + 0x200 && q + 3 < rom.length; q++) if (rom[q] === 0x79 && rom[q + 1] === 1 && rom[q + 2] === 0x40) { isMon = true; break; }
        if (isMon && validSp(v)) {
          const offs = [o + 3];
          for (let q = Math.max(0, o - 0x40); q < o + 0x300; q++) if (rom[q] === 0x21 && rom[q + 1] === 0 && rom[q + 2] === 0x80 && r16(rom, q + 3) === v) offs.push(q + 3);
          // level: "givemon 0x4001, LV" na de vergelijking met deze soort
          let lv = 5; for (const q of offs.slice(1)) { const t = q + 5; if (rom[t] === 0x06) { const p2 = (rom[t + 2] | (rom[t + 3] << 8) | (rom[t + 4] << 16)); if (p2 + 4 < rom.length && rom[p2] === 0x79) lv = rom[p2 + 3]; } }
          game._prizeMons.push({ species: v, offs, level: lv });
        } else if (!isMon && okIt(v)) entries.push({ item: v, orig: v, qty: 1, _o: o + 3, prize: true });
      }
      if (ballCount > 50) game.fieldItems = { entries, ballCount, commit() { this.entries.forEach((e) => { w16(rom, e._o, e.item); if (e._o2) w16(rom, e._o2, e.item); }); } };
    }

    // ---- Poké Marts: "pokemart <pointer>" (0x86) naar een lijst items die eindigt op 0 ----
    game.marts = null;
    if (game.itemPrice) {
      const seen = new Set(), slots = [];
      for (let o = 0; o + 5 < rom.length; o++) {
        if (rom[o] !== 0x86 || rom[o + 4] !== 0x08) continue;
        const p = rom[o + 1] | (rom[o + 2] << 8) | (rom[o + 3] << 16);
        if (p >= rom.length - 2 || p & 1 || seen.has(p)) continue;
        let k = 0; while (k < 40 && r16(rom, p + k * 2) >= 1 && r16(rom, p + k * 2) <= 376 && game.itemNames[r16(rom, p + k * 2)]) k++;
        if (k < 1 || k >= 40 || r16(rom, p + k * 2) !== 0) continue;
        seen.add(p);
        for (let q = 0; q < k; q++) { const it = r16(rom, p + q * 2); slots.push({ item: it, orig: it, _o: p + q * 2 }); }
      }
      if (seen.size >= 10) game.marts = { slots, commit() { this.slots.forEach((x) => w16(rom, x._o, x.item)); } };
    }

    // ---- Starters ----
    game.starters = null;
    const rse = find(rom, '15 01 18 01 1B 01', 0, rom.length, 2);
    if (fam !== 'FRLG' && rse >= 0) {
      game.starters = { species: [277, 280, 283], commit() { this.species.forEach((s, i) => w16(rom, rse + i * 2, s)); } };
    } else {
      // FRLG: "setvar 0x40xx, SPECIES" en "showmonpic SPECIES" in Oak's lab-script
      const ids = [1, 4, 7], hits = [];
      for (let o = 0; o < rom.length - 5; o++) if (rom[o] === 0x16 && rom[o + 2] === 0x40 && ids.includes(rom[o + 3]) && rom[o + 4] === 0 && rom[o + 1] < 0x20) hits.push(o + 3);
      let best = null;
      for (const h of hits) {
        const win = hits.filter((x) => x >= h && x < h + 0x800);
        if (ids.every((id) => win.some((x) => rom[x] === id)) && (!best || win.length > best.length)) best = win;
      }
      if (best) {
        const lo = best[0] - 0x200, hi = best[best.length - 1] + 0x200;
        const offs = best.slice();
        for (let o = lo; o < hi; o++) if (rom[o] === 0x75 && ids.includes(rom[o + 1]) && rom[o + 2] === 0 && rom[o + 3] < 30 && rom[o + 4] < 20) offs.push(o + 1);
        const idx = offs.map((o) => ids.indexOf(rom[o]));
        game.starters = { species: [1, 4, 7], experimental: true,
          commit() { offs.forEach((o, i) => w16(rom, o, this.species[idx[i]])); } };
      }
    }
    if (!game.starters) game.warnings.push('Starters niet gevonden');

    // ---- Starternaam + type in de tekst (FRLG: Oak's vraag; RSE: uitleg van je rivaal over types) ----
    let starterTextNew = null; const starterTextOrig = game.starters ? game.starters.species.slice() : null;
    if (game.starters) { const c0 = game.starters.commit.bind(game.starters); game.starters.commit = function () { c0(); starterTextNew = this.species.slice(); }; }
    const enc = (t) => [...t].map((ch) => (ch === ' ' ? 0 : ch >= 'A' && ch <= 'Z' ? 0xBB + ch.charCodeAt(0) - 65 : ch >= 'a' && ch <= 'z' ? 0xD5 + ch.charCodeAt(0) - 97 : ch === 'é' ? 0x1B : ch >= '0' && ch <= '9' ? 0xA1 + ch.charCodeAt(0) - 48 : ch === 'É' ? 0x1B : ch === '.' ? 0xAD : ch === '-' ? 0xAE : ch === "'" ? 0xB4 : ch === '♂' ? 0xB5 : ch === '♀' ? 0xB6 : ch === '/' ? 0xBA : ch === '!' ? 0xAB : ch === '?' ? 0xAC : ch === ',' ? 0xB8 : 0));
    const findB = (pat, from, to) => { for (let o = rom.indexOf(pat[0], from); o >= 0 && o + pat.length <= to; o = rom.indexOf(pat[0], o + 1)) { let k = 1; while (k < pat.length && rom[o + k] === pat[k]) k++; if (k === pat.length) return o; } return -1; };
    const strAt = (o) => { let e = o; while (e < rom.length && rom[e] !== 0xFF) e++; return [o, e]; };
    // vrije ruimte (0xFF) achteraan de ROM
    let freePtr = rom.length; while (freePtr > 0x100000 && rom[freePtr - 1] === 0xFF) freePtr--; freePtr = (freePtr + 0x100) & ~3;
    const putString = (oldStart, bytes) => { // bytes zonder 0xFF
      const [, oldEnd] = strAt(oldStart);
      if (bytes.length <= oldEnd - oldStart) { rom.set(bytes, oldStart); rom.fill(0xFF, oldStart + bytes.length, oldEnd + 1); return; }
      if (freePtr + bytes.length + 1 >= rom.length) return;
      const at = freePtr; rom.set(bytes, at); rom[at + bytes.length] = 0xFF; freePtr = (at + bytes.length + 4) & ~3;
      const v = 0x08000000 + oldStart, nv = 0x08000000 + at;
      for (let o = 0; o + 4 <= rom.length; o++) if (rom[o] === (v & 0xFF) && rom[o + 1] === ((v >> 8) & 0xFF) && rom[o + 2] === ((v >> 16) & 0xFF) && rom[o + 3] === 0x08) { rom[o] = nv & 0xFF; rom[o + 1] = (nv >> 8) & 0xFF; rom[o + 2] = (nv >> 16) & 0xFF; }
    };
    const writeStarterText = () => {
      if (!starterTextNew || !starterTextOrig || starterTextNew.join() === starterTextOrig.join()) return;
      const nmOf = (id) => PKDATA.nameOf(dexOf(id));
      const typeOf = (id) => { const sp = game.byId.get(id); const t = sp ? sp.types : ['Normal', 'Normal']; return t[0] === t[1] ? t[0] : t[0] + '/' + t[1]; };
      const origType = (id) => { const sp = game.byId.get(id); const t = sp ? sp._origTypes || sp.types : ['Normal']; return t[0]; };
      starterTextOrig.forEach((oid, i) => {
        const nid = starterTextNew[i], on = enc(nmOf(oid).toUpperCase()), nn = enc(nmOf(nid).toUpperCase());
        // alle zinnen waarin de starternaam + "POKéMON"/"type" voorkomt (keuze-vraag, uitleg over types)
        const isFR = fam === 'FRLG';
        let o = 0;
        while ((o = findB(on, o + 1, rom.length)) >= 0) {
          let st = o; while (st > 0 && rom[st - 1] !== 0xFF && o - st < 300) st--;
          const [, en] = strAt(st); const msg = Array.from(rom.slice(st, en));
          const hasType = findB(enc(origType(oid).toUpperCase()), st, en) >= 0;
          if (!hasType || en - st < on.length + 15) continue; // alleen echte zinnen met het type erin
          let m = msg.slice();
          if (!isFR && findB(enc('type'), st, en) >= 0) {
            // RSE-uitleg: vervang de hele uitleg door een korte, juiste versie
            m = enc('For example, your ').concat(nn, [0xFE], enc('is ' + (/^[AEIOU]/i.test(typeOf(nid)) ? 'an ' : 'a ') + typeOf(nid).toUpperCase() + ' type.'), [0xFB], enc('Every type is strong against some'), [0xFE], enc('types and weak against others.'));
          } else {
            const rep = (from, to) => { for (let k = 0; k + from.length <= m.length; k++) { if (from.every((c, q) => m[k + q] === c)) { m.splice(k, from.length, ...to); k += to.length - 1; } } };
            rep(enc(origType(oid).toUpperCase() + ' POK'), enc(typeOf(nid).toUpperCase() + ' POK'));
            rep(on, nn);
          }
          putString(st, m);
          o = en;
        }
      });
    };
    game._starterText = writeStarterText;

    // ---- Gift-Pokémon via script "givemon SOORT, LEVEL, ITEM, 0, 0, 0" (0x79, 15 bytes) en "giveegg" (0x7A) ----
    // (o.a. Beldum, Castform, fossielen, Lapras, Eevee, Hitmonlee/chan, Game Corner-prijzen, Magikarp-verkoper)
    game.statics = [];
    const starterSet = new Set(game.starters ? game.starters.species : []);
    const idOfDex = (d) => { const s = game.species.find((x) => x.dex === d); return s ? s.id : -1; };
    const eggSp = new Set([idOfDex(360), idOfDex(175)]); // Wynaut, Togepi
    for (let o = 0; o + 15 < rom.length; o++) {
      if (rom[o] === 0x79) {
        const s = r16(rom, o + 1), lv = rom[o + 3], it = r16(rom, o + 4);
        if (!validSp(s) || lv < 1 || lv > 100 || it > 400) continue;
        let zeros = true; for (let k = 6; k < 15; k++) if (rom[o + k] !== 0) { zeros = false; break; }
        if (!zeros || (starterSet.has(s) && lv === 5)) continue;
        game.statics.push({ kind: 'gift', label: 'Gift ' + PKDATA.nameOf(dexOf(s)), species: s, level: lv, commit() { w16(rom, o + 1, this.species); } });
      } else if (rom[o] === 0x7A && eggSp.has(r16(rom, o + 1))) {
        game.statics.push({ kind: 'gift', label: 'Ei (' + PKDATA.nameOf(dexOf(r16(rom, o + 1))) + ')', species: r16(rom, o + 1), level: 5, commit() { w16(rom, o + 1, this.species); } });
      }
    }
    if (game.statics.length > 60) game.statics = []; // onbetrouwbaar -> niets aanpassen
    // static encounters: "setwildbattle SOORT, LEVEL, ITEM" (0xB6) gevolgd door een gewone opdracht
    {
      const follow = new Set([0x25, 0x27, 0x28, 0x29, 0x2F, 0x30, 0xB7]);
      const storyIds = fam === 'RS' ? [382, 383] : [];
      for (let o = 0; o + 8 < rom.length; o++) {
        if (rom[o] !== 0xB6 || !follow.has(rom[o + 6])) continue;
        const sp = r16(rom, o + 1), lv = rom[o + 3], it = r16(rom, o + 4);
        if (!validSp(sp) || lv < 10 || lv > 100 || it > 376) continue;
        const d = dexOf(sp);
        if (fam === 'FRLG' && d === 105) continue; // spook-Marowak in Lavender Tower: speciaal gevecht, niet aanpassen
        game.statics.push({ kind: 'static', label: 'Static ' + PKDATA.nameOf(d), species: sp, level: lv, story: storyIds.includes(d), commit() { w16(rom, o + 1, this.species); } });
      }
    }
    for (const P of game._prizeMons || []) game.statics.push({ kind: 'gift', label: 'Game Corner ' + PKDATA.nameOf(dexOf(P.species)), species: P.species, level: P.level,
      commit() { P.offs.forEach((o) => w16(rom, o, this.species)); } });

    // ---- In-game trades: struct van 60 bytes (bijnaam, soort @12, ..., gevraagde soort @56) ----
    game.trades = [];
    const tOk = (o) => { let nm = false; for (let k = 0; k < 11; k++) if (rom[o + k] === 0xFF) { nm = k > 0; break; }
      return nm && validSp(r16(rom, o + 12)) && validSp(r16(rom, o + 56)); };
    for (let o = 0; o + 60 * 3 < rom.length && !game.trades.length; o += 4) {
      if (!tOk(o)) continue;
      let k = 0; while (k < 12 && tOk(o + k * 60)) k++;
      if (k < 3) continue;
      for (let i = 0; i < k; i++) {
        const e = o + i * 60;
        game.trades.push({ label: 'Trade ' + (i + 1), give: r16(rom, e + 12), req: r16(rom, e + 56), level: 0,
          commit() { w16(rom, e + 12, this.give); w16(rom, e + 56, this.req); } });
      }
    }
    game.finalize = () => { writeStarterText(); };
    return game;
  }

  g.GBA = {
    detect(rom) {
      if (rom.length < 0x200 || rom[0xB2] !== 0x96) return 0;
      return find(rom, '2D 31 31 2D 41 41 0C 03') >= 0 ? 3 : 0;
    },
    load,
  };
})(typeof window !== 'undefined' ? window : globalThis);
