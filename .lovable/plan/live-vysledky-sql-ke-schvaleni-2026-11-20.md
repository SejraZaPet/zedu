# SQL ke schválení – souhrn výsledků pro žáka (NEAPLIKOVÁNO)

Důvod: `game_responses` má jen politiku „Teacher reads“, žák na telefonu dostane 0 odpovědí.
Bez tohoto RPC žák neuvidí vlastní % ani seznamy „šlo skvěle / procvičit“ a třídní % se mu nezobrazí.

```sql
CREATE OR REPLACE FUNCTION public.get_my_game_result_summary(_session_id uuid, _join_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid; _mine jsonb; _class jsonb;
BEGIN
  SELECT id INTO _pid FROM game_players
   WHERE session_id = _session_id AND join_token = _join_token
     AND (token_expires_at IS NULL OR token_expires_at > now());
  IF _pid IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM game_sessions WHERE id = _session_id AND status = 'finished') THEN RETURN NULL; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'question_index', question_index, 'is_correct', is_correct,
           'correctCount', answer->'correctCount', 'totalCount', answer->'totalCount',
           'soloRound', coalesce((answer->>'soloRound')::boolean,false)) ORDER BY question_index), '[]')
    INTO _mine FROM game_responses WHERE session_id = _session_id AND player_id = _pid;
  SELECT jsonb_build_object('answers', count(*), 'credit', coalesce(sum(
           CASE WHEN coalesce((answer->>'soloRound')::boolean,false) AND (answer->>'totalCount')::numeric > 0
                THEN least(1, greatest(0, (answer->>'correctCount')::numeric / (answer->>'totalCount')::numeric))
                WHEN is_correct THEN 1 ELSE 0 END),0))
    INTO _class FROM game_responses WHERE session_id = _session_id;
  RETURN jsonb_build_object('mine', _mine, 'class', _class);
END $$;
REVOKE ALL ON FUNCTION public.get_my_game_result_summary(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_game_result_summary(uuid, text) TO anon, authenticated;
```
Vrací jen vlastní odpovědi (bez obsahu odpovědi) a třídní součty bez jmen; jen po skončení hry. Demo izolace se nemění (přístup jen přes vlastní join_token).
Po schválení: klient zavolá RPC v StudentGamePlay a předá výsledek do GameLeaderboardFinal.
