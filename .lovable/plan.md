# Oprava ukazatele postupu lekce

## Rozsah
- V `AssignmentDetailDialog` rozšířit stav postupu o dvě hodnoty: celkové procento ze všech povinných aktivit a průměr pouze dokončených aktivit.
- Celkové procento počítat tak, že nehotové povinné aktivity mají 0 %; případné opakované výsledky jedné aktivity započítat jen jednou podle aktuálně načteného výsledku.
- Štítek změnit na `Lekce X/Y hotovo · Z %` a barvit šedě při 0, žlutě při částečném a zeleně pouze při úplném dokončení.
- V rozbaleném řádku samostatně zobrazit `průměr hotových aktivit: X %`.
- Neměnit data, ukládání, žákovskou část ani jiné funkce.

## Ověření
- Doplnit cílené testy výpočtu a stavů 0/částečně/vše hotovo.
- Spustit relevantní testy a ověřit výsledek sestavení z náhledu.
- V aplikaci ověřit Horňakovou Viktorii, Slabotínského Jana a Urbanovou Natálii, pokud je dostupná učitelská relace.

## Rollback
- Vrátit pouze změny v `AssignmentDetailDialog.tsx` a případném cíleném testu; databáze se nemění.
