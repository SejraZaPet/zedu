# Roadmap: Nový žákovský prostor (fáze 1)

## Banka slov v doplňování
- [x] Banka slov, vracení slov, kliknutí a přetahování včetně dotyku
- [x] Nastavení editoru, výchozí zapnuto, falešná slova
- [x] Testy bodování/answers (453 testů); náhled Poživatin: přetažení, vrácení, dotyk a 5 odpovědí i po obnovení

## Kontrola odpovědí aktivit v lekci
- [x] Přidat nepovinné answers bez změny existujících dat a politik
- [x] Ukládání a přehled odpovědí v lekci i po návratu, staré výsledky beze změny
- [x] Testy a přihlášené ověření (449 testů, build OK; Poživatiny: 8 položek ihned i po obnovení)
- [ ] Doplnit správné odpovědi tří výroků Poživatin — vyžaduje potvrzení autorky, obsah ani skórování nebyly změněny

- [ ] A) Opravy zabezpečení a dat (jen DB)
  - [ ] A1 student_xp: žák nesmí insert/update vlastní řádek; čte jen svůj; žebříček přes bezpečnou funkci/pohled (spolužáci)
  - [ ] A2 učitel čte student_xp + student_badges jen žáků svých tříd/skupin
  - [ ] A3 student_activity_results: čtení pro učitele tříd/skupin žáka; ověřit TeacherResults rozbor
  - [ ] A4 student_practice_sessions + student_lesson_mastery: čtení učitelem i přes subject_group_members
  - [ ] A5 XP za odevzdání úkolu: trigger na assignment_attempts (ne submissions), jednou, bez zdvojení
  - [ ] Vypsat seznam změněných politik a funkcí
- [ ] B) StudentDashboard „Dnes“
  - [ ] Pořadí: pozdrav+avatar+série/XP, TodayWidget, „Co mě čeká“, StudentProgressWidgets, RecognitionWidget, „Další“ + karta „Učím se“ → /student/metody
  - [ ] Karta „Co mě čeká“: testy/zkoušení/písemky 14 dní, tlačítko „Připravit se“
- [ ] C) Studijní lišta u lekce (LessonPage + StudentTextbookDetail)
  - [ ] Kartičky (flashcards/reveal bloky, jinak AI edge fn lesson-study-helper režim cards, max 15, neukládat)
  - [ ] Shrnutí (režim summary, 5 odrážek, tykání)
  - [ ] Kvíz → /student/metody/<metoda>/procviceni?lesson=<id>&min=5
  - [ ] Zeptat se → ask-zedai-tutor s textem lekce (max 6000 znaků), i v StudentTextbookDetail
  - [ ] AI označení + demo kvóty zachovat

## Otevřené z minula
- [ ] Sjednotit délku platnosti zaváděcí ceny na webu (čeká na potvrzení majitelky)
- [ ] Ověřit připínání aktivit v plánu v browseru

## Oprava textu lekce pro procvičování
- [x] Sdílená extrakce vnořených bloků a čistý kontext chatu
- [x] Odmítnutí krátkého textu a srozumitelná hláška v procvičování
- [x] Testy, nasazení funkcí a ověření Poživatin (439 testů; 4 otázky v náhledu)

## Živé hry – sjednocení
- [x] Etapa 1a: převod Pravda/Nepravda, spojování, doplňovačka, seřazení na otázky při spuštění (šablony, knihovna, Rychlá hra, prezentace)
- [x] Etapa 1b: převod i z plánu lekce; staré jednosnímkové hry se rozloží při spuštění
- [ ] Etapa 1c: ruční vizuální kontrola projektoru
- [x] Etapa 2: bodování podle režimu na serveru, obě cesty, krádež + lupič + týmy (nasazeno)
- [ ] Klíč aktivity do add_xp (spolu s migrací ligy)
- [x] Etapa 3: jedno jádro pro obě cesty (live-game-core.ts)
- [x] Ostrá zkouška [TEST] her se 3 hráči (40 her, 0 chyb), úklid hotový
## Bezli liga v1
- [ ] Schváleno – po etapě 2: migrace xp_events, add_xp, school_league_week, cron, záložka Liga

## Etapa 1 – nálezy z testu na bezli.cz (16. 10.)
- [x] Telefon: Pravda/Nepravda velká tlačítka s popisky (ověřeno v náhledu)
- [x] Lobby text bezli.cz/live/pripojit + adresy /hra a /live vedou na připojení
- [x] Lišta „Prohlížíš jako“ nezakrývá tlačítka (spodní odsazení)
- [x] Průvodce: počet položek se dodrží (oříznutí výstupu AI)
- [x] Výsledky po ukončení: přehled se načte hned, „Zatím žádné odpovědi“
- [x] Smazána první kopie „Charakteristika…“; druhá (17:00) čeká na potvrzení
- [ ] Bezli liga v1 (čeká na pokyn)
