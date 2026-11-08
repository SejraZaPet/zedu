# Materiál: více lekcí (etapa 1 hotová) a návrh etapy 2 – více listů

Úkol a oznámení zůstávají beze změny. Etapa 2 čeká na „schvaluji“. SQL níže se NESPOUŠTÍ.

## Etapa 1 – hotovo (jen frontend)
- Materiál ukládá lekce do `settings.lessons` (stejný tvar jako u plánů, čte se přes `planLessons`).
- `lesson_id`/`lesson_source` = první lekce. S jedinou lekcí se `settings.lessons` neukládá, takže záznam vypadá jako dřív.
- Úkol dál ukládá jednu lekci z původního výběru a `settings.lessons` se u něj neukládá. Plány (`settings.plan`) se nemění.

## Ověření čtení lekcí (čtecí průchod DB)
- `can_view_teacher_textbook_lesson` a `can_view_textbook_lesson` vůbec nekontrolují úlohu.
- Rozhoduje učebnice:
  - zápis do učebnice
  - učebnice napojená na třídu
  - přímé sdílení
  - viditelné umístění lekce
  - globální lekce přes témata
- Žák proto otevře další lekce ze `settings.lessons` za stejných podmínek jako dnes první lekci.
- **Omezení:** pokud učitel přidá lekci z učebnice, která není napojená na třídu ani skupinu žáka, žák ji neotevře. Zobrazí se mu hláška „Lekci se nepodařilo otevřít“. Platí to stejně i pro dnešní jednu lekci. DB se nemění.

## Příprava: vazba lekce → pracovní list
- `worksheets.source_lesson_id` + `source_lesson_type` (global/teacher) + `show_in_lesson`, `status`, `scheduled_publish_at`. Podle toho lze po přidání lekce nabídnout její listy (`teacher_id = učitel`).
- Druhá vazba: `lesson_plans.worksheet_ids` u plánů hodin.
- Implementace nabídky až po schválení.

## Etapa 2 – FINÁLNÍ návrh SQL (NESPOUŠTĚT)
Pravidlo: list vidí jen ti, komu je úloha přidělena.
- Úloha pro třídu: jen členové třídy (`class_members.user_id`).
- Úloha pro skupinu: jen členové skupiny (`subject_group_members.student_id`).
- Úloha s vybranými žáky: jen žáci v `assignment_recipients.student_id`.

Výjimka „bez třídy = vidí kdokoli“ zaniká. Učitel-vlastník („Teachers manage own worksheets“) a admin („Admin can manage all worksheets“) čtou jako dnes přes své politiky. Demo RESTRICTIVE `demo_iso` platí dál.

Dopad opravy na dnešní data (čtecí dotaz):
- Zveřejněné úlohy s listem: 12 pro třídu, 11 pro skupinu, 0 bez cíle, 0 s vybranými žáky.
- Žáci skupin čtou list dál přes členství, třídy beze změny. Nikdo oprávněný o přístup nepřijde.
- Přístup ztratí jen přihlášení uživatelé mimo skupinu, kteří dnes list vidí kvůli výjimce.

```sql
CREATE OR REPLACE FUNCTION public.can_student_view_assigned_worksheet(_ws uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.status = 'published'
      AND (a.worksheet_id = _ws
           OR (a.settings->>'kind' = 'material'
               AND a.settings->'worksheets' @> jsonb_build_array(jsonb_build_object('id', _ws::text))))
      AND (
        (a.class_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = a.class_id AND cm.user_id = _uid))
        OR (a.group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.subject_group_members g WHERE g.group_id = a.group_id AND g.student_id = _uid))
      )
      AND (NOT EXISTS (SELECT 1 FROM public.assignment_recipients r WHERE r.assignment_id = a.id)
           OR EXISTS (SELECT 1 FROM public.assignment_recipients r WHERE r.assignment_id = a.id AND r.student_id = _uid))
  ) $$;
REVOKE ALL ON FUNCTION public.can_student_view_assigned_worksheet(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_student_view_assigned_worksheet(uuid, uuid) TO authenticated;

DROP POLICY "Students can read worksheets via assignment" ON public.worksheets;
CREATE POLICY "Students can read worksheets via assignment" ON public.worksheets
  FOR SELECT TO authenticated USING (public.can_student_view_assigned_worksheet(id, auth.uid()));
```

Rollback (vrátí přesně dnešní politiku):
```sql
DROP POLICY "Students can read worksheets via assignment" ON public.worksheets;
CREATE POLICY "Students can read worksheets via assignment" ON public.worksheets FOR SELECT USING (
  EXISTS (SELECT 1 FROM assignments a LEFT JOIN class_members cm ON cm.class_id = a.class_id
          WHERE a.worksheet_id = worksheets.id AND a.status = 'published'
            AND (cm.user_id = auth.uid() OR a.class_id IS NULL)));
DROP FUNCTION public.can_student_view_assigned_worksheet(uuid, uuid);
```

Před spuštěním je nutné:
- přesně uložit role a `qual` stávající politiky do rollbacku (`pg_policies`),
- ověřit EXPLAIN,
- otestovat dvěma žáky: člen a nečlen skupiny.

Frontend etapy 2:
- `settings.worksheets: [{id,title}]` jen u materiálu, `worksheet_id` = první list,
- seznam listů s otevřením jen ke čtení,
- testy.
