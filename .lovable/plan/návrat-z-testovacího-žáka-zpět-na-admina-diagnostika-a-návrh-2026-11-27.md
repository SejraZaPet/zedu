# Návrat z testovacího žáka zpět na admina — diagnostika a návrh opravy

Nic se zatím nemění. Databáze, RLS, SQL ani AGENTS.md se nemění, nic se nenasadí.

## 1. Jaké cesty zpět dnes existují
1. Plovoucí štítek „Testovací žák · Zpět“ (`PreviewStudentBanner.tsx:8,16`, vložený do `App.tsx:128`). Zobrazí se jen tehdy, když `isPreviewStudentSession()` vrátí true.
2. „Zpět na admina / učitele“ v Menu a v mobilním menu (`RoleSwitchMenu.tsx:14-19`, `SiteHeader.tsx:341,583`). Nabídka `role-switch.ts:24-26` se zobrazí také jen při `isPreviewSession`.
3. Odkaz „Administrace“ v patičce se v relaci testovacího žáka záměrně schová (`role-switch.ts:47-49`).
4. Jinou cestu zpět kód nemá. Když chybí příznak, zbývá jen „Odhlásit“.

## 2. Kdy se návratová relace ztratí
1. Klíč `bezli.previewStudent.return` leží jen v sessionStorage té jedné záložky (`preview-student.ts:4,20`). Přihlášení (`setSession`) se ale ukládá do úložiště, které sdílejí všechny záložky.
   - **Nejpravděpodobnější příčina:** po přepnutí jsou testovacím žákem všechny otevřené záložky a nová okna. Návrat ale má k dispozici jen ta jedna záložka, kde se přepínalo. Platí to i pro odkaz otevřený v nové záložce a pro zavřenou a znovu otevřenou záložku. Že k tomu došlo právě u Tyny: neověřeno.
2. Obnovení stránky ve stejné záložce klíč zachová.
3. Starý refresh token admina se při přepnutí nezneplatní: kód volá jen `setSession`, ne `signOut` (`preview-student.ts:24`). Jestli token po delší době vyprší podle nastavení přihlašování: neověřeno.
   - Riziko: když má admin ještě jinou záložku s automatickým obnovováním, může token mezitím obnovit (zrotovat). Uložená kopie pak přestane platit. Neověřeno.
4. Přihlášení přes `preview-student-switch` (`issueSession`, `_shared/demo.ts:52-62`) samo relaci admina neruší.
5. Když `setSession` při návratu selže nebo klíč chybí, provede se `signOut()` a stránka přejde na `/auth` (`preview-student.ts:36-38`, `RoleSwitchMenu.tsx:28`). Žádná hláška se nezobrazí, uživatel je potichu odhlášen.

## 3. Viditelnost tlačítka zpět
1. Obě cesty zpět se zobrazí jen při `isPreviewStudentSession()`.
2. Pokud příznak chybí (jiná záložka), ale přihlášený je testovací žák, nezobrazí se nic. Uživatel nevidí štítek ani položku v Menu a zbývá jen „Odhlásit“.

## 4. Role žáka
1. Ano, v jiné záložce je to přesně ten případ. Testovací žák má roli student, takže `realRole` není admin a `role-switch.ts:27-43` vrátí prázdný seznam. `RoleSwitchMenu` pak nic nevykreslí (`:19`).
2. Ve stejné záložce se možnost zpět ukáže dřív, než se kontroluje role (`:24`). Tam role vadit nemá.

## 5. Navržená nejmenší oprava (jen kód aplikace)
1. **Poznat testovacího žáka i bez příznaku.** Testovací žák má vždy e-mail končící `@preview.invalid` (`preview-student-switch/index.ts:24`). Nová funkce `isPreviewStudentUser(user)` to zkontroluje. Štítek „Zpět“ i položka v Menu se zobrazí, když platí příznak, nebo když jde o testovacího žáka. Oprávnění se nemění, jde jen o zobrazení.
2. **Návrat bez uložené relace nebo s neplatnou relací.** Testovací žák se odhlásí a uživatel se dostane na `/auth?duvod=nahled` s hláškou: „Návrat na admina v této záložce už není možný. Přihlaste se prosím znovu jako admin.“ Žádné tiché odhlášení.
3. **Upozornění při přepnutí** (volitelné): v potvrzení přepnutí se objeví věta „Ostatní záložky se také přepnou na testovacího žáka; zpět se vraťte v této záložce.“
4. **Bezpečnost se nemění.** Relaci admina nelze obnovit bez uloženého tokenu, takže nová cesta vede vždy přes přihlášení. RLS, databáze ani funkce na serveru se nemění.
5. **Testy:** rozšířit `role-switch` test (testovací žák bez příznaku → nabídka „Zpět“) a test, že návrat bez uložené relace vede na `/auth?duvod=nahled`.

## Jak opravu ověřit
1. Playwright, admin: přepnout na testovacího žáka a návrat ve stejné záložce → `/admin`.
2. Přepnout na testovacího žáka a otevřít novou záložku → „Zpět“ je vidět. Po kliknutí se objeví přihlášení s hláškou, nikde nic tiše nezmizí.
3. Poškozený uložený token → přihlášení s hláškou.
4. Telefon 390 px i počítač: štítek i položka v Menu. Do databáze se při zkoušce nic nezapisuje, kromě samotného přihlášení.

## Otevřená otázka
Je správné, že návrat z jiné záložky vyžaduje nové přihlášení? Bezpečně přenést relaci admina mezi záložkami bez změny zabezpečení nejde.
