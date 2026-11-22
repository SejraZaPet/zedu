# Nástěnka: chyba při zveřejnění, ztráta rozepsaného, plánování

## 1) „Příspěvek se nepodařilo uložit“

Ověřeno čtením:
- Zápis řádku (`wallDraftRow`) vyhovuje databázi. Omezení CHECK se týkají jen `exam_type`, `lesson_source` a „třída XOR skupina“. Povinné `materials` se posílá (`[]` nebo seznam), `subject_id` smí být prázdné.
- Pravidlo pro vložení: `teacher_id = já` a `can_assign_to_target`. Admin projde i přes „Admin can manage“. Omezení `demo_iso` se Tyny netýká.
- Triggery na `assignments` se spouští až při `published`, koncept (`draft`) je nespustí. Při vložení tedy nic neselže.
- V záznamech databáze za poslední období není žádná chyba INSERT ani RLS na `assignments`.

Příčina proto **není potvrzená**. Pravděpodobně požadavek vůbec nedorazil do databáze, nebo selhalo až čtení vloženého řádku (`.select("id").single()`). Nejpravděpodobnější je vypršené nebo právě obnovované přihlášení po návratu na kartu, což souvisí s bodem 2. Kód skutečnou chybu zahazuje, proto ji nevidíme.

Oprava:
- Chybu z vložení i ze zveřejnění zalogovat do konzole (`code`, `message`, `hint`, bez textu příspěvku a materiálů). Do hlášky přidat srozumitelný důvod podle kódu:
  - 42501/RLS → „Nemáte oprávnění psát do této třídy/skupiny“
  - JWT/401 → „Přihlášení vypršelo, obnovte stránku – koncept zůstane uložený“
  - síť → „Bez připojení“
  - jinak → obecná hláška s kódem
- Při chybě přihlášení jednou zkusit `refreshSession` a zápis zopakovat.
- Po nasazení logů chybu zreprodukovat s Tynou a příčinu potvrdit.

## 2) Ztráta rozepsaného po přepnutí karty

Příčina (z kódu):
- Při návratu na kartu přihlášení obnoví token (`onAuthStateChange` → `applySession`) a vytvoří nový objekt `user`.
- Hlavní načítání v `TeacherSubjectClass` (efekt ř. ~305–510) závisí na `user`. Spustí se znovu a nastaví `loading`, takže ř. ~1326 vykreslí místo stránky načítací kolečko.
- Tím se `WallComposer` odmontuje a jeho `useState` koncept se ztratí.

Oprava:
- Efekt navázat na `user?.id` místo objektu `user`. Opakované načtení dělat na pozadí bez celostránkového `loading`, pokud už data jednou jsou.
- `WallComposer`: koncept průběžně ukládat do localStorage, klíčovat podle učitele a třídy/skupiny (krátká prodleva). Po načtení se zeptat „Pokračovat v rozepsaném příspěvku?“ (Pokračovat / Zahodit). Po zveřejnění koncept smazat.
- Stejný vzor (závislost na `user` + loading gate) zkontrolovat v Úkolech (`TeacherAssignments`), editoru plánu hodiny, `WorksheetEditor` a editoru prezentací. Plán hodiny a list už mají autosave do DB, Úkoly a dialog materiálu nejspíš ne. Stejnou úpravu závislosti a koncept v localStorage přidat tam, kde se potvrdí.

## 3) Plánování příspěvků na čas

Co existuje:
- `scheduled_publish_at` a stav `scheduled` se používají v Úkolech (`TeacherAssignments`, ř. ~660–760 a ~910 zobrazení). Tedy pro úkol, materiál i oznámení vytvořené přes `/ucitel/ulohy`.
- `publish_due_assignments()` přepne `scheduled` → `published` bez ohledu na druh, takže platí i pro nástěnku. Notifikace žákům a rodičům pak spustí triggery jako při ručním zveřejnění. E-mail se odešle podle `notifyEmail`, to je třeba ověřit u odesílací funkce.
- **Riziko:** v `cron.job` jsem nenašel úlohu, která `publish_due_assignments` volá. Naplánované položky se tak možná samy nezveřejní. Je potřeba ověřit (případně jiný název úlohy) a zapnutí cronu schválit zvlášť jako DB změnu (doporučeno každých 5 min = 288 běhů/den).

UI na nástěnce:
- Vedle „Zveřejnit“ volba „Naplánovat“ s datem a časem v Europe/Prague (stejný převod jako v Úkolech). Uloží `status='scheduled'` a `scheduled_publish_at`.
- Na zdi (jen pro učitele) karta „Naplánováno na 24. 11. 8:00“ s akcemi Upravit čas / Zrušit plán (zpět na koncept) / Zveřejnit hned. Žáci položky `scheduled` nevidí (filtr na `published` a RLS), to je třeba ověřit čtením pravidel.

## Rizika
- Bod 1 bez reprodukce může mít jinou příčinu, proto napřed logy.
- Koncepty v localStorage jsou jen v jednom prohlížeči. Nesmí uchovávat nic citlivého o žácích, jde jen o text a odkazy na soubory.
- Cron vyžaduje schválení DB změny.

## Testy
- `wall-composer`: převod chyby na srozumitelnou hlášku podle kódu (RLS, JWT, síť).
- Koncept: uložit → obnovit → zahodit, klíč podle třídy/skupiny.
- Regresní: změna objektu `user` se stejným id nespustí `loading` a nezmizí composer.
- Plánování: převod času Praha ↔ UTC (letní/zimní čas), stav `scheduled` se na žákovské zdi nezobrazí.

Bez změn DB/RLS, kromě případného zapnutí cronu po schválení.
