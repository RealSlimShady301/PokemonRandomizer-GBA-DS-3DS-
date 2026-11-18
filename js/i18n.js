// Meertaligheid: de pagina is in het Nederlands geschreven; I18N vertaalt teksten (Engels is de standaard).
// Nieuwe taal toevoegen: een woordenboek in DICT zetten (sleutel = Nederlandse tekst) en een optie in LANGS.
(function (g) {
  const LANGS = { en: 'English', nl: 'Nederlands' };
  const EN = {
    // ---- kop & stappen ----
    'Alles draait lokaal in je browser: je ROM wordt nergens heen gestuurd. Laad een ROM en je ziet alleen de opties die voor die game werken.':
      'Everything runs locally in your browser: your ROM is never uploaded. Load a ROM and you only see the options that work for that game.',
    'ROM kiezen': 'Choose ROM', 'Opties instellen': 'Set options', 'Randomizen': 'Randomize',
    'Sleep je ROM hierheen of': 'Drop your ROM here or', 'klik om te kiezen': 'click to browse',
    '.gb .gbc .gba .nds .3ds (ontsleuteld)': '.gb .gbc .gba .nds .3ds (decrypted)',
    // ---- Pokémon ----
    'Pokémon-eigenschappen': 'Pokémon properties', 'Basisstats': 'Base stats', 'Ongewijzigd': 'Unchanged',
    'Husselen (zelfde getallen, andere volgorde)': 'Shuffle (same numbers, different order)',
    'Willekeurig (zelfde totaal / BST)': 'Random (same total / BST)', 'Types': 'Types',
    'Willekeurig (enkel/dubbel blijft gelijk)': 'Random (single/dual stays the same)', 'Volledig willekeurig': 'Fully random',
    'Abilities': 'Abilities', 'Abilities randomizen': 'Randomize abilities', 'Geen Wonder Guard': 'No Wonder Guard',
    'Geen Truant / Slow Start / Defeatist': 'No Truant / Slow Start / Defeatist', 'Extra': 'Extra',
    'Alles makkelijk te vangen (catch rate 255)': 'Everything easy to catch (catch rate 255)',
    'Iedereen "Fast" XP-groei': 'Everyone "Fast" XP growth',
    'XP-rem: basis-XP gelijk aan het originele spel (tegen te snel levelen door random Pokémon)': 'XP brake: base XP like the original game (against levelling too fast because of random Pokémon)',
    'XP-hoeveelheid': 'XP amount', 'Items die wilde Pokémon vasthouden randomizen': 'Randomize items held by wild Pokémon',
    // ---- starters ----
    'Starters': 'Starters', 'Willekeurig': 'Random', 'Willekeurig, vergelijkbare sterkte': 'Random, similar strength', 'Zelf kiezen:': 'Choose yourself:',
    'Laad eerst een ROM; daarna typ je een letter en kies je uit de lijst.': 'Load a ROM first; then type a letter and pick from the list.',
    'Geen legendaries': 'No legendaries', 'Experimenteel voor deze game.': 'Experimental for this game.',
    // ---- statics ----
    'Static encounters & gift-Pokémon': 'Static encounters & gift Pokémon',
    'Legendaries alleen door legendaries vervangen': 'Replace legendaries only with legendaries',
    "Story-encounters beschermen (Kyogre, Groudon, Rayquaza, Deoxys blijven; Birch's Poochyena alleen vergelijkbare sterkte)": "Protect story encounters (story legendaries stay the same species; Birch's Poochyena only similar strength)",
    'Story-legendaries wel verzwakken: andere, zwakkere aanvallen en een zwakke ability': 'Weaken story legendaries: other, weaker moves and a weak ability',
    'Gift-Pokémon ook (fossielen, Castform, Beldum, Latios/Latias…)': 'Gift Pokémon too (fossils, Castform, Beldum, Latios/Latias…)',
    "Bv. de Poochyena die Prof. Birch aanvalt, Kyogre/Groudon, de Regi's, Voltorb, Kecleon.": 'E.g. the Poochyena attacking Prof. Birch, Kyogre/Groudon, the Regis, Voltorb, Kecleon.',
    // ---- items ----
    'Items in het veld & winkels': 'Field items & shops', 'Husselen (dezelfde items, op andere plekken)': 'Shuffle (same items, different places)',
    'Willekeurig: een TM wordt een andere TM, een item een ander item': 'Random: a TM becomes another TM, an item another item',
    "TM's op hun originele plek laten": 'Keep TMs in their original place',
    'Speciale winkels randomizen (de gewone Poké Mart per badge blijft hetzelfde)': 'Randomize special shops (basic items like Poké Balls and Potions stay for sale)',
    "Item-balls en verborgen items. Key items en HM's liggen niet in deze lijst, dus je kan niet vast komen te zitten.": "Item balls and hidden items. Key items and HMs are never moved, so you can't get stuck.",
    // ---- shiny ----
    'Shiny-kans': 'Shiny chance', '1 op 4096 (normaal)': '1 in 4096 (normal)', '1 op 4096': '1 in 4096', '1 op 256': '1 in 256',
    'Wordt rechtstreeks in de ROM gezet (en als code.ips bij LayeredFS / wifi).': 'Written directly into the ROM (and as code.ips for LayeredFS / wifi).',
    // ---- evoluties ----
    'Evoluties': 'Evolutions', 'Ruil-evoluties zonder ruilen (bv. Kadabra, Haunter, Machoke, Graveler)': 'Trade evolutions without trading (e.g. Kadabra, Haunter, Machoke, Graveler)',
    'Gewone ruil wordt level 37. Ruil met item: level stijgen terwijl de Pokémon dat item vasthoudt (oudere games: level 37).': 'Plain trade becomes level 37. Trade with item: level up while holding that item (older games: level 37).',
    'Willekeurige evoluties (elke Pokémon evolueert in iets anders, iets sterkers)': 'Random evolutions (every Pokémon evolves into something else, something stronger)',
    'Monotype-uitdaging': 'Monotype challenge', 'Type': 'Type', 'Uit': 'Off',
    'Alle Pokémon die je kan krijgen (wild, starters, gifts, trades, eieren) zijn van dit type. Trainers niet.': 'Every Pokémon you can get (wild, starters, gifts, trades, eggs) has this type. Trainers do not.',
    // ---- eieren & trades ----
    'Daycare-eieren': 'Daycare eggs', 'optioneel': 'optional', 'Eieren uit de daycare randomizen': 'Randomize daycare eggs',
    'Dezelfde evolutielijn geeft altijd hetzelfde (willekeurige) ei. Welke Pokémon samen kunnen breeden verandert niet.': 'The same evolution line always gives the same (random) egg. Which Pokémon can breed together does not change.',
    'Alleen basisvormen (zoals echte eieren, bv. Charmander maar geen Charizard)': 'Only base forms (like real eggs, e.g. Charmander but not Charizard)',
    'Geen legendaries uit eieren': 'No legendaries from eggs', 'In-game trades': 'In-game trades',
    'Trades randomizen (je krijgt een willekeurige Pokémon)': 'Randomize trades (you receive a random Pokémon)',
    'Ze vragen ook iets willekeurigs (iets dat in het wild te vangen is)': 'They also ask for something random (something catchable in the wild)',
    // ---- wild ----
    'Wilde Pokémon': 'Wild Pokémon', 'Volledig willekeurig per slot': 'Fully random per slot',
    'Groeit mee: zwakke Pokémon op de eerste routes, sterke later (volgens level)': 'Scales: weak Pokémon on the first routes, strong ones later (by level)',
    'Per gebied 1-op-1 vervangen': 'Replace 1-to-1 per area', 'Overal 1-op-1 (elke soort krijgt één vaste vervanger)': 'Global 1-to-1 (every species gets one fixed replacement)',
    'Eerste routes: eigen Pokémon die makkelijker te vangen zijn (ook legendaries)': 'First routes: their own Pokémon that are easier to catch (legendaries too)',
    't/m level': 'up to level', '· catch rate minstens': '· catch rate at least', 'Levels': 'Levels', '% hoger': '% higher',
    // ---- trainers ----
    'Trainers': 'Trainers', 'Type-thema per trainer (vergelijkbare sterkte)': 'Type theme per trainer (similar strength)',
    'Progressieve moeilijkheid (hoe verder in het spel, hoe sterker)': 'Progressive difficulty (the further into the game, the stronger)',
    'Gym leaders & Elite Four behouden hun type (bv. Roxanne blijft Rock)': 'Gym leaders & Elite Four keep their type (e.g. Roxanne stays Rock)',
    'Betere trainer-Pokémon (sterker per level) en slimmere movesets': 'Better trainer Pokémon (stronger per level) and smarter movesets',
    "Sterkere trainers: slimme AI + perfecte IV's": 'Stronger trainers: smart AI + perfect IVs',
    'Gym leaders, Elite Four & rivalen: Full Restores/Hyper Potions + sterke held items': 'Gym leaders, Elite Four & rivals: Full Restores/Hyper Potions + strong held items',
    'Trainers met eigen aanvallen krijgen automatisch passende aanvallen.': 'Trainers with custom moves automatically get fitting moves.',
    // ---- aanvallen ----
    'Aanvallen': 'Moves', 'Level-up aanvallen': 'Level-up moves', 'Willekeurig, voorkeur voor eigen type': 'Random, prefer own type',
    'Alleen aanvallen van eigen type (sterker per level)': 'Only moves of its own type (stronger per level)',
    'Eerste aanval doet altijd schade': 'First move always deals damage', 'Geen HM-aanvallen in level-up lijst': 'No HM moves in level-up list',
    "TM's": 'TMs', "TM-aanvallen randomizen (HM's blijven)": 'Randomize TM moves (HMs stay)', 'TM-compatibiliteit': 'TM compatibility',
    'Willekeurig, kans': 'Random, chance', 'Iedereen leert elke TM': 'Everyone learns every TM',
    // ---- uitvoer ----
    'Uitvoer (3DS)': 'Output (3DS)', 'Volledige .3ds — om te spelen op een emulator (bv. Azahar)': 'Full .3ds — to play on an emulator (e.g. Azahar)',
    'LayeredFS-zip — voor een echte 3DS met Luma3DS (uitpakken in de root van je SD-kaart)': 'LayeredFS zip — for a real 3DS with Luma3DS (extract to the root of your SD card)',
    'Rechtstreeks naar je 3DS sturen via wifi (FTPD moet openstaan op de 3DS)': 'Send directly to your 3DS via wifi (FTPD must be open on the 3DS)',
    'IP-adres van je 3DS': 'IP address of your 3DS', 'poort': 'port', 'Seed': 'Seed', 'Randomize': 'Randomize',
    '🔁 Nieuwe run': '🔁 New run', 'Log downloaden': 'Download log', 'Nieuwe seed': 'New seed',
    'Nieuwe seed + randomize met dezelfde instellingen': 'New seed + randomize with the same settings',
    // ---- dynamische meldingen (app.js) ----
    'Rechtstreeks sturen werkt alleen als je de app opent via start.bat.': 'Sending directly only works when you open the app via start.bat.',
    'Randomize & download': 'Randomize & download', 'Randomize & download .3ds': 'Randomize & download .3ds', 'Randomize & download zip': 'Randomize & download zip',
    'Randomize & stuur naar 3DS': 'Randomize & send to 3DS', 'ROM inlezen…': 'Reading ROM…', '3DS-ROM analyseren (kan even duren)…': 'Analysing 3DS ROM (this can take a moment)…',
    'Je vorige instellingen voor deze game zijn teruggezet.': 'Your previous settings for this game were restored.', 'Kan deze ROM niet gebruiken.': "Can't use this ROM.",
    'Typ een letter en kies uit de lijst ({0} Pokémon in deze game).': 'Type a letter and pick from the list ({0} Pokémon in this game).',
    'Fout: vul starter {0} in (of kies een andere starter-optie).': 'Error: fill in starter {0} (or choose another starter option).',
    'Fout: "{0}" zit niet in deze game. Kies starter {1} uit de lijst.': 'Error: "{0}" is not in this game. Pick starter {1} from the list.',
    'Bezig met randomizen…': 'Randomizing…', 'Klaar! Gerandomizede ROM gedownload.': 'Done! Randomized ROM downloaded.', 'Hashes herberekenen…': 'Recalculating hashes…',
    'Klaar! LayeredFS-zip gedownload.': 'Done! LayeredFS zip downloaded.', 'Vul het IP-adres van je 3DS in (staat bovenaan in FTPD).': 'Enter the IP address of your 3DS (shown at the top of FTPD).',
    'Versturen naar 3DS ({0})…': 'Sending to 3DS ({0})…', 'Klaar! {0} bestanden op je 3DS gezet. Sluit FTPD en start het spel.': 'Done! {0} files put on your 3DS. Close FTPD and start the game.',
    'Fout: {0}': 'Error: {0}',
    'Andere vormen kunnen voorkomen: gefuseerde Kyurem (White/Black), Zygarde 10% en Power Construct (Sun/Moon), Necrozma Dusk Mane/Dawn Wings (Ultra Sun/Moon)': 'Alternate forms can appear: fused Kyurem (White/Black), Zygarde 10% and Power Construct (Sun/Moon), Necrozma Dusk Mane/Dawn Wings (Ultra Sun/Moon)',
    'Preset': 'Preset', 'Klassiek': 'Classic', 'Chaos': 'Chaos', 'Nuzlocke-vriendelijk': 'Nuzlocke-friendly', 'Standaard': 'Default',
    'Instellingencode kopiëren': 'Copy settings code', 'Code laden': 'Load code', 'Overzicht "waar vang je wat?" in de log': '"Where to catch what" overview in the log',
    'Evolutie-levels willekeurig (ongeveer ±30%)': 'Random evolution levels (about ±30%)', 'Preset "{0}" toegepast.': 'Preset "{0}" applied.',
    'Instellingencode gekopieerd naar het klembord.': 'Settings code copied to the clipboard.', 'Kopieer deze code:': 'Copy this code:',
    'Plak hier een instellingencode:': 'Paste a settings code here:', 'Instellingencode geladen.': 'Settings code loaded.', 'Deze code klopt niet.': 'This code is not valid.', '1 op {0}': '1 in {0}', '(normaal)': '(normal)', 'wilde gebieden': 'wild areas', 'leersets': 'learnsets', 'starters gevonden': 'starters found',
    'Title ID: {0} — LayeredFS-map: luma/titles/{0}/': 'Title ID: {0} — LayeredFS folder: luma/titles/{0}/',
    // ---- waarschuwingen van de game-modules ----
    'Pokémon Mystery Dungeon wordt herkend, maar kan nog niet gerandomized worden (gepland).': 'Pokémon Mystery Dungeon is recognised, but cannot be randomized yet (planned).',
    'Onbekende ROM. Ondersteund: Pokémon Gen 1-7 (GB, GBC, GBA, DS, 3DS) en hacks die daarop gebaseerd zijn.': 'Unknown ROM. Supported: Pokémon Gen 1-7 (GB, GBC, GBA, DS, 3DS) and hacks based on them.',
    'Leersets niet gevonden': 'Learnsets not found', 'Level-up aanvallen niet gevonden': 'Level-up moves not found',
    'National Dex-tabel niet gevonden; Hoenn-namen kunnen afwijken': 'National Dex table not found; Hoenn names may differ',
    'Starter-keuzescherm niet gevonden: je krijgt de nieuwe starter, maar het scherm toont mogelijk de oude': 'Starter selection screen not found: you get the new starter, but the screen may show the old one',
    'Starternamen in de tekst konden niet aangepast worden (geen ruimte)': 'Starter names in the text could not be changed (no space)',
    'Starternamen in de tekst: geen ruimte in de ROM': 'Starter names in the text: no space in the ROM',
    'Starters niet gevonden in deze 3DS-game': 'Starters not found in this 3DS game', 'Starters niet gevonden voor deze ROM (bijv. Geel heeft vaste Pikachu)': 'Starters not found for this ROM (e.g. Yellow has a fixed Pikachu)',
    'Starters niet gevonden': 'Starters not found', 'Static encounters niet gevonden': 'Static encounters not found', 'TM-lijst niet gevonden': 'TM list not found',
    'Trainerdata niet gevonden': 'Trainer data not found', 'Veld-items niet gevonden': 'Field items not found',
    'Wilde Pokémon niet gevonden in deze 3DS-game': 'Wild Pokémon not found in this 3DS game', 'Wilde Pokémon niet gevonden': 'Wild Pokémon not found',
  };
  // Dynamische zinnen met getallen/namen (regex -> Engels)
  const EN_RX = [
    [/^Gebied (\S+) kon niet aangepast worden \(geen ruimte\)(.*)$/, 'Area $1 could not be changed (no space)'],
    [/^Zone (\S+) kon niet aangepast worden \(geen ruimte\) en is origineel gebleven$/, 'Zone $1 could not be changed (no space) and stayed original'],
    [/^(\d+) gebieden: elke soort is daar overal door dezelfde willekeurige soort vervangen.*$/, '$1 areas: every species there is replaced by the same random species (otherwise it does not fit in the ROM; the log may differ there)'],
    [/^Starternamen in de tekst aangepast \(de tekst van een andere taal, (\S+), is daarvoor vervangen door Engels\)$/, 'Starter names in the text changed (the text of another language, $1, was replaced by English for this)'],
    [/^Basisstats voor dex (.*)$/, 'Base stats for dex $1'],
  ];
  const DICT = { en: EN };

  const saved = (() => { try { return localStorage.getItem('lang'); } catch (e) { return null; } })();
  const nav = (typeof navigator !== 'undefined' && (navigator.language || '')).slice(0, 2).toLowerCase();
  let lang = saved && LANGS[saved] ? saved : (LANGS[nav] ? nav : 'en');

  const fmt = (s, args) => s.replace(/\{(\d+)\}/g, (m, i) => (args[i] !== undefined ? args[i] : m));
  function t(nl, ...args) {
    if (lang === 'nl') return fmt(nl, args);
    const d = DICT[lang] || {};
    if (d[nl]) return fmt(d[nl], args);
    if (lang === 'en') for (const [rx, rep] of EN_RX) if (rx.test(nl)) return nl.replace(rx, rep);
    return fmt(nl, args);
  }
  // Alle vaste teksten op de pagina vertalen (origineel bewaren zodat terugschakelen werkt)
  const orig = new WeakMap();
  function translatePage(root) {
    const w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (n.parentElement && n.parentElement.closest('script,style,pre,[data-no-i18n]')) continue;
      if (!orig.has(n)) orig.set(n, n.nodeValue);
      const src = orig.get(n), key = src.replace(/\s+/g, ' ').trim(); if (!key) continue;
      const tr = t(key); if (tr === key && lang !== 'nl') continue;
      const lead = src.match(/^\s*/)[0], trail = src.match(/\s*$/)[0];
      n.nodeValue = lead + tr + trail;
    }
    (root || document).querySelectorAll('[placeholder],[title]').forEach((e) => {
      for (const a of ['placeholder', 'title']) { if (!e.hasAttribute(a)) continue; const k = 'i18n' + a; if (!e.dataset[k]) e.dataset[k] = e.getAttribute(a); e.setAttribute(a, t(e.dataset[k])); }
    });
    document.documentElement.lang = lang;
  }
  function setLang(l) { if (!LANGS[l]) return; lang = l; try { localStorage.setItem('lang', l); } catch (e) { /* */ } translatePage(); if (g.I18N.onChange) g.I18N.onChange(l); }
  g.I18N = { t, translatePage, setLang, get lang() { return lang; }, LANGS, onChange: null };
})(typeof window !== 'undefined' ? window : globalThis);
