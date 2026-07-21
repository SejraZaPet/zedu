# Per-kategorie barvení v Avatar editoru

## Cíl
Zrušit samostatné kategorie **Barva pleti** (`skin_tone`) a **Barva vlasů** (`hair_color`) z levého menu. Místo toho u každé barvitelné kategorie (`base`, `hairstyle`, `outfit`, `face_accessory`, `head_accessory`) zobrazit v panelu položek paletu 8–10 předdefinovaných teček + tlačítko „vlastní barva" (nativní `<input type="color">`). Barva se ukládá per-kategorie.

## Odpovědi na otázky

### 1. DB schéma `avatar_profiles`
Přidat 5 nullable sloupců `text` (hex `#RRGGBB`), neinvazivní migrace:

```sql
ALTER TABLE public.avatar_profiles
  ADD COLUMN IF NOT EXISTS base_color            text,
  ADD COLUMN IF NOT EXISTS hairstyle_color       text,
  ADD COLUMN IF NOT EXISTS outfit_color          text,
  ADD COLUMN IF NOT EXISTS face_accessory_color  text,
  ADD COLUMN IF NOT EXISTS head_accessory_color  text;
```

Backfill ze staré logiky (aby uživatelé nepřišli o vybrané barvy):

- `base_color`   ← `color_value` položky odkazované ze `skin_tone_id`
- `hairstyle_color` ← `color_value` položky odkazované ze `hair_color_id`

Staré sloupce `skin_tone_id` a `hair_color_id` zůstávají v tabulce jako **legacy read-only fallback** (nemažeme, jen na ně přestaneme zapisovat). Riziko rozbití starých dat = 0.

### 2. Osud kategorií `skin_tone` a `hair_color` v `avatar_items`
Nemazat. Fáze 1: `UPDATE avatar_items SET is_active = false WHERE category IN ('skin_tone','hair_color')` — položky přežijí jako historický seed pro palety (vytáhneme z nich hex hodnoty do defaultních swatchů) a zůstanou pro případný rollback. V UI se přestanou renderovat, protože `CATEGORY_META` je nebude obsahovat a načítací dotaz filtruje `is_active = true`. Případný pozdější `DELETE` může přijít po ověření migrace v produkci.

### 3. Dopad na sdílené komponenty

**`AvatarLayerStack.tsx`** — zobecnit: `StackLayer` dostane volitelnou `tintColor: string | null` (místo dnešního specifického `hairColor` / `skinTone`). Rendering podmínku `if (item.category === "hairstyle" && hairColor) … else if (item.category === "base" && skinTone) …` nahradit generickou větví „když `tintColor` != null, použij `hairTintFromHex(tintColor)` (filter + volitelný mask overlay)". `hairTintFromHex` zůstává beze změny — už teď je category-agnostic.

**`AvatarItemsManager.tsx`** (admin) — sjednotit:
- Odstranit z formuláře speciální UI pro kategorie `skin_tone` / `hair_color` (color picker vázaný na položku). Zůstane základní CRUD pro případné historické editace, ale kategorie se v selectu označí jako `(deprecated)`.
- Kalibrační živý náhled dál používá `AvatarLayerStack`, takže po jeho zobecnění admin automaticky ukazuje totéž co produkce — bez další práce.

**`ProfileAvatarBubble.tsx`** — čte nové sloupce `*_color` z `avatar_profiles` a předává je jako `tintColor` do odpovídajících vrstev. Legacy fallback: pokud `hairstyle_color` je `null` ale `hair_color_id` existuje, použije `color_value` staré položky (jednorázově dokud backfill nedoběhne).

### 4. Rozsah a rizika

**Rozsah** (5 souborů + 1 migrace + 2 nové soubory):

| Soubor | Změna |
|---|---|
| migrace | přidat 5 sloupců, backfill, `is_active=false` |
| `src/lib/avatar-palettes.ts` | **nový** – definice palet per kategorii |
| `src/components/avatar/ColorPalette.tsx` | **nový** – swatch grid + `<input type="color">` |
| `src/components/avatar/AvatarLayerStack.tsx` | `hairColor`+`skinTone` → generic `tintColor` |
| `src/components/profile/ProfileAvatarBubble.tsx` | číst nové sloupce, mapovat per-kategorie tint |
| `src/pages/AvatarEditor.tsx` | odebrat `skin_tone`+`hair_color` z `CATEGORY_META`, vložit `<ColorPalette>` panel do každé barvitelné kategorie, ukládat do nových sloupců |
| `src/components/admin/AvatarItemsManager.tsx` | deprecated labely, cleanup |

**Palety (návrh):**
- `base` (pleť): 6 tónů od nejsvětlejšího po nejtmavší
- `hairstyle` (vlasy): černá, tmavě hnědá, hnědá, blond, zrzavá, šedá, + brand tyrkysová + brand fialová (special edition)
- `outfit`, `face_accessory`, `head_accessory`: neutrální paleta (černá/bílá/šedá + 4 brand akcenty)
- Vše doplněné tlačítkem „Vlastní barva" → `<input type="color">`

**Rizika:**
- **Nízké — data:** nové sloupce jsou additive; staré `*_id` sloupce zůstávají. Rollback = přestat zapisovat do nových sloupců.
- **Střední — UX konzistence:** uživatelé mají dnes zvolenou barvu vlasů globálně; backfill musí proběhnout před nasazením FE, jinak přijdou o výběr. Řešeno v jedné migraci.
- **Nízké — rendering:** `hairTintFromHex` je už deterministický a category-agnostic; zobecnění `AvatarLayerStack` je čistě refactor beze změny výstupu pro existující kombinace.
- **Nízké — admin:** kalibrace se nezmění, protože stack komponenta je sdílená.

## Postup implementace
1. Migrace (sloupce + backfill + deaktivace starých kategorií).
2. `avatar-palettes.ts` + `ColorPalette.tsx`.
3. Refaktor `AvatarLayerStack` na `tintColor`.
4. `ProfileAvatarBubble` – nové sloupce s legacy fallbackem.
5. `AvatarEditor` – odebrat 2 kategorie z menu, přidat paletu do panelu položek, přepsat `save()` na nové sloupce.
6. `AvatarItemsManager` – deprecated značky.
7. Smoke test: nový uživatel, existující uživatel se starou volbou pleti/vlasů, admin kalibrace.
