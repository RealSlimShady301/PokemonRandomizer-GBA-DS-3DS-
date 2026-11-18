// De eigenlijke randomizer: werkt op het gedeelde game-model dat elke module oplevert.
(function (g) {
  function detectAndLoad(rom) {
    let gen;
    if ((gen = NDS.detect(rom))) return NDS.load(rom);
    if ((gen = GBA.detect(rom))) return GBA.load(rom);
    if ((gen = GB.detect(rom))) return GB.load(rom, gen);
    // Mystery Dungeon (DS/GBA): herkend, maar nog niet ondersteund (zie ROADMAP.md)
    const code = rom.length > 0x10 ? String.fromCharCode(rom[0x0C], rom[0x0D], rom[0x0E]) : '', gbaCode = rom.length > 0xB0 ? String.fromCharCode(rom[0xAC], rom[0xAD], rom[0xAE]) : '';
    if (['C2S', 'YFT', 'YFY', 'APH'].includes(code) || gbaCode === 'B24') throw new Error('Pokémon Mystery Dungeon wordt herkend, maar kan nog niet gerandomized worden (gepland).');
    throw new Error('Onbekende ROM. Ondersteund: Pokémon Gen 1-7 (GB, GBC, GBA, DS, 3DS) en hacks die daarop gebaseerd zijn.');
  }

  function randomize(game, opt, log) {
    const R = U.makeRng(String(opt.seed));
    // Log in de taal van de website (Engels: kopjes en vaste zinnen vertaald)
    const EN = opt.lang === 'en' ? [
      [/^--- Abilities ---$/, '--- Abilities ---'], [/^--- Basisstats \((.*)\) ---$/, '--- Base stats ($1) ---'],
      [/^--- Daycare-eieren \(normaal ei -> nieuw ei\) ---$/, '--- Daycare eggs (normal egg -> new egg) ---'], [/^--- Evoluties ---$/, '--- Evolutions ---'],
      [/^--- In-game trades \(je geeft -> je krijgt\) ---$/, '--- In-game trades (you give -> you get) ---'], [/^--- Items van wilde Pokémon: willekeurig gemaakt ---$/, '--- Items held by wild Pokémon: randomized ---'],
      [/^--- Level-up aanvallen ---$/, '--- Level-up moves ---'], [/^--- Makkelijker te vangen \(eerste routes, catch rate minstens (\d+)\) ---$/, '--- Easier to catch (first routes, catch rate at least $1) ---'],
      [/^--- Opmerkingen ---$/, '--- Notes ---'], [/^--- Shiny-kans ---$/, '--- Shiny chance ---'], [/^--- Speciale winkels ---$/, '--- Shops ---'],
      [/^--- Static encounters & gift-Pokémon ---$/, '--- Static encounters & gift Pokémon ---'], [/^--- Story-legendaries verzwakt ---$/, '--- Story legendaries weakened ---'],
      [/^--- Types ---$/, '--- Types ---'], [/^--- Veld-items ---$/, '--- Field items ---'], [/^--- Wilde Pokémon ---$/, '--- Wild Pokémon ---'],
      [/^--- XP-rem: basis-XP gemiddeld (\d+) -> (\d+) \((\d+)% van origineel wild-gemiddelde\) ---$/, '--- XP brake: base XP average $1 -> $2 ($3% of original wild average) ---'],
      [/^--- Waar vang je wat\? ---$/, '--- Where to catch what ---'], [/^--- Evolutie-levels ---$/, '--- Evolution levels ---'],
      [/^Instellingen \(om exact dezelfde ROM opnieuw te maken\): /, 'Settings (to recreate exactly the same ROM): '],
      [/ evolueert nu in /g, ' now evolves into '], [/: ruil -> level 37 /g, ': trade -> level 37 '], [/: ruil met item -> level 37 /g, ': trade with item -> level 37 '],
      [/: ruil met item -> level stijgen terwijl hij (.*) vasthoudt /g, ': trade with item -> level up while holding $1 '],
      [/Item-ball /g, 'Item ball '], [/Verborgen item /g, 'Hidden item '], [/Prijs\/ruil /g, 'Prize/exchange '], [/\(normaal 1 op (\d+)\)/g, '(normal 1 in $1)'], [/^1 op (\d+)/, '1 in $1'],
      [/\(gras\/grot\)/g, '(grass/cave)'], [/\(hoog gras\)/g, '(tall grass)'], [/\(ei\)/g, '(egg)'], [/\(zweven\)/g, '(soaring)'], [/\(fossiel\)/g, '(fossil)'], [/\(ruimte\)/g, '(space)'], [/\(vogelzwerm\)/g, '(bird flock)'], [/\(beschermd: nodig voor /g, '(protected: needed for '], [/\(beschermd: story\)/g, '(protected: story)'], [/Zweven \(/g, 'Soaring ('], [/ bij Dewford /g, ' near Dewford '], [/(^|· )bij Fortree/g, '$1near Fortree'], [/niet gebruikt in het spel/g, 'not used in the game'], [/\(bloemen\)/g, '(flowers)'], [/\(oude hengel\)/g, '(Old Rod)'], [/\(goede hengel\)/g, '(Good Rod)'], [/\(superhengel\)/g, '(Super Rod)'], [/\(horde\)/g, '(horde)'], [/Gras groep (\d+) map (\d+)/g, 'Grass group $1 map $2'], [/Water groep (\d+) map (\d+)/g, 'Water group $1 map $2'], [/\(surfen\)/g, '(surfing)'], [/\(vissen\)/g, '(fishing)'], [/\(rotsen\)/g, '(rock smash)'], [/Gebied /g, 'Area '],
      [/\[belangrijk/g, '[important'], [/, type /g, ', type '], [/ \(was /g, ' (was '], [/^Gift /, 'Gift '], [/ wild: /g, ' wild: '],
    ] : null;
    const L = (s) => { if (EN && typeof s === 'string') for (const [rx, rep] of EN) s = s.replace(rx, rep); log.push(s); };
    const sp = game.species;
    const nm = (id) => { const s = game.byId.get(id); return s ? s.name : '#' + id; };
    const bst = (s) => s.stats.reduce((a, b) => a + b, 0) + (s.stats.length === 5 ? s.stats[4] : 0);
    const isLeg = (s) => PKDATA.LEGENDARY.has(s.dex);
    // Monotype: alle Pokémon die je kan krijgen (wild, starters, gifts, trades, eieren) zijn van één type
    const pool = (noLeg, mono = true) => {
      const a = sp.filter((s) => !(noLeg && isLeg(s)));
      if (!mono || !opt.monotype) return a;
      const b = a.filter((s) => s.types.includes(opt.monotype));
      return b.length >= 3 ? b : a;
    };
    const tmItems = game.tmItems || (() => { const t = []; for (let i = 328; i <= 419; i++) t.push(i); [618, 619, 620, 690, 691, 692, 693, 694].forEach((i) => t.push(i)); return t; })();
    const tmSet = new Set(tmItems);
    const isTM = (i) => tmSet.has(i);
    // key items, HM's, Mega Stones, Master Ball (prijs 0): blijven op hun plek en worden nooit elders uitgedeeld
    const isProtected = (i) => !!(game.itemPrice && game.itemPrice(i) === 0);
    const tmPool = tmItems.filter((i) => !isProtected(i)); // bv. TM70 (Flash) heeft prijs 0 in ORAS
    // namen voor de log (uit de ROM gelezen waar mogelijk, anders het nummer)
    const fix = (t) => (t && /[A-Z]{3}/.test(t) && t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t);
    const itemNm = (i) => (game.itemNames && game.itemNames[i] ? fix(game.itemNames[i]) : 'item ' + i);
    const moveNm = (m) => (game.moveNames && game.moveNames[m] ? fix(game.moveNames[m]) : 'move ' + m);
    const abNm = (a) => (game.abilityNames && game.abilityNames[a] ? fix(game.abilityNames[a]) : 'ability ' + a);
    const types = game.typeNames;
    const moveInfo = game.moves.info;

    L('=== Pokémon Randomizer log ===');
    L('Game: ' + game.name + ' — Gen ' + game.gen + ' (' + game.platform + ')');
    L('Seed: ' + opt.seed);
    L('Instellingen (om exact dezelfde ROM opnieuw te maken): ' + JSON.stringify(opt));
    L('');

    // ---------- Basisstats ----------
    if (opt.stats !== 'keep') {
      L('--- Basisstats (' + opt.stats + ') ---');
      for (const s of sp) {
        const total = s.stats.reduce((a, b) => a + b, 0);
        if (opt.stats === 'shuffle') R.shuffle(s.stats);
        else if (opt.stats === 'random') {
          const n = s.stats.length, w = s.stats.map(() => 0.3 + R.next());
          const ws = w.reduce((a, b) => a + b, 0);
          let st = w.map((x) => Math.max(10, Math.round((x / ws) * total)));
          if (s.dex === 292) st[0] = 1; // Shedinja HP blijft 1
          s.stats = st.map((v) => U.clamp(v, 1, 255));
        }
        L(s.name.padEnd(12) + ' ' + game.statNames.map((n, i) => n + ':' + s.stats[i]).join(' '));
      }
      L('');
    }

    // ---------- Types ----------
    if (opt.types !== 'keep') {
      L('--- Types ---');
      for (const s of sp) {
        const dual = opt.types === 'random' ? s.types[0] !== s.types[1] : R.chance(0.5);
        const t1 = R.pick(types);
        let t2 = t1;
        if (dual) do t2 = R.pick(types); while (t2 === t1);
        s.types = [t1, t2];
        L(s.name.padEnd(12) + ' ' + (t1 === t2 ? t1 : t1 + '/' + t2));
      }
      L('');
    }

    // ---------- Abilities ----------
    if (opt.abilities && game.abilityMax) {
      const banned = new Set();
      if (opt.banWonderGuard) banned.add(25);
      if (opt.banBadAbilities) [54, 59, 129, 112, 161].forEach((a) => banned.add(a)); // Truant, Forecast, Defeatist, Slow Start, Zen Mode
      const ab = []; for (let a = 1; a <= game.abilityMax; a++) if (!banned.has(a)) ab.push(a);
      L('--- Abilities ---');
      for (const s of sp) {
        s.abilities = s.abilities.map((a, i) => (a === 0 && i > 0 ? 0 : R.pick(ab)));
        if (s.abilities.length > 1 && s.abilities[1] === s.abilities[0]) s.abilities[1] = R.pick(ab);
        L(s.name.padEnd(12) + ' ' + s.abilities.filter(Boolean).map(abNm).join(', '));
      }
      L('');
    }

    // ---------- Overige stat-opties ----------
    for (const s of sp) {
      if (opt.maxCatch) s.catchRate = 255;
      if (opt.fastGrowth) s.growth = 4;
    }

    // ---------- TM-compatibiliteit ----------
    if (game.hasTmCompat && opt.tmCompat !== 'keep') {
      const pct = opt.tmCompat === 'full' ? 1 : opt.tmCompatPct / 100;
      for (const s of sp) s.tm = s.tm.map(() => R.chance(pct));
    }
    // ---------- Items die wilde Pokémon vasthouden ----------
    if (opt.wildHeldItems && sp.some((s) => s.heldItems)) {
      const hp = new Set();
      sp.forEach((s) => (s.heldItems || []).forEach((i) => i && hp.add(i)));
      if (game.fieldItems) game.fieldItems.entries.forEach((e) => !isTM(e.orig) && hp.add(e.orig));
      const hpool = [...hp].filter((i) => !isProtected(i));
      if (hpool.length) for (const s of sp) if (s.heldItems) s.heldItems = s.heldItems.map((i) => (i ? R.pick(hpool) : 0));
      L('--- Items van wilde Pokémon: willekeurig gemaakt ---'); L('');
    }
    // ---------- XP-rem (zachte level cap) ----------
    // Willekeurige wilde/trainer-Pokémon zijn gemiddeld veel 'duurder' (geëvolueerd/legendary = hoge basis-XP)
    // dan de vroege Pokémon in het originele spel, waardoor je veel sneller levelt. Hier wordt de basis-XP van
    // elke soort naar het gemiddelde van de originele wilde Pokémon gebracht (met kleine verschillen), x percentage.
    if (opt.expMode === 'normal' && sp.some((s) => s.baseExp)) {
      const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
      const wildExp = [];
      game.wild.forEach((a) => a.slots.forEach((s) => { const o = game.byId.get(s.species); if (o && o.baseExp) wildExp.push(o.baseExp); }));
      const allAvg = avg(sp.filter((s) => s.baseExp).map((s) => s.baseExp));
      const target = (wildExp.length ? avg(wildExp) : allAvg) * (opt.expPct || 100) / 100;
      for (const s of sp) if (s.baseExp) s.baseExp = Math.max(1, Math.round(target * Math.pow(s.baseExp / allAvg, 0.25)));
      L('--- XP-rem: basis-XP gemiddeld ' + Math.round(allAvg) + ' -> ' + Math.round(target) + ' (' + (opt.expPct || 100) + '% van origineel wild-gemiddelde) ---'); L('');
    } else if (opt.expPct && opt.expPct !== 100 && sp.some((s) => s.baseExp)) {
      for (const s of sp) if (s.baseExp) s.baseExp = Math.max(1, Math.round(s.baseExp * opt.expPct / 100));
      L('--- XP: ' + opt.expPct + '% ---'); L('');
    }
    sp.forEach((s) => game.commitSpecies(s));

    // ---------- Aanvallen ----------
    const valid = game.moves.valid;
    const damaging = moveInfo(1) ? valid.filter((m) => moveInfo(m).power > 1) : valid;
    const hms = new Set(game.tms ? game.tms.hms : []);
    const movePool = opt.noHmInLearnset ? valid.filter((m) => !hms.has(m)) : valid;

    if (opt.learnsets !== 'keep' && game.learnsets.size) {
      L('--- Level-up aanvallen ---');
      const typeMode = opt.learnsets === 'type' && moveInfo(1);
      for (const [id, ls] of game.learnsets) {
        const s = game.byId.get(id); if (!s) continue;
        const used = new Set();
        if (typeMode) {
          // alleen aanvallen van het eigen type (of types); ~75% schade, sterker naarmate het level stijgt
          const own = movePool.filter((x) => s.types.includes(moveInfo(x).type));
          const dmg = own.filter((x) => moveInfo(x).power > 1), stat = own.filter((x) => moveInfo(x).power <= 1);
          const pickFrom = (arr) => { const f = arr.filter((x) => !used.has(x)); return f.length ? R.pick(f) : null; };
          const isDmg = ls.entries.map((e, i) => i === 0 || !stat.length || R.chance(0.75));
          ls.entries.forEach((e, i) => {
            let m = isDmg[i] ? pickFrom(dmg) : pickFrom(stat);
            if (!m) m = pickFrom(own) || pickFrom(damaging.filter((x) => moveInfo(x).type === 'Normal')) || R.pick(damaging);
            used.add(m); e.move = m;
          });
          // schade-aanvallen sorteren: zwakste op laag level, sterkste op hoog level
          const di = ls.entries.map((e, i) => i).filter((i) => moveInfo(ls.entries[i].move).power > 1);
          const sorted = di.map((i) => ls.entries[i].move).sort((a, b) => moveInfo(a).power - moveInfo(b).power);
          di.forEach((i, k) => (ls.entries[i].move = sorted[k]));
          ls.commit();
          L(s.name.padEnd(12) + ' ' + ls.entries.map((e) => 'Lv' + e.level + ' ' + moveNm(e.move)).join(', '));
          continue;
        }
        ls.entries.forEach((e, i) => {
          let m, tries = 0;
          do {
            let cand = movePool;
            if (opt.learnsets === 'stab' && moveInfo(1) && R.chance(0.6)) {
              const st = movePool.filter((x) => s.types.includes(moveInfo(x).type) && moveInfo(x).power > 1);
              if (st.length) cand = st;
            }
            if (i === 0 && opt.firstMoveDamaging && moveInfo(1)) cand = damaging.filter((x) => moveInfo(x).power <= 60 || i > 0);
            m = R.pick(cand);
          } while (used.has(m) && ++tries < 30);
          used.add(m); e.move = m;
        });
        if (opt.learnsets === 'stab' && moveInfo(1)) { // schade-aanvallen: zwakste op laag level, sterkste op hoog level
          const di = ls.entries.map((e, i) => i).filter((i) => moveInfo(ls.entries[i].move).power > 1);
          const sorted = di.map((i) => ls.entries[i].move).sort((a, b) => moveInfo(a).power - moveInfo(b).power);
          di.forEach((i, k) => (ls.entries[i].move = sorted[k]));
        }
        ls.commit();
        L(s.name.padEnd(12) + ' ' + ls.entries.map((e) => 'Lv' + e.level + ' ' + moveNm(e.move)).join(', '));
      }
      L('');
    }

    // ---------- Story-legendaries verzwakken (blijven dezelfde soort, maar zwakkere aanvallen + ability) ----------
    if (opt.protectStory && opt.weakenStory && game.statics) {
      const ids = new Set(game.statics.filter((st) => st.story).map((st) => st.species));
      const weakAb = [50, 35, 53, 12, 20, 7, 118, 103].filter((a) => a <= game.abilityMax); // Run Away, Illuminate, Pickup, ...
      const weakMoves = moveInfo(1) ? valid.filter((m) => moveInfo(m).power <= 50) : valid;
      if (ids.size) L('--- Story-legendaries verzwakt ---');
      for (const id of ids) {
        const s = game.byId.get(id); if (!s) continue;
        if (s.abilities && weakAb.length) { s.abilities = s.abilities.map((a, i) => (a === 0 && i > 0 ? 0 : R.pick(weakAb))); game.commitSpecies(s); }
        const ls = game.learnsets.get(id);
        if (ls) { const used = new Set(); ls.entries.forEach((e) => { let m, t = 0; do m = R.pick(weakMoves); while (used.has(m) && ++t < 30); used.add(m); e.move = m; }); ls.commit(); }
        L(s.name + ': ' + (s.abilities || []).filter(Boolean).map(abNm).join(', ') + ' | ' + (ls ? ls.entries.map((e) => 'Lv' + e.level + ' ' + moveNm(e.move)).join(', ') : ''));
      }
      if (ids.size) L('');
    }

    if (opt.tms && game.tms) {
      const pick = R.shuffle(valid.filter((m) => !hms.has(m))).slice(0, game.tms.moves.length);
      game.tms.moves = pick; game.tms.commit();
      L('--- TM\'s ---');
      pick.forEach((m, i) => L('TM' + String(i + 1).padStart(2, '0') + ': ' + moveNm(m)));
      L('');
    }

    // ---------- Keuzehulpen ----------
    const similar = (orig, cands) => {
      const o = game.byId.get(orig); if (!o) return R.pick(cands);
      const b = bst(o);
      for (let pct = 0.1; pct < 1; pct += 0.1) {
        const c = cands.filter((s) => Math.abs(bst(s) - b) <= b * pct);
        if (c.length >= 3) return R.pick(c);
      }
      return R.pick(cands);
    };
    const choose = (orig, mode, cands) => (mode === 'similar' ? similar(orig, cands) : R.pick(cands)).id;
    const lvl = (l, pct) => U.clamp(Math.round(l * (1 + pct / 100)), 1, 100);
    // sterkte volgens level: hoe hoger het level, hoe hoger de BST van de gekozen Pokémon
    const byLevel = (level, c, base, step, cap) => {
      const target = U.clamp(base + level * step, base, cap);
      for (let pct = 0.08; pct < 1; pct += 0.08) { const f = c.filter((s) => Math.abs(bst(s) - target) <= target * pct); if (f.length >= 3) return R.pick(f).id; }
      return R.pick(c).id;
    };

    // Moves voor trainerpokémon met eigen moves: laatste 4 aangeleerd op dat level
    const movesAt = (id, level) => {
      const ls = game.learnsets.get(id); const out = [];
      if (ls) for (const e of ls.entries) if (e.level <= level && !out.includes(e.move)) { out.push(e.move); if (out.length > 4) out.shift(); }
      while (out.length < 4) out.push(0);
      if (!out[0]) out[0] = 33; // Tackle
      return out;
    };

    // Beste 4 aanvallen tot dat level: sterke schade-aanvallen (eigen type telt x1.5), liefst verschillende types
    const bestMoves = (id, level) => {
      const ls = game.learnsets.get(id), o = game.byId.get(id);
      if (!ls || !moveInfo(1) || !o) return movesAt(id, level);
      const known = [...new Set(ls.entries.filter((e) => e.level <= level).map((e) => e.move))];
      const score = (m) => { const i = moveInfo(m); return i.power > 1 ? i.power * (o.types.includes(i.type) ? 1.5 : 1) : 0; };
      const dmg = known.filter((m) => score(m) > 0).sort((a, b) => score(b) - score(a));
      const out = [], typesUsed = new Set();
      for (const m of dmg) if (out.length < 3 && !typesUsed.has(moveInfo(m).type)) { out.push(m); typesUsed.add(moveInfo(m).type); }
      const status = known.filter((m) => score(m) === 0 && !out.includes(m));
      if (status.length && out.length >= 2) out.push(R.pick(status));
      for (const m of dmg) if (out.length < 4 && !out.includes(m)) out.push(m);
      for (const m of known) if (out.length < 4 && !out.includes(m)) out.push(m);
      while (out.length < 4) out.push(0);
      if (!out[0]) out[0] = 33;
      return out;
    };

    // ---------- Evoluties ----------
    if (game.evos && (opt.fixTradeEvos || opt.randomEvos || opt.evoLevels)) {
      const M = game.evos.methods;
      L('--- Evoluties ---');
      if (opt.fixTradeEvos) for (const ev of game.evos.list) {
        let changed = false;
        for (const e of ev.ent) {
          if (M.trade.includes(e.method) || M.tradeSpecies.includes(e.method)) { e.method = M.level; e.param = 37; changed = true; L(nm(ev.species) + ': ruil -> level 37 (' + nm(e.target) + ')'); }
          else if (M.tradeItem.includes(e.method)) {
            if (M.heldDay) { // item vasthouden en een level stijgen (dag en nacht)
              const item = e.param; e.method = M.heldDay;
              const free = ev.ent.find((x) => x.method === 0);
              if (free) { free.method = M.heldNight; free.param = item; free.target = e.target; }
              L(nm(ev.species) + ': ruil met item -> level stijgen terwijl hij ' + itemNm(item) + ' vasthoudt (' + nm(e.target) + ')');
            } else { e.method = M.level; e.param = 37; L(nm(ev.species) + ': ruil met item -> level 37 (' + nm(e.target) + ')'); }
            changed = true;
          }
        }
        if (changed) ev.commit();
      }
      if (opt.evoLevels) { // level-evoluties op een ander level (±30%, tussen 5 en 70)
        for (const ev of game.evos.list) {
          let changed = false;
          for (const e of ev.ent) if (e.method === M.level && e.param > 1 && e.param <= 100) {
            const was = e.param; e.param = U.clamp(Math.round(was * (0.7 + R.next() * 0.6)), 5, 70); changed = changed || e.param !== was;
            if (e.param !== was) L(nm(ev.species) + ' -> ' + nm(e.target) + ': level ' + was + ' -> ' + e.param);
          }
          if (changed) ev.commit();
        }
      }
      if (opt.randomEvos) {
        const cands = sp.filter((s) => !isLeg(s));
        for (const ev of game.evos.list) {
          let changed = false;
          const me = game.byId.get(ev.species), b = me ? bst(me) : 300;
          for (const e of ev.ent) {
            if (!e.method || !e.target) continue;
            let c = cands.filter((s) => s.id !== ev.species && bst(s) >= b && bst(s) <= b + 160);
            if (c.length < 3) c = cands;
            const before = e.target; e.target = R.pick(c).id; changed = true;
            L(nm(ev.species) + ' evolueert nu in ' + nm(e.target) + ' (was ' + nm(before) + ')');
          }
          if (changed) ev.commit();
        }
      }
      L('');
    }

    // ---------- Starters ----------
    if (opt.starters !== 'keep' && game.starters) {
      const st = game.starters;
      const cands = pool(opt.starterNoLeg);
      const chosen = [];
      if (opt.starters === 'custom') {
        opt.customStarters.forEach((name, i) => {
          const dex = PKDATA.dexByName[(name || '').toLowerCase().replace(/[^a-z0-9♀♂]/g, '')];
          const s = sp.find((x) => x.dex === dex);
          chosen.push(s ? s.id : st.species[i]);
        });
      } else {
        while (chosen.length < 3) {
          const c = choose(st.species[chosen.length], opt.starters === 'similar' ? 'similar' : 'random', cands);
          if (!chosen.includes(c)) chosen.push(c);
        }
      }
      L('--- Starters ---');
      st.species.forEach((o, i) => L(nm(o) + ' -> ' + nm(chosen[i])));
      st.species = chosen; st.commit();
      if (st.experimental) L('(Let op: starter-aanpassing is voor deze game experimenteel)');
      if (st.note) L('(' + st.note + ')');
      L('');
    }

    // ---------- Static encounters & gift-Pokémon ----------
    if (opt.statics && opt.statics !== 'keep' && game.statics && game.statics.length) {
      L('--- Static encounters & gift-Pokémon ---');
      for (const st of game.statics) {
        if (st.kind === 'gift' && !opt.giftsToo) continue;
        if (opt.protectStory && st.story) { L(st.label + ' (Lv' + st.level + '): ' + nm(st.species) + ' (beschermd: story)'); continue; }
        if (opt.protectStory && st.key) { L(st.label + ' (Lv' + st.level + '): ' + nm(st.species) + ' (beschermd: nodig voor ' + st.key + ')'); continue; }
        const o = game.byId.get(st.species), leg = !!(o && isLeg(o));
        const base = pool(false);
        let cands = opt.staticLegSwap ? base.filter((s) => isLeg(s) === leg) : base;
        if (cands.length < 3) cands = opt.staticLegSwap ? sp.filter((s) => isLeg(s) === leg) : sp;
        const before = st.species;
        // beschermd: zwakke tutorial-gevechten (bv. Birch's Poochyena) alleen door iets van gelijke sterkte
        st.species = choose(st.species, opt.protectStory && st.kind === 'static' && st.level <= 5 ? 'similar' : opt.statics, cands);
        st.commit();
        L(st.label + ' (Lv' + st.level + '): ' + nm(before) + ' -> ' + nm(st.species));
      }
      L('');
    }

    // ---------- Veld-items ----------
    if (opt.fieldItems && opt.fieldItems !== 'keep' && game.fieldItems) {
      const fi = game.fieldItems;
      const movable = fi.entries.filter((e) => !(opt.keepFieldTMs && isTM(e.item)) && !isProtected(e.item));
      // een TM blijft een TM (een andere), een gewoon item wordt een ander gewoon item
      const tmSpots = movable.filter((e) => isTM(e.item)), itemSpots = movable.filter((e) => !isTM(e.item));
      if (opt.fieldItems === 'shuffle') {
        const a = R.shuffle(tmSpots.map((e) => e.item)), b = R.shuffle(itemSpots.map((e) => e.item));
        tmSpots.forEach((e, i) => (e.item = a[i])); itemSpots.forEach((e, i) => (e.item = b[i]));
      } else {
        const others = [...new Set(fi.entries.map((e) => e.item))].filter((i) => !isTM(i) && !isProtected(i));
        tmSpots.forEach((e) => (e.item = R.pick(tmPool))); itemSpots.forEach((e) => (e.item = R.pick(others)));
      }
      fi.commit();
      L('--- Veld-items ---');
      fi.entries.forEach((e, i) => { if (e.item !== e.orig) L((e.prize ? 'Prijs/ruil ' : e.hidden || i >= fi.ballCount ? 'Verborgen item ' : 'Item-ball ') + i + ': ' + itemNm(e.orig) + ' -> ' + itemNm(e.item) + (e.qty > 1 ? ' (x' + e.qty + ')' : '')); });
      L('');
    }

    // ---------- Poké Marts (speciale winkels; gewone winkels per badge blijven) ----------
    if (opt.marts && game.marts) {
      const others = new Set(game.marts.slots.map((x) => x.orig).filter((i) => !isTM(i)));
      if (game.fieldItems) game.fieldItems.entries.forEach((e) => !isTM(e.orig) && others.add(e.orig));
      const op = [...others].filter((i) => !isProtected(i));
      // basisitems (ballen, potions, status-heals, revives, repels, Escape Rope) blijven altijd te koop
      const basic = new Set(game.basicItems || [1, 2, 3, 4, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 76, 77, 78, 79]);
      const op2 = op.filter((i) => !basic.has(i));
      game.marts.slots.forEach((x) => { if (!isProtected(x.orig) && !basic.has(x.orig)) x.item = isTM(x.orig) ? R.pick(tmPool) : R.pick(op2); });
      game.marts.commit();
      L('--- Speciale winkels ---');
      game.marts.slots.forEach((x) => L(itemNm(x.orig) + ' -> ' + itemNm(x.item))); L('');
    }

    // ---------- Wilde Pokémon ----------
    if ((opt.wild !== 'keep' || opt.wildLevel) && game.wild.length) {
      const cands = pool(opt.wildNoLeg);
      let global = null;
      if (opt.wild === 'global') {
        const ids = R.shuffle(cands.map((s) => s.id));
        global = new Map(); sp.forEach((s, i) => global.set(s.id, ids[i % ids.length]));
      }
      L('--- Wilde Pokémon ---');
      // Eerste routes: eigen soorten (komen verder nergens in het wild voor) die iets makkelijker te vangen zijn
      const early = new Set(), earlyLvl = opt.earlyCatch ? (opt.earlyCatchLevel || 8) : 0;
      if (earlyLvl && (opt.wild === 'random' || opt.wild === 'similar')) {
        // een gebied telt als 'begin' als het gras-deel (eerste 12 slots) helemaal laag is; vislijn-slots elders (lv5) tellen niet
        const isEarly = (area) => area.slots.length >= 10 && Math.max(...area.slots.slice(0, 12).map((s) => s.max)) <= earlyLvl;
        for (const area of game.wild) if (isEarly(area)) for (const s of area.slots) if (s.max <= earlyLvl && s.species) {
          s.species = choose(s.species, opt.wild, cands); s._early = true; early.add(s.species);
        }
      }
      const lateCands = early.size ? cands.filter((x) => !early.has(x.id)) : cands;
      for (const area of game.wild) {
        const local = new Map();
        for (const s of area.slots) {
          if (s._early) { delete s._early; }
          else if (opt.wild === 'random' || opt.wild === 'similar') s.species = choose(s.species, opt.wild, lateCands);
          else if (opt.wild === 'progressive') s.species = byLevel(Math.max(s.min, s.max), cands, 180, 6, 600);
          else if (opt.wild === 'area') {
            if (!local.has(s.species)) {
              let c, t = 0; const usedIds = new Set(local.values());
              do c = R.pick(cands).id; while (usedIds.has(c) && ++t < 50);
              local.set(s.species, c);
            }
            s.species = local.get(s.species);
          } else if (global) s.species = global.get(s.species) || s.species;
          if (opt.wildLevel) { s.min = lvl(s.min, opt.wildLevel); s.max = lvl(s.max, opt.wildLevel); }
        }
        area.commit();
        L(area.label + ': ' + [...new Set(area.slots.map((s) => nm(s.species)))].join(', '));
      }
      L('');
      if (early.size) {
        const floor = opt.earlyCatchRate || 100;
        L('--- Makkelijker te vangen (eerste routes, catch rate minstens ' + floor + ') ---');
        for (const id of early) { const s = game.byId.get(id); if (!s) continue; if (s.catchRate < floor) { L(s.name + ': ' + s.catchRate + ' -> ' + floor); s.catchRate = floor; game.commitSpecies(s); } }
        L('');
      }
    }

    // ---------- Daycare-eieren ----------
    if (opt.eggs && game.eggs) {
      let cands = pool(opt.eggNoLeg);
      if (opt.eggBasic) { // alleen basisvormen: soorten die in de originele tabel zichzelf als ei hebben
        const basic = new Set(game.eggs.entries.filter((e) => e.orig === e.species).map((e) => e.species));
        const c2 = cands.filter((s) => basic.has(s.id)); if (c2.length >= 20) cands = c2;
      }
      const map = new Map(); // originele baby -> nieuwe baby (zelfde evolutielijn = zelfde ei)
      for (const e of game.eggs.entries) {
        if (e.orig === e.species && PKDATA.LEGENDARY.has((game.byId.get(e.species) || {}).dex)) continue; // kunnen niet breeden
        if (!map.has(e.orig)) map.set(e.orig, R.pick(cands).id);
        e.baby = map.get(e.orig);
      }
      game.eggs.commit();
      L('--- Daycare-eieren (normaal ei -> nieuw ei) ---');
      for (const [o, b] of map) L(nm(o) + ' -> ' + nm(b));
      L('');
    }

    // ---------- In-game trades ----------
    if (opt.trades && game.trades && game.trades.length) {
      const cands = pool(opt.tradeNoLeg);
      // gevraagde Pokémon: iets dat je echt kan vangen (komt in het wild voor), anders alles
      const wildIds = new Set(); game.wild.forEach((a) => a.slots.forEach((s) => wildIds.add(s.species)));
      let reqPool = cands.filter((s) => wildIds.has(s.id));
      if (reqPool.length < 10) reqPool = cands;
      L('--- In-game trades (je geeft -> je krijgt) ---');
      for (const t of game.trades) {
        const before = nm(t.req) + ' -> ' + nm(t.give);
        t.give = R.pick(cands).id;
        if (opt.tradeReqToo) t.req = R.pick(reqPool).id;
        t.commit();
        L(t.label + (t.level ? ' (Lv' + t.level + ')' : '') + ': ' + nm(t.req) + ' -> ' + nm(t.give) + '   (was ' + before + ')');
      }
      L('');
    }

    // ---------- Trainers ----------
    if ((opt.trainers !== 'keep' || opt.trainerLevel || opt.strongTrainers || opt.bossItems) && game.trainers.length) {
      const cands = pool(opt.trainerNoLeg, false);
      const progressive = (level, c) => byLevel(level, c, 200, 6.5, 680);
      // hoofdtype van het originele team (bv. Roxanne = Rock), voor belangrijke trainers
      const teamType = (tr) => {
        const cnt = {};
        tr.mons.forEach((m) => { const o = game.byId.get(m.species); if (o) new Set(o.types).forEach((t) => (cnt[t] = (cnt[t] || 0) + 1)); });
        const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
        return best && best[1] >= Math.max(1, Math.ceil(tr.mons.length * 0.6)) ? best[0] : null;
      };
      L('--- Trainers ---');
      for (const tr of game.trainers) {
        let tc = cands, gymType = null;
        if (opt.keepGymTypes && tr.important && opt.trainers !== 'keep') {
          gymType = teamType(tr);
          const f = gymType ? cands.filter((s) => s.types.includes(gymType)) : [];
          if (f.length >= 3) tc = f; else gymType = null;
        }
        if (!gymType && opt.trainers === 'theme') {
          const t = R.pick(types); const f = cands.filter((s) => s.types.includes(t));
          if (f.length >= 3) tc = f;
        }
        for (const m of tr.mons) {
          if (opt.trainerLevel) m.level = lvl(m.level, opt.trainerLevel);
          let tcm = tc;
          if (opt.trainerBetter && opt.trainers !== 'keep') { // sterkere soorten naarmate het level stijgt
            const floor = Math.min(540, 280 + m.level * 5 + (tr.important ? 40 : 0));
            const f = tc.filter((x) => bst(x) >= floor); if (f.length >= 5) tcm = f;
          }
          if (opt.trainers === 'progressive') m.species = progressive(m.level, tcm);
          else if (opt.trainers !== 'keep') m.species = choose(m.species, opt.trainers === 'random' ? 'random' : 'similar', tcm);
          if (opt.strongTrainers && m.iv !== undefined) m.iv = 255; // perfecte IV's
          if (opt.bossItems && tr.important && m.item !== null && m.item !== undefined && tr.itemIds) m.item = R.pick(tr.itemIds.held);
          if (m.moves && (opt.trainers !== 'keep' || opt.learnsets !== 'keep')) m.moves = opt.trainerBetter ? bestMoves(m.species, m.level) : movesAt(m.species, m.level);
        }
        if (opt.strongTrainers && tr.ai !== undefined) tr.ai |= 7; // slimme AI (basis + sterk + expert)
        if (opt.bossItems && tr.important && tr.bag && tr.itemIds) {
          const hi = Math.max(...tr.mons.map((m) => m.level));
          tr.bag = tr.bag.map((x) => x || (hi >= 40 ? tr.itemIds.fullRestore : tr.itemIds.hyperPotion));
        }
        tr.commit();
        L(tr.label + (tr.important ? ' [belangrijk' + (gymType ? ', type ' + gymType : '') + ']' : '') + ': '
          + tr.mons.map((m) => nm(m.species) + ' Lv' + m.level + (m.item ? ' @' + itemNm(m.item) : '')).join(', '));
      }
      L('');
    }

    // ---------- Shiny-kans (3DS) ----------
    if (game.codeIps && opt.shinyOdds && opt.shinyOdds !== 4096) {
      game.shinyOdds = opt.shinyOdds;
      L('--- Shiny-kans ---'); L('1 op ' + game.shinyActualOdds() + ' (normaal 1 op 4096)'); L('');
    } else if (game.setShinyOdds && opt.shinyOdds && opt.shinyOdds !== 4096) {
      const o = game.setShinyOdds(opt.shinyOdds);
      L('--- Shiny-kans ---'); L('1 op ' + o + ' (normaal 1 op ' + (game.shinyBase || 4096) + ')'); L('');
    }

    // ---------- Overzicht: waar vang je wat? ----------
    if (opt.catchList !== false && game.wild.length) {
      const where = new Map();
      for (const area of game.wild) for (const s of area.slots) {
        if (!where.has(s.species)) where.set(s.species, new Map());
        const m = where.get(s.species), k = area.label + (s.method ? ' (' + s.method + ')' : '');
        const lv = m.get(k) || [999, 0]; lv[0] = Math.min(lv[0], s.min); lv[1] = Math.max(lv[1], s.max); m.set(k, lv);
      }
      if (game.statics) for (const st of game.statics) { if (!where.has(st.species)) where.set(st.species, new Map()); where.get(st.species).set((st.place ? st.place + ' ' : '') + '(' + (st.kind === 'gift' ? 'gift' : 'static') + ')' + (st.level ? ' Lv' + st.level : ''), null); }
      if (game.trades) for (const t of game.trades) { if (!where.has(t.give)) where.set(t.give, new Map()); where.get(t.give).set('Trade (' + nm(t.req) + ')', null); }
      L('--- Waar vang je wat? ---');
      const ids = [...where.keys()].sort((a, b) => ((game.byId.get(a) || {}).dex || a) - ((game.byId.get(b) || {}).dex || b));
      for (const id of ids) {
        const parts = [...where.get(id)].map(([k, lv]) => (lv && lv[1] ? k + ' Lv' + (lv[0] === lv[1] ? lv[0] : lv[0] + '-' + lv[1]) : k));
        L(nm(id).padEnd(12) + ' ' + parts.slice(0, 12).join(' · ') + (parts.length > 12 ? ' · (+' + (parts.length - 12) + ')' : ''));
      }
      L('');
    }

    if (game.warnings.length) { L('--- Opmerkingen ---'); game.warnings.forEach((w) => L('* ' + (g.I18N && opt.lang === 'en' ? g.I18N.t(w) : w))); }
    game.finalize();
    return game.rom;
  }

  g.Randomizer = { detectAndLoad, randomize };
})(typeof window !== 'undefined' ? window : globalThis);
