# Učím se – kontrola připravenosti na ostrý provoz (19. 11. 2026, jen audit)

Žádné změny kódu, DB, secretů ani nasazení. Níže jsou jen doporučení k pozdějšímu schválení.

## Výsledky kontrol
- Typy: OK (0 chyb). Sestavení: OK (výstup mimo projekt).
- Testy procvičování a fotek: 9 souborů, 67/67 prošlo.
- Celá sada: 1113 prošlo, 7 selhalo – jen známé classroom-people-source (2) a lesson-study-bar (5). Žádné nové.

| Oblast | Stav | Důkaz | Doporučení |
|---|---|---|---|
| Logy 7 dní (obě funkce) | Riziko | Žádné záznamy pro extract-practice-photo-text ani ai-practice-rag | Funkce zřejmě nebyly volány, nebo foto funkce není nasazená. Po nasazení udělat jeden živý test. |
| AI model | Riziko | core.ts:93 a ai-practice-rag/index.ts:159: google/gemini-2.5-flash | Katalog ho vede jako zastaralý. ZDR je pro něj dostupné, ale na tomto projektu jsem ho neověřila. Rozhodnout o přechodu na novější Flash. |
| Bez přihlášení | OK | extract index.ts:6 requireAuth; ai-practice-rag:22 | – |
| Demo limit | OK | demoAiGuard před AI voláním (core.ts:80; rag:31). Upozornění v StudentMethods.tsx:504 | Denní strop je v demo_config, jeho hodnotu jsem nečetla. |
| Velký obrázek | OK | Klient 15 MB vstup, 2048 px, JPEG 0,85, max 4 MB (practice-photo.ts:1-4, 158). Server odmítne nad 4 MB (core.ts:75) | – |
| Ne-JPEG na serveru | OK | core.ts:14 mimeType jen image/jpeg | Kontroluje se jen deklarovaný typ, ne obsah. Nízké riziko, AI vrátí nečitelné. |
| Nečitelná fotka | OK | core.ts:141-144 → unreadable / 422 INSUFFICIENT_TEXT | – |
| Limit 6 fotek | OK | use-practice-photos.ts:6, 85 – celá dávka se viditelně odmítne | – |
| Překrývání dávek / chyba jedné fotky | OK | Číslo dávky a busy (use-practice-photos.ts:14-76); test practice-photo-batch | – |
| Text 150–8000 | OK | practice-phases.ts:50-51 a prepareSourceText (rag:68) | – |
| Chybové odpovědi rag | Riziko (nízké) | rag:233-236 vrací klientovi e.message | Vracet obecnou hlášku. |
| Soukromí – fotky | OK | Žádný zápis do storage/DB v core.ts; bez logů (core.ts:117, 147) | – |
| Soukromí – logy rag | Riziko | rag:193 loguje tělo chybové odpovědi AI | Logovat jen stavový kód. Tělo vstupní text obvykle neobsahuje, ale neověřila jsem to. |
| Soukromí – ukládání sezení | Riziko | StudentPractice.tsx:292-297: source = jen { kind } (OK). Ukládá ale `phases` bez `content` a `answers` | Otázky vytvořené z fotky (jejich znění, případně source_quote) se mohou uložit. Ověřit a případně ukládat jen skóre. |
| Doporučení k lekci | OK | rag:216 ukládá jen u lekce, ne u vlastního textu | – |
| HEIC z iPhonu | Riziko | practice-photo.ts:46, 109-172: dekódování umí jen prohlížeč | Safari HEIC většinou otevře, Chrome/Android ne. Pak se zobrazí srozumitelná hláška a fotka se nezpracuje. iPhone při výběru z galerie často sám převede na JPEG. |
| Velká fotka z foťáku | OK/riziko | Zmenšení na 2048 px | Nad 15 MB odmítnuto. Na slabých telefonech hrozí nedostatek paměti při kreslení, neověřeno. |
| Nasazení 8de5e8fc | Nelze zjistit | Commit je v historii (7. od konce). Jaká verze běží na bezli.cz, nevidím. | Ověřit při příštím publikování. Foto funkce nemá žádné logy, takže pravděpodobně nasazená není. |

## Neověřeno
- Živé AI volání (přepis fotky ani generování otázek).
- Nastavení ZDR a skutečná dostupnost modelu na tomto projektu.
- Nativní galerie iOS/Android, skutečný iPhone a HEIC.
- Hodnota denního demo stropu.
- Zda je publikovaná verze bezli.cz shodná s 8de5e8fc.

## Navrhované opravy (každá až po schválení)
1. rag: logovat jen stavový kód a klientovi vracet obecnou chybu.
2. Ověřit/omezit, co se z `phases`/`answers` ukládá u zdrojů foto a vlastní text.
3. Rozhodnout o modelu (ponechat 2.5 Flash, nebo přejít na novější).
4. Po nasazení jeden živý test s [TEST] fotkou.
