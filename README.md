# Pokémon Randomizer (GB · GBA · DS · 3DS)

A Pokémon ROM randomizer that runs **entirely in your browser**. You load your own ROM, you only see the options that work for that game, and you download a randomized ROM. Nothing is uploaded anywhere.

> De interface is meertalig (standaard Engels, ook Nederlands; automatisch volgens je browsertaal). ROMs worden **niet** meegeleverd: gebruik je eigen, legaal gedumpte games.

---

## Ondersteunde games

| Platform | Games |
|---|---|
| Game Boy / Color | Rood · Blauw · Geel · Goud · Zilver · Kristal |
| Game Boy Advance | Ruby · Sapphire · Emerald · FireRed · LeafGreen |
| Nintendo DS | Diamond · Pearl · Platinum · HeartGold · SoulSilver · Black · White · Black 2 · White 2 |
| Nintendo 3DS | X · Y · Omega Ruby · Alpha Sapphire · Sun · Moon · Ultra Sun · Ultra Moon (ontsleutelde `.3ds`) |

Hacks die op deze games gebaseerd zijn werken vaak ook (de randomizer zoekt de data op inhoud, niet op vaste adressen).

## Wat kan er gerandomized worden?

Welke opties je ziet hangt af van de geladen game.

- **Pokémon:** basisstats, types, abilities (met uitsluitingen zoals Wonder Guard), XP-groei, catch rate, items die wilde Pokémon vasthouden.
- **Starters:** willekeurig, vergelijkbare sterkte of zelf kiezen (met autocomplete). De naam **en het type** van de starter worden ook in de verhaaltekst aangepast (bv. Prof. Elm, Oak, Kukui).
- **Wilde Pokémon:** per slot, per gebied, globaal of oplopend met de levels; inclusief Safari Zone, Headbutt-bomen, Bug-Catching Contest, hordes en SOS-oproepen. Optie: eerste routes makkelijker te vangen.
- **Trainers:** willekeurige teams, gym leaders behouden hun type, sterkere AI en IV's, betere movesets, Full Restores voor bazen, levels omhoog.
- **Static encounters & gifts:** legendaries, fossielen, Game Corner-prijzen… Story-legendaries (bv. Kyogre/Groudon, Xerneas/Yveltal, Solgaleo/Lunala) blijven dezelfde soort zodat het verhaal werkt.
- **Aanvallen:** willekeurige level-up aanvallen (met voorkeur voor eigen type), TM's, TM-compatibiliteit.
- **Items:** item-balls, verborgen items, NPC-items, Game Corner-prijzen en Poké Marts. Key items blijven op hun plek; een TM wordt altijd een andere TM; basisitems (Poké Balls, Potions…) blijven altijd te koop.
- **Overige:** in-game trades, daycare-eieren, ruil-evoluties zonder ruilen, willekeurige evoluties en evolutie-levels, monotype-uitdaging, shiny-kans (tot 1 op 256), XP-rem tegen te snel levelen.
- **Presets & delen:** Klassiek, Chaos, Nuzlocke-vriendelijk met één klik, en een **instellingencode** om exact dezelfde instellingen met iemand te delen.
- **Waar vang je wat?** De log bevat per Pokémon waar je hem kan vangen of krijgen (wild met levels, gifts, statics, trades).

Een **log** met alle wijzigingen (en de exacte instellingen + seed) kan je downloaden. Met dezelfde seed en instellingen krijg je exact dezelfde ROM.

## Gebruik

1. Download of clone deze repository.
2. Dubbelklik op **`start.bat`** (start een kleine lokale webserver met Python) of open `index.html` rechtstreeks in je browser.
3. Sleep je ROM op de pagina.
4. Kies je opties en klik op **Randomize & download**.

### 3DS-uitvoer

- **Volledige `.3ds`:** speelbaar in emulators zoals Azahar/Citra. Alle checksums (RomFS/ExeFS) worden opnieuw berekend.
- **LayeredFS-map:** alleen de gewijzigde bestanden, voor Luma3DS op een echte 3DS of de mods-map van Azahar.
- **Rechtstreeks naar je 3DS (FTP):** via `start.bat` + een FTP-app op de 3DS (bv. ftpd).

## Projectstructuur

```
index.html        interface
js/app.js         UI, instellingen per game, uitvoer
js/randomizer.js  alle randomizer-logica (platform-onafhankelijk)
js/gb.js          Gen 1-2 (GB/GBC)
js/gba.js         Gen 3 (GBA)
js/nds.js         Gen 4-5 (DS) incl. NARC/arm9 (BLZ) en tekst
js/ctr.js         Gen 6-7 (3DS) incl. RomFS/IVFC, GARC, LZ11/BLZ, tekst
js/data.js        namen, legendaries, types
js/util.js        hulpfuncties, seeded RNG, zip
server.py         lokale server + FTP-upload naar de 3DS
start.bat         start de server en opent de pagina
NOG_TE_DOEN.md    wat nog niet ingebouwd of getest is
ROADMAP.md        plannen: Mystery Dungeon, Switch-games, ideeën
js/i18n.js        vertalingen van de website
```

## Status

Plannen voor Mystery Dungeon en de Switch-games staan in **[ROADMAP.md](ROADMAP.md)**.

Alles is getest op echte ROMs (dat de ROM correct wordt aangepast en de checksums kloppen), maar nog niet alles is in-game uitgespeeld. Wat nog ontbreekt of nog niet getest is staat in **[NOG_TE_DOEN.md](NOG_TE_DOEN.md)**.

## Belangrijk

- Er zitten **geen ROMs** in deze repository en dat moet zo blijven (zie `.gitignore`).
- Gebruik altijd een kopie van je originele ROM; de randomizer werkt vanaf het origineel en past dat bestand zelf nooit aan.
