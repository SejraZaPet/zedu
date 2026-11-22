# Jednotný editor aktivit (Studio, lekce, prezentace) – analýza a plán

Stav: jen analýza, nic neimplementováno. Bez změn databáze a RLS.

## 1. Proč nešla prázdná aktivita ze Studia logicky upravit
- Studio ukládá kvíz jako `content.options: string[]` + `correctIndex`; při převodu na slide (`studio-step.ts` stepToSlide) se **prázdné odpovědi zahodí**, takže prázdný kvíz přijde jako `activitySpec { activityType: "mcq", options: [], correctIndex: 0 }`, typ slidu bývá `studio_step`.
- Presety i Studio vkládají slide **jen s `activitySpec`, bez bloku**. Plný lekční editor (`ActivityBlock`) se otevírá jen po výběru bloku – tady žádný není.
- Panel prezentace (`LiveActivitySpecEditor`) uměl 12 typů, **ne `mcq`, `quiz`, `poll`, `wordcloud`, týmové/herní typy**. Výběr typu neměl položku `mcq`, takže pole „Typ“ bylo prázdné.
- Panel se zobrazoval jen pro `type === "activity"`, ne pro `studio_step`.
- Tři modely kvízu: Studio (`content.options`), živý slide (`options[{text,correct}]`, `correctIndex`), lekce (`quiz.questions[].answers`). Zrcadlení spec↔blok kopíruje klíče, nepřevádí schémata.
- Část A tohoto zadání to obchází: pravý panel pro `activity` i `studio_step`, editor `mcq`/`poll`, placeholdery, kontrola chybějícího obsahu. Sjednocení modelů zůstává na etapy níže.

## 2. Typy aktivit – co jde upravit dnes (po části A)
| Typ | Prezentace | Studio | Lekce |
|---|---|---|---|
| mcq (kvíz – 1 otázka) | otázka, odpovědi, správná, obrázek (odkaz), vysvětlení, čas, body, barvy | otázka, odpovědi, správná, čas, body, obrázek, vysvětlení | ne (jen jako quiz) |
| quiz (více otázek) | jen přes blok z lekce; bez bloku ne | jako mcq kroky | otázky, odpovědi, vysvětlení |
| poll | možnosti, otázka, barvy | možnosti | možnosti, více odpovědí |
| wall | otázka, anonymita, více odpovědí | otázka, anonymita | totéž |
| wordcloud | jen barvy (obsah ne) | otázka, anonymita | ne |
| true_false, matching, ordering, sorting, fill_blanks, fill_choice, flashcards, reveal_cards, memory_game, crossword, image_label, image_hotspot | obsah (LiveActivitySpecEditor), čas u bodovaných, body, barvy | ano | ano |
| teams, differentiated, escape, bezlistart | ne (jen barvy) | bez obsahového editoru | ne |
| short_answer, word_search | ne | registrováno, bez editoru | ne |

Průřezově: týmy jsou tři různé věci (`settings` sady, `gameSettings.teamMode` slidu, `activitySpec.teamMode` rozdělovací aktivity); obrázek otázky je jen u mcq; vysvětlení jen mcq/quiz; barvy nově `activitySpec.colors` (jen prezentace).

## 3. Co lze sdílet
- `ActivityContentEditor` (Studio, 13 typů) – základ obsahové části.
- Interní `QuizEditor` z `ActivityBlock` – víceotázkový kvíz.
- `StepCard` ve Studiu – čas/body/týmy/vysvětlení/obrázek.
- `LiveActivitySpecEditor`, nový `McqSpecEditor`, `ActivityColorsEditor`, `ActivitySettingsPanel` – patch nad `activitySpec`.
- `activity-colors.ts`, `activity-completeness.ts` – čistá pravidla (kontrast, co chybí).

## 4. Návrh
Jeden `ActivityEditor` = adaptéry (Studio krok / lekční blok / slide) → společný kanonický tvar `ActivityModel` → sekce Obsah (podle typu), Nastavení (čas, body, jednotlivě/týmy), Obrázek a vysvětlení, Vizuál a barvy, Použití. Adaptéry jen převádějí tam a zpět, stará pole ponechávají.

## 5. Etapy
1. Kanonický model + adaptéry (čisté funkce, testy round-trip pro všechny typy; mcq↔quiz bez ztráty správné odpovědi, prázdné odpovědi se neztrácí).
2. Sdílená sekce Obsah: sloučit ActivityContentEditor + QuizEditor + McqSpecEditor; doplnit wordcloud, short_answer, word_search.
3. Sdílené Nastavení (čas, body, týmy s jasným rozlišením tří úrovní) a Barvy i ve Studiu a lekci.
4. Výměna editorů ve Studiu, lekci a prezentaci za jeden; staré necháme za příznakem do ověření.
5. Herní typy (teams, differentiated, escape, bezlistart) – obsahový editor.

## 6. Rizika
Záměna mcq/quiz; přepsání výchozích hodnot explicitními; patch vs. náhrada props; tři úrovně týmů; renderer neumí zobrazit vše, co editor uloží (poll/mcq v lekčním rendereru); velké soubory editorů. Zmírnění: testy adaptérů, postupná výměna, bez změn DB.

Odhad: etapa 1 ~1 den, 2 ~2 dny, 3 ~1 den, 4 ~2 dny, 5 ~2 dny.

## Stav po provedení etap 1–3 (22. 11. 2026)
- Hotovo: `ActivityModel`, líné adaptéry pro `activitySpec`, blok a `ActivityStep`; round-trip testy všech typů; prázdné odpovědi se při převodu nezahazují.
- Hotovo: sdílený `ActivityEditor` používají Studio, lekce i pravý panel prezentace. Obsah, čas, body, účast, obrázek, vysvětlení a barvy mají společné ovládání; kontrast zůstává v `activity-colors.ts`.
- Hotovo i jako součást obsahové etapy: mcq, quiz s více otázkami, poll, wall, wordcloud, short_answer, word_search; teams/differentiated/escape/bezlistart mají aspoň textový obsah. Specializované editory doplňování, dvojic, obrázků, křížovek a karet se znovu používají.
- Stará pole se slévají s původním objektem a zapisují až po akci učitele. Žádná DB/RLS migrace není součástí.

### Stav po etapě 3 prezentace (22. 11. 2026)
- Hotovo: katalog všech interaktivních typů Studia v pěti skupinách; dialog se čtyřmi cestami (nová, AI z materiálu, lekce, Studio/knihovna), sdíleným editorem, živým náhledem a volbou aktuálního/nového slidu.
- Hotovo: skutečná AI cesta používá `SourceInput`, koncept zůstává lokální do schválení, má AI štítek; vložení zachová `ai_generated` a `ai_modified_at`.
- Hotovo: kopie jednoho či více slidů z vlastní lekce/prezentace na zvolené místo. Zachovávají obsah, obrázky, pozadí, poznámky a vnitřní vazby aktivit; dostanou nová ID slidů/bloků a nezůstanou svázané se zdrojovou lekcí.
- Hotovo: obsahové editory dvojic, seřazení, doplňování, kartiček, třídění, pexesa, křížovky, osmisměrky, popisu/hotspotu, týmů, diferencované aktivity, únikové hry i BezliStart používají jednotný editor. Tisk jednotlivé aktivity i celého slidu používá existující PDF cestu.
- Hotovo: při živém rozložení víceotázkového kvízu se zachovají barvy, obrázek a AI metadata. Hlášení přeskočených a nebodovaných typů je testované.
- `GameTemplateEditorDialog` není druhý obsahový editor; jen vypisuje kroky a otevírá sdílený `AddSlideSheet`. Není proto potřeba jej riskantně přepisovat.

### Co zbývá po bezpečném rozsahu této etapy
- Pro BezliStart a složitější týmová pravidla doplnit plné vizuální průvodce a podrobnější validace; textový obsah, společné nastavení a původní `AddSlideSheet` jsou dostupné.
- Sjednotit dostupnost rendererů: ne všechny typy mají stejné žákovské zobrazení v lekci a živé hře. Nepodporované typy se při spuštění hlásí jako přeskočené; scoring se neměnil.
- Doplnit obrázek jednotlivé otázky u víceotázkového kvízu; společný obrázek aktivity je dostupný a přenáší se i do živé hry.
- Samostatně ověřit každý specializovaný typ v živé hře. V této etapě byl proklikán bodovaný kvíz včetně odpovědi, výsledků a správného zobrazení bodů.
