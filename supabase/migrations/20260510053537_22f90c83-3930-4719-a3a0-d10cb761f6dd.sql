
CREATE TABLE public.textbook_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  grade_range int4range,
  subject text,
  structure_json jsonb NOT NULL DEFAULT '{"chapters":[]}'::jsonb,
  created_by uuid,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.textbook_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated reads public templates"
  ON public.textbook_templates FOR SELECT TO authenticated
  USING (is_public = true OR created_by = auth.uid() OR is_admin());

CREATE POLICY "Teachers insert own templates"
  ON public.textbook_templates FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND is_admin_or_teacher());

CREATE POLICY "Owners update own templates"
  ON public.textbook_templates FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_admin())
  WITH CHECK (created_by = auth.uid() OR is_admin());

CREATE POLICY "Owners delete own templates"
  ON public.textbook_templates FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_admin());

CREATE TRIGGER update_textbook_templates_updated_at
  BEFORE UPDATE ON public.textbook_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed predefined public templates
INSERT INTO public.textbook_templates (name, description, is_public, structure_json) VALUES
('Základní učebnice', '6 kapitol po 4 lekcích (text, aktivita, shrnutí).', true, $${
  "chapters": [
    {"title":"Kapitola 1","lessons":[
      {"title":"Úvod","block_types":["heading","paragraph"]},
      {"title":"Výklad","block_types":["heading","paragraph","activity"]},
      {"title":"Procvičení","block_types":["activity"]},
      {"title":"Shrnutí","block_types":["heading","paragraph"]}
    ]},
    {"title":"Kapitola 2","lessons":[
      {"title":"Úvod","block_types":["heading","paragraph"]},
      {"title":"Výklad","block_types":["heading","paragraph","activity"]},
      {"title":"Procvičení","block_types":["activity"]},
      {"title":"Shrnutí","block_types":["heading","paragraph"]}
    ]},
    {"title":"Kapitola 3","lessons":[
      {"title":"Úvod","block_types":["heading","paragraph"]},
      {"title":"Výklad","block_types":["heading","paragraph","activity"]},
      {"title":"Procvičení","block_types":["activity"]},
      {"title":"Shrnutí","block_types":["heading","paragraph"]}
    ]},
    {"title":"Kapitola 4","lessons":[
      {"title":"Úvod","block_types":["heading","paragraph"]},
      {"title":"Výklad","block_types":["heading","paragraph","activity"]},
      {"title":"Procvičení","block_types":["activity"]},
      {"title":"Shrnutí","block_types":["heading","paragraph"]}
    ]},
    {"title":"Kapitola 5","lessons":[
      {"title":"Úvod","block_types":["heading","paragraph"]},
      {"title":"Výklad","block_types":["heading","paragraph","activity"]},
      {"title":"Procvičení","block_types":["activity"]},
      {"title":"Shrnutí","block_types":["heading","paragraph"]}
    ]},
    {"title":"Kapitola 6","lessons":[
      {"title":"Úvod","block_types":["heading","paragraph"]},
      {"title":"Výklad","block_types":["heading","paragraph","activity"]},
      {"title":"Procvičení","block_types":["activity"]},
      {"title":"Shrnutí","block_types":["heading","paragraph"]}
    ]}
  ]
}$$::jsonb),
('Pracovní sešit', '10 lekcí: úvod, 3 cvičení a reflexe.', true, $${
  "chapters": [
    {"title":"Pracovní sešit","lessons":[
      {"title":"Lekce 1","block_types":["heading","paragraph","activity","activity","activity","paragraph"]},
      {"title":"Lekce 2","block_types":["heading","paragraph","activity","activity","activity","paragraph"]},
      {"title":"Lekce 3","block_types":["heading","paragraph","activity","activity","activity","paragraph"]},
      {"title":"Lekce 4","block_types":["heading","paragraph","activity","activity","activity","paragraph"]},
      {"title":"Lekce 5","block_types":["heading","paragraph","activity","activity","activity","paragraph"]},
      {"title":"Lekce 6","block_types":["heading","paragraph","activity","activity","activity","paragraph"]},
      {"title":"Lekce 7","block_types":["heading","paragraph","activity","activity","activity","paragraph"]},
      {"title":"Lekce 8","block_types":["heading","paragraph","activity","activity","activity","paragraph"]},
      {"title":"Lekce 9","block_types":["heading","paragraph","activity","activity","activity","paragraph"]},
      {"title":"Lekce 10","block_types":["heading","paragraph","activity","activity","activity","paragraph"]}
    ]}
  ]
}$$::jsonb),
('Projektová výuka', '4 projekty: zadání, materiály, výstupy, hodnocení.', true, $${
  "chapters": [
    {"title":"Projekt 1","lessons":[
      {"title":"Zadání","block_types":["heading","paragraph"]},
      {"title":"Materiály","block_types":["heading","paragraph","activity"]},
      {"title":"Výstupy","block_types":["heading","activity"]},
      {"title":"Hodnocení","block_types":["heading","paragraph"]}
    ]},
    {"title":"Projekt 2","lessons":[
      {"title":"Zadání","block_types":["heading","paragraph"]},
      {"title":"Materiály","block_types":["heading","paragraph","activity"]},
      {"title":"Výstupy","block_types":["heading","activity"]},
      {"title":"Hodnocení","block_types":["heading","paragraph"]}
    ]},
    {"title":"Projekt 3","lessons":[
      {"title":"Zadání","block_types":["heading","paragraph"]},
      {"title":"Materiály","block_types":["heading","paragraph","activity"]},
      {"title":"Výstupy","block_types":["heading","activity"]},
      {"title":"Hodnocení","block_types":["heading","paragraph"]}
    ]},
    {"title":"Projekt 4","lessons":[
      {"title":"Zadání","block_types":["heading","paragraph"]},
      {"title":"Materiály","block_types":["heading","paragraph","activity"]},
      {"title":"Výstupy","block_types":["heading","activity"]},
      {"title":"Hodnocení","block_types":["heading","paragraph"]}
    ]}
  ]
}$$::jsonb),
('Příprava na zkoušky', 'Tematická revize, procvičení a testy.', true, $${
  "chapters": [
    {"title":"Téma A","lessons":[
      {"title":"Přehled učiva","block_types":["heading","paragraph"]},
      {"title":"Procvičení","block_types":["activity","activity"]},
      {"title":"Test","block_types":["activity"]}
    ]},
    {"title":"Téma B","lessons":[
      {"title":"Přehled učiva","block_types":["heading","paragraph"]},
      {"title":"Procvičení","block_types":["activity","activity"]},
      {"title":"Test","block_types":["activity"]}
    ]},
    {"title":"Téma C","lessons":[
      {"title":"Přehled učiva","block_types":["heading","paragraph"]},
      {"title":"Procvičení","block_types":["activity","activity"]},
      {"title":"Test","block_types":["activity"]}
    ]},
    {"title":"Souhrnný test","lessons":[
      {"title":"Závěrečný test","block_types":["activity"]}
    ]}
  ]
}$$::jsonb);
