# Materiál: více lekcí (etapa 1 hotová) a návrh etapy 2 – více listů

Úkol a oznámení zůstávají beze změny. Etapa 2 schválena 8. 11. 2026; provádí se pouze funkce a výměna jedné politiky.

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

## Etapa 2 – FINÁLNÍ návrh SQL (schváleno)
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

### Přesný stav před migrací (pg_policies, 8. 11. 2026)
- policyname: `Students can read worksheets via assignment`
- roles: `{authenticated}`; cmd: `SELECT`; permissive: `PERMISSIVE`; with_check: `NULL`.
- qual (doslovně):
```sql
(EXISTS ( SELECT 1
   FROM (assignments a
     LEFT JOIN class_members cm ON ((cm.class_id = a.class_id)))
  WHERE ((a.worksheet_id = worksheets.id) AND (a.status = 'published'::text) AND ((cm.user_id = auth.uid()) OR (a.class_id IS NULL)))))
```
- Sloupce `subject_group_members.student_id`, `assignment_recipients.student_id`, `class_members.user_id` potvrzeny jako UUID.
- EXPLAIN těla funkce: membership a recipients používají existující index-only scans; assignments seq scan, cost 537.34. Žádná změna indexů.
- Funkce tohoto jména před migrací neexistuje. Ostatní cesty čtení (vlastník/admin, sdílení, lekce/plán) a všechny demo politiky zůstanou byte-identické. Proto nečlen může nadále číst list jinou již oprávněnou cestou; zákaz se týká pouze čtení přes přidělení.
- Oproti původnímu návrhu upraven jen rollback: doplněno přesné `TO authenticated`, `AS PERMISSIVE` a doslovné qual. SQL migrace beze změny.

Rollback (obnoví přesný stav; NESPOUŠTĚT automaticky):
```sql
DROP POLICY "Students can read worksheets via assignment" ON public.worksheets;
CREATE POLICY "Students can read worksheets via assignment" ON public.worksheets AS PERMISSIVE FOR SELECT TO authenticated USING (
(EXISTS ( SELECT 1
   FROM (assignments a
     LEFT JOIN class_members cm ON ((cm.class_id = a.class_id)))
  WHERE ((a.worksheet_id = worksheets.id) AND (a.status = 'published'::text) AND ((cm.user_id = auth.uid()) OR (a.class_id IS NULL)))))
);
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

## Etapa 2 – výsledek 8. 11. 2026
- Aplikována jediná migrace `drizzle/migrations/0082_material_worksheets_assignment_read.sql`: nová funkce, EXECUTE authenticated (PUBLIC/anon odebráno), výměna pouze politiky `Students can read worksheets via assignment`.
- Otisky všech dalších 11 politik zůstaly identické, včetně vlastníka/admina a demo_iso/demo_guard/demo_seed_read. Žádné řádky nezměněny.
- Čtením těla funkce nad skutečnými členstvími: 12 třídních úloh/268 členství a 11 skupinových úloh/177 členství povoleno; 5384 nečlenských kombinací, 0 neoprávněných povolení.
- Funkce přímo ověřena přes autorizované RPC: člen/nečlen třídy i skupiny true/false. Admin čte oba listy dál přes Data API.
- Čtecí nástroj nemá EXECUTE na tuto funkci: nezvyšována jeho práva; hromadné ověření provedeno nad identickým SQL tělem a RPC přes vlastní přihlášení.
- Příjemci a další list: pět lokálních SQL CTE případů (vybraný první/druhý ano, nevybraný člen oba ne, nečlen ne) prošlo bez insertů. Skutečné zveřejněné cílené materiály s listem dosud chybí, tuto reálnou kombinaci nelze ověřit bez testovacích zápisů.
- Frontend: více listů jen materiál, společný blok a hledání, řazení/odebrání, první ID pro kompatibilitu, počty na učitelských i žákovských kartách. Starý list se objeví první. Úkol/oznámení zůstávají jednopoložkové.
- Materiálové náhledy používají sandboxovaný tiskový dokument bez klíče odpovědí, bez pokusů/own-work/odevzdání.
- 68 cílených testů prošlo (nefunkční nepovinný canvas dočasně vynechán a vrácen); automatická kontrola build OK. Samostatný typecheck nespouštěn, spravuje jej prostředí.
- Vlastní přihlášený formulář 1280/390 px: přidání 2 listů, řazení, odebrání, 44px cíle a bez vodorovného posunu ověřeno. Místní materiálový náhled s reálně autorizovanými listy: oba otevřeny, žádný zápis pokusu/vlastní práce; materiál byl simulovaný, do DB neuložen.
- Neověřeno: skutečné uložení a načtení materiálu žákem, druhá žákovská relace a dva demo páry; chybí vlastní schválená testovací data/účty. Nasazení ani edge funkce neprovedeny.
