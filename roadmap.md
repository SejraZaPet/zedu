# Roadmap: Nový žákovský prostor (fáze 1)

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
