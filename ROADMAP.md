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

## 3. Ideeën voor later

- **Presets**: "Klassiek", "Chaos", "Nuzlocke-vriendelijk" met één klik.
- **Instellingencode**: één korte code delen zodat iemand exact dezelfde randomizer krijgt.
- **"Waar vang ik wat"**: een overzicht per route in de log (zonder de starters te verklappen).
- **Log in het Engels** (de website is al meertalig; de log nog niet).
- **Meer talen** voor de website (Duits, Frans, Spaans…): alleen een woordenboek toevoegen in `js/i18n.js`.
- **Herkennen van een al gerandomizede ROM** met een waarschuwing.
- **Type per aanval randomizen** (kracht blijft), **evolutie-levels** randomizen.
- **Eerste partner**: starter en eerste route-Pokémon aan elkaar gekoppeld.
- **Speelbaarheidscontrole**: automatisch nagaan dat HM-gebruikers (Cut/Surf/Fly…) vroeg genoeg beschikbaar zijn.
- **Profielen**: favoriete instellingen per game met een naam bewaren.
