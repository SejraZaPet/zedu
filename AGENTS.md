# Architecture rules

- FillWordBank is lesson-only; occurrence IDs allow duplicate words.
- Snapshots: student_activity_results.answers via ActivityAnswerReview, not live-game grading.

- Assignment states/completion use assignment-status.ts; grouping is session-scoped and presentational so grading/deadlines/permissions stay authoritative.
- Read attempts via student-assignment-attempts.ts with existing RLS and group memberships so teammate submissions need no new access rights.


- Worksheet pagination only regroups existing IDs into A4 pages; mutate through WorksheetEditor `updateSpec` to preserve undo, metadata, autosave, scoring and print/PDF.
- Worksheet item editors emit patches to WorksheetEditor; never persist.
- Insert print-header additions through an explicit template marker and paginate after fonts load using block bounds, not trailing margins, so print previews share stable page geometry.
- Keep lesson-linked presentation edits teacher-scoped in `teacher_presentations`; global lesson rows are source content, never shared storage for one teacher's slide edits.
- Assignment descriptions use sanitized limited HTML, one shared renderer and plain-text conversion for previews, speech and AI, keeping legacy and formatted instructions consistent without visible tags.
- Keep notebook text boxes as sanitized limited HTML in `html` plus plain `text`, rendered by one shared canvas drawer (notebook-rich-text) for PDF, portfolio and thumbnails, so exports match the screen.
- Live MCQ: one look mapping; activity→questions (/hra+/live) only via `live-game-core.ts`; scoring only in `_shared/game-scoring.ts` (server); slides expand at launch (`live-game-expand.ts`).
- Render composed slide background images as centered `contain` media on the canonical 16:9 stage; never duplicate them across the fullscreen viewport, so editor and projector framing stay identical.
- Keep live-session slide drafts in `live_session_drafts` (never in game_sessions) and publish only via the `publish_live_draft` RPC, so projectors never see drafts and publishing is one atomic update that cannot insert before the current slide.
- Enforce demo-mode write protection only via additive RESTRICTIVE RLS policies (`demo_guard_*`) using `is_demo_user()`, so non-demo users' permissions never change.
- Issue demo sessions only server-side (create-demo-session, demo-switch, demo-restore via generateLink + verifyOtp); demo_pairs is service-role only and clients read just their own code via `get_my_demo_pair()`, so no password or pair data ever leaves the server.
- Isolate demo visitors only via RESTRICTIVE `demo_iso` policies backed by SECURITY DEFINER `demo_can_see_*` helpers over `demo_pairs` + `demo_shared_users`, so non-demo users' access never changes.
- Gate AI edge functions for demo users only via `_shared/demo-ai-guard.ts` (limits in `demo_config`), so regular users are never metered.
- New assignment attachments go to private `assignment-uploads` (read via `getStudentAttachmentSignedUrl`, fallback legacy `student-attachments`), because legacy MIME list is fixed.
- Store worksheet item images as permanent public URLs in `lesson-images` via `WorksheetImageField`/`worksheet-images.ts` (same path as presentations), never 1-hour signed `teacher-media` URLs, so students, print and PDF always see them.
- Create student course notebooks only via `ensure_my_course_notebooks()` / membership triggers (one per owner+group or owner+class+subject_id, enforced by partial unique indexes), so automatic creation stays idempotent and never touches teachers or shared demo profiles.
- Store a student's own worksheet work outside assignments only in `student_worksheet_work` (one draft per student+worksheet+variant via partial unique index, submitted rows kept); assignment attempts never use it, so grading and assignment flows stay untouched.
- Notebook worksheets use `worksheet-notebook.ts`: digital links, locked pen backgrounds; submissions snapshot pen pages to `assignment-uploads` via `answers._notebookSnapshot`, preserving answers and storage permissions.
- Keep worksheet kind (`header.worksheetMode` / `worksheet_mode`) separate from AI focus, defined only in `worksheet-kinds.ts`, and enforce AI section counts server-side in `_shared/worksheet-sections.ts`, so print, PDF titles, filters and generation stay consistent.

- Lesson text cleanup only in `_shared/lesson-text.ts` (shared context).
- Class/group plans are published contentless `assignments` (`settings.plan`/`lessons`) via `planned-assignment.ts`, so student filters and RLS stay unchanged.
- Subdirectories have their own `AGENTS.md`; read them before changing files there.
- Demo seed textbook details read lessons by textbook ID in a preview-only view, never authoring controls, to avoid shared writes.
- XP only via server `add_xp(..., source, key)`; league reads only via definer RPCs, rules mirrored in `league-rules.ts`, so caps/privacy stay server-side.
- Demo templates use service-only `demo_fill_game_templates` and per-pair keys; duplicates strip seed identity to preserve isolation and visitor edits.
