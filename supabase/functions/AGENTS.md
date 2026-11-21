# Edge functions

- AI assignment context (linked lesson + assignment materials) loads only server-side via `_shared/assignment-context.ts` with the caller JWT from an `assignmentId`, never client-supplied text, so RLS/storage policies decide access.
