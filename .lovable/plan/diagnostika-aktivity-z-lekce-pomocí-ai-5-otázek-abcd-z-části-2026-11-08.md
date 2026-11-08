# Diagnostika: Aktivity z lekce pomocí AI („5 otázek ABCD z části lekce")

Jen diagnostika a návrh. Kód, databáze ani funkce na serveru se zatím nemění.

## Odpověď pro Tynu
Nejde o technické omezení. AI už umí tvořit otázky z textu lekce i z jedné její části, ale tato možnost je jen na některých místech. Hlavně chybí jednotné okno „Vytvořit z lekce“. U živého kvízu („Rychlá hra“) se dnes zadává jen téma, ne lekce.

## 1. Co dnes existuje (ověřeno čtením kódu)

| Místo | Zdroj textu | Typy | Počet | Serverová funkce |
|---|---|---|---|---|
| Editor lekce – blok aktivity (`ActivityBlock`) | text bloku nebo lekce | kvíz, kartičky a další tvary | kvíz s nastavitelným počtem, 2–5 možností | `generate-activity-content` (text ≤ 6000 znaků) |
| Editor lekce – „aktivita z textu“ (`BlockEditor`) | vybraný text | podle volby | pevný | `generate-activity-from-text` (≤ 4000 znaků) |
| Průvodce aktivitami (`ActivityWizardDialog`) | **celé lekce** z učebnice, vložený text nebo nahraný soubor | typy z katalogu aktivit | dle nastavení | `generate-activity-content`; má štítek AI |
| Rychlá hra / živý kvíz (`QuickGameDialog`, `AddSlideSheet`) | **jen téma** (případně text u snímku) | ABCD, pravda/nepravda, dvojice | 3–12 | `generate-lesson-quiz` |
| Pracovní list – panel sekcí lekce (`LessonSectionsPanel`) | **vybraná sekce lekce** | ABCD, P/N, doplňování, přiřazování, řazení | 1–8 na sekci | `generate-section-activity` (≤ 6000 znaků) |
| Pracovní list – celý list, úprava bloku | lekce nebo téma, jeden blok | celý list, úprava bloku | ≤ 8 položek při úpravě | `generate-full-worksheet`, `worksheet-block-refine` |
| Z materiálu (`FromMaterialView`) | nahraný materiál | několik výstupů | ≤ 3 | `generate-content-from-material` |
| Žák – „Učím se“ (`StudentPractice`) | lekce (vyhledání v jejím textu) | procvičovací otázky | dle počtu | `ai-practice-rag`, `generate-practice` |

Všechny tyto funkce hlídají limit pro demo účty (`demoAiGuard`) a vyžadují přihlášení. Běžní uživatelé limit nemají.

## 2. Kde chybí to, co Tyna popisuje
- **(a) Výběr části lekce:** funguje jen v pracovním listu (po sekcích). Průvodce aktivitami pracuje jen s celými lekcemi a Rychlá hra jen s tématem. U úkolu ani materiálu výběr není. Nelze označit konkrétní úsek nebo blok.
- **(b) Typ a počet:** ve většině míst existuje, ale každé má jiné rozsahy (8, 12, 10). Obtížnost chybí skoro všude.
- **(c) Návrh, který učitelka upraví a schválí:** výsledek se většinou vloží rovnou do editoru jako koncept. Výslovný krok „Zkontrolovat a schválit“ chybí. Štítek AI je jen v některých místech.
- **(d) Napojení na lekci:** aktivita si neukládá, ze které lekce a části vznikla. Nemá tedy odkaz zpět ani upozornění, že se lekce změnila.

Závěr: jde o **nedodělanou funkci**, ne o technické omezení. Potřebné funkce na serveru už existují.

## 3. Návrh: jednotné okno „Vytvořit z lekce“
Postup: lekce → část (kapitola / sekce / bloky / vlastní označený úsek) → typ (kvíz ABCD, pravda/nepravda, doplňování, přiřazování, kartičky, otevřené otázky) → počet → obtížnost → **Navrhnout** → náhled s úpravami → **Vložit**.
- Okno bude stejné v Aktivitách, Rychlé hře, editoru pracovního listu a v úkolu/materiálu, který vloží hotovou aktivitu nebo list.
- Využije stávající funkce: `generate-section-activity` (list, krátké typy), `generate-activity-content` (aktivity, kartičky) a `generate-lesson-quiz` (živá hra). Funkce na serveru se v etapách 1–3 nemění. Text se vezme ze sdíleného čištění textu lekce a omezí se podle limitu funkce.
- Zdroj se uloží do dat aktivity bez změny databáze: `source: { lessonId, lessonSource, sectionIds, textHash, createdAt }`. Podle `textHash` se později pozná, že se lekce změnila (upozornění „Lekce se od vytvoření změnila“).
- Pravidla:
  - AI jen navrhuje. Návrh zůstává koncept, dokud ho učitelka neuloží nebo nezveřejní, takže žák nikdy neuvidí nezkontrolovaný text.
  - Vždy se zobrazí štítek „vytvořeno s pomocí AI“ (`ai_generated`).
  - Do AI jde jen text lekce a parametry, nikdy jména ani odpovědi žáků.
  - Platí stávající demo limity. Při chybě se zobrazí srozumitelná hláška, zadání zůstane vyplněné a nic se neuloží.
  - Vždy zůstane ruční alternativa.

## 4. Etapy (od nejmenší)
1. **Rychlá hra z lekce:** do `QuickGameDialog` přidat výběr lekce a sekce, text sekce poslat jako `text` do `generate-lesson-quiz` (funkce `text` už přijímá). Přidat náhled, štítek AI a uložení zdroje.
2. **Sdílené okno „Vytvořit z lekce“** (výběr části, typ, počet 1–12 podle limitů funkcí, obtížnost jako slovo v zadání) v Aktivitách a v pracovním listu, náhrada za dnešní panel sekcí.
3. **Odkaz zpět a upozornění na změnu lekce** podle `source.textHash`. Žádné automatické přepisování.
4. (Až po zvláštním schválení) úpravy serverových funkcí: otevřené otázky, obtížnost, sjednocené limity.

Testy:
- výběr části skládá správný text a respektuje limit,
- žádná data žáků v požadavku,
- uložený zdroj a detekce změny lekce,
- chyba neuloží nic,
- štítek AI,
- koncept není vidět žákům,
- 390 px bez posunu a cíle ≥ 44 px.

Rizika:
- **Správnost:** AI může chybovat, proto povinná kontrola.
- **Autorská práva:** text učebnic jde ke zpracování do AI. U převzatých učebnic je potřeba ověřit licenci, nebo povolit jen vlastní lekce.
- **Nezletilí:** žádná data žáků v AI a obsah jen po kontrole učitele.
- **Náklady:** každý návrh je jedno volání AI. U běžných uživatelů není limit.
- **Rozbití dnešních cest:** staré aktivity bez `source` fungují beze změny.

## Otevřené otázky
1. Začít etapou 1 (Rychlá hra z lekce), nebo rovnou společným oknem (1+2)?
2. Povolit výběr i z převzatých učebnic, nebo jen z vlastních lekcí (kvůli licenci)?
3. Přidat otevřené otázky a obtížnost, i když to vyžaduje úpravu funkcí na serveru (etapa 4)?
