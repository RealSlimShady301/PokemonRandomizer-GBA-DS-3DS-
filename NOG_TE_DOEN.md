# Nog in te bouwen (per game)

Bijgehouden zodat dit later nog toegevoegd kan worden. Alles hieronder is **nog niet** ingebouwd.
"Niet in-game getest" = werkt in de code en de controles, maar is nog niet echt gespeeld in een emulator.

## Game Boy (Rood/Blauw/Geel/Goud/Zilver)
- Geen eigen ROM om op te testen: Gen 1 en Goud/Zilver zijn alleen op testdata gecontroleerd.

## Crystal
- Shiny-kans (Gen 2 bepaalt shiny via DV's, een ander systeem).
- Starternaam: alleen Elm's keuzevraag is aangepast (bij een lange naam + dubbel type wordt alleen het eerste type genoemd).
- Game Corner-prijs-items (TM's): de Pokémon-prijzen zijn wel random.
- Prijsmenu's tonen nog de originele namen (alleen tekst; je krijgt wel de nieuwe).
- Niet in-game getest: verborgen items, Headbutt/Rock Smash, Bug-Catching Contest, field items, marts.

## Ruby / Sapphire / Emerald / FireRed / LeafGreen
- Daycare-eieren (Gen 3 heeft hiervoor geen aparte tabel).
- Static encounters van events (Mew, Deoxys, Lugia/Ho-Oh) en de spook-Marowak blijven zoals ze zijn.
- Starternaam: Oak's vraag (FRLG) en de type-uitleg van je rivaal (RSE) zijn aangepast; overige vermeldingen (posters, poppen, Pokédex) niet.
- Prijsmenu's in de Game Corner tonen nog de originele namen (alleen tekst).
- Niet in-game getest: verborgen items, Game Corner-prijzen, field items, marts, TM-compatibiliteit, shiny-kans.

## Diamond / Pearl / Platinum
- Opgelost: static encounters werden op de verkeerde plek in het script geschreven (gold voor alle DS-games); nu nagekeken na opnieuw inlezen.
- Gifts/statics: Eevee, Porygon en de meeste legendaries zijn ingebouwd; Dialga/Palkia op Spear Pillar, Togepi-ei, fossielen en Rotom nog niet (andere scriptvorm).
- Poké Marts en verborgen items zijn nu ingebouwd (Odd Keystone blijft liggen voor Spiritomb); NPC-items (giveitem via 0x8004) nog niet.
- Daycare-eieren; Great Marsh-dagelijkse Pokémon; honingbomen.
- Pokédex-gebiedskaart: wordt bijgewerkt, maar zonder onderscheid ochtend/dag/nacht (elke nieuwe Pokémon staat op alle tijdstippen).
- Niet in-game getest: wilde Pokémon, starters, TM's, trades, items in het veld.

## HeartGold / SoulSilver
- Gifts/statics: Dratini, Tyrogue, Eevee, de vogels, Mewtwo, Suicune, Snorlax, Sudowoodo, rode Gyarados... zijn ingebouwd; Lugia/Ho-Oh, eieren en fossielen nog niet.
- Poké Marts en verborgen items zijn nu ingebouwd.
- Bug-Catching Contest; Pokéwalker.
- De cutscene vóór de starterkeuze kan nog de originele naam/sprite tonen.
- Niet in-game getest: wilde Pokémon, Safari Zone, Headbutt-bomen, starters, TM's, trades, items in het veld.

## Black / White / Black 2 / White 2
- DSi-versies (NDSi Enhanced): de vergrote tekst staat achter het DSi-gedeelte; op echte hardware niet getest.
- Static encounters en gifts zijn ingebouwd (aapjes, Magikarp, Zorua, Deerling, eieren, Eevee); fossielen nog niet. Reshiram/Zekrom in Zwart/Wit beschermd.
- Poké Marts zijn ingebouwd (Zwart/Wit: overlay 21, Zwart 2/Wit 2: a/2/8/2); NPC-items (andere scriptvorm) nog niet.
- Hidden grottos; Join Avenue.
- Pokédex-gebiedskaart ("habitat") toont nog de originele plaatsen: de game bewaart ze als afbeeldingen.
- Starternaam: keuzescherm en verhaaltekst (gym-quiz, boeken, NPC's) aangepast; de lengte/gewicht-quiz (met getallen) noemt nog de originele starters.
- Starter-keuzescherm: script-aanpassing is experimenteel.
- "NDSi Enhanced": op een echte DSi/3DS in DSi-modus kan de aangepaste code geweigerd worden; emulators en DS-modus zijn ok.
- Niet in-game getest: wilde Pokémon, starters, TM's, trades, items in het veld.

## X / Y
- Friend Safari; hordes zijn nu 5 verschillende Pokémon.
- Pokédex-gebied: niet nagekeken of de game dit zelf uit de wilde data haalt (ORAS: de gezamenlijke encountertabel wordt mee aangepast).
- Starternaam: verhaal-, systeemtekst en scripts aangepast; alleen Tierno's lengte/gewicht-quiz (met getallen) blijft over de originele starters gaan.
- Niet in-game getest: wilde Pokémon, statics, starters, TM's.

## Omega Ruby / Alpha Sapphire
- Wally's Ralts (zit in een story-script); DexNav.
- "Waar vang je wat": alleen bij Kyogre/Groudon Lv60 en Wurmple Lv3 (static) is de plaats onbekend. Kanto-starters Lv10 en Lucario Lv32 staan in de gift-tabel maar worden in het spel niet gebruikt.
- Mirage spots: met story-bescherming blijven de Pokémon die een andere spot openen dezelfde (Uxie/Mesprit/Azelf, Dialga/Palkia, Reshiram/Zekrom, Lugia/Ho-Oh); zonder bescherming kunnen Giratina, Kyurem en de beasts onbereikbaar worden. Giratina en Kyurem vragen ook in het origineel beide versies (ruilen).
- In-game getest (TEST4): starternaam in Birch's lab ("received Glalie"), White Kyurem, Groudon en Tornadus op Route 101 (testmodus).
- Typeles van je rivaal: noemt zo nodig maar 1 type sterk/zwak, omdat de tekst op zijn originele plek moet passen.
- Niet in-game getest: TM's (nieuw).

## Sun / Moon / Ultra Sun / Ultra Moon
- Items in het veld (en dus Z-kristallen per categorie) en Poké Marts: uitgezocht maar nog niet gevonden waar de game ze bewaart (niet in de scripttabel zoals in X/Y/ORAS, en niet als vaste velden in de wereld-data).
- Daycare-eieren, Island Scan, Poké Pelago.
- Starternaam in verhaaltekst en scripts aangepast (tekst blijft op zijn plek); past het niet, dan worden alleen de namen vervangen en niet de types erbij (melding in de opmerkingen).
- Wilde Pokémon: in sommige gebieden past "elk slot apart" niet; daar wordt elke soort door één vaste willekeurige soort vervangen (de log kan daar afwijken).
- Niet in-game getest (alles), incl. de Ultra Necrozma-cutscene (Necrozma blijft Necrozma).

## Vormen
- Andere vormen getest in de data (schrijven + opnieuw inlezen): Kyurem White/Black (X/Y, ORAS, Ultra Sun, Zwart 2/Wit 2), Zygarde 10%/Power Construct/Complete en Necrozma Dusk Mane/Dawn Wings/Ultra (Ultra Sun). Nog niet in-game gespeeld.
- Zygarde Complete en Ultra Necrozma zijn gevechtsvormen: na het gevecht/vangen kan de game ze terugzetten naar hun gewone vorm (zoals in het origineel).
- Zwart 2/Wit 2: statics (Kyurem in Giant Chasm) kunnen geen andere vorm krijgen (het script-commando heeft geen vorm); gifts, wilde Pokémon en trainers wel.

## Mystery Dungeon (Blue Rescue Team, Explorers of Sky)
- Wordt niet herkend: andere soort game, zou een aparte module nodig hebben.

## Switch-games
- Later.
