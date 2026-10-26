# Bannery – návrh etapy 2 (zobrazení) a 3 (správa)

Pouze návrh. Nic se neprovádí. Bucket `banners` zakládá učitelka až po vypnutí blokace veřejných bucketů. Návrh s ním jen počítá.

## Zjištěný stav (čtením)
- `drizzle/migrations/0069_banners_stage1.sql`: tabulka `banners` (ř. 1–26), RLS admin a school_admin (ř. 32–49), demo RESTRICTIVE (ř. 51–56), trigger `tg_banners_guard` s českými hláškami limitu 3 (ř. 59–95), `get_my_banners()` (ř. 100–121; vrací max 6, střídá platformní a školní podle `rn`), politiky úložiště jen INSERT a DELETE (ř. 128–137).
- V úložišti není politika UPDATE. Soubory se proto nikdy nepřepisují (žádný `upsert`). Každé nahrání dostane nový název `platform/<uuid>.<ext>` nebo `school/<school_id>/<uuid>.<ext>`.
- Vedení v `get_my_banners()` = role `school_admin`. Zástupci vedení (`school_leadership_delegates`) se jako vedení nepočítají a vidí jen učitelské bannery. Viz Migrace.

## Etapa 2 – zobrazení (nasaditelná sama, bez bannerů v DB se nic neukáže)
**Nové soubory**
- `src/lib/banners.ts` (čistá logika): `bannerPublicUrl(path)` přes `supabase.storage.from('banners').getPublicUrl`, `filterDismissed(list, now)`, `dismissBanner(id, endsAt)` (localStorage `bezli.banner.dismissed`, do min(7 dní, `ends_at`), vše v try/catch), `bannerStatus(b, now)` → čeká / běží / vypršel / vypnutý / skryto.
- `src/hooks/useMyBanners.ts`: `useQuery(['my-banners', userId], rpc('get_my_banners'))`, `staleTime` 5 min, bez refetch při focusu. Při chybě nic nezobrazit (žádný toast).
- `src/components/dashboard/DashboardBanners.tsx`:
  - Rezervovaná výška: poměr 3:1, max výška 200 px na desktopu a cca 120 px na mobilu (`aspect-[3/1] max-h-[200px]`, `rounded-xl`, jemný `border` a stín z tokenů). Skeleton jen během načítání. Když nejsou bannery, místo zmizí ještě před prvním vykreslením obsahu: rezervuje se jen při `isLoading` u uživatelů, kteří už bannery dříve měli (příznak v sessionStorage). Obsah tak neskáče.
  - Karusel: časovač podle `display_seconds`. Pauza při najetí, focusu, dotyku a skrytí záložky (`visibilitychange`). Cross-fade 700 ms. Při `prefers-reduced-motion` přepnutí bez animace a bez automatického střídání.
  - Video: `muted playsInline`, bez `controls`, bez `autoplay` atributu. Spouští ho IntersectionObserver (≥50 % viditelné) jen u aktivního snímku. Počítá `ended` a po 2 přehráních zastaví na posteru. Při `navigator.connection.saveData` nebo reduced-motion jen poster. Nikdy zvuk.
  - Odkaz: celý banner je `<a target="_blank" rel="noopener noreferrer">`, jen když je `link_url` https. Jinak `<div>`.
  - Přístupnost: `section aria-roledescription="carousel" aria-label="Oznámení"`, snímky `role="group" aria-roledescription="slide" aria-label="1 z 3"`, tlačítka Předchozí/Další a tečky (cíle ≥ 24 px, viditelný focus), tlačítko pauzy, „×“ s `aria-label="Skrýt oznámení na 7 dní"`, `alt` = `alt_text`, poster video `aria-label`. Ovládání klávesnicí.
- **Vložení** (jen dashboardy, ne úlohy, kvíz, živá hra ani sešit):
  - `src/pages/StudentDashboard.tsx` ř. 125–127: za hlavičku, před `MyLeagueCard`.
  - `src/pages/TeacherDashboard.tsx` mezi hlavičku (ř. 400–410) a mřížku widgetů. Mimo přesouvatelné widgety, aby se neměnilo uložené pořadí.
  - `src/pages/SchoolAdmin.tsx` nad `<Tabs>` (ř. 388). Ředitel / vedení = role `school_admin`. Uvidí bannery pro vedení, a pokud učí, i učitelské.
- Demo účty: stejné chování. RPC vrací jen platformní a jejich školní bannery.
- **Testy** `src/test/banners.test.ts(x)`: stav banneru (5 stavů), skrytí na 7 dní nebo do konce platnosti, poškozené nebo nedostupné localStorage nespadne, časovač respektuje `display_seconds` a pauzu, reduced-motion neposouvá automaticky, saveData nevykreslí `<video>`, video se zastaví po 2 smyčkách, odkaz má `rel="noopener noreferrer"` a jen https.

## Etapa 3 – správa (dvě části, 3a lze nasadit hned po etapě 2)
**3a – minimální formulář platformního admina** (aby učitelka co nejdřív viděla nahrání a zobrazení)
- `src/components/banners/BannerForm.tsx` (sdílený), `src/components/banners/BannerList.tsx`, `src/lib/banner-upload.ts`.
- `src/components/admin/AdminDashboard.tsx` (admin větev, ř. 172–249): přidat kartu „Bannery“. V ní přepínač skupiny Žáci / Učitelé / Vedení, seznam s náhledem, stavem a pořadím, akce Přidat, Upravit, Zapnout/Vypnout, Smazat. Zvlášť seznam školních bannerů s přepínačem „Skrýt“ (`hidden_by_admin`, nic jiného, jinak trigger odmítne).
- Formulář: soubor, alt text (3–200 znaků), odkaz https, doba 3–60 s (výchozí 6), platnost od–do, pořadí, zapnuto, cílení. Živý náhled přes stejnou komponentu `DashboardBanners` v režimu náhledu.
- Klientská validace (`banner-upload.ts`, čisté funkce s testy):
  - Obrázek JPG/PNG/WebP ≤ 3 MB. Rozměry 1500×500, 1584×396 nebo 1920×480 (poměr 3:1 ±2 % nebo 4:1 přesně u dvou dalších formátů).
  - Video `video/mp4` ≤ 3 MB, `duration` ≤ 10 s (přes `<video>` metadata), poměr jako u obrázku. H.264 v prohlížeči spolehlivě neověříme. Zkusí se `canPlayType('video/mp4; codecs="avc1.42E01E"')` a jinak se zobrazí jen upozornění.
  - Poster: povinný. Doporučuji nabídnout „Vytvořit z prvního snímku“: canvas po `seeked` na 0,1 s → WebP/JPEG ≤ 3 MB. Ruční nahrání obrázku zůstane jako možnost.
- Nahrání: nejdřív soubory (nový název, `upsert: false`), potom INSERT/UPDATE řádku. Když zápis řádku selže, smazat právě nahrané soubory. Když výměna souboru uspěje, smazat staré cesty. Při smazání banneru nejdřív smazat řádek, potom soubory (chyba mazání souboru = jen upozornění, ne chyba). Admin smí mazat všude, školní admin jen ve složce své školy (politika ř. 134–137).
- České hlášky: chyby triggeru („…nejvýš 3 aktivní…“) zobrazit doslova. Chyba RLS nebo demo → „Tuto změnu nemáte oprávnění provést.“ Demo účty formulář nevidí (`is_demo_user` v klientu jen skryje UI, ochranu dělá DB).

**3b – záložka „Bannery“ ve SchoolAdmin**
- `src/pages/SchoolAdmin.tsx` ř. 390–400: nový `TabsTrigger value="banners"` a `TabsContent` s `BannerList`/`BannerForm` v režimu školy. Cílení Žáci / Učitelé / Oboje + volitelně Vedení. `scope='school'`, `school_id` = vlastní škola. Skrytý banner zobrazit jako „Skryto správcem platformy“ jen pro čtení přepínače.

**Testy etapy 3**: validace typu, velikosti, rozměrů, délky videa a povinného posteru, https odkaz, rozsah 3–60 s, od < do, převod chyb triggeru na hlášku, pořadí úklidu souborů (selhání zápisu → smazání nového souboru, výměna → smazání starého).

## Migrace
Pro etapy 2 a 3 není potřeba. Volitelně, jen pokud mají bannery „pro vedení“ vidět i zástupci ze `school_leadership_delegates` (ke schválení zvlášť, po ověření sloupců té tabulky):
```sql
-- návrh, neprovádět bez schválení; v get_my_banners() rozšířit "lead":
-- lead := EXISTS(role='school_admin') OR EXISTS(SELECT 1 FROM school_leadership_delegates d
--          WHERE d.user_id = auth.uid() AND d.school_id = me.school_id)
```

## Rizika
- Bez bucketu nahrání selže. Formulář zobrazí „Úložiště bannerů zatím není připravené.“
- Veřejné URL jsou čitelné komukoli s odkazem. Bannery proto nesmí obsahovat osobní údaje (upozornění ve formuláři).
- Limit 3 aktivních hlídá trigger. Klient jen předem upozorní.
- Dashboard učitele: banner leží mimo přesouvatelné widgety, uložené pořadí se nemění.
- Live hry, úlohy, kvíz a sešit komponentu nevkládají.
