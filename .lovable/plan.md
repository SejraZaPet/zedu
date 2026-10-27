# Část I – Portfolio: proč nejde otevřít obsah (diagnostika, nic nezměněno)

## Pro učitelku (srozumitelně)

**Jak portfolio funguje.** Portfolio žáka je časová osa (nebo „kniha“) položek. Položky vznikají:
- automaticky po odevzdání úkolu nebo pracovního listu – uloží se název, předmět a **body** (např. 7 / 10),
- odevzdáním „portfoliového úkolu“ – uloží se přiložené soubory,
- tlačítkem „Uložit do portfolia“ u stránky sešitu – uloží se obrázek stránky,
- ručně žákem (soubor, video, reflexe), plus odznaky a publikované knihy.

Vidí je žák (své), jeho učitel (třída nebo skupina, kterou učí), rodič a administrátor. Učitel může psát komentáře.

**Proč obsah nejde otevřít.**
1. **Pracovní listy a úkoly (většina položek, 217 z 353) nemají žádné tlačítko „Otevřít“.** Karta ukazuje jen název a body. Odpovědi žáka v portfoliu uložené nejsou – jen odkaz na pokus. Aplikace tento odkaz nikde nenabízí, ani u 4 položek, které odkaz na list mají. Není to tedy smazaný obsah ani zákaz přístupu – chybí tlačítko.
2. **„Prohlížíš jako Žák“ ukazuje vaše vlastní portfolio, ne portfolio žáka.** Režim jen mění vzhled aplikace. Stránka „Moje portfolio“ načítá položky přihlášené osoby, takže uvidíte prázdné nebo vlastní portfolio. Portfolio konkrétního žáka se otevírá přes třídu (stránka „Portfolio: jméno žáka“).
3. **Soubory u portfoliových úkolů** se otevřou jen učiteli, který úkol zadal (nebo spoluvyučujícímu té třídy). Jinému učiteli žáka se odkaz „Otevřít“ tiše nezobrazí. 4 soubory v úložišti fyzicky chybí.
4. Stránky ze sešitu a ručně nahrané soubory (18 položek) mají obrázek/soubor a otevřít se dají.

**Co navrhuji (bez změny databáze):** u každé položky z úkolu/pracovního listu přidat tlačítko „Zobrazit odevzdání“. Otevře okno s odpověďmi a přílohami žáka – stejné okno, které už teď používáte ve výsledcích úkolu. U listu s odkazem přidat „Otevřít list“. U chybějícího nebo nepřístupného souboru napsat „Soubor není dostupný“ místo tichého zmizení. V režimu „Prohlížíš jako Žák“ zobrazit upozornění, že jde o vaše vlastní portfolio.

## Technické detaily

**Soubory**
- `src/pages/StudentPortfolio.tsx:28-31` – `loadFullPortfolio(user.id)`; view-as (`AuthContext.tsx:224`, jen global admin) mění jen `effectiveRole`, ne uživatele.
- `src/pages/PortfolioView.tsx` (`/portfolio/:studentId`) – učitel/rodič, `PortfolioTimeline canComment`.
- `src/lib/portfolio.ts:75-160` – `loadFullPortfolio`: `student_portfolio_items` + `student_portfolio_files` + syntetické položky z `assignment_attempts` (submitted, se skóre, bez propojené položky) a `student_badges`; `saveWorksheetToPortfolio` (ř. 166) ukládá `content_json.href`.
- `src/components/portfolio/PortfolioTimeline.tsx:295-338` – kromě skóre vykresluje jen `attachment_url` („Otevřít přílohu“), `video_url` a `files` (odkaz jen když signed URL vznikne, ř. 326). `content_json.href` / `attempt_id` / `source_assignment_id` se nepoužívají – **příčina č. 1**.
- `PortfolioBookView.tsx:87,144` – navíc jen „Ze sešitu“ (`notebook_id`, vede do `/student/sesit` – pro učitele nevhodné).
- `AttemptQuickPreviewDialog.tsx` (props `assignmentId`, `studentId`) – použit jen v `AssignmentResultsDashboard.tsx:576`.
- Zdroje: trigger `trg_sync_portfolio_from_attempt` (assignment_attempts), `submit_portfolio_assignment`, `trg_student_book_portfolio_on_publish`, `src/lib/notebook.ts:624-648`.

**Data (read-only, bez osobních údajů)**

| source_type / type | počet | příloha | soubory | href/worksheet_id | source_assignment_id |
|---|---|---|---|---|---|
| worksheet / worksheet_result | 217 | 0 | 0 | 4 | 81 |
| portfolio_task / project | 118 | 0 | 90 | 0 | 112 |
| manual / project (sešit) | 17 | 17 | 13 | 0 | 0 |
| manual / upload | 1 | 1 | 0 | 0 | 0 |

Klíče `content_json` u worksheet: `attempt_id, score, max_score, submitted_at, worksheet_id, href`. Smazané zdroje: 0 úkolů, 0 listů, 0 příloh; 4 záznamy `student_portfolio_files` bez objektu v úložišti.

**RLS** – `student_portfolio_items`/`_files`: vlastník ALL, admin/`is_teacher_of_student`/`is_parent_of_student` SELECT, RESTRICTIVE `demo_iso`. Storage `student-portfolio`: vlastník/teacher/parent/admin. `assignment-uploads` a `student-attachments`: učitel jen přes `assignments.teacher_id` nebo `class_teachers` třídy úkolu (příčina č. 3). `assignment_attempts` – stávající učitelské politiky (dialog ve výsledcích úkolu je používá).

**Návrh opravy (jen klient, bez DB)**
1. `PortfolioTimeline` + `PortfolioBookView`: pro položky s `source_assignment_id` nebo syntetické `attempt-…` (assignment_id doplnit do `content_json` v `loadFullPortfolio`) vykreslit `AttemptQuickPreviewDialog` (assignmentId, studentId = `item.student_id`). Pro `content_json.href` → `Link` „Otevřít list“ (jen pro žáka; učitel `/ucitel/...` ekvivalent ověřit).
2. Soubory: když signed URL selže, text „Soubor není dostupný“.
3. `StudentPortfolio`: při view-as banner „Toto je vaše vlastní portfolio. Portfolio žáka otevřete ze třídy.“
4. Test: karta worksheet položky s attempt → tlačítko „Zobrazit odevzdání“; bez zdroje → žádné tlačítko; soubor bez URL → hláška.

**Rizika:** položky s `source_assignment_id`, ale bez pokusu (není odevzdáno) – dialog musí ukázat prázdný stav; 136 worksheet položek nemá assignment ani worksheet odkaz → zůstanou jen se skóre, pokud nejde dohledat pokus přes `attempt_id`. Učitel bez přístupu k úkolu uvidí v dialogu prázdné odpovědi (RLS) – zobrazit vysvětlení, nikoli chybu.

**DB změna (jen pokud se schválí širší přístup k souborům, nespouštět):** rozšířit SELECT na `assignment-uploads`/`student-attachments` o `is_teacher_of_student(((storage.foldername(name))[2])::uuid, auth.uid())`. Přesné SQL + rollback připravím až na pokyn – nyní nedoporučuji, mění oprávnění.

**Neověřeno:** skutečné kliknutí v aplikaci na účtu učitelky; obsah `content_json` 136 položek bez odkazu (ověřit, zda mají `attempt_id`).

**Otázka pro učitelku:** Má jiný učitel žáka (ne zadavatel úkolu) vidět soubory z jeho portfoliových úkolů? (Vyžadovalo by změnu oprávnění v databázi.)
