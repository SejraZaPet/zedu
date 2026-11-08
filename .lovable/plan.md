# Sladění formuláře „Nová úloha“ s druhem položky (jen návrh)

Stav: diagnostika z kódu. Nic se neimplementuje, DB beze změny, bez e-mailů a deploye. Dlaždice přehledu učitele jsou už hotové (viz předchozí etapa).

## 1. Pole formuláře × druh

Zdroj: `src/pages/TeacherAssignments.tsx` (formulář ~ř. 1124–1800, ukládání `submitAssignment` ~ř. 477–700), `src/lib/assignment-kind.ts`.

| Pole / sekce | Úkol dnes | Materiál dnes | Oznámení dnes | Materiál cíl | Oznámení cíl |
|---|---|---|---|---|---|
| Volba druhu (Úkol/Materiál/Oznámení) + vysvětlení | ano | ano | ano | ano | ano |
| Název, Popis | ano | ano | ano (limit 500 znaků) | ano | ano |
| Tahák povolen | ano | skryto | skryto | skryto | skryto |
| Poslat e-mail / Povolit komentáře | ano | ano | ano | ano | ano |
| Upozornění „neodevzdáno“ (notifyOverdue) | ano | skryto | skryto | skryto | skryto |
| Připnout, Zobrazovat do | skryto | skryto | ano | skryto | ano |
| Termín odevzdání, Počet pokusů, Po termínu | ano | skryto | skryto | skryto | skryto |
| Naplánovat zveřejnění | ano | ano | ano | ano | ano |
| Předmět | ano | ano | ano | ano | ano |
| Třída/skupina, vybraní žáci | ano | ano | ano | ano | ano |
| **Typ** (úkol/test/písemka…) | ano | **zobrazeno – chyba** | **zobrazeno – chyba** | skrýt | skrýt |
| **Typ zadání** (individuálně/dvojice/skupiny, rozdělení) | ano | **zobrazeno – chyba** | **zobrazeno – chyba** | skrýt | skrýt |
| **Zamíchat pořadí otázek / volby** | ano | **zobrazeno – chyba** | **zobrazeno – chyba** | skrýt | skrýt |
| **Portfoliový úkol** | ano | **zobrazeno – chyba** | **zobrazeno – chyba** | skrýt | skrýt |
| **Zamčený režim** | ano | **zobrazeno – chyba** | **zobrazeno – chyba** | skrýt | skrýt |
| Pracovní list (příloha) | ano | ano | ano | ano (jen k otevření) | skrýt (návrh) |
| Propojit s lekcí, materiály, odkazy, soubory | ano | ano | ano | ano | volitelně (návrh: jen odkaz/soubor) |
| Termín u jednotlivého cíle (multi-cíl) | ano | ignorován při uložení | ignorován | skrýt | skrýt |

Co se dnes ukládá u materiálu/oznámení do `assignments`:
- Správně neutrální: `deadline = null`, `max_attempts = 1`, `settings.kind`, `lateUntil`/`notifyOverdue`/`cheatSheetAllowed` odstraněny (`mergeKindSettings`).
- **Ukládá se, co učitel naklikal (i když nemá smysl):** `exam_type`, `group_mode` + `group_size`, `randomize_order`, `randomize_choices`, `is_portfolio_task`, `lockdown_mode`.
- Riziko: materiál s `group_mode ≠ individual` drží formulář otevřený „pro rozdělení skupin“; `exam_type` se může propsat do kalendáře/„Co mě čeká“ (zobrazují `exam_type`); `is_portfolio_task` do portfolia.
- Návrh: při uložení ne-úkolu vždy zapsat neutrální hodnoty: `exam_type=null, group_mode='individual', group_size=null, randomize_*=false, is_portfolio_task=false, lockdown_mode=false, max_attempts=1, deadline=null`. Čistě frontend.

## 2. Sjednocení – jedna konfigurace

V `assignment-kind.ts` přidat deklarativní `KIND_FIELDS: Record<AssignmentKind, Set<Field>>` (např. `deadline, attempts, late, examType, groupMode, randomize, portfolio, lockdown, cheatsheet, notifyOverdue, pinned, visibleUntil, worksheet, …`) a helpery `kindHas(kind, field)` a `neutralizeForKind(kind, row)`.

Použití:
- Formulář: každá sekce `{kindHas(formKind, "…") && …}`; uložení přes `neutralizeForKind`.
- Seznamy/karty učitele (TeacherAssignments ~ř. 1970: termín, „N pokusů“, zámek) – zobrazit jen pokud `kindHas`.
- Detail žáka/učitele, Zeď, kalendář, „Co mě čeká“ – už filtrují `assignmentKind`; doplnit jen chybějící místa (bod 4).
- Výsledky/Přehled: materiál a oznámení vyfiltrovat (`isSubmittable`).
- Přepnutí druhu: hodnoty skrytých polí zůstanou v paměti formuláře (návrat na Úkol je obnoví), ale **neukládají se** – při uložení se přepíší neutrálními. Při přepnutí z úkolu s vyplněným termínem/pokusy ukázat nenápadnou poznámku „Termín a hodnocení se u materiálu neuloží“.
- Editace existujícího úkolu → změna na materiál: zobrazit potvrzení, pokud už má odevzdání (pokusy) – návrh: změnu druhu u položky s odevzdáními zakázat.

## 3. Texty
Ano, sladit:
- Nadpis: „Nový úkol / Nový materiál / Nové oznámení“, úprava „Upravit úkol / materiál / oznámení“.
- Tlačítka a toasty: „Úloha publikována“ → „Úkol/Materiál/Oznámení zveřejněn(o)“.
- Prázdné stavy a počty („Vytvořeno úloh: N“) podle druhu.
- Nadpis stránky „Úlohy pro žáky“ ponechat (zastřešuje vše), případně podtitul „Úkoly, materiály a oznámení“. Rozhodnutí na vás.

## 4. Kde jinde se ukazuje odevzdání/termín/typ

| Místo | Stav | Chyba? |
|---|---|---|
| Karty v TeacherAssignments (termín, pokusy, zámek, typ) | bez kontroly druhu – „1 pokus“, zámek, exam_type i u materiálu | ano |
| Učitelská třída (TeacherSubjectClass), žákovská (StudentSubjectClass) | dělí podle druhu | ne |
| Žákovský seznam / přehrávač | `isSubmittable`, text „nic neodevzdáváš“ | ne |
| Zeď | štítek podle druhu | ne |
| Kalendář termínů, TodayWidget, Nadcházející písemky | jen úkoly | ne (ověřit `exam_type` u materiálu v TodayWidget) |
| TeacherResults (výsledky) | nefiltruje druh – materiál se může objevit ve výběru zadání a „neodevzdali“ | pravděpodobně ano, ověřit |
| TeacherClassDetail, ParentDashboard | bez kontroly druhu | pravděpodobně ano (počty/chybí odevzdat), ověřit |
| Dlaždice „Úlohy pro žáky“ (počet) | jen úkoly | ne |
| E-mail při zveřejnění (notify-email) | respektuje druh/volbu | ne |
| Připomínky (auto-reminders-job, notify_deadline_soon) | bez kontroly druhu, ale materiál nemá termín → nepošle se | nejspíš ne; u starých materiálů s termínem ano – ověřit čtecím dotazem |
| notify-parent „nový úkol“ | bez kontroly druhu | ověřit text e-mailu rodiči |

## 5. Rizika, DB, testy, etapy

- Starší záznamy bez `settings.kind` = úkol (beze změny chování).
- Starší materiály mohou mít uložené `exam_type`, `group_mode`, `randomize_*`, `lockdown`: frontend je bude u ne-úkolů ignorovat; data se nemění.
- DB: **není nutná.** Volitelně (jen návrh, nespouštět): jednorázové vyčištění starých materiálů/oznámení
  `UPDATE assignments SET exam_type=null, group_mode='individual', group_size=null, randomize_order=false, randomize_choices=false, is_portfolio_task=false, lockdown_mode=false, deadline=null WHERE settings->>'kind' IN ('material','announcement');`
  Rollback: předem uložit dotčené řádky (`CREATE TABLE … AS SELECT id, exam_type, … `) a vrátit UPDATE … FROM zálohy. Nejdřív čtecí počet dotčených řádků.
- Testy: `KIND_FIELDS` (materiál nemá deadline/attempts/examType…), `neutralizeForKind` (konkrétní neutrální hodnoty), přepnutí druhu nezapíše skryté hodnoty, filtr výsledků bez materiálů, starý záznam bez kind = úkol.

Etapy:
1. `KIND_FIELDS` + formulář + neutrální uložení + texty (frontend).
2. Karty v TeacherAssignments, TeacherResults, TeacherClassDetail, ParentDashboard – filtr/skrytí (frontend, po čtecím ověření).
3. Edge funkce (notify-parent, reminders) – jen pokud ověření ukáže chybu; vyžaduje deploy na pokyn.
4. Volitelné vyčištění DB – jen po schválení.

Soubory: `src/lib/assignment-kind.ts`, `src/pages/TeacherAssignments.tsx`, `src/pages/TeacherResults.tsx`, `src/pages/TeacherClassDetail.tsx`, `src/pages/ParentDashboard.tsx`, případně `supabase/functions/notify-parent`, testy v `src/test/assignment-kinds-and-late.test.ts`.

## Na čem se rozhodnout
1. Pracovní list a lekce u Oznámení – skrýt, nebo povolit?
2. Měnit druh u položky, která už má odevzdání – zakázat, nebo jen varovat?
3. Nadpis stránky „Úlohy pro žáky“ ponechat?
4. Schvalujete etapu 1 (a 2)? DB vyčištění ano/ne?
