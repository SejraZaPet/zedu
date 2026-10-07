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
- Store new assignment attachments in private bucket `assignment-uploads` (type allowlist via RESTRICTIVE storage policy) and read via `getStudentAttachmentSignedUrl` with fallback to legacy `student-attachments`, because the legacy bucket MIME list cannot be changed on this platform.
- Store worksheet item images as permanent public URLs in `lesson-images` via `WorksheetImageField`/`worksheet-images.ts` (same path as presentations), never 1-hour signed `teacher-media` URLs, so students, print and PDF always see them.
- Create student course notebooks only via `ensure_my_course_notebooks()` / membership triggers (one per owner+group or owner+class+subject_id, enforced by partial unique indexes), so automatic creation stays idempotent and never touches teachers or shared demo profiles.
- Store a student's own worksheet work outside assignments only in `student_worksheet_work` (one draft per student+worksheet+variant via partial unique index, submitted rows kept); assignment attempts never use it, so grading and assignment flows stay untouched.
