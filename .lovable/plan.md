# Demo: únik obsahu skutečných učitelů – diagnostika a plán

## Příčina (jistá pro 9 listů, zbytek pravděpodobný)
Nabídka „+ Přidat list“ (`TeacherAssignments.tsx` ř. 398–404) čte `worksheets` bez filtru na autora a spoléhá jen na RLS. Únik vzniká souhrou dvou pravidel:

1. **Povolující politika** „Students can read worksheets shown in lesson“ volá `can_student_view_worksheet_in_lesson`. Pro listy s typem zdroje `global` dál volá `can_view_textbook_lesson`, která pustí **každého učitele** přes `is_admin_or_teacher()` (stačí role teacher, nekontroluje se škola ani autor). Tyna má 9 listů, které jsou zveřejněné, mají zapnuté „ukázat v lekci“ a jako zdroj globální lekci. Tyto listy projdou každému učiteli, tedy i demo učiteli.
2. **Omezující `demo_iso`** na `worksheets` používá `demo_can_see_owned(teacher_id)`. Ta vrací true i tehdy, když autor **není demo uživatel** (`OR NOT is_demo_user(_owner)`). Izolace tak zastaví jen cizí demo páry, nikdy skutečné učitele.

Ostatní cesty jsem vyloučila čtením dat:
- **Plán hodiny** („Students can read worksheets via lesson plan“): demo učitelé nejsou členy žádné třídy ani skupiny, takže 0 listů.
- **Sdílení a spolupráce:** potvrzuji Vaše zjištění, že tudy listy neprojdou.

Chybějící 2 do počtu 11 jsou pravděpodobně jiná kombinace stejné souhry. Přesně je ověřím v testu po opravě. Funkce databáze se z mého přístupu nedají spustit, proto byl rozbor proveden nad daty a definicemi.

**Klíče správných odpovědí:** RLS pouští celý řádek, takže demo učitel může číst i `spec` včetně klíčů (pravděpodobné, sloupcová práva jsem neověřovala). Obsah jsem nevypisovala.

Pozor: bod 1 platí i mimo demo. **Každý ne-demo učitel** dnes vidí tyto listy učitelů z jiných škol. Oprava níže se ne-demo uživatelů záměrně netýká (viz otevřené otázky).

## Rozsah u dalších tabulek
| Tabulka | Izolace dema | Vidí demo obsah skutečných učitelů? |
|---|---|---|
| worksheets | `demo_can_see_owned` (děravé) | **ano, jisté** (9+) |
| teacher_presentations | `demo_can_see_owned` | ano, pokud je demo učitel pozván ke spolupráci; jinak ne. Únik je možný, nyní pravděpodobně 0 |
| question_bank_items | `demo_can_see_owned` | ne (povolující politika jen vlastník) |
| teacher_textbooks | `demo_can_see_owned` | ano u záměrně veřejných: systémové učebnice (`is_system`, knihovna) a veřejně sdílené náhledy. Ostatní jen po zápisu nebo sdílení |
| game_sessions, notebooks | `demo_can_see_user` (správně) | ne |
| teacher_game_templates | jen vlastník | ne |
| activity_templates | bez demo_iso | ne (jen vlastník) |
| lesson_plans | bez demo_iso | jen plány „public“ (dnes 0) a plány v rámci demo školy |
| teacher_textbook_lessons, textbook_lessons | bez demo_iso | čtení podle učebnic; zápis do textbook_lessons blokuje demo_guard |
| **lessons** | bez demo_iso i bez demo_guard | tabulka je prázdná (0 řádků), čte ji jen funkce `generate-practice`. Každý učitel včetně dema by mohl upravovat i mazat |
| lesson_placements, student_activity_results, student_lesson_completions | bez demo_iso | vyžaduje samostatné ověření, v tomto plánu se nemění |

Záměrně veřejná knihovna jsou systémové učebnice (`is_system`) a veřejně sdílené učebnice, ty zůstanou dostupné.

## Návrh oprav (jen přidání omezujících pravidel, chování pro ne-demo uživatele beze změny)

**Etapa 1 – pracovní listy (doporučuji hned, čeká na „schvaluji“):**
```sql
CREATE POLICY demo_iso_strict ON public.worksheets AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT public.is_demo_user(auth.uid())
  OR is_demo_seed
  OR teacher_id IN (SELECT public.demo_visible_user_ids(auth.uid()))
);
-- rollback:
-- DROP POLICY IF EXISTS demo_iso_strict ON public.worksheets;
```
- Demo učitel uvidí jen svoje listy, listy svého páru, sdílené demo autory a ukázkové listy.
- Demo žák dál otevře list od svého učitele, protože učitel patří do jeho páru (cesta 0082 zůstává).

**Etapa 2 – prezentace a učebnice (stejný vzor):**
```sql
CREATE POLICY demo_iso_strict ON public.teacher_presentations AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.is_demo_user(auth.uid()) OR is_demo_seed
       OR teacher_id IN (SELECT public.demo_visible_user_ids(auth.uid())));
CREATE POLICY demo_iso_strict ON public.teacher_textbooks AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.is_demo_user(auth.uid()) OR is_demo_seed OR is_system
       OR public.is_public_shared_textbook(id)
       OR teacher_id IN (SELECT public.demo_visible_user_ids(auth.uid())));
-- rollback: DROP POLICY IF EXISTS demo_iso_strict ON public.teacher_presentations;
--           DROP POLICY IF EXISTS demo_iso_strict ON public.teacher_textbooks;
```

**Etapa 3 – `lessons`:** zákaz zápisu pro demo (prázdná tabulka, bez dopadu).
```sql
CREATE POLICY demo_guard_update ON public.lessons AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_demo_user(auth.uid()));
CREATE POLICY demo_guard_delete ON public.lessons AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_demo_user(auth.uid()));
-- rollback: DROP POLICY IF EXISTS demo_guard_update ON public.lessons; DROP POLICY IF EXISTS demo_guard_delete ON public.lessons;
```

Funkci `demo_can_see_owned` neměním: používají ji i jiné tabulky a změna by mohla rozbít ukázková data. Nové pravidlo je samostatné a jde snadno vrátit.

## Testy (po každé etapě, kontrola jen počtů a názvů, ne obsahu)
- Demo učitel nevidí žádný Tynin list. Vidí svoje a 2 ukázkové.
- Demo žák otevře list přiřazený svým demo učitelem.
- Ne-demo učitel a Tyna vidí stejné počty listů jako před opravou. Tynini žáci otevřou své úkoly.
- Etapa 2: demo dál vidí systémové učebnice a ukázkovou učebnici, ale ne Tyniny prezentace.
- Malý pomocný test (`demo-isolation`) zrcadlí pravidlo v kódu pro budoucí změny.

## Rizika
- Pokud sdílený demo autor není v `demo_shared_users`, jeho ukázkové listy zmizí. Ověřím počty před i po opravě a v případě potřeby pravidlo vrátím.
- Cizí obsah, který demo účty mohly dosud přiřadit do úkolů, se po opravě demo žákům nezobrazí. Ověřím počet takových úkolů, nic nemažu.
- Neúspěšnou migraci nebudu opakovat.

## Otevřené otázky
1. Schvalujete etapu 1 samostatně, nebo etapy 1–3 najednou?
2. Mají i **běžní učitelé** z jiných škol přestat vidět cizí listy „ukázané v lekci“? To by byla samostatná oprava s dopadem na ne-demo uživatele.
3. Mají demo účty vidět veřejně sdílené učebnice, nebo jen systémové a ukázkové?
