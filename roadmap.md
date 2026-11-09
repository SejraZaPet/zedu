# Roadmap

## Demo – únik obsahu skutečných učitelů (schváleno, etapy 1–3)
- [ ] Etapa 1: demo_iso_strict na worksheets + ověření
- [ ] Etapa 2: demo_iso_strict na teacher_presentations a teacher_textbooks + ověření
- [ ] Etapa 3: demo_guard_update/delete na lessons + ověření

## Časovač a „Spustit“ u živých aktivit – čeká na schválení plánu
- [ ] Plán připraven, neimplementovat bez „schvaluji“

## Přiložení pracovních listů – dvě schválené opravy
- [x] Štítky a potvrzené zveřejnění nezveřejněných listů ve formuláři
- [x] Přidání do existující úlohy a varování před duplicitním novým zadáním
- [x] Čtecí diagnostika, cílené testy a kontrola 390 px; bez DB/RLS, edge funkcí, deploye a mazání
- Neověřeno: původní stav před zveřejněním a skutečný zápis/čtení žákem; ověřování zápisů pouze místní simulací, data učitelky nedotčena.

## Aktivity z vlastních lekcí – schválené etapy 1+2
- [x] Sdílené okno: vlastní lekce → část → typ/počet → upravit návrh → vložit koncept
- [x] Rychlá hra, Moje aktivity a editor pracovního listu; zdroj v existujícím JSON
- [x] Testy vlastnictví, textových limitů, metadat, chyb a konceptů; kontrola 390 px s místním testovacím návrhem
- Neověřeno: skutečné AI a uložení/žákovské čtení (účet nemá vlastní lekce; žádná testovací data v DB nevytvářena).
- Bez DB/RLS, edge funkcí a nasazení; obtížnost, otevřené otázky a upozornění na změnu lekce nyní nedělat

## Hodnocení úkolů – etapy 1+2 (schváleno) – HOTOVO
- [x] Etapa 1: stránka „Ke kontrole“ (/ucitel/ke-kontrole) – seznam, filtry, hledání žáka, Další/Předchozí + klávesy J/K, bodování stávajícím mechanismem
- [x] Etapa 2: hromadné akce (zkontrolováno, společný komentář, šablony), potvrzení, „Upozornit žáky“ výchozí vypnuté, „Vrátit zpět“ (undo); score/status se nemění
- [x] Odkaz z dashboardu (dlaždice „Ke kontrole“) a z nabídky v záhlaví
- [x] Testy (13 nových, 24 cílených), typy, build, mobil 390 px bez posunu

## Pracovní list: Postup podle metody + Příklady z praxe (etapy 1–3 schváleny) – HOTOVO
- [x] Etapa 1: nový typ `method_steps` (fáze max 8, výchozí 0 b., bodovaná fáze = ruční hodnocení jako open_answer), editor, přehrávač, tisk/PDF, offline export
- [x] Etapa 2: dialog „Přidat část → Postup podle metody“ – katalog metod (steps_json) + jedním klikem z posledního Návrhu podle metody
- [x] Etapa 3: nový typ `practice_examples` (ručně; nadpis, situace, volitelná otázka, volitelné body); AI tlačítko NEZOBRAZOVAT
- [x] Testy (14 nových, 34 cílených), typy, build; dialog ověřen v prohlížeči; vložený blok v prohlížeči neověřen (vyžadovalo by zápis do cizího listu)
- Etapa 4 (AI návrhy příkladů, edge funkce) NESCHVÁLENA – nedělat

## Pozdější etapy (NESCHVÁLENO – nedělat)
- Etapa 3: stupnice/známky, převodní tabulka, zobrazení žákovi po „zkontrolováno“
- Etapa 4: vrácení k přepracování, známka rodiči (DB, samostatné schválení)
