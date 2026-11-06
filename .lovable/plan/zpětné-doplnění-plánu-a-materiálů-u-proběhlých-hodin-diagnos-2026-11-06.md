# Zpětné doplnění plánu a materiálů u proběhlých hodin (diagnostika + návrh)

## 1) Co dnes u proběhlých hodin chybí (ověřeno v kódu)
- Karta v „Co jsme probrali“ (`TeacherSubjectClass.tsx` ř. 1430–1518) ukazuje jen štítek „Plán: …“ / „Bez plánu hodiny“, téma, sponku, „Otevřít“ (jen když plán je) a „Přidat reflexi“. Tlačítka **Přiřadit / Nový / Změnit** jsou napsaná jen v kartě „Co nás čeká“ (ř. 1584–1646). Žádná podmínka je neskrývá, u minulých hodin prostě chybí.
- Dialog „Přiřadit existující plán“ (ř. ~2185–2200) nabízí v poli termínu jen `upcomingLessons`. Proběhlou hodinu v něm vybrat nejde.
- Propojení samo na datu nezávisí: `assignPlanToDate`, `unlinkPlanFromDate` a `plan-linked-slots.ts` (`slotMatches`, `removeSlotsForLesson`, `inputDataWithoutLesson`) pracují s libovolným `date` v `input_data.linkedSlots`. `findPlanForDate` už u minulých hodin plán najde a ukáže (proto se u některých zobrazuje „Plán: …“). Pro minulé datum tedy funguje, chybí jen ovládání.
- „Nový plán“ (`newLessonPlan(date)`) předává `?date=`. Editor plánu minulé termíny výslovně podporuje (`TeacherLessonPlanEditor.tsx` ř. 230 „i v minulosti“, `pastDates` 8 týdnů zpět).
- Žák: v „Co jste probrali“ už vidí plány přiřazené k té hodině (`StudentLessonPlanCard`, `slotPlans`). Plán doplněný zpětně se mu tedy ukáže bez další změny.

## 2) Sponka – co dnes připíná
- Ukládá `lesson_topics.materials` (jsonb) pro danou třídu/skupinu + předmět + datum, přes `saveLessonTopic`. Funguje i pro minulá data.
- Editor `AssignmentMaterialsEditor` umí jen dva druhy (`AssignmentMaterial.kind`): **odkaz** (URL) a **nahraný soubor** (bucket `assignment-materials`). Učebnici, pracovní list, aktivitu ani prezentaci z knihovny vybrat neumí, jen ručně vložit odkaz.
- Žák u proběhlé hodiny vidí sponku s počtem a otevře materiály. Čtení: RLS `lesson_topics` „Class members can view“ (člen třídy/skupiny) + „Teachers manage own“.
- Nepřímá cesta už existuje: materiály navázané na **plán** (`plan-links.ts`: pracovní listy `worksheet_ids`, lekce učebnice `lesson_ref_id`, prezentace, úkoly s `lesson_plan_id`) se ukazují jako ikony `PlanLinkIcons`. Po zpětném přiřazení plánu se tak u hodiny objeví i jeho materiály.

## 3) Návrh
### A. Plán u proběhlé hodiny (čistě frontend)
- Na kartě proběhlé hodiny stejné ovládání jako u „Co nás čeká“: bez plánu **Přiřadit** + **Nový**, s plánem **Otevřít** + **Změnit** (Přiřadit jiný plán / Nový plán / Odebrat plán z hodiny s potvrzením). Vytáhnout do společné komponenty `LessonPlanActions`, aby obě karty používaly stejný kód.
- Dialog přiřazení: termín nabídne i proběhlé hodiny (skupina „Proběhlé“, posledních 8 týdnů jako editor plánu). Při otevření z karty je datum předvyplněné.
- Chování zůstane stejné jako u budoucích hodin: odpojení stejného termínu z ostatních vlastních plánů, srozumitelná chyba u cizího plánu.
- Mobil: tlačítka se zalomí na nový řádek, cíle ≥44 px, karta bez vodorovného posunu na 390 px.

### B. „Propojit materiály“ (doporučuji bez DB)
- Sponku přejmenovat na tlačítko **„Materiály“** (ikona + počet). V dialogu vedle Odkaz/Soubor nová záložka **„Z mé knihovny“**: vyhledávání ve vlastních pracovních listech, prezentacích, aktivitách (šablony her) a lekcích učebnic přiřazených třídě.
- Uložení do stávajícího `lesson_topics.materials` jako nový druh položky `{ kind: "content", contentType: "worksheet" | "presentation" | "activity" | "textbook_lesson", refId, title }`. Starší položky (odkaz/soubor) se nemění. Starý kód neznámý druh přeskočí, je potřeba upravit `normalize` v `assignment-materials.ts`.
- Žák: u proběhlé hodiny uvidí položky z knihovny jen tehdy, když mu je stávající oprávnění dovolí načíst (dotaz pod jeho přihlášením). Co nesmí vidět (soukromý list, nezveřejněná lekce), se mu **nezobrazí**. Žádná nová práva nevznikají. Učitel u položky vidí poznámku „Žáci nevidí – není zveřejněno“.
- Otevření: pracovní list/lekce/prezentace přes stávající žákovské cesty. Aktivita jen učiteli (spuštění hry), žákovi se nezobrazí.

## 4) Frontend vs. databáze
- **Vše výše jde bez změny databáze**: plán = `linkedSlots`, materiály = nový druh v existujícím jsonb `lesson_topics.materials`.
- Samostatná tabulka vazeb by dávala smysl jen pro reporty typu „kde všude jsem tento list použila“ nebo pro přímé omezení v databázi. Pro tento požadavek nedoporučuji. Návrh pro případ potřeby (**NESPOUŠTĚT**):

```sql
CREATE TABLE public.lesson_material_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL DEFAULT auth.uid(),
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.subject_groups(id) ON DELETE CASCADE,
  subject_key text NOT NULL,
  lesson_date date NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('worksheet','presentation','activity','textbook_lesson')),
  content_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((class_id IS NULL) <> (group_id IS NULL)),
  UNIQUE (teacher_id, class_id, group_id, subject_key, lesson_date, content_type, content_id)
);
CREATE INDEX lml_ctx_idx ON public.lesson_material_links (class_id, group_id, lesson_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_material_links TO authenticated;
GRANT ALL ON public.lesson_material_links TO service_role;
ALTER TABLE public.lesson_material_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY lml_teacher ON public.lesson_material_links FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY lml_student_read ON public.lesson_material_links FOR SELECT TO authenticated
  USING ((class_id IS NOT NULL AND EXISTS (SELECT 1 FROM class_members cm WHERE cm.class_id = lesson_material_links.class_id AND cm.user_id = auth.uid()))
      OR (group_id IS NOT NULL AND EXISTS (SELECT 1 FROM subject_group_members s WHERE s.group_id = lesson_material_links.group_id AND s.student_id = auth.uid())));
CREATE POLICY demo_iso ON public.lesson_material_links AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT is_demo_user() OR demo_can_see_owned(teacher_id))
  WITH CHECK (NOT is_demo_user() OR demo_can_see_owned(teacher_id));
-- Rollback: DROP TABLE IF EXISTS public.lesson_material_links;
```
Samotný obsah (list, lekce) by žák stejně četl jen podle jeho vlastních pravidel. Před případnou migrací ověřím signatury `demo_can_see_owned` a sloupce `subject_group_members`.

## 5) Etapy, soubory, rizika
**Etapa 1 – plán u proběhlých hodin (FE, malé riziko)**
- `src/pages/TeacherSubjectClass.tsx` (karta minulé hodiny, dialog s proběhlými termíny)
- nový `src/components/subject-class/LessonPlanActions.tsx` (sdílené Přiřadit/Nový/Změnit)
- čistá funkce `assignableLessonDates(occurrences, now)` v `src/lib/plan-linked-slots.ts` + testy (minulé v nabídce, zrušené ne, 8 týdnů)
- Riziko: přiřazení na špatné datum. Ochrana: předvyplněné datum z karty a odpojení stejného termínu z jiných plánů, jako dnes.

**Etapa 2 – materiály z knihovny (FE, střední riziko)**
- `src/lib/assignment-materials.ts` (nový druh `content`, normalize), `AssignmentMaterialsEditor.tsx` (záložka „Z mé knihovny“, použít jen v dialogu hodiny, ne u úkolů)
- nový `src/components/subject-class/LibraryMaterialPicker.tsx`
- `StudentSubjectClass.tsx` (zobrazit jen načitatelné položky)
- testy: uložení položky, starší data beze změny, žák nevidí nezveřejněné
- Rizika: `AssignmentMaterial` používají i úkoly. Nový druh se proto povolí jen pro materiály hodiny a úkoly ho ignorují. Mrtvé odkazy po smazání listu se zobrazí jako „Materiál už není dostupný“.

Nic se nemění na rozvrhu, tématech, reflexích, úkolech, oprávněních ani demo ochraně.

## Na co se rozhodnout
1. Schvalujete Etapu 1 (plán zpětně u proběhlé hodiny)?
2. Materiály z knihovny ukládat do stávajících materiálů hodiny bez změny databáze (doporučuji), nebo do nové tabulky?
3. Které druhy nabídnout: pracovní listy, prezentace, lekce učebnice, aktivity? Aktivity žákovi skrýt?
4. Jak daleko zpět povolit přiřazení: 8 týdnů (jako editor plánu), nebo celé pololetí?
