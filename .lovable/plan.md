# Plán: Per-kategorie barvení v AvatarEditoru

Zrušit samostatné kroky "Barva pleti" a "Barva vlasů" a přesunout výběr barvy přímo pod náhled/položku každé barvitelné kategorie (base, hairstyle, outfit, face_accessory, head_accessory). Barva se ukládá per-kategorie jako hex řetězec.

## 1. DB schéma (bez rozbití dat)

Migrace na `avatar_profiles` — přidat nullable text sloupce (uloží hex `#RRGGBB` nebo NULL = bez tintu):

```
ALTER TABLE public.avatar_profiles
  ADD COLUMN base_color            text,
  ADD COLUMN hairstyle_color       text,
  ADD COLUMN outfit_color          text,
  ADD COLUMN face_accessory_color  text,
  ADD COLUMN head_accessory_color  text;
```

Backfill ze staré struktury, aby uživatelé neztratili barvu, kterou už mají vybranou:

```
UPDATE public.avatar_profiles p SET
  base_color      = (SELECT color_value FROM avatar_items WHERE id = p.skin_tone_id),
  hairstyle_color = (SELECT color_value FROM avatar_items WHERE id = p.hair_color_id);
```

Staré sloupce `skin_tone_id` a `hair_color_id` **necháváme** (nullable) v prvním kole — nulové riziko regrese, a případný rollback je triviální. Ve druhém, oddělěném cleanup kroku (po ověření v produkci) je můžeme dropnout spolu s daty v `avatar_items`.

## 2. `avatar_items` — kategorie `skin_tone` a `hair_color`

Nemažeme řádky. Nastavíme `is_active = false` pro `category IN ('skin_tone','hair_color')`. Důvody:
- Zpětná kompatibilita s starými profily, dokud nedoběhne backfill a nevymažeme staré sloupce.
- Předdefinované hex hodnoty z těchto řádků použijeme jako zdroj pravdy pro paletu (viz níže) — nemusíme je hardcodovat v kódu.
- Admin UI (AvatarItemsManager) je bude nadále umět editovat, ale ve výběrech pro studenty se neobjeví (filtrujeme `is_active = true`).

## 3. Paleta barev v editoru

Nová sdílená komponenta `src/components/avatar/ColorPalette.tsx`:
- Props: `value: string | null`, `onChange: (hex: string | null) => void`, `swatches: string[]`, `allowClear?: boolean`.
- Render: 8-10 kulatých swatchů + tlačítko "Vlastní" (`<input type="color">`) + volitelně tlačítko "Bez barvy" (`null`).
- A11y: role=radiogroup, klávesnicová navigace, `aria-label` s hex hodnotou.

Palety per-kategorie definujeme v `src/lib/avatar-palettes.ts`:
- `HAIR_SWATCHES` — přirozené (černá, tmavohnědá, hnědá, blond, zrzavá, šedá, bílá) + 2 fantasy (fialová, tyrkysová).
- `SKIN_SWATCHES` — realistické odstíny pleti.
- `OUTFIT_SWATCHES`, `ACCESSORY_SWATCHES` — brand + neutrály.
Seed pro tyto konstanty: přečteme `color_value` z existujících `skin_tone` a `hair_color` řádků (jednorázově, nekopírujeme runtime).

V `AvatarEditor.tsx`:
- Odebrat `skin_tone` a `hair_color` z `CATEGORIES`.
- Levé menu tedy: Barva pleti mizí → nahrazena barvou uvnitř kroku `base`; krok `hair_color` mizí úplně.
- V panelu položek každé barvitelné kategorie renderovat pod gridem položek `<ColorPalette>` s hodnotou `profile[<cat>_color]` (viz mapa níže) a callbackem, který ji uloží do lokálního draftu profilu.
- Kategorie bez obrázkové vrstvy (background, frame, effect, badge) paletu nemají.

Mapa kategorie → sloupec:
```
base              -> base_color
hairstyle         -> hairstyle_color
outfit            -> outfit_color
face_accessory    -> face_accessory_color
head_accessory    -> head_accessory_color
```

Save flow: `avatar_profiles` upsert dostane i nové `*_color` sloupce; staré `skin_tone_id`/`hair_color_id` do save nezasahujeme (a v UI je už nikdo nemění).

## 4. Rendering — `AvatarLayerStack.tsx`

Zobecníme tint:
- `StackLayer` dnes má `hairColor` a `skinTone`. Nahradíme jedním polem `tintColor?: string | null` per-layer.
- `AvatarLayer` aplikuje `hairTintFromHex(tintColor)` bez ohledu na kategorii, pokud je `tintColor` neprázdný a layer má `src`. Existující matematika (brightness/contrast + volitelný `mix-blend-mode: color` overlay maskovaný přes obrázek) zůstává — jen se přestěhuje z kategorie-specifické větve do univerzální.
- Volání v `AvatarEditor` a `ProfileAvatarBubble`: při skládání `layers` každé vrstvě přiřadíme `tintColor = profile[<category>_color] ?? null`. Pro kategorie bez tint sloupce (background, frame, effect) je to prostě `null`.

Frame/effect/background zůstávají nedotčeny (nejsou tintovatelné).

## 5. Admin — `AvatarItemsManager.tsx`

- V select filtru kategorií nechat `skin_tone` a `hair_color` viditelné (admin je pořád může spravovat kvůli seedu palety), ale doplnit vizuální označení "deprecated" u nich.
- Kalibrační panel a ostatní logika zůstávají beze změny. Žádná další úprava tam nepotřebná — barva se teď nastavuje na profilu, ne na položce.

## 6. `ProfileAvatarBubble.tsx`

- Select z `avatar_profiles` rozšířit o `base_color, hairstyle_color, outfit_color, face_accessory_color, head_accessory_color`.
- Stáhnout `skin_tone_id`/`hair_color_id` fetch (nebo zachovat jako read-only fallback pro profily bez backfillu — bezpečnější).
- Při buildu `layers` přiřadit `tintColor` z odpovídajícího sloupce; pokud je NULL a existuje starý `*_id`, fallback na `color_value` toho item (dočasně, dokud staré sloupce žijí).

## 7. Rozsah a rizika

**Rozsah:** střední. Dotčené soubory:
- Migrace: 1 (přidání sloupců + backfill + deaktivace starých itemů).
- Nové: `ColorPalette.tsx`, `avatar-palettes.ts`.
- Upravené: `AvatarEditor.tsx` (největší kus — kroky, save, render), `AvatarLayerStack.tsx` (zobecnění tintu), `ProfileAvatarBubble.tsx` (fetch + render).
- `AvatarItemsManager.tsx`: minimum (jen štítek "deprecated").

**Rizika:**
- **Ztráta barvy u existujících uživatelů** — mitigace přes backfill v migraci a přes fallback čtení `*_id` v prvním kole.
- **Types** (`src/integrations/supabase/types.ts`) se regeneruje po migraci; kód, který stále čte `skin_tone_id`/`hair_color_id`, poběží dál (sloupce necháváme).
- **Realtime konzistence** admin ↔ editor ↔ bubble — `AvatarLayerStack` je jediný zdroj pravdy pro tint, takže po zobecnění by měly být všechny tři pohledy identické. Ověříme vizuálně headless Playwrightem po implementaci.
- **A11y** — nový color picker (radiogroup + native input) potřebuje label a fokus management.

## Deferred / mimo tento plán
- Fyzické mazání `skin_tone`/`hair_color` řádků z `avatar_items` a drop starých sloupců v `avatar_profiles` — až v samostatné cleanup migraci po ověření.
- Rozšíření palety o "avatar item"-level constrainty (např. accessory, který se nedá tintovat) — pokud takové existují, přidáme příznak `tintable: boolean` na `avatar_items` v následné iteraci.
