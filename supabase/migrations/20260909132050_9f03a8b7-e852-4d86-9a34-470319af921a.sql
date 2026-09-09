DELETE FROM public.game_responses
WHERE session_id = 'b5292d3c-ebc2-43be-b8d5-181c760b6ef7'
  AND (answer->>'text') IN ('JEDNA','DVE','TRI','TESTSLOVO');