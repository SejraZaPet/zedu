# Diagnostika: list se nezobrazí v úkolu „Adresy - zkratky opakování“

## Příčina (jistá)
Úkol má v DB `is_portfolio_task = true`. V `StudentAssignmentPlayer.tsx` (ř. 913) je pořadí větví:
materiál → **portfolio (Zadání + nahrání souborů)** → pracovní list (ř. 979) → otázky.
Portfolio větev má přednost, takže list se nevykreslí, i když se načte správně.

Ověřeno čtením (SELECT):
- list: `spec.version = "v1"` (text), stav published → načtení `select("spec")` a podmínka `ws.version` projdou;
- úkol: published, skupina, bez `assignment_recipients`, není materiál, `group_mode individual`;
- RLS `can_student_view_assigned_worksheet` (0082) pustí člena skupiny; učitelku-vlastníka pustí politika „Teachers manage own worksheets“; demo_iso se netýká.
- Není to tedy RLS, migrace 0082, „Prohlížíš jako“ ani tisk PDF (tlačítka tisku jsou až uvnitř větve listu).

Proč to vzniklo (pravděpodobné): ve formuláři úkolu lze současně zapnout „Odevzdání do portfolia“ a přiložit list; formulář kombinaci nebrání. Rozpracovaný pokus `in_progress` vznikl pravděpodobně otevřením úkolu (portfolio i list zakládají pokus).

## „Povinné aktivity lekce: 0 z 3“
Propojená lekce má 3 povinné aktivity. Přehled je jen informační; `ensureLessonGate` blokuje až **odevzdání**, ne zobrazení listu. S chybou nesouvisí.

## Minimální oprava (návrh, čeká na schválení)
1. Data (nejrychlejší, bez kódu): učitelka v úpravě úkolu vypne „Odevzdání do portfolia“ a uloží → list se žákům zobrazí. Nic jiného se nemění. (Případně jednorázový UPDATE jen tohoto sloupce u tohoto úkolu – vyžaduje výslovné „schvaluji“.)
2. Frontend prevence v `TeacherAssignments.tsx`: u úkolu s přiloženým listem zobrazit u přepínače portfolia upozornění „Úkol s pracovním listem se odevzdává vyplněním listu – portfolio skryje list“ a nedovolit uložit obojí (nebo přepínač zakázat, když je vybrán list). Stávající úkoly beze změny.
3. Volitelně v `StudentAssignmentPlayer.tsx`: když má úkol list i portfolio, zobrazit list (přednost listu) – mění chování starých záznamů, proto jen po souhlasu.

## Rizika
- Varianta 3 změní vzhled všech starých úkolů s kombinací portfolio+list (počet lze zjistit SELECTem před schválením).
- Vypnutí portfolia u úkolu s rozpracovaným pokusem: pokus zůstane, odpovědi listu se ukládají do stejného pokusu; přílohy nahrané v portfoliové větvi (zde žádné neověřeno) by se přestaly zobrazovat.

## Testy (po schválení)
- Formulář: list + portfolio nelze uložit / zobrazí varování.
- Přehrávač (pokud varianta 3): list má přednost před portfoliem.
- Typy, build, 390 px.
