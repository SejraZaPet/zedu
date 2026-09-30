# Jednoduché formátování popisu úkolu

## Rozsah
- Nahradit pole „Popis (volitelný)“ ve formuláři nové i upravované úlohy kompaktním editorem se stejnou Tiptap knihovnou, kterou už aplikace používá.
- Lištu omezit přesně na tučné písmo, kurzívu, podtržení a několik předvolených barev textu.
- Výsledné HTML ukládat beze změny datového modelu do `assignments.description`.
- Formátovaný popis bezpečně zobrazit na žákovském detailu a v dalších stávajících náhledech popisu tak, aby se HTML tagy nikde neukazovaly jako text.

## Zpětná kompatibilita a bezpečnost
- Prostý text ze starších úkolů převést pouze při vykreslení na odstavce a zachovat zalomení řádků.
- HTML před zobrazením filtrovat; povolit jen značky a styl barvy potřebné pro tento editor.
- Pro hlasové čtení a textový kontext převést HTML na čistý text, aby se značky nepředčítaly ani neposílaly jako součást zadání.

## Technické provedení
- Přidat malý samostatný editor popisu postavený na stávajících Tiptap rozšířeních `StarterKit`, `Underline`, `TextStyle` a `Color`.
- Přidat sdílený bezpečný renderer a převod popisu na čistý text.
- Zapojit editor do `TeacherAssignments.tsx`; zapojit renderer do `StudentAssignmentPlayer.tsx`, `StudentAssignments.tsx` a stávajících učitelských náhledů popisu.
- Doplnit cílené testy pro starý prostý text, povolené formátování a odstranění nepovoleného HTML.

## Ověření
- Ověřit vytvoření i úpravu úkolu, načtení uloženého HTML a zobrazení žákovi.
- Spustit relevantní testy a zkontrolovat sestavení aplikace.

## Rizika
- Tiptap převádí starý prostý text při první úpravě na HTML odstavce; vizuální obsah zůstane stejný.
- Barva se ukládá ve `style` atributu, proto renderer povolí jen bezpečně filtrovaný styl barvy, nikoli libovolné HTML.
