# Inline Edit Mode pro Landing Page

Nadstavba nad existujícím `landing_sections` + `SECTION_EDITORS`. Žádná změna DB vrstvy, žádná změna produkčního rendereru pro veřejné návštěvníky — jen nová editační UI vrstva, která se aktivuje pro adminy.

## Rozhodnutí: Batch vs. autosave (bod 3)

**Volím batch model** ("Uložit / Zrušit" lišta dole) přesně jak popisuješ. Důvody:

- Draft je jednoduše `Record<sectionId, props>` v jednom Contextu — inline i panel do něj zapisují stejně. Autosave by vyžadoval per-field debounce, řešení race conditions a nejasné UX ("uložilo se to už, když jsem odjel z pole?").
- Uživatel často upravuje víc věcí v jedné sekci najednou (nadpis + subtitle + tlačítko) — batch = jedno psychologické "commitnutí".
- "Zrušit" je jasné: zahoď draft, refetch z DB. Autosave by "Zrušit" v podstatě neuměl.
- Reordering/add/delete zůstává immediate (jako v existujícím `LandingPageManager`) — jsou to strukturální akce, ne obsahové drafty; míchat je do batch commitu by komplikovalo UX.

## Architektura

```text
<LandingEditModeProvider>            ← nový Context (isEditMode, draft, dirty sections, actions)
  <Index />
    <SiteHeader />
    <AdminEditToggle />               ← nové tlačítko (jen is_admin)
    <main>
      {sections.map(s =>
        <EditableSectionWrapper section={s}>   ← v edit módu: outline, drag handle, tužka, delete
          <SectionBetween />                   ← "+" tlačítko mezi sekcemi
          <Component props={draft[s.id] ?? s.props} />   ← živý náhled z draftu
        </EditableSectionWrapper>
      )}
    </main>
    <EditModeFloatingBar />           ← jen v edit módu: Uložit / Zrušit + počet dirty
    <EditModeSidePanel />             ← Sheet zprava se SECTION_EDITORS pro aktivní sekci
</LandingEditModeProvider>
```

## Nové soubory

- `src/contexts/LandingEditModeContext.tsx` — provider + hook `useLandingEditMode()`. State: `isEditMode`, `draft: Record<string, any>`, `activePanelSectionId`, `enterEditMode()`, `exitEditMode()`, `setDraftProps(id, props)`, `getEffectiveProps(section)`, `saveAll()`, `discardAll()`, dirty count. Provider vloží kolem `Index` v `App.tsx` nebo přímo v `Index.tsx`.
- `src/components/landing-edit/AdminEditToggle.tsx` — pill tlačítko "Upravit stránku" (fixed top-right, jen když `useAdmin() === true` a mimo edit mód). V edit módu skryto (Floating Bar převezme).
- `src/components/landing-edit/EditableSectionWrapper.tsx` — obalí každou sekci. V edit módu: přerušovaný outline na hover, tužka v rohu (otevře side panel), drag handle vlevo, delete v pravém horním rohu s AlertDialog. Mimo edit mód: passthrough (žádný DOM overhead).
- `src/components/landing-edit/InlineTextField.tsx` — klikací contentEditable pro string pole. Používá se přes `InlineEditContext` — komponenty jako `Hero`, `FinalCTA` atd. dostanou pomocníka `useInlineField(section, path)` a když je edit mód aktivní, obalí text tímto komponentem; jinak vrátí čistý string. Aby se nemuselo přepisovat 8 komponent, řešíme přes malý helper `<Editable path="subtitle">{p.subtitle}</Editable>` renderovaný tam, kde jsou triviální stringy (title, subtitle, disclaimer, tlačítkové labely). Enter/blur → `setDraftProps`.
- `src/components/landing-edit/EditModeFloatingBar.tsx` — fixed bottom bar. Zobrazuje "N neuložených změn", "Uložit" (batch update per dirty section), "Zrušit" (discard + refetch), "Ukončit editaci".
- `src/components/landing-edit/EditModeSidePanel.tsx` — shadcn `Sheet` side=right, uvnitř `SECTION_EDITORS[type]` napojený na draft (value = effective props, onChange = setDraftProps). Reuse beze změny.
- `src/components/landing-edit/BetweenSectionsInsert.tsx` — 2px pruh mezi sekcemi, na hover se rozšíří na "+" tlačítko → picker section_type (reuse `AddSectionDialog`) → insert do DB s `order_index` mezi sousedy (avg × 10 shift pokud kolize) → invalidate.
- `src/components/landing-edit/useSectionDnd.ts` — helper hook, který obalí sekce v `DndContext` + `SortableContext` a při dropu volá immediate update `order_index` (stejná logika jako `LandingPageManager`).

## Změny existujících souborů

- `src/pages/Index.tsx` — obalit provider, nahradit prostý `sections.map` za DnD kontejner s `EditableSectionWrapper`. V ne-edit módu vypadá identicky.
- `src/components/Hero.tsx`, `SocialProof.tsx`, `FeaturesGrid.tsx`, `HowItWorks.tsx`, `ForWhom.tsx`, `PlatformShowcase.tsx`, `FinalCTA.tsx` — kolem string polí obalit `<Editable path="…">{p.xxx}</Editable>`. Když není edit mód, `Editable` vyrenderuje `<>{children}</>` — nulový overhead. Podcast sekce: jen wrapper title, epizody se dál needitují inline.
- `src/components/AdminButton.tsx` — beze změny, `AdminEditToggle` je vedle.
- `src/hooks/useLandingSections.ts` — přidat mutation helper (nebo použít existující `supabase.from(...)` přímo v Contextu).

## Draft flow (batch save)

1. Vstup do edit módu → snapshot aktuálních `props` per sekce zůstává v React Query cache; `draft` je prázdný `{}`.
2. Inline změna nebo změna v panelu → `setDraftProps(sectionId, newProps)` → `draft[sectionId] = newProps`.
3. Render všech sekcí čte `draft[id] ?? section.props` → živý náhled.
4. **Uložit**: `for (const [id, props] of Object.entries(draft)) update landing_sections`. Paralelní `Promise.all`. Po úspěchu: invalidate, `draft = {}`, toast.
5. **Zrušit**: `draft = {}`, invalidate (refetch produkčního stavu), toast.
6. Reorder / delete / insert → immediate DB write + invalidate (nedotýkají se draftu).

## UX detaily

- Outline v edit módu: `outline-2 outline-dashed outline-primary/40` na hover celé sekce, `outline-primary` když má dirty draft.
- Tužka + drag handle + delete jsou v malém floating toolbaru v pravém horním rohu sekce (absolute), viditelném na hover.
- Inline editace: `contenteditable="plaintext-only"`, Enter potvrdí, Shift+Enter přidá `\n`, Escape zahodí, klik mimo = commit do draftu.
- Side panel má vlastní "Zavřít" tlačítko (změny už jsou v draftu, ale ještě neuložené globálně).
- Před opuštěním stránky s dirty draftem `beforeunload` prompt.
- Floating bar sticky bottom, `z-50`, backdrop blur, výrazné "Uložit" tlačítko (brand gradient).

## Bezpečnost

RLS z Fáze 1 už zajišťuje, že non-admin nemůže mutovat. `is_admin()` check v `AdminEditToggle` jen skrývá UI. Server je autoritativní.

## Postup implementace (menší kroky, potvrzuji po každém)

1. **Krok 1** — Context + toggle + Floating Bar + shell: přepnutí edit módu funguje, sekce dostanou dashed outline na hover, "Uložit / Zrušit" jsou zatím no-op. **Cíl: proof of concept UI.**
2. **Krok 2** — Inline editace stringů (Hero + FinalCTA jako první): `<Editable>` helper + draft flow + batch save reálně píše do DB. **Cíl: nejjednodušší e2e loop.**
3. **Krok 3** — Rozšíření `<Editable>` na zbylé sekce (SocialProof texty, FeaturesGrid, HowItWorks, ForWhom, PlatformShowcase, Podcast title).
4. **Krok 4** — Side panel s reuse `SECTION_EDITORS` napojený na draft (živý náhled).
5. **Krok 5** — Drag&drop pořadí + insert mezi sekcemi + delete (všechny immediate, mimo draft).
6. **Krok 6** — Polish: `beforeunload` prompt, keyboard shortcuts (Esc opustí edit mód pokud čistý draft), dirty indikátor per sekce.

Po každém kroku napíšu, co je hotové, a počkám na "pokračuj".

## Otevřené otázky (můj default)

- **Obrázky (`background_image_url`, `logo_image_url`) inline?** Můj default: **ne**, obrázky se mění jen přes side panel (reuse `LandingImageInput`). Inline editace obrázků by chtěla samostatný overlay a přidá to komplexitu bez velké přidané hodnoty.
- **Podcast epizody?** Zůstávají spravované přes vlastní `PodcastManager`, jak jsi řekla v Fázi 1.
