# Lepší hodnocení úkolů a hromadná kontrola (diagnostika a návrh, NEIMPLEMENTOVÁNO)

## 1. Jak se hodnotí dnes
- **Kde:** `AssignmentDetailDialog` se otevírá z „Úlohy“ (`TeacherAssignments`) i z „Výsledky“ (`TeacherResults`). Funguje vždy jen pro **jeden úkol**: seznam žáků, u každého se rozbalí odevzdání.
- **Data pokusu** (`assignment_attempts`): `status` (`in_progress`/`submitted`), `score`/`max_score`, `answers`, `progress`, `submission_note`, `group_id` (skupinové odevzdání), `teacher_feedback_text`, `teacher_feedback_emoji`, `teacher_feedback_at/by`.
- **Automatické hodnocení:** testové položky (výběr, doplňování, mapa…) se bodují už při odevzdání. Výsledek se zapíše do `score/max_score`.
- **Ruční přebodování:** `saveGrading` uloží body po položkách do `progress._teacher_grading` a jejich součet do `score/max_score`. Odpovědi žáka se nemění. Žák pak dostane upozornění „ohodnotil… X/Y bodů“.
- **Slovní hodnocení:** `patchAttempt` ukládá text nebo emoji. Upozornění žákovi odchází, jen když se hodnota opravdu změní.
- **Stavy:** jen „rozpracováno“ a „odevzdáno“. Stav „zkontrolováno“, „vráceno k přepracování“ ani známka neexistuje. „Hodnoceno“ se dnes odvozuje z `submitted` + vyplněného `score`, takže automaticky obodovaný test vypadá jako hotový, i když ho učitelka neviděla.
- **Automatika v databázi při změně bodů nebo stavu:** upozornění rodiči na hodnocení (`trg_notify_parents_on_grade`, `trg_notify_parent_attempt_graded`), synchronizace portfolia a push u každého upozornění. **Každé hromadné přebodování by tedy rozeslalo hromadná upozornění rodičům.**
- **Rodič** (`ParentDashboard`) vidí jen `score/max_score` (nebo ✓). Komentář ani známku nevidí.
- **Nejvíc kroků dnes zabere:** otevřít úkol → rozbalit žáka → obodovat otevřené odpovědi → uložit → zavřít a znovu pro dalšího žáka. Napříč úkoly a třídami chybí společný seznam „co ještě čeká“, procházení Další/Předchozí i hromadné akce.

## 2. Návrh lepšího hodnocení
- **Stupnice podle úkolu** (`assignments.settings.grading`, bez změny DB): `points` (výchozí, dnešní chování), `percent`, `grade` (1–5 s převodní tabulkou, výchozí 100–85–70–50–30 %, učitelka ji může u úkolu upravit), `verbal` (jen slovní hodnocení). Navíc volby A/N/nehodnoceno/„?“.
- **Uložení výsledku:** do `progress._teacher_grading` přibudou `grade`, `reviewed` (zkontrolováno), `returned` (vráceno) a `undo` (předchozí hodnoty). `score/max_score` zůstávají zdrojem bodů. Známka je **odvozená ze stupnice**; ručně ji lze přepsat jen výslovně.
- **Rychlé šablony komentářů:** ukládají se v prohlížeči učitelky, s několika výchozími (např. „Výborně“, „Doplň zdůvodnění“).
- **Co uvidí žák:** známku nebo procenta podle stupnice, komentář a stav „vráceno k přepracování“ s možností nového pokusu. Ten využívá stávající mechanismus pokusů.
- **Rodič:** v etapách 1–3 beze změny (body). Zobrazit známku je volitelná pozdější etapa.
- **Přehled podle předmětu:** sloupec se známkou nebo procenty u úkolů a průměr se dají spočítat ve frontendu z načtených pokusů, bez DB.
- **Kdy by byla potřeba DB:** pokud má rodič vidět známku nebo komentář, nebo pokud „vráceno“ má znovu otevřít úkol žákovi (dnes ho mění jen žák, mimo `status`). Pak jen **návrh SQL k ukázání**. Nic se nespouští.

## 3. Hromadná kontrola – obrazovka „Ke kontrole“
- Nová stránka učitele, např. `/ucitel/ke-kontrole`. Ukazuje odevzdané a dosud nezkontrolované pokusy jen z úkolů učitelky (stávající oprávnění k řádkům, beze změny). Jen úkoly, ne materiály ani oznámení (`submittableOnly`).
- **Filtry:** úkol, třída/skupina, stav (ke kontrole / zkontrolováno / vráceno), „jen s otevřenými odpověďmi“. Hledání podle žáka přes `picker-search`.
- **Procházení po jednom:** Další/Předchozí, klávesy J/K nebo šipky, 1–9 pro rychlé body u vybrané položky, Enter = uložit a další. Odpovědi se zobrazují jen v tomto oprávněném detailu, ne v seznamech ani v chatu.
- **Hromadné akce nad zaškrtnutými řádky:**
  1. Označit jako zkontrolované.
  2. Potvrdit automatické body (bez přebodování).
  3. Stejný komentář vybraným žákům.
  4. Vrátit k přepracování (až v etapě s DB).
- Každá hromadná akce má **potvrzovací okno** s počtem žáků. Upozornění se při ní **ve výchozím stavu neposílají**: zaškrtávátko „Upozornit žáky“ je výchozí vypnuté. Po akci se nabídne **„Vrátit zpět“**, které obnoví předchozí hodnoty uložené v `undo`.
- **Riziko rodičovských upozornění:** hromadné akce **nesmí měnit `score` ani `status`**, aby se nespustily rodičovské triggery. Akce 1–3 mění jen `progress` a `teacher_feedback_*`. „Potvrdit automatické body“ tedy jen označí řádek jako zkontrolovaný.
- **Mobil 390 px:** seznam jako karty, detail na celou obrazovku, tlačítka ≥44 px, bez vodorovného posunu.

## 4. Etapy (od nejmenší, doporučené pořadí)
1. **„Ke kontrole“ + procházení po jednom** (frontend, bez DB). Seznam napříč úkoly, Další/Předchozí, klávesy, stávající ukládání bodů a komentářů. Největší úspora kroků.
2. **Hromadné akce bez bodů** (frontend): zkontrolováno, společný komentář, šablony komentářů, potvrzení a „Vrátit zpět“. Bez hromadných upozornění.
3. **Stupnice úkolu a známky** (frontend, `settings.grading`): převodní tabulka, zobrazení žákovi a přehled podle předmětu.
4. **Vrácení k přepracování a známka rodiči:** jen návrh SQL k ukázání a samostatné schválení.

**E-maily a upozornění:** nikdy hromadně bez výslovného zaškrtnutí. E-mailové funkce se nemění.

**Testy:** převod body→známka (hranice tabulky, vlastní tabulka); výběr „ke kontrole“ (jen odevzdané úkoly, bez materiálů a oznámení); hromadná akce nemění `score/status`; undo obnoví předchozí hodnoty; výchozí stav bez upozornění; pořadí Další/Předchozí. Kontrola v prohlížeči na 390 a 1440 px.

**Rizika:**
- Rodičovské triggery při změně bodů (řešeno tím, že hromadné akce body nemění).
- Souběžná úprava týmž učitelem (čtení `progress` těsně před zápisem jako dnes).
- Skupinové odevzdání: hodnotí se pokus skupiny, akce se nesmí propsat dvakrát.
- Staré úkoly bez `settings.grading` zůstanou na bodech.

## Otevřené otázky pro uživatelku
1. Výchozí převodní tabulka 1–5. Vyhovuje 85/70/50/30 %?
2. Má žák vidět známku hned, nebo až po označení „zkontrolováno“?
3. Má rodič vidět známku nebo komentář? Znamená to etapu 4 se změnou DB.
4. Má „Vrátit k přepracování“ žákovi úkol znovu otevřít, nebo jen zobrazit poznámku?
5. Začít etapou 1, nebo rovnou 1 + 2?
