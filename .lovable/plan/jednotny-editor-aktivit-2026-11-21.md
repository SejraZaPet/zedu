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

### Co zbývá (etapy 4–5 a pozdější doplnění)
- Starší vedlejší editor `GameTemplateEditorDialog` a historické cesty zatím nejsou převedeny pod příznak; hlavní formuláře Studia, lekce a prezentace už sdílený editor používají.
- Pro pokročilé herní typy doplnit plné vizuální/průvodcovské editory a validace (zejména BezliStart a složitější nastavení týmů); stávající `AddSlideSheet` zůstává dostupný.
- Sjednotit dostupnost rendererů: mcq/poll/wordcloud/short_answer/word_search a herní typy nemají všude stejné žákovské zobrazení. Editor obsah uloží, ale nezaručuje novou herní podporu.
- Doplnit obrázek jednotlivé otázky u víceotázkového kvízu a hloubkovou validaci všech typů.
- Samostatně ověřit všechny typy v živé hře; tato etapa mění editor a adaptéry, ne herní scoring ani RLS.
