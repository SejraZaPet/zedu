# Širší pole umístění lekce a návrh cílení

## Co upravím
- Rozšířím řádek Předmět / Ročník / Téma v editoru umístění tak, aby využíval celou dostupnou šířku a dlouhé názvy nebyly zbytečně ořezané.
- Zachovám přehledné skládání polí pod sebe na menších obrazovkách.
- Ověřím sestavení a kontrolu typů.

## Co pouze popíšu
- Zmapuji současnou tabulku `lesson_placements`, její využití při ukládání i čtení a existující vazby na třídu.
- Navrhnu zpětně kompatibilní rozšíření o volitelnou třídu, skupinu a pololetí. Databázi ani chování cílení v tomto kroku měnit nebudu.

## Technické poznámky
- Současný model už obsahuje volitelné `class_id`, ale nemá `subject_group_id` ani pololetí.
- Výchozí hodnota bez konkrétního cíle zůstane významově „všechny odpovídající třídy“.
