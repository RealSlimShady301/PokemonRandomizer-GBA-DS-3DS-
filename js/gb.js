// Gen 1 (Rood/Blauw/Geel) en Gen 2 (Goud/Zilver/Kristal) – Game Boy / Game Boy Color.
// Alle tabellen worden via signaturen/structuur-scans gevonden, dus ook taalversies en veel hacks werken.
(function (g) {
  const { r16, find, findAll } = U;

  const G1_TYPES = { 0: 'Normal', 1: 'Fighting', 2: 'Flying', 3: 'Poison', 4: 'Ground', 5: 'Rock', 7: 'Bug', 8: 'Ghost',
    0x14: 'Fire', 0x15: 'Water', 0x16: 'Grass', 0x17: 'Electric', 0x18: 'Psychic', 0x19: 'Ice', 0x1A: 'Dragon' };
  const G2_TYPES = Object.assign({}, G1_TYPES, { 9: 'Steel', 0x1B: 'Dark' });

  const inv = (m) => { const r = {}; for (const k in m) r[m[k]] = +k; return r; };
  const bankOff = (bank, p) => bank * 0x4000 + (p - 0x4000);

  // Zoek een pointertabel (GB-bankpointers) met `count` items waarvan elk doel `valid(off)` haalt.
  function findPtrTable(rom, count, valid, minBank = 1) {
    const cache = new Map();
    const ok = (o) => { if (!cache.has(o)) cache.set(o, !!valid(o)); return cache.get(o); };
    for (let i = minBank * 0x4000; i + count * 2 <= rom.length; i++) {
      const bank = i >> 14;
      if (i + count * 2 > (bank + 1) * 0x4000) { i = (bank + 1) * 0x4000 - 1; continue; }
      let good = true;
      for (let j = 0; j < count; j++) {
        const p = r16(rom, i + j * 2);
        if (p < 0x4000 || p >= 0x8000 || !ok(bankOff(bank, p))) { good = false; break; }
      }
      if (good) return { off: i, bank };
    }
    return null;
  }

  // Trainer-klasse pointertabel: niet-dalende pointers, en elk bereik moet exact parsen.
  function findTrainerTable(rom, parseParty, minRun) {
    let best = null;
    for (let i = 0x4000; i < rom.length - minRun * 2; i++) {
      const bank = i >> 14;
      const bankEnd = (bank + 1) * 0x4000;
      let k = 0, filled = 0;
      while (i + (k + 2) * 2 <= bankEnd) {
        const a = r16(rom, i + k * 2), b = r16(rom, i + k * 2 + 2);
        if (a < 0x4000 || a >= 0x8000 || b < a || b >= 0x8000 || b - a > 0x800) break;
        let o = bankOff(bank, a); const end = bankOff(bank, b);
        let good = true;
        while (o < end) { const p = parseParty(o, bankEnd); if (!p) { good = false; break; } o = p.end; }
        if (!good || o !== end) break;
        if (end > bankOff(bank, a)) filled++;
        k++;
      }
      // een echte tabel heeft (bijna) overal trainers; een rij gelijke pointers telt niet
      if (k + 1 >= minRun && filled >= minRun * 0.8 && (!best || k + 1 > best.count)) best = { off: i, bank, count: k + 1 };
      if (k + 1 >= minRun) i += k * 2; // sla de gevonden tabel over
    }
    return best;
  }

  function load(rom, gen) {
    const isG1 = gen === 1;
    const title = String.fromCharCode(...rom.slice(0x134, 0x143)).replace(/[^\x20-\x7e]/g, '').trim();
    const game = { gen, platform: isG1 ? 'Game Boy' : 'Game Boy Color', name: title, rom, warnings: [], abilityMax: 0, hasTmCompat: true };
    const TYPES = isG1 ? G1_TYPES : G2_TYPES;
    const TYPE_CODE = inv(TYPES);
    game.typeNames = Object.values(TYPES);
    game.statNames = isG1 ? ['HP', 'Atk', 'Def', 'Spe', 'Spc'] : ['HP', 'Atk', 'Def', 'Spe', 'SpA', 'SpD'];

    // ---- Species / interne indexen ----
    const dexOf = new Array(256).fill(0); // intern -> dex
    let maxDex;
    if (isG1) {
      const ord = find(rom, '70 73 20 23 15 64 22 50 02 67');
      if (ord < 0) throw new Error('Pokédex-volgorde niet gevonden (Gen 1).');
      for (let i = 1; i <= 190; i++) { const d = rom[ord + i - 1]; if (d >= 1 && d <= 151) dexOf[i] = d; }
      maxDex = 151;
    } else {
      for (let i = 1; i <= 251; i++) dexOf[i] = i;
      maxDex = 251;
    }
    const idOfDex = []; for (let i = 1; i < 256; i++) if (dexOf[i]) idOfDex[dexOf[i]] = i;
    const validSp = (s) => s > 0 && s < 256 && dexOf[s] > 0;

    const bsSize = isG1 ? 28 : 32;
    const bs = isG1 ? find(rom, '01 2D 31 31 2D 41 16 03') : find(rom, '01 2D 31 31 2D 41 41 16 03');
    if (bs < 0) throw new Error('Basisstatistieken niet gevonden.');
    const mewOff = isG1 ? find(rom, '97 64 64 64 64 64 18 18') : -1;
    const bsOff = (dex) => (isG1 && dex === 151 ? mewOff : bs + (dex - 1) * bsSize);

    game.species = [];
    for (let dex = 1; dex <= maxDex; dex++) {
      const o = bsOff(dex);
      if (o < 0 || rom[o] !== dex) { game.warnings.push('Basisstats voor dex ' + dex + ' niet gevonden'); continue; }
      const nStats = isG1 ? 5 : 6;
      const stats = []; for (let k = 0; k < nStats; k++) stats.push(rom[o + 1 + k]);
      const tOff = o + 1 + nStats;
      const sp = { id: idOfDex[dex], dex, name: PKDATA.nameOf(dex), off: o, stats,
        types: [TYPES[rom[tOff]] || 'Normal', TYPES[rom[tOff + 1]] || 'Normal'],
        catchRate: rom[tOff + 2], growth: rom[o + (isG1 ? 19 : 22)], heldItems: isG1 ? null : [rom[o + 11], rom[o + 12]] };
      const tmBase = o + (isG1 ? 20 : 24);
      sp.tm = []; for (let t = 0; t < 50; t++) sp.tm.push(!!(rom[tmBase + (t >> 3)] & (1 << (t & 7))));
      sp._tmBase = tmBase; sp._tOff = tOff;
      game.species.push(sp);
    }
    game.byId = new Map(game.species.map((s) => [s.id, s]));
    game.commitSpecies = (sp) => {
      sp.stats.forEach((v, k) => (rom[sp.off + 1 + k] = U.clamp(v, 1, 255)));
      rom[sp._tOff] = TYPE_CODE[sp.types[0]]; rom[sp._tOff + 1] = TYPE_CODE[sp.types[1]];
      rom[sp._tOff + 2] = sp.catchRate; rom[sp.off + (isG1 ? 19 : 22)] = sp.growth;
      if (sp.heldItems) { rom[sp.off + 11] = sp.heldItems[0] & 0xFF; rom[sp.off + 12] = sp.heldItems[1] & 0xFF; }
      for (let t = 0; t < 50; t++) {
        const o = sp._tmBase + (t >> 3), bit = 1 << (t & 7);
        rom[o] = sp.tm[t] ? rom[o] | bit : rom[o] & ~bit;
      }
    };

    // ---- Aanvallen ----
    const maxMove = isG1 ? 164 : 251;
    const mvSize = isG1 ? 6 : 7;
    const mv = isG1 ? find(rom, '01 00 28 00 FF 23') : find(rom, '01 00 28 00 FF 23 00');
    game.moves = {
      valid: [], max: maxMove,
      info: (m) => (mv < 0 ? null : { power: rom[mv + (m - 1) * mvSize + 2], type: TYPES[rom[mv + (m - 1) * mvSize + 3]] }),
    };
    for (let m = 1; m <= maxMove; m++) if (m !== 165) game.moves.valid.push(m);

    // ---- TM's ----
    const tmOff = isG1 ? find(rom, '05 0D 0E 12 19 5C 20 22 24 26') : find(rom, 'DF 1D AE CD 2E 5C C0 F9 F4 ED');
    if (tmOff >= 0) {
      const hmCount = isG1 ? 5 : 7;
      game.tms = { moves: Array.from(rom.slice(tmOff, tmOff + 50)), hms: Array.from(rom.slice(tmOff + 50, tmOff + 50 + hmCount)),
        commit() { this.moves.forEach((m, i) => (rom[tmOff + i] = m)); } };
    } else game.warnings.push('TM-lijst niet gevonden');

    // ---- Evoluties + level-up aanvallen ----
    const parseEvoMoves = (o, bankEnd) => {
      let p = o, n = 0; const evos = [];
      while (true) {
        if (p >= bankEnd) return null;
        const t = rom[p++]; if (t === 0) break;
        let len;
        if (isG1) len = t === 1 || t === 3 ? 2 : t === 2 ? 3 : -1;
        else len = t >= 1 && t <= 4 ? 2 : t === 5 ? 3 : -1;
        if (len < 0 || ++n > 8) return null;
        const target = rom[p + len - 1]; if (!(target > 0 && target <= (isG1 ? 190 : 251))) return null;
        evos.push({ typeOff: p - 1, paramOff: len === 2 ? p : -1, targetOff: p + len - 1 });
        p += len;
      }
      const moves = []; let inv = 0;
      while (true) {
        if (p >= bankEnd) return null;
        const lvl = rom[p]; if (lvl === 0) break;
        const m = rom[p + 1];
        if (lvl > 100 || m === 0 || m > maxMove + 1 || moves.length > 30) return null;
        if (moves.length && lvl < moves[moves.length - 1].level && ++inv > 2) return null; // (Muk in Crystal staat niet op volgorde)
        moves.push({ level: lvl, move: m, off: p + 1 }); p += 2;
      }
      return { moves, evos, end: p + 1 };
    };
    const lsCount = isG1 ? 190 : 251;
    const lsTab = findPtrTable(rom, lsCount, (o) => { const r = parseEvoMoves(o, ((o >> 14) + 1) * 0x4000); return r && (r.moves.length > 0 || isG1); });
    game.learnsets = new Map();
    if (lsTab) {
      for (let i = 0; i < lsCount; i++) {
        const id = i + 1; if (!validSp(id)) continue;
        const o = bankOff(lsTab.bank, r16(rom, lsTab.off + i * 2));
        const r = parseEvoMoves(o, (lsTab.bank + 1) * 0x4000);
        const entries = r.moves.map((m) => ({ level: m.level, move: m.move, _off: m.off }));
        if (r.evos.length) {
          if (!game.evos) game.evos = { methods: { trade: [3], tradeItem: [], tradeSpecies: [], level: 1, heldDay: 0, heldNight: 0 }, list: [] };
          const ev = r.evos;
          // alleen evoluties met 2 parameters (level/ruil/item) kunnen veilig van methode wisselen
          game.evos.list.push({ species: id, ent: ev.map((e) => ({ method: rom[e.typeOff], param: e.paramOff >= 0 ? rom[e.paramOff] : 0, target: rom[e.targetOff], _e: e })),
            commit() { this.ent.forEach((x) => { if (x._e.paramOff >= 0) { rom[x._e.typeOff] = x.method; rom[x._e.paramOff] = x.param; } rom[x._e.targetOff] = x.target; }); } });
        }
        game.learnsets.set(id, { entries, commit() { this.entries.forEach((e) => (rom[e._off] = e.move)); } });
      }
    } else game.warnings.push('Level-up aanvallen niet gevonden');
    // Gen 1: aanvallen die je op level 1 kent staan in de basisstats
    if (isG1) for (const sp of game.species) {
      const ls = game.learnsets.get(sp.id); if (!ls) continue;
      const base = sp.off + 15;
      const lv1 = []; for (let k = 0; k < 4; k++) if (rom[base + k]) lv1.push({ level: 1, move: rom[base + k], _off: base + k });
      ls.entries = lv1.concat(ls.entries);
    }

    // ---- Wilde Pokémon ----
    game.wild = [];
    const okLvl = (l) => l >= 1 && l <= 100;
    if (isG1) {
      const parseW = (o) => {
        let p = o; const res = [];
        for (let part = 0; part < 2; part++) {
          const rate = rom[p++];
          if (rate) for (let k = 0; k < 10; k++, p += 2) { if (!okLvl(rom[p]) || !validSp(rom[p + 1])) return null; res.push({ lvlOff: p, spOff: p + 1, part }); }
        }
        return res;
      };
      const cache = new Map();
      const vw = (o) => { if (!cache.has(o)) cache.set(o, parseW(o)); return cache.get(o); };
      let table = null;
      for (let i = 0x4000; i < rom.length - 400 && !table; i++) {
        const bank = i >> 14; let k = 0;
        while (true) {
          const p = r16(rom, i + k * 2);
          if (p < 0x4000 || p >= 0x8000 || !vw(bankOff(bank, p))) break; k++;
        }
        if (k >= 200) table = { off: i, bank, count: k };

      }
      if (table) {
        const seen = new Set();
        for (let j = 0; j < table.count; j++) {
          const o = bankOff(table.bank, r16(rom, table.off + j * 2));
          if (seen.has(o)) continue; seen.add(o);
          const raw = vw(o); if (!raw.length) continue;
          for (const part of [0, 1]) {
            const rs = raw.filter((x) => x.part === part); if (!rs.length) continue;
            game.wild.push(mkArea('Map ' + j + (part ? ' (water)' : ' (gras/grot)'), rs));
          }
        }
      } else game.warnings.push('Wilde Pokémon niet gevonden');
    } else {
      const grassRec = (o) => {
        if (!(rom[o] >= 1 && rom[o] <= 40 && rom[o + 1] >= 1 && rom[o + 1] <= 130)) return false;
        for (let k = 2; k < 5; k++) if (rom[o + k] === 0) return false;
        for (let k = 0; k < 21; k++) if (!okLvl(rom[o + 5 + k * 2]) || !validSp(rom[o + 6 + k * 2])) return false;
        return true;
      };
      const waterRec = (o) => {
        if (!(rom[o] >= 1 && rom[o] <= 40 && rom[o + 1] >= 1 && rom[o + 1] <= 130 && rom[o + 2] > 0)) return false;
        for (let k = 0; k < 3; k++) if (!okLvl(rom[o + 3 + k * 2]) || !validSp(rom[o + 4 + k * 2])) return false;
        return true;
      };
      const used = [];
      const scan = (recFn, size, minRecs, kind) => {
        for (let i = 0; i < rom.length - size * minRecs; i++) {
          if (used.some(([a, b]) => i >= a && i < b)) continue;
          let k = 0; while (recFn(i + k * size)) k++;
          if (k >= minRecs && rom[i + k * size] === 0xFF) {
            used.push([i, i + k * size]);
            for (let r = 0; r < k; r++) {
              const o = i + r * size, label = kind + ' groep ' + rom[o] + ' map ' + rom[o + 1];
              const slots = [];
              if (size === 47) for (let s = 0; s < 21; s++) slots.push({ lvlOff: o + 5 + s * 2, spOff: o + 6 + s * 2 });
              else for (let s = 0; s < 3; s++) slots.push({ lvlOff: o + 3 + s * 2, spOff: o + 4 + s * 2 });
              game.wild.push(mkArea(label, slots));
            }
            i += k * size;
          }
        }
      };
      scan(grassRec, 47, 5, 'Gras');
      scan(waterRec, 9, 5, 'Water');
      if (!game.wild.length) game.warnings.push('Wilde Pokémon niet gevonden');
    }
    function mkArea(label, raw) {
      const area = { label, slots: raw.map((x) => ({ species: rom[x.spOff], min: rom[x.lvlOff], max: rom[x.lvlOff], _x: x })),
        commit() { this.slots.forEach((s) => { rom[s._x.spOff] = s.species; rom[s._x.lvlOff] = U.clamp(s.min, 1, 100); }); } };
      return area;
    }

    // ---- Trainers ----
    game.trainers = [];
    const parseParty = isG1
      ? (o, bankEnd) => {
        let p = o; const mons = []; const first = rom[p++];
        if (first === 0xFF) {
          while (p < bankEnd && rom[p] !== 0) { if (!okLvl(rom[p]) || !validSp(rom[p + 1])) return null; mons.push({ lvlOff: p, spOff: p + 1 }); p += 2; }
        } else {
          if (!okLvl(first)) return null;
          while (p < bankEnd && rom[p] !== 0) { if (!validSp(rom[p])) return null; mons.push({ lvlOff: o, spOff: p }); p++; }
        }
        if (mons.length < 1 || mons.length > 6 || p >= bankEnd) return null;
        return { mons, end: p + 1 };
      }
      : (o, bankEnd) => {
        let p = o, n = 0;
        while (rom[p] !== 0x50) { const c = rom[p]; if (c < 0x60 || ++n > 12) return null; p++; }
        if (n < 1) return null;
        p++; const type = rom[p++]; if (type > 3) return null;
        const mons = [];
        while (p < bankEnd && rom[p] !== 0xFF) {
          if (!okLvl(rom[p]) || !validSp(rom[p + 1])) return null;
          const m = { lvlOff: p, spOff: p + 1 }; p += 2;
          if (type & 2) p++;
          if (type & 1) { for (let k = 0; k < 4; k++) if (rom[p + k] > maxMove + 1) return null; m.movesOff = p; p += 4; }
          mons.push(m);
          if (mons.length > 6) return null;
        }
        if (!mons.length || p >= bankEnd) return null;
        return { mons, end: p + 1 };
      };
    const tt = findTrainerTable(rom, parseParty, isG1 ? 40 : 55);
    if (tt) {
      for (let c = 0; c < tt.count; c++) {
        let o = bankOff(tt.bank, r16(rom, tt.off + c * 2));
        const end = c + 1 < tt.count ? bankOff(tt.bank, r16(rom, tt.off + c * 2 + 2)) : -1;
        let n = 0;
        while (end < 0 ? n < 1 : o < end) {
          const p = parseParty(o, (tt.bank + 1) * 0x4000); if (!p) break;
          n++; o = p.end;
          game.trainers.push({
            label: 'Klasse ' + (c + 1) + ' #' + n, cls: c + 1,
            mons: p.mons.map((m) => ({ species: rom[m.spOff], level: rom[m.lvlOff], moves: m.movesOff ? Array.from(rom.slice(m.movesOff, m.movesOff + 4)) : null, _m: m })),
            commit() { this.mons.forEach((m) => { rom[m._m.spOff] = m.species; rom[m._m.lvlOff] = U.clamp(m.level, 1, 100); if (m.moves && m._m.movesOff) m.moves.forEach((v, k) => (rom[m._m.movesOff + k] = v)); }); },
          });
        }
      }
    } else game.warnings.push('Trainerdata niet gevonden');

    // ---- Starters ----
    game.starters = null;
    if (isG1 && !/YELLOW/i.test(title)) {
      // Bulbasaur 0x99, Charmander 0xB0, Squirtle 0xB1 als "ld a, X" in bank 7 (Oak's lab)
      const ids = [0x99, 0xB0, 0xB1];
      const hits = [];
      for (let o = 0x1C000; o < Math.min(0x20000, rom.length - 1); o++) if (rom[o] === 0x3E && ids.includes(rom[o + 1])) hits.push(o + 1);
      let bestWin = null;
      for (const h of hits) {
        const win = hits.filter((x) => x >= h && x < h + 0x500);
        if (ids.every((id) => win.some((x) => rom[x] === id)) && (!bestWin || win.length > bestWin.length)) bestWin = win;
      }
      if (bestWin) {
        const map = { 0x99: 0, 0xB0: 1, 0xB1: 2 };
        const offs = bestWin.map((o) => ({ o, i: map[rom[o]] }));
        game.starters = { species: [0x99, 0xB0, 0xB1], experimental: true,
          commit() { offs.forEach(({ o, i }) => (rom[o] = this.species[i])); } };
      }
    } else if (!isG1) {
      const pats = [0x9B, 0x9E, 0x98].map((s) => find(rom, [0x2D, s, 0x05]));
      if (pats.every((x) => x >= 0)) {
        game.starters = { species: [155, 158, 152], note: 'Plaatje/geluid vóór het kiezen blijft de originele starter.',
          commit() { pats.forEach((o, i) => (rom[o + 1] = this.species[i])); } };
      }
    }
    if (!game.starters) game.warnings.push('Starters niet gevonden voor deze ROM (bijv. Geel heeft vaste Pikachu)');
    // ---- Gen 2: Elm's vraag "So, you like CHIKORITA, the grass #MON?" -> nieuwe naam en type (op dezelfde plek) ----
    let starterTxt = null;
    if (!isG1 && game.starters) {
      const orig = game.starters.species.slice(), c0 = game.starters.commit.bind(game.starters);
      game.starters.commit = function () { c0(); starterTxt = { orig, now: this.species.slice() }; };
    }
    const g2enc = (t) => [...t].map((c) => (c === ' ' ? 0x7F : c >= 'A' && c <= 'Z' ? 0x80 + c.charCodeAt(0) - 65 : c >= 'a' && c <= 'z' ? 0xA0 + c.charCodeAt(0) - 97 : c === ',' ? 0xF4 : c === '-' ? 0xE3 : c === '.' ? 0xE8 : c === "'" ? 0xE0 : 0x7F));
    const writeStarterText2 = () => {
      if (!starterTxt) return;
      starterTxt.orig.forEach((oid, i) => {
        const nid = starterTxt.now[i]; if (nid === oid) return;
        const on = g2enc(PKDATA.nameOf(dexOf[oid] || oid).toUpperCase());
        const sp = game.byId.get(nid); const t = sp ? sp.types : ['Normal'];
        const nn = g2enc(PKDATA.nameOf(dexOf[nid] || nid).toUpperCase().replace('♀', '').replace('♂', ''));
        for (let p = find(rom, on); p >= 0; p = find(rom, on, p + 1)) {
          // zin: ... NAAM, the<regel>type #MON? <einde>
          let e = p; while (e < rom.length && rom[e] !== 0x50 && rom[e] !== 0x57 && rom[e] !== 0x58 && e - p < 60) e++;
          if (rom[p + on.length] !== 0xF4) continue; // komma na de naam
          const tail = Array.from(rom.slice(p, e)); const mon = tail.indexOf(0x54); if (mon < 0) continue; // '#MON'
          const room = e - p, br = tail.find((c, k) => k > on.length && (c === 0x4F || c === 0x51 || c === 0x55)) || 0x4F;
          const tw = (x) => g2enc(x.toLowerCase());
          const variants = [nn.concat(g2enc(', the'), [br], tw(t[0] === t[1] ? t[0] : t[0] + '-' + t[1]), [0x7F], tail.slice(mon)),
            nn.concat(g2enc(', the'), [br], tw(t[0]), [0x7F], tail.slice(mon)), nn.concat([0xF4, br], tw(t[0]), [0x7F], tail.slice(mon))];
          const v = variants.find((x) => x.length <= room); if (!v) continue;
          const endCh = rom[e]; rom.set(v, p); rom[p + v.length] = endCh; if (p + v.length + 1 <= e) rom.fill(0x50, p + v.length + 1, e + 1);
          // het einde-teken van de oorspronkelijke zin blijft op zijn plek
          break;
        }
      });
    };

    // ---- Namen voor de log: lijsten van namen achter elkaar, elk afgesloten met '@' (0x50) ----
    const decGB = (o) => { let s = ''; for (let k = 0; k < 20; k++) { const c = rom[o + k]; if (c === 0x50) return [s, o + k + 1];
      s += c >= 0x80 && c <= 0x99 ? String.fromCharCode(65 + c - 0x80) : c >= 0xA0 && c <= 0xB9 ? String.fromCharCode(97 + c - 0xA0)
        : c === 0x7F ? ' ' : c === 0xE3 ? '-' : c === 0xE8 ? '.' : c >= 0xF6 ? String.fromCharCode(48 + c - 0xF6) : ''; } return [s, -1]; };
    const encGB = (t) => [...t].map((ch) => (ch === ' ' ? 0x7F : 0x80 + ch.charCodeAt(0) - 65)).concat([0x50]);
    const readList = (first, second, n) => {
      const o = find(rom, encGB(first).concat(encGB(second))); if (o < 0) return null;
      const out = ['']; let p = o;
      for (let i = 0; i < n && p >= 0; i++) { const [s, nx] = decGB(p); out.push(s); p = nx; }
      return out;
    };
    game.moveNames = readList('POUND', 'KARATE CHOP', maxMove + 1);
    game.itemNames = readList('MASTER BALL', 'ULTRA BALL', isG1 ? 97 : 255);

    // ---- Gen 2: itemprijzen, item-balls in het veld en Poké Marts ----
    if (!isG1 && game.itemNames) {
      const names = game.itemNames;
      game.tmItems = []; names.forEach((n, i) => { if (/^TM\d\d/.test(n || '')) game.tmItems.push(i); });
      game.basicItems = []; names.forEach((n, i) => { if (/BALL$|POTION|ANTIDOTE|HEAL|AWAKENING|REVIVE|REPEL|ESCAPE ROPE|FULL RESTORE/.test(n || '') && !/MASTER|PARK|LURE|LEVEL|MOON|FAST|FRIEND|HEAVY|LOVE|GS |SMOKE|LIGHT|SECRET|POWDER/.test(n)) game.basicItems.push(i); });
      // attributen: 7 bytes per item, prijs u16 eerst (Master Ball 0, Ultra Ball 1200, Brightpowder 10, Great Ball 600, Poké Ball 200)
      let at = -1;
      for (let o = 0; o + 40 < rom.length && at < 0; o++) if (r16(rom, o) === 0 && r16(rom, o + 7) === 1200 && r16(rom, o + 14) === 10 && r16(rom, o + 21) === 600 && r16(rom, o + 28) === 200) at = o;
      if (at >= 0) game.itemPrice = (i) => (i >= 1 && i <= 0xF9 ? r16(rom, at + (i - 1) * 7) : 0);
      const okItem = (i) => i >= 1 && i <= 0xF9 && names[i] && !/^\?|TERU-SAMA/.test(names[i]);
      // item-balls: object-events met sprite Poké Ball (0x54), type "itemball", script -> [item, aantal]
      if (game.itemPrice) {
        const entries = [];
        for (let o = 0x4000; o + 13 < rom.length; o++) {
          if (rom[o] !== 0x54 || (rom[o + 7] & 0x0F) !== 1 || rom[o + 5] !== 0xFF || rom[o + 6] !== 0xFF) continue;
          const p = r16(rom, o + 9); if (p < 0x4000 || p >= 0x8000) continue;
          const t = bankOff(o >> 14, p), it = rom[t], q = rom[t + 1];
          if (!okItem(it) || q < 1 || q > 99) continue;
          entries.push({ item: it, orig: it, qty: q, _o: t });
        }
        const ballCount = entries.length;
        // verborgen items: bg-event-lijsten (aantal, dan [y, x, functie, pointer] x n); functie 7 = item -> [vlag u16, item]
        const seenBg = new Set();
        for (let o = 0x4000; o + 6 < rom.length; o++) {
          const n = rom[o]; if (n < 1 || n > 24) continue;
          let ok = true, has = false;
          for (let q = 0; q < n && ok; q++) { const e = o + 1 + q * 5; if (rom[e] >= 100 || rom[e + 1] >= 100 || rom[e + 2] > 8) ok = false; const p = r16(rom, e + 3); if (p < 0x4000 || p >= 0x8000) ok = false; if (rom[e + 2] === 7) has = true; }
          if (!ok || !has || rom[o + 1 + n * 5] > 16) continue;
          for (let q = 0; q < n; q++) {
            const e = o + 1 + q * 5; if (rom[e + 2] !== 7 || seenBg.has(e)) continue;
            const t = bankOff(e >> 14, r16(rom, e + 3)), it = rom[t + 2];
            if (r16(rom, t) < 0x400 && okItem(it)) { seenBg.add(e); entries.push({ item: it, orig: it, qty: 1, _o: t + 2, hidden: true }); }
          }
        }
        if (ballCount > 50) game.fieldItems = { entries, ballCount, commit() { this.entries.forEach((e) => (rom[e._o] = e.item)); } };
        // Poké Marts: pointertabel naar [aantal, items..., 0xFF]
        const isMart = (t) => { const n = rom[t]; if (n < 1 || n > 15) return false; for (let q = 1; q <= n; q++) if (!okItem(rom[t + q])) return false; return rom[t + n + 1] === 0xFF; };
        let best = null;
        for (let o = 0x4000; o + 4 < rom.length; o++) {
          const bank = o >> 14; let k = 0;
          while (true) { const p = r16(rom, o + k * 2); if (p < 0x4000 || p >= 0x8000 || !isMart(bankOff(bank, p))) break; k++; }
          if (k >= 20 && (!best || k > best.k)) best = { o, k, bank };
          if (k >= 20) o += k * 2;
        }
        if (best) {
          const slots = [], seen = new Set();
          for (let i = 0; i < best.k; i++) {
            const t = bankOff(best.bank, r16(rom, best.o + i * 2)); if (seen.has(t)) continue; seen.add(t);
            for (let q = 1; q <= rom[t]; q++) slots.push({ item: rom[t + q], orig: rom[t + q], _o: t + q });
          }
          game.marts = { slots, commit() { this.slots.forEach((x) => (rom[x._o] = x.item)); } };
        }
      }
      {
        // Headbutt-bomen / Rock Smash: lijsten (kans, soort, level) die optellen tot 100, eindigend op 0xFF, dicht bij elkaar
        const lists = [];
        for (let o = 0x4000; o + 40 < rom.length; o++) {
          let p = o, sum = 0, n = 0;
          while (rom[p] !== 0xFF && n < 12) { if (rom[p] < 1 || rom[p] > 100 || !validSp(rom[p + 1]) || rom[p + 2] < 1 || rom[p + 2] > 100) break; sum += rom[p]; p += 3; n++; }
          if (rom[p] === 0xFF && sum === 100 && n >= 3) { lists.push({ o, n, end: p + 1 }); o = p; }
        }
        let best = [], cur = [];
        for (const L2 of lists) { if (cur.length && L2.o - cur[cur.length - 1].end > 0x20) cur = []; cur.push(L2); if (cur.length > best.length) best = cur.slice(); }
        if (best.length >= 6) best.forEach((L2, i) => {
          const slots = []; for (let q = 0; q < L2.n; q++) { const o = L2.o + q * 3; slots.push({ species: rom[o + 1], min: rom[o + 2], max: rom[o + 2], _o: o }); }
          game.wild.push({ label: 'Headbutt/Rock Smash ' + (i + 1), slots, commit() { this.slots.forEach((x) => { rom[x._o + 1] = x.species; rom[x._o + 2] = U.clamp(x.min, 1, 100); }); } });
        });
        // Bug-Catching Contest: 10 x (kans, soort, min, max), kansen samen 100, vooral Bug-types
        for (let o = 0x4000; o + 40 < rom.length; o++) {
          let sum = 0, n = 0, bug = 0;
          while (n < 10) { const p = o + n * 4; if (rom[p] < 1 || rom[p] > 100 || !validSp(rom[p + 1]) || rom[p + 2] < 1 || rom[p + 3] < rom[p + 2] || rom[p + 3] > 100) break; sum += rom[p]; const sp = game.byId.get(rom[p + 1]); if (sp && sp.types.includes('Bug')) bug++; n++; }
          if (n === 10 && sum === 100 && bug >= 8) {
            const slots = []; for (let q = 0; q < 10; q++) { const p = o + q * 4; slots.push({ species: rom[p + 1], min: rom[p + 2], max: rom[p + 3], _o: p }); }
            game.wild.push({ label: 'Bug-Catching Contest', slots, commit() { this.slots.forEach((x) => { rom[x._o + 1] = x.species; rom[x._o + 2] = U.clamp(x.min, 1, 100); rom[x._o + 3] = U.clamp(Math.max(x.min, x.max), 1, 100); }); } });
            break;
          }
        }
      }
    }

    // ---- Gift-Pokémon, Game Corner-prijzen, Magikarp-verkoper ----
    game.statics = [];
    const addGift = (label, offs, level) => game.statics.push({ kind: 'gift', label, species: rom[offs[0]], level,
      commit() { offs.forEach((o) => (rom[o] = this.species)); } });
    if (isG1) {
      // "lb bc, SOORT, LEVEL ; call GivePokemon" = 01 LV SP CD lo hi -> de meest gebruikte call-bestemming is GivePokemon
      const calls = new Map();
      for (let o = 0; o + 6 < rom.length; o++) {
        if (rom[o] !== 0x01 || rom[o + 3] !== 0xCD || rom[o + 1] < 3 || rom[o + 1] > 70 || !validSp(rom[o + 2])) continue;
        const t = r16(rom, o + 4); if (t >= 0x4000) continue; // GivePokemon staat in bank 0
        if (!calls.has(t)) calls.set(t, []); calls.get(t).push(o);
      }
      const best = [...calls.values()].sort((a, b) => b.length - a.length)[0];
      if (best && best.length >= 3 && best.length <= 25) best.forEach((o) => addGift('Gift ' + PKDATA.nameOf(dexOf[rom[o + 2]]), [o + 2], rom[o + 1]));
      // Game Corner: level-tabel (Abra 9, Clefairy 8, ...) + menu-lijsten (soorten gevolgd door '@' = 0x50)
      const ab = idOfDex[63], cl = idOfDex[35];
      const lvTab = find(rom, [ab, 9, cl, 8]);
      if (lvTab >= 0) {
        const prize = [];
        for (let o = lvTab; o + 1 < rom.length && validSp(rom[o]) && rom[o + 1] >= 1 && rom[o + 1] <= 100 && prize.length < 12; o += 2) prize.push({ sp: rom[o], lvOff: o + 1, offs: [o] });
        for (const p of prize) {
          // dezelfde soort in de menu-lijsten (vlak bij elkaar, eindigend op 0x50)
          for (let o = Math.max(0, lvTab - 0x400); o < Math.min(rom.length, lvTab + 0x400); o++) {
            if (rom[o] !== p.sp || p.offs.includes(o)) continue;
            let k = o; while (k > o - 3 && validSp(rom[k - 1])) k--;
            let e = o; while (e < o + 3 && validSp(rom[e + 1])) e++;
            if (rom[e + 1] === 0x50 && e - k === 2) p.offs.push(o);
          }
          if (p.offs.length >= 2) addGift('Game Corner ' + PKDATA.nameOf(dexOf[p.sp]), p.offs, rom[p.lvOff]);
        }
      }
    } else {
      // Gen 2: "givepoke SOORT, LEVEL, ITEM, 0/1" (0x2D) voor bekende gift-Pokémon, en "giveegg TOGEPI" (0x2E)
      const giftSp = new Set([133, 213, 147, 236, 63, 104, 23, 202, 25, 137, 246, 21, 129, 26]);
      for (let o = 0; o + 5 < rom.length; o++) {
        if (rom[o] === 0x2D && giftSp.has(rom[o + 1]) && rom[o + 2] >= 5 && rom[o + 2] <= 50 && rom[o + 4] <= 1) addGift('Gift ' + PKDATA.nameOf(rom[o + 1]), [o + 1], rom[o + 2]);
        if (rom[o] === 0x2E && rom[o + 1] === 175 && rom[o + 2] === 5) addGift('Ei (Togepi)', [o + 1], 5);
      }
      if (game.statics.length > 30) game.statics = []; // onbetrouwbaar -> niets aanpassen
    }

    // ---- In-game trades ----
    game.trades = [];
    const nameOk = (o, len) => { for (let k = 0; k < len; k++) { if (rom[o + k] === 0x50) return k > 0; if (rom[o + k] < 0x7F) return false; } return false; };
    const tradeOk = isG1
      ? (o) => validSp(rom[o]) && validSp(rom[o + 1]) && rom[o + 2] <= 3 && nameOk(o + 3, 11)
      : (o) => rom[o] <= 3 && validSp(rom[o + 1]) && validSp(rom[o + 2]) && nameOk(o + 3, 11) && nameOk(o + 19, 11);
    const tStride = isG1 ? 14 : 32;
    for (let o = 0; o + tStride * 4 < rom.length && !game.trades.length; o++) {
      let k = 0; while (k < 15 && tradeOk(o + k * tStride)) k++;
      if (k < 4) continue;
      for (let i = 0; i < k; i++) {
        const e = o + i * tStride, gOff = isG1 ? e + 1 : e + 2, rOff = isG1 ? e : e + 1;
        game.trades.push({ label: 'Trade ' + (i + 1), give: rom[gOff], req: rom[rOff], level: 0,
          commit() { rom[gOff] = this.give; rom[rOff] = this.req; } });
      }
    }

    game.finalize = () => { writeStarterText2(); // daarna de globale checksum herberekenen
      let sum = 0; for (let i = 0; i < rom.length; i++) if (i !== 0x14E && i !== 0x14F) sum += rom[i];
      rom[0x14E] = (sum >> 8) & 0xff; rom[0x14F] = sum & 0xff;
    };
    return game;
  }

  g.GB = {
    detect(rom) {
      if (rom.length < 0x8000 || rom.length > 0x400000) return 0;
      // Nintendo-logo check
      if (rom[0x104] !== 0xCE || rom[0x105] !== 0xED) return 0;
      if (find(rom, '01 2D 31 31 2D 41 16 03') >= 0) return 1;
      if (find(rom, '01 2D 31 31 2D 41 41 16 03') >= 0) return 2;
      return 0;
    },
    load,
  };
})(typeof window !== 'undefined' ? window : globalThis);
