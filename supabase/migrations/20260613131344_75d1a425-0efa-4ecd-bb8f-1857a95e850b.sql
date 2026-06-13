DROP POLICY IF EXISTS "Anyone can insert responses" ON public.game_responses;
-- Inserts are now only allowed via service role (Edge Function submit-answer / submit-activity-response).
-- SELECT policy (teacher reads) remains unchanged.