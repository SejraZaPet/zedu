Toto je pouze **informační odpověď** (žádné změny v kódu). Shrnutí toho, co jsem v projektu ověřila.

---

## 1) Sekce landing page (pořadí a obsah)

Vstupní bod: `src/pages/Index.tsx`. Pořadí uvnitř `<main>`:

| # | Soubor | Typ obsahu (props/data) | Obrázky |
|---|--------|--------------------------|---------|
| 1 | `src/components/Hero.tsx` | Nadpis „• Tvoř • Uč • Objevuj", podtitulek, 2× CTA tlačítko (`Vyzkoušet zdarma` → `/auth`, `Jak to funguje ↓` scroll), disclaimer text. Pod hero panel se 3 feature kartami (ikona lucide + title + description + volitelný `href`). Data: 3× hardcoded `features[]`. | `@/assets/hero-students.png` (background), `@/assets/zedu-hero-logo-text.png` (nápis v H1) |
| 2 | `src/components/landing/SocialProof.tsx` | 4 metriky (`icon`, `value`, `label`) + 3 badge stringy | žádné |
| 3 | `src/components/landing/FeaturesGrid.tsx` | H2 „Co ZEdu umí" + podtitulek + 6 karet (`icon`, `title`, `description`) | žádné |
| 4 | `src/components/landing/HowItWorks.tsx` (id=`jak-to-funguje`) | H2 „Jak začít?" + podtitulek + 3 kroky (`n`, `title`, `desc`) + CTA tlačítko → `/auth` | žádné |
| 5 | `src/components/landing/ForWhom.tsx` | H2 „Pro koho je ZEdu?" + podtitulek + 3 karty (`icon`, `title`, bullets `string[]`, `cta`, `to`) | žádné (jen ikony) |
| 6 | `src/components/landing/PlatformShowcase.tsx` | H2 „Podívejte se dovnitř" + 4 taby (`Editor učebnice`, `Živá hra`, `Rozvrh`, `Dashboard žáka`); právě teď jen placeholder `ImageIcon` | **placeholder – tady se počítá s obrázky/screenshoty** (1 per tab) |
| 7 | `src/components/PodcastSection.tsx` | H2 „Rozhovory & epizody" + seznam **z DB** (`podcast_episodes`, top 5, status=published). Skryje se, pokud 0 epizod. | žádné |
| 8 | `src/components/landing/FinalCTA.tsx` | H2 „Připraveni učit moderně?" + CTA → `/auth`, sekundární odkaz → `/cenik`, kontaktní e-mail | žádné |

Wrapper `SiteHeader`, `SiteFooter` a plovoucí `AdminButton` nejsou součástí obsahu, které bys chtěla editovat.

---

## 2) Existující vzory pro dynamický/JSONB obsah

**Ne, landing page je aktuálně 100 % statická** – všechna copy jsou hardcoded pole v komponentách (`features`, `steps`, `cards`, `metrics`, `tabs`, `badges`). Jediná dynamická sekce je `PodcastSection`, která se plní z tabulky `podcast_episodes`.

Ale máme **hodně silné vzory JSONB + block editoru** k inspiraci:

- `articles.blocks jsonb` (`ArticlesManager.tsx`), `help_guides` (`content_json jsonb`), `podcast_episodes`, `lesson_plans`, `worksheets`, `teacher_textbook_lessons`, `textbook_lessons` – všechny drží obsah jako pole bloků v `jsonb`.
- **Block editor UI**: `src/components/admin/BlockEditor.tsx` + `src/components/admin/block-editors/*` (`ImageBlock`, `ImageTextBlock`, `GalleryBlock`, `HierarchyBlock`, `ActivityBlock`, …). Podporuje drag&drop řazení, přidávání/mazání bloků, kategorizované menu (Text / Média / Struktura / Interaktivní), inline náhledy.
- Doprovodná typová definice: `src/lib/textbook-config.ts` (`Block` type).
- Podobný „manager" pattern pro CRUD nad JSONB obsahem: `ArticlesManager.tsx`, `HelpGuidesManager.tsx`, `PodcastManager.tsx`.

Pro CMS landing page je nejpřímější vzor **`ArticlesManager` + `BlockEditor`**: jedna admin stránka, která načte řádek, edituje pole `blocks` (drag&drop), a uloží zpět jednou UPDATE-em na JSONB. Přesně tenhle pattern lze recyklovat pro landing – buď jednu řadu v nové tabulce `landing_pages` s `sections jsonb`, nebo tabulku `landing_sections` (řádek = sekce, `order_index`, `type`, `props jsonb`).

---

## 3) Upload obrázků – existující mechanismus

Používáme **Supabase Storage veřejný bucket `lesson-images`** jako obecný veřejně čitelný bucket:

- **RLS** (migrace `20260222164519…`): SELECT pro všechny, INSERT/UPDATE/DELETE jen pro `public.is_admin()`.
- **Upload flow** (nejjednodušší reference `src/components/admin/block-editors/ImageBlock.tsx`, řádky 20-30):
  ```ts
  const path = `${crypto.randomUUID()}.${ext}`;
  await supabase.storage.from("lesson-images").upload(path, file);
  const { data } = supabase.storage.from("lesson-images").getPublicUrl(path);
  onChange({ ...block.props, url: data.publicUrl });
  ```
- **Bohatší varianta s validací** (max 1 MB, kontrola rozměrů, cache-control, upsert): `src/components/school/SchoolBrandingSection.tsx` (bucket `school-logos`, per-school prefix v path).
- **Media Library UI** (přepínání mezi novým uploadem a výběrem již nahraného obrázku): `MediaPickerDialog` z `src/components/media/`. Řeší i tag/hledání. Dá se přímo použít.

Další existující veřejné buckety a jejich účel (pro orientaci, ne pro landing):
- `school-logos` – loga škol
- `student-attachments` – přílohy k odevzdaným úkolům (privátní)
- `student-portfolio` – portfolio žáků

**Doporučení pro landing CMS**: buď recyklovat `lesson-images` (rychlé, RLS už restriktivní na admina), nebo vytvořit nový bucket `landing-media` se stejnou strukturou politik (SELECT public, mutace jen `is_admin()`). Druhá varianta je čistší – budeš mít oddělenou životnost obrázků landing page od učebnic a snadnější správu.

---

## Krátký návrh, jak by CMS mohl vypadat (jen náčrt – bez implementace)

- Tabulka `landing_sections` (`id`, `order_index`, `section_type` enum: hero / features_grid / how_it_works / for_whom / platform_showcase / social_proof / final_cta / podcast, `enabled bool`, `props jsonb`, `updated_at`, `updated_by`).
- Admin stránka `/admin/landing`: seznam sekcí s drag handle, per-sekce editor formulář odvozený od `section_type` (podobný `BlockEditor` menu), toggle „zobrazit/skrýt", tlačítka přidat/duplikovat/smazat.
- Runtime: `Index.tsx` načte řádky, řadí podle `order_index`, mapuje `section_type` na existující komponentu, do které pošle `props` (aktuální hardcoded pole se přesunou do defaultních `props` v DB seed migraci).
- Obrázky: `MediaPickerDialog` + bucket `landing-media`.
- Ikony: seznam allowlist z `lucide-react` v `<Select>` (protože ikony teď nejsou stringy, ale komponenty – v CMS je budeme identifikovat jménem a mapovat na komponentu při renderu).

Až budeš chtít, můžu z toho udělat plný implementační plán.
