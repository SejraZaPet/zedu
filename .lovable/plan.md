# Plán: Bezlai jako průvodce učením

Jen návrh. Nic se nenasazuje; AGENTS.md, databáze, RLS ani SQL se nemění.

## Zjištěný stav
- Funkce `ask-zedai-tutor` (index.ts, tutor.ts, search.ts, tutor.test.ts), model `AI_MODEL_QUALITY` ze sdíleného `_shared/ai-models.ts`, demo omezení přes `demoAiGuard`.
- Dva režimy:
  - **context** (u úkolu): sokratovské vedení, nikdy přímá odpověď, 2–4 věty, podklady úkolu se načítají na serveru tokenem žáka.
  - **free** (volné otázky): vysvětluje přímo, 3–6 vět, jedna kontrolní otázka. Hledá v materiálech žáka (RLS, až 5 úryvků po 800 znacích) nebo ve vlastním vloženém materiálu.
- Už dnes: pevné věty „V tvých materiálech jsem to nenašla“ a „Obecné vysvětlení (ne z tvých materiálů):“, zákaz vymýšlet zdroje a URL, pevná odpověď na otázky „odkud to víš“, shrnutí do poznámek, úvodní upozornění, že jde o AI.
- UI: `BezlaiTutorChat.tsx` (prostý text, tlačítko shrnutí, přidání materiálu).
- Metody učení: tabulka `study_methods`, stránka `StudentMethods` spouští procvičování na `/student/metody/:slug/procviceni?lesson=…|source=custom&min=…` (generátor `generate-practice`).
- Volání AI jde přes přímý fetch. Odpověď je volný text, bez strukturovaných návrhů.

## 1. System prompt (jen prompt, tutor.ts)
- Krátký blok „Jak učíš“: vyber podle otázky jeden ze tří přístupů a nezmiňuj jejich názvy, pokud se žák neptá:
  - logický: proč, krok za krokem, protipříklad;
  - kreativní: přirovnání, příběh, „co kdyby“, nakresli/vymysli;
  - praktický: příklad ze života, mini pokus, použití hned teď.
- Sokratovské vedení: context beze změny (žádné přímé odpovědi). Free: nejdřív krátce vysvětlit, pak jedna otázka k zamyšlení; u „vyřeš mi úlohu“ nejdřív postup, ne výsledek.
- „Co dál“: na konec odpovědi nejvýš 1 řádek „Chceš pokračovat? …“ se 2–3 krátkými nabídkami (zkusit příklad, jiný pohled, procvičit). Délkové limity zůstávají.
- Neměnit pravidla o zdrojích, disclaimer ani pevné věty (testy na ně spoléhají).

## 2. Když odpověď v materiálu není (prompt + drobně UI)
- Zachovat pevnou větu „V tvých materiálech jsem to nenašla“ a oddělené „Obecné vysvětlení (ne z tvých materiálů):“.
- Nově přidat sekci „Jak pátrat dál“: otázky k zamyšlení, co hledat v učebnici/rejstříku, koho se zeptat (učitel, knihovna), klíčová slova k vyhledání. Nikdy konkrétní knihu, web nebo URL (stávající pravidlo).
- V režimu context: přiznat „v podkladech k úkolu to není“ a vrátit k úkolu; zvědavou odbočku nabídnout „na později ve volném režimu“.
- UI: obecné vysvětlení zobrazit odlišeně (štítek „Mimo materiál“), podle pevného prefixu, bez dalšího volání AI.

## 3. Metody a aktivity z chatu (UI + kód funkce)
- Funkce vrátí vedle `reply` volitelné `suggestions` (max 3) ze serverového whitelistu: `practice:<slug metody>` (jen slugy existující v `study_methods`), `quiz`, `flashcards`. Model je navrhne strukturovaně (tool calling); server zahodí cokoli mimo seznam.
- Tlačítka pod odpovědí: „Vyzkoušej to jako kvíz“, „…jako kartičky“, „Zkus metodu X“. Klik otevře existující tok procvičování (`/student/metody/:slug/procviceni`) se stejnou lekcí, nebo s konverzací jako vlastním zdrojem (`savePracticeSource`, `source=custom`). Žádný nový generátor, žádné ukládání do databáze navíc.
- „Hra / úkol / pracovní list“ pro žáka: hry a úkoly zakládá učitel; žákovi nabídnout jen procvičování a kvíz. Pro učitele (pokud se Bezlai použije v učitelské části) odkaz do Studia / „Navrhnout podle metody“.
- AI štítek (EU AI Act) zůstává u odpovědí i u vygenerovaného procvičování.

## 4. Bezpečnost, limity, náklady
- Děti: stávající tykání, stručnost, žádné osobní údaje v promptu. Doplnit pravidla: nevyzvídat osobní údaje, u citlivých témat (sebepoškozování, šikana, násilí) klidná odpověď a doporučit dospělého/učitele nebo Linku bezpečí 116 111; neradit nebezpečné pokusy.
- Kvóty: návrhy tlačítek se počítají do stejného volání (žádný další dotaz na AI). Klik na procvičování spotřebuje 1 dotaz generátoru jako dnes; v demu ho dál hlídá `demoAiGuard`, zvýšení pro akci platí jen do svého konce.
- Náklady: odpověď delší jen o řádek „Co dál“ (~10–15 % tokenů výstupu). Model beze změny; zvážit rychlejší model jen pro shrnutí.
- Logy beze změny: jen kódy a délky, žádný obsah.

## 5. Testování a kvalita
- Deno testy promptu (tutor.test.ts): přítomnost bloků, zachování pevných vět, context bez přímé odpovědi, whitelist `suggestions`.
- Sada ~30 vzorových dotazů (soubor v testech, bez dat žáků): odpověď v materiálu, mimo materiál, napůl, „řekni mi výsledek“, zvědavá odbočka, citlivé téma, pokus o vymyšlený zdroj, matematika krok za krokem, kreativní / praktický typ otázky.
- Hodnocení (ručně + volitelně AI hodnotitel na sadě): správné označení zdroje, žádná vymyšlená fakta „z materiálu“, délka, tón, užitečnost „co dál“.
- V provozu bez obsahu: počty kliknutí na návrhy a podíl odpovědí „nenašla“ (jen čísla, bez textů). Ukládání metrik by vyžadovalo tabulku → SQL jen popsat, zatím ne.

## Etapy
1. Prompt: přístupy, „co dál“, „jak pátrat dál“, bezpečnost dětí + testy (jen tutor.ts, nasazení funkce).
2. UI: odlišení „Mimo materiál“ v chatu.
3. Strukturované `suggestions` + tlačítka na procvičování / kvíz.
4. Sada dotazů a ruční vyhodnocení před a po.
5. (Volitelné, SQL) anonymní metriky kliknutí.

| Co | Prompt | Kód/UI | SQL |
|---|---|---|---|
| Přístupy, sokratovské vedení, co dál | ano | – | – |
| Mimo materiál, jak pátrat dál | ano | štítek | – |
| Tlačítka metod/aktivit | – | funkce + chat | – |
| Metriky | – | – | ano (popis) |

## Rizika
- Delší odpovědi, menší čitelnost na telefonu – držet limity vět.
- Model může přestat používat pevné věty – hlídat testy.
- V context režimu riziko, že „co dál“ prozradí odpověď – v context jen nabídky bez obsahu řešení.
- Návrh metody mimo whitelist – serverová filtrace.
- Zásah do funkce, kterou žáci používají – nasazovat mimo výuku.

## Otevřené otázky
1. Mají se tlačítka zobrazovat i v režimu u úkolu, nebo jen ve volném?
2. Smí žák z chatu spustit jen procvičování/kvíz, nebo i něco jiného (hra s učitelem)?
3. Má se uvádět Linka bezpečí, nebo jen „řekni to učiteli/dospělému“?
4. Chcete anonymní metriky (vyžadují SQL)?
