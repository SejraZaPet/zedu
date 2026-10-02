# Architecture rules

- Keep worksheet editor pagination presentational: it may regroup existing item IDs into A4 pages, but all mutations must continue through WorksheetEditor `updateSpec` so undo, metadata, autosave, scoring, and print/PDF remain authoritative.
- Keep worksheet item editors presentational and contextual: field changes must emit patches to WorksheetEditor handlers, never mutate spec or persistence directly.
- Keep lesson-linked presentation edits teacher-scoped in `teacher_presentations`; global lesson rows are source content, never shared storage for one teacher's slide edits.
- Keep assignment descriptions as sanitized limited HTML, with one shared renderer and plain-text conversion for speech or AI context, so legacy text and formatted instructions stay consistent.
- Keep notebook text boxes as sanitized limited HTML in `html` plus plain `text`, rendered by one shared canvas drawer (notebook-rich-text) for PDF, portfolio and thumbnails, so exports match the screen.
- Keep live MCQ option colors, shapes, and accessible names in one shared mapping so projector, student controls, and result charts always match.
