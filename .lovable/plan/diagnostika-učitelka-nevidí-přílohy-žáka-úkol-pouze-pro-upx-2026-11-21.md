# Diagnostika: učitelka nevidí přílohy žáka (úkol „Pouze pro UPX“, H2.A)

Jen čtení, nic se neměnilo ani nenasazovalo.

## 1. Kam žák přílohy ukládá
- Nahrávání (`AttachmentsUploader.tsx`): soubor jde do soukromého úložiště `assignment-uploads`, cesta `<id úkolu>/<id žáka>/<soubor>`.
- Záznam o souboru je v tabulce `assignment_attachments` (`assignment_id`, `student_id`, `file_name`, `file_path` = cesta v úložišti, `file_size`, `uploaded_at`).
- V samotném odevzdání (`assignment_attempts.answers`) přílohy nejsou. U tohoto úkolu je `answers` prázdný objekt `{}`.

## 2. Co jsem v databázi našla (jen SELECT, bez obsahu a jmen)
- Úkol: jeden, třída H2.A, zadala ho jedna učitelka, která je v H2.A i jako učitelka třídy (`class_teachers`, role owner).
- Odevzdání: 6 (4 odevzdaná, 2 rozpracovaná).
- Přílohy: 11 záznamů od 4 žáků. Všech 11 souborů v úložišti skutečně existuje a cesty přesně sedí. Všechny patří žákům, kteří úkol odevzdali.
- Tvar je stejný jako u úkolů, kde se přílohy zobrazují. Data jsou v pořádku.

## 3. Proč je učitelka nevidí
- Oprávnění nejsou příčinou. Zadávající učitelka i učitelé třídy z `class_teachers` smí číst řádky `assignment_attachments` i soubory v úložišti (pravidla `Teachers view their students attachments` a `au_teachers_view_students_files`). Odkaz ke stažení se vytváří správně, se zálohou na starší úložiště.
- Přílohy dnes ukazují jen dvě místa:
  - seznam úkolů (`TeacherAssignments` → `TeacherAssignmentAttachments`, tlačítko „N příloh“),
  - detail úkolu (`AssignmentDetailDialog`, po rozbalení žáka sekce „Přílohy“).
- **Příčina:** hodnoticí obrazovka „Ke kontrole“ (`/ucitel/ke-kontrole`, `TeacherReviewQueue.tsx` + `grading-review.ts`) tabulku `assignment_attachments` vůbec nenačítá. Nenačítá ani poznámku žáka (`submission_note`). Bere jen `answers` a ty jsou u tohoto úkolu prázdné, takže učitelka uvidí práci bez souborů. Tento závěr je z kódu a dat, v prohlížeči pod jejím účtem jsem ho nepřehrála.

## 4. Vedlejší zjištění (u tohoto úkolu se neprojeví)
- Učitelé s přístupem jen přes skupinu předmětu nebo jako vyučující předmětu, ale ne v `class_teachers`, přílohy nečtou. Pravidla pokrývají jen autora úkolu a `class_teachers` podle `a.class_id`. U úkolů zadaných skupině (`group_id`) tedy čte jen autor.
- Oprava by vyžadovala SQL. Navrhuji ji až po Tynině rozhodnutí, kdo má číst. Doporučení: autor úkolu, učitelé třídy, učitelé skupiny (`subject_group_members` s učitelskou rolí), admin a školní admin dané školy. Žák jen své soubory.

## Nejmenší oprava (bez databáze)
1. `TeacherReviewQueue.tsx`: při načtení fronty jedním dotazem načíst `assignment_attachments` pro zobrazené úkoly (`.in("assignment_id", ids)`), seskupit podle úkolu a žáka.
2. Panel hodnocení: přidat sekci „Přílohy“ (název, velikost, „Otevřít“). Odkaz vytvořit až při kliknutí přes `getStudentAttachmentSignedUrl`, stejně jako v `AssignmentDetailDialog`. Přidat i „Poznámka žáka“.
3. U skupinových odevzdání (`group_id`) ukázat přílohy všech členů skupiny.
4. Test v `grading-review` nebo komponentě: řádek s přílohou ukáže její název a řádek bez přílohy ukáže „Žádné přílohy“.

## Jak ověřit
- Pod účtem učitelky otevřít „Ke kontrole“ → úkol „Pouze pro UPX“. U každého ze 4 žáků musí být vidět jejich přílohy (celkem 11) a musí jít otevřít.
- Kontrolně: detail úkolu v seznamu úkolů má dnes ukazovat totéž. Pokud tam přílohy učitelka vidí, potvrzuje to diagnózu.

## Otázka
Opravuji jen obrazovku „Ke kontrole“ (bez databáze), nebo mám připravit i SQL návrh pro učitele skupin a spoluučitele?
