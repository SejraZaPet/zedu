# Architecture rules

- Keep worksheet editor pagination presentational: it may regroup existing item IDs into A4 pages, but all mutations must continue through WorksheetEditor `updateSpec` so undo, metadata, autosave, scoring, and print/PDF remain authoritative.
- Keep worksheet item editors presentational and contextual: field changes must emit patches to WorksheetEditor handlers, never mutate spec or persistence directly.
