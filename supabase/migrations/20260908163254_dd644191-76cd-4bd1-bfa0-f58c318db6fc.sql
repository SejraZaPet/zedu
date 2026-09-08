ALTER TABLE public.teacher_game_templates ADD COLUMN IF NOT EXISTS background_url text;

UPDATE public.game_backgrounds SET category = 'subject', subject_key = v.k
FROM (VALUES
  ('Matematika','matematika'),
  ('Literatura','cestina'),
  ('Historie','dejepis'),
  ('Zeměpis','zemepis'),
  ('Informatika','informatika'),
  ('Vesmír','fyzika'),
  ('Les','prirodopis'),
  ('Obchod','ekonomie'),
  ('Sociální sítě','obcanska'),
  ('Zemědělství','prirodopis')
) AS v(n,k)
WHERE game_backgrounds.name = v.n AND game_backgrounds.category = 'universal';