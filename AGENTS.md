# Architecture rules

- Keep worksheet editor pagination presentational: it may regroup existing item IDs into A4 pages, but all mutations must continue through WorksheetEditor `updateSpec` so undo, metadata, autosave, scoring, and print/PDF remain authoritative.
- Keep worksheet item editors presentational and contextual: field changes must emit patches to WorksheetEditor handlers, never mutate spec or persistence directly.
- Keep lesson-linked presentation edits teacher-scoped in `teacher_presentations`; global lesson rows are source content, never shared storage for one teacher's slide edits.
- Keep assignment descriptions as sanitized limited HTML, with one shared renderer and plain-text conversion for speech or AI context, so legacy text and formatted instructions stay consistent.
- Keep notebook text boxes as sanitized limited HTML in `html` plus plain `text`, rendered by one shared canvas drawer (notebook-rich-text) for PDF, portfolio and thumbnails, so exports match the screen.
- Keep live MCQ option colors, shapes, and accessible names in one shared mapping so projector, student controls, and result charts always match.
- Render composed slide background images as centered `contain` media on the canonical 16:9 stage; never duplicate them across the fullscreen viewport, so editor and projector framing stay identical.
- Keep live-session slide drafts in `live_session_drafts` (never in game_sessions) and publish only via the `publish_live_draft` RPC, so projectors never see drafts and publishing is one atomic update that cannot insert before the current slide.
- Enforce demo-mode write protection only via additive RESTRICTIVE RLS policies (`demo_guard_*`) using `is_demo_user()`, so non-demo users' permissions never change.
- Issue demo sessions only server-side (create-demo-session, demo-switch, demo-restore via generateLink + verifyOtp); demo_pairs is service-role only and clients read just their own code via `get_my_demo_pair()`, so no password or pair data ever leaves the server.
- Isolate demo visitors only via RESTRICTIVE `demo_iso` policies backed by SECURITY DEFINER `demo_can_see_*` helpers over `demo_pairs` + `demo_shared_users`, so non-demo users' access never changes.
- Gate every AI edge function for demo users only via `_shared/demo-ai-guard.ts` (atomic `demo_ai_reserve` with limits in `demo_config`), so regular users are never metered and limits change in one place.
