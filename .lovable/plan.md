# Nejlepší výsledky a silné/slabé stránky

## Co se změní
- Přidám jeden sdílený výběr nejlepšího výsledku aktivity a nejlepšího odevzdaného pokusu. Nejvyšší poměr bodů vyhraje, při shodě novější výsledek.
- Napojím na něj požadované přehledy žáka, učitele, výsledků, pokroku, žebříčku a portfolia. Učitel u úkolu uvidí nejlepší pokus jako hlavní a bude moci přepnout na ostatní; hodnocení zůstane u zvoleného pokusu.
- Přepracuji „Statistiku obtížnosti“ na „Silné a slabé stránky“. První pokus určí počáteční úspěšnost, nejlepší pokus dosaženou úspěšnost; doplním opakování, průměr pokusů a jména žáků, kteří zůstali pod 50 %.
- Na stránce Výsledky přidám souhrn 5 nejsilnějších a 5 nejslabších položek napříč filtrovanými úkoly, s odkazem na úkol a upozorněním při méně než třech žácích.
- Uložené výsledky ani pokusy se nebudou měnit, mazat ani slučovat.

## Technické provedení
- Čisté výpočty soustředím do `src/lib/best-results.ts` a pomocníků statistiky, aby pořadí načtených řádků neměnilo výsledek.
- Skupinový klíč aktivity bude zahrnovat žáka, lekci a `activity_index`; klíč pokusu žáka a úkol. První pokus se určí nejstarším `completed_at`, respektive nejnižším `attempt_number`.
- Automaticky hodnotitelné otázky zůstanou omezené na stávající podporované typy; ruční odpovědi zůstanou pod „Vyžaduje ruční kontrolu“.
- Panel Výsledků bude používat stejný výpočet jako detail úkolu a bude respektovat aktuální třídu/skupinu, předmět i stav.
- Trigger XP pouze zkontroluji a výsledek uvedu; databázové chování XP nezměním.

## Ověření
- Testy: nejlepší výsledek včetně shody, různého pořadí, jednoho a žádného řádku; první pokus; počet a průměr opakování; rozdělení a řazení silných/slabých/ostatních.
- Regresní kontrola hodnocení konkrétního pokusu, filtrů Výsledků a sestavení aplikace.
