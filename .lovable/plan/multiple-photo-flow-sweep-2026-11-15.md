# Kontrola pravidla: žádná vybraná fotka se nesmí tiše ztratit

Dávková pole musí zpracovat celé pole, nebo viditelně odmítnout překročení stávajícího limitu. Pole jediné fotografie se nerozšiřují na galerie ani nemění datový model.

## Dávkové cesty – přečteno
- AddPortfolioItemDialog: multiple, celé pole, 20 MB/soubor, chyby; skutečně ověřen zápis/načtení dvou fotek, test uklizen.
- GalleryBlock: multiple, celé pole, individuální chyby; sdílen editor lekce/prezentace.
- PresentationEditorDialog → MediaPickerDialog → MediaUploadZone: dávka do knihovny a explicitní vložení všech nahraných obrázků; trvalé URL přes persistSlideImageUrl.
- AttachmentsUploader: celé pole, 10 MB/soubor, busy do konce dávky, chyby každého souboru.
- AssignmentMaterialsEditor: celé pole, 20 MB / video 100 MB, zachování posledních materiálů.
- BulkUploadDialog: celé pole, párování _1/_2 je záměrné; MIME záloha podle přípony; chyby jednotlivých souborů.
- NotebookCanvas: celé pole, 10 MB/soubor, společný zápis proti aktuálnímu obsahu, zamčené pozadí zachováno.
- FromMaterialView (učitel i žák): nalezeno tiché slice(0,6) a kamera na dávkovém inputu. Opraveno explicitní odmítnutí dávky nad volnou kapacitu 6, jednotlivé chyby čtení, uvolnění URL; kamera oddělena od galerie. Limit nezměněn.
- GameBackgroundsManager: celé pole, nalezeno tiché odmítnutí prázdného MIME a riziko kolize cest. Opraven MIME fallback, viditelné odmítnutí a UUID cesty.
- MediaUploadZone: celé pole, 10 MB, zabráněno překryvu dávek přes drop, zachování FileList před resetem.
- BlockEditor: přetažení zpracovává celé pole; chyby částečného selhání dříve jen v konzoli. Doplněna viditelná chyba a MIME fallback. Schránka dříve items.find; nyní všechny obrazové položky.
- WorksheetImageField: jediný obrázek; více přetažených/vložených fotografií nyní odmítne s vysvětlením místo ignorování zbytku.

## Jednosouborové cesty – přečteny handlery a vstupy, záměrné
- LessonEditorSheet, TeacherTextbookLessonEditorSheet, TextbooksManager: titulní foto lekce.
- ImageBlock, ImageTextBlock, ActivityBlock (imageLabel/imageHotspot), RichTextEditor, MarkdownImageToolbar: jednotlivý obrázek/URL; nelze vybrat dávku, galerie je samostatná cesta.
- AvatarItemsManager: jednotlivá vrstva/náhled; dávky řeší BulkUploadDialog.
- LandingImageInput, PodcastManager, BannerManager: jednotlivé foto/logo/plakát/thumbnail.
- SchoolBrandingSection, SchoolResourcesManager: jednotlivé logo/foto zdroje.
- StudentBooks: jednotlivá obálka a jednotlivý obrázek stránky.
- ClassStoriesSection, AcademyView, MessagesPage: jedna příloha na příběh/důkaz/zprávu, bez změny datového modelu a odeslaných záznamů.
- LiveDraftsPanel: jedno pozadí snímku.
- StudentMethods: jeden soubor nebo jedna fotografie pro potvrzovaný přepis; dříve schválené limity zachovány.
- ActivityWizardDialog, ImportTextbookFileDialog, ImportPptxToPresentationDialog, TeacherSuggestByMethod, TeacherSubjectDetail, TeacherCurriculumPlans, SchoolCurriculumManager: jeden zdrojový dokument.
- UsersManager, SchoolBulkImportCard: jeden CSV/XLS soubor s více řádky uživatelů, nikoli dávka fotografií.

## Server, DB a úlohy
- generate-content-from-material: obrazové části celé přijaté dávky v mezích 6; klient nyní limit viditelně vynucuje. Server neměněn ani nenasazen.
- process-file-content: jeden dokument, vložená média z ZIP/DOCX/PPTX extrahuje jako pole; není výběr více fotografií. Beze změny.
- extract-practice-photo-text: smlouva jediného JPEG; beze změny a bez nasazení.
- Upload helpery portfolio/notebook/teacher-media/worksheet-images/assignment-materials přijímají jeden File, dávkování patří volajícím UI.
- Přehled současných bucketů ověřen SELECT: assignment-uploads 10 MiB, assignment-materials 100 MiB, ostatní bez vlastního bucket limitu; žádné změny.
- Notifikace a portfolio z odevzdání pouze používají existující attachment rows; neprovádějí nový výběr souborů. Žádné přepisování starých odevzdání, zpráv, oprávnění, nastavení nebo ukázek.

## Omezení ověření
Nativní galerie iOS/Android není dostupná v sandboxu. Mobilní šířka 390 px a skutečné portfolio ověřeny v předchozím commitu; další dávkové cesty testovány mocky bez zápisů do uživatelského obsahu. Nové změny pouze frontend.
