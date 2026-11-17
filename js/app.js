// UI-koppeling
(function () {
  const T = (x, ...a) => (window.I18N ? I18N.t(x, ...a) : x);
  const $ = (id) => document.getElementById(id);
  let original = null, srcFile = null, is3ds = false, fileName = '', game = null, lastLog = '', helper = false;
  const fileReader = (f) => ({ size: f.size, read: async (off, len) => new Uint8Array(await f.slice(off, off + len).arrayBuffer()) });
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* opslag niet beschikbaar */ } },
  };

  const newSeed = () => ($('seed').value = Math.random().toString(36).slice(2, 10).toUpperCase());
  newSeed();
  $('newSeed').onclick = newSeed;

  // Helper-server (start.bat) aanwezig? Dan kan "stuur naar 3DS" gebruikt worden.
  if (location.protocol.startsWith('http')) {
    fetch('/api/ping').then((r) => r.json()).then((j) => { helper = !!j.ok; updateOutBox(); }).catch(() => {});
  }

  const drop = $('drop');
  drop.onclick = () => $('file').click();
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('hover'); };
  drop.ondragleave = () => drop.classList.remove('hover');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('hover'); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); };
  $('file').onchange = (e) => e.target.files[0] && loadFile(e.target.files[0]);

  function status(t, ok) { $('status').textContent = t; $('status').className = ok ? 'ok' : ''; }

  // ---------- Instellingen per game onthouden ----------
  const settingsKey = () => 'pkr:opts:' + (game ? game.titleId || game.name : 'algemeen');
  const fields = () => document.querySelectorAll('#opts input, #opts select, #outBox input, #outBox select, #presetBox input');
  function saveSettings() {
    if (!game) return;
    const s = {};
    fields().forEach((el) => {
      if (el.type === 'radio') { if (el.checked) s['r:' + el.name] = el.value; }
      else if (el.type === 'checkbox') s['c:' + el.id] = el.checked;
      else if (el.id) s['v:' + el.id] = el.value;
    });
    store.set(settingsKey(), s);
    if ($('ftpHost').value) store.set('pkr:ftpHost', $('ftpHost').value);
  }
  function loadSettings() {
    const s = store.get(settingsKey());
    if (s) {
      fields().forEach((el) => {
        if (el.type === 'radio') { if (s['r:' + el.name] !== undefined) el.checked = s['r:' + el.name] === el.value; }
        else if (el.type === 'checkbox') { if (s['c:' + el.id] !== undefined) el.checked = s['c:' + el.id]; }
        else if (el.id && s['v:' + el.id] !== undefined) el.value = s['v:' + el.id];
      });
    }
    if (!$('ftpHost').value) $('ftpHost').value = store.get('pkr:ftpHost') || '';
    return !!s;
  }
  document.addEventListener('change', (e) => { if (e.target.closest('#opts, #outBox, #presetBox')) { saveSettings(); updateOutBox(); } });

  // ---- Presets en instellingencode ----
  const allFields = () => document.querySelectorAll('#opts input, #opts select, #presetBox input');
  const collect = () => { const s = {}; allFields().forEach((el) => { if (el.type === 'radio') { if (el.checked) s['r:' + el.name] = el.value; } else if (el.type === 'checkbox') s['c:' + el.id] = el.checked; else if (el.id && !/^cs\d$/.test(el.id)) s['v:' + el.id] = el.value; }); return s; };
  const apply = (s) => allFields().forEach((el) => {
    if (el.type === 'radio') { if (s['r:' + el.name] !== undefined) el.checked = s['r:' + el.name] === el.value; }
    else if (el.type === 'checkbox') { if (s['c:' + el.id] !== undefined) el.checked = s['c:' + el.id]; }
    else if (el.id && s['v:' + el.id] !== undefined) el.value = s['v:' + el.id];
  });
  const DEFAULTS = collect(); // zoals de pagina start
  const PRESETS = {
    reset: {},
    classic: { 'r:starters': 'random', 'r:wild': 'similar', 'r:trainers': 'similar', 'c:keepGymTypes': true, 'c:abilities': false, 'r:learnsets': 'stab', 'c:fixTradeEvos': true, 'r:statics': 'similar', 'c:giftsToo': true, 'c:protectStory': true, 'c:trades': true },
    chaos: { 'r:stats': 'random', 'r:types': 'random', 'c:abilities': true, 'c:banWonderGuard': false, 'c:banBadAbilities': false, 'r:starters': 'random', 'c:starterNoLeg': false, 'r:wild': 'random', 'c:wildNoLeg': false, 'r:trainers': 'random', 'c:trainerNoLeg': false, 'r:learnsets': 'random', 'c:tms': true, 'r:tmCompat': 'random', 'r:statics': 'random', 'c:staticLegSwap': false, 'c:giftsToo': true, 'r:fieldItems': 'random', 'c:marts': true, 'c:trades': true, 'c:tradeReqToo': true, 'c:eggs': true, 'c:randomEvos': true, 'c:evoLevels': true, 'c:wildHeldItems': true, 'v:shinyStep': '8' },
    nuzlocke: { 'r:starters': 'similar', 'c:starterNoLeg': true, 'r:wild': 'area', 'c:wildNoLeg': true, 'r:trainers': 'similar', 'c:trainerNoLeg': true, 'c:keepGymTypes': true, 'c:strongTrainers': true, 'c:bossItems': true, 'r:learnsets': 'stab', 'c:firstMoveDamaging': true, 'c:fixTradeEvos': true, 'c:expNormal': true, 'c:earlyCatch': false, 'r:statics': 'similar', 'c:protectStory': true, 'c:catchList': true, 'r:fieldItems': 'random', 'c:marts': true },
  };
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    apply(DEFAULTS); apply(PRESETS[b.dataset.preset] || {}); shinyLabel(); saveSettings(); updateOutBox();
    status(T('Preset "{0}" toegepast.', b.textContent), true);
  }));
  const b64e = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = (str) => decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
  $('copyCode').addEventListener('click', async () => {
    const cur = collect(), diff = {}; for (const k in cur) if (cur[k] !== DEFAULTS[k]) diff[k] = cur[k]; diff.seed = $('seed').value;
    const code = 'PKR1-' + b64e(JSON.stringify(diff));
    try { await navigator.clipboard.writeText(code); status(T('Instellingencode gekopieerd naar het klembord.'), true); }
    catch (e) { window.prompt(T('Kopieer deze code:'), code); }
  });
  $('pasteCode').addEventListener('click', () => {
    const code = (window.prompt(T('Plak hier een instellingencode:')) || '').trim(); if (!code) return;
    try { const s = JSON.parse(b64d(code.replace(/^PKR1-/, ''))); apply(DEFAULTS); apply(s); if (s.seed) $('seed').value = s.seed; shinyLabel(); saveSettings(); updateOutBox(); status(T('Instellingencode geladen.'), true); }
    catch (e) { status(T('Deze code klopt niet.')); }
  });

  function updateOutBox() {
    $('outBox').style.display = is3ds && game ? '' : 'none';
    const ftpRadio = document.querySelector('input[name=out][value=ftp]');
    ftpRadio.disabled = !helper;
    $('ftpLabel').style.opacity = helper ? 1 : 0.5;
    if (!helper && ftpRadio.checked) document.querySelector('input[name=out][value=rom]').checked = true;
    $('ftpRow').style.display = helper && ftpRadio.checked ? '' : 'none';
    $('ftpHint').textContent = helper ? '' : T('Rechtstreeks sturen werkt alleen als je de app opent via start.bat.');
    $('tidInfo').textContent = game && game.titleId ? T('Title ID: {0} — LayeredFS-map: luma/titles/{0}/', game.titleId) : '';
    $('go').textContent = T(!is3ds ? 'Randomize & download' : { rom: 'Randomize & download .3ds', layeredfs: 'Randomize & download zip', ftp: 'Randomize & stuur naar 3DS' }[radio('out')]);
  }

  async function loadFile(f) {
    status(T('ROM inlezen…'));
    fileName = f.name; srcFile = f;
    is3ds = await CTR.detect(fileReader(f)) > 0;
    original = is3ds ? null : new Uint8Array(await f.arrayBuffer());
    setTimeout(async () => {
      try {
        if (is3ds) status(T('3DS-ROM analyseren (kan even duren)…'));
        game = is3ds ? await CTR.load(fileReader(f)) : Randomizer.detectAndLoad(original.slice());
        $('monotype').innerHTML = '<option value="">' + T('Uit') + '</option>' + game.typeNames.map((t) => '<option>' + t + '</option>').join('');
        const restored = loadSettings(); shinyLabel(); setupStarterList();
        showInfo(); updateOutBox();
        $('go').disabled = false; $('again').disabled = false;
        status(restored ? T('Je vorige instellingen voor deze game zijn teruggezet.') : '', restored);
      } catch (err) {
        game = null; $('go').disabled = true; $('again').disabled = true; updateOutBox(); setupStarterList();
        $('romInfo').style.display = 'block';
        $('romInfo').innerHTML = '<b>' + T('Kan deze ROM niet gebruiken.') + '</b><br>' + T(err.message);
        status('');
      }
    }, 20);
  }

  function showInfo() {
    const has = {
      species: game.species.length > 0, abilities: game.abilityMax > 0, starters: !!game.starters,
      wild: game.wild.length > 0, trainers: game.trainers.length > 0, learnsets: game.learnsets.size > 0, baseexp: game.species.some((s) => s.baseExp !== undefined),
      tms: !!game.tms, tmcompat: game.hasTmCompat, statics: !!(game.statics && game.statics.length), fielditems: !!game.fieldItems, shiny: !!(game.codeIps || game.setShinyOdds), trades: !!(game.trades && game.trades.length), eggs: !!game.eggs, evos: !!(game.evos && game.evos.list.length), marts: !!game.marts, strong: game.trainers.some((t) => t.ai !== undefined),
      helditems: game.species.some((s) => s.heldItems), bag: game.trainers.some((t) => t.bag), important: game.trainers.some((t) => t.important),
      story: !!(game.statics && game.statics.some((st) => st.story)), tradeevos: !!(game.evos && game.evos.list.some((e) => e.ent.some((x) => [...game.evos.methods.trade, ...game.evos.methods.tradeItem, ...game.evos.methods.tradeSpecies].includes(x.method)))),
    };
    document.querySelectorAll('[data-need]').forEach((el) => el.classList.toggle('off', !has[el.dataset.need]));
    $('starterNote').textContent = game.starters && game.starters.experimental ? T('Experimenteel voor deze game.') : '';
    $('romInfo').style.display = 'block';
    $('romInfo').innerHTML = '<b>' + game.name + '</b> — Gen ' + game.gen + ', ' + game.platform +
      '<br>' + game.species.length + ' Pokémon · ' + game.wild.length + ' ' + T('wilde gebieden') + ' · ' + game.trainers.length + ' trainers · ' +
      game.learnsets.size + ' ' + T('leersets') + (game.starters ? ' · ' + T('starters gevonden') : '') +
      (game.warnings.length ? '<div class="warn">' + game.warnings.map((w) => '• ' + T(w)).join('<br>') + '</div>' : '');
  }

  // Shiny-schuifbalk: stappen van 1 op 4096 (normaal) tot 1 op 256
  const SHINY_STEPS = [4096, 3072, 2048, 1536, 1024, 768, 512, 384, 256];
  const shinyLabel = () => { const o = SHINY_STEPS[num('shinyStep')] || 4096; $('shinyLabel').textContent = T('1 op {0}', o) + (o === 4096 ? ' ' + T('(normaal)') : ''); };
  $('shinyStep').addEventListener('input', shinyLabel);

  const radio = (n) => document.querySelector('input[name=' + n + ']:checked').value;
  const chk = (id) => $(id).checked;
  const num = (id) => +$(id).value || 0;

  // ---------- Eigen starters: lijst met alleen de Pokémon die in de geladen game zitten ----------
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9♀♂]/g, '');
  let pkList = [];
  const findPk = (v) => pkList.find((p) => norm(p.name) === norm(v));
  function validateCs(id) {
    const el = $(id), v = el.value.trim(), ok = !v || !!findPk(v);
    el.classList.toggle('bad', !!v && !ok); el.classList.toggle('good', !!v && ok);
    return ok;
  }
  function setupStarterList() {
    pkList = game ? game.species.slice().sort((a, b) => a.dex - b.dex).map((s) => ({ name: s.name, dex: s.dex })) : [];
    ['cs0', 'cs1', 'cs2'].forEach(validateCs);
    $('csHint').textContent = game ? T('Typ een letter en kies uit de lijst ({0} Pokémon in deze game).', pkList.length) : T('Laad eerst een ROM; daarna typ je een letter en kies je uit de lijst.');
  }
  document.querySelectorAll('.ac').forEach((box) => {
    const inp = box.querySelector('input'), ul = box.querySelector('.acList');
    let items = [], sel = -1;
    const hide = () => (ul.style.display = 'none');
    const render = () => {
      const q = norm(inp.value);
      items = q ? pkList.filter((p) => norm(p.name).startsWith(q)) : [];
      sel = items.length ? 0 : -1;
      ul.innerHTML = items.map((p, i) => '<li data-i="' + i + '"' + (i === sel ? ' class="on"' : '') + '><small>#' + p.dex + '</small>' + p.name + '</li>').join('');
      ul.style.display = items.length && document.activeElement === inp ? 'block' : 'none';
    };
    const pick = (i) => { if (!items[i]) return; inp.value = items[i].name; hide(); validateCs(inp.id); saveSettings(); };
    inp.addEventListener('input', () => { render(); validateCs(inp.id); });
    inp.addEventListener('focus', render);
    inp.addEventListener('keydown', (e) => {
      if (ul.style.display !== 'block' || !items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        [...ul.children].forEach((li, i) => li.classList.toggle('on', i === sel));
        ul.children[sel].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
      else if (e.key === 'Tab') pick(sel);
      else if (e.key === 'Escape') hide();
    });
    ul.addEventListener('mousedown', (e) => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(+li.dataset.i); } });
    inp.addEventListener('blur', () => {
      setTimeout(hide, 100);
      const m = findPk(inp.value); if (m) inp.value = m.name; // hoofdletters netjes zetten
      validateCs(inp.id);
    });
  });

  $('again').onclick = () => { newSeed(); $('go').click(); };

  $('go').onclick = () => {
    // Eigen starters: alleen geldige Pokémon uit deze game
    if (radio('starters') === 'custom') {
      for (const [i, id] of ['cs0', 'cs1', 'cs2'].entries()) {
        const v = $(id).value.trim();
        if (!v) { status(T('Fout: vul starter {0} in (of kies een andere starter-optie).', i + 1)); $(id).focus(); return; }
        if (!validateCs(id)) { status(T('Fout: "{0}" zit niet in deze game. Kies starter {1} uit de lijst.', v, i + 1)); $(id).focus(); return; }
      }
    }
    saveSettings();
    $('go').disabled = $('again').disabled = true;
    status(T('Bezig met randomizen…'));
    setTimeout(async () => {
      try {
        const g = is3ds ? await CTR.load(fileReader(srcFile)) : Randomizer.detectAndLoad(original.slice()); // altijd vanaf het origineel
        const opt = {
          seed: $('seed').value || 'seed',
          stats: radio('stats'), types: radio('types'),
          abilities: chk('abilities'), banWonderGuard: chk('banWonderGuard'), banBadAbilities: chk('banBadAbilities'),
          maxCatch: chk('maxCatch'), fastGrowth: chk('fastGrowth'), expMode: chk('expNormal') ? 'normal' : 'keep', expPct: num('expPct') || 100,
          starters: radio('starters'), starterNoLeg: chk('starterNoLeg'), customStarters: [$('cs0').value, $('cs1').value, $('cs2').value],
          wild: radio('wild'), wildNoLeg: chk('wildNoLeg'), wildLevel: num('wildLevel'), earlyCatch: chk('earlyCatch'), earlyCatchLevel: num('earlyCatchLevel') || 8, earlyCatchRate: num('earlyCatchRate') || 100,
          trainers: radio('trainers'), trainerNoLeg: chk('trainerNoLeg'), trainerLevel: num('trainerLevel'), trainerBetter: chk('trainerBetter'),
          learnsets: radio('learnsets'), firstMoveDamaging: chk('firstMoveDamaging'), noHmInLearnset: chk('noHmInLearnset'),
          tms: chk('tms'), tmCompat: radio('tmCompat'), tmCompatPct: num('tmCompatPct'),
          statics: radio('statics'), staticLegSwap: chk('staticLegSwap'), giftsToo: chk('giftsToo'), protectStory: chk('protectStory'), weakenStory: chk('weakenStory'), trades: chk('trades'), tradeReqToo: chk('tradeReqToo'), tradeNoLeg: chk('tradeNoLeg'), eggs: chk('eggs'), eggNoLeg: chk('eggNoLeg'), eggBasic: chk('eggBasic'),
          fixTradeEvos: chk('fixTradeEvos'), randomEvos: chk('randomEvos'), monotype: $('monotype').value,
          wildHeldItems: chk('wildHeldItems'), marts: chk('marts'), strongTrainers: chk('strongTrainers'), keepGymTypes: chk('keepGymTypes'), bossItems: chk('bossItems'),
          fieldItems: radio('fieldItems'), keepFieldTMs: chk('keepFieldTMs'),
          evoLevels: chk('evoLevels'), catchList: chk('catchList'), lang: window.I18N ? I18N.lang : 'nl',
          shinyOdds: SHINY_STEPS[num('shinyStep')] || 4096,
        };
        const log = [];
        const out = Randomizer.randomize(g, opt, log);
        lastLog = log.join('\n');
        const dot = fileName.lastIndexOf('.');
        const base = dot > 0 ? fileName.slice(0, dot) : fileName, ext = dot > 0 ? fileName.slice(dot) : '';
        const runName = base + '_random_' + opt.seed;
        let done = T('Klaar! Gerandomizede ROM gedownload.');
        if (is3ds) {
          const mode = radio('out');
          // Shiny-kans: zit bij .3ds in de ROM zelf; bij LayeredFS/wifi als code.ips (leeg = normaal, overschrijft een oude patch)
          const shinyIps = await g.codeIps();
          const ipsPath = 'luma/titles/' + g.titleId + '/code.ips';
          if (mode === 'rom') {
            status(T('Hashes herberekenen…'));
            const patches = (await g.buildPatches()).sort((a, b) => a.off - b.off);
            const parts = []; let pos = 0;
            for (const p of patches) {
              if (p.off > pos) parts.push(srcFile.slice(pos, p.off));
              const skip = Math.max(0, pos - p.off);
              if (skip < p.data.length) parts.push(p.data.subarray(skip));
              pos = Math.max(pos, p.off + p.data.length);
            }
            parts.push(srcFile.slice(pos));
            download(new Blob(parts), runName + ext);
          } else if (mode === 'layeredfs') {
            const files = await g.layeredFsFiles();
            files.push({ path: ipsPath, data: shinyIps });
            files.push({ path: 'LEES_MIJ_' + opt.seed + '.txt', data: new TextEncoder().encode(
              'Pak deze zip uit in de ROOT van je SD-kaart (de map "luma" bestaat daar al).\r\n' +
              'Zet in de Luma3DS-instellingen (SELECT ingedrukt houden bij het opstarten) "Enable game patching" aan.\r\n' +
              'Terug naar het origineel: verwijder de map luma/titles/' + g.titleId + '/romfs\r\nSeed: ' + opt.seed + '\r\n') });
            download(U.zip(files), runName + '_LayeredFS.zip');
            done = T('Klaar! LayeredFS-zip gedownload.');
          } else {
            const host = $('ftpHost').value.trim(), port = num('ftpPort') || 5000;
            if (!host) throw new Error(T('Vul het IP-adres van je 3DS in (staat bovenaan in FTPD).'));
            status(T('Versturen naar 3DS ({0})…', host));
            const files = (await g.layeredFsFiles()).concat([{ path: ipsPath, data: shinyIps }]).map((f) => ({ path: f.path, b64: U.toBase64(f.data) }));
            const res = await (await fetch('/api/ftp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host, port, files }) })).json();
            if (!res.ok) throw new Error(res.error);
            done = T('Klaar! {0} bestanden op je 3DS gezet. Sluit FTPD en start het spel.', res.sent.length);
          }
        } else download(out, runName + ext);
        $('log').textContent = lastLog; $('log').style.display = 'block'; $('logBtn').style.display = '';
        $('logBtn').onclick = () => download(new TextEncoder().encode(lastLog), runName + '_log.txt');
        status(done, true);
      } catch (err) { console.error(err); status(T('Fout: {0}', T(err.message))); }
      $('go').disabled = $('again').disabled = false;
    }, 20);
  };

  function download(bytes, name) {
    const url = URL.createObjectURL(bytes instanceof Blob ? bytes : new Blob([bytes]));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  // ---- Taal: automatisch (browsertaal, standaard Engels) + keuzelijst ----
  if (window.I18N) {
    const sel = $('langSel');
    if (sel) { sel.innerHTML = Object.entries(I18N.LANGS).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join(''); sel.value = I18N.lang; sel.onchange = () => I18N.setLang(sel.value); }
    I18N.onChange = () => { if (sel) sel.value = I18N.lang; shinyLabel(); setupStarterList(); updateOutBox(); if (game) showInfo(); };
    I18N.translatePage(); shinyLabel(); setupStarterList(); updateOutBox();
  }
})();
