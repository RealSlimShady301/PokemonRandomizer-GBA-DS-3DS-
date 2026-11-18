# Roadmap

Wat er nog komt, en hoe het in de bestaande opbouw past. Wat binnen de huidige games nog ontbreekt staat in [NOG_TE_DOEN.md](NOG_TE_DOEN.md).

## Hoe een nieuwe game-familie wordt toegevoegd

Elke familie is één module die een **gedeeld game-model** oplevert (`species`, `wild`, `trainers`, `learnsets`, `starters`, `statics`, `fieldItems`, `marts`, …). `js/randomizer.js` werkt alleen op dat model, dus alle bestaande opties (legendaries uitsluiten, gym-types behouden, XP-rem, log, seeds…) werken automatisch voor elke nieuwe module. De website toont alleen de opties waarvoor de module data levert.

Nieuwe module = 1) herkennen (`detect`), 2) data inlezen naar het model, 3) `commit()`-functies die terugschrijven, 4) uitvoer (volledige ROM of mod-map).

## 1. Pokémon Mystery Dungeon (DS/GBA)

De ROMs worden al **herkend** (Explorers of Sky/Time/Darkness, Blue Rescue Team) en krijgen een duidelijke melding. Plan:

| Onderdeel | Waar het staat (Explorers of Sky) | Aanpak |
|---|---|---|
| Pokémon per verdieping | `BALANCE/mappa_s.bin` (+ `mappa_y/g`) | spawn-lijsten per dungeon/verdieping randomizen, met level-schaal |
| Items per verdieping | `mappa_s.bin` item-tabellen | categorie-bewust (zaden ↔ zaden, TM's ↔ TM's) |
| Partner/held (persoonlijkheidstest) | tabel in een overlay | eigen keuze of willekeurig, net als starters |
| Aanvallen per Pokémon | `BALANCE/waza_p.bin` | zelfde opties als level-up aanvallen |
| Pokémon-data | `BALANCE/monster.md` | types/abilities/IQ-groepen |
| Kelder-/eindbazen | scripts + `mappa` | story-bazen beschermen |
| Tekst (namen in verhaal) | `MESSAGE/text_e.str` | starternaam vervangen, zoals in de hoofdgames |

Compressie (AT4PX/PKDPX/SIR0) moet nog in- en uitgepakt kunnen worden; de NDS-bestandsopbouw (FAT/NARC, arm9) is al aanwezig in `js/nds.js`.

## 2. Switch-games

Switch-games kunnen niet als één bestand gepatcht worden zoals een `.3ds`. De randomizer zal daarom een **mod-map** maken (LayeredFS), net zoals nu al voor de 3DS:

- echte Switch (Atmosphère): `atmosphere/contents/<TitleID>/romfs/…`
- emulators (Ryujinx en afgeleiden): de mods-map van de game.

Je levert de **RomFS** van je eigen game (uitgepakt met je eigen console/keys); de randomizer leest daaruit en schrijft alleen gewijzigde bestanden terug.

| Game | Formaat | Te doen |
|---|---|---|
| Let's Go Pikachu/Eevee | GFPAK + FlatBuffers | wild, trainers, starters-partner, items |
| Sword/Shield (+ DLC) | FlatBuffers (`personal_total.bin`, `waza`, `encount_*.bin`, trainers) | wild per weer, Max Raid Dens, trainers, gifts |
| Brilliant Diamond/Shining Pearl | Unity AssetBundles | asset-bundle lezen/schrijven |
| Legends: Arceus | FlatBuffers in `.trpak` | spawners, alpha's, items |
| Scarlet/Violet | `trpfs`/`trpak` + FlatBuffers | wild (zones), Tera Raids, trainers, items |

Volgorde: eerst een algemene FlatBuffer-lezer/schrijver en de mod-map-uitvoer, dan Sword/Shield (meeste vrij gedocumenteerde data), daarna de rest.

## 3. Nuzlocke-regels (later bekijken)

Eerder besproken en toen bewust uitgesteld; om later opnieuw te bekijken:
- eerste-encounter-per-route bijhouden (op basis van het "waar vang je wat"-overzicht);
- optionele hulp in de ROM zelf (bv. geen items in gevechten, level caps per badge) of alleen een checklist/tracker op de website;
- "Nuzlocke-vriendelijk"-preset bestaat al (1-op-1 per gebied, geen legendaries, XP-rem…).

## 4. Ideeën voor later

- **Plaatsnamen** in het "waar vang je wat"-overzicht voor DS-games en Sun/Moon (nu nog gebiedsnummers; GBA, X/Y en ORAS hebben al echte namen).
- **Pokédex-gebiedskaart** voor Zwart/Wit (1/2): de game bewaart die als kant-en-klare afbeeldingen per Pokémon; die zouden opnieuw getekend moeten worden.
- **Log volledig in het Engels** (kopjes en vaste zinnen zijn al vertaald).
- **Meer talen** voor de website (Duits, Frans, Spaans…): alleen een woordenboek toevoegen in `js/i18n.js`.
- **Herkennen van een al gerandomizede ROM** met een waarschuwing.
- **Type per aanval randomizen** (kracht blijft) — optioneel, want aanvaldata aanpassen was eerder niet gewenst.
- **Eerste partner**: starter en eerste route-Pokémon aan elkaar gekoppeld.
- **Speelbaarheidscontrole**: automatisch nagaan dat HM-gebruikers (Cut/Surf/Fly…) vroeg genoeg beschikbaar zijn.
- **Profielen**: eigen presets met een naam bewaren.

## Klaar (uit eerdere ideeën)

- Presets (Klassiek, Chaos, Nuzlocke-vriendelijk, Standaard) en een deelbare **instellingencode**.
- Overzicht **"waar vang je wat?"** in de log (wild, gifts, statics, trades).
- **Willekeurige evoluties** en **willekeurige evolutie-levels** op elke game.
- Website meertalig (Engels/Nederlands).
- **Plaatsnamen** voor X/Y en ORAS in het "waar vang je wat"-overzicht.
- **Pokédex-gebiedskaart** klopt met de nieuwe wilde Pokémon in Diamond/Pearl/Platinum en HeartGold/SoulSilver (GB/GBA berekenen dit zelf uit de wilde data).
