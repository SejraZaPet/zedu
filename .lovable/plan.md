# Diagnostika: žák nevidí Úkol / Materiál / Oznámení (5. 11. 2026)

## Souhrn pro učitelku
Rozdělení v aplikaci **je**, ale ukazuje se jen tehdy, když nějaký materiál nebo oznámení existuje. V databázi zatím **není ani jeden**: všech 67 položek je běžný úkol (60 zveřejněných, 7 naplánovaných). Prázdné skupiny se schovávají, takže žák vidí jen „Úkoly“. Řešení: vytvořit první materiál/oznámení přes „Nový úkol“ → přepínač Úkol / Materiál / Oznámení. Navrhuji také malé vylepšení, aby bylo rozdělení vidět hned.

## 1) Kde to žák vidí
- `StudentSubjectClass.tsx` (záložka předmětu): **používá** `AssignmentStatusGroups` + `ASSIGNMENT_GROUPS` (ř. 859), takže skupiny „Oznámení“ a „Materiály“ umí. Název záložky je ale napevno „Úkoly (N)“ a počítá všechno dohromady (ř. 668–671).
- `StudentAssignments.tsx` (Moje úlohy): skupiny; oznámení jsou záměrně vyfiltrovaná (ř. 111), materiály zůstávají.
- `AssignmentStatusGroups.tsx` ř. 52: `if (!rows.length) return null` – prázdné skupiny se nevykreslí. To je důvod, proč dnes nic nevidí.
- Mapování druhu je v `assignment-status.ts` ř. 79–81 (`settings.kind`).

## 2) Data a tvorba u učitele
- DB (jen SELECT): `kind` chybí u všech 67 řádků (= úkol). `material` 0, `announcement` 0.
- Tvorba: `TeacherAssignments.tsx` (`/ucitel/ulohy`), přepínač druhu ř. 1067 (tlačítka min. 44 px, i na mobilu).
- Z `TeacherSubjectClass.tsx` vede tlačítko „Nový úkol“ (ř. 1700) na `/ucitel/ulohy?classId|groupId…` – dosažitelné, ale název nenapovídá, že jde vytvořit i materiál/oznámení.

## 3) Jak se žákovi zobrazí
- Čtení přes stávající RLS `assignments` (členství třída/skupina), klient filtruje `status='published'` (`StudentSubjectClass.tsx` ř. 237); draft/scheduled se nezobrazují, stejně jako u úkolů.
- Oznámení podléhá `visibleUntil` (platnost); materiál/oznámení nemají pokusy (fáze 2 serverové triggery).

## 4) Návrh minimální opravy (bez DB, čeká na schválení)
1. Záložka předmětu u žáka: „Úkoly (N)“ → počítat jen úkoly; uvnitř nahoře malý souhrn „Úkoly X · Materiály Y · Oznámení Z“. Při 0 materiálech/oznámeních skupiny dál skryté (žádné prázdné nadpisy).
2. Učitel: tlačítko „Nový úkol“ → „Přidat“ s menu Úkol / Materiál / Oznámení, předvyplní `kind` parametrem `?kind=` v `TeacherAssignments` (stejné na stránce Úkoly).
3. Testy: vitest pro počty podle druhu a pro předvyplnění druhu z URL; kontrola 390 px.
4. Rollback: vrácení dvou souborů stránek + `TeacherAssignments.tsx`; data beze změny.

Soubory: `StudentSubjectClass.tsx`, `TeacherSubjectClass.tsx`, `TeacherAssignments.tsx`, nový test. Bez DB, bez deploy do „nasadit“.
