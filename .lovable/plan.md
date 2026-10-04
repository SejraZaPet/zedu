# Diagnóza: učitelka nevidí odpovědi žáků u úkolu „Distanční výuka – Výživa – opakování"

Jen diagnóza, nic se neměnilo.

## 1. Kde učitel vidí a hodnotí odevzdání
- Stránka Úkoly (učitel) → detail úkolu (`AssignmentDetailDialog`) a záložka Výsledky (`AssignmentResultsDashboard`).
- U úkolu zadaného skupině se nejdřív načtou členové skupiny a potom všechny pokusy k úkolu. Kdo pokus má, objeví se v seznamu i tehdy, když ve skupině není.

## 2. Co je v databázi
- Úkol: zadaný skupině **H1.A HT** (14 žáků), ne třídě. Termín je **5. 10. 2026 ve 23:59** (pražského času). Stav: zveřejněno.
- K úkolu existuje **jen 1 pokus** a ten patří **samotné učitelce (Kristýna Herinková, účet učitelky)**, ne žákovi:
  - stav **odevzdáno** (4. 10. v 01:16 pražského času), skóre 0/9,
  - odpovědi vyplněné testovacím textem (např. „BŮHBNJLKM").
- **Od žádného ze 14 žáků skupiny zatím není ani otevřený, ani odevzdaný pokus.**

## 3. Příčina
- Nejde o chybu zobrazení ani o pokusy, které by zůstaly neodevzdané („in_progress"). Žáci úkol zatím vůbec neotevřeli, takže v databázi nejsou žádné jejich odpovědi.
- „Žák", který list předtím zkoušel vyplnit, byl ve skutečnosti účet učitelky (pravděpodobně přes režim náhledu za žáka).

## 4. Co teď Tyna uvidí
- Seznam 14 žáků skupiny H1.A HT, u všech stav „nezahájeno" a bez odpovědí.
- Navíc svůj vlastní testovací pokus s 0/9. Ten se zobrazí jako další „žák", protože se pokusy přidávají do seznamu i mimo členy skupiny.
- Hodnotit zatím není co, protože žáci ještě nic neodevzdali.

## Doporučený další krok (bez úprav kódu)
- Ověřit se žáky, že úkol vidí. Termín platí ještě do 5. 10. 23:59.
- Pokud chce učitelka, smažu její testovací pokus, aby nemátl výsledky. Smazání by šlo do databáze a provedu ho až po jejím souhlasu.
