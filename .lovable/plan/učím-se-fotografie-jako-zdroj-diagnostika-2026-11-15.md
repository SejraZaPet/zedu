# „Učím se“ – fotografie jako zdroj procvičování: diagnostika a návrh

Datum: 15. 11. 2026  
Stav: **pouze statická analýza zdrojového kódu**. Nebyl změněn žádný aplikační kód, nebyla vytvořena migrace, nic nebylo nasazeno ani živě zavoláno přes AI.

## 1. Co z původní části H je hotové

Navazuje na `.lovable/plan/část-h-učím-se-diagnostika-a-návrh-bez-db-2026-10-27.md`.

### H1 – opravy skóre, pravda/nepravda a textů: HOTOVO v kódu

- `src/pages/StudentPractice.tsx`, `handleSubmit`: skóre se nyní před uložením počítá přímo z aktuálních odpovědí přes `scorePractice(...)`; nepoužívá už staré `score`/`percent` z vykreslení před `setSubmitted(true)`.
- `src/lib/student-practice.ts`: `scorePractice`, `correctAnswerLabel`, `difficultyLabelCs`, `hasOpenQuestions` a `masteryFromPercents` obsahují opravená pravidla.
- `src/pages/StudentPractice.tsx`: správná odpověď pravda/nepravda se vypisuje přes `correctAnswerLabel(q)`, tedy jako „Pravda“ nebo „Nepravda“, včetně hodnoty `false`.
- **Chyba „Zvládnutí lekce 0 %“ je pro nově ukládaná sezení v kódu opravena.** `handleSubmit` ukládá čerstvé `score`, `total_scorable` a `percent`; mastery se následně počítá z těchto procent.
- Stará sezení s chybnou nulou se zpětně neopravila. Vážený průměr posledních tří sezení se postupně přepočítá dalšími výsledky.
- Testy: `src/test/student-practice.test.ts` a `src/test/practice-loci-mastery.test.ts` pokrývají 3/4 = 75 %, `false` jako „Nepravda“ a mastery. V této diagnostice nebylo ověřeno skutečné odevzdání v prohlížeči ani čtení uložené řádky.

### H2 – fáze podle techniky: HOTOVO

- `supabase/functions/_shared/practice-phases.ts`: `METHOD_PHASES`, `buildPhases`, `allocateQuiz` a `aiContentSpec` definují fáze všech osmi technik; strukturu drží kód, AI doplňuje obsah.
- `supabase/functions/ai-practice-rag/index.ts`: vrací `phases` pro známou metodu a otázky jako fallback.
- `src/pages/StudentPractice.tsx`: vykresluje vrácené fáze, postupné odemykání Sekvenční metody, Loci i Akrostiku.
- `src/components/practice/PomodoroTimer.tsx` + `src/lib/practice-method.ts`: skutečný časovač 25/5, 15/3 a 50/10, stav pouze v `sessionStorage`.
- Testy: `src/test/practice-method.test.ts`, `src/test/practice-loci-mastery.test.ts` a další testy procvičování.

### H3 – vlastní text: HOTOVO

- `src/pages/StudentMethods.tsx`: zdroj „Vlastní text“, minimální délka a počet znaků.
- `src/lib/practice-method.ts`: `savePracticeSource` / `readPracticeSource` předávají potvrzený text pouze v `sessionStorage` aktuální karty pod klíčem `bezli.practice.source`.
- `src/pages/StudentPractice.tsx`: při `source=custom` volá `ai-practice-rag` s `source_text` a `source_kind` místo `lesson_id`.
- `supabase/functions/_shared/practice-phases.ts`: `prepareSourceText` vyžaduje 150 znaků a omezuje vstup na 8000 znaků.
- `src/pages/StudentPractice.tsx`, `handleSubmit`: u vlastního zdroje je `lesson_id = null`, mastery lekce se nepočítá a do `answers_json.source` se zapíše pouze typ zdroje. Fáze se ukládají bez `content`, tedy bez celého zdrojového textu.

### H4 – stránka sešitu: HOTOVO pro textová pole, ne pro rukopis

- `src/pages/StudentMethods.tsx`: výběr vlastního sešitu a stránky.
- `src/lib/practice-method.ts`, `notebookPageText`: čte pouze `content.textBoxes[].text`, vynechává tahy, obrázky a seznam třídy.
- Rukopis a obrázky ve stránce sešitu se stále nepřepisují. To odpovídá původnímu bezpečnému základu H4; fotografie sešitu má být nová cesta H5, ne skrytá změna čtení sešitu.

### H5 – soubor / fotografie / portfolio: ČÁSTEČNĚ

- V `src/pages/StudentMethods.tsx` je hotový pouze **PDF s textovou vrstvou a `.txt`**; `handleFile` používá `extractPdfText` nebo `file.text()`.
- **Portfolio není v dialogu „Učím se“ dostupné**, přestože `SOURCE_KINDS` na serveru už obsahuje `portfolio`.
- **Fotografie v dialogu „Učím se“ chybí.** UI výslovně říká „Fotky zatím neumíme přečíst.“
- Samostatná stránka `/student/z-materialu` (`src/pages/StudentFromMaterial.tsx` + `src/components/from-material/FromMaterialView.tsx`) už fotografie přijímá a umí z nich vytvořit dočasnou aktivitu. Jde však o jiný tok: AI generuje aktivitu přímo z obrázků a žák předtím nevidí ani neopravuje přepsaný text.

## 2. Stávající AI funkce, fotografie, oprávnění a limity

### `process-file-content`

Soubor: `supabase/functions/process-file-content/index.ts`

- `callGatewayWithFile` posílá binární obsah jako `image_url` s data URL do Lovable AI Gateway `/v1/chat/completions`.
- Model v kódu: **`google/gemini-2.5-flash`**.
- `SYSTEM_PROMPT` požaduje doslovně zachovat veškerý text a převést ho do bloků. Výstupem proto nejsou samotné OCR řádky, ale `lessons[]` a `blocks[]` přes `create_blocks`.
- JPEG/PNG a další obrazová data lze touto cestou předat modelu; není to lokální OCR, ale **AI vision**. Skutečnou kvalitu přepisu fotky z telefonu tato diagnostika neověřila.
- Limit: `MAX_BASE64_BYTES = 25 * 1024 * 1024`; kontrola dopočítává přibližnou binární velikost z délky base64. Chybí explicitní allowlist obrazových MIME typů.
- `callGateway`: 75 s na jedno AI volání, celkový rozpočet 200 s, až tři pokusy u vybraných přechodných chyb.
- **Přímá fotografie se v této funkci neukládá do Storage.** Pozor: větve pro DOCX/PPTX umí vložená média nahrát do veřejného `lesson-images` přes `uploadMediaToStorage`. Proto nelze bez rozlišení vstupu označit celou funkci za „nikdy nic neukládá“.
- Pro potřeby „Učím se“ je nevýhodou těžký blokový výstup, importní logika a obecné chybové hlášky o dokumentu.

### `generate-content-from-material`

Soubor: `supabase/functions/generate-content-from-material/index.ts`

- Přijímá `images[]` jako data URL a posílá je jako `image_url` do Lovable AI Gateway `/v1/chat/completions`.
- Model v kódu: **`google/gemini-2.5-flash`**.
- Umí AI vision použít přímo k tvorbě pracovního listu, aktivit nebo prezentace. **Nemá režim „jen přepiš text ke kontrole“**.
- Server omezuje výstupní typ a počet položek; obrázky použije nejvýše šest. Nemá vlastní serverový bajtový limit ani obrazovou MIME allowlist.
- `FromMaterialView.handleImagePick`: až 6 obrázků, `accept="image/*"`, `capture="environment"`; bez zmenšení, bez kontroly velikosti a bez editovatelného OCR náhledu. Dokumentový `extractedText` se také jen zobrazí jako počet znaků, nikoli jako editovatelné pole.
- Proto se pro požadovaný tok nehodí bez změny: obešel by právě povinnou kontrolu textu žákem.

### `ai-practice-rag`

Soubor: `supabase/functions/ai-practice-rag/index.ts`

- Nepřijímá obrázek. Přijímá `lesson_id` NEBO `source_text` + `source_kind`.
- `SOURCE_KINDS` v `supabase/functions/_shared/practice-phases.ts`: `text`, `file`, `notebook`, `portfolio`; pro fotografii bude potřeba přidat `photo`.
- Model pro generování procvičování: **`google/gemini-2.5-flash`**.
- Po ověřeném OCR se má zavolat až s potvrzeným textem. Tím zůstanou zachované fáze, obtížnost, vysvětlení, skóre i ukládání.

### JWT, role a RLS

- Všechny tři funkce volají `requireAuth(req)` z `supabase/functions/_shared/auth.ts`.
- `requireAuth` ověřuje Bearer JWT přes `auth.getClaims(token)` a získává `sub` jako `userId`.
- `verify_jwt = false` v `supabase/config.toml` u těchto funkcí znamená, že ověření se spoléhá právě na tuto kontrolu v kódu.
- **`process-file-content` a `generate-content-from-material` smí volat žák.** Nemají omezení jen pro učitele; postačí platný přihlášený uživatel. Samotná edge funkce nekontroluje roli ani stav schválení profilu.
- `/student/z-materialu`, `/student/metody` i `/student/metody/:slug/procviceni` jsou v `src/App.tsx` za `ProtectedRoute`; bez `allowedRoles` povolují přihlášeného schváleného uživatele, tedy i žáka. To je ochranu UI, nikoli samostatnou roli edge funkce.
- Přímé AI zpracování obrázku v prvních dvou funkcích samo o sobě neprochází tabulkovým RLS, protože obsah nečte z aplikační tabulky. Demo rezervace používá serverovou roli.
- `ai-practice-rag` načítá lekci přes klienta s JWT volajícího (`loadPracticeLesson`), takže zde platí stávající RLS. U cizího `student_id` povoluje jen roli teacher/admin; běžný žákovský klient `student_id` neposílá.
- Uložení výsledku zůstává v `StudentPractice.handleSubmit` přes žákovského klienta a stávající RLS `student_practice_sessions`. Nová cesta nemá měnit politiky ani demo izolaci.

### Demo limit

- Všechny tři funkce volají `demoAiGuard(auth, "<název-funkce>")` před AI.
- `_shared/demo-ai-guard.ts` používá atomickou serverovou rezervaci `demo_ai_reserve`.
- Migrace `0046_demo_limits_and_cleanup.sql` ukazuje společný limit na účet a globální denní limit; nový název funkce tedy nevytvoří nový neomezený počítadlo.
- Nová OCR funkce musí zavolat `demoAiGuard(auth, "extract-practice-photo-text")` **před prvním požadavkem na AI**.
- Stávající guard při chybě `demo_ai_reserve` zapíše chybu a požadavek povolí (fail-open). Případné zpřísnění by měnilo společné chování všech AI funkcí, proto není součást tohoto návrhu.

## 3. Doporučený nejmenší bezpečný tok

```text
„Učím se“ → zdroj „Fotografie“
  → [Vyfotit / nahrát fotku]
  → kontrola typu a velikosti + zmenšení v prohlížeči na JPEG
  → extract-practice-photo-text (JWT + demoAiGuard; bez Storage a DB)
  → žák vidí „Přepsáno AI – zkontroluj text“
  → opraví nebo zkrátí text; případně vyfotí znovu / dopíše ručně
  → teprve [Spustit procvičování]
  → stávající savePracticeSource({ kind: "photo", text, label })
  → stávající StudentPractice → ai-practice-rag({ source_text, source_kind: "photo" })
  → stávající výsledek; answers_json.source = { kind: "photo" }
```

### Proč malá nová edge funkce

Doporučený název: **`supabase/functions/extract-practice-photo-text/index.ts`**.

- Vstup pouze `{ imageBase64, mimeType }`; bez názvu souboru, žákovských metadat a bez databázových operací.
- Výstup pouze `{ text }`, případně bezpečná chyba `UNREADABLE_PHOTO` / `INSUFFICIENT_TEXT`.
- Prompt: doslovný přepis viditelného textu, zachovat pořadí a odstavce, nic nedoplňovat ani neshrnovat; nejistá místa označit a při nečitelnosti raději odmítnout.
- Povolit na serveru pouze výstup klientovy konverze `image/jpeg`; přísný bajtový limit a znakový limit odpovědi.
- Neukládat fotku ani text do Storage, DB, `localStorage` ani `sessionStorage`. V `sessionStorage` zůstane až text výslovně potvrzený žákem, stejně jako u ostatních vlastních zdrojů.
- Neloggovat base64, přepsaný text, obsah odpovědi AI ani tělo chyby, které by mohlo obsah obsahovat. Logovat jen technický stav bez obsahu.
- Nepřidávat automatické opakování při 400/401/402/403; u 429/5xx pouze omezené zotavení podle pravidel gateway. Nové ruční pokusy žáka projdou demo limitem.
- `AiContentBadge` už označuje výsledné procvičování. U OCR náhledu má být navíc viditelné „Přepsáno AI – zkontroluj text“; sezení už ukládá `ai_generated: true`.

**Model nové funkce:** v této diagnostice nebyla ověřena živá dostupnost. Před implementací je nutné v authenticated katalogu `/v1/models` ověřit obrazový vstup a retenci konkrétního endpointu. Pro nový chat/text call je výchozí `openai/gpt-6-astra` na Responses API; použít jej jen pokud katalog potvrdí image input a povolenou/ZDR retenci. Pokud ne, implementaci zastavit a model explicitně vybrat, ne automaticky zaměnit. Modely stávajících funkcí neměnit.

### Mobilní vstup a velikost – navržené hodnoty

- Jedna fotografie na pokus; `<input type="file" accept="image/*" capture="environment">`. `capture` je pouze doporučení prohlížeči, na desktopu otevře výběr souboru.
- Nový helper např. `src/lib/practice-photo.ts`, `preparePracticePhoto(file)`:
  - vstupní strop navrhuji 15 MB;
  - JPEG/PNG/WebP a HEIC/HEIF pouze pokud je prohlížeč skutečně dokáže dekódovat;
  - převod přes canvas na JPEG, dlouhá strana nejvýše 2048 px, kvalita přibližně 0,85;
  - výstupní strop navrhuji 4 MB, stejný limit zopakovat na serveru;
  - respektovat orientaci a neposílat EXIF/GPS; nové canvas data URL původní metadata neobsahuje;
  - po použití uvolnit object URL a po zrušení/dokončení vyčistit `File`, base64 i náhled z paměti.
- **HEIC dnes není spolehlivě podporován:** stávající kód jej jen převede do base64 a pošle dál. Projekt nemá HEIC konverzní knihovnu. Pokud prohlížeč HEIC nedekóduje, zobrazit srozumitelnou hlášku a nabídnout JPEG; robustní konverze knihovnou by byla samostatná závislost a rozšíření rozsahu.
- OCR výstup nesmí být tiše useknut. V editoru povolit 150–8000 znaků; při delším přepisu požádat žáka o zkrácení před spuštěním.

### Rozmazaná nebo nečitelná fotka

- Při prázdném/nečitelném výstupu negenerovat procvičování a neposílat prázdný text do `ai-practice-rag`.
- Hláška v tykání: **„Text se nepodařilo spolehlivě přečíst. Vyfot stránku znovu ostřeji a při lepším světle, nebo text opiš ručně.“**
- Akce: **„Vyfotit znovu“** a **„Upravit / doplnit ručně“**. Částečný přepis ponechat v editovatelném poli, pokud existuje.
- Krátký text pod 150 znaků má použít stávající českou hlášku z `prepareSourceText`; dlouhý text nad 8000 znaků nejprve zkrátit.
- Chyby 402/429 a nedostupnost AI zobrazit přes stávající `practiceErrorMessage`; bez nekonečného točení a bez automatického střídání modelu.

## 4. Soukromí, nezletilý žák a autorská práva

- Před výběrem fotky zobrazit krátké upozornění: **„Fotku použijeme jen k přečtení textu a v Bezli ji neuložíme. Vyfoť jen učivo, bez jmen, obličejů a dalších osobních údajů. Používej pouze materiál, který smíš použít k vlastnímu studiu.“**
- Fotografie se nezobrazí učiteli, nevloží se do portfolia, nepoužije jako veřejný obrázek a neodešle do `lesson-images`.
- Neukládat původní název souboru ani EXIF. Neuvádět, že se fotka „nikam nepošle“: k přepisu ji zpracuje Lovable AI Gateway a zvolený poskytovatel modelu. Před implementací ověřit ZDR/retenci; bez toho nelze tvrdit, že se obsah nikde nezpracovává ani dočasně neuchovává.
- Autorská práva neposoudí samotná aplikace. Upozornění má omezit použití na vlastní studium a nesmí nabízet další sdílení/publikaci stránek učebnice.
- OCR text může obsahovat jména ze sešitu. Žák jej musí vidět a moci odstranit před druhým AI voláním. Pokud je na fotce hodně osobních údajů, správná cesta je nová fotka pouze učiva nebo ruční přepis.
- Výsledek se uloží stávajícím způsobem pod žáka; žádné nové sdílení s učitelem/rodičem ani změna RLS.

**Přesné vymezení „v DB zůstane jen zdroj fotka“:** nový návrh neukládá původní fotku ani celý OCR/`source_text`. Stávající `answers_json` však obsahuje odpovědi a fáze bez `content`, tedy i AI otázky a případné ověřené `source_quote` úryvky. To není kopie celého zdroje, ale může to být odvozený citovaný text. Pokud požadavek znamená doslovně zakázat i tyto odvozené údaje, bylo by nutné pro `photo` vynechat další části `answers_json.phases`; to by změnilo existující historii výsledků a vyžaduje samostatné výslovné schválení.

### Oddělené zjištění mimo samotnou fotku – bez provedené opravy

V `supabase/functions/ai-practice-rag/index.ts`, dotaz na posledních pět `student_practice_sessions` pro výpočet obtížnosti (kolem řádků 92–98), chybí `.eq("student_id", effectiveStudentId)`. Dotaz běží serverovou rolí, takže může použít procenta cizích žáků k obtížnosti. Obsah těchto řádků se klientovi nevrací, ale jde o nežádoucí použití dat napříč uživateli. Doporučení: samostatná malá oprava filtru a test izolace, až po schválení; v této diagnostice nebyla provedena.

## 5. Rozdělení do tří samostatně testovatelných kroků

### Krok 1 – pouze mobilní příprava fotky a lokální UI

- Nový `src/lib/practice-photo.ts` + testy validace, zmenšení, orientace, limitů a uvolnění URL.
- `src/pages/StudentMethods.tsx`: nový zdroj „Fotografie“, `capture="environment"`, upozornění na soukromí, náhled a stavy chyb; zatím bez spuštění AI procvičování.
- Testy 390 px, klávesnice, 44px dotykové cíle, text 16 px v textarea, zrušení a opakovaný výběr.
- Odhad: **2–3 hodiny**. Žádná DB ani migrace.

### Krok 2 – specializovaný AI přepis a povinná kontrola žákem

- Nová `supabase/functions/extract-practice-photo-text/index.ts` s `requireAuth`, `demoAiGuard`, přísnými limity, bez Storage/DB a bez obsahových logů.
- `StudentMethods`: editovatelný OCR text, AI označení, „Vyfotit znovu“, ruční oprava a blokace spuštění při nečitelnosti nebo délce mimo 150–8000.
- Testy mockované gateway: bez JWT, nepovolený MIME, příliš velký vstup, prázdný/nečitelný výstup, 402/429/5xx a demo odmítnutí. Test musí též dokázat, že se před potvrzením nevolá `ai-practice-rag`.
- Živý test až se samostatným povolením nasazení a pouze s vlastním `[TEST]` obrázkem bez osobních údajů; ověřit odpověď, demo limit i absenci nového objektu ve Storage.
- Odhad: **3–5 hodin**. Žádná DB migrace; nasazení funkce není součást této diagnostiky.

### Krok 3 – napojení potvrzeného textu na stávající procvičování

- `src/lib/practice-method.ts`: `PracticeSource.kind` doplnit o `photo` a předávat pouze potvrzený text.
- `supabase/functions/_shared/practice-phases.ts`: `SOURCE_KINDS` doplnit o `photo`; limity zůstávají 150/8000.
- `src/pages/StudentMethods.tsx`: `chosenSource` a `startPractice` použijí existující `savePracticeSource` až po potvrzení.
- `src/pages/StudentPractice.tsx`: popisek zdroje „Fotografie“; stávající `answers_json.source = { kind: "photo" }`, `lesson_id = null`, bez mastery lekce a bez kopie celého textu.
- Testy: `src/test/practice-method.test.ts`, `src/test/student-practice.test.ts`, nový test toku fotka → oprava → `ai-practice-rag`; regrese lekce/text/PDF/sešitu, skóre, fází a ostatních worksheet testů.
- Ručně ověřit skutečného `[TEST]` žáka na mobilu i desktopu, včetně opravy OCR, znovuvyfocení, uloženého typu zdroje a absence původní fotky/textu v DB. Testovací výsledky označit `[TEST]` a uklidit pouze vlastní vytvořená data.
- Odhad: **2–3 hodiny**. Bez DB migrace a bez změny RLS.

Celkový hrubý odhad: **7–11 hodin** včetně cílených testů, bez času na právní posouzení školy a bez případné samostatné HEIC knihovny.

## Co tato diagnostika neověřila

- Nebylo provedeno živé OCR, měření kvality rozmazaných fotek ani ověření dostupnosti/retence modelu.
- Nebyl spuštěn žádný test, protože se neměnil kód; závěry o H1–H4 vycházejí z aktuálního kódu a existujících testovacích souborů.
- Nebylo ověřeno skutečné uložení nového výsledku žákem ani chování kamery/HEIC na konkrétním telefonu.
