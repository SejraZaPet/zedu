## Nález

1. **Strategie pro JS / JS moduly**
   - `public/sw.js` obsluhuje `/assets/`, `/icons/`, `/manifest.json`, favicons přes **NetworkFirst**.
   - Není to `CacheFirst` ani `StaleWhileRevalidate`: SW nejdřív zkouší síť, při selhání vrací cache.
   - To znamená: pokud je síť dostupná a server vrací nový bundle, SW by neměl úmyslně držet starý JS. Pokud ale vrací starý HTML/shell nebo je SW/registrace zaseknutá, cache se může projevit jako stale kód.

2. **Verze cache**
   - Cache verze je natvrdo `CACHE_VERSION = "zedu-v2"`.
   - V aktuálním kódu není žádný build/deploy hash ani automatické navýšení verze při změně aplikace.
   - `activate` maže jen cache, které nezačínají aktuálním `zedu-v2`, takže při dalších deployích se stejnou verzí nedojde k invalidaci existujících `zedu-v2-runtime` / `zedu-v2-precache` cache.

3. **Force-update mechanismus**
   - SW volá `self.skipWaiting()` při instalaci a `self.clients.claim()` při aktivaci.
   - V aplikaci ale není vidět UI typu „nová verze dostupná“, žádné volání `registration.update()`, žádná řízená update flow přes `controllerchange`.
   - Registrace v `src/main.tsx` pouze registruje `/sw.js`; v preview/iframe se snaží registrace odregistrovat.

## Závěr

Service worker je **pravděpodobný systémový rizikový faktor**, protože cache verze se nemění po deployi a aplikace nemá explicitní update flow. Samotná strategie pro JS je sice NetworkFirst, ale současný ruční SW je křehký: pokud prohlížeč stále běží pod starým SW / starým runtime cache stavem, uživatel může opakovaně vidět starý kód i po refreshi.

Pro urgentní diagnostiku konkrétní uživatelky je nejrychlejší ověření:

- DevTools → Application → Service Workers → **Unregister**
- DevTools → Application → Storage → **Clear site data** pro `zedu.cz`
- zavřít všechny taby ZEdu
- otevřít znovu a spustit import

Pokud po tom začne `extractPdfText()` vracet nenulový `length`, SW/cache byl potvrzen jako viník.

## Doporučená trvalá oprava

Navrhuji nechat push notifikace zachované, ale odstranit aplikační app-shell caching ze současného ručně psaného SW, protože nyní míchá dvě role:

- push notification worker,
- PWA/offline/cache worker.

### Implementační plán po schválení

1. **Dočasná bezpečná oprava pro produkci**
   - Upravit `public/sw.js` tak, aby dál obsahoval `push` a `notificationclick` handlery.
   - Odstranit nebo vypnout `fetch` handler pro HTML a JS/CSS assety, aby SW už nikdy neservíroval starý app shell ani starý bundle.
   - V `activate` opatrně smazat jen vlastní staré cache `zedu-*`, ne cache jiných workerů.
   - Ponechat `skipWaiting()` + `clients.claim()`.

2. **Registrační wrapper v aplikaci**
   - Upravit `src/main.tsx` tak, aby při načtení aplikace volal `registration.update()` pro `/sw.js`.
   - V preview/iframe/dev prostředí nadále unregister matching `/sw.js`, aby editor nebyl ovlivněn stale SW.

3. **Volitelný budoucí krok, pokud chcete skutečný offline režim**
   - Přestavět offline caching na řízenou PWA implementaci přes `vite-plugin-pwa` podle bezpečných pravidel.
   - Offline režim nepřidávat v této opravě, protože aktuální problém je stale produkční JS a push notifikace.

## Pro uživatelku teď

Doporučuji nejdřív ruční unregister/clear-site-data jako diagnostický test. Pokud se tím problém potvrdí, nasadíme trvalou opravu výše, aby se stale bundle neopakoval u produkčních uživatelů po dalších deployích.