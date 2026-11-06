# Téma hodiny bez plánu hodiny – diagnostika a návrh

Jen diagnostika. Nic se neimplementovalo, databáze se neměnila, nic se nenasadilo.

## Hlavní zjištění
Psát téma bez plánu hodiny **už dnes jde**. Text „Přidat téma hodiny“ je klikací tlačítko a funguje i u karet s nápisem „Bez plánu hodiny“. Uložené téma se ukazuje i žákům. Problém je hlavně v tom, že tlačítko vypadá jako šedá kurzíva a uživatelka ho za tlačítko nepovažuje. K tomu chybí poznámka k obsahu hodiny a tlačítko pro smazání tématu.

## 1) Kde se text vykresluje a odkud se bere
- `src/pages/TeacherSubjectClass.tsx` ř. 1431–1440: `<button>` se šedým malým kurzívním písmem a třídou `truncate`. Nemá rámeček ani ikonu a je nižší než 44 px, takže na dotyk nepůsobí jako tlačítko.
- Po kliknutí se otevře jednořádkové pole (ř. 1403–1429), které se uloží tlačítkem Uložit nebo klávesou Enter. Funkce `saveLessonTopic` (ř. 571–624) při prvním uložení vytvoří záznam a později ho upravuje.
- Úložiště je tabulka `lesson_topics` (sloupce `teacher_id, subject, class_id | group_id, lesson_date, topic, materials`). Neváže se na plán hodiny, `schedule_exceptions` ani `lesson_sessions`. Téma je tedy na plánu hodiny zcela nezávislé.
- Pole pro poznámku nebo obsah hodiny neexistuje. Kromě tématu je tu jen `materials` (přílohy přes ikonu sponky).
- DB, anonymní počty: tabulka má 3 záznamy, z toho 2 s vyplněným tématem (1 třída, 2 skupiny).

## 2) Model „konkrétní hodiny“
- Samostatná tabulka pro jednotlivé hodiny z rozvrhu neexistuje. Termíny hodin se počítají v prohlížeči ze slotů rozvrhu.
- Téma se ke hodině páruje klíčem **učitel + předmět + třída/skupina + datum**. Hlídá to unikátní index `lesson_topics_unique_key`. Čas hodiny v klíči není.
- **Riziko:** mají-li třída a předmět dvě hodiny v jednom dni (dvouhodinovka), obě karty sdílejí jedno téma.
- Pravidla přístupu (RLS):
  - „Teachers manage own lesson topics“ (ALL, `teacher_id = auth.uid()`): učitel čte a mění jen svá témata.
  - „Class members can view lesson topics“ (SELECT): čtou členové třídy (`class_members`) nebo skupiny (`subject_group_members`).
  - Spoluvyučující nevidí témata jiného učitele. Je to stávající chování a nechávám ho beze změny.

## 3) Zobrazení žákům
- `src/pages/StudentSubjectClass.tsx` ř. 433–458 čte `lesson_topics` pro daný předmět a třídu/skupinu. V seznamu „Co jste probrali“ (ř. 710–714) ukáže `topic` pod datem a časem.
- Na plánu hodiny to nezávisí. Téma bez plánu žák **už vidí** jako šedý řádek pod datem.
- Zrušené nebo přesunuté hodiny se v seznamu nezobrazují, protože je vyřadí existující filtr (ř. 417).

## 4) Návrh minimálního řešení

### Etapa A – jen frontend, bez DB (doporučuji začít touto)
1. Místo šedé kurzívy bude jasné tlačítko „+ Přidat téma hodiny“ s ikonou tužky, viditelným fokusem a dotykovou plochou aspoň 44 px. Vyplněné téma se zobrazí jako „Téma: …“ s ikonou Upravit.
2. Inline editor: pole Téma (do 200 znaků) a tlačítka Uložit / Zrušit / **Smazat téma**. Smazání nastaví `topic = null` přes stávající `saveLessonTopic`, takže se materiály neztratí. Esc editor zavře a fokus se vrátí na tlačítko.
3. Text se nebude ořezávat: celé téma se zalomí, na mobilu i u žáka.
4. Chybové hlášky zůstanou jako dnes (toast), editor se při chybě nezavře a text zůstane.

Upravené soubory: `TeacherSubjectClass.tsx` a nová malá komponenta `LessonTopicEditor.tsx`. U žáka v `StudentSubjectClass.tsx` jen zalamování textu. Plány hodin, reflexe, materiály, demo a preview zůstanou beze změny.

### Etapa B – volitelná poznámka k obsahu hodiny (vyžaduje DB, jen po „schvaluji“)
Pole `note` pro 1–3 řádky obsahu, které uvidí i žáci:

```sql
-- migrace (NESPOUŠTĚT bez schválení)
ALTER TABLE public.lesson_topics
  ADD COLUMN IF NOT EXISTS note text
  CHECK (note IS NULL OR char_length(note) <= 500);
```
```sql
-- rollback
ALTER TABLE public.lesson_topics DROP COLUMN IF EXISTS note;
```
- RLS ani GRANT se nemění. Stávající pravidla platí pro celý řádek, takže `note` vidí stejní žáci jako téma. **Proto `note` musí být veřejná, ne soukromá.** Pro soukromé poznámky už slouží reflexe.
- Změna je additivní a nullable, stará verze aplikace sloupec ignoruje.

### Mimo rozsah (jen poznámka)
Rozlišení dvou hodin ve stejném dni by vyžadovalo přidat do klíče čas hodiny, tedy změnu unikátního indexu. Nenavrhuji to teď, protože by to změnilo chování existujících záznamů.

## Rizika
- Dvouhodinovka sdílí jedno téma. Je to stávající stav, beze změny.
- Je potřeba odlišit veřejné téma a poznámku od soukromé reflexe. V editoru bude popisek „Uvidí žáci“.
- Názvy předmětů se párují podle textu `subject`. Stávající stav zůstává, žádná migrace dat.

## Testy (Vitest)
- Karta „Bez plánu hodiny“: klik na „Přidat téma hodiny“ otevře editor a uložení zavolá zápis s daným datem.
- Úprava existujícího tématu, Smazat → `topic: null` a materiály zůstanou.
- Esc / Zrušit nic neuloží.
- Žákovský seznam ukáže téma i bez plánu hodiny a neořízne dlouhý text.
- Kontrola v šířce 390 px bez přihlašování za žáky a bez zápisu do skutečných tříd.

## Zakázáno bez dalšího souhlasu
Migrace (etapa B), změny RLS nebo indexu, historické úpravy dat, deploy a e-maily.
