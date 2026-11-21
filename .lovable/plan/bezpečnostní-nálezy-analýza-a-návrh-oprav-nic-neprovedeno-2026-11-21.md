# Bezpečnostní nálezy – analýza a návrh oprav (nic neprovedeno)

Zdroj: nejnovější kontrola databáze z 21. 11. 2026 09:33 UTC. Pokročilá kontrola („Advanced checks“) neběžela, takže kód funkcí a stránek tentokrát nikdo neprověřil – stav proto nelze označit za čistý.

## 1. Kritický nález

**Funkce `verify_pin_login` (přihlášení žáka PINem)**
- Co to je: funkce dostane uživatelské jméno a čtyřmístný PIN a při shodě vrátí e-mail a ID účtu. Smí ji volat kdokoli, i bez přihlášení.
- Riziko: PIN má jen 10 000 možností. Útočník zná nebo uhodne jméno žáka a funkci volá přímo, mimo náš přihlašovací formulář a jeho omezení pokusů. Rychle tak PIN uhodne a dozví se e-mail žáka. Také z odpovědí pozná, která jména existují. Jde o skutečný únik údajů žáků. Plný přístup do účtu tím ale nezíská, protože heslo funkce nevrací.
- Ověřeno: aplikace funkci volá jen ze serverové funkce `verify-pin`, a to se servisním oprávněním.
- Oprava (SQL):
  `REVOKE EXECUTE ON FUNCTION public.verify_pin_login(text,text) FROM PUBLIC, anon, authenticated;`
- Dopad: žádný. Přihlášení PINem jde dál přes `verify-pin`. Demo, Studio ani vyhodnocení funkci nepoužívají. Zvlášť ještě ověřím, jestli `verify-pin` omezuje počet pokusů (`login_attempts`), a pokud ne, navrhnu limit.

Skener jako závažný („error“) označil ještě **`creator_payout_target`**. Každý přihlášený uživatel se přes ni dozví, jestli výplatu konkrétního tvůrce dostává on sám, nebo jeho škola, a ID školy. Jde o drobný únik obchodní informace. Funkce se používá jen uvnitř databáze při výpočtu podílů. Oprava: `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated;`. BezliMarket by to nerozbilo, protože interní výpočty běží s právy vlastníka. Tento postup ještě ověřím před provedením.

## 2. Varování

**a) `demo_reset_seed()`** (v původní úrovni závažný, nyní varování)
- Funkce obnovuje ukázkový obsah dema podle uložené zálohy a staví si přitom databázové příkazy z uložených dat. Volat ji může každý přihlášený, ale uvnitř hned odmítne každého, kdo není admin.
- Reálné riziko je dnes nízké: běžný ani demo uživatel ji nespustí. Zbývá teoretické riziko, kdyby někdo podvrhl data v tabulce zálohy (ta je jen pro servis).
- Oprava: `REVOKE EXECUTE ON FUNCTION public.demo_reset_seed() FROM PUBLIC, anon, authenticated;`
- Dopad: aplikace ji z prohlížeče nevolá, demo dál funguje. Ruční obnovu pak půjde spustit jen ze serveru nebo údržbou.

**b) Další varování** (skupina „funkce vrací data z chráněných tabulek“ a „každý přihlášený čte celou tabulku“):
- `teacher_display_names`, `search_teacher_directory`, `find_student_by_code`: vracejí jména a kontakty z profilů. Jde o záměrný adresář učitelů a dohledání žáka podle kódu. Před rozhodnutím ověřím, jestli nevracejí e-mail víc lidem, než je potřeba.
- `school_license_usage_all`, `demo_visible_user_ids`: ověřím, jestli uvnitř kontrolují roli nebo demo pár.
- Tabulky `marketplace_settings`, `learning_methods`, `study_methods`, `avatar_item_base_variants` čte každý přihlášený. Jde o veřejné katalogy a nastavení bez osobních údajů, takže je to nejspíš záměr.

Které dva nálezy stránka Security počítá jako „2 warnings“, z dat přesně nevyčtu. Nejpravděpodobněji jsou to `demo_reset_seed` a jeden z adresářových nálezů.

**Informativní** (nízké riziko, záměrné): veřejné učebnice (`get_public_textbook_*`), ověření certifikátů, `get_my_banners`, `get_my_demo_contact_status`, `get_activity_responses` (u živé hry, kontrola join tokenu), `subject_dependency_counts`, `get_public_content_usage_counts` a výpis souborů ve veřejných úložištích `lesson-images`, `avatar-assets` a `school-logos`. V nich mohou být obrázky z lekcí, ale ne práce žáků.

## 3. Ignorovaný nález
Výsledek kontroly ignorovaný nález ani důvod ignorování neobsahuje, takže ho z dostupných dat neumím přesně určit. Nebudu hádat. V prvním kroku ho dohledám v historii projektu a porovnám s dnešním stavem. Pokud se k ignorování váže důvod, který už neplatí, navrhnu ho obnovit (obnovit ho může jen Kristýna na stránce Security).

## Postup po schválení
1. Jedna migrace se třemi příkazy REVOKE (`verify_pin_login`, `creator_payout_target`, `demo_reset_seed`). Žádné jiné změny.
2. Ověřit čtením, že přihlášení PINem, BezliMarket a demo fungují, a spustit cílené testy.
3. Zvlášť ověřit limit pokusů ve `verify-pin` a funkce z bodu 2b, bez úprav.
4. Spustit novou kontrolu. Nic nenasazovat.

Žádná z navržených oprav nemění demo izolaci, Studio, živé hry ani vyhodnocení.
